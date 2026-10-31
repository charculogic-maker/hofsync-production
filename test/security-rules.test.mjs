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
  sampleMhdAudit,
  sampleMhdItem,
  sampleProductMaster,
  sampleSettings,
  sampleSupplyAlert,
  sampleSupplyCatalogItem,
  sampleTask,
  sampleTraceabilityRecord,
  sampleWareneingangDelivery,
  seedFirestoreDoc,
  tenantDocPath,
  chargenDokuObjectPath,
  deliveryNotesObjectPath,
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
    const tenantBEmployee = () => authContext(
      testEnv,
      'tf-employee-1',
      TENANTS.TENANT_B,
      'employee',
    );

    const collections = [
      { name: 'mhd_liste', docId: 'mhd-cross-1', sample: sampleMhdItem },
      { name: 'inventory', docId: 'inv-cross-1', sample: sampleInventoryItem },
      { name: 'tasks', docId: 'task-cross-1', sample: sampleTask },
    ];

    collections.forEach(({ name, docId, sample }) => {
      const ownPath = tenantDocPath(TENANTS.TENANT_B, name, docId);
      const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, name, docId);

      it(`denies tenant-B employee read/write on StevesHof ${name}`, async () => {
        const ctx = tenantBEmployee();
        const payload = sample(TENANTS.STEVES_HOF);

        await expectFirestoreDeny(ctx, foreignPath, 'read');
        await expectFirestoreDeny(ctx, foreignPath, 'create', payload);
      });

      it(`allows tenant-B employee read and write on own tenant ${name}`, async () => {
        const ctx = tenantBEmployee();
        const payload = sample(TENANTS.TENANT_B);

        await expectFirestoreAllow(ctx, ownPath, 'create', payload);
        await expectFirestoreAllow(ctx, ownPath, 'read');
      });
    });

    it('denies cross-tenant collection list queries', async () => {
      const ctx = tenantBEmployee();
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
    const tenantBHelper = () => authContext(
      testEnv,
      'tf-helper-1',
      TENANTS.TENANT_B,
      'helper',
    );

    function sampleHaccpLog(tenantId, extra = {}) {
      return {
        logTyp: 'temperatur',
        type: 'temperature',
        deviceId: 'kuehlung-1',
        deviceName: 'Kuehlung 1',
        bereich: 'Verkauf',
        doneBy: 'Helper',
        wert: 4,
        value: 4,
        einheit: 'C',
        status: 'ok',
        tenantId,
        datum: '2026-10-18',
        createdAt: '2026-10-18T12:00:00.000Z',
        timestamp: '2026-10-18T12:00:00.000Z',
        ...extra,
      };
    }

    function sampleHaccpRoundLog(tenantId) {
      // Wie der PWA-Rundgang: ohne wert/value/user – darf create nicht blocken.
      return {
        logTyp: 'temperatur_rundgang',
        type: 'temperature_round',
        doneBy: 'Mitarbeiter',
        bereich: 'Tageskontrolle',
        deviceName: 'Temperatur-Rundgang',
        status: 'ok',
        centralControlVerified: false,
        measurements: [
          {
            deviceId: 'tk-truhe',
            deviceName: 'TK-Truhe',
            wert: -18,
            value: -18,
            status: 'ok',
          },
        ],
        massnahme: '',
        tenantId,
        datum: '2026-10-22',
        createdAt: '2026-10-22T06:00:00.000Z',
      };
    }

    beforeEach(async () => {
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TENANT_B, 'tasks', 'seed-task'),
        sampleTask(TENANTS.TENANT_B, 'Seed Author'),
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TENANT_B, 'mhd_liste', 'seed-mhd'),
        sampleMhdItem(TENANTS.TENANT_B),
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TENANT_B, 'settings', 'teamDashboard'),
        sampleSettings(TENANTS.TENANT_B),
      );
    });

    it('allows helper to read tasks (teamboard) and mhd_liste (alarms)', async () => {
      const ctx = tenantBHelper();

      await expectFirestoreAllow(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'tasks', 'seed-task'),
        'read',
      );
      await expectFirestoreAllow(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'mhd_liste', 'seed-mhd'),
        'read',
      );
    });

    it('denies helper writes to inventory', async () => {
      const ctx = tenantBHelper();
      const path = tenantDocPath(TENANTS.TENANT_B, 'inventory', 'helper-inject');

      await expectFirestoreDeny(
        ctx,
        path,
        'create',
        sampleInventoryItem(TENANTS.TENANT_B),
      );
    });

    it('denies helper create/update/delete on operative collections and settings', async () => {
      const ctx = tenantBHelper();

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'mhd_liste', 'helper-mhd'),
        'create',
        sampleMhdItem(TENANTS.TENANT_B),
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'tasks', 'helper-task'),
        'create',
        sampleTask(TENANTS.TENANT_B, 'Helper'),
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'settings', 'teamDashboard'),
        'update',
        { employees: ['Injected'], tenantId: TENANTS.TENANT_B },
      );

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'mhd_audit', 'helper-audit'),
        'create',
        sampleMhdAudit(TENANTS.TENANT_B),
      );
    });

    it('allows helper to create immutable own-tenant HACCP logs only', async () => {
      const ctx = tenantBHelper();
      const ownPath = tenantDocPath(TENANTS.TENANT_B, 'haccp_logs', 'helper-temperature');
      const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, 'haccp_logs', 'helper-temperature');
      const devicePath = tenantDocPath(TENANTS.TENANT_B, 'haccp_geraete', 'helper-device');

      await expectFirestoreAllow(
        ctx,
        ownPath,
        'create',
        sampleHaccpLog(TENANTS.TENANT_B),
      );
      await expectFirestoreDeny(
        ctx,
        ownPath,
        'update',
        { status: 'abweichung' },
      );
      await expectFirestoreDeny(ctx, ownPath, 'delete');
      await expectFirestoreDeny(
        ctx,
        foreignPath,
        'create',
        sampleHaccpLog(TENANTS.STEVES_HOF),
      );
      await expectFirestoreDeny(
        ctx,
        devicePath,
        'create',
        {
          id: 'helper-device',
          name: 'Helper Device',
          type: 'manual_temp',
          tenantId: TENANTS.TENANT_B,
        },
      );
    });

    it('allows employee to create temperature round without wert/value/user fields', async () => {
      const ctx = authContext(testEnv, 'tf-employee-haccp', TENANTS.TENANT_B, 'employee');
      const path = tenantDocPath(TENANTS.TENANT_B, 'haccp_logs', 'temperature_round_2026-10-22');

      await expectFirestoreAllow(
        ctx,
        path,
        'create',
        sampleHaccpRoundLog(TENANTS.TENANT_B),
      );
      await expectFirestoreDeny(
        ctx,
        path,
        'update',
        { status: 'abweichung' },
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
      const ctx = authContext(testEnv, 'tf-employee-stock', TENANTS.TENANT_B, 'employee');

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

  describe('TEST CASE 2d: MHD shopfloor updates', () => {
    const mhdPath = tenantDocPath(TENANTS.STEVES_HOF, 'mhd_liste', 'shopfloor-mhd-1');
    const mhdItem = {
      name: 'Test Milch',
      produkt: 'Test Milch',
      qty: 4,
      tenantId: TENANTS.STEVES_HOF,
    };

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, mhdPath, mhdItem);
    });

    it('allows employee to quittieren MHD with lastCheckedDate and qty', async () => {
      const ctx = authContext(testEnv, 'sh-employee-mhd', TENANTS.STEVES_HOF, 'employee');

      await expectFirestoreAllow(
        ctx,
        mhdPath,
        'update',
        {
          qty: 3,
          menge: 3,
          status: 'geprueft',
          mhdActionStatus: 'geprueft',
          lastCheckedDate: '2026-09-01',
          lastMhdCheckDate: '2026-09-01',
          lastCheckedBy: 'Anna',
          updatedAt: serverTimestamp(),
        },
      );
    });

    it('denies helper writes to mhd_liste', async () => {
      const ctx = authContext(testEnv, 'sh-helper-mhd', TENANTS.STEVES_HOF, 'helper');

      await expectFirestoreDeny(
        ctx,
        mhdPath,
        'update',
        {
          qty: 2,
          lastCheckedDate: '2026-09-01',
          updatedAt: serverTimestamp(),
        },
      );
    });
  });

  describe('TEST CASE 2e: Wareneingang MoPro Abschluss', () => {
    const deliveryPath = tenantDocPath(
      TENANTS.STEVES_HOF,
      'wareneingang_lieferungen',
      'lieferung_mopro_1',
    );
    const mhdPath = tenantDocPath(TENANTS.STEVES_HOF, 'mhd_liste', 'mopro-batch-1');

    it('allows employee to create Laden/MoPro delivery without temperature', async () => {
      const ctx = authContext(testEnv, 'sh-employee-we', TENANTS.STEVES_HOF, 'employee');
      const payload = sampleWareneingangDelivery(TENANTS.STEVES_HOF);
      await expectFirestoreAllow(ctx, deliveryPath, 'create', payload);
    });

    it('allows employee delivery with warenKategorieMetzgerei and lot fields', async () => {
      const ctx = authContext(testEnv, 'sh-employee-we-metz', TENANTS.STEVES_HOF, 'employee');
      const payload = sampleWareneingangDelivery(TENANTS.STEVES_HOF, {
        warenKategorie: 'Lohnschlachtung Rind',
        warenKategorieMetzgerei: 'Lohnschlachtung Rind',
        temperatur: 3.5,
        klassifizierung: 'Ochse',
        schlachtDatum: '2026-10-14',
        lot: 'GAL-OCHSE-20261014',
        chargenNummer: 'GAL-OCHSE-20261014',
        itemCount: 1,
      });
      await expectFirestoreAllow(ctx, deliveryPath, 'create', payload);
    });

    it('allows employee to create MoPro mhd_liste posten for StevesHof', async () => {
      const ctx = authContext(testEnv, 'sh-employee-we-mhd', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreAllow(
        ctx,
        mhdPath,
        'create',
        {
          name: 'Bio Drink Lennon crush',
          produkt: 'Bio Drink Lennon crush',
          qty: 7,
          menge: 7,
          kategorie: '🥛MoPro',
          lieferant: 'Weiling',
          source: 'wareneingang-app',
          tenantId: TENANTS.STEVES_HOF,
        },
      );
    });

    it('denies foreign tenant create on StevesHof wareneingang', async () => {
      const ctx = authContext(testEnv, 'tf-employee-we', TENANTS.TENANT_B, 'employee');
      await expectFirestoreDeny(
        ctx,
        deliveryPath,
        'create',
        sampleWareneingangDelivery(TENANTS.STEVES_HOF),
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
        const path = tenantDocPath(TENANTS.TENANT_B, 'tasks', `comment-${role}`);
        await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TENANT_B, 'Seed Author'));

        const ctx = authContext(testEnv, `tf-${role}-comment`, TENANTS.TENANT_B, role);
        await expectFirestoreAllow(
          ctx,
          path,
          'update',
          { comments: arrayUnion(comment(role)) },
        );
      }
    });

    it('denies comments across tenants', async () => {
      const path = tenantDocPath(TENANTS.TENANT_B, 'tasks', 'comment-cross-tenant');
      await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TENANT_B, 'Seed Author'));

      const ctx = authContext(testEnv, 'sh-employee-comment', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(
        ctx,
        path,
        'update',
        { comments: arrayUnion(comment('StevesHof')) },
      );
    });

    it('denies comment updates that change task fields at the same time', async () => {
      const path = tenantDocPath(TENANTS.TENANT_B, 'tasks', 'comment-mixed-update');
      await seedFirestoreDoc(testEnv, path, sampleTask(TENANTS.TENANT_B, 'Seed Author'));

      const ctx = authContext(testEnv, 'tf-employee-comment-mixed', TENANTS.TENANT_B, 'employee');
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
    const tenantBAdmin = () => authContext(
      testEnv,
      'tf-admin-1',
      TENANTS.TENANT_B,
      'admin',
    );

    beforeEach(async () => {
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TENANT_B, 'terminalCredentials', 'current'),
        { tenantId: TENANTS.TENANT_B, seedVersion: 1 },
      );
      await seedFirestoreDoc(
        testEnv,
        tenantDocPath(TENANTS.TENANT_B, 'pinAttempts', 'some-uid'),
        { count: 1, tenantId: TENANTS.TENANT_B },
      );
    });

    it('denies admin read/write on terminalCredentials', async () => {
      const ctx = tenantBAdmin();
      const path = tenantDocPath(TENANTS.TENANT_B, 'terminalCredentials', 'current');

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'write', { tenantId: TENANTS.TENANT_B });
      await expectFirestoreDeny(ctx, path, 'delete');
    });

    it('denies admin read/write on pinAttempts', async () => {
      const ctx = tenantBAdmin();
      const path = tenantDocPath(TENANTS.TENANT_B, 'pinAttempts', 'some-uid');

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'write', { count: 99 });
      await expectFirestoreDeny(ctx, path, 'delete');
    });
  });

  describe('TEST CASE 3b: module isolation when kitchen disabled', () => {
    const tenantBAdmin = () => authContext(
      testEnv,
      'tf-admin-no-production',
      TENANTS.TENANT_B,
      'admin',
    );

    it('denies Tenant-B access to recipes and production batches', async () => {
      const ctx = tenantBAdmin();
      await seedFirestoreDoc(testEnv, `tenants/${TENANTS.TENANT_B}`, {
        displayName: 'Tenant B',
        status: 'active',
        enabledModules: { kitchen: false, wurstkueche: false, retterBox: false },
      });

      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'rezepte', 'probe-recipe'),
        'read',
      );
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'produktion_chargen', 'probe-batch'),
        'read',
      );
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.TENANT_B, 'produktion_chargen', 'probe-batch'),
        'create',
        { tenantId: TENANTS.TENANT_B },
      );
    });
  });

  describe('TEST CASE 4: Storage Rules & Bulletin Board', () => {
    const objectPath = bulletinObjectPath(TENANTS.TENANT_B, 'image.jpg');

    it('allows tenant-B admin bulletin upload (production path: bulletin/)', async () => {
      const ctx = authContext(testEnv, 'tf-admin-storage', TENANTS.TENANT_B, 'admin');
      await expectStorageUploadAllow(ctx, objectPath);
    });

    it('denies tenant-B employee bulletin upload', async () => {
      const ctx = authContext(testEnv, 'tf-employee-storage', TENANTS.TENANT_B, 'employee');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('denies tenant-B helper bulletin upload', async () => {
      const ctx = authContext(testEnv, 'tf-helper-storage', TENANTS.TENANT_B, 'helper');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('denies StevesHof admin upload into tenant-B bulletin path', async () => {
      const ctx = authContext(testEnv, 'sh-admin-storage', TENANTS.STEVES_HOF, 'admin');
      await expectStorageUploadDeny(ctx, objectPath);
    });

    it('documents that bulletins/ (plural) is not a configured storage rule path', async () => {
      const pluralPath = `tenants/${TENANTS.TENANT_B}/bulletins/image.jpg`;
      const ctx = authContext(testEnv, 'tf-admin-plural', TENANTS.TENANT_B, 'admin');
      await expectStorageUploadDeny(ctx, pluralPath);
    });
  });

  describe('TEST CASE 3c: module flag opens Wurstküche', () => {
    it('allows a tenant with kitchen enabled to read recipes', async () => {
      await seedFirestoreDoc(testEnv, `tenants/${TENANTS.STEVES_HOF}`, {
        displayName: 'StevesHof',
        status: 'active',
        enabledModules: { kitchen: true, retterBox: false },
      });
      const ctx = authContext(testEnv, 'sh-employee-kitchen', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreAllow(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'rezepte', 'bratwurst'),
        'read',
      );
    });
  });

  describe('TEST CASE 5: system_errors write-only schema', () => {
    const tenantBEmployee = () => authContext(
      testEnv,
      'tf-employee-telemetry',
      TENANTS.TENANT_B,
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

    function telemetryPath(tenantId, id) {
      return `tenants/${tenantId}/system_errors/${id}`;
    }

    it('allows authenticated client to append a valid system_errors document', async () => {
      const ctx = tenantBEmployee();
      await expectFirestoreAllow(
        ctx,
        telemetryPath(TENANTS.TENANT_B, 'telemetry-ok'),
        'create',
        validSystemError(TENANTS.TENANT_B),
      );
    });

    it('denies employee read and any update or delete on system_errors', async () => {
      const ctx = tenantBEmployee();
      const path = telemetryPath(TENANTS.TENANT_B, 'telemetry-locked');

      await seedFirestoreDoc(testEnv, path, {
        tenantId: TENANTS.TENANT_B,
        errorCode: 'ERR_SEED',
        message: 'seed',
      });

      await expectFirestoreDeny(ctx, path, 'read');
      await expectFirestoreDeny(ctx, path, 'update', { message: 'changed' });
      await expectFirestoreDeny(ctx, path, 'delete');

      const admin = authContext(testEnv, 'tf-admin-telemetry', TENANTS.TENANT_B, 'admin');
      await expectFirestoreAllow(admin, path, 'read');
    });

    it('denies create on the global collection and across tenants', async () => {
      const ctx = tenantBEmployee();
      await expectFirestoreDeny(
        ctx,
        'system_errors/telemetry-global',
        'create',
        validSystemError(TENANTS.TENANT_B),
      );
      await expectFirestoreDeny(
        ctx,
        telemetryPath(TENANTS.STEVES_HOF, 'telemetry-cross-tenant'),
        'create',
        validSystemError(TENANTS.STEVES_HOF),
      );
    });

    it('denies create with foreign fields or oversized message', async () => {
      const ctx = tenantBEmployee();

      await expectFirestoreDeny(
        ctx,
        telemetryPath(TENANTS.TENANT_B, 'telemetry-inject'),
        'create',
        validSystemError(TENANTS.TENANT_B, { injected: true }),
      );

      await expectFirestoreDeny(
        ctx,
        telemetryPath(TENANTS.TENANT_B, 'telemetry-flood'),
        'create',
        validSystemError(TENANTS.TENANT_B, { message: 'x'.repeat(1000) }),
      );

      await expectFirestoreDeny(
        ctx,
        telemetryPath(TENANTS.TENANT_B, 'telemetry-userid'),
        'create',
        validSystemError(TENANTS.TENANT_B, { userId: 'person-name' }),
      );
    });
  });

  describe('TEST CASE 6: chargendoku tenant isolation', () => {
    const ownPath = tenantDocPath(TENANTS.TENANT_B, 'chargendoku', 'trace-own');
    const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, 'chargendoku', 'trace-foreign');
    const legacyOwnPath = tenantDocPath(TENANTS.TENANT_B, 'traceabilityRecords', 'trace-legacy');

    it('allows employee create/read on own tenant chargendoku', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace', TENANTS.TENANT_B, 'employee');
      const payload = sampleTraceabilityRecord(TENANTS.TENANT_B, { id: 'trace-own' });
      await expectFirestoreAllow(ctx, ownPath, 'create', payload);
      await expectFirestoreAllow(ctx, ownPath, 'read');
    });

    it('denies cross-tenant read/create on StevesHof chargendoku', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace-x', TENANTS.TENANT_B, 'employee');
      const payload = sampleTraceabilityRecord(TENANTS.STEVES_HOF, { id: 'trace-foreign' });
      await expectFirestoreDeny(ctx, foreignPath, 'read');
      await expectFirestoreDeny(ctx, foreignPath, 'create', payload);
    });

    it('allows create with optional organicControlBody and organicAssociation', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace-bio', TENANTS.TENANT_B, 'employee');
      const path = tenantDocPath(TENANTS.TENANT_B, 'chargendoku', 'trace-bio');
      const payload = sampleTraceabilityRecord(TENANTS.TENANT_B, {
        id: 'trace-bio',
        organicControlBody: 'DE-ÖKO-006',
        organicAssociation: 'Bioland',
      });
      await expectFirestoreAllow(ctx, path, 'create', payload);
    });

    it('denies create when organicControlBody is not a string', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace-bio-bad', TENANTS.TENANT_B, 'employee');
      const path = tenantDocPath(TENANTS.TENANT_B, 'chargendoku', 'trace-bio-bad');
      const payload = sampleTraceabilityRecord(TENANTS.TENANT_B, {
        id: 'trace-bio-bad',
        organicControlBody: 6,
        organicAssociation: 'EU-Bio',
      });
      await expectFirestoreDeny(ctx, path, 'create', payload);
    });

    it('allows admin status toggle and denies employee status update', async () => {
      await seedFirestoreDoc(
        testEnv,
        ownPath,
        sampleTraceabilityRecord(TENANTS.TENANT_B, { id: 'trace-own' }),
      );

      const admin = authContext(testEnv, 'tf-admin-trace', TENANTS.TENANT_B, 'admin');
      await expectFirestoreAllow(admin, ownPath, 'update', { status: 'archived' });

      const employee = authContext(testEnv, 'tf-employee-trace-upd', TENANTS.TENANT_B, 'employee');
      await expectFirestoreDeny(employee, ownPath, 'update', { status: 'active' });
    });

    it('allows employee read on legacy traceabilityRecords path', async () => {
      await seedFirestoreDoc(
        testEnv,
        legacyOwnPath,
        sampleTraceabilityRecord(TENANTS.TENANT_B, { id: 'trace-legacy' }),
      );
      const ctx = authContext(testEnv, 'tf-employee-trace-legacy', TENANTS.TENANT_B, 'employee');
      await expectFirestoreAllow(ctx, legacyOwnPath, 'read');
    });

    it('allows employee upload to own tenant chargendoku storage path', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace-storage', TENANTS.TENANT_B, 'employee');
      await expectStorageUploadAllow(ctx, chargenDokuObjectPath(TENANTS.TENANT_B, 'trace-own.jpg'));
    });

    it('denies cross-tenant chargendoku storage upload', async () => {
      const ctx = authContext(testEnv, 'tf-employee-trace-storage-x', TENANTS.TENANT_B, 'employee');
      await expectStorageUploadDeny(ctx, chargenDokuObjectPath(TENANTS.STEVES_HOF, 'trace-foreign.jpg'));
    });
  });

  describe('TEST CASE 6b: delivery_notes storage tenant isolation', () => {
    it('allows employee upload to own tenant delivery_notes path', async () => {
      const ctx = authContext(testEnv, 'tf-employee-delivery-storage', TENANTS.TENANT_B, 'employee');
      await expectStorageUploadAllow(ctx, deliveryNotesObjectPath(TENANTS.TENANT_B, 'ls-own.jpg'));
    });

    it('denies cross-tenant delivery_notes storage upload', async () => {
      const ctx = authContext(testEnv, 'tf-employee-delivery-storage-x', TENANTS.TENANT_B, 'employee');
      await expectStorageUploadDeny(ctx, deliveryNotesObjectPath(TENANTS.STEVES_HOF, 'ls-foreign.jpg'));
    });

    it('denies helper write on delivery_notes', async () => {
      const ctx = authContext(testEnv, 'tf-helper-delivery-storage', TENANTS.TENANT_B, 'helper');
      await expectStorageUploadDeny(ctx, deliveryNotesObjectPath(TENANTS.TENANT_B, 'ls-helper.jpg'));
    });
  });

  describe('TEST CASE 7: pushTokens read lockout', () => {
    it('denies employee read on pushTokens', async () => {
      const ctx = authContext(testEnv, 'tf-employee-push', TENANTS.TENANT_B, 'employee');
      const path = tenantDocPath(TENANTS.TENANT_B, 'pushTokens', 'token-1');

      await seedFirestoreDoc(testEnv, path, {
        tenantId: TENANTS.TENANT_B,
        token: 'seed-token',
        employeeName: 'Seed',
      });

      await expectFirestoreDeny(ctx, path, 'read');
    });
  });

  describe('TEST CASE 8: Tenant root status & delete (platform admin)', () => {
    const PLATFORM_DEV_ADMIN_UID = 'VYwMy5IAlAR26pj8ZbFfc5PNdou2';
    const tenantRootPath = `tenants/${TENANTS.TENANT_B}`;

    const sampleTenantRoot = (overrides = {}) => ({
      displayName: 'Tenant B',
      status: 'active',
      enabledModules: {
        start: true,
        team: true,
        mhd: true,
        receiving: false,
        kitchen: false,
        haccp: false,
        knowledge: false,
        buero: false,
        chargenDoku: true,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    });

    it('allows platform admin to create tenant with status active', async () => {
      const ctx = testEnv.authenticatedContext(PLATFORM_DEV_ADMIN_UID);
      await expectFirestoreAllow(ctx, `tenants/new-saas-tenant`, 'create', sampleTenantRoot({
        displayName: 'New SaaS',
      }));
    });

    it('denies tenant admin create on tenant root', async () => {
      const ctx = authContext(testEnv, 'tf-admin-root', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(ctx, `tenants/other-tenant`, 'create', sampleTenantRoot());
    });

    it('allows platform admin status toggle and denies tenant admin status update', async () => {
      await seedFirestoreDoc(testEnv, tenantRootPath, sampleTenantRoot());

      const platform = testEnv.authenticatedContext(PLATFORM_DEV_ADMIN_UID);
      await expectFirestoreAllow(platform, tenantRootPath, 'update', { status: 'inactive' });

      const admin = authContext(testEnv, 'tf-admin-status', TENANTS.TENANT_B, 'admin');
      // Muss einen echten Diff erzeugen (status wechseln), sonst ist affectedKeys leer
      // und die Admin-Modul-Update-Regel greift fälschlich.
      await expectFirestoreDeny(admin, tenantRootPath, 'update', { status: 'active' });
    });

    it('allows platform admin delete and denies tenant admin delete', async () => {
      await seedFirestoreDoc(testEnv, tenantRootPath, sampleTenantRoot());

      const admin = authContext(testEnv, 'tf-admin-del', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(admin, tenantRootPath, 'delete');

      const platform = testEnv.authenticatedContext(PLATFORM_DEV_ADMIN_UID);
      await expectFirestoreAllow(platform, tenantRootPath, 'delete');
    });
    it('denies Tenant-Admin of Tenant-B reading/writing StevesHof tenant root & modules', async () => {
      const stevesRoot = `tenants/${TENANTS.STEVES_HOF}`;
      await seedFirestoreDoc(testEnv, stevesRoot, sampleTenantRoot({
        displayName: 'StevesHof',
      }));

      const foreignAdmin = authContext(testEnv, 'tf-admin-cross-root', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(foreignAdmin, stevesRoot, 'read');
      await expectFirestoreDeny(foreignAdmin, stevesRoot, 'update', {
        enabledModules: { mhd: false },
      });
    });

    it('denies client updates of enabledModules and allows a displayName change', async () => {
      await seedFirestoreDoc(testEnv, tenantRootPath, sampleTenantRoot());
      const ownAdmin = authContext(testEnv, 'tf-admin-modules', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(ownAdmin, tenantRootPath, 'update', {
        enabledModules: {
          start: true,
          team: true,
          mhd: true,
          receiving: false,
          kitchen: true,
          haccp: false,
          knowledge: false,
          buero: false,
          chargenDoku: true,
        },
      });
      const platform = testEnv.authenticatedContext(PLATFORM_DEV_ADMIN_UID);
      await expectFirestoreDeny(platform, tenantRootPath, 'update', {
        enabledModules: { mhd: false },
      });
      await expectFirestoreAllow(ownAdmin, tenantRootPath, 'update', {
        displayName: 'Tenant B (isolation)',
      });
    });
  });

  describe('TEST CASE 9: Verwaltung RBAC (Stammdaten & Settings)', () => {
    const stammdatenPath = tenantDocPath(TENANTS.STEVES_HOF, 'stammdaten', 'paprika-creme');
    const settingsPath = tenantDocPath(TENANTS.STEVES_HOF, 'settings', 'teamDashboard');
    const article = {
      name: 'Weißenhorner Paprika Creme',
      ean: '4028332320111',
      lieferant: 'Weißenhorner',
      tenantId: TENANTS.STEVES_HOF,
      currentStock: 6,
    };
    const settings = {
      ...sampleSettings(TENANTS.STEVES_HOF),
      employees: ['Stephie', 'Finn'],
      updatedAt: serverTimestamp(),
    };

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, stammdatenPath, article);
      await seedFirestoreDoc(testEnv, settingsPath, {
        ...sampleSettings(TENANTS.STEVES_HOF),
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('allows tenant admin to create, update and delete stammdaten on own tenant', async () => {
      const admin = authContext(testEnv, 'sh-admin-stammdaten', TENANTS.STEVES_HOF, 'admin');
      await expectFirestoreAllow(
        admin,
        tenantDocPath(TENANTS.STEVES_HOF, 'stammdaten', 'new-ean-article'),
        'create',
        { ...article, ean: '4000000000000', name: 'Neuer Stammartikel' },
      );
      await expectFirestoreAllow(admin, stammdatenPath, 'update', {
        name: 'Weißenhorner Paprika Creme Bio',
        lieferant: 'Weißenhorner Molkerei',
      });
      await expectFirestoreAllow(admin, stammdatenPath, 'delete');
    });

    it('denies employee and helper create/delete on stammdaten', async () => {
      const employee = authContext(testEnv, 'sh-employee-stammdaten', TENANTS.STEVES_HOF, 'employee');
      const helper = authContext(testEnv, 'sh-helper-stammdaten', TENANTS.STEVES_HOF, 'helper');
      await expectFirestoreDeny(
        employee,
        tenantDocPath(TENANTS.STEVES_HOF, 'stammdaten', 'employee-inject'),
        'create',
        article,
      );
      await expectFirestoreDeny(employee, stammdatenPath, 'delete');
      await expectFirestoreDeny(helper, stammdatenPath, 'update', { name: 'Inject' });
      await expectFirestoreDeny(helper, stammdatenPath, 'delete');
    });

    it('denies cross-tenant admin writes on StevesHof stammdaten and settings', async () => {
      const foreignAdmin = authContext(testEnv, 'tf-admin-stammdaten', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(foreignAdmin, stammdatenPath, 'update', { name: 'Cross Tenant' });
      await expectFirestoreDeny(foreignAdmin, settingsPath, 'update', settings);
    });

    it('allows tenant admin to save team settings and denies employee/helper', async () => {
      const admin = authContext(testEnv, 'sh-admin-settings', TENANTS.STEVES_HOF, 'admin');
      const employee = authContext(testEnv, 'sh-employee-settings', TENANTS.STEVES_HOF, 'employee');
      const helper = authContext(testEnv, 'sh-helper-settings', TENANTS.STEVES_HOF, 'helper');
      await expectFirestoreAllow(admin, settingsPath, 'update', settings);
      await expectFirestoreAllow(admin, settingsPath, 'update', {
        ...settings,
        departmentAssignments: {
          Stephie: { departments: ['metzgerei'], canOrder: true },
        },
      });
      await expectFirestoreDeny(employee, settingsPath, 'update', settings);
      await expectFirestoreDeny(helper, settingsPath, 'update', settings);
      await expectFirestoreDeny(employee, settingsPath, 'delete');
    });

    it('allows departmentAssignments merge when legacy source field is present', async () => {
      const legacyPath = tenantDocPath(TENANTS.STEVES_HOF, 'settings', 'teamDashboard');
      await seedFirestoreDoc(testEnv, legacyPath, {
        ...sampleSettings(TENANTS.STEVES_HOF),
        source: 'restored-from-profile-defaultTeam',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      const admin = authContext(testEnv, 'sh-admin-settings-legacy', TENANTS.STEVES_HOF, 'admin');
      await expectFirestoreAllow(admin, legacyPath, 'update', {
        tenantId: TENANTS.STEVES_HOF,
        departmentAssignments: {
          Paddy: { departments: ['metzgerei', 'laden'], canOrder: true },
        },
        updatedAt: serverTimestamp(),
        updatedBy: 'Admin',
      });
    });

    it('allows teamDashboard set that includes sync.js createdAt', async () => {
      const path = tenantDocPath(TENANTS.STEVES_HOF, 'settings', 'teamDashboard');
      await seedFirestoreDoc(testEnv, path, {
        ...sampleSettings(TENANTS.STEVES_HOF),
        source: 'restored-from-profile-defaultTeam',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      const admin = authContext(testEnv, 'sh-admin-settings-createdat', TENANTS.STEVES_HOF, 'admin');
      // writeFirestoreDocOrQueue(op:'set') injects createdAt — must stay allowlisted.
      await expectFirestoreAllow(admin, path, 'create', {
        ...sampleSettings(TENANTS.STEVES_HOF),
        departmentAssignments: {
          Paddy: { departments: ['metzgerei'], canOrder: true },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'Admin',
      });
    });

    it('allows tenant admin to read own employees profiles and denies cross-tenant', async () => {
      const employeePath = tenantDocPath(TENANTS.STEVES_HOF, 'employees', 'paddy');
      await seedFirestoreDoc(testEnv, employeePath, {
        displayName: 'Paddy',
        tenantId: TENANTS.STEVES_HOF,
        role: 'employee',
      });
      const admin = authContext(testEnv, 'sh-admin-employees', TENANTS.STEVES_HOF, 'admin');
      const employee = authContext(testEnv, 'sh-employee-employees', TENANTS.STEVES_HOF, 'employee');
      const foreignAdmin = authContext(testEnv, 'tf-admin-employees', TENANTS.TENANT_B, 'admin');
      await expectFirestoreAllow(admin, employeePath, 'read');
      await expectFirestoreDeny(employee, employeePath, 'read');
      await expectFirestoreDeny(foreignAdmin, employeePath, 'read');
      await expectFirestoreDeny(foreignAdmin, employeePath, 'update', { displayName: 'Inject' });
    });
  });

  describe('TEST CASE 9a: supply_alerts Schnellmelde', () => {
    const alertPath = tenantDocPath(TENANTS.STEVES_HOF, 'supply_alerts', 'sa-weisswurst-1');
    const catalogPath = tenantDocPath(TENANTS.STEVES_HOF, 'supply_catalog', 'siegelrandbeutel');

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, alertPath, sampleSupplyAlert(TENANTS.STEVES_HOF));
      await seedFirestoreDoc(testEnv, catalogPath, sampleSupplyCatalogItem(TENANTS.STEVES_HOF));
    });

    it('allows employee and helper create/read/status-update; denies cross-tenant', async () => {
      const employee = authContext(testEnv, 'sh-employee-supply', TENANTS.STEVES_HOF, 'employee');
      const helper = authContext(testEnv, 'sh-helper-supply', TENANTS.STEVES_HOF, 'helper');
      const foreign = authContext(testEnv, 'tf-employee-supply', TENANTS.TENANT_B, 'employee');

      await expectFirestoreAllow(employee, alertPath, 'read');
      await expectFirestoreAllow(
        employee,
        tenantDocPath(TENANTS.STEVES_HOF, 'supply_alerts', 'sa-new-1'),
        'create',
        sampleSupplyAlert(TENANTS.STEVES_HOF, {
          title: 'Wurstdärme knapp',
          category: 'eigene_produktion',
          catalogItemId: 'wurstdarme_knapp',
        }),
      );
      await expectFirestoreAllow(
        helper,
        tenantDocPath(TENANTS.STEVES_HOF, 'supply_alerts', 'sa-helper'),
        'create',
        sampleSupplyAlert(TENANTS.STEVES_HOF, {
          title: 'Salsiccia',
          category: 'zukauf_fleisch_wurst',
          createdBy: 'Aushilfe',
        }),
      );
      await expectFirestoreAllow(
        employee,
        tenantDocPath(TENANTS.STEVES_HOF, 'supply_alerts', 'sa-assigned'),
        'create',
        sampleSupplyAlert(TENANTS.STEVES_HOF, {
          title: 'Sauerbratenbeize',
          category: 'eigene_produktion',
          assignedTo: 'Heiko',
          createdBy: 'Paddy',
        }),
      );
      await expectFirestoreAllow(employee, alertPath, 'update', {
        status: 'ordered',
        resolvedBy: 'Finn',
        resolvedAt: '2026-10-25T13:00:00.000Z',
        updatedAt: '2026-10-25T13:00:00.000Z',
      });
      await seedFirestoreDoc(testEnv, alertPath, sampleSupplyAlert(TENANTS.STEVES_HOF));
      await expectFirestoreAllow(employee, alertPath, 'update', {
        assignedTo: 'Heiko',
        departmentTarget: 'metzgerei',
        updatedBy: 'Paddy',
        updatedAt: '2026-10-29T20:40:00.000Z',
      });
      await expectFirestoreDeny(foreign, alertPath, 'read');
      await expectFirestoreDeny(
        foreign,
        tenantDocPath(TENANTS.STEVES_HOF, 'supply_alerts', 'sa-cross'),
        'create',
        sampleSupplyAlert(TENANTS.STEVES_HOF),
      );
    });

    it('allows employee to upsert supply_catalog and admin to delete', async () => {
      const employee = authContext(testEnv, 'sh-employee-catalog', TENANTS.STEVES_HOF, 'employee');
      const admin = authContext(testEnv, 'sh-admin-catalog', TENANTS.STEVES_HOF, 'admin');
      const foreign = authContext(testEnv, 'tf-employee-catalog', TENANTS.TENANT_B, 'employee');

      await expectFirestoreAllow(employee, catalogPath, 'read');
      await expectFirestoreAllow(
        employee,
        tenantDocPath(TENANTS.STEVES_HOF, 'supply_catalog', 'handtuchpapier'),
        'create',
        sampleSupplyCatalogItem(TENANTS.STEVES_HOF, {
          label: 'Handtuchpapier',
          normalizedKey: 'handtuchpapier',
          category: 'verbrauchsmaterial',
          departmentTarget: 'laden',
        }),
      );
      await expectFirestoreAllow(employee, catalogPath, 'update', {
        useCount: 2,
        quickEnabled: true,
        updatedAt: '2026-10-25T13:00:00.000Z',
        lastUsedAt: '2026-10-25T13:00:00.000Z',
        lastUsedBy: 'Finn',
      });
      await expectFirestoreAllow(admin, catalogPath, 'delete');
      await expectFirestoreDeny(foreign, catalogPath, 'read');
    });
  });

  describe('TEST CASE 9b: HACCP cleaning tasks admin write / tenant read', () => {
    const taskPath = tenantDocPath(TENANTS.STEVES_HOF, 'haccp_cleaning_tasks', 'verkaufstheke-waagen');
    const taskPayload = {
      name: 'Verkaufstheke & Waagen gereinigt',
      category: 'Täglich',
      period: 'day',
      sortOrder: 10,
      isProductionOnly: false,
      isActive: true,
      tenantId: TENANTS.STEVES_HOF,
      createdAt: '2026-10-18T12:00:00.000Z',
      updatedAt: '2026-10-18T12:00:00.000Z',
    };

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, taskPath, taskPayload);
    });

    it('allows tenant users to read cleaning tasks and admin to create/update/delete', async () => {
      const admin = authContext(testEnv, 'sh-admin-haccp-clean', TENANTS.STEVES_HOF, 'admin');
      const employee = authContext(testEnv, 'sh-employee-haccp-clean', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreAllow(admin, taskPath, 'read');
      await expectFirestoreAllow(employee, taskPath, 'read');
      await expectFirestoreAllow(
        admin,
        tenantDocPath(TENANTS.STEVES_HOF, 'haccp_cleaning_tasks', 'neue-aufgabe'),
        'create',
        { ...taskPayload, name: 'Metzgerei reinigen und desinfizieren', category: 'Nach Nutzung' },
      );
      await expectFirestoreAllow(
        admin,
        tenantDocPath(TENANTS.STEVES_HOF, 'haccp_cleaning_tasks', 'woechentlich-mittwoch'),
        'create',
        {
          ...taskPayload,
          name: 'Kühlhaus Grundreinigung',
          category: 'Wöchentlich',
          period: 'week',
          targetDay: 3,
        },
      );
      await expectFirestoreAllow(admin, taskPath, 'update', { sortOrder: 20 });
      await expectFirestoreAllow(admin, taskPath, 'update', { targetDay: 1, category: 'Wöchentlich', period: 'week' });
      await expectFirestoreDeny(admin, taskPath, 'update', { targetDay: 7 });
      await expectFirestoreAllow(admin, taskPath, 'delete');
    });

    it('denies employee write and cross-tenant admin access on cleaning tasks', async () => {
      const employee = authContext(testEnv, 'sh-employee-haccp-clean-w', TENANTS.STEVES_HOF, 'employee');
      const foreignAdmin = authContext(testEnv, 'tf-admin-haccp-clean', TENANTS.TENANT_B, 'admin');
      await expectFirestoreDeny(
        employee,
        tenantDocPath(TENANTS.STEVES_HOF, 'haccp_cleaning_tasks', 'employee-inject'),
        'create',
        taskPayload,
      );
      await expectFirestoreDeny(employee, taskPath, 'delete');
      await expectFirestoreDeny(foreignAdmin, taskPath, 'read');
      await expectFirestoreDeny(foreignAdmin, taskPath, 'update', { name: 'Cross Tenant' });
    });
  });

  describe('TEST CASE 10: mhd_audit / audit_logs tenant isolation', () => {
    const collections = ['mhd_audit', 'audit_logs'];

    collections.forEach((name) => {
      it(`denies tenant-B employee read/write on StevesHof ${name}`, async () => {
        const ctx = authContext(testEnv, 'tf-audit-emp', TENANTS.TENANT_B, 'employee');
        const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-cross-1');
        const payload = sampleMhdAudit(TENANTS.STEVES_HOF);

        await seedFirestoreDoc(testEnv, foreignPath, payload);
        await expectFirestoreDeny(ctx, foreignPath, 'read');
        await expectFirestoreDeny(
          ctx,
          tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-cross-create'),
          'create',
          payload,
        );
      });

      it(`allows employee create/read on own tenant ${name}`, async () => {
        const ctx = authContext(testEnv, 'sh-audit-emp', TENANTS.STEVES_HOF, 'employee');
        const ownPath = tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-own-1');
        const payload = sampleMhdAudit(TENANTS.STEVES_HOF);

        await expectFirestoreAllow(ctx, ownPath, 'create', payload);
        await expectFirestoreAllow(ctx, ownPath, 'read');
      });

      it(`denies employee update/delete on own tenant ${name}`, async () => {
        const ctx = authContext(testEnv, 'sh-audit-emp-upd', TENANTS.STEVES_HOF, 'employee');
        const ownPath = tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-locked');
        const payload = sampleMhdAudit(TENANTS.STEVES_HOF);
        await seedFirestoreDoc(testEnv, ownPath, payload);

        await expectFirestoreDeny(ctx, ownPath, 'update', { qtyTo: 1, tenantId: TENANTS.STEVES_HOF });
        await expectFirestoreDeny(ctx, ownPath, 'delete');
      });

      it(`allows admin update on own tenant ${name}`, async () => {
        const ctx = authContext(testEnv, 'sh-audit-admin', TENANTS.STEVES_HOF, 'admin');
        const ownPath = tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-admin');
        await seedFirestoreDoc(testEnv, ownPath, sampleMhdAudit(TENANTS.STEVES_HOF));

        await expectFirestoreAllow(ctx, ownPath, 'update', {
          qtyTo: 4,
          tenantId: TENANTS.STEVES_HOF,
        });
      });

      it(`allows helper to read but not create ${name}`, async () => {
        const helper = authContext(testEnv, 'sh-audit-helper', TENANTS.STEVES_HOF, 'helper');
        const ownPath = tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-helper-read');
        await seedFirestoreDoc(testEnv, ownPath, sampleMhdAudit(TENANTS.STEVES_HOF));

        await expectFirestoreAllow(helper, ownPath, 'read');
        await expectFirestoreDeny(
          helper,
          tenantDocPath(TENANTS.STEVES_HOF, name, 'audit-helper-write'),
          'create',
          sampleMhdAudit(TENANTS.STEVES_HOF),
        );
      });
    });

    it('denies create without actionType or articleName', async () => {
      const ctx = authContext(testEnv, 'sh-audit-invalid', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'mhd_audit', 'audit-invalid'),
        'create',
        sampleMhdAudit(TENANTS.STEVES_HOF, { actionType: '', articleName: 'X' }),
      );
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'mhd_audit', 'audit-invalid-name'),
        'create',
        sampleMhdAudit(TENANTS.STEVES_HOF, { articleName: '' }),
      );
    });
  });

  describe('TEST CASE 11: product_master tenant isolation', () => {
    it('denies tenant-B employee read/write on StevesHof product_master', async () => {
      const ctx = authContext(testEnv, 'tf-master-emp', TENANTS.TENANT_B, 'employee');
      const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, 'product_master', '4012346200507');
      const payload = sampleProductMaster(TENANTS.STEVES_HOF);

      await seedFirestoreDoc(testEnv, foreignPath, payload);
      await expectFirestoreDeny(ctx, foreignPath, 'read');
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'product_master', '4012346200508'),
        'create',
        sampleProductMaster(TENANTS.STEVES_HOF, { ean: '4012346200508' }),
      );
    });

    it('allows employee create/read/update on own tenant product_master', async () => {
      const ctx = authContext(testEnv, 'sh-master-emp', TENANTS.STEVES_HOF, 'employee');
      const ownPath = tenantDocPath(TENANTS.STEVES_HOF, 'product_master', '4012346200507');
      const payload = sampleProductMaster(TENANTS.STEVES_HOF);

      await expectFirestoreAllow(ctx, ownPath, 'create', payload);
      await expectFirestoreAllow(ctx, ownPath, 'read');
      await expectFirestoreAllow(ctx, ownPath, 'update', {
        ...payload,
        articleName: 'Cold Brew Süße Kräuter Bio',
        name: 'Cold Brew Süße Kräuter Bio',
      });
    });

    it('denies helper writes to product_master', async () => {
      const helper = authContext(testEnv, 'sh-master-helper', TENANTS.STEVES_HOF, 'helper');
      const ownPath = tenantDocPath(TENANTS.STEVES_HOF, 'product_master', 'helper-master');
      await seedFirestoreDoc(testEnv, ownPath, sampleProductMaster(TENANTS.STEVES_HOF, { ean: 'helper-master' }));

      await expectFirestoreAllow(helper, ownPath, 'read');
      await expectFirestoreDeny(
        helper,
        tenantDocPath(TENANTS.STEVES_HOF, 'product_master', 'helper-master-write'),
        'create',
        sampleProductMaster(TENANTS.STEVES_HOF, { ean: 'helper-master-write' }),
      );
    });

    it('denies create without articleName', async () => {
      const ctx = authContext(testEnv, 'sh-master-invalid', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(
        ctx,
        tenantDocPath(TENANTS.STEVES_HOF, 'product_master', '4012346200599'),
        'create',
        sampleProductMaster(TENANTS.STEVES_HOF, { ean: '4012346200599', articleName: '' }),
      );
    });
  });

  describe('TEST CASE 12: catalog_overrides public read + tenant write', () => {
    const sampleOverride = {
      isActive: true,
      promoPrice: 24.99,
      promoText: 'Wochen-Aktion',
      updatedBy: 'tester@example.com',
    };

    it('allows unauthenticated read on catalog_overrides', async () => {
      const path = tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '503');
      await seedFirestoreDoc(testEnv, path, sampleOverride);
      await expectFirestoreAllow(testEnv.unauthenticatedContext(), path, 'read');
    });

    it('allows tenant employee write and denies cross-tenant write', async () => {
      const own = authContext(testEnv, 'sh-cat-emp', TENANTS.STEVES_HOF, 'employee');
      const foreign = authContext(testEnv, 'tf-cat-emp', TENANTS.TENANT_B, 'employee');
      const ownPath = tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '501');
      const foreignPath = tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '500');

      await expectFirestoreAllow(own, ownPath, 'create', sampleOverride);
      await expectFirestoreDeny(foreign, foreignPath, 'create', sampleOverride);
    });

    it('denies helper write but allows helper read', async () => {
      const helper = authContext(testEnv, 'sh-cat-helper', TENANTS.STEVES_HOF, 'helper');
      const path = tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '550');
      await seedFirestoreDoc(testEnv, path, sampleOverride);
      await expectFirestoreAllow(helper, path, 'read');
      await expectFirestoreDeny(
        helper,
        tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '552'),
        'create',
        sampleOverride,
      );
    });

    it('denies unauthenticated write', async () => {
      await expectFirestoreDeny(
        testEnv.unauthenticatedContext(),
        tenantDocPath(TENANTS.STEVES_HOF, 'catalog_overrides', '503'),
        'create',
        sampleOverride,
      );
    });
  });

  describe('TEST CASE 13: averyDrafts Phone↔PC isolation', () => {
    const draftPath = (tenantId) => tenantDocPath(tenantId, 'averyDrafts', 'current');
    const sampleDraft = (tenantId, overrides = {}) => ({
      tenantId,
      header: {
        betrieb: 'Test Hof',
        oeko: 'DE-ÖKO-006',
        ohrmarke: 'DE123',
        schlachtDatum: '2026-10-20',
        zerlegeDatum: '2026-10-21',
        brand: 'SH',
        printBetrieb: false,
        printSchlachthof: false,
        printPlu: true,
      },
      queue: [{ cutId: 'rue-514', qty: 2 }],
      startSlot: 1,
      activeTab: 'ruecken',
      updatedAt: '2026-10-21T10:00:00.000Z',
      updatedAtMs: 1_761_045_200_000,
      updatedBy: 'Metzgerei',
      deviceId: 'phone-test',
      revision: 1_761_045_200_000,
      ...overrides,
    });

    beforeEach(async () => {
      await seedFirestoreDoc(testEnv, `tenants/${TENANTS.STEVES_HOF}`, {
        displayName: 'StevesHof',
        status: 'active',
        enabledModules: { averyLabels: true, mhd: true },
      });
      await seedFirestoreDoc(testEnv, `tenants/${TENANTS.TENANT_B}`, {
        displayName: 'Tenant B',
        status: 'active',
        enabledModules: { averyLabels: true, mhd: true },
      });
    });

    it('allows tenant employee read/write on own avery draft', async () => {
      const employee = authContext(testEnv, 'sh-avery-emp', TENANTS.STEVES_HOF, 'employee');
      const path = draftPath(TENANTS.STEVES_HOF);
      await expectFirestoreAllow(employee, path, 'create', sampleDraft(TENANTS.STEVES_HOF));
      await expectFirestoreAllow(employee, path, 'read');
    });

    it('allows Avery draft write even with sync.js createdAt injection', async () => {
      const employee = authContext(testEnv, 'sh-avery-createdAt', TENANTS.STEVES_HOF, 'employee');
      const path = draftPath(TENANTS.STEVES_HOF);
      await expectFirestoreAllow(
        employee,
        path,
        'create',
        sampleDraft(TENANTS.STEVES_HOF, { createdAt: '2026-10-26T12:00:00.000Z' }),
      );
    });

    it('denies cross-tenant read/write on StevesHof avery draft', async () => {
      const path = draftPath(TENANTS.STEVES_HOF);
      await seedFirestoreDoc(testEnv, path, sampleDraft(TENANTS.STEVES_HOF));
      const foreign = authContext(testEnv, 'tf-avery-emp', TENANTS.TENANT_B, 'employee');
      await expectFirestoreDeny(foreign, path, 'read');
      await expectFirestoreDeny(foreign, path, 'create', sampleDraft(TENANTS.STEVES_HOF));
    });

    it('denies helper write and denies access when module is off', async () => {
      const helper = authContext(testEnv, 'sh-avery-helper', TENANTS.STEVES_HOF, 'helper');
      const path = draftPath(TENANTS.STEVES_HOF);
      await expectFirestoreDeny(helper, path, 'create', sampleDraft(TENANTS.STEVES_HOF));

      await seedFirestoreDoc(testEnv, `tenants/${TENANTS.STEVES_HOF}`, {
        displayName: 'StevesHof',
        status: 'active',
        enabledModules: { averyLabels: false, mhd: true },
      });
      const employee = authContext(testEnv, 'sh-avery-modoff', TENANTS.STEVES_HOF, 'employee');
      await expectFirestoreDeny(employee, path, 'create', sampleDraft(TENANTS.STEVES_HOF));
      await expectFirestoreDeny(employee, path, 'read');
    });
  });

  describe('Sanity: environment wiring', () => {
    it('initializes test environment with project id', () => {
      expect(testEnv).to.exist;
      expect(testEnv.emulators?.firestore?.port).to.equal(8080);
    });
  });
});
