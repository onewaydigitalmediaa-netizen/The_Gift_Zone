import nodemailer from 'nodemailer';
import { loadSmtpConfig } from './smtpConfig.js';

export const MAIL_UNAVAILABLE = 'Password reset email is temporarily unavailable. Please contact the store administrator or try again later.';
const unavailable = diagnostic => Object.assign(new Error(MAIL_UNAVAILABLE), { status: 503, diagnostic });

// Never log provider response text, recipient addresses, URLs or credentials.
export function smtpErrorMetadata(error) {
  const allowed = ['EAUTH', 'EDNS', 'ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'EENVELOPE', 'EMESSAGE'];
  return {
    code: allowed.includes(error?.code) ? error.code : 'SMTP_ERROR',
    ...(Number.isInteger(error?.responseCode) ? { responseCode: error.responseCode } : {})
  };
}

export function acceptedRecipient(result, recipient) {
  const normalize = value => String(value || '').trim().toLowerCase();
  return result?.accepted?.some(value => normalize(typeof value === 'string' ? value : value.address) === normalize(recipient)) === true;
}

export function createResetMailer(config = loadSmtpConfig(), createTransport = nodemailer.createTransport) {
  const host = config.SMTP_HOST?.trim();
  const user = config.SMTP_USER?.trim();
  // Google displays app passwords in groups; accept pasted spacing for Gmail.
  const password = host?.toLowerCase() === 'smtp.gmail.com' ? config.SMTP_PASSWORD?.replace(/\s/g, '') : config.SMTP_PASSWORD;
  const port = Number(config.SMTP_PORT || 587);
  const secure = String(config.SMTP_SECURE || 'false').toLowerCase();
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].filter(key => !config[key]?.trim());
  if (missing.length) throw unavailable(`Missing settings: ${missing.join(', ')}.`);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(secure)) throw unavailable('Invalid SMTP_PORT or SMTP_SECURE setting.');
  const transport = createTransport({
    host, port, secure: secure === 'true',
    requireTLS: secure !== 'true',
    auth: { user, pass: password },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
    logger: false, debug: false
  });
  return {
    transport,
    from: config.SMTP_FROM?.trim() || `The Gift Zone <${user}>`,
    async verify() {
      try { await transport.verify(); }
      catch (error) {
        const diagnostics = {
          EAUTH: 'SMTP authentication rejected. For Gmail, use a Google App Password for SMTP_USER, not the admin or regular Google password.',
          EDNS: 'SMTP hostname could not be resolved. Check SMTP_HOST and the network connection.',
          ECONNECTION: 'Cannot connect to SMTP. Check the host, port, TLS mode and firewall.',
          ESOCKET: 'SMTP connection or TLS failed. Check the host, port, TLS mode and network.',
          ETIMEDOUT: 'SMTP connection timed out. Check network access to the configured SMTP port.'
        };
        throw unavailable(diagnostics[error.code] || 'SMTP verification failed. Check the provider configuration.');
      }
    }
  };
}
