import 'dotenv/config';
import { createResetMailer } from '../src/resetMailer.js';

try {
  const mailer = createResetMailer();
  await mailer.verify();
  console.log('SMTP connection and authentication succeeded. No email was sent.');
} catch (error) {
  // Only our fixed diagnostic strings are shown, never raw provider errors.
  console.error(error.diagnostic || 'SMTP unavailable. Check the SMTP settings in backend/.env.');
  process.exitCode = 1;
}
