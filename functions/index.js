/**
 * Cloud Functions entry – discovery-safe (no top-level Admin init / heavy deps).
 *
 * Callable/trigger wrappers register with firebase-functions only; feature modules
 * are required inside handlers so `require('./index.js')` exits immediately.
 */

const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');

const REGION = 'europe-west3';

const CALLABLE_BASE_OPTIONS = {
  region: REGION,
  enforceAppCheck: true,
};

/** @type {undefined | (() => void)} */
let adminReady;

/** Lazy Admin init – never at module top-level (keeps discovery event-loop clean). */
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

// —— HTTPS Callables ——

exports.parseDeliveryNote = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./deliveryNote').handleParseDeliveryNote(request)),
);

exports.parseMeatLabel = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    secrets: ['GEMINI_API_KEY'],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  withAdmin(async (request) => require('./meatLabel').handleParseMeatLabel(request)),
);

exports.verifyTerminalPin = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  withAdmin(async (request) => require('./verifyTerminalPinCallable').handleVerifyTerminalPin(request)),
);

exports.createTenantEmployee = onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./createTenantEmployee').handleCreateTenantEmployee(request)),
);

exports.manageTenantEmployees = onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => require('./manageTenantEmployees').handleManageTenantEmployees(request)),
);

exports.provisionDemoTenant = onCall(
  CALLABLE_BASE_OPTIONS,
  withAdmin(async (request) => {
    const tenantAdmin = require('./tenantAdmin');
    return tenantAdmin.handleProvisionDemoTenant(request);
  }),
);

exports.triggerManualMeatPriceRun = onCall(
  {
    ...CALLABLE_BASE_OPTIONS,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: ['GEMINI_API_KEY'],
  },
  withAdmin(async (request) => require('./meatPrices').handleTriggerManualMeatPriceRun(request)),
);

// —— Schedulers ——

exports.fetchWeeklyMeatPrices = onSchedule(
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
);

// —— Firestore triggers ——

exports.notifyTeamEntryCreated = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/tasks/{taskId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./teamPush').handleNotifyTeamEntryCreated(event);
  },
);

exports.onOrderReadySendSignal = onDocumentUpdated(
  {
    document: 'tenants/{tenantId}/customerOrders/{orderId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./orderNotifications').handleOrderReadySendSignal(event);
  },
);

exports.onBulletinConfirmationAuditMail = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/bulletinConfirmations/{confirmationId}',
    region: REGION,
  },
  async (event) => {
    ensureAdminApp();
    return require('./bulletinAuditMail').handleBulletinConfirmationAuditMail(event);
  },
);
