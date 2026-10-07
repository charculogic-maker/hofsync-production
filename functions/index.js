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
  require('./firebaseAdmin').ensureAdminApp();
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
  const match = String(memory).trim().match(/^(\d+(?:\.\d+)?)\s*(mi?b|gi?b)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = String(match[2] || 'mb').toLowerCase();
  if (unit.startsWith('g')) return Math.round(amount * 1024);
  return Math.round(amount);
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

function http(options, handler) {
  let impl;
  const func = (req, res) => {
    if (!impl) impl = require('firebase-functions/v2/https').onRequest(options, handler);
    return impl(req, res);
  };
  func.run = handler;
  func.__endpoint = {
    ...baseEndpoint(options),
    httpsTrigger: {
      invoker: ['public'],
    },
  };
  return func;
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

lazyExport('saveReconciledItems', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    enforceAppCheck: false,
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  withAdmin(async (request) => require('./parseDeliveryNoteCallable').handleSaveReconciledItems(request)),
));

lazyExport('parseDeliveryNote', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    // hofsync.vercel.app scheitert an reCAPTCHA App Check; Firebase Auth bleibt Pflicht.
    enforceAppCheck: false,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  withAdmin(async (request) => {
    require('./parseDeliveryNoteCallable').assertDeliveryNoteCaller(request);
    return require('./deliveryNote').handleParseDeliveryNote(request);
  }),
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

lazyExport('listPlatformTenants', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    cors: true,
    enforceAppCheck: false,
  },
  withAdmin(async (request) => require('./tenantAdmin').handleListPlatformTenants(request)),
));

lazyExport('setTenantModules', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    // Gleiche Vercel-Hosts wie provisionDemoTenant: reCAPTCHA App Check scheitert dort.
    // Auth und Super-Admin-Prüfung bleiben Pflicht.
    cors: true,
    enforceAppCheck: false,
  },
  withAdmin(async (request) => require('./tenantAdmin').handleSetTenantModules(request)),
));

lazyExport('provisionNewCustomerTenant', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    cors: true,
    enforceAppCheck: false,
    timeoutSeconds: 60,
  },
  withAdmin(async (request) => require('./tenantAdmin').handleProvisionNewCustomerTenant(request)),
));

lazyExport('billingWebhook', () => http(
  {
    region: REGION,
    invoker: 'public',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    ensureAdminApp();
    return require('./billingWebhook').handleBillingWebhook(req, res);
  },
));

lazyExport('provisionDemoTenant', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    // Vercel preview/prod hosts fail reCAPTCHA App Check; auth still required.
    // cors: true allows https://hofsync.vercel.app and https://craftfoodapp.vercel.app.
    cors: true,
    enforceAppCheck: false,
  },
  // v2 onCall passes a single CallableRequest. Do not use the v1 (data, context) signature.
  withAdmin(async (request) => {
    const auth = request?.auth;
    const data = request?.data || {};
    return require('./tenantAdmin').handleProvisionDemoTenant({
      ...(request || {}),
      auth,
      data,
    });
  }),
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

lazyExport('processDeliveryNoteDraft', () => firestoreTrigger(
  'google.cloud.firestore.document.v1.created',
  {
    document: 'tenants/{tenantId}/delivery_note_drafts/{draftId}',
    region: REGION,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  async (event) => {
    ensureAdminApp();
    return require('./parseDeliveryNoteCallable').handleProcessDeliveryNoteDraft(event);
  },
));

lazyExport('reprocessDeliveryNoteDraft', () => callable(
  {
    ...CALLABLE_BASE_OPTIONS,
    enforceAppCheck: false,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  withAdmin(async (request) => {
    const caller = require('./parseDeliveryNoteCallable').assertDeliveryNoteCaller(request);
    return require('./deliveryNote').handleReprocessDeliveryNoteDraft({
      tenantId: caller.tenantId,
      draftId: request?.data?.draftId,
    });
  }),
));

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
