import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { createResetMailer, acceptedRecipient, smtpErrorMetadata, MAIL_UNAVAILABLE } from './resetMailer.js';
import { canResetAdmin, configuredResetAdmin, normalizeEmail } from './adminResetPolicy.js';
import { adminUrl, config, assert, clearSession, db, wrap } from './common.js';

const router = Router();
const RESET_TTL_MS = 15 * 60 * 1000;
const GENERIC_MESSAGE = 'If an admin account exists with this email, a password reset link has been sent.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenPattern = /^[a-f0-9]{64}$/i;
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function resetEmail(resetUrl) {
  const escapedUrl = resetUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<!doctype html><html><body style="margin:0;background:#FFE4F1;font-family:Arial,sans-serif;color:#412b39"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="padding:30px;background:#8B004E;color:#fff;text-align:center"><div style="font-size:34px">♥</div><div style="font-size:22px;font-weight:700">THE GIFT ZONE</div><div style="margin-top:5px;color:#FFBBD9;font-size:12px;letter-spacing:2px">ADMIN SECURITY</div></td></tr><tr><td style="padding:36px"><p>Hello,</p><p style="line-height:1.7">We received a request to reset your THE GIFT ZONE administrator password.</p><p style="line-height:1.7">Click the button below to create a new password.</p><p style="text-align:center;margin:30px 0"><a href="${escapedUrl}" style="display:inline-block;background:#E91584;color:#fff;text-decoration:none;padding:14px 25px;border-radius:10px;font-weight:700">Reset Password</a></p><p style="font-size:13px;line-height:1.7;color:#6f5a68">This secure link expires in 15 minutes. If the button does not work, copy and paste this link into your browser:</p><p style="font-size:12px;line-height:1.6;word-break:break-all;color:#8B004E">${escapedUrl}</p><p style="font-size:13px;line-height:1.7;color:#6f5a68">If you did not request this change, you can safely ignore this email. Your password will remain unchanged.</p></td></tr></table></td></tr></table></body></html>`;
}

router.post('/forgot-password', wrap(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  assert(emailPattern.test(email) && email.length <= 254, 'Enter a valid email address');
  // A bad deployment setting is not an unknown-email request. Check it for
  // every caller, preserving the same response regardless of submitted email.
  const user = await configuredResetAdmin(db, process.env.ADMIN_EMAIL);
  if (!user) {
    console.error('admin_password_reset: configuration_error ADMIN_EMAIL must match an existing ADMIN account');
    assert(false, MAIL_UNAVAILABLE, 503);
  }
  // Check service availability for EVERY address, before account lookup, so a
  // missing configuration or SMTP authentication failure cannot expose accounts.
  const mailer = createResetMailer();
  await mailer.verify();
  if (email === normalizeEmail(user.email)) {
    const token = crypto.randomBytes(32).toString('hex');
    const record = await db.$transaction(async tx => {
      await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
      return tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
    });
    const transport = mailer.transport;
      try {
        const resetUrl = `${adminUrl.replace(/\/$/, '')}${config.adminPath}/reset-password?token=${encodeURIComponent(token)}`;
        const delivery = await transport.sendMail({ from: mailer.from, to: user.email, subject: 'Reset Your THE GIFT ZONE Admin Password', text: `Hello,\n\nWe received a request to reset your THE GIFT ZONE administrator password.\n\nOpen this link to create a new password: ${resetUrl}\n\nThis link expires in 15 minutes. If you did not request this, ignore this email.`, html: resetEmail(resetUrl) });
        if (!acceptedRecipient(delivery, user.email)) throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' });
        console.info('admin_password_reset: smtp_accepted');
      } catch (error) {
        await db.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
        console.error('admin_password_reset: delivery_failed', smtpErrorMetadata(error));
      }
  } else {
    console.info('admin_password_reset: ineligible_request');
  }
  res.json({ ok: true, message: GENERIC_MESSAGE });
}));

router.post('/reset-password', wrap(async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  assert(tokenPattern.test(token), 'This password reset link is invalid or has expired', 400);
  assert(password.length >= 12 && password.length <= 128, 'Password must be between 12 and 128 characters');
  assert(password === confirmPassword, 'Passwords do not match');
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const tokenHash = hashToken(token);
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { role: true, email: true } } } });
  assert(reset && !reset.usedAt && reset.expiresAt > now && canResetAdmin(reset.user, process.env.ADMIN_EMAIL), 'This password reset link is invalid or has expired', 400);
  await db.$transaction(async tx => {
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    assert(consumed.count === 1, 'This password reset link is invalid or has expired', 400);
    const updated = await tx.user.updateMany({ where: { id: reset.userId, role: 'ADMIN', email: reset.user.email }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    assert(updated.count === 1, 'This password reset link is invalid or has expired', 400);
    await tx.passwordResetToken.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
  });
  clearSession(res);
  res.json({ ok: true, message: 'Your password has been reset. You can now sign in with your new password.' });
}));

export default router;
