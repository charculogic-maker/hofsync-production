/**
 * Kunden-Vorbestellkatalog & Abhol-Slot-Berechnung (StevesHof Soft-Launch).
 * Sortiment aus Kassen-Warengruppen WG 460–465 inkl. realer €/kg-Preise.
 * Standalone-Nutzung über web/bestellen.html — ohne Firebase-Pflicht.
 */

/** @typedef {'counter'|'sb'} PickupChannel */

/**
 * @typedef {Object} CutOption
 * @property {string} id
 * @property {string} label
 * @property {string} [hint]
 * @property {number} [minWeightKgPerPiece] Mindestgewicht je Stück (z. B. Männercut)
 * @property {number} [minTotalWeightKg] Mindest-Gesamtgewicht der Position
 */

/**
 * @typedef {Object} VacuumOption
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {Object} PackSizeOption
 * @property {number} grams
 * @property {string} label
 */

/**
 * @typedef {Object} CatalogProduct
 * @property {string} id
 * @property {string} categoryId
 * @property {string} name
 * @property {string} [subtitle]
 * @property {string} [artNr] Kassen-Artikelnummer
 * @property {number} [wg] Warengruppe
 * @property {number} pricePerKg
 * @property {number} [originalPricePerKg] Streichpreis €/kg (Aktion)
 * @property {number} [fixedOriginalPrice] Streichpreis für Festpreis-Artikel (Gläser/Fonds)
 * @property {boolean} [active] Default true – false = im Kundenkatalog unsichtbar
 * @property {boolean} [soldOut] Default false – Badge + Button deaktiviert
 * @property {string} [badge] z. B. "Aktion", "Bestseller", "-15 %"
 * @property {'kg'|'piece'|'pack'|'jar'|'bottle'|'slice'} unit
 * @property {'per_piece'|'per_kg'|'fixed'|'slice_pack'} [pricingType]
 * @property {number} [typicalWeightKg] Stück- bzw. Packungsgewicht in kg
 * @property {number} [estimatedPiecePrice] Fixpreis/Stück (Fonds, Gläser)
 * @property {number[]} [packSizesGrams] Aufschnitt-Packungen in Gramm
 * @property {number} [defaultPackGrams]
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
 * @typedef {Object} CatalogOverride
 * @property {boolean} [active]
 * @property {boolean} [soldOut]
 * @property {number} [pricePerKg]
 * @property {number} [originalPricePerKg]
 * @property {number} [estimatedPiecePrice]
 * @property {number} [fixedOriginalPrice]
 * @property {string} [badge]
 */

/** localStorage-Key für Team-Overrides am Laden-iPhone */
export const CATALOG_OVERRIDES_STORAGE_KEY = 'sth_catalog_overrides';

/**
 * @typedef {Object} CatalogCategory
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {number} [wg]
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
  5: { open: '09:00', close: '18:30' },
  6: { open: '09:00', close: '13:00' },
};

export const SB_WEEKDAYS = new Set([0, 1, 2, 3, 4]);
export const SB_OPEN = '06:00';
export const SB_CLOSE = '22:00';
export const SB_SAME_DAY_ORDER_UNTIL = '11:00';
export const SB_SAME_DAY_FROM = '16:30';
export const SB_NEXT_DAY_FROM = '14:00';

export const DEFAULT_SLICE_PACK_GRAMS = [100, 150, 200, 250];

const VACUUM_DEFAULT = [
  { id: 'einzeln', label: 'Einzeln vakuumiert' },
  { id: 'zusammen', label: 'Zusammen vakuumiert' },
  { id: 'ohne', label: 'Ohne Extra-Vakuum' },
];

const VACUUM_LIGHT = [
  { id: 'vakuum', label: 'Vakuumiert' },
  { id: 'beutel', label: 'Im Beutel gekühlt' },
];

const SLICE_CUTS = [
  { id: 'hauchduenn', label: 'Hauchdünn' },
  { id: 'standard', label: 'Standard' },
  { id: 'rustikal', label: 'Rustikal' },
];

const STEAK_CUTS = [
  {
    id: '2-5cm',
    label: 'Klassisch (~2,5 cm)',
    minWeightKgPerPiece: 0.18,
    hint: 'ab ca. 180 g je Steak',
  },
  {
    id: '4cm',
    label: 'Männercut 4 cm',
    minWeightKgPerPiece: 0.55,
    hint: 'mind. ca. 550 g je Steak – sonst zu schmal für 4 cm',
  },
  {
    id: 'am-stueck',
    label: 'Am Stück',
    minTotalWeightKg: 0.7,
    hint: 'ab ca. 700 g am Stück sinnvoll',
  },
];

const ROULADEN_CUTS = [
  { id: 'duenn', label: 'Klassisch dünn geschnitten (ca. 180–200 g)' },
  { id: 'breit', label: 'Breiter Schnitt (für viel Füllung)' },
];

/**
 * @param {Partial<CatalogProduct> & { id: string, categoryId: string, name: string, pricePerKg: number }} base
 * @returns {CatalogProduct}
 */
function kgProduct(base) {
  return {
    unit: 'kg',
    pricingType: 'per_kg',
    active: true,
    soldOut: false,
    allowWeight: true,
    allowPieces: false,
    defaultWeightKg: base.defaultWeightKg ?? base.typicalWeightKg ?? 0.5,
    vacuumOptions: VACUUM_DEFAULT,
    notePlaceholder: 'Besonderer Wunsch an den Metzger …',
    ...base,
  };
}

/**
 * @param {Partial<CatalogProduct> & { id: string, categoryId: string, name: string, pricePerKg: number, typicalWeightKg: number }} base
 * @returns {CatalogProduct}
 */
function pieceProduct(base) {
  return {
    unit: 'kg',
    pricingType: 'per_piece',
    active: true,
    soldOut: false,
    allowWeight: false,
    allowPieces: true,
    defaultPieces: base.defaultPieces ?? 2,
    vacuumOptions: VACUUM_DEFAULT,
    notePlaceholder: 'Besonderer Wunsch an den Metzger …',
    ...base,
  };
}

/**
 * @param {Partial<CatalogProduct> & { id: string, categoryId: string, name: string, pricePerKg: number }} base
 * @returns {CatalogProduct}
 */
function sliceProduct(base) {
  return {
    unit: 'slice',
    pricingType: 'slice_pack',
    active: true,
    soldOut: false,
    allowWeight: false,
    allowPieces: false,
    packSizesGrams: DEFAULT_SLICE_PACK_GRAMS,
    defaultPackGrams: 100,
    cutOptions: SLICE_CUTS,
    vacuumOptions: [],
    notePlaceholder: 'z. B. bitte nicht zu dünn / extra rustikal …',
    ...base,
  };
}

/** Vollständiges StevesHof-Sortiment (Kassendaten WG 460–465) */
export const ORDER_CATALOG = /** @type {CatalogCategory[]} */ ([
  {
    id: 'bio-galloway',
    name: 'Bio-Galloway',
    wg: 460,
    description: 'WG 460 · Fleisch von unseren Bio-Galloways – Zuschnitt nach Wunsch.',
    products: [
      pieceProduct({
        id: 'gal-rumpsteak', categoryId: 'bio-galloway', artNr: '46001', wg: 460,
        name: 'Rumpsteak', subtitle: 'Dry-Aged', pricePerKg: 65.99, typicalWeightKg: 0.28,
        defaultPieces: 2, cutOptions: STEAK_CUTS, allowWeight: true, defaultWeightKg: 0.56,
      }),
      pieceProduct({
        id: 'gal-entrecote', categoryId: 'bio-galloway', artNr: '46002', wg: 460,
        name: 'Entrecôte', subtitle: 'Hochrippe / Ribeye', pricePerKg: 58.99, typicalWeightKg: 0.3,
        defaultPieces: 2, cutOptions: STEAK_CUTS, allowWeight: true, defaultWeightKg: 0.6,
      }),
      kgProduct({
        id: 'gal-hack', categoryId: 'bio-galloway', artNr: '46003', wg: 460,
        name: 'Hackfleisch', subtitle: 'Frisch gewolft', pricePerKg: 22.99, originalPricePerKg: 26.99,
        badge: 'Aktion', typicalWeightKg: 0.5,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [
          { id: 'beutel-500', label: '500 g Beutel' },
          { id: 'gross', label: 'Groß / lose' },
        ],
      }),
      kgProduct({
        id: 'gal-gulasch', categoryId: 'bio-galloway', artNr: '46004', wg: 460,
        name: 'Gulasch', subtitle: 'Zum Schmoren', pricePerKg: 31.99, typicalWeightKg: 1, defaultWeightKg: 1,
        cutOptions: [
          { id: '3x3', label: '3 × 3 cm Würfel' },
          { id: 'brocken', label: 'Brocken / grob' },
        ],
      }),
      pieceProduct({
        id: 'gal-rouladen', categoryId: 'bio-galloway', artNr: '46005', wg: 460,
        name: 'Rouladen', subtitle: 'Vom Oberwasser / Keule', pricePerKg: 39.99, typicalWeightKg: 0.18,
        defaultPieces: 4, cutOptions: ROULADEN_CUTS,
        notePlaceholder: 'z. B. bitte extra dünn schneiden oder leicht plattieren...',
      }),
      pieceProduct({
        id: 'gal-filet', categoryId: 'bio-galloway', artNr: '46006', wg: 460,
        name: 'Filet', subtitle: 'Klassisch', pricePerKg: 109.99, typicalWeightKg: 0.2,
        defaultPieces: 2, cutOptions: STEAK_CUTS, allowWeight: true, defaultWeightKg: 0.4,
      }),
      pieceProduct({
        id: 'gal-filet-premium', categoryId: 'bio-galloway', artNr: '46007', wg: 460,
        name: 'Filet Premium', subtitle: 'Dry-Aged / Spitzenqualität', pricePerKg: 139.99, typicalWeightKg: 0.2,
        defaultPieces: 2, cutOptions: STEAK_CUTS, allowWeight: true, defaultWeightKg: 0.4,
      }),
      pieceProduct({
        id: 'gal-hueftsteak', categoryId: 'bio-galloway', artNr: '46008', wg: 460,
        name: 'Hüftsteak', subtitle: 'Mager & aromatisch', pricePerKg: 49.99, typicalWeightKg: 0.22,
        defaultPieces: 2, cutOptions: STEAK_CUTS, allowWeight: true, defaultWeightKg: 0.44,
      }),
      kgProduct({
        id: 'gal-schmorbraten', categoryId: 'bio-galloway', artNr: '46009', wg: 460,
        name: 'Schmorbraten', pricePerKg: 29.99, typicalWeightKg: 1.2, defaultWeightKg: 1.2,
        cutOptions: [
          { id: 'am-stueck', label: 'Am Stück gebunden' },
          { id: 'scheiben', label: 'In Scheiben' },
        ],
      }),
      kgProduct({
        id: 'gal-braten-keule', categoryId: 'bio-galloway', artNr: '46010', wg: 460,
        name: 'Braten Keule', subtitle: 'Keulenbraten', pricePerKg: 33.99, typicalWeightKg: 1.2, defaultWeightKg: 1.2,
        cutOptions: [
          { id: 'am-stueck', label: 'Am Stück' },
          { id: 'scheiben', label: 'In Scheiben' },
        ],
      }),
      kgProduct({
        id: 'gal-tafelspitz', categoryId: 'bio-galloway', artNr: '46011', wg: 460,
        name: 'Tafelspitz', pricePerKg: 33.99, typicalWeightKg: 1, defaultWeightKg: 1,
        cutOptions: [
          { id: 'am-stueck', label: 'Am Stück' },
          { id: 'scheiben', label: 'In Scheiben' },
        ],
      }),
      pieceProduct({
        id: 'gal-flanksteak', categoryId: 'bio-galloway', artNr: '46012', wg: 460,
        name: 'Flanksteak', pricePerKg: 41.99, typicalWeightKg: 0.5,
        defaultPieces: 1, cutOptions: [
          { id: 'am-stueck', label: 'Am Stück' },
          { id: 'streifen', label: 'In Streifen' },
        ],
        allowWeight: true, defaultWeightKg: 0.5,
      }),
      pieceProduct({
        id: 'gal-beinscheibe', categoryId: 'bio-galloway', artNr: '46013', wg: 460,
        name: 'Beinscheibe', subtitle: 'Mit Markknochen', pricePerKg: 22.99, typicalWeightKg: 0.4,
        defaultPieces: 2, cutOptions: [{ id: 'scheibe', label: 'Scheibe mit Knochen' }],
        allowWeight: true, defaultWeightKg: 0.8,
      }),
      kgProduct({
        id: 'gal-baeckchen', categoryId: 'bio-galloway', artNr: '46014', wg: 460,
        name: 'Bäckchen', subtitle: 'Rinderbäckchen', pricePerKg: 45.99, typicalWeightKg: 0.6, defaultWeightKg: 0.6,
        cutOptions: [{ id: 'ganz', label: 'Ganz / portioniert' }],
      }),
      kgProduct({
        id: 'gal-patties', categoryId: 'bio-galloway', artNr: '46015', wg: 460,
        name: 'Patties', subtitle: 'Burger-Patties', pricePerKg: 27.99, typicalWeightKg: 0.5,
        allowPieces: true, defaultPieces: 4, defaultWeightKg: 0.5,
        cutOptions: [
          { id: '120g', label: 'ca. 120 g / Patty' },
          { id: '180g', label: 'ca. 180 g / Patty' },
        ],
      }),
      kgProduct({
        id: 'gal-knochen', categoryId: 'bio-galloway', artNr: '46016', wg: 460,
        name: 'Knochen', subtitle: 'Brühe / Hundeknochen', pricePerKg: 4.99, typicalWeightKg: 1, defaultWeightKg: 1,
        cutOptions: [
          { id: 'bruehe', label: 'Für Brühe' },
          { id: 'mark', label: 'Mit Mark' },
        ],
        vacuumOptions: VACUUM_LIGHT,
      }),
    ],
  },
  {
    id: 'bio-schwein',
    name: 'Bio-Schwein (Zukauf)',
    wg: 462,
    description: 'WG 462 · Bio-Schwein vom Partnerbetrieb.',
    products: [
      pieceProduct({
        id: 'sw-schnitzel', categoryId: 'bio-schwein', artNr: '46201', wg: 462,
        name: 'Schnitzel', pricePerKg: 35.99, typicalWeightKg: 0.15, defaultPieces: 4,
        cutOptions: [
          { id: 'plattiert', label: 'Plattiert' },
          { id: 'natur', label: 'Natur / unplattiert' },
        ],
      }),
      pieceProduct({
        id: 'sw-filet', categoryId: 'bio-schwein', artNr: '46202', wg: 462,
        name: 'Filet', pricePerKg: 59.99, typicalWeightKg: 0.4, defaultPieces: 1,
        cutOptions: [
          { id: 'ganz', label: 'Ganz' },
          { id: 'medaillons', label: 'Medaillons' },
        ],
        allowWeight: true, defaultWeightKg: 0.4,
      }),
      pieceProduct({
        id: 'sw-kotelett', categoryId: 'bio-schwein', artNr: '46203', wg: 462,
        name: 'Koteletts', subtitle: 'Klassisch', pricePerKg: 27.99, typicalWeightKg: 0.22, defaultPieces: 4,
        cutOptions: [
          { id: '2cm', label: 'ca. 2 cm' },
          { id: '3cm', label: 'ca. 3 cm' },
        ],
      }),
      pieceProduct({
        id: 'sw-kotelett-knochen', categoryId: 'bio-schwein', artNr: '46204', wg: 462,
        name: 'Koteletts mit Knochen', pricePerKg: 29.99, typicalWeightKg: 0.25, defaultPieces: 4,
        cutOptions: [
          { id: '2cm', label: 'ca. 2 cm' },
          { id: '3cm', label: 'ca. 3 cm' },
        ],
      }),
      kgProduct({
        id: 'sw-krustenbraten', categoryId: 'bio-schwein', artNr: '46205', wg: 462,
        name: 'Krustenbraten', pricePerKg: 29.99, typicalWeightKg: 1.2, defaultWeightKg: 1.2,
        cutOptions: [{ id: 'am-stueck', label: 'Am Stück mit Schwarte' }],
      }),
      pieceProduct({
        id: 'sw-nackensteaks', categoryId: 'bio-schwein', artNr: '46206', wg: 462,
        name: 'Nackensteaks', pricePerKg: 29.99, typicalWeightKg: 0.2, defaultPieces: 4,
        cutOptions: [
          { id: '2cm', label: 'ca. 2 cm' },
          { id: '3cm', label: 'ca. 3 cm' },
        ],
      }),
      kgProduct({
        id: 'sw-spareribs', categoryId: 'bio-schwein', artNr: '46207', wg: 462,
        name: 'Spare Ribs', pricePerKg: 24.99, typicalWeightKg: 0.8, defaultWeightKg: 0.8,
        cutOptions: [{ id: 'rack', label: 'Als Rack' }],
      }),
      kgProduct({
        id: 'sw-gyros', categoryId: 'bio-schwein', artNr: '46208', wg: 462,
        name: 'Gyros', pricePerKg: 36.99, typicalWeightKg: 0.5, defaultWeightKg: 0.5,
        cutOptions: [{ id: 'gewuerzt', label: 'Gewürzt, fertig zum Braten' }],
      }),
      kgProduct({
        id: 'sw-mett', categoryId: 'bio-schwein', artNr: '46209', wg: 462,
        name: 'Hülser Mett', subtitle: 'Frisch', pricePerKg: 22.99, typicalWeightKg: 0.25, defaultWeightKg: 0.25,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [
          { id: '250g', label: '250 g' },
          { id: '500g', label: '500 g' },
        ],
      }),
    ],
  },
  {
    id: 'weidegefluegel',
    name: 'Weidegeflügel StevesHof',
    wg: 465,
    description: 'WG 465 · Eigene Schlachtung – Weidehühner vom Hof.',
    products: [
      pieceProduct({
        id: 'huhn-ganz', categoryId: 'weidegefluegel', artNr: '46501', wg: 465,
        name: 'Ganzes Hähnchen', subtitle: '~1,6 kg', pricePerKg: 17.49, typicalWeightKg: 1.6,
        unit: 'piece', defaultPieces: 1, cutOptions: [{ id: 'ganz', label: 'Ganz (ofenfertig)' }],
        vacuumOptions: VACUUM_LIGHT,
      }),
      pieceProduct({
        id: 'huhn-brust', categoryId: 'weidegefluegel', artNr: '46502', wg: 465,
        name: 'Brustfilet', pricePerKg: 47.99, typicalWeightKg: 0.35, defaultPieces: 2,
        cutOptions: [
          { id: 'ganz', label: 'Ganzes Filet' },
          { id: 'streifen', label: 'In Streifen' },
        ],
        allowWeight: true, defaultWeightKg: 0.7,
      }),
      pieceProduct({
        id: 'huhn-keulen', categoryId: 'weidegefluegel', artNr: '46503', wg: 465,
        name: 'Keulen', subtitle: '2er-Pack', pricePerKg: 19.99, typicalWeightKg: 0.55,
        unit: 'pack', defaultPieces: 1, cutOptions: [{ id: '2er', label: '2er-Pack Keulen' }],
      }),
      kgProduct({
        id: 'huhn-fluegel', categoryId: 'weidegefluegel', artNr: '46504', wg: 465,
        name: 'Flügel', pricePerKg: 16.99, typicalWeightKg: 0.5, defaultWeightKg: 0.5,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: 'ganz', label: 'Ganze Flügel' }],
      }),
      pieceProduct({
        id: 'huhn-suppe', categoryId: 'weidegefluegel', artNr: '46505', wg: 465,
        name: 'Suppenhuhn', pricePerKg: 13.99, typicalWeightKg: 1.4, unit: 'piece', defaultPieces: 1,
        cutOptions: [
          { id: 'ganz', label: 'Ganz' },
          { id: 'geteilt', label: 'Geteilt' },
        ],
        vacuumOptions: VACUUM_LIGHT,
      }),
    ],
  },
  {
    id: 'wurst-aufschnitt',
    name: 'Wurst & Aufschnitt',
    wg: 461,
    description: 'WG 461 · Aufschnitt nach Wunsch – Packungsgröße und Schnittstärke wählbar.',
    products: [
      sliceProduct({
        id: 'ws-kochschinken', categoryId: 'wurst-aufschnitt', artNr: '46101', wg: 461,
        name: 'Hausgemachter Kochschinken', pricePerKg: 39.99, originalPricePerKg: 46.99,
        badge: '-15 %',
      }),
      sliceProduct({
        id: 'ws-gal-kochschinken', categoryId: 'wurst-aufschnitt', artNr: '46102', wg: 461,
        name: 'Galloway Kochschinken', pricePerKg: 54.99,
      }),
      sliceProduct({
        id: 'ws-roastbeef', categoryId: 'wurst-aufschnitt', artNr: '46103', wg: 461,
        name: 'Roastbeef Aufschnitt', pricePerKg: 59.99,
      }),
      sliceProduct({
        id: 'ws-pastrami', categoryId: 'wurst-aufschnitt', artNr: '46104', wg: 461,
        name: 'Pastrami', pricePerKg: 63.99,
      }),
      sliceProduct({
        id: 'ws-lyoner', categoryId: 'wurst-aufschnitt', artNr: '46105', wg: 461,
        name: 'Lyoner', pricePerKg: 36.99,
      }),
      sliceProduct({
        id: 'ws-bierschinken', categoryId: 'wurst-aufschnitt', artNr: '46106', wg: 461,
        name: 'Bierschinken', pricePerKg: 36.99,
      }),
      sliceProduct({
        id: 'ws-salami', categoryId: 'wurst-aufschnitt', artNr: '46107', wg: 461,
        name: 'Galloway Salami', pricePerKg: 54.99,
      }),
      kgProduct({
        id: 'ws-fleischwurst', categoryId: 'wurst-aufschnitt', artNr: '46108', wg: 461,
        name: 'Fleischwurst im Ring', pricePerKg: 29.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: 'ring', label: 'Ganzer Ring' }],
        vacuumOptions: VACUUM_LIGHT,
      }),
      sliceProduct({
        id: 'ws-nussschinken', categoryId: 'wurst-aufschnitt', artNr: '46109', wg: 461,
        name: 'Nussschinken', pricePerKg: 49.99,
      }),
      sliceProduct({
        id: 'ws-pancetta', categoryId: 'wurst-aufschnitt', artNr: '46110', wg: 461,
        name: 'Pancetta', pricePerKg: 79.9,
      }),
    ],
  },
  {
    id: 'bratwurst-grill',
    name: 'Bratwurst & Grill',
    wg: 461,
    description: 'WG 461 · Frische Bratwürste und Grillwaren vom Hof.',
    products: [
      kgProduct({
        id: 'bw-gal-bratwurst', categoryId: 'bratwurst-grill', artNr: '46121', wg: 461,
        name: 'Galloway Bratwurst', pricePerKg: 31.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [
          { id: '4er', label: '4er-Pack' },
          { id: '6er', label: '6er-Pack' },
        ],
      }),
      kgProduct({
        id: 'bw-griller', categoryId: 'bratwurst-grill', artNr: '46122', wg: 461,
        name: 'StevesHof Griller', pricePerKg: 29.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [
          { id: '4er', label: '4er-Pack' },
          { id: '6er', label: '6er-Pack' },
        ],
      }),
      kgProduct({
        id: 'bw-salsiccia', categoryId: 'bratwurst-grill', artNr: '46123', wg: 461,
        name: 'Salsiccia', pricePerKg: 29.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: '4er', label: '4er-Pack' }],
      }),
      kgProduct({
        id: 'bw-merguez', categoryId: 'bratwurst-grill', artNr: '46124', wg: 461,
        name: 'Merguez', pricePerKg: 34.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: '4er', label: '4er-Pack' }],
      }),
      kgProduct({
        id: 'bw-pfefferbeisser', categoryId: 'bratwurst-grill', artNr: '46125', wg: 461,
        name: 'Pfefferbeißer', pricePerKg: 43.99, typicalWeightKg: 0.25, defaultWeightKg: 0.25,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: 'pack', label: 'Packung' }],
      }),
      kgProduct({
        id: 'bw-wiener', categoryId: 'bratwurst-grill', artNr: '46126', wg: 461,
        name: 'Wiener', pricePerKg: 31.99, typicalWeightKg: 0.3, defaultWeightKg: 0.3,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: '6er', label: '6er-Pack' }],
      }),
      kgProduct({
        id: 'bw-kaesekrainer', categoryId: 'bratwurst-grill', artNr: '46127', wg: 461,
        name: 'Käsekrainer', pricePerKg: 26.99, typicalWeightKg: 0.4, defaultWeightKg: 0.4,
        allowPieces: true, defaultPieces: 1,
        cutOptions: [{ id: '4er', label: '4er-Pack' }],
      }),
    ],
  },
  {
    id: 'lamm-wild',
    name: 'Lamm & Wild',
    wg: 463,
    description: 'Lamm und Wild – saisonal / Zukauf.',
    products: [
      pieceProduct({
        id: 'lw-lammkotelett', categoryId: 'lamm-wild', artNr: '46301', wg: 463,
        name: 'Lammkotelett', pricePerKg: 51.99, typicalWeightKg: 0.12, defaultPieces: 4,
        cutOptions: [
          { id: '2cm', label: 'ca. 2 cm' },
          { id: '3cm', label: 'ca. 3 cm' },
        ],
      }),
      kgProduct({
        id: 'lw-lammbraten', categoryId: 'lamm-wild', artNr: '46302', wg: 463,
        name: 'Lammbraten', pricePerKg: 49.99, typicalWeightKg: 1, defaultWeightKg: 1,
        cutOptions: [{ id: 'am-stueck', label: 'Am Stück' }],
      }),
      kgProduct({
        id: 'lw-wild-gulasch', categoryId: 'lamm-wild', artNr: '46303', wg: 463,
        name: 'Wild-Gulasch', pricePerKg: 25.99, typicalWeightKg: 1, defaultWeightKg: 1,
        cutOptions: [
          { id: '3x3', label: '3 × 3 cm Würfel' },
          { id: 'brocken', label: 'Brocken' },
        ],
      }),
    ],
  },
  {
    id: 'hausgemacht',
    name: 'Hausgemachtes & Gläser',
    wg: 466,
    description: 'Fonds und Wurst im Glas aus unserer Küche.',
    products: [
      {
        id: 'hm-rinderfond',
        categoryId: 'hausgemacht',
        artNr: '46601',
        wg: 466,
        name: 'Rinderfond',
        subtitle: '750 ml',
        pricePerKg: 0,
        unit: 'bottle',
        pricingType: 'fixed',
        active: true,
        soldOut: false,
        estimatedPiecePrice: 5.9,
        fixedOriginalPrice: 6.9,
        badge: 'Aktion',
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
      },
      {
        id: 'hm-gefluegelfond',
        categoryId: 'hausgemacht',
        artNr: '46602',
        wg: 466,
        name: 'Geflügelfond',
        subtitle: '750 ml',
        pricePerKg: 0,
        unit: 'bottle',
        pricingType: 'fixed',
        estimatedPiecePrice: 6.5,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
      },
      {
        id: 'hm-leberwurst',
        categoryId: 'hausgemacht',
        artNr: '46603',
        wg: 466,
        name: 'Leberwurst im Glas',
        subtitle: 'Galloway',
        pricePerKg: 0,
        unit: 'jar',
        pricingType: 'fixed',
        estimatedPiecePrice: 4.8,
        allowWeight: false,
        allowPieces: true,
        defaultPieces: 1,
        cutOptions: [],
        vacuumOptions: [],
      },
    ],
  },
]);

export function getCatalogCategories() {
  return ORDER_CATALOG;
}

export function isProductActive(product) {
  return product?.active !== false;
}

export function isProductSoldOut(product) {
  return product?.soldOut === true;
}

export function hasPromoPrice(product) {
  if (!product) return false;
  const type = resolvePricingType(product);
  if (type === 'fixed') {
    const current = Number(product.estimatedPiecePrice) || 0;
    const original = Number(product.fixedOriginalPrice) || 0;
    return original > 0 && current > 0 && original > current;
  }
  const current = Number(product.pricePerKg) || 0;
  const original = Number(product.originalPricePerKg) || 0;
  return original > 0 && current > 0 && original > current;
}

/**
 * @param {CatalogProduct} product
 * @param {CatalogOverride|null|undefined} override
 * @returns {CatalogProduct}
 */
export function applyProductOverride(product, override) {
  if (!product) return product;
  if (!override || typeof override !== 'object') return { ...product };
  const next = { ...product };
  if (typeof override.active === 'boolean') next.active = override.active;
  if (typeof override.soldOut === 'boolean') next.soldOut = override.soldOut;
  if (Number.isFinite(Number(override.pricePerKg)) && Number(override.pricePerKg) >= 0) {
    next.pricePerKg = Number(override.pricePerKg);
  }
  if (Number.isFinite(Number(override.originalPricePerKg)) && Number(override.originalPricePerKg) > 0) {
    next.originalPricePerKg = Number(override.originalPricePerKg);
  }
  if (Number.isFinite(Number(override.estimatedPiecePrice)) && Number(override.estimatedPiecePrice) >= 0) {
    next.estimatedPiecePrice = Number(override.estimatedPiecePrice);
  }
  if (Number.isFinite(Number(override.fixedOriginalPrice)) && Number(override.fixedOriginalPrice) > 0) {
    next.fixedOriginalPrice = Number(override.fixedOriginalPrice);
  }
  if (typeof override.badge === 'string') next.badge = override.badge;
  return next;
}

/**
 * @param {Record<string, CatalogOverride>|null|undefined} overrides
 * @param {{ includeInactive?: boolean }} [options]
 */
export function getVisibleCatalog(overrides = null, options = {}) {
  const includeInactive = options.includeInactive === true;
  return ORDER_CATALOG.map((category) => ({
    ...category,
    products: category.products
      .map((product) => applyProductOverride(product, overrides?.[product.id]))
      .filter((product) => {
        if (product.comingSoon || category.placeholder) return includeInactive;
        if (!includeInactive && !isProductActive(product)) return false;
        return true;
      }),
  })).filter((category) => category.products.length > 0 || includeInactive);
}

export function getOrderableProducts(overrides = null) {
  return getVisibleCatalog(overrides, { includeInactive: false })
    .flatMap((category) => category.products)
    .filter((product) => !product.comingSoon && isProductActive(product));
}

export function findProductById(productId, overrides = null) {
  const id = String(productId || '').trim();
  if (!id) return null;
  for (const category of ORDER_CATALOG) {
    const match = category.products.find((product) => product.id === id);
    if (match) {
      const merged = applyProductOverride(match, overrides?.[id]);
      return { ...merged, categoryName: category.name, categoryWg: category.wg };
    }
  }
  return null;
}

/**
 * Prüft, ob Stückzahl/Gewicht zum gewählten Zuschnitt passen (Metzgerei-Realität).
 * @param {CatalogProduct|null|undefined} product
 * @param {{ pieces?: number, weightKg?: number, cutId?: string }} selection
 * @returns {{ ok: boolean, message?: string, minWeightKg?: number }}
 */
export function validateCutSelection(product, selection = {}) {
  if (!product) return { ok: false, message: 'Artikel nicht gefunden.' };

  const piecesRaw = Number(selection.pieces);
  const pieces = Number.isFinite(piecesRaw) && piecesRaw > 0
    ? piecesRaw
    : (product.defaultPieces || 1);
  const weightRaw = Number(selection.weightKg);
  const hasWeight = Number.isFinite(weightRaw) && weightRaw > 0;
  const cutId = String(selection.cutId || '').trim();
  const cut = (product.cutOptions || []).find((option) => option.id === cutId) || null;

  if (!cut) return { ok: true };

  const minPerPiece = Number(cut.minWeightKgPerPiece) || 0;
  const minTotal = Number(cut.minTotalWeightKg) || 0;

  if (minPerPiece > 0) {
    const requiredTotal = roundMoneyKg(minPerPiece * pieces);
    const effectiveWeight = hasWeight
      ? weightRaw
      : roundMoneyKg((Number(product.typicalWeightKg) || 0) * pieces);

    if (!(effectiveWeight + 1e-9 >= requiredTotal)) {
      const perLabel = String(minPerPiece).replace('.', ',');
      return {
        ok: false,
        minWeightKg: requiredTotal,
        message: `„${cut.label}“ braucht mind. ca. ${perLabel} kg je Stück `
          + `(bei ${pieces}× also ca. ${String(requiredTotal).replace('.', ',')} kg). `
          + 'Sonst wird der Zuschnitt an der Theke zu schmal.',
      };
    }
  }

  if (minTotal > 0) {
    const effectiveWeight = hasWeight
      ? weightRaw
      : roundMoneyKg((Number(product.typicalWeightKg) || 0) * pieces);
    if (!(effectiveWeight + 1e-9 >= minTotal)) {
      return {
        ok: false,
        minWeightKg: minTotal,
        message: `„${cut.label}“ bitte ab ca. ${String(minTotal).replace('.', ',')} kg bestellen.`,
      };
    }
  }

  return { ok: true };
}

function roundMoneyKg(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** @param {unknown} raw */
export function normalizeCatalogOverrides(raw) {
  if (!raw || typeof raw !== 'object') return {};
  /** @type {Record<string, CatalogOverride>} */
  const out = {};
  Object.entries(raw).forEach(([productId, value]) => {
    if (!productId || !value || typeof value !== 'object') return;
    /** @type {CatalogOverride} */
    const entry = {};
    if (typeof value.active === 'boolean') entry.active = value.active;
    if (typeof value.soldOut === 'boolean') entry.soldOut = value.soldOut;
    if (Number.isFinite(Number(value.pricePerKg))) entry.pricePerKg = Number(value.pricePerKg);
    if (Number.isFinite(Number(value.originalPricePerKg))) entry.originalPricePerKg = Number(value.originalPricePerKg);
    if (Number.isFinite(Number(value.estimatedPiecePrice))) entry.estimatedPiecePrice = Number(value.estimatedPiecePrice);
    if (Number.isFinite(Number(value.fixedOriginalPrice))) entry.fixedOriginalPrice = Number(value.fixedOriginalPrice);
    if (typeof value.badge === 'string') entry.badge = value.badge;
    out[productId] = entry;
  });
  return out;
}

export function readCatalogOverridesFromStorage(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(CATALOG_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    return normalizeCatalogOverrides(JSON.parse(raw));
  } catch (err) {
    console.error('[orderCatalog] Overrides konnten nicht gelesen werden:', err);
    return {};
  }
}

export function writeCatalogOverridesToStorage(overrides, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(CATALOG_OVERRIDES_STORAGE_KEY, JSON.stringify(normalizeCatalogOverrides(overrides)));
    return true;
  } catch (err) {
    console.error('[orderCatalog] Overrides konnten nicht gespeichert werden:', err);
    return false;
  }
}

/**
 * @param {CatalogProduct} product
 * @returns {'per_piece'|'per_kg'|'fixed'|'slice_pack'}
 */
export function resolvePricingType(product) {
  if (!product) return 'per_kg';
  if (
    product.pricingType === 'per_piece'
    || product.pricingType === 'per_kg'
    || product.pricingType === 'fixed'
    || product.pricingType === 'slice_pack'
  ) {
    return product.pricingType;
  }
  if (product.unit === 'bottle' || product.unit === 'jar') return 'fixed';
  if (product.unit === 'slice') return 'slice_pack';
  if (product.allowWeight === false && product.allowPieces !== false) return 'per_piece';
  if (product.unit === 'piece' || product.unit === 'pack') return 'per_piece';
  return 'per_kg';
}

/** @param {CatalogProduct} product */
export function getPackSizeOptions(product) {
  const sizes = Array.isArray(product?.packSizesGrams) && product.packSizesGrams.length
    ? product.packSizesGrams
    : DEFAULT_SLICE_PACK_GRAMS;
  return sizes.map((grams) => ({
    grams,
    label: `${grams} g`,
    id: String(grams),
  }));
}

/**
 * Grundpreis-Anzeige z. B. "4,70 € / 100 g (46,99 €/kg)".
 * @param {CatalogProduct} product
 * @param {number} [grams=100]
 */
export function formatSlicePackPriceLabel(product, grams = 100) {
  const perKg = Number(product?.pricePerKg) || 0;
  const packGrams = Number(grams) > 0 ? Number(grams) : 100;
  const packPrice = roundMoney((packGrams / 1000) * perKg);
  if (hasPromoPrice(product)) {
    const originalPerKg = Number(product.originalPricePerKg) || 0;
    const originalPack = roundMoney((packGrams / 1000) * originalPerKg);
    return `${formatEuro(packPrice)} / ${packGrams} g (${formatEuro(perKg)}/kg) · statt ${formatEuro(originalPack)}`;
  }
  return `${formatEuro(packPrice)} / ${packGrams} g (${formatEuro(perKg)}/kg)`;
}

/**
 * Strukturierte Preiszeile für Karten (Aktion inkl. Streichpreis).
 * @param {CatalogProduct} product
 * @returns {{ currentHtml: string, originalHtml: string, isPromo: boolean, badge: string }}
 */
export function describeProductPrice(product) {
  const pricingType = resolvePricingType(product);
  const isPromo = hasPromoPrice(product);
  const badge = String(product?.badge || (isPromo ? 'Aktion' : '')).trim();

  if (pricingType === 'slice_pack') {
    const grams = Number(product.defaultPackGrams) || 100;
    const perKg = Number(product.pricePerKg) || 0;
    const packPrice = roundMoney((grams / 1000) * perKg);
    const currentHtml = `${formatEuro(packPrice)} / ${grams} g <span class="text-xs font-medium opacity-80">(${formatEuro(perKg)}/kg)</span>`;
    let originalHtml = '';
    if (isPromo) {
      const originalPerKg = Number(product.originalPricePerKg) || 0;
      const originalPack = roundMoney((grams / 1000) * originalPerKg);
      originalHtml = `${formatEuro(originalPack)} / ${grams} g`;
    }
    return { currentHtml, originalHtml, isPromo, badge };
  }

  if (pricingType === 'fixed') {
    const current = Number(product.estimatedPiecePrice) || 0;
    const currentHtml = `${formatEuro(current)} / Stück`;
    const originalHtml = isPromo ? `${formatEuro(Number(product.fixedOriginalPrice) || 0)} / Stück` : '';
    return { currentHtml, originalHtml, isPromo, badge };
  }

  const unitPrice = estimateUnitPrice(product);
  const pieceHint = (pricingType === 'per_piece' && unitPrice > 0)
    ? ` <span class="text-xs font-medium opacity-80">· ca. ${formatEuro(unitPrice)} / Stück</span>`
    : '';
  const currentHtml = `${formatEuro(Number(product.pricePerKg) || 0)} / kg${pieceHint}`;
  let originalHtml = '';
  if (isPromo) {
    originalHtml = `${formatEuro(Number(product.originalPricePerKg) || 0)} / kg`;
  }
  return { currentHtml, originalHtml, isPromo, badge };
}

/** Geschätzter Einzelpreis je Stück/100 g-Packung (Kartenanzeige). */
export function estimateUnitPrice(product) {
  if (!product || product.comingSoon) return 0;
  const type = resolvePricingType(product);
  if (type === 'fixed') return roundMoney(Number(product.estimatedPiecePrice) || 0);
  if (type === 'slice_pack') {
    const grams = Number(product.defaultPackGrams) || 100;
    return roundMoney((grams / 1000) * (Number(product.pricePerKg) || 0));
  }
  const pieceWeight = Number(product.typicalWeightKg) || 0;
  const perKg = Number(product.pricePerKg) || 0;
  if (pieceWeight > 0 && perKg > 0) return roundMoney(pieceWeight * perKg);
  return roundMoney(Number(product.estimatedPiecePrice) || 0);
}

/**
 * Geschätzter Positionspreis.
 * slice_pack: (Gramm / 1000) × €/kg
 * @param {CatalogProduct} product
 * @param {{ pieces?: number, weightKg?: number, packGrams?: number }} selection
 */
export function estimateLinePrice(product, selection = {}) {
  if (!product || product.comingSoon) return 0;

  const type = resolvePricingType(product);
  const piecesRaw = Number(selection.pieces);
  const pieces = Number.isFinite(piecesRaw) && piecesRaw > 0
    ? piecesRaw
    : (product.defaultPieces || 1);
  const weightRaw = Number(selection.weightKg);
  const hasTotalWeight = Number.isFinite(weightRaw) && weightRaw > 0;
  const perKg = Number(product.pricePerKg) || 0;
  const pieceWeight = Number(product.typicalWeightKg) || 0;

  if (type === 'fixed') {
    const unit = Number(product.estimatedPiecePrice) || 0;
    return roundMoney(pieces * unit);
  }

  if (type === 'slice_pack') {
    const gramsRaw = Number(selection.packGrams);
    const grams = Number.isFinite(gramsRaw) && gramsRaw > 0
      ? gramsRaw
      : (Number(product.defaultPackGrams) || 100);
    return roundMoney((grams / 1000) * perKg);
  }

  if (type === 'per_piece') {
    if (product.allowWeight !== false && hasTotalWeight) {
      return roundMoney(weightRaw * perKg);
    }
    const unit = estimateUnitPrice(product);
    if (unit > 0) return roundMoney(pieces * unit);
    return 0;
  }

  if (hasTotalWeight) {
    return roundMoney(weightRaw * perKg);
  }
  if (pieceWeight > 0 && perKg > 0) {
    return roundMoney(pieces * pieceWeight * perKg);
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

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

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

export function resolveSbMode(now, pickupDay) {
  const nowDay = startOfLocalDay(now);
  const pickupStart = startOfLocalDay(pickupDay);
  const dayDiff = Math.round((pickupStart.getTime() - nowDay.getTime()) / 86400000);

  if (!SB_WEEKDAYS.has(pickupDay.getDay())) return null;
  if (dayDiff < 0) return null;

  if (dayDiff === 0) {
    const orderUntil = combineLocalDateTime(toIsoDateLocal(now), SB_SAME_DAY_ORDER_UNTIL);
    if (now.getTime() <= orderUntil.getTime()) return 'same-day';
    return null;
  }

  const pickupOpen = combineLocalDateTime(toIsoDateLocal(pickupDay), SB_OPEN);
  const hoursUntilOpen = (pickupOpen.getTime() - now.getTime()) / 3600000;
  if (hoursUntilOpen > 24) return 'advance';
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
  DEFAULT_SLICE_PACK_GRAMS,
  CATALOG_OVERRIDES_STORAGE_KEY,
  getCatalogCategories,
  getVisibleCatalog,
  getOrderableProducts,
  findProductById,
  validateCutSelection,
  isProductActive,
  isProductSoldOut,
  hasPromoPrice,
  applyProductOverride,
  normalizeCatalogOverrides,
  readCatalogOverridesFromStorage,
  writeCatalogOverridesToStorage,
  resolvePricingType,
  getPackSizeOptions,
  formatSlicePackPriceLabel,
  describeProductPrice,
  estimateUnitPrice,
  estimateLinePrice,
  formatEuro,
  getAvailablePickupSlots,
  buildTimeBlocks,
  resolveSbMode,
  toIsoDateLocal,
};
