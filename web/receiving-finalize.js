/**
 * Wareneingang-Abschluss: reine Helfer für MHD-Pflicht und Schreibreihenfolge.
 * Domänen-UI und Firestore-Calls bleiben in mhd.js; dieser Baustein hält die
 * Finalize-Regeln testbar und vom Monitor-Monolithen getrennt.
 */

import { hasReceivingItemMhd } from './receiving.js';

/** Schreibreihenfolge: zuerst MHD-Bestand, danach Lieferungsbeleg. */
export const FINALIZE_WRITE_ORDER = Object.freeze(['mhd_liste', 'wareneingang_lieferungen']);

/**
 * Posten ohne gültiges MHD (Verpackungsdatum fehlt oder unlesbar).
 * @param {Array<{ product?: string, mhdDate?: string }>|null|undefined} items
 * @returns {Array<{ product?: string, mhdDate?: string }>}
 */
export function listReceivingItemsMissingMhd(items) {
  if (!Array.isArray(items) || !items.length) return [];
  return items.filter((item) => !hasReceivingItemMhd(item));
}

/**
 * @param {Array<{ product?: string, mhdDate?: string }>|null|undefined} items
 * @returns {number}
 */
export function countReceivingItemsMissingMhd(items) {
  return listReceivingItemsMissingMhd(items).length;
}

/**
 * @param {Array<{ product?: string, mhdDate?: string }>|null|undefined} items
 * @returns {boolean}
 */
export function shouldBlockDeliveryFinalizeForMissingMhd(items) {
  return countReceivingItemsMissingMhd(items) > 0;
}

/**
 * Laden-iPhone-Wortlaut: was fehlt, was tun.
 * @param {Array<{ product?: string, mhdDate?: string }>|null|undefined} items
 * @returns {{ title: string, message: string }}
 */
export function buildMissingMhdFinalizeMessage(items) {
  const missing = listReceivingItemsMissingMhd(items);
  const count = missing.length;
  if (count <= 0) {
    return { title: '', message: '' };
  }
  const sample = String(missing[0]?.product || '').trim();
  const sampleHint = sample ? ` (z. B. ${sample})` : '';
  if (count === 1) {
    return {
      title: 'MHD fehlt',
      message: `Bitte zuerst das MHD von der Verpackung eintragen${sampleHint}, dann erneut abschließen.`,
    };
  }
  return {
    title: 'MHD fehlt',
    message: `Bei ${count} Posten fehlt noch das MHD von der Verpackung${sampleHint}. Bitte eintragen, dann erneut abschließen.`,
  };
}

/**
 * Operator-Texte bei Teilfehlern nach der neuen Reihenfolge (MHD zuerst).
 * @param {'mhd'|'delivery'} phase
 * @param {{ mhdWritten?: number, itemCount?: number }} [ctx]
 * @returns {{ title: string, message: string, toast: string }}
 */
export function buildFinalizePhaseFailureCopy(phase, ctx = {}) {
  const itemCount = Number(ctx.itemCount) || 0;
  const mhdWritten = Number(ctx.mhdWritten) || 0;
  if (phase === 'mhd') {
    return {
      title: 'Nicht abgeschlossen',
      message: 'Die Lieferung wurde nicht gebucht. Bitte MHD-Posten prüfen und erneut abschließen.',
      toast: 'MHD-Posten konnten nicht gespeichert werden. Lieferung nicht abgeschlossen – bitte erneut versuchen.',
    };
  }
  const writtenHint = mhdWritten > 0 || itemCount > 0
    ? `Die ${mhdWritten || itemCount} MHD-Posten sind bereits im Bestand.`
    : 'Die MHD-Posten sind bereits im Bestand.';
  return {
    title: 'Beleg offen',
    message: `${writtenHint} Der Lieferungsbeleg folgt automatisch oder liegt lokal auf dem Laden-iPhone.`,
    toast: `${writtenHint} Lieferungsbeleg wird nachgezogen – bitte Verbindung prüfen.`,
  };
}
