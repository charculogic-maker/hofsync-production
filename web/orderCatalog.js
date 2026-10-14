/**
 * Kunden-Vorbestellkatalog & Abhol-Slot-Berechnung (StevesHof Soft-Launch).
 * Standalone-Nutzung über web/bestellen.html — ohne Firebase-Pflicht.
 */

/** @typedef {'counter'|'sb'} PickupChannel */

/**
 * @typedef {Object} CutOption
 * @property {string} id
 * @property {string} label
 * @property {string} [hint]
 */

/**
 * @typedef {Object} VacuumOption
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {Object} CatalogProduct
 * @property {string} id
 * @property {string} categoryId
 * @property {string} name
 * @property {string} [subtitle]
 * @property {number} pricePerKg
 * @property {'kg'|'piece'|'pack'|'jar'|'bottle'} unit
 * @property {number} [typicalWeightKg]
 * @property {number} [estimatedPiecePrice]
 * @property {boolean} [comingSoon]
 * @property {CutOption[]} [cutOptions]
 * @property {VacuumOption[]} [vacuumOptions]
 * @property {boolean} [allowWeight]
 * @property {boolean} [allowPieces]
 * @property {number} [defaultPieces]
 * @property {number} [defaultWeightKg]
 * @property {string} [notePlaceholder]
 */

/**
 * @typedef {Object} CatalogCategory
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {boolean} [placeholder]
 * @property {CatalogProduct[]} products
 */

/**
 * @typedef {Object} PickupSlot
 * @property {string} id
 * @property {string} start
 * @property {string} end
 * @property {string} label
 */

/**
 * @typedef {Object} PickupDay
 * @property {string} date
 * @property {string} label
 * @property {string} weekday
 * @property {'standard'|'same-day'|'advance'|'counter'} mode
 * @property {string} modeLabel
 * @property {PickupSlot[]} slots
 */

/**
 * @typedef {Object} AvailablePickupSlots
 * @property {string} generatedAt
 * @property {PickupDay[]} counter
 * @property {PickupDay[]} sb
 * @property {{ counter: string, sb: string }} channelLabels
 */

export const PICKUP_CHANNEL_LABELS = {
  counter: '🏪 Bedientheke (Fr/Sa)',
  sb: '❄️ SB-Kühlschrank (So–Do, 06–22 Uhr)',
};

export const COUNTER_HOURS = {
  /** Freitag = 5 */
  5: { open: '09:00', close: '18:30' },
  /** Samstag = 6 */
  6: { open: '09:00', close: '13:00' },
};

export const SB_WEEKDAYS = new Set([0, 1, 2, 3, 4]); // So–Do
export const SB_OPEN = '06:00';
export const SB_CLOSE = '22:00';
export const SB_SAME_DAY_ORDER_UNTIL = '11:00';
export const SB_SAME_DAY_FROM = '16:30';
export const SB_NEXT_DAY_FROM = '14:00';

const VACUUM_DEFAULT = [
  { id: 'einzeln', label: 'Einzeln vakuumiert' },
  { id: 'zusammen', label: 'Zusammen vakuumiert' },
  { id: 'ohne', label: 'Ohne Extra-Vakuum' },
];

/** Basissortiment für den Soft-Launch */
export const ORDER_CATALOG = /** @type {CatalogCategory[]} */ ([
  {
    id: 'bio-galloway',
    name: 'Bio-Galloway',
    description: 'Fleisch von unseren Bio-Galloways – Zuschnitt nach Wunsch.',
    products: [
      {
        id: 'galloway-hack',
        categoryId: 'bio-galloway',
        name: 'Hackfleisch',
        subtitle: 'Frisch gewolft',
        pricePerKg: 19.9,
        unit: 'kg',
        typicalWeightKg: 0.5,
        allowWeight: true,
        allowPieces: true,
        defaultWeightKg: 0.5,
        defaultPieces: 1,
        cutOptions: [
          { id: 'beutel-500', label: '500 g Beutel', hint: 'praktisch zum Einfrieren' },
          { id: 'gross', label: 'Groß / lose', hint: 'größere Menge in einem Pack' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
        notePlaceholder: 'z. B. für Burger oder Bolognese …',
      },
      {
        id: 'galloway-gulasch',
        categoryId: 'bio-galloway',
        name: 'Gulasch',
        subtitle: 'Zum Schmoren',
        pricePerKg: 24.9,
        unit: 'kg',
        typicalWeightKg: 1,
        allowWeight: true,
        allowPieces: false,
        defaultWeightKg: 1,
        cutOptions: [
          { id: '3x3', label: '3 × 3 cm Würfel' },
          { id: 'brocken', label: 'Brocken / grob' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
        notePlaceholder: 'z. B. besonders mager oder mit etwas Fett …',
      },
      {
        id: 'galloway-rouladen',
        categoryId: 'bio-galloway',
        name: 'Rouladen',
        subtitle: 'Vom Oberwasser / Keule',
        pricePerKg: 28.9,
        unit: 'kg',
        typicalWeightKg: 0.18,
        estimatedPiecePrice: 5.2,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 4,
        cutOptions: [
          { id: 'stueck', label: 'Stück (klassisch ausgestochen)' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
        notePlaceholder: 'z. B. dünner / dicker ausstechen …',
      },
      {
        id: 'galloway-rumpsteak',
        categoryId: 'bio-galloway',
        name: 'Rumpsteak Dry-Aged',
        subtitle: 'Reifung am Knochen',
        pricePerKg: 49.9,
        unit: 'kg',
        typicalWeightKg: 0.28,
        estimatedPiecePrice: 14.0,
        allowWeight: true,
        allowPieces: true,
        defaultPieces: 2,
        defaultWeightKg: 0.56,
        cutOptions: [
          { id: 'klassisch', label: 'Klassisch (~2,5 cm)' },
          { id: 'maennercut', label: 'Männercut 4 cm' },
          { id: 'am-stueck', label: 'Am Stück (zum Selbstschneiden)' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
        notePlaceholder: 'z. B. stärker marmoriert, Randfett dran lassen …',
      },
      {
        id: 'galloway-entrecote',
        categoryId: 'bio-galloway',
        name: 'Entrecôte',
        subtitle: 'Hochrippe / Ribeye',
        pricePerKg: 46.9,
        unit: 'kg',
        typicalWeightKg: 0.3,
        estimatedPiecePrice: 14.1,
        allowWeight: true,
        allowPieces: true,
        defaultPieces: 2,
        defaultWeightKg: 0.6,
        cutOptions: [
          { id: '2-5cm', label: '2,5 cm' },
          { id: '4cm', label: '4 cm' },
          { id: 'am-stueck', label: 'Am Stück' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
      },
      {
        id: 'galloway-hueftsteak',
        categoryId: 'bio-galloway',
        name: 'Hüftsteak',
        subtitle: 'Mager & aromatisch',
        pricePerKg: 32.9,
        unit: 'kg',
        typicalWeightKg: 0.22,
        estimatedPiecePrice: 7.2,
        allowWeight: true,
        allowPieces: true,
        defaultPieces: 2,
        defaultWeightKg: 0.44,
        cutOptions: [
          { id: '2cm', label: '2 cm' },
          { id: '2-5cm', label: '2,5 cm' },
          { id: '3cm', label: '3 cm' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
      },
      {
        id: 'galloway-schmorbraten',
        categoryId: 'bio-galloway',
        name: 'Schmorbraten',
        subtitle: 'Zum Braten / Schmoren',
        pricePerKg: 24.5,
        unit: 'kg',
        typicalWeightKg: 1.2,
        allowWeight: true,
        allowPieces: false,
        defaultWeightKg: 1.2,
        cutOptions: [
          { id: 'am-stueck', label: 'Am Stück gebunden' },
          { id: 'scheiben', label: 'In Scheiben' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
        notePlaceholder: 'Wunschgewicht ca. … kg',
      },
      {
        id: 'galloway-beinscheibe',
        categoryId: 'bio-galloway',
        name: 'Beinscheibe',
        subtitle: 'Mit Markknochen',
        pricePerKg: 15.9,
        unit: 'kg',
        typicalWeightKg: 0.4,
        estimatedPiecePrice: 6.4,
        allowWeight: true,
        allowPieces: true,
        defaultPieces: 2,
        defaultWeightKg: 0.8,
        cutOptions: [
          { id: 'scheibe', label: 'Scheibe mit Knochen' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
      },
    ],
  },
  {
    id: 'weidegefluegel',
    name: 'Weidegeflügel',
    description: 'Eigene Schlachtung – Weidehühner vom Hof.',
    products: [
      {
        id: 'huhn-ganz',
        categoryId: 'weidegefluegel',
        name: 'Ganzes Weidehuhn',
        subtitle: '~1,6 kg',
        pricePerKg: 17.9,
        unit: 'piece',
        typicalWeightKg: 1.6,
        estimatedPiecePrice: 28.6,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [
          { id: 'ganz', label: 'Ganz (ofenfertig)' },
        ],
        vacuumOptions: [
          { id: 'beutel', label: 'Im Beutel gekühlt' },
          { id: 'vakuum', label: 'Vakuumiert' },
        ],
      },
      {
        id: 'huhn-brust',
        categoryId: 'weidegefluegel',
        name: 'Brustfilet',
        subtitle: 'Vom Weidehuhn',
        pricePerKg: 29.9,
        unit: 'kg',
        typicalWeightKg: 0.35,
        estimatedPiecePrice: 10.5,
        allowWeight: true,
        allowPieces: true,
        defaultPieces: 2,
        defaultWeightKg: 0.35,
        cutOptions: [
          { id: 'ganz', label: 'Ganzes Filet' },
          { id: 'streifen', label: 'In Streifen' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
      },
      {
        id: 'huhn-keulen',
        categoryId: 'weidegefluegel',
        name: '2er-Keulen',
        subtitle: 'Oberschenkel + Unterschenkel',
        pricePerKg: 13.9,
        unit: 'pack',
        typicalWeightKg: 0.55,
        estimatedPiecePrice: 7.6,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [
          { id: '2er', label: '2er-Pack Keulen' },
        ],
        vacuumOptions: VACUUM_DEFAULT,
      },
      {
        id: 'huhn-suppe',
        categoryId: 'weidegefluegel',
        name: 'Suppenhuhn',
        subtitle: 'Ideal für Brühe',
        pricePerKg: 9.9,
        unit: 'piece',
        typicalWeightKg: 1.4,
        estimatedPiecePrice: 13.9,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [
          { id: 'ganz', label: 'Ganz' },
          { id: 'geteilt', label: 'Geteilt' },
        ],
        vacuumOptions: [
          { id: 'beutel', label: 'Im Beutel gekühlt' },
          { id: 'vakuum', label: 'Vakuumiert' },
        ],
      },
    ],
  },
  {
    id: 'hausgemacht',
    name: 'Hausgemacht',
    description: 'Fonds und Wurst aus unserer Küche.',
    products: [
      {
        id: 'fond-rind',
        categoryId: 'hausgemacht',
        name: 'Rinderfond',
        subtitle: '750 ml',
        pricePerKg: 0,
        unit: 'bottle',
        estimatedPiecePrice: 9.5,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
        notePlaceholder: 'Optional: warm / gekühlt abholen …',
      },
      {
        id: 'fond-gefluegel',
        categoryId: 'hausgemacht',
        name: 'Geflügelfond',
        subtitle: '750 ml',
        pricePerKg: 0,
        unit: 'bottle',
        estimatedPiecePrice: 8.5,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
      },
      {
        id: 'leberwurst-glas',
        categoryId: 'hausgemacht',
        name: 'Galloway-Leberwurst im Glas',
        subtitle: 'Hausgemacht',
        pricePerKg: 0,
        unit: 'jar',
        estimatedPiecePrice: 7.9,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
      },
    ],
  },
  {
    id: 'bio-schwein',
    name: 'Bio-Schwein (Zukauf)',
    description: 'Bald verfügbar – Sortiment wird ergänzt.',
    placeholder: true,
    products: [
      {
        id: 'schwein-placeholder',
        categoryId: 'bio-schwein',
        name: 'Sortiment folgt',
        subtitle: 'Platzhalter',
        pricePerKg: 0,
        unit: 'kg',
        comingSoon: true,
        allowWeight: false,
        allowPieces: false,
        cutOptions: [],
        vacuumOptions: [],
      },
    ],
  },
  {
    id: 'wurst-aufschnitt',
    name: 'Frischetheke Wurst-Aufschnitt',
    description: 'Bald verfügbar – Aufschnitt nach Wunsch.',
    placeholder: true,
    products: [
      {
        id: 'wurst-placeholder',
        categoryId: 'wurst-aufschnitt',
        name: 'Aufschnitt folgt',
        subtitle: 'Platzhalter',
        pricePerKg: 0,
        unit: 'kg',
        comingSoon: true,
        allowWeight: false,
        allowPieces: false,
        cutOptions: [],
        vacuumOptions: [],
      },
    ],
  },
  {
    id: 'bio-kaese',
    name: 'Bio-Käsetheke',
    description: 'Bald verfügbar – Käse vom Hof & Partnern.',
    placeholder: true,
    products: [
      {
        id: 'kaese-placeholder',
        categoryId: 'bio-kaese',
        name: 'Käsetheke folgt',
        subtitle: 'Platzhalter',
        pricePerKg: 0,
        unit: 'kg',
        comingSoon: true,
        allowWeight: false,
        allowPieces: false,
        cutOptions: [],
        vacuumOptions: [],
      },
    ],
  },
]);

export function getCatalogCategories() {
  return ORDER_CATALOG;
}

export function getOrderableProducts() {
  return ORDER_CATALOG.flatMap((category) =>
    category.products.filter((product) => !product.comingSoon && !category.placeholder),
  );
}

export function findProductById(productId) {
  const id = String(productId || '').trim();
  if (!id) return null;
  for (const category of ORDER_CATALOG) {
    const match = category.products.find((product) => product.id === id);
    if (match) return { ...match, categoryName: category.name };
  }
  return null;
}

/**
 * Geschätzter Positionspreis (Abrechnung später nach Waage).
 * @param {CatalogProduct} product
 * @param {{ pieces?: number, weightKg?: number }} selection
 */
export function estimateLinePrice(product, selection = {}) {
  if (!product || product.comingSoon) return 0;

  if (product.unit === 'bottle' || product.unit === 'jar' || product.unit === 'pack' || product.unit === 'piece') {
    const pieces = Math.max(1, Number(selection.pieces) || product.defaultPieces || 1);
    const piecePrice = Number(product.estimatedPiecePrice) || 0;
    if (piecePrice > 0) return roundMoney(pieces * piecePrice);
    const weight = (Number(product.typicalWeightKg) || 0) * pieces;
    return roundMoney(weight * (Number(product.pricePerKg) || 0));
  }

  const weightKg = Number(selection.weightKg);
  if (Number.isFinite(weightKg) && weightKg > 0) {
    return roundMoney(weightKg * (Number(product.pricePerKg) || 0));
  }

  const pieces = Number(selection.pieces);
  if (Number.isFinite(pieces) && pieces > 0 && product.estimatedPiecePrice) {
    return roundMoney(pieces * product.estimatedPiecePrice);
  }

  if (Number.isFinite(pieces) && pieces > 0 && product.typicalWeightKg) {
    return roundMoney(pieces * product.typicalWeightKg * (Number(product.pricePerKg) || 0));
  }

  if (product.estimatedPiecePrice) return roundMoney(product.estimatedPiecePrice);
  if (product.typicalWeightKg && product.pricePerKg) {
    return roundMoney(product.typicalWeightKg * product.pricePerKg);
  }
  return 0;
}

export function formatEuro(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(value) ? value : 0);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** @param {Date} date */
export function toIsoDateLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** @param {string} isoDate @param {string} hhmm */
export function combineLocalDateTime(isoDate, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const [y, mo, d] = String(isoDate).split('-').map(Number);
  return new Date(y, mo - 1, d, h || 0, m || 0, 0, 0);
}

/** @param {Date} date */
function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** @param {Date} date @param {number} days */
function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** @param {string} hhmm */
function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Zeitfenster in Blöcken (Standard 2 Stunden; letzter Block bis close).
 * @param {string} fromHHmm
 * @param {string} toHHmm
 * @param {number} [blockMinutes]
 * @returns {PickupSlot[]}
 */
export function buildTimeBlocks(fromHHmm, toHHmm, blockMinutes = 120) {
  const startMin = hhmmToMinutes(fromHHmm);
  const endMin = hhmmToMinutes(toHHmm);
  if (!(endMin > startMin)) return [];

  /** @type {PickupSlot[]} */
  const slots = [];
  for (let cursor = startMin; cursor < endMin; cursor += blockMinutes) {
    const slotEnd = Math.min(cursor + blockMinutes, endMin);
    if (slotEnd <= cursor) break;
    const start = `${pad2(Math.floor(cursor / 60))}:${pad2(cursor % 60)}`;
    const end = `${pad2(Math.floor(slotEnd / 60))}:${pad2(slotEnd % 60)}`;
    slots.push({
      id: `${start}-${end}`,
      start,
      end,
      label: `${start} – ${end} Uhr`,
    });
  }
  return slots;
}

function weekdayLongDe(date) {
  return date.toLocaleDateString('de-DE', { weekday: 'long' });
}

function dayLabelDe(date) {
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * SB-Modus für einen Abholtag relativ zum Bestellzeitpunkt.
 * @param {Date} now
 * @param {Date} pickupDay
 * @returns {'same-day'|'standard'|'advance'|null}
 */
export function resolveSbMode(now, pickupDay) {
  const nowDay = startOfLocalDay(now);
  const pickupStart = startOfLocalDay(pickupDay);
  const dayDiffMs = pickupStart.getTime() - nowDay.getTime();
  const dayDiff = Math.round(dayDiffMs / 86400000);

  if (!SB_WEEKDAYS.has(pickupDay.getDay())) return null;

  if (dayDiff < 0) return null;

  if (dayDiff === 0) {
    const orderUntil = combineLocalDateTime(toIsoDateLocal(now), SB_SAME_DAY_ORDER_UNTIL);
    if (now.getTime() <= orderUntil.getTime()) return 'same-day';
    return null;
  }

  // Mehr als 24 Stunden Abstand zur Öffnung des Abholtages → volles Fenster
  const pickupOpen = combineLocalDateTime(toIsoDateLocal(pickupDay), SB_OPEN);
  const hoursUntilOpen = (pickupOpen.getTime() - now.getTime()) / 3600000;
  if (hoursUntilOpen > 24) return 'advance';

  // Folgetag / innerhalb 24h: Standard-Puffer ab 14:00
  return 'standard';
}

function sbWindowForMode(mode) {
  if (mode === 'same-day') {
    return {
      from: SB_SAME_DAY_FROM,
      to: SB_CLOSE,
      modeLabel: 'Same-Day (Notfall, Bestellung bis 11:00)',
    };
  }
  if (mode === 'advance') {
    return {
      from: SB_OPEN,
      to: SB_CLOSE,
      modeLabel: 'Vorbestellung (> 24 h) – volles Zeitfenster',
    };
  }
  return {
    from: SB_NEXT_DAY_FROM,
    to: SB_CLOSE,
    modeLabel: 'Standard – Abholung am Folgetag ab 14:00',
  };
}

/**
 * Bedientheke: kommende Freitage/Samstage mit offenen Restfenstern.
 * @param {Date} now
 * @param {number} [horizonDays]
 * @returns {PickupDay[]}
 */
function buildCounterDays(now, horizonDays = 28) {
  /** @type {PickupDay[]} */
  const days = [];
  const today = startOfLocalDay(now);

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(today, offset);
    const hours = COUNTER_HOURS[day.getDay()];
    if (!hours) continue;

    const iso = toIsoDateLocal(day);
    let from = hours.open;
    const to = hours.close;

    if (offset === 0) {
      // Gleichtag: nur noch zukünftige Blöcke, mind. ~60 Min Vorlauf
      const minStart = new Date(now.getTime() + 60 * 60 * 1000);
      const openAt = combineLocalDateTime(iso, hours.open);
      const closeAt = combineLocalDateTime(iso, hours.close);
      if (minStart.getTime() >= closeAt.getTime()) continue;
      const effective = minStart.getTime() > openAt.getTime() ? minStart : openAt;
      from = `${pad2(effective.getHours())}:${pad2(effective.getMinutes() < 30 ? 0 : 30)}`;
      if (hhmmToMinutes(from) >= hhmmToMinutes(to)) continue;
    }

    const slots = buildTimeBlocks(from, to, 90);
    if (!slots.length) continue;

    days.push({
      date: iso,
      label: dayLabelDe(day),
      weekday: weekdayLongDe(day),
      mode: 'counter',
      modeLabel: 'Bedientheke – persönliche Übergabe mit Kassenwägung',
      slots,
    });
  }

  return days;
}

/**
 * SB-Kühlschrank: So–Do mit Pufferregeln.
 * @param {Date} now
 * @param {number} [horizonDays]
 * @returns {PickupDay[]}
 */
function buildSbDays(now, horizonDays = 21) {
  /** @type {PickupDay[]} */
  const days = [];
  const today = startOfLocalDay(now);

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = addDays(today, offset);
    const mode = resolveSbMode(now, day);
    if (!mode) continue;

    const { from, to, modeLabel } = sbWindowForMode(mode);
    const slots = buildTimeBlocks(from, to, 120);
    if (!slots.length) continue;

    days.push({
      date: toIsoDateLocal(day),
      label: dayLabelDe(day),
      weekday: weekdayLongDe(day),
      mode,
      modeLabel,
      slots,
    });
  }

  return days;
}

/**
 * Dynamische Abholfenster für Bedientheke und SB-Kühlschrank.
 * @param {Date} [now]
 * @returns {AvailablePickupSlots}
 */
export function getAvailablePickupSlots(now = new Date()) {
  const reference = now instanceof Date && !Number.isNaN(now.getTime())
    ? now
    : new Date();

  return {
    generatedAt: reference.toISOString(),
    counter: buildCounterDays(reference),
    sb: buildSbDays(reference),
    channelLabels: { ...PICKUP_CHANNEL_LABELS },
  };
}

export default {
  ORDER_CATALOG,
  PICKUP_CHANNEL_LABELS,
  getCatalogCategories,
  getOrderableProducts,
  findProductById,
  estimateLinePrice,
  formatEuro,
  getAvailablePickupSlots,
  buildTimeBlocks,
  resolveSbMode,
  toIsoDateLocal,
};
