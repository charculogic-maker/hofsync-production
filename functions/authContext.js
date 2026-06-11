const { HttpsError } = require('firebase-functions/v2/https');

function cleanTenantId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function tenantIdFromToken(token = {}) {
  return cleanTenantId(token.tenantId || token.tenant_id || token.tenantID);
}

function roleFromToken(token = {}) {
  if (token.isAdmin === true || token.admin === true) return 'admin';
  const role = typeof token.role === 'string' ? token.role.trim() : '';
  if (role === 'admin' || role === 'employee' || role === 'helper') return role;
  return '';
}

function resolveAuthContext(auth) {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Anmeldung erforderlich.');
  }

  const token = auth.token || {};
  const tenantId = tenantIdFromToken(token);
  const role = roleFromToken(token);

  if (!tenantId) {
    throw new HttpsError(
      'permission-denied',
      'Custom Claim tenantId fehlt. Bitte tools/set-user-claims.mjs ausführen und Token refreshen.',
    );
  }
  if (!role) {
    throw new HttpsError(
      'permission-denied',
      'Custom Claim role fehlt oder ist ungültig. Bitte tools/set-user-claims.mjs ausführen.',
    );
  }

  return {
    uid: auth.uid,
    tenantId,
    role,
    isAdmin: role === 'admin',
    isHelper: role === 'helper',
  };
}

function requireTenantAccess(auth, expectedTenantId) {
  const ctx = resolveAuthContext(auth);
  const expected = cleanTenantId(expectedTenantId);
  if (!expected || ctx.tenantId !== expected) {
    throw new HttpsError('permission-denied', 'Kein Zugriff auf diesen Mandanten.');
  }
  return ctx;
}

function requireEmployeeAccess(auth, expectedTenantId) {
  const ctx = requireTenantAccess(auth, expectedTenantId);
  if (ctx.isHelper) {
    throw new HttpsError('permission-denied', 'Aktion für Aushilfe-Konten nicht freigegeben.');
  }
  if (ctx.role !== 'employee' && !ctx.isAdmin) {
    throw new HttpsError('permission-denied', 'Mitarbeiter- oder Admin-Rolle erforderlich.');
  }
  return ctx;
}

module.exports = {
  cleanTenantId,
  resolveAuthContext,
  requireEmployeeAccess,
  requireTenantAccess,
  roleFromToken,
  tenantIdFromToken,
};
