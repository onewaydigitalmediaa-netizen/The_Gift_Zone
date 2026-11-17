export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

// ADMIN_EMAIL is an allowlist, never a substitute for an existing ADMIN user.
export function canResetAdmin(user, configuredEmail) {
  const email = normalizeEmail(configuredEmail);
  return Boolean(email && user?.role === 'ADMIN' && normalizeEmail(user.email) === email);
}

export async function configuredResetAdmin(db, configuredEmail) {
  const email = normalizeEmail(configuredEmail);
  const user = email ? await db.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } }) : null;
  return canResetAdmin(user, email) ? user : null;
}
