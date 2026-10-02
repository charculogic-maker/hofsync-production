/**
 * Cloud Functions entry – discovery-safe & load-fast.
 *
 * Every export is a lazy getter: `require('./index.js')` + Object.keys stays
 * under 500ms because firebase-functions / Admin are not loaded until an export
 * value is actually read (Firebase discovery / runtime).
 */

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

/** @type {undefined | (() => void)} */
let adminReady;

function ensureAdminApp() {
  if (adminReady) return;
  const admin = require('./firebaseAdmin');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  adminReady = () => {};
}

function withAdmin(handler) {
  return async (request) => {
    ensureAdminApp();
    return handler(request);
  };
}

function lazyExport(exportName, factory) {
  let cached;
  Object.defineProperty(exports, exportName, {
    enumerable: true,
    configurable: true,
    get() {
      if (!cached) cached = factory();
      return cached;
    },
  });
}

function onCall(options, handler) {
  return require('firebase-functions/v2/https').onCall(options, handler);
}

function onSchedule(options, handler) {
  return require('firebase-functions/v2/scheduler').onSchedule(options, handler);
}

function onDocumentCreated(options, handler) {
  return require('firebase-functions/v2/firestore').onDocumentCreated(options, handler);
}

function onDocumentUpdated(options, handler) {
  return require('firebase-functions/v2/firestore').onDocumentUpdated(options, handler);
}

// —— HTTPS Callables ——

lazyExport('parseDeliveryNote', () => onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./deliveryNote').handleParseDeliveryNote(request)),
));

lazyExport('parseMeatLabel', () => onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./meatLabel').handleParseMeatLabel(request)),
));

lazyExport('verifyTerminalPin', () => onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  withAdmin(async (request) => require('./verifyTerminalPinCallable').handleVerifyTerminalPin(request)),
));

lazyExport('createTenantEmployee', () => onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./createTenantEmployee').handleCreateTenantEmployee(request)),
));

lazyExport('manageTenantEmployees', () => onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./manageTenantEmployees').handleManageTenantEmployees(request)),
));

lazyExport('provisionDemoTenant', () => onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./tenantAdmin').handleProvisionDemoTenant(request)),
));

lazyExport('triggerManualMeatPriceRun', () => onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: ['GEMINI_API_KEY'],
  },
  withAdmin(async (request) => require('./meatPrices').handleTriggerManualMeatPriceRun(request)),
));

lazyExport('archiveZeroStockBatches', () => onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./mhdArchive').handleArchiveZeroStockBatches(request)),
));

// —— Schedulers ——

lazyExport('fetchWeeklyMeatPrices', () => onSchedule(
  {
    region: REGION,
    schedule: '0 8 * * 3',
    timeZone: 'Europe/Berlin',
    retryCount: 2,
    timeoutSeconds: 120,
    secrets: ['GEMINI_API_KEY'],
  },
  async (event) => {
    ensureAdminApp();
    return require('./meatPrices').handleFetchWeeklyMeatPrices(event);
  },
));

lazyExport('archiveZeroStockBatchesScheduled', () => onSchedule(
  {
    region: REGION,
    schedule: '0 3 * * 0',
    timeZone: 'Europe/Berlin',
    retryCount: 1,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    ensureAdminApp();
    return require('./mhdArchive').handleArchiveZeroStockBatchesScheduled();
  },
));

// —— Firestore triggers ——

lazyExport('notifyTeamEntryCreated', () => onDocumentCreated(
  {
    document: 'tenants/{tenantId}/tasks/{taskId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./teamPush').handleNotifyTeamEntryCreated(event);
  },
));

lazyExport('onOrderReadySendSignal', () => onDocumentUpdated(
  {
    document: 'tenants/{tenantId}/customerOrders/{orderId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./orderNotifications').handleOrderReadySendSignal(event);
  },
));

lazyExport('onBulletinConfirmationAuditMail', () => onDocumentCreated(
  {
    document: 'tenants/{tenantId}/bulletinConfirmations/{confirmationId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./bulletinAuditMail').handleBulletinConfirmationAuditMail(event);
  },
));
