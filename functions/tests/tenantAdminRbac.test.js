/**
 * RBAC & Tenant isolation for createTenantEmployee / manageTenantEmployees.
 * Complements Firestore rules isolation (test/security-rules.test.mjs) and App Check contract.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';

const TENANT_A = 'StevesHof_Hauptbetrieb';
const TENANT_B = 'TorFabrik';

function authAs({ uid = 'uid-test', tenantId, role, email = '', isAdmin } = {}) {
  const token = {
    tenantId,
    role,
    email,
  };
  if (isAdmin === true || role === 'admin') {
    token.isAdmin = true;
  }
  return { uid, token };
}

describe('Vector 6 – Tenant Admin RBAC (Callables)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('assertAdminAccessForTenant rejects missing auth (unauthenticated)', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    expect(() => assertAdminAccessForTenant(null, TENANT_A)).toThrow(/Anmeldung|unauthenticated/i);
  });

  test('assertAdminAccessForTenant rejects employee without admin role', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    try {
      assertAdminAccessForTenant(authAs({ tenantId: TENANT_A, role: 'employee' }), TENANT_A);
      throw new Error('expected permission-denied');
    } catch (err) {
      expect(err.code).toBe('permission-denied');
      expect(String(err.message)).toMatch(/Admin/i);
    }
  });

  test('assertAdminAccessForTenant rejects helper without admin role', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    try {
      assertAdminAccessForTenant(authAs({ tenantId: TENANT_A, role: 'helper' }), TENANT_A);
      throw new Error('expected permission-denied');
    } catch (err) {
      expect(err.code).toBe('permission-denied');
    }
  });

  test('assertAdminAccessForTenant rejects Tenant-Admin A targeting tenant B', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    try {
      assertAdminAccessForTenant(
        authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
        TENANT_B,
      );
      throw new Error('expected permission-denied');
    } catch (err) {
      expect(err.code).toBe('permission-denied');
      expect(String(err.message)).toMatch(/Mandant|Zugriff/i);
    }
  });

  test('assertAdminAccessForTenant allows Tenant-Admin A on own tenant', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    const ctx = assertAdminAccessForTenant(
      authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
      TENANT_A,
    );
    expect(ctx.tenantId).toBe(TENANT_A);
    expect(ctx.isAdmin).toBe(true);
    expect(ctx.isSuperAdmin).toBe(false);
  });

  test('createTenantEmployee rejects employee caller before Auth createUser', async () => {
    const { handleCreateTenantEmployee } = await import('../createTenantEmployee.js');
    let caught = null;
    try {
      await handleCreateTenantEmployee({
        auth: authAs({ uid: 'emp-1', tenantId: TENANT_A, role: 'employee' }),
        data: {
          tenantId: TENANT_A,
          name: 'Neu',
          email: 'neu@example.com',
          password: 'secret12',
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('createTenantEmployee rejects Tenant-Admin A with tenantId of tenant B', async () => {
    const { handleCreateTenantEmployee } = await import('../createTenantEmployee.js');
    let caught = null;
    try {
      await handleCreateTenantEmployee({
        auth: authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
        data: {
          tenantId: TENANT_B,
          name: 'Fremd',
          email: 'fremd@example.com',
          password: 'secret12',
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('manageTenantEmployees list rejects employee', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    let caught = null;
    try {
      await handleManageTenantEmployees({
        auth: authAs({ uid: 'emp-2', tenantId: TENANT_A, role: 'employee' }),
        data: { action: 'list', tenantId: TENANT_A },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('manageTenantEmployees list rejects Tenant-Admin A listing tenant B', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    let caught = null;
    try {
      await handleManageTenantEmployees({
        auth: authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
        data: { action: 'list', tenantId: TENANT_B },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('manageTenantEmployees rejects unauthenticated caller', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    let caught = null;
    try {
      await handleManageTenantEmployees({
        auth: null,
        data: { action: 'list', tenantId: TENANT_A },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(['unauthenticated', 'permission-denied']).toContain(caught.code);
  });

  test('assertAdminAccessForTenant allows platform super-admin without tenant claim', async () => {
    const { assertAdminAccessForTenant } = await import('../manageTenantEmployees.js');
    const ctx = assertAdminAccessForTenant(
      authAs({
        uid: 'VYwMy5IAlAR26pj8ZbFfc5PNdou2',
        email: 'patrik@charculogic.de',
      }),
      TENANT_A,
    );
    expect(ctx.isSuperAdmin).toBe(true);
    expect(ctx.tenantId).toBe(TENANT_A);
    expect(ctx.isAdmin).toBe(true);
  });

  test('resetPassword rejects employee on own tenant', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    let caught = null;
    try {
      await handleManageTenantEmployees({
        auth: authAs({ uid: 'emp-2', tenantId: TENANT_A, role: 'employee' }),
        data: { action: 'resetPassword', tenantId: TENANT_A, uid: 'emp-2' },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('disable rejects Tenant-Admin A targeting tenant B', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    let caught = null;
    try {
      await handleManageTenantEmployees({
        auth: authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
        data: { action: 'disable', tenantId: TENANT_B, uid: 'emp-b' },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('mergeEmployeeSources keeps shop names when Auth users have no claims', async () => {
    const { mergeEmployeeSources, defaultProfileNamesForTenant } = await import('../manageTenantEmployees.js');
    const merged = mergeEmployeeSources({
      users: [],
      nestedEmployees: [],
      authUsers: [],
      profileNames: defaultProfileNamesForTenant(TENANT_A),
      tenantId: TENANT_A,
    });
    const names = merged.map((entry) => entry.displayName);
    expect(names).toEqual(expect.arrayContaining(['Paddy', 'Stephie', 'Bettina', 'Nicole', 'Heiko']));
    expect(merged.every((entry) => entry.source === 'profile')).toBe(true);
    expect(merged.every((entry) => String(entry.uid).startsWith('profile:'))).toBe(true);
    const paddy = merged.find((entry) => entry.displayName === 'Paddy');
    expect(paddy.role).toBe('admin');
    expect(merged.filter((entry) => entry.displayName !== 'Paddy').every((entry) => entry.role === 'employee')).toBe(true);
  });

  test('mergeEmployeeSources prefers nested employees over profile names', async () => {
    const { mergeEmployeeSources } = await import('../manageTenantEmployees.js');
    const merged = mergeEmployeeSources({
      users: [],
      nestedEmployees: [{
        uid: 'paddy-uid',
        displayName: 'Paddy',
        email: 'paddy@steveshof.de',
        tenantId: TENANT_A,
        role: 'employee',
        source: 'employees',
      }],
      authUsers: [],
      profileNames: ['Paddy', 'Stephie'],
      tenantId: TENANT_A,
    });
    const paddy = merged.find((entry) => entry.displayName === 'Paddy');
    const stephie = merged.find((entry) => entry.displayName === 'Stephie');
    expect(paddy.uid).toBe('paddy-uid');
    expect(paddy.email).toBe('paddy@steveshof.de');
    expect(paddy.source).toBe('employees');
    expect(stephie.source).toBe('profile');
    expect(String(stephie.uid).startsWith('profile:')).toBe(true);
  });

  test('manageTenantEmployees list returns StevesHof profiles when users collection is empty', async () => {
    const { handleManageTenantEmployees } = await import('../manageTenantEmployees.js');
    const result = await handleManageTenantEmployees({
      auth: authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin' }),
      data: { action: 'list', tenantId: TENANT_A },
    });
    const names = (result.employees || []).map((entry) => entry.displayName);
    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe(TENANT_A);
    expect(names).toEqual(expect.arrayContaining(['Paddy', 'Stephie', 'Bettina', 'Nicole', 'Heiko']));
    const paddy = result.employees.find((entry) => entry.displayName === 'Paddy');
    expect(paddy.role).toBe('admin');
    expect(result.employees.filter((entry) => entry.displayName !== 'Paddy').every((entry) => entry.role === 'employee')).toBe(true);
  });

  test('generateStartPassword returns Hof- prefix', async () => {
    const { generateStartPassword } = await import('../manageTenantEmployees.js');
    const password = generateStartPassword();
    expect(password.startsWith('Hof-')).toBe(true);
    expect(password.length).toBeGreaterThanOrEqual(10);
  });
});
