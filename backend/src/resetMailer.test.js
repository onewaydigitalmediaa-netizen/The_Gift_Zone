import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResetMailer, MAIL_UNAVAILABLE, acceptedRecipient, smtpErrorMetadata } from './resetMailer.js';
import { loadSmtpConfig } from './smtpConfig.js';

const config = { SMTP_HOST: 'smtp.example.test', SMTP_USER: 'sender@example.test', SMTP_PASSWORD: 'test-only-password' };
test('missing SMTP settings fail safely before any email request', () => {
  assert.throws(() => createResetMailer({}), { status: 503, message: MAIL_UNAVAILABLE });
});
test('SMTP uses bounded timeouts, TLS and a usable default sender', async () => {
  let options;
  const mailer = createResetMailer(config, value => { options = value; return { verify: async () => true }; });
  await mailer.verify();
  assert.equal(mailer.from, 'The Gift Zone <sender@example.test>');
  assert.equal(options.port, 587);
  assert.equal(options.requireTLS, true);
  assert.equal(options.debug, false);
  assert.equal(options.socketTimeout, 8000);
});
test('SMTP errors are sanitized, without credentials or provider details', async () => {
  const mailer = createResetMailer(config, () => ({ verify: async () => { throw new Error('sensitive provider details'); } }));
  await assert.rejects(mailer.verify(), { status: 503, message: MAIL_UNAVAILABLE });
});
test('invalid SMTP ports and secure modes are rejected', () => {
  for (const override of [{ SMTP_PORT: 'invalid' }, { SMTP_PORT: '0' }, { SMTP_SECURE: 'maybe' }]) {
    assert.throws(() => createResetMailer({ ...config, ...override }), { status: 503 });
  }
});

test('development reads new SMTP settings on each request without changing other configuration', () => {
  const environment = { NODE_ENV: 'development', SMTP_PASSWORD: 'old', ADMIN_EMAIL: 'owner@example.test' };
  let contents = 'SMTP_PASSWORD=first\nADMIN_EMAIL=ignored@example.test';
  const read = () => contents;
  assert.equal(loadSmtpConfig(environment, read).SMTP_PASSWORD, 'first');
  contents = 'SMTP_PASSWORD=second';
  assert.equal(loadSmtpConfig(environment, read).SMTP_PASSWORD, 'second');
  assert.equal(loadSmtpConfig(environment, read).ADMIN_EMAIL, 'owner@example.test');
  assert.equal(environment.SMTP_PASSWORD, 'old');
});

test('production does not read local SMTP settings', () => {
  const environment = { NODE_ENV: 'production', SMTP_PASSWORD: 'injected' };
  assert.equal(loadSmtpConfig(environment, () => { throw new Error('must not read'); }).SMTP_PASSWORD, 'injected');
});

test('Gmail accepts grouped app passwords and authentication diagnostics never expose secrets', async () => {
  let options;
  const mailer = createResetMailer({ ...config, SMTP_HOST: 'smtp.gmail.com', SMTP_PASSWORD: 'abcd efgh ijkl mnop' }, value => {
    options = value;
    return { verify: async () => { throw Object.assign(new Error('private-provider-message'), { code: 'EAUTH' }); } };
  });
  assert.equal(options.auth.pass, 'abcdefghijklmnop');
  await assert.rejects(mailer.verify(), error => error.status === 503 && error.diagnostic.includes('authentication rejected') && !error.diagnostic.includes('private-provider-message'));
});

test('SMTP acceptance must include the actual recipient', () => {
  assert.equal(acceptedRecipient({ accepted: ['owner@example.test'] }, 'owner@example.test'), true);
  assert.equal(acceptedRecipient({ accepted: [{ address: 'Owner@Example.test' }] }, 'owner@example.test'), true);
  assert.equal(acceptedRecipient({ accepted: [], rejected: ['owner@example.test'] }, 'owner@example.test'), false);
  assert.equal(acceptedRecipient({ accepted: ['someone@example.test'] }, 'owner@example.test'), false);
});

test('delivery logs use only allowlisted SMTP error codes and numeric response codes', () => {
  assert.deepEqual(smtpErrorMetadata({ code: 'EAUTH', responseCode: 535, message: 'secret', response: 'private details' }), { code: 'EAUTH', responseCode: 535 });
  assert.deepEqual(smtpErrorMetadata({ code: 'private-data', responseCode: 'private-data' }), { code: 'SMTP_ERROR' });
});
