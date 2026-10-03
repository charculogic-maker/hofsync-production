/**
 * Galloway Zerlege-Etiketten · Avery Zweckform 3475 (70×36 mm, 3×8 = 24 Nutzen)
 * StevesHof / HofSync – anatomische Baugruppen + eigene Teilstücke.
 */
const STORAGE_KEY = 'hofsync.beefLabels.v1';
const CUSTOM_CUTS_KEY = 'hofsync_custom_beef_cuts';
const LABEL_PREFIX_KEY = 'zerlegung_label_prefix';
const DEFAULT_LABEL_PREFIX = 'Bio-Galloway';
const LEGACY_BREED_PREFIX = /^(?:bio[-\s]+galloway)\s+/i;

/** @typedef {'SCHULTER'|'RUECKEN'|'LAPPEN'|'KEULE'|'HACK'|'KNOCHEN'|'INNEREIEN'|'TIERNAHRUNG'|'CUSTOM'} CutCategory */

/**
 * @typedef {{
 *   id: string,
 *   kategorie: CutCategory,
 *   alsoIn?: CutCategory[],
 *   bezeichnung: string,
 *   teilstueckDetail: string,
 *   reifung: string,
 *   lagerung: string,
 *   custom?: boolean,
 * }} CutDefinition
 */

/** @type {CutDefinition[]} */
export const BEEF_CUT_CATALOG = [
  // —— Schulter (Bug) ——
  {
    id: 'schulter-dickes-bugstueck',
    kategorie: 'SCHULTER',
    bezeichnung: 'Dickes Bugstück',
    teilstueckDetail: 'Schulterbraten · Kerniger Rinderbraten & Sauerbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-flat-iron',
    kategorie: 'SCHULTER',
    alsoIn: ['LAPPEN'],
    bezeichnung: 'Flat Iron Steak',
    teilstueckDetail: 'Schildstück entsehnt · Kurzbraten / Steak',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-falsches-filet',
    kategorie: 'SCHULTER',
    bezeichnung: 'Falsches Filet',
    teilstueckDetail: 'Schulterfilet · Zartes Kurzbratstück',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-metzgerstueck',
    kategorie: 'SCHULTER',
    bezeichnung: 'Metzgerstück',
    teilstueckDetail: 'Teres Major · Kleines Schulterfilet',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-schaufelbraten',
    kategorie: 'SCHULTER',
    bezeichnung: 'Schaufelbraten / Schildstück',
    teilstueckDetail: 'Schmorbraten / Sieden · Schaufelbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Rücken & Ribs ——
  {
    id: 'ruecken-filet-spitze',
    kategorie: 'RUECKEN',
    bezeichnung: 'Filetspitze',
    teilstueckDetail: 'Filet Spitze · Tournedos / Medaillons',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-filet-mittel',
    kategorie: 'RUECKEN',
    bezeichnung: 'Filetmittel',
    teilstueckDetail: 'Filet Mittelstück · Chateaubriand',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-filet-kopf',
    kategorie: 'RUECKEN',
    bezeichnung: 'Filetkopf',
    teilstueckDetail: 'Filet Kopf · Ragout / Fondue / Medaillons',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-roastbeef',
    kategorie: 'RUECKEN',
    bezeichnung: 'Roastbeef',
    teilstueckDetail: 'Rumpsteak ohne Kette',
    reifung: '14T Dry-Aged → Wet-Aging (max 6W)',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-entrecote',
    kategorie: 'RUECKEN',
    bezeichnung: 'Entrecôte',
    teilstueckDetail: 'Ribeye / Entrecôte ohne Knochen',
    reifung: '14T Dry-Aged → Wet-Aging',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-cote-de-boeuf',
    kategorie: 'RUECKEN',
    bezeichnung: 'Côte de Boeuf',
    teilstueckDetail: 'Hohe Rippe mit Knochen · Prime Rib',
    reifung: 'Dry-Aged Knochenreife mind. 28T',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-t-bone-porterhouse',
    kategorie: 'RUECKEN',
    bezeichnung: 'T-Bone / Porterhouse',
    teilstueckDetail: 'Roastbeef & Filet am T-Knochen',
    reifung: 'Dry-Aged Knochenreife mind. 28T',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Lappen & Spezial ——
  {
    id: 'lappen-flank',
    kategorie: 'LAPPEN',
    bezeichnung: 'Flank Steak',
    teilstueckDetail: 'Flank · Dünnung / Bavette de Flanchet',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-skirt',
    kategorie: 'LAPPEN',
    bezeichnung: 'Skirt Steak',
    teilstueckDetail: 'Kronfleisch · Grill & Pfanne',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-bavette',
    kategorie: 'LAPPEN',
    bezeichnung: 'Bavette',
    teilstueckDetail: 'Flap Meat · Saftiges Grillstück',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-spider',
    kategorie: 'LAPPEN',
    bezeichnung: 'Spider Steak',
    teilstueckDetail: 'Fledermaus / Kavalierhäutchen',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-brisket',
    kategorie: 'LAPPEN',
    bezeichnung: 'Brisket',
    teilstueckDetail: 'Rinderbrust · Smoker / Schmoren',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-nierenzapfen',
    kategorie: 'LAPPEN',
    bezeichnung: 'Nierenzapfen',
    teilstueckDetail: 'Onglet / Hanging Tender · Grill',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Keule (Knöpfel) ——
  {
    id: 'keule-kugel-flach',
    kategorie: 'KEULE',
    bezeichnung: 'Flache Kugel',
    teilstueckDetail: 'Kugel flach · Schmorbraten & Fondue',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-kugel-rund',
    kategorie: 'KEULE',
    bezeichnung: 'Runde Kugel',
    teilstueckDetail: 'Kugel rund · Runder Schmorbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-spiessfleisch',
    kategorie: 'KEULE',
    bezeichnung: 'Spiessfleisch',
    teilstueckDetail: 'Magere Spieß-Abschnitte · Spieße / Fondue',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-oberschale',
    kategorie: 'KEULE',
    bezeichnung: 'Oberschale',
    teilstueckDetail: 'Oberschale ohne Deckel · Rouladen & Minutensteaks',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-oberschalendeckel',
    kategorie: 'KEULE',
    bezeichnung: 'Oberschalendeckel',
    teilstueckDetail: 'Oberschalendeckel · Schmorbraten & Rouladen',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-unterschale',
    kategorie: 'KEULE',
    bezeichnung: 'Unterschale',
    teilstueckDetail: 'Schwanzstück · Klassischer Schmorbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-semerrolle',
    kategorie: 'KEULE',
    bezeichnung: 'Semerrolle',
    teilstueckDetail: 'Tafelrolle · Sauerbraten / Carpaccio',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-hueftsteak',
    kategorie: 'KEULE',
    bezeichnung: 'Hüftsteak',
    teilstueckDetail: 'Hüfte / Blume · Feinfaseriges Steak',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-tafelspitz',
    kategorie: 'KEULE',
    bezeichnung: 'Tafelspitz',
    teilstueckDetail: 'Picanha mit Fettdeckel · Grill & Siedefleisch',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-buergermeister',
    kategorie: 'KEULE',
    bezeichnung: 'Bürgermeisterstück',
    teilstueckDetail: 'Tri-Tip · Kurzbrat- & Schmorstück',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-wade',
    kategorie: 'KEULE',
    bezeichnung: 'Wade',
    teilstueckDetail: 'Wadenfleisch / Hesse · Schmorbraten & Gulasch',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Hack & Gulasch ——
  {
    id: 'abschnitt-r1-gulasch',
    kategorie: 'HACK',
    bezeichnung: 'Gulasch',
    teilstueckDetail: 'R I Magerfleisch grob entsehnt · Saftgulasch',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'abschnitt-r2-hack',
    kategorie: 'HACK',
    bezeichnung: 'R II Mager',
    teilstueckDetail: 'Abschnitte · Rinderhack & Burger',
    reifung: 'Frischverarbeitung / Kutter / Kühlung',
    lagerung: 'Lag: ≤ 2 °C / -18 °C',
  },
  {
    id: 'abschnitt-r3-wurst',
    kategorie: 'HACK',
    bezeichnung: 'R III Wurstfleisch',
    teilstueckDetail: 'Sehnenreiches Verarbeitungsfleisch · Wurstküche',
    reifung: 'Frischverarbeitung / Kutter / Kühlung',
    lagerung: 'Lag: ≤ 2 °C / -18 °C',
  },

  // —— Knochen & Suppe ——
  {
    id: 'beinscheibe-hinterhaxe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Hinterhaxe',
    teilstueckDetail: 'Hintere Beinscheibe · Ossobuco',
    reifung: 'Frisch gekühlt / Schmorstück',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'beinscheibe-vorderhaxe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Vorderhaxe',
    teilstueckDetail: 'Vordere Beinscheibe · Suppenfleisch',
    reifung: 'Frisch gekühlt / Suppenschnitt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-brustkern',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Rinderbrust',
    teilstueckDetail: 'Brustkern mit Knochen · Siedefleisch',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-querrippe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Querrippe',
    teilstueckDetail: 'Spannrippe / Beinfleisch mit Knochen',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-markknochen',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Markknochen',
    teilstueckDetail: 'Röhrenknochen in Scheiben · Suppenmark',
    reifung: 'Frisch geschnitten',
    lagerung: 'Lag: 0–2 °C / -18 °C',
  },
  {
    id: 'knochen-suppenknochen',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Suppenknochen',
    teilstueckDetail: 'Sand- & Fleischknochen für Rinderfond',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C / -18 °C',
  },
  {
    id: 'knochen-ochsenschwanz',
    kategorie: 'KNOCHEN',
    bezeichnung: 'Ochsenschwanz',
    teilstueckDetail: 'Rinderschweif in Glieder · Gourmet-Sud',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Innereien (Verkauf) ——
  {
    id: 'innerei-zunge',
    kategorie: 'INNEREIEN',
    bezeichnung: 'Rinderzunge',
    teilstueckDetail: 'Geputzt · Zum Pökeln oder Sieden',
    reifung: 'Frisch verpackt · Vor Verzehr durcherhitzen',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-nierenzapfen',
    kategorie: 'INNEREIEN',
    bezeichnung: 'Nierenzapfen',
    teilstueckDetail: 'Onglet · Frischware Verkauf',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-leber',
    kategorie: 'INNEREIEN',
    bezeichnung: 'Rinderleber',
    teilstueckDetail: 'Frische Bio-Leber · Kurzbraten',
    reifung: 'Tagesfrisch · Sofortiger Verzehr',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-herz',
    kategorie: 'INNEREIEN',
    bezeichnung: 'Rinderherz',
    teilstueckDetail: 'Feinfaserig & mager · Schmorbraten & Ragout',
    reifung: 'Frisch pariert',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },

  // —— Tiernahrung / BARF ——
  {
    id: 'barf-innereien-mix',
    kategorie: 'TIERNAHRUNG',
    bezeichnung: 'BARF Innereien-Mix',
    teilstueckDetail: 'Ergänzungsfuttermittel für Tiere – Nicht für den menschl. Verzehr · Lunge/Milz/Kutteln',
    reifung: 'Frisch / TK verpackt',
    lagerung: 'Lag: ≤ 3 °C / TK -18 °C',
  },
  {
    id: 'barf-pansen-pur',
    kategorie: 'TIERNAHRUNG',
    bezeichnung: 'Pansen Pur',
    teilstueckDetail: 'Ergänzungsfuttermittel für Tiere – Nicht für den menschl. Verzehr · Pansen',
    reifung: 'Frisch / TK verpackt',
    lagerung: 'Lag: ≤ 3 °C / TK -18 °C',
  },
];

const TAB_ORDER = /** @type {CutCategory[]} */ ([
  'SCHULTER',
  'RUECKEN',
  'LAPPEN',
  'KEULE',
  'HACK',
  'KNOCHEN',
  'INNEREIEN',
  'TIERNAHRUNG',
  'CUSTOM',
]);

const TAB_LABELS = {
  SCHULTER: 'Schulter (Bug)',
  RUECKEN: 'Rücken & Ribs',
  LAPPEN: 'Lappen & Spezial',
  KEULE: 'Keule (Knöpfel)',
  HACK: 'Hack & Gulasch',
  KNOCHEN: 'Knochen & Suppe',
  INNEREIEN: 'Innereien (Verkauf)',
  TIERNAHRUNG: 'Tiernahrung / BARF',
  CUSTOM: 'Custom / Vorräte',
};

const DEFAULT_QUEUE = [
  { id: 'keule-tafelspitz', quantity: 2 },
  { id: 'keule-unterschale', quantity: 2 },
  { id: 'keule-semerrolle', quantity: 2 },
  { id: 'abschnitt-r1-gulasch', quantity: 6 },
  { id: 'abschnitt-r2-hack', quantity: 8 },
  { id: 'innerei-leber', quantity: 2 },
  { id: 'innerei-zunge', quantity: 1 },
];

/** @type {CutDefinition[]} */
let customCuts = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function todayDe() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function loadCustomCuts() {
  try {
    const raw = localStorage.getItem(CUSTOM_CUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: String(entry?.id || ''),
        kategorie: /** @type {CutCategory} */ ('CUSTOM'),
        bezeichnung: cleanCutName(String(entry?.bezeichnung || '').trim()),
        teilstueckDetail: String(entry?.teilstueckDetail || 'Eigenes Teilstück · Custom'),
        reifung: String(entry?.reifung || 'Nach Betriebsvorgabe'),
        lagerung: String(entry?.lagerung || 'Lag: 0–2 °C'),
        custom: true,
      }))
      .filter((cut) => cut.id && cut.bezeichnung);
  } catch {
    return [];
  }
}

function saveCustomCuts() {
  try {
    localStorage.setItem(
      CUSTOM_CUTS_KEY,
      JSON.stringify(
        customCuts.map((cut) => ({
          id: cut.id,
          bezeichnung: cut.bezeichnung,
          teilstueckDetail: cut.teilstueckDetail,
          reifung: cut.reifung,
          lagerung: cut.lagerung,
        })),
      ),
    );
  } catch {
    /* private mode */
  }
}

function allCuts() {
  return [...BEEF_CUT_CATALOG, ...customCuts];
}

function findCut(id) {
  return allCuts().find((c) => c.id === id) || null;
}

/** @typedef {'HV'|'VV'|'GK'} CarcassSegment */

const VV_BRUST_IDS = new Set([
  'beinscheibe-vorderhaxe',
  'knochen-brustkern',
  'knochen-querrippe',
  'knochen-markknochen',
  'knochen-suppenknochen',
]);

const SEGMENT_TABS = {
  HV: ['KEULE', 'RUECKEN', 'LAPPEN', 'INNEREIEN'],
  VV: ['SCHULTER', 'NACKEN', 'BRUST', 'LAPPEN'],
  GK: TAB_ORDER.slice(),
};

const SEGMENT_TAB_LABELS = {
  HV: {
    KEULE: 'Keule & Hüfte',
    RUECKEN: 'Rücken & Ribs',
    LAPPEN: 'Lappen & Flank',
    INNEREIEN: 'Innereien / BARF',
  },
  VV: {
    SCHULTER: 'Schulter (Bug)',
    NACKEN: 'Nacken & Kammer',
    BRUST: 'Brust & Suppe',
    LAPPEN: 'Lappen & Flank',
  },
};

function detectSegmentFromCharge(charge) {
  const text = String(charge || '').trim().toUpperCase();
  if (text.startsWith('HV-') || text.startsWith('HV_')) return 'HV';
  if (text.startsWith('VV-') || text.startsWith('VV_')) return 'VV';
  return '';
}

function tabsForSegment(segment = state.segment) {
  return SEGMENT_TABS[segment] || SEGMENT_TABS.GK;
}

function tabLabel(cat, segment = state.segment) {
  if (segment !== 'GK' && SEGMENT_TAB_LABELS[segment]?.[cat]) {
    return SEGMENT_TAB_LABELS[segment][cat];
  }
  return TAB_LABELS[cat] || cat;
}

function ensureActiveTab() {
  const tabs = tabsForSegment();
  if (!tabs.includes(state.activeTab)) {
    state.activeTab = tabs[0];
  }
}

function applyDetectedSegment(charge = state.chargenNummer) {
  const detected = detectSegmentFromCharge(charge);
  if (!detected || detected === state.segment) return false;
  state.segment = detected;
  ensureActiveTab();
  return true;
}

function cutsForTab(tab) {
  if (tab === 'CUSTOM') return customCuts.slice();
  if (tab === 'NACKEN') {
    return allCuts().filter((cut) => /nacken|kamm|hals/i.test(`${cut.bezeichnung} ${cut.teilstueckDetail}`));
  }
  if (tab === 'BRUST') {
    return BEEF_CUT_CATALOG.filter((cut) => VV_BRUST_IDS.has(cut.id));
  }
  if (tab === 'INNEREIEN' && state.segment === 'HV') {
    return BEEF_CUT_CATALOG.filter(
      (cut) => cut.kategorie === 'INNEREIEN' || cut.kategorie === 'TIERNAHRUNG',
    );
  }
  return BEEF_CUT_CATALOG.filter(
    (c) => c.kategorie === tab || (Array.isArray(c.alsoIn) && c.alsoIn.includes(tab)),
  );
}

function slugifyCutName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function titleCaseCutName(raw) {
  const small = new Set(['de', 'von', 'und', 'am', 'im']);
  const acronym = new Set(['barf', 'ii', 'iii']);
  return String(raw || '')
    .split(/(\s+|\/)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token) || token === '/') return token;
      return token.split('-').map((part) => {
        const lower = part.toLocaleLowerCase('de-DE');
        if (!part) return part;
        if (small.has(lower)) return lower;
        if (acronym.has(lower)) return part.toLocaleUpperCase('de-DE');
        if (lower === 'r') return 'R';
        return part.charAt(0).toLocaleUpperCase('de-DE') + part.slice(1).toLocaleLowerCase('de-DE');
      }).join('-');
    })
    .join('');
}

function isAllCapsName(value) {
  const letters = String(value || '').replace(/[^A-Za-zÄÖÜäöü]/g, '');
  return letters.length > 0
    && letters === letters.toLocaleUpperCase('de-DE')
    && letters !== letters.toLocaleLowerCase('de-DE');
}

function stripBreedPrefix(name, prefix = '') {
  let base = String(name || '').trim().replace(LEGACY_BREED_PREFIX, '').trim();
  const current = String(prefix || '').trim();
  if (current && base.toLocaleLowerCase('de-DE').startsWith(`${current.toLocaleLowerCase('de-DE')} `)) {
    base = base.slice(current.length).trim();
  }
  return base;
}

function cleanCutName(name, prefix = '') {
  const base = stripBreedPrefix(name, prefix);
  return isAllCapsName(base) ? titleCaseCutName(base) : base;
}

function readStoredLabelPrefix() {
  try {
    const dedicated = localStorage.getItem(LABEL_PREFIX_KEY);
    return typeof dedicated === 'string' ? dedicated.trim() : '';
  } catch {
    return '';
  }
}

function writeStoredLabelPrefix(value) {
  try {
    localStorage.setItem(LABEL_PREFIX_KEY, String(value ?? ''));
  } catch {
    /* private mode */
  }
}

function activeLabelPrefix() {
  return String(state.etikettenPraefix || '').trim() || DEFAULT_LABEL_PREFIX;
}

function formatPrintName(baseName, prefix = activeLabelPrefix()) {
  const current = String(prefix || '').trim() || DEFAULT_LABEL_PREFIX;
  const base = stripBreedPrefix(baseName, current);
  return base ? `${current} ${base}` : current;
}

function addCustomCut(rawName) {
  const name = cleanCutName(rawName, state.etikettenPraefix);
  if (!name) {
    window.showToast?.('Bitte Teilstück-Name eingeben.', 'error');
    return false;
  }
  const exists = allCuts().some(
    (c) => cleanCutName(c.bezeichnung, state.etikettenPraefix).toLocaleLowerCase('de-DE') === name.toLocaleLowerCase('de-DE'),
  );
  if (exists) {
    window.showToast?.('Teilstück existiert bereits.', 'error');
    return false;
  }
  const id = `custom-${slugifyCutName(name)}-${Date.now().toString(36)}`;
  customCuts.push({
    id,
    kategorie: 'CUSTOM',
    bezeichnung: name,
    teilstueckDetail: 'Eigenes Teilstück · Custom / Vorräte',
    reifung: 'Nach Betriebsvorgabe',
    lagerung: 'Lag: 0–2 °C',
    custom: true,
  });
  saveCustomCuts();
  if (state.segment === 'GK') state.activeTab = 'CUSTOM';
  updateQuantity(id, 1);
  window.showToast?.(`${formatPrintName(name)} gespeichert`, 'success');
  return true;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

const STANDARD_KG = {
  'schulter-dickes-bugstueck': 3.2,
  'schulter-flat-iron': 0.6,
  'schulter-falsches-filet': 0.45,
  'schulter-metzgerstueck': 0.3,
  'schulter-schaufelbraten': 2.2,
  'ruecken-filet-spitze': 0.45,
  'ruecken-filet-mittel': 1.1,
  'ruecken-filet-kopf': 0.55,
  'ruecken-roastbeef': 3.5,
  'ruecken-entrecote': 2.4,
  'ruecken-cote-de-boeuf': 1.1,
  'ruecken-t-bone-porterhouse': 0.9,
  'lappen-flank': 0.9,
  'lappen-skirt': 0.6,
  'lappen-bavette': 0.7,
  'lappen-spider': 0.35,
  'lappen-brisket': 4.5,
  'lappen-nierenzapfen': 0.7,
  'keule-kugel-flach': 2.2,
  'keule-kugel-rund': 2.4,
  'keule-spiessfleisch': 0.8,
  'keule-oberschale': 3.2,
  'keule-oberschalendeckel': 1.1,
  'keule-unterschale': 2.6,
  'keule-semerrolle': 1.3,
  'keule-hueftsteak': 1.6,
  'keule-tafelspitz': 1.4,
  'keule-buergermeister': 1.1,
  'keule-wade': 1.8,
  'abschnitt-r1-gulasch': 0.5,
  'abschnitt-r2-hack': 0.5,
  'abschnitt-r3-wurst': 0.5,
  'beinscheibe-hinterhaxe': 1.6,
  'beinscheibe-vorderhaxe': 1.4,
  'knochen-brustkern': 2.8,
  'knochen-querrippe': 2.2,
  'knochen-markknochen': 0.4,
  'knochen-suppenknochen': 0.6,
  'knochen-ochsenschwanz': 1.3,
  'innerei-zunge': 1.5,
  'innerei-nierenzapfen': 0.7,
  'innerei-leber': 2.2,
  'innerei-herz': 1.6,
  'barf-innereien-mix': 1,
  'barf-pansen-pur': 2.5,
};

const EDEL_IDS = new Set([
  'schulter-flat-iron', 'schulter-falsches-filet', 'schulter-metzgerstueck',
  'ruecken-filet-spitze', 'ruecken-filet-mittel', 'ruecken-filet-kopf',
  'ruecken-roastbeef', 'ruecken-entrecote', 'ruecken-cote-de-boeuf', 'ruecken-t-bone-porterhouse',
  'lappen-flank', 'lappen-skirt', 'lappen-bavette', 'lappen-spider', 'lappen-nierenzapfen',
]);

const BRATEN_IDS = new Set([
  'schulter-dickes-bugstueck', 'schulter-schaufelbraten', 'lappen-brisket',
  'keule-kugel-flach', 'keule-kugel-rund', 'keule-spiessfleisch',
  'keule-oberschale', 'keule-oberschalendeckel', 'keule-unterschale', 'keule-semerrolle',
  'keule-hueftsteak', 'keule-tafelspitz', 'keule-buergermeister', 'keule-wade',
]);

function roundKg(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000) / 1000;
}

function parseKg(raw) {
  const normalized = String(raw ?? '').trim().replace(',', '.');
  if (!normalized) return 0;
  return roundKg(Number.parseFloat(normalized));
}

function standardKgForCut(cutId) {
  return STANDARD_KG[cutId] ?? 0.5;
}

function processingGradeOf(cutId, bezeichnung = '') {
  const id = String(cutId || '').toLowerCase();
  const name = String(bezeichnung || '').toUpperCase();
  if (id === 'abschnitt-r3-wurst' || /\bR\s*III\b/.test(name) || name.includes('WURSTFLEISCH')) return 'R III';
  if (id === 'abschnitt-r2-hack' || /\bR\s*II\b/.test(name) || name.includes('HACK')) return 'R II';
  if (id === 'abschnitt-r1-gulasch' || /\bR\s*I\b/.test(name) || name.includes('GULASCH')) return 'R I';
  return null;
}

function yieldBucketOf(cut) {
  if (!cut) return 'fett';
  if (EDEL_IDS.has(cut.id)) return 'edel';
  if (BRATEN_IDS.has(cut.id)) return 'braten';
  if (processingGradeOf(cut.id, cut.bezeichnung)) return 'verarbeitung';
  if (cut.kategorie === 'KNOCHEN') return 'knochen';
  if (cut.kategorie === 'INNEREIEN' || cut.kategorie === 'TIERNAHRUNG') return 'innereien';
  if (cut.kategorie === 'HACK') return 'verarbeitung';
  if (cut.kategorie === 'RUECKEN' || cut.kategorie === 'LAPPEN') return 'edel';
  if (cut.kategorie === 'KEULE' || cut.kategorie === 'SCHULTER') return 'braten';
  const name = String(cut.bezeichnung || '').toUpperCase();
  if (/FETT|SEHNE|PARÜR|PARUR/.test(name)) return 'fett';
  if (/KNOCHEN|HAXE/.test(name)) return 'knochen';
  if (/LEBER|ZUNGE|HERZ|BARF|PANSEN/.test(name)) return 'innereien';
  if (/FILET|STEAK|ENTREC|ROASTBEEF|FLANK|FLAT IRON|SPIDER/.test(name)) return 'edel';
  return 'fett';
}

function slaughterBasisKg() {
  if (state.schlachtgewichtKalt > 0) return state.schlachtgewichtKalt;
  if (state.schlachtgewichtWarm > 0) return state.schlachtgewichtWarm;
  const halves = roundKg(state.haelfteLinks) + roundKg(state.haelfteRechts);
  return halves > 0 ? roundKg(halves) : 0;
}

function yieldPct(part, basis) {
  if (!(basis > 0)) return 0;
  return (part / basis) * 100;
}

function formatKgDe(value) {
  return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPctDe(value) {
  return Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function computeYield() {
  let edelKg = 0;
  let bratenKg = 0;
  let knochenKg = 0;
  let innereienKg = 0;
  let fettFromCuts = 0;
  let r1 = 0;
  let r2 = 0;
  let r3 = 0;
  state.queue.forEach((item) => {
    const cut = findCut(item.id);
    const kg = roundKg(item.weightKg);
    if (!cut || !(kg > 0)) return;
    const bucket = yieldBucketOf(cut);
    if (bucket === 'edel') edelKg += kg;
    else if (bucket === 'braten') bratenKg += kg;
    else if (bucket === 'knochen') knochenKg += kg;
    else if (bucket === 'innereien') innereienKg += kg;
    else if (bucket === 'fett') fettFromCuts += kg;
    else {
      const grade = processingGradeOf(cut.id, cut.bezeichnung) || 'R III';
      if (grade === 'R I') r1 += kg;
      else if (grade === 'R II') r2 += kg;
      else r3 += kg;
    }
  });
  const r1Kg = state.r1Override == null ? roundKg(r1) : roundKg(state.r1Override);
  const r2Kg = state.r2Override == null ? roundKg(r2) : roundKg(state.r2Override);
  const r3Kg = state.r3Override == null ? roundKg(r3) : roundKg(state.r3Override);
  const verarbeitungKg = roundKg(r1Kg + r2Kg + r3Kg);
  const fettKg = roundKg(state.fettKg + fettFromCuts);
  const basisKg = slaughterBasisKg();
  const gesamtKg = roundKg(edelKg + bratenKg + verarbeitungKg + knochenKg + innereienKg + fettKg);
  const verlustKg = basisKg > 0 ? Math.round((basisKg - gesamtKg) * 1000) / 1000 : 0;
  return {
    edelKg: roundKg(edelKg),
    bratenKg: roundKg(bratenKg),
    verarbeitungKg,
    knochenKg: roundKg(knochenKg),
    innereienKg: roundKg(innereienKg),
    fettKg,
    r1Kg,
    r2Kg,
    r3Kg,
    basisKg,
    gesamtKg,
    verlustKg,
    edelPct: yieldPct(edelKg, basisKg),
    bratenPct: yieldPct(bratenKg, basisKg),
    verarbeitungPct: yieldPct(verarbeitungKg, basisKg),
    knochenAbfallPct: yieldPct(knochenKg + fettKg, basisKg),
    innereienPct: yieldPct(innereienKg, basisKg),
    verlustPct: yieldPct(Math.max(0, verlustKg), basisKg),
  };
}

function normalizeQueueItem(item) {
  const id = String(item?.id || '');
  const quantity = Math.max(0, Number(item?.quantity) || 0);
  const weightManual = item?.weightManual === true;
  const stored = Number(item?.weightKg);
  const weightKg = weightManual && Number.isFinite(stored)
    ? roundKg(stored)
    : roundKg(quantity * standardKgForCut(id));
  return { id, quantity, weightKg, weightManual };
}

const state = {
  chargenNummer: 'GAL-VV-2809',
  ohrmarke: 'DE 05 412 89012',
  schlachtDatum: '28.09.2026',
  zerlegeDatum: todayDe(),
  herkunft: 'Geb./Gem./Geschl./Zerl.: DE',
  betriebsNummer: 'Stautenhof · StevesHof',
  etikettenPraefix: DEFAULT_LABEL_PREFIX,
  schlachtgewichtKalt: 285.5,
  schlachtgewichtWarm: 0,
  haelfteLinks: 0,
  haelfteRechts: 0,
  fettKg: 0,
  r1Override: /** @type {number|null} */ (null),
  r2Override: /** @type {number|null} */ (null),
  r3Override: /** @type {number|null} */ (null),
  skipCount: 0,
  segment: /** @type {CarcassSegment} */ ('GK'),
  activeTab: /** @type {CutCategory} */ ('KEULE'),
  /** @type {{ id: string, quantity: number, weightKg: number, weightManual: boolean }[]} */
  queue: DEFAULT_QUEUE.map((q) => normalizeQueueItem(q)),
};

function applyStoredLabelPrefix() {
  const stored = readStoredLabelPrefix();
  state.etikettenPraefix = stored || DEFAULT_LABEL_PREFIX;
  if (!stored) writeStoredLabelPrefix(state.etikettenPraefix);
}

function hydrateState() {
  customCuts = loadCustomCuts();
  const saved = loadState();
  applyStoredLabelPrefix();
  if (!saved || typeof saved !== 'object') return;
  if (typeof saved.chargenNummer === 'string') state.chargenNummer = saved.chargenNummer;
  if (typeof saved.ohrmarke === 'string') state.ohrmarke = saved.ohrmarke;
  if (typeof saved.schlachtDatum === 'string') state.schlachtDatum = saved.schlachtDatum;
  if (typeof saved.zerlegeDatum === 'string') state.zerlegeDatum = saved.zerlegeDatum;
  if (typeof saved.herkunft === 'string') state.herkunft = saved.herkunft;
  if (typeof saved.betriebsNummer === 'string') state.betriebsNummer = saved.betriebsNummer;
  if (Number.isFinite(Number(saved.schlachtgewichtKalt))) state.schlachtgewichtKalt = roundKg(saved.schlachtgewichtKalt);
  if (Number.isFinite(Number(saved.schlachtgewichtWarm))) state.schlachtgewichtWarm = roundKg(saved.schlachtgewichtWarm);
  if (Number.isFinite(Number(saved.haelfteLinks))) state.haelfteLinks = roundKg(saved.haelfteLinks);
  if (Number.isFinite(Number(saved.haelfteRechts))) state.haelfteRechts = roundKg(saved.haelfteRechts);
  if (Number.isFinite(Number(saved.fettKg))) state.fettKg = roundKg(saved.fettKg);
  state.r1Override = saved.r1Override == null ? null : roundKg(saved.r1Override);
  state.r2Override = saved.r2Override == null ? null : roundKg(saved.r2Override);
  state.r3Override = saved.r3Override == null ? null : roundKg(saved.r3Override);
  if (Number.isFinite(Number(saved.skipCount))) {
    state.skipCount = Math.max(0, Math.min(23, Number(saved.skipCount)));
  }
  if (saved.segment === 'HV' || saved.segment === 'VV' || saved.segment === 'GK') {
    state.segment = saved.segment;
  }
  if (TAB_ORDER.includes(saved.activeTab) || saved.activeTab === 'NACKEN' || saved.activeTab === 'BRUST') {
    state.activeTab = saved.activeTab;
  }
  applyDetectedSegment(state.chargenNummer);
  ensureActiveTab();
  if (Array.isArray(saved.queue)) {
    state.queue = saved.queue
      .map((item) => normalizeQueueItem(item))
      .filter((item) => item.id && item.quantity > 0 && findCut(item.id));
  }
}

function persist() {
  writeStoredLabelPrefix(activeLabelPrefix());
  saveState({
    chargenNummer: state.chargenNummer,
    ohrmarke: state.ohrmarke,
    schlachtDatum: state.schlachtDatum,
    zerlegeDatum: state.zerlegeDatum,
    herkunft: state.herkunft,
    betriebsNummer: state.betriebsNummer,
    etikettenPraefix: activeLabelPrefix(),
    schlachtgewichtKalt: state.schlachtgewichtKalt,
    schlachtgewichtWarm: state.schlachtgewichtWarm,
    haelfteLinks: state.haelfteLinks,
    haelfteRechts: state.haelfteRechts,
    fettKg: state.fettKg,
    r1Override: state.r1Override,
    r2Override: state.r2Override,
    r3Override: state.r3Override,
    skipCount: state.skipCount,
    segment: state.segment,
    activeTab: state.activeTab,
    queue: state.queue,
  });
}

function totalLabels() {
  return state.queue.reduce((sum, item) => sum + item.quantity, 0);
}

function sheetsNeeded() {
  const n = totalLabels();
  return Math.ceil((n + state.skipCount) / 24) || 1;
}

function qtyOf(cutId) {
  return state.queue.find((q) => q.id === cutId)?.quantity || 0;
}

function updateQuantity(cutId, delta) {
  if (!findCut(cutId)) return;
  const existing = state.queue.find((q) => q.id === cutId);
  if (!existing) {
    if (delta <= 0) return;
    state.queue.push(normalizeQueueItem({ id: cutId, quantity: delta, weightManual: false }));
  } else {
    existing.quantity += delta;
    if (existing.quantity <= 0) {
      state.queue = state.queue.filter((q) => q.id !== cutId);
    } else if (!existing.weightManual) {
      existing.weightKg = roundKg(existing.quantity * standardKgForCut(cutId));
    }
  }
  persist();
  renderModalBody();
}

function flattenedLabels() {
  /** @type {{ cut: CutDefinition, itemIdx: number, totalOfCut: number }[]} */
  const out = [];
  state.queue.forEach((qItem) => {
    const cut = findCut(qItem.id);
    if (!cut) return;
    for (let i = 1; i <= qItem.quantity; i += 1) {
      out.push({ cut, itemIdx: i, totalOfCut: qItem.quantity });
    }
  });
  return out;
}

function buildPrintPagesHtml() {
  const labels = flattenedLabels();
  let cursor = 0;
  let pageNum = 1;
  const pages = [];

  while (cursor < labels.length || (pageNum === 1 && labels.length === 0)) {
    const skip = pageNum === 1 ? state.skipCount : 0;
    const slots = [];
    for (let slotIdx = 0; slotIdx < 24; slotIdx += 1) {
      if (slotIdx < skip) {
        slots.push('<div class="avery-label-empty"></div>');
      } else if (cursor < labels.length) {
        const item = labels[cursor];
        cursor += 1;
        slots.push(`
          <div class="avery-label-card">
            <div class="avery-label-head">
              <span>STEVESHOF</span>
              <span>Ch: ${escapeHtml(state.chargenNummer)}</span>
            </div>
            <div class="avery-label-title">${escapeHtml(formatPrintName(item.cut.bezeichnung))}</div>
            <div class="avery-label-detail">${escapeHtml(item.cut.teilstueckDetail)}</div>
            <div class="avery-label-meta">
              <div>
                <div class="avery-strong">${escapeHtml(state.herkunft)}</div>
                <div>Zerl: ${escapeHtml(state.zerlegeDatum)}</div>
              </div>
              <div class="avery-right">
                <div>${escapeHtml(state.betriebsNummer)}</div>
                <div class="avery-strong">${escapeHtml(item.cut.lagerung)}</div>
              </div>
            </div>
            <div class="avery-label-foot">
              <div class="avery-strong avery-truncate">${escapeHtml(item.cut.reifung)}</div>
              <div class="avery-right">
                <span class="avery-muted">(${item.itemIdx}/${item.totalOfCut})</span>
                <span class="avery-weight">____ kg</span>
              </div>
            </div>
          </div>
        `);
      } else {
        slots.push('<div class="avery-label-empty"></div>');
      }
    }
    pages.push(`<div class="avery-page-sheet"><div class="avery-grid-3x8">${slots.join('')}</div></div>`);
    pageNum += 1;
  }
  return pages.join('');
}

function ensurePrintRoot() {
  let root = document.getElementById('beef-labels-print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'beef-labels-print-root';
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }
  return root;
}

const AVERY_PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .avery-page-sheet { width: 210mm; height: 297mm; box-sizing: border-box; padding-top: 4.5mm; padding-bottom: 4.5mm; page-break-after: always; break-after: page; }
  .avery-grid-3x8 { display: grid; grid-template-columns: repeat(3, 70mm); grid-template-rows: repeat(8, 36mm); width: 210mm; height: 288mm; position: relative; left: 1.5mm; }
  .avery-label-card { box-sizing: border-box; width: 70mm; height: 36mm; padding: 1.8mm; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border: 0.15mm solid rgba(0,0,0,0.15); background: #fff; color: #000; }
  .avery-grid-3x8 > :nth-child(3n + 1) { padding-left: 7.2mm; }
  .avery-label-empty { visibility: hidden; }
  .avery-label-head { display: flex; justify-content: space-between; border-bottom: 0.2mm solid #000; padding-bottom: 0.4mm; font-size: 6.5pt; font-weight: 700; }
  .avery-label-title { font-size: 8.5pt; font-weight: 900; line-height: 1.1; }
  .avery-label-detail { font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .avery-label-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; border-top: 0.15mm solid #ddd; border-bottom: 0.15mm solid #ddd; padding: 0.4mm 0; font-size: 5.8pt; }
  .avery-label-foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 6pt; }
  .avery-strong { font-weight: 700; }
  .avery-right { text-align: right; }
  .avery-muted { color: #666; font-size: 5.5pt; margin-right: 1mm; }
  .avery-weight { display: inline-block; min-width: 10mm; border-bottom: 0.2mm solid #888; text-align: center; font-weight: 700; }
`;

function printInPlace() {
  const root = ensurePrintRoot();
  root.innerHTML = buildPrintPagesHtml();
  document.body.classList.add('printing-beef-labels');
  const cleanup = () => {
    document.body.classList.remove('printing-beef-labels');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  requestAnimationFrame(() => {
    try {
      window.print();
    } catch (err) {
      cleanup();
      console.warn('[Galloway] Drucken fehlgeschlagen:', err);
      window.showToast?.('Drucken konnte nicht gestartet werden.', 'error');
    }
  });
}

function handlePrint() {
  if (totalLabels() === 0) {
    window.showToast?.('Druckkorb ist leer.', 'error');
    return;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Avery 3475</title><style>${AVERY_PRINT_CSS}</style></head><body>${buildPrintPagesHtml()}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const pdfUrl = URL.createObjectURL(blob);
  const printWindow = window.open(pdfUrl, '_blank');
  if (!printWindow) {
    URL.revokeObjectURL(pdfUrl);
    printInPlace();
    return;
  }
  const trigger = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      console.warn('[Galloway] Druckfenster fehlgeschlagen:', err);
      printInPlace();
    }
  };
  printWindow.addEventListener('load', () => {
    trigger();
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }, { once: true });
}

function renderCutList(host) {
  const cuts = cutsForTab(state.activeTab);
  if (cuts.length === 0) {
    host.innerHTML =
      state.activeTab === 'CUSTOM'
        ? '<div class="beef-queue-empty">Noch keine eigenen Teilstücke – oben hinzufügen.</div>'
        : '<div class="beef-queue-empty">Keine Teilstücke in dieser Baugruppe.</div>';
    return;
  }
  host.innerHTML = cuts
    .map((cut) => {
      const qty = qtyOf(cut.id);
      return `
        <div class="beef-cut-row" data-cut-id="${escapeHtml(cut.id)}">
          <div class="beef-cut-info">
            <div class="beef-cut-name">${escapeHtml(cleanCutName(cut.bezeichnung, state.etikettenPraefix))}</div>
            <div class="beef-cut-detail">${escapeHtml(cut.teilstueckDetail)}</div>
            <div class="beef-cut-meta">${escapeHtml(cut.reifung)} · ${escapeHtml(cut.lagerung)}</div>
          </div>
          <div class="beef-qty">
            <button type="button" class="beef-qty-btn" data-delta="-1" ${qty === 0 ? 'disabled' : ''}>−</button>
            <span class="beef-qty-val">${qty}</span>
            <button type="button" class="beef-qty-btn beef-qty-btn--plus" data-delta="1">+</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderQueue(host) {
  if (state.queue.length === 0) {
    host.innerHTML = '<div class="beef-queue-empty">Korb leer – Teilstücke wählen.</div>';
    return;
  }
  host.innerHTML = state.queue
    .map((item) => {
      const cut = findCut(item.id);
      if (!cut) return '';
      const kgShown = item.weightKg ? String(item.weightKg).replace('.', ',') : '';
      const printName = formatPrintName(cut.bezeichnung);
      return `
        <div class="beef-queue-row" data-cut-id="${escapeHtml(item.id)}">
          <div class="beef-cut-info">
            <div class="beef-cut-name">${escapeHtml(printName)}</div>
            <div class="beef-cut-detail">${escapeHtml(cut.teilstueckDetail)}</div>
          </div>
          <div class="beef-line-controls">
            <div class="beef-qty">
              <button type="button" class="beef-qty-btn" data-delta="-1">−</button>
              <span class="beef-qty-val">${item.quantity}</span>
              <button type="button" class="beef-qty-btn beef-qty-btn--plus" data-delta="1">+</button>
            </div>
            <div class="beef-kg">
              <button type="button" class="beef-kg-btn" data-kg-delta="-0.1" aria-label="Gewicht verringern">−</button>
              <input type="text" class="beef-kg-input" inputmode="decimal" data-kg-input="1" value="${escapeHtml(kgShown)}" placeholder="kg" aria-label="Gewicht ${escapeHtml(printName)}">
              <button type="button" class="beef-kg-btn" data-kg-delta="0.1" aria-label="Gewicht erhöhen">+</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function setLineWeight(cutId, kg) {
  const item = state.queue.find((entry) => entry.id === cutId);
  if (!item) return;
  item.weightKg = roundKg(kg);
  item.weightManual = true;
  persist();
  renderYield();
}

function kgFieldValue(value) {
  return value ? String(value).replace('.', ',') : '';
}

function setInputIfIdle(el, value) {
  if (!el || document.activeElement === el) return;
  if (el.value !== value) el.value = value;
}

function renderYield() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;
  const totals = computeYield();
  const segments = [
    { key: 'edel', label: 'Edelteile', pct: totals.edelPct },
    { key: 'braten', label: 'Braten', pct: totals.bratenPct },
    { key: 'verarbeitung', label: 'Verarbeitung', pct: totals.verarbeitungPct },
    { key: 'knochen', label: 'Knochen', pct: totals.knochenAbfallPct },
    { key: 'verlust', label: 'Verlust', pct: totals.verlustPct },
  ];
  const displayed = segments.reduce((sum, seg) => sum + Math.max(0, seg.pct), 0);
  const bar = modal.querySelector('#beef-yield-bar');
  if (bar) {
    bar.innerHTML = segments.map((seg) => {
      const width = displayed > 0 ? (Math.max(0, seg.pct) / displayed) * 100 : 20;
      return `<span class="beef-yield-seg beef-yield-seg--${seg.key}" style="width:${width}%"></span>`;
    }).join('');
    bar.setAttribute('aria-label', segments.map((seg) => `${seg.label} ${formatPctDe(seg.pct)} Prozent`).join(', '));
  }
  const legend = modal.querySelector('#beef-yield-legend');
  if (legend) {
    legend.innerHTML = segments.map((seg) => `
      <div><div>${seg.label}</div><div class="beef-yield-pct">${formatPctDe(seg.pct)}%</div></div>
    `).join('');
  }
  const text = (id, value) => {
    const el = modal.querySelector(id);
    if (el) el.textContent = value;
  };
  text('#beef-yield-basis', `${formatKgDe(totals.basisKg)} kg`);
  text('#beef-yield-edel', `${formatKgDe(totals.edelKg)} kg · ${formatPctDe(totals.edelPct)} %`);
  text('#beef-yield-braten', `${formatKgDe(totals.bratenKg)} kg · ${formatPctDe(totals.bratenPct)} %`);
  text('#beef-yield-verarbeitung', `${formatKgDe(totals.verarbeitungKg)} kg · ${formatPctDe(totals.verarbeitungPct)} %`);
  text('#beef-yield-knochen', `${formatKgDe(totals.knochenKg)} kg`);
  text('#beef-yield-innereien', `${formatKgDe(totals.innereienKg)} kg · ${formatPctDe(totals.innereienPct)} %`);
  text('#beef-yield-gesamt', `${formatKgDe(totals.gesamtKg)} kg`);
  text('#beef-yield-verlust', `${formatKgDe(totals.verlustKg)} kg · ${formatPctDe(totals.verlustPct)} %`);
  text('#beef-yield-abfall', `${formatPctDe(totals.knochenAbfallPct)} %`);
  setInputIfIdle(modal.querySelector('#beef-yield-r1'), kgFieldValue(totals.r1Kg));
  setInputIfIdle(modal.querySelector('#beef-yield-r2'), kgFieldValue(totals.r2Kg));
  setInputIfIdle(modal.querySelector('#beef-yield-r3'), kgFieldValue(totals.r3Kg));
  setInputIfIdle(modal.querySelector('#beef-yield-fett'), kgFieldValue(state.fettKg));
}

async function saveYieldToLogbook() {
  const charge = String(state.chargenNummer || '').trim();
  if (!charge) {
    window.showToast?.('Charge fehlt – bitte in den Stammdaten eintragen.', 'error');
    return;
  }
  const save = window.saveGallowayYieldToLogbook;
  if (typeof save !== 'function') {
    window.showToast?.('Chargenbuch ist noch nicht bereit.', 'error');
    return;
  }
  const totals = computeYield();
  const btn = document.getElementById('beef-yield-save');
  if (btn) btn.disabled = true;
  try {
    const result = await save({
      chargenNummer: charge,
      ohrmarke: state.ohrmarke,
      schlachtDatum: state.schlachtDatum,
      zerlegeDatum: state.zerlegeDatum,
      herkunft: state.herkunft,
      betriebsNummer: state.betriebsNummer,
      schlachtgewichtKaltKg: state.schlachtgewichtKalt,
      schlachtgewichtWarmKg: state.schlachtgewichtWarm,
      haelfteLinksKg: state.haelfteLinks,
      haelfteRechtsKg: state.haelfteRechts,
      totals,
      positionen: state.queue.map((item) => {
        const cut = findCut(item.id);
        return {
          id: item.id,
          name: cut ? formatPrintName(cut.bezeichnung) : item.id,
          menge: item.quantity,
          weightKg: item.weightKg,
        };
      }),
    });
    if (result?.queued) return;
    window.showToast?.('✅ Ausbeute gespeichert & Wurstfleisch (R I–R III) im Magazin eingebucht!', 'success');
  } catch (err) {
    window.showToast?.(err?.message || 'Ausbeute konnte nicht gespeichert werden.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderModalBody() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;

  const chargeEl = modal.querySelector('#beef-charge');
  const prefixEl = modal.querySelector('#beef-prefix');
  const earEl = modal.querySelector('#beef-ohrmarke');
  const slaughterEl = modal.querySelector('#beef-schlacht');
  const cutDateEl = modal.querySelector('#beef-zerlege');
  const originEl = modal.querySelector('#beef-herkunft');
  const plantEl = modal.querySelector('#beef-betrieb');
  const skipEl = modal.querySelector('#beef-skip');
  if (chargeEl && document.activeElement !== chargeEl) chargeEl.value = state.chargenNummer;
  if (prefixEl && document.activeElement !== prefixEl) prefixEl.value = state.etikettenPraefix;
  if (earEl && document.activeElement !== earEl) earEl.value = state.ohrmarke;
  if (slaughterEl && document.activeElement !== slaughterEl) slaughterEl.value = state.schlachtDatum;
  if (cutDateEl && document.activeElement !== cutDateEl) cutDateEl.value = state.zerlegeDatum;
  if (originEl && document.activeElement !== originEl) originEl.value = state.herkunft;
  if (plantEl && document.activeElement !== plantEl) plantEl.value = state.betriebsNummer;
  if (skipEl && document.activeElement !== skipEl) skipEl.value = String(state.skipCount);
  setInputIfIdle(modal.querySelector('#beef-kalt'), kgFieldValue(state.schlachtgewichtKalt));
  setInputIfIdle(modal.querySelector('#beef-warm'), kgFieldValue(state.schlachtgewichtWarm));
  setInputIfIdle(modal.querySelector('#beef-haelfte-links'), kgFieldValue(state.haelfteLinks));
  setInputIfIdle(modal.querySelector('#beef-haelfte-rechts'), kgFieldValue(state.haelfteRechts));

  const summaryCharge = modal.querySelector('#beef-stammdaten-summary');
  if (summaryCharge) {
    summaryCharge.textContent = `${state.segment} · ${state.chargenNummer || '—'} · Start Slot ${state.skipCount + 1}`;
  }
  const segmentEl = /** @type {HTMLSelectElement|null} */ (modal.querySelector('#beef-segment'));
  if (segmentEl && document.activeElement !== segmentEl) segmentEl.value = state.segment;

  const tabHost = modal.querySelector('.beef-tabs');
  if (tabHost) {
    ensureActiveTab();
    tabHost.innerHTML = tabsForSegment().map((cat) => `
      <button type="button" class="beef-tab${cat === state.activeTab ? ' is-active' : ''}" data-beef-tab="${cat}">${escapeHtml(tabLabel(cat))}</button>
    `).join('');
  }

  const cutList = modal.querySelector('#beef-cut-list');
  const queueList = modal.querySelector('#beef-queue-list');
  if (cutList) renderCutList(cutList);
  if (queueList) renderQueue(queueList);

  const totalEl = modal.querySelector('#beef-total-labels');
  const sheetsEl = modal.querySelector('#beef-sheets');
  const printBtn = modal.querySelector('#btn-print-labels');
  const basketPill = modal.querySelector('#beef-basket-pill');
  const queueCount = modal.querySelector('#beef-queue-count');
  if (totalEl) totalEl.textContent = String(totalLabels());
  if (sheetsEl) sheetsEl.textContent = String(sheetsNeeded());
  if (basketPill) basketPill.textContent = `${totalLabels()} Etiketten`;
  if (queueCount) queueCount.textContent = `${state.queue.length} Pos.`;
  if (printBtn) {
    printBtn.disabled = totalLabels() === 0;
    printBtn.textContent = 'Drucken';
  }
  renderYield();
}

function goToCutSelection() {
  const modal = document.getElementById('beef-labels-modal');
  const details = /** @type {HTMLDetailsElement|null} */ (modal?.querySelector('#beef-stammdaten'));
  if (details) details.open = false;
  const tabs = modal?.querySelector('.beef-tabs');
  tabs?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetNewCharge() {
  const ok = window.confirm(
    'Neue Charge starten? Der aktuelle Druckkorb wird geleert.',
  );
  if (!ok) return;
  state.queue = [];
  state.skipCount = 0;
  state.chargenNummer = '';
  state.ohrmarke = '';
  state.schlachtgewichtKalt = 0;
  state.schlachtgewichtWarm = 0;
  state.haelfteLinks = 0;
  state.haelfteRechts = 0;
  state.fettKg = 0;
  state.r1Override = null;
  state.r2Override = null;
  state.r3Override = null;
  state.segment = 'GK';
  ensureActiveTab();
  persist();
  const modal = document.getElementById('beef-labels-modal');
  const details = /** @type {HTMLDetailsElement|null} */ (modal?.querySelector('#beef-stammdaten'));
  if (details) details.open = true;
  renderModalBody();
  const chargeEl = /** @type {HTMLInputElement|null} */ (modal?.querySelector('#beef-charge'));
  window.setTimeout(() => chargeEl?.focus(), 50);
}

function openModal() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('beef-labels-open');
  const details = /** @type {HTMLDetailsElement|null} */ (modal.querySelector('#beef-stammdaten'));
  if (details) {
    details.open = !String(state.chargenNummer || '').trim();
  }
  renderModalBody();
}

function closeModal() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('beef-labels-open');
}

function ensureModal() {
  const existing = document.getElementById('beef-labels-modal');
  if (existing?.dataset.ux === 'segment-v1') return;
  existing?.remove();

  const modal = document.createElement('div');
  modal.id = 'beef-labels-modal';
  modal.className = 'beef-labels-modal galloway-modal';
  modal.dataset.ux = 'segment-v1';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('aria-labelledby', 'beef-labels-title');

  const tabs = TAB_ORDER.map(
    (cat) =>
      `<button type="button" class="beef-tab" data-beef-tab="${cat}">${TAB_LABELS[cat]}</button>`,
  ).join('');

  modal.innerHTML = `
    <div class="beef-labels-sheet modal-content" id="galloway-modal" role="document">
      <header class="beef-labels-header">
        <h2 id="beef-labels-title">Galloway Zerlegung</h2>
        <button type="button" class="beef-close-btn" id="beef-close-btn" aria-label="Schließen">
          <span aria-hidden="true">✕</span>
          <span>Schließen</span>
        </button>
      </header>

      <details class="beef-stammdaten" id="beef-stammdaten">
        <summary>
          <span>Stammdaten</span>
          <span class="beef-stammdaten-preview" id="beef-stammdaten-summary">—</span>
        </summary>
        <div class="beef-stammdaten-actions">
          <button type="button" class="beef-reset-btn" id="beef-reset-btn">Neue Charge / Reset</button>
        </div>
        <div class="beef-labels-settings">
          <label>Rasse / Etiketten-Präfix
            <input type="text" id="beef-prefix" class="input-text-touch" autocomplete="off" placeholder="Bio-Galloway">
          </label>
          <label>Charge
            <input type="text" id="beef-charge" class="input-text-touch" autocomplete="off">
          </label>
          <label>Viertel
            <select id="beef-segment" class="input-text-touch">
              <option value="HV">HV – Hinterviertel</option>
              <option value="VV">VV – Vorderviertel</option>
              <option value="GK">GK – Ganzer Körper / Hälften</option>
            </select>
          </label>
          <label>Ohrmarke / Pass-Nr
            <input type="text" id="beef-ohrmarke" class="input-text-touch" autocomplete="off">
          </label>
          <label>Schlachtgewicht kalt (kg)
            <input type="text" id="beef-kalt" class="input-text-touch" inputmode="decimal" placeholder="z. B. 285,5" autocomplete="off">
          </label>
          <label>Schlachtgewicht warm (kg)
            <input type="text" id="beef-warm" class="input-text-touch" inputmode="decimal" placeholder="optional" autocomplete="off">
          </label>
          <label>Hälfte links (kg)
            <input type="text" id="beef-haelfte-links" class="input-text-touch" inputmode="decimal" placeholder="optional" autocomplete="off">
          </label>
          <label>Hälfte rechts (kg)
            <input type="text" id="beef-haelfte-rechts" class="input-text-touch" inputmode="decimal" placeholder="optional" autocomplete="off">
          </label>
          <label>Schlachtdatum
            <input type="text" id="beef-schlacht" class="input-text-touch" inputmode="numeric" autocomplete="off">
          </label>
          <label>Zerlege-Datum
            <input type="text" id="beef-zerlege" class="input-text-touch" inputmode="numeric" autocomplete="off">
          </label>
          <label>Herkunft
            <input type="text" id="beef-herkunft" class="input-text-touch" autocomplete="off">
          </label>
          <label>Betrieb
            <input type="text" id="beef-betrieb" class="input-text-touch" autocomplete="off">
          </label>
          <label>Bereits verbraucht (0–23)
            <input type="number" id="beef-skip" class="input-text-touch" min="0" max="23" step="1">
          </label>
        </div>
        <div class="beef-stammdaten-footer">
          <button type="button" class="beef-continue-btn" id="beef-continue-btn">Weiter zur Fleischauswahl</button>
        </div>
      </details>

      <div class="beef-labels-stage" id="beef-labels-stage">
        <div class="beef-labels-main" id="beef-labels-main">
          <div class="beef-labels-catalog">
            <div class="beef-tabs" role="tablist">${tabs}</div>
            <div class="beef-custom-add">
              <input type="text" id="beef-custom-name" class="input-text-touch" placeholder="Eigenes Teilstück eingeben…" autocomplete="off">
              <button type="button" class="beef-custom-add-btn" id="beef-custom-add-btn">+ Hinzufügen</button>
            </div>
            <div id="beef-cut-list" class="beef-cut-list"></div>
          </div>
        </div>
        <aside class="beef-labels-side" id="beef-labels-side" aria-label="Druckkorb und Ausbeute">
          <details class="beef-labels-basket" id="beef-basket-panel" open>
            <summary class="beef-basket-head">
              <span>Druckkorb <span id="beef-queue-count">0 Pos.</span></span>
              <button type="button" class="beef-clear-btn" id="beef-clear-btn">Leeren</button>
            </summary>
            <div id="beef-queue-list" class="beef-queue-list"></div>
          </details>
          <div class="beef-yield-summary" id="beef-yield-summary">
            <div class="beef-yield-bar" id="beef-yield-bar" role="img" aria-label="Ausbeute"></div>
            <div class="beef-yield-legend" id="beef-yield-legend"></div>
            <details class="beef-yield-drawer" id="beef-yield-drawer">
              <summary>📊 Ausbeute-Protokoll anzeigen</summary>
              <div class="beef-yield-protocol">
                <div class="beef-yield-row"><span>Schlachtgewicht</span><strong id="beef-yield-basis">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Edelteile &amp; Steaks</span><strong id="beef-yield-edel">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Braten &amp; Keule</span><strong id="beef-yield-braten">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Verarbeitungsfleisch</span><strong id="beef-yield-verarbeitung">0,0 kg</strong></div>
                <label class="beef-yield-row">R I Gulasch<input type="text" id="beef-yield-r1" class="beef-yield-kg" inputmode="decimal" placeholder="0,0"></label>
                <label class="beef-yield-row">R II Hackfleisch<input type="text" id="beef-yield-r2" class="beef-yield-kg" inputmode="decimal" placeholder="0,0"></label>
                <label class="beef-yield-row">R III Wurstfleisch<input type="text" id="beef-yield-r3" class="beef-yield-kg" inputmode="decimal" placeholder="0,0"></label>
                <div class="beef-yield-row"><span>Knochen, Haxen &amp; Suppe</span><strong id="beef-yield-knochen">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Innereien &amp; BARF</span><strong id="beef-yield-innereien">0,0 kg</strong></div>
                <label class="beef-yield-row">Abschnitte / Fett / Sehnen<input type="text" id="beef-yield-fett" class="beef-yield-kg" inputmode="decimal" placeholder="0,0"></label>
                <div class="beef-yield-row"><span>Gesamt-Ausbeute</span><strong id="beef-yield-gesamt">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Zerlegeverlust / Tropfverlust</span><strong id="beef-yield-verlust">0,0 kg</strong></div>
                <div class="beef-yield-row"><span>Knochen &amp; Abfall</span><strong id="beef-yield-abfall">0,0 %</strong></div>
              </div>
            </details>
          </div>
        </aside>
      </div>

      <footer class="beef-labels-footer">
        <div class="beef-footer-meta">
          <span class="beef-basket-pill" id="beef-basket-pill">0 Etiketten</span>
          <span class="beef-footer-sheets"><strong id="beef-total-labels">0</strong> Stk · <strong id="beef-sheets">1</strong> Bogen</span>
        </div>
        <button type="button" class="beef-yield-save" id="beef-yield-save">Ausbeute speichern</button>
        <button type="button" class="beef-print-btn" id="btn-print-labels">Drucken</button>
      </footer>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#beef-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-print-labels')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlePrint();
  });
  modal.querySelector('#beef-yield-save')?.addEventListener('click', () => {
    saveYieldToLogbook();
  });
  modal.querySelector('#beef-continue-btn')?.addEventListener('click', goToCutSelection);
  modal.querySelector('#beef-reset-btn')?.addEventListener('click', resetNewCharge);
  modal.querySelector('#beef-clear-btn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.queue = [];
    persist();
    renderModalBody();
  });

  modal.querySelector('#beef-custom-add-btn')?.addEventListener('click', () => {
    const input = /** @type {HTMLInputElement|null} */ (modal.querySelector('#beef-custom-name'));
    if (!input) return;
    if (addCustomCut(input.value)) {
      input.value = '';
      persist();
      renderModalBody();
    }
  });

  modal.querySelector('#beef-custom-name')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    modal.querySelector('#beef-custom-add-btn')?.dispatchEvent(new Event('click'));
  });

  modal.querySelector('#beef-segment')?.addEventListener('change', (event) => {
    const value = /** @type {HTMLSelectElement} */ (event.target).value;
    if (value !== 'HV' && value !== 'VV' && value !== 'GK') return;
    state.segment = value;
    ensureActiveTab();
    persist();
    renderModalBody();
  });

  const bindField = (id, key, transform) => {
    const el = modal.querySelector(id);
    el?.addEventListener('input', () => {
      const raw = /** @type {HTMLInputElement} */ (el).value;
      state[key] = transform ? transform(raw) : raw;
      persist();
      if (key === 'chargenNummer') applyDetectedSegment(state.chargenNummer);
      if (key === 'skipCount' || key === 'chargenNummer' || key === 'etikettenPraefix') {
        ensureActiveTab();
        renderModalBody();
      }
    });
  };
  bindField('#beef-charge', 'chargenNummer');
  bindField('#beef-prefix', 'etikettenPraefix');
  bindField('#beef-ohrmarke', 'ohrmarke');
  bindField('#beef-schlacht', 'schlachtDatum');
  bindField('#beef-zerlege', 'zerlegeDatum');
  bindField('#beef-herkunft', 'herkunft');
  bindField('#beef-betrieb', 'betriebsNummer');
  bindField('#beef-skip', 'skipCount', (raw) =>
    Math.max(0, Math.min(23, parseInt(String(raw), 10) || 0)),
  );
  const bindKg = (id, key) => {
    const el = modal.querySelector(id);
    el?.addEventListener('input', () => {
      state[key] = parseKg(/** @type {HTMLInputElement} */ (el).value);
      persist();
      renderYield();
    });
  };
  bindKg('#beef-kalt', 'schlachtgewichtKalt');
  bindKg('#beef-warm', 'schlachtgewichtWarm');
  bindKg('#beef-haelfte-links', 'haelfteLinks');
  bindKg('#beef-haelfte-rechts', 'haelfteRechts');
  modal.querySelector('#beef-yield-fett')?.addEventListener('input', (event) => {
    state.fettKg = parseKg(/** @type {HTMLInputElement} */ (event.target).value);
    persist();
    renderYield();
  });
  const bindGrade = (id, key) => {
    modal.querySelector(id)?.addEventListener('input', (event) => {
      const raw = /** @type {HTMLInputElement} */ (event.target).value.trim();
      state[key] = raw ? parseKg(raw) : null;
      persist();
      renderYield();
    });
  };
  bindGrade('#beef-yield-r1', 'r1Override');
  bindGrade('#beef-yield-r2', 'r2Override');
  bindGrade('#beef-yield-r3', 'r3Override');

  modal.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const tabBtn = target.closest('[data-beef-tab]');
    if (tabBtn && tabBtn.closest('.beef-tabs')) {
      state.activeTab = /** @type {CutCategory} */ (tabBtn.getAttribute('data-beef-tab') || tabsForSegment()[0]);
      persist();
      renderModalBody();
      return;
    }
    if (target === modal) {
      closeModal();
      return;
    }
    const kgInput = target.closest('[data-kg-input]');
    if (kgInput) return;
    const row = target.closest('[data-cut-id]');
    const kgBtn = target.closest('[data-kg-delta]');
    if (row && kgBtn) {
      const cutId = row.getAttribute('data-cut-id');
      const delta = Number(kgBtn.getAttribute('data-kg-delta'));
      const item = state.queue.find((entry) => entry.id === cutId);
      if (!cutId || !item || !delta) return;
      setLineWeight(cutId, item.weightKg + delta);
      renderModalBody();
      return;
    }
    const btn = target.closest('[data-delta]');
    if (!row || !btn) return;
    const cutId = row.getAttribute('data-cut-id');
    const delta = Number(btn.getAttribute('data-delta'));
    if (!cutId || !delta) return;
    updateQuantity(cutId, delta);
  });
  modal.addEventListener('input', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target.matches?.('[data-kg-input]')) return;
    const row = target.closest('[data-cut-id]');
    const cutId = row?.getAttribute('data-cut-id');
    if (!cutId) return;
    setLineWeight(cutId, parseKg(/** @type {HTMLInputElement} */ (target).value));
  });
}

function ensureTriggerButtons() {
  const receiving = document.getElementById('page-receiving');
  const kitchen = document.getElementById('page-kitchen');

  const makeBtn = (id) => {
    const existing = document.getElementById(id);
    if (existing) return existing;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'btn btn-secondary beef-labels-open-btn';
    btn.textContent = '🥩 Galloway Zerlegung / Avery 3475';
    return btn;
  };

  if (receiving && !document.getElementById('beef-labels-open-receiving')) {
    const btn = makeBtn('beef-labels-open-receiving');
    const eigenRow = receiving.querySelector('.receiving-supplier-row');
    const metzPanel = document.getElementById('receiving-panel-metzgerei');
    const host = document.createElement('div');
    host.className = 'beef-labels-trigger-wrap';
    host.appendChild(btn);
    if (eigenRow?.parentElement) {
      eigenRow.parentElement.insertAdjacentElement('afterend', host);
    } else if (metzPanel) {
      metzPanel.appendChild(host);
    } else {
      receiving.prepend(host);
    }
  }

  if (kitchen && !document.getElementById('beef-labels-open-kitchen')) {
    const btn = makeBtn('beef-labels-open-kitchen');
    const host = document.createElement('div');
    host.className = 'beef-labels-trigger-wrap beef-labels-trigger-wrap--kitchen';
    host.appendChild(btn);
    kitchen.prepend(host);
  }

  document.querySelectorAll('.beef-labels-open-btn').forEach((btn) => {
    if (btn.dataset.beefBound === '1') return;
    btn.dataset.beefBound = '1';
    btn.addEventListener('click', openModal);
  });
}

export function initBeefLabels() {
  hydrateState();
  ensureModal();
  ensureTriggerButtons();
  ensurePrintRoot();
}

export function openBeefLabelsModal() {
  ensureModal();
  openModal();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBeefLabels(), { once: true });
  } else {
    initBeefLabels();
  }
}

window.initBeefLabels = initBeefLabels;
window.openBeefLabelsModal = openBeefLabelsModal;
