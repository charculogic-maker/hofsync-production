/**
 * MHD-Karten-Meta: Erstaufnahme („Erfasst“) vs. Mengenkorrektur („Korrigiert“).
 * Reine Logik ohne DOM.
 */

export function parseMhdRecordTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Erstaufnahme – niemals updatedAt/qtyCorrectedAt (sonst wirkt eine Korrektur wie Erfassung).
 */
export function resolveMhdRecordCreatedAt(prod = {}) {
  return parseMhdRecordTimestamp(prod.createdAt)
    || parseMhdRecordTimestamp(prod.wareneingangAt)
    || parseMhdRecordTimestamp(prod.erfassungsDatum)
    || null;
}

export function resolveMhdQtyCorrectedAt(prod = {}) {
  return parseMhdRecordTimestamp(prod.qtyCorrectedAt)
    || parseMhdRecordTimestamp(prod.mengeKorrigiertAt)
    || null;
}

export function formatMhdMetaDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

/**
 * Meta-Bausteine für die Kartenzeile (ohne EAN/Person).
 * @returns {string[]} z. B. ["Erfasst: 20.10", "Korrigiert: 27.10"]
 */
export function buildMhdCaptureCorrectionMetaParts(prod = {}) {
  const parts = [];
  const createdAt = resolveMhdRecordCreatedAt(prod);
  const correctedAt = resolveMhdQtyCorrectedAt(prod);
  if (createdAt) {
    parts.push(`Erfasst: ${formatMhdMetaDay(createdAt)}`);
  }
  if (correctedAt) {
    const sameInstant = createdAt
      && Math.abs(correctedAt.getTime() - createdAt.getTime()) < 60_000;
    if (!sameInstant) {
      parts.push(`Korrigiert: ${formatMhdMetaDay(correctedAt)}`);
    }
  }
  return parts;
}

/**
 * Audit-Felder für eine Mengenkorrektur (ohne createdAt).
 */
export function buildMhdQtyCorrectionFields({
  previousQuantity,
  actor = '',
  at = new Date(),
} = {}) {
  const when = at instanceof Date ? at : new Date(at);
  const iso = Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
  const who = String(actor || '').trim() || 'unbekannt';
  const fields = {
    qtyCorrectedAt: iso,
    qtyCorrectedBy: who,
    lastModifiedBy: who,
  };
  if (Number.isFinite(Number(previousQuantity))) {
    fields.previousQuantity = Number(previousQuantity);
  }
  return fields;
}
