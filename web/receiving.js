/**
 * Wareneingang Schnellerfassung – LIFO-Karten, Mengen-Nummernpad, MHD-Schnelltasten,
 * smarte Auto-Kategorisierung (Keyword-Heuristik + EAN-Gedächtnis-Helfer).
 * State (currentDeliveryItems) bleibt in mhd.js; dieses Modul liefert UI-Helfer.
 */

import { formatIsoToGerman, initGermanDateInputs, parseGermanDateToIso, readGermanDateField, setGermanDateField } from './date-input.js';

const RECEIVING_QTY_NUMPAD_MAX_DIGITS = 4;
const MHD_QUICK_DAYS = [3, 7, 14];
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

/** Kanonische Wareneingangs-Kategorien (Werte wie in mhd.js RECEIVING_CATEGORIES). */
export const RECEIVING_SMART_CATEGORIES = {
  mopro: '🥛MoPro',
  kuehlware: '🥗 Kühlware',
  aufschnitt: '🥓 Aufschnitt',
  trockenware: '📦 Trockenware',
  frische: '🍎 Frische',
  tk: '🧊 TK',
  getraenke: '🍺 Getränke',
  gewuerze: '🌿 Gewürze',
};

/** HACCP-Kühlgrenze Rindfleisch / Zukauffleisch (VO EG 853/2004). */
export const HACCP_MEAT_TEMP_LIMIT_C = 7.0;
/** HACCP-Kühlgrenze Geflügelfleisch (VO EG 853/2004). */
export const HACCP_POULTRY_TEMP_LIMIT_C = 4.0;

/** Standard-Warengruppe für Metzgerei / Stautenhof-Anlieferungen. */
export const METZ_DEFAULT_CATEGORY = 'Lohnschlachtung Rind';

/**
 * Warengruppen für Fleisch- und Schlachtbetriebe (Metzgerei-Tab).
 * StevesHof: eigene Galloways + eigene Weidehühner; Bio-Schwein nur als Zukauf.
 */
export const METZ_RECEIVING_CATEGORIES = [
  {
    value: 'Lohnschlachtung Rind',
    label: '🥩 Lohnschlachtung Rind (Galloway / Eigenbestand)',
  },
  {
    value: 'Lohnschlachtung Geflügel',
    label: '🐔 Lohnschlachtung Geflügel (Hühner / Eigenbestand)',
  },
  {
    value: 'Bio-Schwein Zukauf',
    label: '🐷 Bio-Schwein Zukauf',
  },
  {
    value: 'Zukauffleisch (Fremdbezug)',
    label: 'Zukauffleisch (Fremdbezug)',
  },
  {
    value: 'Geflügel Zukauf (Fremdbezug)',
    label: 'Geflügel Zukauf (Fremdbezug)',
  },
  { value: 'Wurst Zukauf', label: 'Wurst Zukauf' },
  { value: 'Gewürze & Hilfsstoffe', label: 'Gewürze & Hilfsstoffe' },
];

export function isLohnschlachtungRindCategory(category = '') {
  return /lohnschlachtung\s*rind/i.test(String(category || ''));
}

export function isLohnschlachtungGefluegelCategory(category = '') {
  const raw = String(category || '');
  return /lohnschlachtung\s*gefl(ü|ue)gel/i.test(raw)
    || /lohnschlachtung\s*h(ü|ue)hner/i.test(raw);
}

export function isBioSchweinZukaufCategory(category = '') {
  const normalized = normalizeCategoryText(category);
  if (!normalized) return false;
  return (normalized.includes('bio') && normalized.includes('schwein'))
    || normalized === 'bio schwein zukauf';
}

/**
 * Strikte HACCP-Temperaturpflicht gilt NUR in der Metzgerei für:
 * Lohnschlachtung Rind, Lohnschlachtung Geflügel, Bio-Schwein Zukauf.
 * Laden / MoPro / Kühlware / sonstige Zukäufe: keine Pflicht.
 */
export function isMetzMeatTemperatureCategory(category = '') {
  return isLohnschlachtungRindCategory(category)
    || isLohnschlachtungGefluegelCategory(category)
    || isBioSchweinZukaufCategory(category);
}

/**
 * Ob eine Lieferung eine Pflicht-Temperatur braucht.
 * Im Laden-Modus (schnell) niemals — auch nicht bei MoPro/Kühlware.
 */
export function isStrictHaccpTemperatureRequired({
  mode = 'schnell',
  warenKategorie = '',
  warenKategorieMetzgerei = '',
} = {}) {
  if (String(mode || '').toLowerCase() !== 'metzgerei') return false;
  const metzCategory = String(warenKategorieMetzgerei || '').trim();
  if (metzCategory && isMetzMeatTemperatureCategory(metzCategory)) return true;
  // Fallback nur wenn explizit eine Metz-Kategorie in warenKategorie steht
  // (z. B. Entwurf ohne separates Feld) — nie für MoPro/Laden-Kategorien.
  return isMetzMeatTemperatureCategory(warenKategorie);
}

export function getHaccpTempLimitForCategory(category = '') {
  if (isLohnschlachtungGefluegelCategory(category)
    || /gefl(ü|ue)gel\s*zukauf/i.test(String(category || ''))) {
    return HACCP_POULTRY_TEMP_LIMIT_C;
  }
  return HACCP_MEAT_TEMP_LIMIT_C;
}

/**
 * Kategorie-spezifische HACCP-Warnung. Ohne Überschreitung → ''.
 * @param {number} temperature
 * @param {string} [category]
 */
export function formatHaccpMeatTempWarning(temperature, category = '') {
  const value = Number(temperature);
  if (!Number.isFinite(value)) return '';
  const limit = getHaccpTempLimitForCategory(category);
  if (!(value > limit)) return '';
  if (limit <= HACCP_POULTRY_TEMP_LIMIT_C) {
    return '⚠️ Grenzwert Geflügel überschritten (> 4,0 °C)! Kühlung sofort prüfen.';
  }
  return '⚠️ Grenzwert überschritten (> 7,0 °C). Kühlung und Begleitpapiere prüfen!';
}

/** Token für LOT/Chargennummer (ASCII, Großbuchstaben). */
export function sanitizeLotToken(value = '', fallback = 'OCHSE') {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 16);
  return cleaned || fallback;
}

/**
 * Fallback-Chargennummer ohne Ohrmarke:
 * `GAL-{Klassifizierung|OCHSE}-{YYYYMMDD}`
 */
export function buildGallowayFallbackLot({
  klassifizierung = '',
  schlachtDatumIso = '',
  ohrmarke = '',
} = {}) {
  if (String(ohrmarke || '').trim()) return '';
  const token = sanitizeLotToken(klassifizierung, 'OCHSE');
  const iso = String(schlachtDatumIso || '').trim().slice(0, 10);
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? iso.replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `GAL-${token}-${ymd}`;
}

/**
 * Rückverfolgungs-LOT: Ohrmarke hat Vorrang, sonst Galloway-Fallback bei Rind.
 */
export function resolveMetzTraceLot({
  category = '',
  ohrmarke = '',
  klassifizierung = '',
  schlachtDatumIso = '',
} = {}) {
  const ear = String(ohrmarke || '').trim();
  if (ear) return ear;
  if (isLohnschlachtungRindCategory(category)) {
    return buildGallowayFallbackLot({
      klassifizierung,
      schlachtDatumIso,
      ohrmarke: '',
    });
  }
  return '';
}

/** Alte Metzgerei-Werte auf aktuelle Labels/Werte mappen (Bestandsdaten). */
export function normalizeMetzReceivingCategory(category = '') {
  const raw = String(category || '').trim();
  if (!raw) return METZ_DEFAULT_CATEGORY;
  if (/^fremd/i.test(raw) || raw === 'Fremdfleisch') return 'Zukauffleisch (Fremdbezug)';
  if (/gew(ü|ue)rze\s*metzgerei/i.test(raw)) return 'Gewürze & Hilfsstoffe';
  if (/lohnschlachtung\s*schwein/i.test(raw)) return METZ_DEFAULT_CATEGORY;
  if (/bio[-\s]*schwein/i.test(raw)) return 'Bio-Schwein Zukauf';
  if (/^gefl(ü|ue)gel\s*zukauf$/i.test(raw)) return 'Geflügel Zukauf (Fremdbezug)';
  const known = METZ_RECEIVING_CATEGORIES.find((entry) => entry.value === raw);
  return known ? known.value : raw;
}

function normalizeCategoryText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeDryMilkChocolate(normalizedName) {
  return /(^|[^a-z0-9])(vollmilch|milch)([^a-z0-9].*)?(schoko|schokolade|kuvert|waffel|keks|cookie|osterei|osterhase|baumkuchen|muesli|nuss|nougat|riegel|marzipan|praline|lolly|dattel|cashew|kern)/.test(normalizedName)
    || /(schoko|schokolade|kuvert|waffel|keks|cookie|osterei|osterhase|baumkuchen|muesli|nuss|nougat|riegel|marzipan|praline|lolly|dattel|cashew|kern).*(^|[^a-z0-9])(vollmilch|milch)([^a-z0-9]|$)/.test(normalizedName)
    || /milchreis.*(rundkorn|reis|weiss|weiss)/.test(normalizedName);
}

/**
 * Keyword-Heuristik für unbekannte EANs.
 * Reihenfolge: Kühlware/Feinkost → MoPro → Fleisch/Wurst → Trockenware.
 * Fallback ist immer Trockenware — niemals pauschal MoPro.
 */
export function inferReceivingCategoryFromProductName(productName = '', fallbackCategory = RECEIVING_SMART_CATEGORIES.trockenware) {
  const normalizedName = normalizeCategoryText(productName);
  if (!normalizedName) {
    return String(fallbackCategory || RECEIVING_SMART_CATEGORIES.trockenware).trim()
      || RECEIVING_SMART_CATEGORIES.trockenware;
  }

  if (looksLikeDryMilkChocolate(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.trockenware;
  }

  // Kühlware / Feinkost (vor Fleisch, damit vegane Burger nicht als Wurst landen)
  if (/(vegan|vegetarisch|tofu|aufstrich|pasta\s*frisch|frischpasta|salat|hefe\s*frisch|frischhefe|\bdip\b)/.test(normalizedName)
    || (/\bburger\b/.test(normalizedName)
      && /(tomate|basilikum|gemuese|gemuse|linse|kicher|erbsen|spinat|pilz|bohne|falafel|beyond|planted)/.test(normalizedName))) {
    return RECEIVING_SMART_CATEGORIES.kuehlware;
  }

  // MoPro (Milchprodukte) – trockene Milch-Schokolade oben ausgeschlossen
  if (/(joghurt|joghurtdrink|quark|topfen|skyr|kefir|lassi|ayran|sahne|schmand|creme\s*fraiche|cremefraiche|butter|feta|frischkaese|frischkase|weichkaese|weichkase|kaese|kase|gouda|emmentaler|mozzarella|ricotta|mascarpone|brie|camembert)/.test(normalizedName)
    || /(^|[^a-z0-9])(h-?milch|frische milch|fettarme milch|alpenmilch|heumilch|weidemilch|vollmilch|milch|kakao milch|schokoladen milch|milch alternative)([^a-z0-9]|$)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.mopro;
  }

  // Fleisch & Wurst (Theke / Kühlware → Aufschnitt)
  if (/(bratwurst|leberwurst|schinken|mett|salami|fleisch|galloway|rinder|hack|steak|schnitzel|gulasch|wurst|aufschnitt|\bburger\b)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.aufschnitt;
  }

  // Trockenware / ungekühlte Lagerware
  if (/(bonbon|zucker|trockenhefe|hefe|mehl|flocken|reis|nudeln|tee|kaffee|gewuerz|gewurz|saft|sirup|\boel\b|\bol\b|essig|\bglas\b|\bdose\b|konserve|trockenware)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.trockenware;
  }

  const fallback = String(fallbackCategory || '').trim();
  if (fallback && !/mopro/i.test(fallback)) return fallback;
  return RECEIVING_SMART_CATEGORIES.trockenware;
}

/**
 * Kategorie für einen Scan auflösen:
 * 1) gelernte EAN-Stammdaten (zwingend)
 * 2) Keyword-Heuristik auf den Artikelnamen
 * 3) Sticky-Vorfilter (nur wenn gesetzt und kein Keyword-Treffer)
 * 4) Trockenware — niemals pauschal MoPro
 *
 * @returns {{ category: string, source: 'ean'|'keyword'|'sticky'|'default' }}
 */
export function resolveReceivingScanCategory({
  productName = '',
  eanCategory = '',
  stickyCategory = '',
} = {}) {
  const learned = String(eanCategory || '').trim();
  if (learned) {
    return { category: learned, source: 'ean' };
  }

  const keywordHit = inferReceivingCategoryKeywordHit(productName);
  if (keywordHit) {
    return { category: keywordHit, source: 'keyword' };
  }

  const sticky = String(stickyCategory || '').trim();
  if (sticky) {
    return { category: sticky, source: 'sticky' };
  }

  return {
    category: RECEIVING_SMART_CATEGORIES.trockenware,
    source: 'default',
  };
}

/** Liefert die Keyword-Kategorie oder '' wenn kein Regel-Treffer. */
export function inferReceivingCategoryKeywordHit(productName = '') {
  const normalizedName = normalizeCategoryText(productName);
  if (!normalizedName) return '';
  if (looksLikeDryMilkChocolate(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.trockenware;
  }
  if (/(vegan|vegetarisch|tofu|aufstrich|pasta\s*frisch|frischpasta|salat|hefe\s*frisch|frischhefe|\bdip\b)/.test(normalizedName)
    || (/\bburger\b/.test(normalizedName)
      && /(tomate|basilikum|gemuese|gemuse|linse|kicher|erbsen|spinat|pilz|bohne|falafel|beyond|planted)/.test(normalizedName))) {
    return RECEIVING_SMART_CATEGORIES.kuehlware;
  }
  if (/(joghurt|joghurtdrink|quark|topfen|skyr|kefir|lassi|ayran|sahne|schmand|creme\s*fraiche|cremefraiche|butter|feta|frischkaese|frischkase|weichkaese|weichkase|kaese|kase|gouda|emmentaler|mozzarella|ricotta|mascarpone|brie|camembert)/.test(normalizedName)
    || /(^|[^a-z0-9])(h-?milch|frische milch|fettarme milch|alpenmilch|heumilch|weidemilch|vollmilch|milch|kakao milch|schokoladen milch|milch alternative)([^a-z0-9]|$)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.mopro;
  }
  if (/(bratwurst|leberwurst|schinken|mett|salami|fleisch|galloway|rinder|hack|steak|schnitzel|gulasch|wurst|aufschnitt|\bburger\b)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.aufschnitt;
  }
  if (/(bonbon|zucker|trockenhefe|hefe|mehl|flocken|reis|nudeln|tee|kaffee|gewuerz|gewurz|saft|sirup|\boel\b|\bol\b|essig|\bglas\b|\bdose\b|konserve|trockenware)/.test(normalizedName)) {
    return RECEIVING_SMART_CATEGORIES.trockenware;
  }
  return '';
}

let receivingQtyNumpadState = null;
let receivingQtyNumpadKeyHandler = null;
let receivingMhdEditorCleanup = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
 * MHD-Vorschlag: Historie (Liefer-Spanne) oder Standard-Haltbarkeit nach Artikelname.
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

/** ISO-Datum um N Tage verschieben. */
export function shiftIsoDateByDays(iso, days) {
  const baseIso = parseGermanDateToIso(iso) || String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseIso)) return '';
  const base = new Date(`${baseIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + (Number(days) || 0));
  return startOfDayIso(base);
}

export function formatReceivingMhdLabel(mhdDate) {
  if (!mhdDate) return '–';
  const german = formatIsoToGerman(mhdDate);
  if (german) return german;
  const parsed = new Date(`${mhdDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? String(mhdDate) : parsed.toLocaleDateString('de-DE');
}

/**
 * Neueste Posten zuerst (LIFO). Bevorzugt addedAt, sonst Array-Reihenfolge beibehalten
 * wenn bereits per unshift gepflegt.
 */
export function sortDeliveryItemsLifo(items) {
  if (!Array.isArray(items) || items.length < 2) return Array.isArray(items) ? items.slice() : [];
  const withStamp = items.filter((item) => Number.isFinite(Number(item?.addedAt)));
  if (withStamp.length !== items.length) return items.slice();
  return items.slice().sort((a, b) => Number(b.addedAt) - Number(a.addedAt));
}

/** MHD-Vorschlag aus Erfahrungswerten / Standard-Haltbarkeit. */
export function suggestReceivingMhd(productName, category = '', history = []) {
  try {
    return vorhersagenMhd(productName, category, history, startOfDayIso());
  } catch (err) {
    console.warn('[CharcuLogic Wareneingang] MHD-Vorschlag fehlgeschlagen:', err);
    return {
      mhdIso: shiftIsoDateByDays(startOfDayIso(), 7),
      tage: 7,
      quelle: 'standard',
      hinweis: 'MHD-Vorschlag (Standard-Haltbarkeit)',
    };
  }
}

export function buildReceivingItemCardHtml(item) {
  const brandLabel = String(item.brand || item.herstellerZusatz || item.marke || '').trim();
  const brandMeta = brandLabel ? `${escapeHtml(brandLabel.toUpperCase())} · ` : '';
  const qtyValue = item.qtyValue ?? item.qtyKg ?? 1;
  const qtyUnit = item.qtyUnit || 'Stk';
  const mhdLabel = formatReceivingMhdLabel(item.mhdDate);
  const itemId = escapeHtml(item.id);
  const quickButtons = MHD_QUICK_DAYS.map((days) => (
    `<button type="button" class="we-item-mhd-quick-btn" data-item-mhd-add="${days}" data-item-id="${itemId}" aria-label="MHD plus ${days} Tage">+${days} Tage</button>`
  )).join('');

  return `
    <article class="we-item-card" data-item-id="${itemId}">
      <div class="we-item-card-top">
        <div class="we-item-row-main">
          <div class="we-item-row-name">${escapeHtml(item.product)}</div>
          <div class="we-item-row-meta">${brandMeta}${item.barcode ? `EAN ${escapeHtml(item.barcode)}` : 'ohne EAN'}</div>
        </div>
        <button type="button" class="we-item-row-remove" data-item-remove="${itemId}" aria-label="Posten entfernen">✕</button>
      </div>
      <div class="we-item-card-actions">
        <button type="button" class="we-item-qty-btn" data-item-qty-edit="${itemId}" aria-label="Menge korrigieren">
          <span class="we-item-qty-label">Menge</span>
          <span class="we-item-qty-value">${escapeHtml(String(qtyValue))}</span>
          <span class="we-item-qty-unit">${escapeHtml(qtyUnit)}</span>
        </button>
        <div class="we-item-mhd-block">
          <button type="button" class="we-item-mhd-date" data-item-mhd-edit="${itemId}" aria-label="MHD direkt wählen">
            <span class="we-item-mhd-date-label">MHD</span>
            <strong class="we-item-mhd-date-value">${escapeHtml(mhdLabel)}</strong>
          </button>
          <div class="we-item-mhd-quick" role="group" aria-label="MHD Schnelltasten">
            ${quickButtons}
          </div>
        </div>
      </div>
    </article>
  `;
}

export function closeReceivingQtyNumpad() {
  if (receivingQtyNumpadKeyHandler) {
    document.removeEventListener('keydown', receivingQtyNumpadKeyHandler);
    receivingQtyNumpadKeyHandler = null;
  }
  document.getElementById('receiving-qty-numpad-overlay')?.remove();
  receivingQtyNumpadState = null;
  document.documentElement.classList.remove('mhd-qty-numpad-open', 'receiving-qty-numpad-open');
}

function syncReceivingQtyNumpadDisplay() {
  if (!receivingQtyNumpadState) return;
  const draftEl = document.getElementById('receiving-qty-numpad-draft');
  const currentEl = document.getElementById('receiving-qty-numpad-current');
  if (currentEl) currentEl.textContent = String(receivingQtyNumpadState.currentQty);
  if (draftEl) {
    const draft = receivingQtyNumpadState.draft;
    draftEl.textContent = draft === '' ? '—' : draft;
    draftEl.classList.toggle('is-empty', draft === '');
  }
}

function applyReceivingQtyNumpadKey(key, playClick) {
  if (!receivingQtyNumpadState) return;
  const state = receivingQtyNumpadState;
  playClick?.(1200, 0.02, 0.08);

  if (key === 'clear') {
    state.draft = '';
    syncReceivingQtyNumpadDisplay();
    return;
  }
  if (key === 'backspace') {
    state.draft = state.draft.slice(0, -1);
    syncReceivingQtyNumpadDisplay();
    return;
  }
  if (key === 'plus1' || key === 'plus5') {
    const add = key === 'plus5' ? 5 : 1;
    const base = state.draft === ''
      ? state.currentQty
      : Number.parseInt(state.draft, 10);
    const next = Math.max(1, (Number.isFinite(base) ? base : 0) + add);
    state.draft = String(Math.min(9999, next));
    syncReceivingQtyNumpadDisplay();
    return;
  }
  if (/^\d$/.test(key)) {
    if (state.draft.length >= RECEIVING_QTY_NUMPAD_MAX_DIGITS) return;
    if (state.draft === '0') state.draft = key;
    else state.draft += key;
    syncReceivingQtyNumpadDisplay();
  }
}

function commitReceivingQtyFromNumpad() {
  if (!receivingQtyNumpadState) return;
  const { itemId, currentQty, draft, onConfirm, playClick } = receivingQtyNumpadState;
  if (draft === '') {
    closeReceivingQtyNumpad();
    return;
  }
  const newQty = Number.parseInt(draft, 10);
  if (!Number.isFinite(newQty) || newQty <= 0) {
    window.showToast?.('Bitte eine gültige Stückzahl eingeben.', 'warning');
    return;
  }
  closeReceivingQtyNumpad();
  if (newQty === currentQty) return;
  playClick?.(900, 0.06, 0.14);
  onConfirm?.(itemId, newQty);
}

/**
 * Touch-Nummernpad für Mengenkorrektur auf der Erfassungskarte.
 * @param {{ id: string, product?: string, qtyValue?: number, qtyUnit?: string }} item
 * @param {{ onConfirm: (itemId: string, qty: number) => void, playClick?: Function }} options
 */
export function openReceivingQtyNumpad(item, options = {}) {
  if (!item?.id) return;
  const currentQty = Number(item.qtyValue ?? item.qtyKg ?? 1);
  const productName = String(item.product || 'Artikel').trim() || 'Artikel';
  const unit = item.qtyUnit || 'Stk';

  closeReceivingQtyNumpad();
  receivingQtyNumpadState = {
    itemId: item.id,
    currentQty: Number.isFinite(currentQty) && currentQty > 0 ? currentQty : 1,
    draft: '',
    productName,
    onConfirm: typeof options.onConfirm === 'function' ? options.onConfirm : null,
    playClick: typeof options.playClick === 'function' ? options.playClick : null,
  };

  const overlay = document.createElement('div');
  overlay.id = 'receiving-qty-numpad-overlay';
  overlay.className = 'mhd-qty-numpad-overlay receiving-qty-numpad-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `
    <button type="button" class="mhd-qty-numpad-backdrop" data-receiving-numpad-cmd="close" aria-label="Schließen"></button>
    <div class="mhd-qty-numpad-sheet bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="receiving-qty-numpad-title">
      <div class="sheet-handle" aria-hidden="true"></div>
      <header class="mhd-qty-numpad-header">
        <div class="mhd-qty-numpad-title" id="receiving-qty-numpad-title">${escapeHtml(productName)}</div>
        <div class="mhd-qty-numpad-meta">
          <span>Bisher <strong id="receiving-qty-numpad-current">${escapeHtml(String(receivingQtyNumpadState.currentQty))}</strong> ${escapeHtml(unit)}</span>
          <span class="mhd-qty-numpad-arrow" aria-hidden="true">→</span>
          <span>Neu <strong id="receiving-qty-numpad-draft" class="mhd-qty-numpad-draft is-empty">—</strong></span>
        </div>
      </header>
      <div class="mhd-qty-numpad-quick" role="group" aria-label="Schnelltasten">
        <button type="button" class="mhd-qty-numpad-quick-btn" data-receiving-numpad-key="plus1">+1</button>
        <button type="button" class="mhd-qty-numpad-quick-btn" data-receiving-numpad-key="plus5">+5</button>
      </div>
      <div class="mhd-qty-numpad-grid" role="group" aria-label="Zahlenblock">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => {
          if (key === 'clear') {
            return '<button type="button" class="mhd-qty-numpad-key mhd-qty-numpad-key--action" data-receiving-numpad-key="clear" aria-label="Löschen">C</button>';
          }
          if (key === 'backspace') {
            return '<button type="button" class="mhd-qty-numpad-key mhd-qty-numpad-key--action" data-receiving-numpad-key="backspace" aria-label="Zurück">⌫</button>';
          }
          return `<button type="button" class="mhd-qty-numpad-key" data-receiving-numpad-key="${key}">${key}</button>`;
        }).join('')}
      </div>
      <div class="mhd-qty-numpad-actions">
        <button type="button" class="btn btn-secondary mhd-qty-numpad-cancel" data-receiving-numpad-cmd="close">Abbrechen</button>
        <button type="button" class="btn btn-primary mhd-qty-numpad-confirm" data-receiving-numpad-cmd="confirm">Übernehmen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.documentElement.classList.add('mhd-qty-numpad-open', 'receiving-qty-numpad-open');

  overlay.addEventListener('touchstart', (event) => {
    if (event.target.closest('button')) return;
    event.preventDefault();
  }, { passive: false });

  overlay.addEventListener('click', (event) => {
    const cmdBtn = event.target.closest('[data-receiving-numpad-cmd]');
    if (cmdBtn) {
      const cmd = cmdBtn.dataset.receivingNumpadCmd;
      if (cmd === 'close') closeReceivingQtyNumpad();
      if (cmd === 'confirm') commitReceivingQtyFromNumpad();
      return;
    }
    const keyBtn = event.target.closest('[data-receiving-numpad-key]');
    if (!keyBtn) return;
    applyReceivingQtyNumpadKey(keyBtn.dataset.receivingNumpadKey, receivingQtyNumpadState?.playClick);
  });

  receivingQtyNumpadKeyHandler = (event) => {
    if (!receivingQtyNumpadState) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeReceivingQtyNumpad();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commitReceivingQtyFromNumpad();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      applyReceivingQtyNumpadKey('backspace', receivingQtyNumpadState.playClick);
      return;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      applyReceivingQtyNumpadKey(event.key, receivingQtyNumpadState.playClick);
    }
  };
  document.addEventListener('keydown', receivingQtyNumpadKeyHandler);
}

/**
 * Einfacher MHD-Dialog für Direktauswahl auf der Erfassungskarte.
 */
export function openReceivingItemMhdEditor(item, options = {}) {
  if (!item?.id) return;
  receivingMhdEditorCleanup?.();
  receivingMhdEditorCleanup = null;

  const existing = document.getElementById('receiving-mhd-editor-overlay');
  existing?.remove();

  const currentIso = parseGermanDateToIso(item.mhdDate) || item.mhdDate || '';
  const overlay = document.createElement('div');
  overlay.id = 'receiving-mhd-editor-overlay';
  overlay.className = 'learn-mode-overlay receiving-mhd-editor-overlay';
  overlay.innerHTML = `
    <div class="learn-mode-card" role="dialog" aria-modal="true" aria-labelledby="receiving-mhd-editor-title">
      <div class="learn-mode-title" id="receiving-mhd-editor-title">MHD anpassen</div>
      <p class="learn-mode-desc">${escapeHtml(item.product || 'Artikel')}</p>
      <label class="form-label" for="receiving-mhd-editor-input">Neues MHD</label>
      <input type="text" id="receiving-mhd-editor-input" class="input-text-touch input-date-de" placeholder="TT.MM.JJJJ" inputmode="numeric" autocomplete="off" maxlength="10">
      <div class="we-item-mhd-quick receiving-mhd-editor-quick" role="group" aria-label="Schnelltasten ab heute">
        ${MHD_QUICK_DAYS.map((days) => (
          `<button type="button" class="we-item-mhd-quick-btn" data-receiving-mhd-today-add="${days}">+${days} Tage</button>`
        )).join('')}
      </div>
      <div class="receiving-mhd-editor-actions">
        <button type="button" class="btn btn-secondary" data-receiving-mhd-cmd="close">Abbrechen</button>
        <button type="button" class="btn btn-primary" data-receiving-mhd-cmd="save">Übernehmen</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('receiving-mhd-editor-input');
  if (currentIso) setGermanDateField(input, currentIso);
  initGermanDateInputs(overlay);

  const close = () => {
    overlay.remove();
    receivingMhdEditorCleanup = null;
  };
  receivingMhdEditorCleanup = close;

  const save = () => {
    const iso = readGermanDateField(input);
    if (!iso) {
      window.showToast?.('Bitte ein gültiges MHD als TT.MM.JJJJ eintragen.', 'warning');
      input?.focus();
      return;
    }
    close();
    options.onConfirm?.(item.id, iso);
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
      return;
    }
    const cmd = event.target.closest('[data-receiving-mhd-cmd]')?.dataset.receivingMhdCmd;
    if (cmd === 'close') {
      close();
      return;
    }
    if (cmd === 'save') {
      save();
      return;
    }
    const addDays = Number(event.target.closest('[data-receiving-mhd-today-add]')?.dataset.receivingMhdTodayAdd);
    if (Number.isFinite(addDays) && addDays > 0) {
      const iso = shiftIsoDateByDays(startOfDayIso(), addDays);
      if (iso) setGermanDateField(input, iso);
    }
  });
}

export function closeReceivingMhdEditor() {
  receivingMhdEditorCleanup?.();
  document.getElementById('receiving-mhd-editor-overlay')?.remove();
  receivingMhdEditorCleanup = null;
}

export { MHD_QUICK_DAYS };
