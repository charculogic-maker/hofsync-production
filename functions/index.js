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
exports.fetchWeeklyMeatPrices = require('./meatPrices').fetchWeeklyMeatPrices;
exports.triggerManualMeatPriceRun = require('./meatPrices').triggerManualMeatPriceRun;
exports.onOrderReadySendSignal = require('./orderNotifications').onOrderReadySendSignal;
