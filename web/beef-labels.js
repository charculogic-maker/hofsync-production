/**
 * Galloway Zerlege-Etiketten · Avery Zweckform 3475 (70×36 mm, 3×8 = 24 Nutzen)
 * StevesHof / HofSync – anatomische Baugruppen + eigene Teilstücke.
 */
const STORAGE_KEY = 'hofsync.beefLabels.v1';
const CUSTOM_CUTS_KEY = 'hofsync_custom_beef_cuts';

/** @typedef {'SCHULTER'|'RUECKEN'|'LAPPEN'|'KEULE'|'HACK'|'KNOCHEN'|'INNEREIEN'|'TIERNAHRUNG'|'CUSTOM'} CutCategory */

/**
 * @typedef {{
 *   id: string,
 *   kategorie: CutCategory,
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
    bezeichnung: 'BIO-GALLOWAY DICKES BUGSTÜCK',
    teilstueckDetail: 'Schulterbraten · Kerniger Rinderbraten & Sauerbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-schildstueck',
    kategorie: 'SCHULTER',
    bezeichnung: 'BIO-GALLOWAY SCHILDSTÜCK',
    teilstueckDetail: 'Flat Iron · Entsehntes Schaufelstück',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-falsches-filet',
    kategorie: 'SCHULTER',
    bezeichnung: 'BIO-GALLOWAY FALSCHES FILET',
    teilstueckDetail: 'Schulterfilet · Zartes Kurzbratstück',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-metzgerstueck',
    kategorie: 'SCHULTER',
    bezeichnung: 'BIO-GALLOWAY METZGERSTÜCK',
    teilstueckDetail: 'Teres Major · Kleines Schulterfilet',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'schulter-schaufelbraten',
    kategorie: 'SCHULTER',
    bezeichnung: 'BIO-GALLOWAY SCHAUFELBRATEN',
    teilstueckDetail: 'Schaufelbraten · Schmor- & Bratstück',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Rücken & Ribs ——
  {
    id: 'ruecken-filet-spitze',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY FILETSPITZE',
    teilstueckDetail: 'Filet Spitze · Tournedos / Medaillons',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-filet-mittel',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY FILETMITTEL',
    teilstueckDetail: 'Filet Mittelstück · Chateaubriand',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-filet-kopf',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY FILETKOPF',
    teilstueckDetail: 'Filet Kopf · Ragout / Fondue / Medaillons',
    reifung: 'Zartreifung im Vakuum',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-roastbeef',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY ROASTBEEF',
    teilstueckDetail: 'Rumpsteak ohne Kette',
    reifung: '14T Dry-Aged → Wet-Aging (max 6W)',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-entrecote',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY ENTRECÔTE',
    teilstueckDetail: 'Ribeye / Entrecôte ohne Knochen',
    reifung: '14T Dry-Aged → Wet-Aging',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-cote-de-boeuf',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY CÔTE DE BOEUF',
    teilstueckDetail: 'Hohe Rippe mit Knochen · Prime Rib',
    reifung: 'Dry-Aged Knochenreife mind. 28T',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'ruecken-t-bone-porterhouse',
    kategorie: 'RUECKEN',
    bezeichnung: 'BIO-GALLOWAY T-BONE / PORTERHOUSE',
    teilstueckDetail: 'Roastbeef & Filet am T-Knochen',
    reifung: 'Dry-Aged Knochenreife mind. 28T',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Lappen & Spezial ——
  {
    id: 'lappen-flank',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY FLANK STEAK',
    teilstueckDetail: 'Flank · Dünnung / Bavette de Flanchet',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-skirt',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY SKIRT STEAK',
    teilstueckDetail: 'Kronfleisch · Grill & Pfanne',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-bavette',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY BAVETTE',
    teilstueckDetail: 'Flap Meat · Saftiges Grillstück',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-spider',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY SPIDER STEAK',
    teilstueckDetail: 'Fledermaus / Kavalierhäutchen',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-brisket',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY BRISKET',
    teilstueckDetail: 'Rinderbrust · Smoker / Schmoren',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'lappen-nierenzapfen',
    kategorie: 'LAPPEN',
    bezeichnung: 'BIO-GALLOWAY NIERENZAPFEN',
    teilstueckDetail: 'Onglet / Hanging Tender · Grill',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Keule (Knöpfel) ——
  {
    id: 'keule-kugel-flach',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY FLACHE KUGEL',
    teilstueckDetail: 'Kugel flach · Schmorbraten & Fondue',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-kugel-rund',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY RUNDE KUGEL',
    teilstueckDetail: 'Kugel rund · Runder Schmorbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-spiessfleisch',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY SPIESSFLEISCH',
    teilstueckDetail: 'Magere Spieß-Abschnitte · Spieße / Fondue',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-oberschale',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY OBERSCHALE',
    teilstueckDetail: 'Oberschale ohne Deckel · Rouladen & Minutensteaks',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-oberschalendeckel',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY OBERSCHALENDECKEL',
    teilstueckDetail: 'Oberschalendeckel · Schmorbraten & Rouladen',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-unterschale',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY UNTERSCHALE',
    teilstueckDetail: 'Schwanzstück · Klassischer Schmorbraten',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-semerrolle',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY SEMERROLLE',
    teilstueckDetail: 'Tafelrolle · Sauerbraten / Carpaccio',
    reifung: 'Wet-Aging bis 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-hueftsteak',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY HÜFTSTEAK',
    teilstueckDetail: 'Hüfte / Blume · Feinfaseriges Steak',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-tafelspitz',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY TAFELSPITZ',
    teilstueckDetail: 'Picanha mit Fettdeckel · Grill & Siedefleisch',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-buergermeister',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY BÜRGERMEISTERSTÜCK',
    teilstueckDetail: 'Tri-Tip · Kurzbrat- & Schmorstück',
    reifung: 'Wet-Aging 28 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'keule-wade',
    kategorie: 'KEULE',
    bezeichnung: 'BIO-GALLOWAY WADE',
    teilstueckDetail: 'Wadenfleisch / Hesse · Schmorbraten & Gulasch',
    reifung: 'Wet-Aging bis 21 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Hack & Gulasch ——
  {
    id: 'abschnitt-r1-gulasch',
    kategorie: 'HACK',
    bezeichnung: 'BIO-GALLOWAY GULASCH',
    teilstueckDetail: 'R I Magerfleisch grob entsehnt · Saftgulasch',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'abschnitt-r2-hack',
    kategorie: 'HACK',
    bezeichnung: 'BIO-GALLOWAY R II MAGER',
    teilstueckDetail: 'Abschnitte · Rinderhack & Burger',
    reifung: 'Frischverarbeitung / Kutter / Kühlung',
    lagerung: 'Lag: ≤ 2 °C / -18 °C',
  },

  // —— Knochen & Suppe ——
  {
    id: 'beinscheibe-hinterhaxe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY HINTERHAXE',
    teilstueckDetail: 'Hintere Beinscheibe · Ossobuco',
    reifung: 'Frisch gekühlt / Schmorstück',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'beinscheibe-vorderhaxe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY VORDERHAXE',
    teilstueckDetail: 'Vordere Beinscheibe · Suppenfleisch',
    reifung: 'Frisch gekühlt / Suppenschnitt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-brustkern',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY RINDERBRUST',
    teilstueckDetail: 'Brustkern mit Knochen · Siedefleisch',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-querrippe',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY QUERRIPPE',
    teilstueckDetail: 'Spannrippe / Beinfleisch mit Knochen',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C',
  },
  {
    id: 'knochen-markknochen',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY MARKKNOCHEN',
    teilstueckDetail: 'Röhrenknochen in Scheiben · Suppenmark',
    reifung: 'Frisch geschnitten',
    lagerung: 'Lag: 0–2 °C / -18 °C',
  },
  {
    id: 'knochen-suppenknochen',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY SUPPENKNOCHEN',
    teilstueckDetail: 'Sand- & Fleischknochen für Rinderfond',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: 0–2 °C / -18 °C',
  },
  {
    id: 'knochen-ochsenschwanz',
    kategorie: 'KNOCHEN',
    bezeichnung: 'BIO-GALLOWAY OCHSENSCHWANZ',
    teilstueckDetail: 'Rinderschweif in Glieder · Gourmet-Sud',
    reifung: 'Wet-Aging bis 14 Tage',
    lagerung: 'Lag: 0–2 °C',
  },

  // —— Innereien (Verkauf) ——
  {
    id: 'innerei-zunge',
    kategorie: 'INNEREIEN',
    bezeichnung: 'BIO-GALLOWAY RINDERZUNGE',
    teilstueckDetail: 'Geputzt · Zum Pökeln oder Sieden',
    reifung: 'Frisch verpackt · Vor Verzehr durcherhitzen',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-nierenzapfen',
    kategorie: 'INNEREIEN',
    bezeichnung: 'BIO-GALLOWAY NIERENZAPFEN',
    teilstueckDetail: 'Onglet · Frischware Verkauf',
    reifung: 'Frisch gekühlt',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-leber',
    kategorie: 'INNEREIEN',
    bezeichnung: 'BIO-GALLOWAY RINDERLEBER',
    teilstueckDetail: 'Frische Bio-Leber · Kurzbraten',
    reifung: 'Tagesfrisch · Sofortiger Verzehr',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },
  {
    id: 'innerei-herz',
    kategorie: 'INNEREIEN',
    bezeichnung: 'BIO-GALLOWAY RINDERHERZ',
    teilstueckDetail: 'Feinfaserig & mager · Schmorbraten & Ragout',
    reifung: 'Frisch pariert',
    lagerung: 'Lag: ≤ 3 °C / -18 °C',
  },

  // —— Tiernahrung / BARF ——
  {
    id: 'barf-innereien-mix',
    kategorie: 'TIERNAHRUNG',
    bezeichnung: 'BIO-GALLOWAY BARF INNEREIEN-MIX',
    teilstueckDetail: 'Ergänzungsfuttermittel für Tiere – Nicht für den menschl. Verzehr · Lunge/Milz/Kutteln',
    reifung: 'Frisch / TK verpackt',
    lagerung: 'Lag: ≤ 3 °C / TK -18 °C',
  },
  {
    id: 'barf-pansen-pur',
    kategorie: 'TIERNAHRUNG',
    bezeichnung: 'BIO-GALLOWAY PANSEN PUR',
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
        bezeichnung: String(entry?.bezeichnung || '').trim(),
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

function cutsForTab(tab) {
  if (tab === 'CUSTOM') return customCuts.slice();
  return BEEF_CUT_CATALOG.filter((c) => c.kategorie === tab);
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

function addCustomCut(rawName) {
  const name = String(rawName || '').trim();
  if (!name) {
    window.showToast?.('Bitte Teilstück-Name eingeben.', 'error');
    return false;
  }
  const bezeichnung = name.toUpperCase().startsWith('BIO-GALLOWAY')
    ? name.toUpperCase()
    : `BIO-GALLOWAY ${name.toUpperCase()}`;
  const exists = allCuts().some(
    (c) => c.bezeichnung.toLowerCase() === bezeichnung.toLowerCase(),
  );
  if (exists) {
    window.showToast?.('Teilstück existiert bereits.', 'error');
    return false;
  }
  const id = `custom-${slugifyCutName(name)}-${Date.now().toString(36)}`;
  customCuts.push({
    id,
    kategorie: 'CUSTOM',
    bezeichnung,
    teilstueckDetail: 'Eigenes Teilstück · Custom / Vorräte',
    reifung: 'Nach Betriebsvorgabe',
    lagerung: 'Lag: 0–2 °C',
    custom: true,
  });
  saveCustomCuts();
  state.activeTab = 'CUSTOM';
  updateQuantity(id, 1);
  window.showToast?.(`${bezeichnung} gespeichert`, 'success');
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

const state = {
  chargenNummer: 'GAL-VV-2809',
  ohrmarke: 'DE 05 412 89012',
  schlachtDatum: '28.09.2026',
  zerlegeDatum: todayDe(),
  herkunft: 'Geb./Gem./Geschl./Zerl.: DE',
  betriebsNummer: 'Stautenhof · StevesHof',
  skipCount: 0,
  activeTab: /** @type {CutCategory} */ ('KEULE'),
  /** @type {{ id: string, quantity: number }[]} */
  queue: DEFAULT_QUEUE.map((q) => ({ ...q })),
};

function hydrateState() {
  customCuts = loadCustomCuts();
  const saved = loadState();
  if (!saved || typeof saved !== 'object') return;
  if (typeof saved.chargenNummer === 'string') state.chargenNummer = saved.chargenNummer;
  if (typeof saved.ohrmarke === 'string') state.ohrmarke = saved.ohrmarke;
  if (typeof saved.schlachtDatum === 'string') state.schlachtDatum = saved.schlachtDatum;
  if (typeof saved.zerlegeDatum === 'string') state.zerlegeDatum = saved.zerlegeDatum;
  if (typeof saved.herkunft === 'string') state.herkunft = saved.herkunft;
  if (typeof saved.betriebsNummer === 'string') state.betriebsNummer = saved.betriebsNummer;
  if (Number.isFinite(Number(saved.skipCount))) {
    state.skipCount = Math.max(0, Math.min(23, Number(saved.skipCount)));
  }
  if (TAB_ORDER.includes(saved.activeTab)) {
    state.activeTab = saved.activeTab;
  }
  if (Array.isArray(saved.queue)) {
    state.queue = saved.queue
      .map((item) => ({
        id: String(item?.id || ''),
        quantity: Math.max(0, Number(item?.quantity) || 0),
      }))
      .filter((item) => item.id && item.quantity > 0 && findCut(item.id));
  }
}

function persist() {
  saveState({
    chargenNummer: state.chargenNummer,
    ohrmarke: state.ohrmarke,
    schlachtDatum: state.schlachtDatum,
    zerlegeDatum: state.zerlegeDatum,
    herkunft: state.herkunft,
    betriebsNummer: state.betriebsNummer,
    skipCount: state.skipCount,
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
    state.queue.push({ id: cutId, quantity: delta });
  } else {
    existing.quantity += delta;
    if (existing.quantity <= 0) {
      state.queue = state.queue.filter((q) => q.id !== cutId);
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
              <span>STEVESHOF · BIO-GALLOWAY</span>
              <span>Ch: ${escapeHtml(state.chargenNummer)}</span>
            </div>
            <div class="avery-label-title">${escapeHtml(item.cut.bezeichnung)}</div>
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

function handlePrint() {
  if (totalLabels() === 0) {
    window.showToast?.('Druckkorb ist leer.', 'error');
    return;
  }
  const root = ensurePrintRoot();
  root.innerHTML = buildPrintPagesHtml();
  document.body.classList.add('printing-beef-labels');
  const cleanup = () => {
    document.body.classList.remove('printing-beef-labels');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.setTimeout(() => window.print(), 50);
  window.setTimeout(cleanup, 2000);
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
            <div class="beef-cut-name">${escapeHtml(cut.bezeichnung)}</div>
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
      return `
        <div class="beef-queue-row" data-cut-id="${escapeHtml(item.id)}">
          <div class="beef-cut-info">
            <div class="beef-cut-name">${escapeHtml(cut.bezeichnung)}</div>
            <div class="beef-cut-detail">${escapeHtml(cut.teilstueckDetail)}</div>
          </div>
          <div class="beef-qty">
            <button type="button" class="beef-qty-btn" data-delta="-1">−</button>
            <span class="beef-qty-val">${item.quantity}</span>
            <button type="button" class="beef-qty-btn beef-qty-btn--plus" data-delta="1">+</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderModalBody() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;

  const chargeEl = modal.querySelector('#beef-charge');
  const earEl = modal.querySelector('#beef-ohrmarke');
  const slaughterEl = modal.querySelector('#beef-schlacht');
  const cutDateEl = modal.querySelector('#beef-zerlege');
  const originEl = modal.querySelector('#beef-herkunft');
  const plantEl = modal.querySelector('#beef-betrieb');
  const skipEl = modal.querySelector('#beef-skip');
  if (chargeEl && document.activeElement !== chargeEl) chargeEl.value = state.chargenNummer;
  if (earEl && document.activeElement !== earEl) earEl.value = state.ohrmarke;
  if (slaughterEl && document.activeElement !== slaughterEl) slaughterEl.value = state.schlachtDatum;
  if (cutDateEl && document.activeElement !== cutDateEl) cutDateEl.value = state.zerlegeDatum;
  if (originEl && document.activeElement !== originEl) originEl.value = state.herkunft;
  if (plantEl && document.activeElement !== plantEl) plantEl.value = state.betriebsNummer;
  if (skipEl && document.activeElement !== skipEl) skipEl.value = String(state.skipCount);

  const summaryCharge = modal.querySelector('#beef-stammdaten-summary');
  if (summaryCharge) {
    summaryCharge.textContent = `${state.chargenNummer || '—'} · Start Slot ${state.skipCount + 1}`;
  }

  modal.querySelectorAll('[data-beef-tab]').forEach((btn) => {
    const cat = btn.getAttribute('data-beef-tab');
    btn.classList.toggle('is-active', cat === state.activeTab);
  });

  const cutList = modal.querySelector('#beef-cut-list');
  const queueList = modal.querySelector('#beef-queue-list');
  if (cutList) renderCutList(cutList);
  if (queueList) renderQueue(queueList);

  const totalEl = modal.querySelector('#beef-total-labels');
  const sheetsEl = modal.querySelector('#beef-sheets');
  const printBtn = modal.querySelector('#beef-print-btn');
  const basketPill = modal.querySelector('#beef-basket-pill');
  const queueCount = modal.querySelector('#beef-queue-count');
  if (totalEl) totalEl.textContent = String(totalLabels());
  if (sheetsEl) sheetsEl.textContent = String(sheetsNeeded());
  if (basketPill) basketPill.textContent = `${totalLabels()} Etiketten`;
  if (queueCount) queueCount.textContent = `${state.queue.length} Pos.`;
  if (printBtn) {
    printBtn.disabled = totalLabels() === 0;
    printBtn.textContent = `Drucken · ${sheetsNeeded()} Bogen`;
  }
}

function openModal() {
  const modal = document.getElementById('beef-labels-modal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('beef-labels-open');
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
  if (existing?.dataset.ux === 'catalog-v3') return;
  existing?.remove();

  const modal = document.createElement('div');
  modal.id = 'beef-labels-modal';
  modal.className = 'beef-labels-modal';
  modal.dataset.ux = 'catalog-v3';
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
    <div class="beef-labels-sheet" role="document">
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
        <div class="beef-labels-settings">
          <label>Charge
            <input type="text" id="beef-charge" class="input-text-touch" autocomplete="off">
          </label>
          <label>Ohrmarke
            <input type="text" id="beef-ohrmarke" class="input-text-touch" autocomplete="off">
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
      </details>

      <div class="beef-labels-main">
        <div class="beef-labels-catalog">
          <div class="beef-tabs" role="tablist">${tabs}</div>
          <div class="beef-custom-add">
            <input type="text" id="beef-custom-name" class="input-text-touch" placeholder="Eigenes Teilstück eingeben…" autocomplete="off">
            <button type="button" class="beef-custom-add-btn" id="beef-custom-add-btn">+ Hinzufügen</button>
          </div>
          <div id="beef-cut-list" class="beef-cut-list"></div>
        </div>
        <details class="beef-labels-basket" id="beef-basket-panel" open>
          <summary class="beef-basket-head">
            <span>Druckkorb <span id="beef-queue-count">0 Pos.</span></span>
            <button type="button" class="beef-clear-btn" id="beef-clear-btn">Leeren</button>
          </summary>
          <div id="beef-queue-list" class="beef-queue-list"></div>
        </details>
      </div>

      <footer class="beef-labels-footer">
        <div class="beef-footer-meta">
          <span class="beef-basket-pill" id="beef-basket-pill">0 Etiketten</span>
          <span class="beef-footer-sheets"><strong id="beef-total-labels">0</strong> Stk · <strong id="beef-sheets">1</strong> Bogen</span>
        </div>
        <button type="button" class="beef-print-btn" id="beef-print-btn">Drucken · 1 Bogen</button>
      </footer>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#beef-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#beef-print-btn')?.addEventListener('click', handlePrint);
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

  modal.querySelectorAll('[data-beef-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = /** @type {CutCategory} */ (btn.getAttribute('data-beef-tab') || 'KEULE');
      persist();
      renderModalBody();
    });
  });

  const bindField = (id, key, transform) => {
    const el = modal.querySelector(id);
    el?.addEventListener('input', () => {
      const raw = /** @type {HTMLInputElement} */ (el).value;
      state[key] = transform ? transform(raw) : raw;
      persist();
      if (key === 'skipCount' || key === 'chargenNummer') renderModalBody();
    });
  };
  bindField('#beef-charge', 'chargenNummer');
  bindField('#beef-ohrmarke', 'ohrmarke');
  bindField('#beef-schlacht', 'schlachtDatum');
  bindField('#beef-zerlege', 'zerlegeDatum');
  bindField('#beef-herkunft', 'herkunft');
  bindField('#beef-betrieb', 'betriebsNummer');
  bindField('#beef-skip', 'skipCount', (raw) =>
    Math.max(0, Math.min(23, parseInt(String(raw), 10) || 0)),
  );

  modal.addEventListener('click', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target === modal) {
      closeModal();
      return;
    }
    const row = target.closest('[data-cut-id]');
    const btn = target.closest('[data-delta]');
    if (!row || !btn) return;
    const cutId = row.getAttribute('data-cut-id');
    const delta = Number(btn.getAttribute('data-delta'));
    if (!cutId || !delta) return;
    updateQuantity(cutId, delta);
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
