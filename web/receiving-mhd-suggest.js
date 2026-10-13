/**
 * MHD-Vorschlag für Wareneingang (Erfahrungswerte / Standard-Haltbarkeit).
 * Aus delivery-parser.js extrahiert – OCR-UI archiviert unter legacy/.
 */

import { parseGermanDateToIso } from './date-input.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

const MHD_FALLBACK_KEYWORDS = [
  { test: /gefl(ü|ue)gel|h(ä|ae)hnchen|pute/i, tage: 4 },
  { test: /frischfleisch|\brind\b|\bschwein\b|hack|galloway/i, tage: 5 },
  { test: /wurst|aufschnitt|grillwurst|wiener/i, tage: 10 },
  { test: /k(ä|ae)se|mopro|jogh?urt|milch/i, tage: 14 },
  { test: /trockenware|konserven|vorrat|br(ö|oe)tchen/i, tage: 90 },
];
const MHD_FALLBACK_DEFAULT_TAGE = 7;
const MHD_STANDARD_HINT = 'MHD-Vorschlag (Standard-Haltbarkeit)';

function startOfDayIso(date = new Date()) {
  const probe = new Date(date);
  if (Number.isNaN(probe.getTime())) return '';
  probe.setHours(0, 0, 0, 0);
  const year = probe.getFullYear();
  const month = String(probe.getMonth() + 1).padStart(2, '0');
  const day = String(probe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoDateOnly(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (ISO_DATE_RE.test(raw)) return raw.slice(0, 10);
  const fromGerman = parseGermanDateToIso(raw);
  if (fromGerman) return fromGerman;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : startOfDayIso(parsed);
}

function diffInDays(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addDaysIso(baseIso, days) {
  const base = new Date(`${baseIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(days) || 0));
  return startOfDayIso(base);
}

function standardTageAusArtikelname(artikel) {
  const text = String(artikel || '').trim();
  for (const regel of MHD_FALLBACK_KEYWORDS) {
    if (regel.test.test(text)) return regel.tage;
  }
  return MHD_FALLBACK_DEFAULT_TAGE;
}

/**
 * Leitet das vorgeschlagene MHD für heute ab: mit Historie aus dem Durchschnitt
 * der bisherigen Liefer-Spannen (Wareneingang bis MHD), sonst per Schlüsselwort
 * im Artikelnamen über Standard-Haltbarkeit.
 */
export function vorhersagenMhd(artikel, kategorie, history, todayIso = startOfDayIso()) {
  const gesuchterName = String(artikel || '').trim().toLowerCase();
  const eintraege = Array.isArray(history) ? history : [];
  const spannen = [];

  if (gesuchterName) {
    for (const eintrag of eintraege) {
      const name = String(eintrag?.produkt || eintrag?.name || '').trim().toLowerCase();
      if (name !== gesuchterName) continue;

      const lieferIso = toIsoDateOnly(eintrag?.wareneingangAt || eintrag?.erfassungsDatum || eintrag?.createdAt);
      const damaligesMhd = toIsoDateOnly(eintrag?.mhd || eintrag?.mhdDate);
      if (!lieferIso || !damaligesMhd) continue;

      const spanne = diffInDays(lieferIso, damaligesMhd);
      if (spanne == null || spanne < 0) continue;
      spannen.push(spanne);
    }
  }

  if (spannen.length > 0) {
    const durchschnitt = Math.round(spannen.reduce((sum, tage) => sum + tage, 0) / spannen.length);
    return {
      mhdIso: addDaysIso(todayIso, durchschnitt),
      tage: durchschnitt,
      quelle: 'erfahrung',
      hinweis: `Erfahrungswert der letzten Lieferungen (${durchschnitt} Tage haltbar)`,
    };
  }

  const tage = standardTageAusArtikelname(artikel);
  return {
    mhdIso: addDaysIso(todayIso, tage),
    tage,
    quelle: 'standard',
    hinweis: MHD_STANDARD_HINT,
  };
}
