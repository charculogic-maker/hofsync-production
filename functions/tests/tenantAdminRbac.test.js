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

  test('provisionDemoTenant slugifyTenantId derives clean underscore ids', async () => {
    const { slugifyTenantId } = await import('../tenantAdmin.js');
    expect(slugifyTenantId('Metzgerei Schmidt')).toBe('metzgerei_schmidt');
    expect(slugifyTenantId('  Bio-Hof Müller  ')).toBe('bio_hof_mueller');
  });

  test('provisionDemoTenant rejects employee caller', async () => {
    const { handleProvisionDemoTenant } = await import('../tenantAdmin.js');
    let caught = null;
    try {
      await handleProvisionDemoTenant({
        auth: authAs({ tenantId: TENANT_A, role: 'employee' }),
        data: {
          companyName: 'Metzgerei Schmidt',
          adminEmail: 'meister@example.de',
          adminName: 'Max Meister',
          modules: { mhd: true },
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('provisionDemoTenant rejects tenant-admin who is not platform super-admin', async () => {
    const { handleProvisionDemoTenant } = await import('../tenantAdmin.js');
    let caught = null;
    try {
      await handleProvisionDemoTenant({
        auth: authAs({ uid: 'admin-a', tenantId: TENANT_A, role: 'admin', email: 'admin@steveshof.de' }),
        data: {
          companyName: 'Metzgerei Schmidt',
          adminEmail: 'meister@example.de',
          adminName: 'Max Meister',
          modules: { mhd: true },
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeTruthy();
    expect(caught.code).toBe('permission-denied');
  });

  test('assertProvisionAccess allows platform super-admin', async () => {
    const { assertProvisionAccess } = await import('../tenantAdmin.js');
    const ctx = assertProvisionAccess(
      authAs({
        uid: 'VYwMy5IAlAR26pj8ZbFfc5PNdou2',
        tenantId: TENANT_A,
        role: 'admin',
        email: 'patrik@charculogic.de',
      }),
    );
    expect(ctx.isSuperAdmin).toBe(true);
  });
});
