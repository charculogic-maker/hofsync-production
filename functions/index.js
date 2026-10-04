/**
 * Cloud Functions entry.
 *
 * `require()` must stay under the deploy discovery budget. The Firebase CLI
 * reads `__endpoint` during load and does not call the handlers. The
 * firebase-functions SDK (and Admin) load on the first real invocation.
 */

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

/** @type {undefined | true} */
let adminReady;

function ensureAdminApp() {
  if (adminReady) return;
  const admin = require('./firebaseAdmin');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  adminReady = true;
}

function withAdmin(handler) {
  return async (request) => {
    ensureAdminApp();
    return handler(request);
  };
}

function memoryMb(memory) {
  if (memory == null || memory === '') return null;
  if (typeof memory === 'number') return memory;
  const match = String(memory).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function baseEndpoint(options) {
  const endpoint = {
    availableMemoryMb: memoryMb(options.memory),
    timeoutSeconds: options.timeoutSeconds ?? null,
    minInstances: null,
    maxInstances: null,
    ingressSettings: null,
    concurrency: null,
    serviceAccountEmail: null,
    vpc: null,
    platform: 'gcfv2',
    region: [options.region || REGION],
    labels: {},
  };
  if (Array.isArray(options.secrets) && options.secrets.length) {
    endpoint.secretEnvironmentVariables = options.secrets.map((key) => ({ key }));
  }
  return endpoint;
}

function lazyExport(exportName, build) {
  let cached;
  Object.defineProperty(exports, exportName, {
    enumerable: true,
    configurable: true,
    get() {
      if (!cached) cached = build();
      return cached;
    },
  });
}

function callable(options, handler) {
  let impl;
  const func = (req, res) => {
    if (!impl) impl = require('firebase-functions/v2/https').onCall(options, handler);
    return impl(req, res);
  };
  func.run = handler;
  func.__endpoint = {
    ...baseEndpoint(options),
    callableTrigger: {},
  };
  return func;
}

function scheduled(options, handler) {
  let impl;
  const func = (event) => {
    if (!impl) impl = require('firebase-functions/v2/scheduler').onSchedule(options, handler);
    return impl(event);
  };
  func.run = handler;
  func.__requiredAPIs = [
    {
      api: 'cloudscheduler.googleapis.com',
      reason: 'Needed for scheduled functions.',
    },
  ];
  func.__endpoint = {
    ...baseEndpoint(options),
    scheduleTrigger: {
      schedule: options.schedule,
      retryConfig: {
        retryCount: options.retryCount ?? 0,
      },
      timeZone: options.timeZone || 'UTC',
    },
  };
  return func;
}

function firestoreTrigger(eventType, options, handler) {
  let impl;
  const func = (event) => {
    if (!impl) {
      const firestore = require('firebase-functions/v2/firestore');
      const register = eventType.endsWith('.created')
        ? firestore.onDocumentCreated
        : firestore.onDocumentUpdated;
      impl = register(options, handler);
    }
    return impl(event);
  };
  func.run = handler;
  func.__endpoint = {
    ...baseEndpoint(options),
    eventTrigger: {
      eventType,
      eventFilters: {
        database: '(default)',
        namespace: '(default)',
      },
      eventFilterPathPatterns: {
        document: options.document,
      },
      retry: false,
    },
  };
  return func;
}

// —— HTTPS Callables ——

lazyExport('parseDeliveryNote', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./deliveryNote').handleParseDeliveryNote(request)),
));

lazyExport('parseMeatLabel', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./meatLabel').handleParseMeatLabel(request)),
));

lazyExport('verifyTerminalPin', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  withAdmin(async (request) => require('./verifyTerminalPinCallable').handleVerifyTerminalPin(request)),
));

lazyExport('createTenantEmployee', () => callable(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./createTenantEmployee').handleCreateTenantEmployee(request)),
));

lazyExport('manageTenantEmployees', () => callable(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./manageTenantEmployees').handleManageTenantEmployees(request)),
));

lazyExport('provisionDemoTenant', () => callable(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./tenantAdmin').handleProvisionDemoTenant(request)),
));

lazyExport('triggerManualMeatPriceRun', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: ['GEMINI_API_KEY'],
  },
  withAdmin(async (request) => require('./meatPrices').handleTriggerManualMeatPriceRun(request)),
));

lazyExport('archiveZeroStockBatches', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./mhdArchive').handleArchiveZeroStockBatches(request)),
));

// —— Schedulers: registration only. The handler runs when Cloud Scheduler fires. ——

lazyExport('fetchWeeklyMeatPrices', () => scheduled(
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

lazyExport('archiveZeroStockBatchesScheduled', () => scheduled(
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

lazyExport('notifyTeamEntryCreated', () => firestoreTrigger(
  'google.cloud.firestore.document.v1.created',
  {
    document: 'tenants/{tenantId}/tasks/{taskId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./teamPush').handleNotifyTeamEntryCreated(event);
  },
));

lazyExport('onOrderReadySendSignal', () => firestoreTrigger(
  'google.cloud.firestore.document.v1.updated',
  {
    document: 'tenants/{tenantId}/customerOrders/{orderId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./orderNotifications').handleOrderReadySendSignal(event);
  },
));

lazyExport('onBulletinConfirmationAuditMail', () => firestoreTrigger(
  'google.cloud.firestore.document.v1.created',
  {
    document: 'tenants/{tenantId}/bulletinConfirmations/{confirmationId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./bulletinAuditMail').handleBulletinConfirmationAuditMail(event);
  },
));
