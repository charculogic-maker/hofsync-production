/**
 * Cloud Functions Einstieg – schlanke index.js für schnelles Deploy-Analyse-Timeout.
 *
 * Feature-Module werden lazy über Getter geladen, damit `require('./index.js')`
 * keine schweren Deps (Twilio, Gemini, Nodemailer, PBKDF2) zur Discover-/Load-Zeit zieht.
 * Firebase Discovery greift die Getter ab und registriert die onCall/onSchedule-Exports.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

function lazyExport(exportName, modulePath, exportKey = exportName) {
  let cached;
  Object.defineProperty(exports, exportName, {
    enumerable: true,
    configurable: true,
    get() {
      if (!cached) {
        cached = require(modulePath)[exportKey];
      }
      return cached;
    },
  });
}

lazyExport('notifyTeamEntryCreated', './teamPush');
lazyExport('parseDeliveryNote', './parseDeliveryNoteCallable');
lazyExport('parseMeatLabel', './parseMeatLabelCallable');
lazyExport('verifyTerminalPin', './verifyTerminalPinCallable');
lazyExport('createTenantEmployee', './createTenantEmployee');
lazyExport('manageTenantEmployees', './manageTenantEmployees');
lazyExport('provisionDemoTenant', './tenantAdmin');
lazyExport('fetchWeeklyMeatPrices', './meatPrices');
lazyExport('triggerManualMeatPriceRun', './meatPrices');
lazyExport('onOrderReadySendSignal', './orderNotifications');
lazyExport('onBulletinConfirmationAuditMail', './bulletinAuditMail');
