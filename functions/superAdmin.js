/** Platform super-admin gate – keep free of Firestore/Auth I/O. */
const SUPER_ADMIN_EMAIL = 'patrik@charculogic.de';
const SUPER_ADMIN_UIDS = new Set(['VYwMy5IAlAR26pj8ZbFfc5PNdou2']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isSuperAdmin(auth) {
  const email = normalizeEmail(auth?.token?.email || auth?.email);
  if (email === SUPER_ADMIN_EMAIL) return true;
  if (auth?.token?.superAdmin === true) return true;
  return SUPER_ADMIN_UIDS.has(String(auth?.uid || '').trim());
}

module.exports = {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_UIDS,
  isSuperAdmin,
  isSuperAdminForDashboard: isSuperAdmin,
};
