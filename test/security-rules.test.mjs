/**
 * Firebase Security Rules – Multi-Tenant isolation & role enforcement tests.
 *
 * Run via emulator (recommended):
 *   npm run test:rules
 *
 * Prerequisites:
 *   npm install
 *   Firebase CLI installed (firebase-tools)
 */
import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import {
  TENANTS,
  authContext,
  bulletinObjectPath,
  createRulesTestEnvironment,
  expectFirestoreAllow,
  expectFirestoreDeny,
  expectStorageUploadAllow,
  expectStorageUploadDeny,
  resetEmulatorData,
  sampleInventoryItem,
  sampleMhdItem,
  sampleSettings,
  sampleTask,
  seedFirestoreDoc,
  tenantDocPath,
} from './helpers/rules-test-env.mjs';
import { arrayUnion, serverTimestamp } from 'firebase/firestore';

describe('Firebase Security Rules (Custom Claims only)', function () {
  this.timeout(15000);

  /** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
  let testEnv;

  before(async () => {
    testEnv = await createRulesTestEnvironment();
  });

  beforeEach(async () => {
    await resetEmulatorData(testEnv);
  });

  after(async () => {
    await testEnv.cleanup();
  });

  describe('TEST CASE 1: Cross-Tenant Isolation (SaaS Wall)', () => {
    const torfabrikEmployee = () => authContext(
      testEnv,
      'tf-employee-1',
      TENANTS.TORFABRIK,
      'employee',
    );

    const collections = [
      { name: 'mhd_liste', docId: 'mhd-cross-1', sample: sampleMhdItem },
      { name: 'inventory', docId: 'inv-cross-1', sample: sampleInventoryItem },
      { name: 'tasks', docId: 'task-cross-1', sample: sampleTask },
    ];

    collections.forEach(({ name, docId, sample }) => {
      const ownPath = tenantDocPath(TENANTS.TORFABRIK, name, docId);
      const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, name, docId);

      it(`denies torfabrik employee read/write on StevesHof ${name}`, async () => {
        const ctx = torfabrikEmployee();
        const payload = sample(TENANTS.STEVES_HOF);

        await expectFirestoreDeny(ctx, foreignPath, 'read');
        await expectFirestoreDeny(ctx, foreignPath, 'create', payload);
      });

      it(`allows torfabrik employee read and write on own tenant ${name}`, async () => {
        const ctx = torfabrikEmployee();
        const payload = sample(TENANTS.TORFABRIK);

        await expectFirestoreAllow(ctx, ownPath, 'create', payload);
        await expectFirestoreAllow(ctx, ownPath, 'read');
      });
    });

    it('denies cross-tenant collection list queries', async () => {
      const ctx = torfabrikEmployee();
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.STEVES_HOF, 'mhd_liste', 'hidden-item'),
        sampleMhdItem(TENANTS.STEVES_HOF),
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'mhd_liste', 'list-probe'),
        'list',
      );
    });
  });

  describe('TEST CASE 2: helper Role Constraints', () => {
    const torfabrikHelper = () => authContext(
      testEnv,
      'tf-helper-1',
      TENANTS.TORFABRIK,
      'helper',
    );

    beforeEach(async () => {
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TORFABRIK, 'tasks', 'seed-task'),
        sampleTask(TENANTS.TORFABRIK, 'Seed Author'),
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TORFABRIK, 'mhd_liste', 'seed-mhd'),
        sampleMhdItem(TENANTS.TORFABRIK),
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TORFABRIK, 'settings', 'teamDashboard'),
        sampleSettings(TENANTS.TORFABRIK),
      );
    });

    it('allows helper to read tasks (teamboard) and mhd_liste (alarms)', async () => {
      const ctx = torfabrikHelper();

      await expectFirestoreAllow(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'tasks', 'seed-task'),
        'read',
      );
      await expectFirestoreAllow(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'mhd_liste', 'seed-mhd'),
        'read',
      );
    });

    it('denies helper writes to inventory', async () => {
      const ctx = torfabrikHelper();
      const path = tenantDocPath(TENANTS.TORFABRIK, 'inventory', 'helper-inject');

      await expectFirestoreDeny(
        ctx,
        path,
        'create',
        sampleInventoryItem(TENANTS.TORFABRIK),
      );
    });

    it('denies helper create/update/delete on operative collections and settings', async () => {
      const ctx = torfabrikHelper();

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'mhd_liste', 'helper-mhd'),
        'create',
        sampleMhdItem(TENANTS.TORFABRIK),
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'tasks', 'helper-task'),
        'create',
        sampleTask(TENANTS.TORFABRIK, 'Helper'),
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'settings', 'teamDashboard'),
        'update',
        { employees: ['Injected'], tenantId: TENANTS.TORFABRIK },
      );
    });
  });

  describe('TEST CASE 2c: stock updates from customer pickup', () => {
    const stockPath = tenantDocPath(TENANTS.STEVES_HOF, 'stammdaten', 'fleischsalat');
    const stockItem = {
      name: 'Fleischsalat',
      produkt: 'Fleischsalat',
      currentStock: 12,
      tenantId: TENANTS.STEVES_HOF,
    };

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, stockPath, stockItem);
    });

    it('allows employee to update only current stock on own tenant stock item', async () => {
      const ctx = authContext(testEnv, 'sh-employee-stock', TENANTS.STEVES_HOF, 'employee');

      await expectFirestoreAllow(
        ctx,
        stockPath,
        'update',
        { currentStock: 8, updatedAt: serverTimestamp() },
      );
    });

    it('denies stock updates across tenants or with product field changes', async () => {
      const ctx = authContext(testEnv, 'tf-employee-stock', TENANTS.TORFABRIK, 'employee');

      await expectFirestoreDeny(
        ctx,
        stockPath,
        'update',
        { currentStock: 8, updatedAt: serverTimestamp() },
      );

      const ownCtx = authContext(testEnv, 'sh-employee-stock-wide', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(
        ownCtx,
        stockPath,
        'update',
        { currentStock: 8, produkt: 'Geändert', updatedAt: serverTimestamp() },
      );

      await expectFirestoreDeny(
        ownCtx,
        stockPath,
        'update',
        { currentStock: 14, updatedAt: serverTimestamp() },
      );
    });
  });

  describe('TEST CASE 2b: task comments', () => {
    function comment(author = 'Stephan') {
      return {
        author,
        text: 'Bitte morgen nochmal prüfen.',
        createdAt: '2026-06-09T08:30:00.000Z',
      };
    }

    it('allows tenant users to append one task comment', async () => {
      for (const role of ['helper', 'employee', 'admin']) {
        const path = tenantDocPath(TENANTS.TORFABRIK, 'tasks', `comment-${role}`);
        await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TORFABRIK, 'Seed Author'));

        const ctx = authContext(testEnv, `tf-${role}-comment`, TENANTS.TORFABRIK, role);
        await expectFirestoreAllow(
          ctx,
          path,
          'update',
          { comments: arrayUnion(comment(role)) },
        );
      }
    });

    it('denies comments across tenants', async () => {
      const path = tenantDocPath(TENANTS.TORFABRIK, 'tasks', 'comment-cross-tenant');
      await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TORFABRIK, 'Seed Author'));

      const ctx = authContext(testEnv, 'sh-employee-comment', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(
        ctx,
        path,
        'update',
        { comments: arrayUnion(comment('StevesHof')) },
      );
    });

    it('denies comment updates that change task fields at the same time', async () => {
      const path = tenantDocPath(TENANTS.TORFABRIK, 'tasks', 'comment-mixed-update');
      await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TORFABRIK, 'Seed Author'));

      const ctx = authContext(testEnv, 'tf-employee-comment-mixed', TENANTS.TORFABRIK, 'employee');
      await expectFirestoreDeny(
        ctx,
        path,
        'update',
        {
          comments: arrayUnion(comment('Stephan')),
          title: 'Geändert',
        },
      );
    });
  });

  describe('TEST CASE 3: Terminal Credentials Lockout', () => {
    const torfabrikAdmin = () => authContext(
      testEnv,
      'tf-admin-1',
      TENANTS.TORFABRIK,
      'admin',
    );

    beforeEach(async () => {
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TORFABRIK, 'terminalCredentials', 'current'),
        { tenantId: TENANTS.TORFABRIK, seedVersion: 1 },
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TORFABRIK, 'pinAttempts', 'some-uid'),
        { count: 1, tenantId: TENANTS.TORFABRIK },
      );
    });

    it('denies admin read/write on terminalCredentials', async () => {
      const ctx = torfabrikAdmin();
      const path = tenantDocPath(TENANTS.TORFABRIK, 'terminalCredentials', 'current');

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'write', { tenantId: TENANTS.TORFABRIK });
      await expectFirestoreDeny(ctx, path, 'delete');
    });

    it('denies admin read/write on pinAttempts', async () => {
      const ctx = torfabrikAdmin();
      const path = tenantDocPath(TENANTS.TORFABRIK, 'pinAttempts', 'some-uid');

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'write', { count: 99 });
      await expectFirestoreDeny(ctx, path, 'delete');
    });
  });

  describe('TEST CASE 3b: TorFabrik module isolation', () => {
    const torfabrikAdmin = () => authContext(
      testEnv,
      'tf-admin-no-production',
      TENANTS.TORFABRIK,
      'admin',
    );

    it('denies TorFabrik access to recipes and production batches', async () => {
      const ctx = torfabrikAdmin();

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'rezepte', 'probe-recipe'),
        'read',
      );
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'produktion_chargen', 'probe-batch'),
        'read',
      );
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TORFABRIK, 'produktion_chargen', 'probe-batch'),
        'create',
        { tenantId: TENANTS.TORFABRIK },
      );
    });
  });

  describe('TEST CASE 4: Storage Rules & Bulletin Board', () => {
    const objectPath = bulletinObjectPath(TENANTS.TORFABRIK, 'image.jpg');

    it('allows torfabrik admin bulletin upload (production path: bulletin/)', async () => {
      const ctx = authContext(testEnv, 'tf-admin-storage', TENANTS.TORFABRIK, 'admin');
      await expectStorageUploadAllow(ctx, objectPath);
    });

    it('denies torfabrik employee bulletin upload', async () => {
      const ctx = authContext(testEnv, 'tf-employee-storage', TENANTS.TORFABRIK, 'employee');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('denies torfabrik helper bulletin upload', async () => {
      const ctx = authContext(testEnv, 'tf-helper-storage', TENANTS.TORFABRIK, 'helper');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('denies StevesHof admin upload into torfabrik bulletin path', async () => {
      const ctx = authContext(testEnv, 'sh-admin-storage', TENANTS.STEVES_HOF, 'admin');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('documents that bulletins/ (plural) is not a configured storage rule path', async () => {
      const pluralPath = `tenants/${TENANTS.TORFABRIK}/bulletins/image.jpg`;
      const ctx = authContext(testEnv, 'tf-admin-plural', TENANTS.TORFABRIK, 'admin');
      await expectStorageUploadDeny(ctx, pluralPath);
    });
  });

  describe('TEST CASE 5: system_errors write-only schema', () => {
    const torfabrikEmployee = () => authContext(
      testEnv,
      'tf-employee-telemetry',
      TENANTS.TORFABRIK,
      'employee',
    );

    function validSystemError(tenantId, overrides = {}) {
      return {
        tenantId,
        errorCode: 'ERR_TEST',
        message: 'Emulator-Testfehler',
        timestamp: serverTimestamp(),
        ...overrides,
      };
    }

    it('allows authenticated client to append a valid system_errors document', async () => {
      const ctx = torfabrikEmployee();
      await expectFirestoreAllow(
        ctx,
        'system_errors/telemetry-ok',
        'create',
        validSystemError(TENANTS.TORFABRIK),
      );
    });

    it('denies client read, update, and delete on system_errors', async () => {
      const ctx = torfabrikEmployee();
      const path = 'system_errors/telemetry-locked';

      await seedFirestoreDoc(testEnv, path, {
        tenantId: TENANTS.TORFABRIK,
        errorCode: 'ERR_SEED',
        message: 'seed',
      });

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'update', { message: 'changed' });
      await expectFirestoreDeny(ctx, path, 'delete');
    });

    it('denies create when tenantId does not match auth token', async () => {
      const ctx = torfabrikEmployee();
      await expectFirestoreDeny(
        ctx,
        'system_errors/telemetry-cross-tenant',
        'create',
        validSystemError(TENANTS.STEVES_HOF),
      );
    });

    it('denies create with foreign fields or oversized message', async () => {
      const ctx = torfabrikEmployee();

      await expectFirestoreDeny(
        ctx,
        'system_errors/telemetry-inject',
        'create',
        validSystemError(TENANTS.TORFABRIK, { injected: true }),
      );

      await expectFirestoreDeny(
        ctx,
        'system_errors/telemetry-flood',
        'create',
        validSystemError(TENANTS.TORFABRIK, { message: 'x'.repeat(1000) }),
      );
    });
  });

  describe('TEST CASE 5b: customer order status transitions', () => {
    const orderPath = tenantDocPath(TENANTS.TORFABRIK, 'customerOrders', 'order-ready-1');
    const torfabrikEmployee = () => authContext(
      testEnv,
      'tf-employee-orders',
      TENANTS.TORFABRIK,
      'employee',
    );

    function sampleCustomerOrder(overrides = {}) {
      return {
        tenantId: TENANTS.TORFABRIK,
        customerName: 'Testkunde',
        callbackPhone: '0123456789',
        readyAt: '2026-06-13T10:00:00.000Z',
        acceptedBy: 'Mitarbeiter',
        acceptedAt: '2026-06-12T10:00:00.000Z',
        status: 'open',
        items: [{ name: 'Bratwurst', quantity: 2, unit: 'kg' }],
        ...overrides,
      };
    }

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, orderPath, sampleCustomerOrder());
    });

    it('allows employee to mark a picklist order ready with pickup place and adjusted items', async () => {
      const ctx = torfabrikEmployee();

      await expectFirestoreAllow(ctx, orderPath, 'update', {
        status: 'ready',
        readyMarkedBy: 'Mitarbeiter',
        readyMarkedAt: serverTimestamp(),
        pickupPlace: 'Laden-Kuehlschrank',
        items: [{ name: 'Bratwurst', quantity: 1.8, unit: 'kg', actualQuantity: 1.8 }],
      });
    });

    it('denies employee item edits once the order is already ready', async () => {
      await seedFirestoreDoc(
        testEnv,
        orderPath,
        sampleCustomerOrder({
          status: 'ready',
          readyMarkedBy: 'Mitarbeiter',
          readyMarkedAt: '2026-06-12T10:05:00.000Z',
          pickupPlace: 'Laden-Kuehlschrank',
        }),
      );
      const ctx = torfabrikEmployee();

      await expectFirestoreDeny(ctx, orderPath, 'update', {
        items: [{ name: 'Bratwurst', quantity: 99, unit: 'kg' }],
      });
    });
  });

  describe('TEST CASE 6: pushTokens read lockout', () => {
    it('denies employee read on pushTokens', async () => {
      const ctx = authContext(testEnv, 'tf-employee-push', TENANTS.TORFABRIK, 'employee');
      const path = tenantDocPath(TENANTS.TORFABRIK, 'pushTokens', 'token-1');

      await seedFirestoreDoc(testEnv, path, {
        tenantId: TENANTS.TORFABRIK,
        token: 'seed-token',
        employeeName: 'Seed',
      });

      await expectFirestoreDeny(ctx, path, 'read');
    });
  });

  describe('Sanity: environment wiring', () => {
    it('initializes test environment with project id', () => {
      expect(testEnv).to.exist;
      expect(testEnv.emulators?.firestore?.port).to.equal(8080);
    });
  });
});
