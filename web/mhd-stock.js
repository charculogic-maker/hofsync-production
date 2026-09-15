/**
 * MHD-sicherer Bestandsabgleich: Chargen-Mengen bleiben unangetastet;
 * Differenzen landen im Allgemeinen Bestand (unassignedStock).
 */

/**
 * Summe der aktiven MHD-Chargen-Mengen (ohne Ausverkaufte).
 * @param {Array<{ qty?: number, menge?: number, soldOut?: boolean }>} batches
 * @returns {number}
 */
export function sumActiveBatchQuantities(batches = []) {
  if (!Array.isArray(batches)) return 0;
  return batches.reduce((sum, batch) => {
    if (!batch || batch.soldOut) return sum;
    const qty = Number(batch.qty ?? batch.menge ?? 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

/**
 * Gesamtbestand = Summe MHD-Chargen + Allgemeiner Bestand.
 * @param {number} batchQtySum
 * @param {number} [unassignedStock]
 * @returns {number}
 */
export function computeTotalStock(batchQtySum = 0, unassignedStock = 0) {
  const assigned = Number(batchQtySum);
  const unassigned = Number(unassignedStock);
  const safeAssigned = Number.isFinite(assigned) ? assigned : 0;
  const safeUnassigned = Number.isFinite(unassigned) ? unassigned : 0;
  return safeAssigned + safeUnassigned;
}

/**
 * Leitet den Allgemeinen Bestand aus einem gewünschten Gesamtsoll ab,
 * ohne bestehende Chargen-Mengen zu überschreiben.
 * @param {number} desiredTotal
 * @param {number} batchQtySum
 * @returns {number|null} unassignedStock oder null bei ungültigem Soll
 */
export function resolveUnassignedFromTotalTarget(desiredTotal, batchQtySum = 0) {
  const desired = Number(desiredTotal);
  if (!Number.isFinite(desired) || desired < 0) return null;
  const assigned = Number(batchQtySum);
  const safeAssigned = Number.isFinite(assigned) ? assigned : 0;
  return desired - safeAssigned;
}

/**
 * @param {number} unassignedStock
 * @returns {number}
 */
export function normalizeUnassignedStock(unassignedStock = 0) {
  const value = Number(unassignedStock);
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}
