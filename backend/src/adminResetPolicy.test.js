import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canResetAdmin, configuredResetAdmin, normalizeEmail } from './adminResetPolicy.js';

test('only the configured existing ADMIN account is eligible for reset', () => {
  const configured = 'owner@example.test';
  assert.equal(canResetAdmin({ email: configured, role: 'ADMIN' }, configured), true);
  assert.equal(canResetAdmin({ email: 'another@example.test', role: 'ADMIN' }, configured), false);
  assert.equal(canResetAdmin({ email: configured, role: 'STAFF' }, configured), false);
  assert.equal(canResetAdmin({ email: configured, role: 'CUSTOMER' }, configured), false);
  assert.equal(canResetAdmin(null, configured), false);
  assert.equal(canResetAdmin({ email: configured, role: 'ADMIN' }, ''), false);
});

test('email normalization supports case and whitespace, not non-string input', () => {
  assert.equal(normalizeEmail(' Owner@Example.test '), 'owner@example.test');
  assert.equal(normalizeEmail({ email: 'owner@example.test' }), '');
  assert.equal(canResetAdmin({ email: 'owner@example.test', role: 'ADMIN' }, ' Owner@Example.test '), true);
});

test('changing ADMIN_EMAIL alone never creates or authorizes an account', async () => {
  const owner = { id: 'owner', email: 'registered@example.test', role: 'ADMIN' };
  const db = { user: { findUnique: async ({ where }) => where.email === owner.email ? owner : null } };
  assert.equal(await configuredResetAdmin(db, 'sender@example.test'), null);
  assert.equal(await configuredResetAdmin(db, owner.email), owner);
  assert.equal(await configuredResetAdmin(db, ''), null);
  owner.role = 'CUSTOMER';
  assert.equal(await configuredResetAdmin(db, owner.email), null);
});
