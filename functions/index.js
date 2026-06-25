/**
 * Cloud Functions Einstieg – schlanke index.js für schnelles Deploy-Analyse-Timeout.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.notifyTeamEntryCreated = require('./teamPush').notifyTeamEntryCreated;
exports.parseDeliveryNote = require('./parseDeliveryNoteCallable').parseDeliveryNote;
exports.verifyTerminalPin = require('./verifyTerminalPinCallable').verifyTerminalPin;
exports.createTenantEmployee = require('./createTenantEmployee').createTenantEmployee;
exports.manageTenantEmployees = require('./manageTenantEmployees').manageTenantEmployees;
exports.fetchWeeklyMeatPrices = require('./meatPrices').fetchWeeklyMeatPrices;
exports.triggerManualMeatPriceRun = require('./meatPrices').triggerManualMeatPriceRun;
exports.onOrderReadySendSignal = require('./orderNotifications').onOrderReadySendSignal;
exports.onBulletinConfirmationAuditMail = require('./bulletinAuditMail').onBulletinConfirmationAuditMail;
