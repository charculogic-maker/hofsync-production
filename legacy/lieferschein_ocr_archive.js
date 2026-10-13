/**
 * Archiv: KI-Lieferschein / OCR (Gemini) – aus der produktiven PWA entfernt (2026-10-13).
 *
 * Hintergrund: Der experimentelle Foto-/OCR-Lieferscheinabgleich erzeugte im Schichtbetrieb
 * an der Frischetheke Frust (Memory bei großen iPhone-Fotos, ungenaue EAN-Zuordnung,
 * UI-Überfrachtung). Der operative Wareneingang läuft über Barcode-Schnellscanner + LIFO.
 *
 * Dieses Modul re-exportiert die archivierten Client-Schnittstellen für eine spätere
 * Büro-Desktop-Lösung. Backend-Callables in functions/ bleiben unberührt:
 *   - parseDeliveryNote
 *   - reprocessDeliveryNoteDraft
 *   - saveReconciledItems
 *
 * Archivierte Dateien (gleiche Ordnerebene):
 *   - delivery-note.js          → initDeliveryNoteScanner
 *   - delivery-parser.js        → initDeliveryParser, vorhersagenMhd (Kopie)
 *   - delivery-reconcile.js     → reconcileDeliveryNote, showReconcileOverlay
 *   - delivery-reconciliation.js → initDeliveryReconciliation, reconcileDelivery, …
 *   - delivery-upload.js        → analyzeDeliveryNoteFile, enqueueDeliveryNoteAnalysis, …
 *
 * Imports in den Archiv-Dateien zeigen auf ../web/ für geteilte Auth/Tenant-Helfer.
 * Nicht in web/sw.js oder app.js einbinden – nur Archiv / Desktop-Prototyp.
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
  reconcileDeliveryNoteFromFile,
  reconcileDelivery,
  expandRetailQuantity,
  isExcludedInventoryItem,
  loadCatalogEanIndex,
  lookupCatalogEan,
  openParsedDeliveryBoard,
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
  buildDeliveryNoteStoragePath,
  DeliveryUploadError,
  showDeliveryParseProgress,
  hideDeliveryParseProgress,
} from './delivery-upload.js';
