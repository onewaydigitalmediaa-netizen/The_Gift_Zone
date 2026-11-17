import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../src/adminResetPolicy.js';
import { createResetMailer } from '../src/resetMailer.js';

// Default is read-only. --send explicitly sends one real reset email to the
// existing configured ADMIN. It does not consume the token or change passwords.
const db = new PrismaClient();
let child;
try {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const before = email && await db.user.findUnique({ where: { email } });
  assert(before?.role === 'ADMIN', 'ADMIN_EMAIL must match an existing ADMIN account; no account was changed.');
  await createResetMailer().verify();
  console.log('Registered ADMIN and SMTP authentication: passed.');
  if (process.argv.includes('--send')) {
    // Launch the real backend with isolated rate-limit counters and captured
    // safe event logs, without stopping the user's existing development server.
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const events = [];
    let ready = false;
    child = spawn(process.execPath, ['src/server.js'], {
      cwd: new URL('../', import.meta.url),
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const capture = stream => {
      let buffer = '';
      stream.on('data', chunk => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('The Gift Zone API http://')) ready = true;
          // Print only fixed event names. Never echo arbitrary application or
          // provider output, which might contain sensitive diagnostic details.
          for (const event of ['smtp_accepted', 'ineligible_request', 'delivery_failed', 'configuration_error']) {
            if (line.startsWith(`admin_password_reset: ${event}`)) {
              events.push(event);
              console.log(`Backend log: admin_password_reset: ${event}`);
            }
          }
        }
      });
    };
    capture(child.stdout);
    capture(child.stderr);
    child.on('error', () => { ready = false; });
    for (let attempt = 0; !ready && attempt < 100 && child.exitCode === null; attempt++) await delay(100);
    assert(ready, 'Temporary backend did not start; check the backend startup configuration.');
    const post = async (path, body) => {
      const response = await fetch(`http://localhost:${port}/api/admin/auth/${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(30_000)
      });
      return { status: response.status, body: await response.json() };
    };
    const countBefore = await db.passwordResetToken.count();
    let unknown = 'reset-diagnostic@example.invalid';
    assert.equal(await db.user.count({ where: { email: unknown } }), 0, 'Diagnostic unknown address must not be registered.');
    const unknownResult = await post('forgot-password', { email: unknown });
    assert.equal(unknownResult.status, 200);
    assert.equal(await db.passwordResetToken.count(), countBefore, 'Unknown request must not create a token.');
    const registeredResult = await post('forgot-password', { email });
    assert.equal(registeredResult.status, 200);
    assert.deepEqual(registeredResult.body, unknownResult.body, 'Registered and unknown responses must be identical.');
    for (let attempt = 0; !events.includes('smtp_accepted') && attempt < 10; attempt++) await delay(50);
    assert(events.includes('smtp_accepted'), 'SMTP did not accept the reset email; check the backend delivery-failure log.');
    const active = await db.passwordResetToken.count({ where: { userId: before.id, usedAt: null, expiresAt: { gt: new Date() } } });
    assert.equal(active, 1, 'Exactly one active reset link must exist.');
    const invalid = await post('reset-password', { token: 'invalid' });
    assert.equal(invalid.status, 400);
    const after = await db.user.findUnique({ where: { id: before.id } });
    assert.deepEqual(after, before, 'Admin identity, password and permissions must remain unchanged.');
    console.log('PASS: identical generic responses, no token for unknown account, one active reset link, invalid token rejected, admin unchanged.');
    console.log('One reset email was accepted by SMTP for ADMIN_EMAIL. Inbox delivery is not confirmed by SMTP acceptance.');
  } else {
    console.log('No email sent. Use --send to test one real reset email to the registered ADMIN.');
  }
} catch (error) {
  // Assertion failures in this script can contain credential-bearing objects;
  // only print their explicit human-authored message, never stack or actual.
  console.error(error.diagnostic || (error.code === 'ERR_ASSERTION' && !error.generatedMessage ? error.message.split('\n')[0] : 'Reset verification failed. Check configuration and safe backend event logs.'));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
  }
  await db.$disconnect();
}
