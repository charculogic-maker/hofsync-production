/**
 * Archiv: Experimenteller KI-Lieferschein-/OCR-Client (Gemini + Cloud Functions).
 *
 * Aus der produktiven PWA (Tab „Neu“) entfernt am 2026-10-13, weil:
 * - Memory-Probleme bei großen iPhone-Fotos
 * - ungenaue EAN-Zuordnung im Schichtbetrieb
 * - UI-Überfrachtung gegenüber dem zuverlässigen Barcode-Serien-Scan
 *
 * Backend-Callables unter functions/deliveryNote.js bleiben unberührt
 * für eine spätere Büro-/Desktop-Lösung.
 *
 * Module in diesem Ordner (nicht im PWA-Service-Worker gecacht):
 * - delivery-note.js          – Branding-Modul deliveryNoteAi Scanner
 * - delivery-parser.js        – KI-Parser + Preview-Board
 * - delivery-reconcile.js     – Soll/Ist-Abgleich Overlay
 * - delivery-reconciliation.js – Gemini-Abgleich-Board + Draft-Watcher
 * - delivery-upload.js        – Storage-Upload + parseDeliveryNote Callable
 *
 * Produktive Reste in web/:
 * - delivery-upload.js (schlank) – Foto/PDF-Validierung für Metzgerei-Anhänge
 * - catalog-ean.js               – Stammdaten-EAN-Index für Barcode-Buchung
 * - receiving.js                 – MHD-Vorschlag (vorhersagenMhd) + LIFO-Karten
 */

export {
  initDeliveryNoteScanner,
} from './delivery-note.js';

export {
  initDeliveryParser,
  vorhersagenMhd,
} from './delivery-parser.js';

export {
  reconcileDeliveryNote,
  articlesLikelyMatch,
  normalizeArticleKey,
  showReconcileOverlay,
  removeReconcileOverlay,
} from './delivery-reconcile.js';

export {
  initDeliveryReconciliation,
  bindDeliveryReconcileMain,
  reconcileDelivery,
  reconcileDeliveryNoteFromFile,
  openParsedDeliveryBoard,
  loadCatalogEanIndex,
  lookupCatalogEan,
  expandRetailQuantity,
  isExcludedInventoryItem,
  levenshtein,
} from './delivery-reconciliation.js';

export {
  analyzeDeliveryNoteFile,
  enqueueDeliveryNoteAnalysis,
  uploadDeliveryNoteToStorage,
  ensureDeliveryNoteAuth,
  validateDeliveryUploadFile,
  isAllowedDeliveryFile,
  mapDeliveryUploadError,
  DeliveryUploadError,
} from './delivery-upload.js';
