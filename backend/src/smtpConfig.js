import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
export function loadSmtpConfig(environment = process.env, read = readFileSync) {
  const config = { ...environment };
  // Local .env edits take effect on the next request. Deployed environments
  // retain their injected configuration and never read a local secrets file.
  if (environment.NODE_ENV !== 'development') return config;
  try {
    const local = parse(read(new URL('../.env', import.meta.url), 'utf8'));
    for (const key of keys) if (Object.hasOwn(local, key)) config[key] = local[key];
  } catch (error) {
    if (error.code !== 'ENOENT') throw Object.assign(new Error('Password reset email is temporarily unavailable. Please contact the store administrator or try again later.'), { status: 503, diagnostic: 'Cannot read backend/.env.' });
  }
  return config;
}
