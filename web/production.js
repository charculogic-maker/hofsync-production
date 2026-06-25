// Wurstkueche-, Rezept- und Chargen-Modul

import {
  getGlobalTenantId,
  getTenantCollection,
  getTenantCollectionPath,
  tenantIdsMatch,
} from './tenant-db.js';

const STEVESHOF_TENANT_ID = 'StevesHof_Hauptbetrieb';
const EIGENPRODUKTION_SUPPLIER = 'Eigenproduktion';
const EIGENPRODUKTION_SOURCE = 'eigenproduktion';

const productionState = {
  db: null,
  tenantId: '',
  recipes: [],
  recipeSearchQuery: '',
  recipeCategoryFilter: 'all',
  selectedRecipeId: null,
  activeRecipeDetail: null,
  activeRecipeDataSource: 'local',
  productionTargetKg: 10.0,
  productionBatches: [],
  batchSearchQuery: '',
  recipeCloudAudit: null,
  activeTab: 'kitchen',
  recipesUnsubscribe: null,
  productionBatchesUnsubscribe: null,
  writeOrQueueFirestore: async () => { throw new Error('Production Sync-Engine ist nicht initialisiert.'); },
  playClickSound: () => {},
  showHUD: () => {},
  getFirebase: () => null,
  onFormSaved: () => {},
  restoreDraftFields: () => 0,
  initialized: false,
  batchDocumentInFlight: false,
  getAuditActorName: () => '',
};

function shouldUseBratwurstMasterlist() {
  const brandingFlag = window.BRANDING?.modules?.bratwurstMasterlist;
  if (brandingFlag === true) return true;
  if (brandingFlag === false) return false;
  const tenantId = getGlobalTenantId() || String(productionState.tenantId || '').trim();
  return tenantIdsMatch(tenantId, STEVESHOF_TENANT_ID);
}

function isProductionAdmin() {
  return document.documentElement?.dataset?.userRole === 'admin';
}

function mhdListeCollectionPath() {
  try {
    return getTenantCollectionPath('mhd_liste');
  } catch {
    return null;
  }
}

function formatIsoDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToToday(days) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return base;
}

function slugRecipeIdFromName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  const slug = trimmed
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9ÄÖÜäöüß\-]+/g, '')
    .slice(0, 80);
  return getSafeFirestoreId(slug || trimmed);
}

function getFirebase() { return productionState.getFirebase?.() || null; }
function isFirebaseReady() { return Boolean(productionState.db && getFirebase()); }
function requireProductionTenantId() {
  const tenantId = getGlobalTenantId() || String(productionState.tenantId || '').trim();
  if (!tenantId) {
    console.error('[CharcuLogic Firebase] Production-Modul ohne Mandanten-ID initialisiert.');
    return null;
  }
  return tenantId;
}
function productionBatchesCollectionPath() {
  try {
    return getTenantCollectionPath('produktion_chargen');
  } catch {
    return null;
  }
}
function rezepteCollectionPath() {
  try {
    return getTenantCollectionPath('rezepte');
  } catch {
    return null;
  }
}
function rezepteCollectionRef() {
  if (!productionState.db) return null;
  try {
    return getTenantCollection('rezepte');
  } catch {
    return null;
  }
}
function serverTimestampFallback() {
  const firebaseInstance = getFirebase();
  return firebaseInstance?.firestore?.FieldValue?.serverTimestamp
    ? firebaseInstance.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}

// Bratwurst-Rezepte aus main.dart
const bratwurstRecipes = [
  {
    "id": "Gallo-Rizo-Patties",
    "name": "Burgerpatties Gallo-Rizo",
    "kat": "Patties",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULFITE"
    ],
    "tipp": "Hobby-Tipp: Nutze Einweg-Handschuhe über Textil-Handschuhen, um die Fleischmasse vor deiner Körperwärme zu isolieren.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Allergene pruefen: SULFITE.",
    "anweisung_A": "Fleisch und Fett auf 0 bis 2 Grad C kuehlen. Gewuerze, Salz und fluessige Zutaten getrennt abwiegen. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen. Nur kurz mengen, bis die Masse zusammenhaelt; Patties sollen locker bleiben und nicht wie Bruehwurst binden.",
    "anweisung_C": "Gleichmaessig portionieren, schonend formen und bei Bedarf eine leichte Mulde eindruecken. Patties nicht warm stehen lassen.",
    "anweisung_D": "Patties sofort kuehlen, flach lagern und als empfindliches Hackfleischprodukt behandeln.",
    "ingredients": [
      {
        "name": "RII (Rindfleisch mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV (Rindfleisch fett/Abschnitte)",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rotwein",
        "pct": 3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULFITE"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 1.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Patties",
    "name": "Burgerpatties vom Galloway (G-Patties)",
    "kat": "Patties",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Hobby-Tipp: Wenn du keine Patty-Presse hast, nutze einen großen Servierring und drücke die Masse nur leicht fest.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Fleisch und Fett auf 0 bis 2 Grad C kuehlen. Gewuerze, Salz und fluessige Zutaten getrennt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen. Nur kurz mengen, bis die Masse zusammenhaelt; Patties sollen locker bleiben und nicht wie Bruehwurst binden.",
    "anweisung_C": "Gleichmaessig portionieren, schonend formen und bei Bedarf eine leichte Mulde eindruecken. Patties nicht warm stehen lassen.",
    "anweisung_D": "Patties sofort kuehlen, flach lagern und als empfindliches Hackfleischprodukt behandeln.",
    "ingredients": [
      {
        "name": "Rindfleisch II (mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rindfleisch IV (fett)",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "CC-Griller",
    "name": "Chili Cheese Griller",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "MILCH, 5mm Würfel",
      "SENF"
    ],
    "tipp": "Tipp für die Frischetheke: Wenn du beim Supermarkt-Metzger kein reines, kerniges Keulen- oder Rückenfett bekommst, frage nach sehr fettem Schweinebauch ohne Schwarte oder einfachem weißen Speckabschnitt. Achtung: Dieses Ersatzfett ist weicher! Schneide es in Würfel und friere es für ca. 30–45 Minuten leicht an, bevor es in den Wolf geht. Schmiert das weiche Fett beim Wolfen, ist die Emulsion später ruiniert.)",
    "haltbar": "Haltbarkeit & Lagerung\nFür die Sicherheit und den optimalen Genuss gelten folgende Richtwerte:\nFrisch (Roh / Ungebrüht): Falls die Würste nicht sofort gebrüht werden, sind sie extrem empfindlich. Lagerung maximal 24 Stunden bei konstant unter 2 °C.\nGebrüht (Vakuumiert): Nach dem Abschrecken und vollständigen Abtrocknen vakuumiert bei maximal 4 °C lagern. Haltbarkeit: 10 bis 14 Tage.\nGebrüht & Tiefgefroren: Im Vakuumbeutel bei -18 °C tiefkühlen. Haltbarkeit: 6 Monate für optimalen Geschmack (bis zu 12 Monate technisch möglich).",
    "hinweis": "Allergene pruefen: MILCH, 5mm Würfel, SENF.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Milch, Senf.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Rindfleisch R II",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": "mager, sehnenarm 0° bis 2° C"
      },
      {
        "name": "Schweinefleisch S II",
        "pct": 16,
        "typ": "base",
        "allergen": false,
        "hinweis": "80/20 Sortierung 0° bis 2° C"
      },
      {
        "name": "Schweine-Keulenfett S VII",
        "pct": 15,
        "typ": "base",
        "allergen": false,
        "hinweis": "frisch, kernig 0° bis 2° C"
      },
      {
        "name": "Crushed Ice",
        "pct": 15,
        "typ": "base",
        "allergen": false,
        "hinweis": "eiskalt"
      },
      {
        "name": "Bergkäse (gewürfelt)",
        "pct": 14,
        "typ": "base",
        "allergen": true,
        "hinweis": "MILCH, 5mm Würfel"
      },
      {
        "name": "Meersalz fein",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "ohne Trennmittel"
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.7,
        "typ": "spice",
        "allergen": false,
        "hinweis": "trocken"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "trocken"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gemahlen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Schärfe prüfen"
      },
      {
        "name": "Majoran",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gerebelt"
      }
    ]
  },
  {
    "id": "Gallo-Rizo-BW",
    "name": "Frische Bratwurst Gallo-Rizo",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "Sulphite"
    ],
    "tipp": "Hobby-Tipp: Nutze zum Mengen kalte Rührhaken oder arbeite zügig von Hand, um die 12 °C Marke niemals zu überschreiten.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Allergene pruefen: Sulphite.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "RII",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rotwein",
        "pct": 3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "Sulphite"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Pfeffer weiß gemahlen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Cayenne",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Koriander",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      }
    ]
  },
  {
    "id": "G-BW",
    "name": "Frische Bratwurst vom Galloway",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "RII",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV",
        "pct": 27,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Zitronensaft",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "H-BW",
    "name": "Frische Bratwurst vom Hähnchen",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "HII",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "HIV",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 3,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Meersalz fein",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Muskat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Piment gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      }
    ]
  },
  {
    "id": "S-BW",
    "name": "Frische Bratwurst vom Schwein",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Tipp: Ein scharfer Schnitt ist für die Optik im Saitling entscheidend. Achte darauf, dass der Speck beim Wolfen nicht schmiert, um eine klare Fettkörnung im Brät zu erhalten.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Zitronensaft",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.7,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      }
    ]
  },
  {
    "id": "GS-Pfälzer-LW",
    "name": "Galloway & Schwein Pfälzer Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: extra Schüssel, mit Leber schaumig kuttern",
    "anweisung_A": "Fleisch, Fett, Leber und Schuettung getrennt vorbereiten. Gegarte Rohstoffe warm verarbeiten, rohe Leber kalt halten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Vorgegarte Fleischanteile passend wolfen oder kuttern. Leber mit Salz fein aufschliessen und erst einarbeiten, wenn die Masse nicht mehr zu heiss ist.",
    "anweisung_C": "Gewuerze und weitere Zutaten gleichmaessig einarbeiten. In Glas, Darm oder Form fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Nach dem Erhitzen zuegig abkuehlen, kalt lagern und bei Glasware Deckel, Vakuum und Charge pruefen.",
    "ingredients": [
      {
        "name": "Galloway RIV (Wade/Bug/Brust, gegart)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebauch ohne Schwarte",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebacke / Wamme",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderleber",
        "pct": 18,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfel",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Kartoffelpüree-Pulver",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "extra Schüssel, mit Leber schaumig kuttern"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronenpulver",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Aspik",
    "name": "Galloway Aspik",
    "kat": "Konserven",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SELLERIE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SELLERIE.",
    "anweisung_A": "Rohstoffe vorbereiten, sauber parieren und Zutaten vollstaendig abwiegen. Glaeser, Deckel und Werkzeuge hygienisch bereitstellen. Allergene kennzeichnen: Sellerie.",
    "anweisung_B": "Fleisch, Fond, Gemuese und Gewuerze nach Rezeptur garen oder ansetzen. Heisse Komponenten zuegig verarbeiten und Fuelltemperatur sowie Sauberkeit im Blick behalten.",
    "anweisung_C": "Glaeser mit korrektem Kopfraum fuellen, Raender sauber abwischen und sofort verschliessen. Anschliessend nach validiertem Programm erhitzen; Hausrezept allein ersetzt keine Prozessvalidierung.",
    "anweisung_D": "Nur mit validiertem Erhitzungsprogramm freigeben; Deckel, Vakuum, Charge und Lagerprobe dokumentieren.",
    "ingredients": [
      {
        "name": "Trinkwasser",
        "pct": 150,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Sehnen / Parüren / Silberhaut",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Gelenk-Knochen (klein gesägt)",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln (mit Schale)",
        "pct": 15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Karotten / Sellerie (grob)",
        "pct": 5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SELLERIE"
      },
      {
        "name": "Apfelessig (Naturtrüb)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "LapCheong",
    "name": "Galloway Lap Cheong (Bio)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SOJA",
      "ALKOHOL",
      "weißer Pfeffer"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SOJA, ALKOHOL, weißer Pfeffer.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Soja, Alkohol, weißer Pfeffer.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway Rindfleisch R II",
        "pct": 75,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweine-Rückenspeck S VIII",
        "pct": 23,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Sojasauce (Tamari)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SOJA"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Reiswein",
        "pct": 2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "ALKOHOL"
      },
      {
        "name": "Fünf-Gewürze-Pulver",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "weißer Pfeffer",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": ""
      },
      {
        "name": "Ingwerpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rote-Bete-Pulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-LW",
    "name": "Galloway Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "MILCH"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: MILCH.",
    "anweisung_A": "Fleisch, Fett, Leber und Schuettung getrennt vorbereiten. Gegarte Rohstoffe warm verarbeiten, rohe Leber kalt halten. Allergene kennzeichnen: Milch.",
    "anweisung_B": "Vorgegarte Fleischanteile passend wolfen oder kuttern. Leber mit Salz fein aufschliessen und erst einarbeiten, wenn die Masse nicht mehr zu heiss ist.",
    "anweisung_C": "Gewuerze und weitere Zutaten gleichmaessig einarbeiten. In Glas, Darm oder Form fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Nach dem Erhitzen zuegig abkuehlen, kalt lagern und bei Glasware Deckel, Vakuum und Charge pruefen.",
    "ingredients": [
      {
        "name": "Rinderleber (Galloway), frisch",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderbauch / Brust (Fett)",
        "pct": 27.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderwade / Rosenstück (Geliermaterial)",
        "pct": 18.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kochsud (Aromatisch, fetthaltig)",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schulter / Oberschale (Magerfleisch)",
        "pct": 6.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln (Frisch)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Butter",
        "pct": 2.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "MILCH"
      },
      {
        "name": "Meersalz",
        "pct": 1.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Extra Schüssel für Leber!"
      },
      {
        "name": "Traubensaft (Rot, Direktsaft)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway-Glace (Kollagen-Konzentrat)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Kartoffelflocken (Rein)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfelessig (Naturtrüb)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß, gemahlen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran, gerebelt",
        "pct": 0.06,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment, gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer, gemahlen",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatnuss, gemahlen",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Peitsche - SALZ",
    "name": "Galloway Peitsche - Salz Pur (18/20)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway mager",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway fett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Peitsche - SCHARF",
    "name": "Galloway Peitsche - Scharf (18/20)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway mager",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway fett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz, unjodiert",
        "pct": 2.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio Nadurot",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkultur (Lyoph.)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Bierwurst / G-Bier-Griller",
    "name": "Galloway-Bierwurst",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Gallowayfleisch (R I - Mager)",
        "pct": 50,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweine-Rückenspeck (kernig)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schüttung",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln frisch",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.6,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Rohrzucker",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kardamom",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "S-Chorizo-Griller",
    "name": "Griller Chorizo vom Schwein",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rotwein (spanisch JOSE)",
        "pct": 5.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 2.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "H-Wiener",
    "name": "Hühner-Wiener",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Mageres Hühnerfleisch",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Hühnerfett / -Haut",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Crushed Ice / H-Brühe",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Natriumcitrat",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "GS-Rost-BW",
    "name": "Niederrheinische grobe Rostbratwurst",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway-Rindfleisch mager",
        "pct": 41.85,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinefleisch mager",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinefett (Rückenspeck)",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Eiskaltes Wasser",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver / getrocknete Zwiebeln",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "weißer Pfeffer, gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran, gerebelt",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Brauner Zucker / Rübenkraut",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfsaat, grob gestoßen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment, gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "G-Pastrami",
    "name": "Pastrami vom Galloway",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF Lake",
      "SENF Rub"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF Lake, SENF Rub.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "G-Brust, Tafelspitz",
        "pct": 100,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Meersalz (Brine)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Rohrohrzucker (Brine)",
        "pct": 1.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Paprika edelsüß (Brine)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Pfeffer (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Koriander (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Paprika (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Pfeffer (Brine)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Koriander (Brine)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Knoblauch (Brine)",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Senfsaat (Brine)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF Lake"
      },
      {
        "name": "Knoblauch (Rub)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Zwiebelpulver (Rub)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Senfsaat (Rub)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF Rub"
      },
      {
        "name": "Lorbeer (Rub)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Piment  (Rub)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      }
    ]
  },
  {
    "id": "G-PB",
    "name": "Pfefferbeißer vom Galloway",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "E300"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, E300.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, E300.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway Rindfleisch (Mager)",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Rinderfett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Trinkwasser (kalt)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz, gebrochen",
        "pct": 0.33,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Bio-Nadurot (E300)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "E300"
      },
      {
        "name": "Paprikapulver",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili geschrotet",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schabzigerklee",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.06,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rosmarin",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "S-PB",
    "name": "Pfefferbeißer vom Schwein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "E300"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, E300.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, E300.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer bunt, geschrotet",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Oregano (gerebelt)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel, fein zerstoßen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika rosenscharf",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Traubenzucker / Rosalin",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkultur PRIMAL SK natur rapid 50",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Nadurot (E300)",
        "pct": 0.03,
        "typ": "spice",
        "allergen": true,
        "hinweis": "E300"
      }
    ]
  },
  {
    "id": "S-Räucherbauch",
    "name": "Räucherbauch Schwein",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinebauch",
        "pct": 100,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpaste",
        "pct": 0.3,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.3,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.2,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren",
        "pct": 0.1,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeerblätter",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "S-Chorizo-Salami",
    "name": "Salami Chorizo vom Schwein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rotwein (spanisch JOSE)",
        "pct": 5.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 2.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "T-SPX (Bio) Starterkulturen",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfel-Essig",
        "pct": 0.07,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "S-Salsiccia",
    "name": "Salsiccia",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 50,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SVIII",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIII / RIII",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "trockener ital. Rotwein",
        "pct": 4,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Fenchelsaat, gestoßen",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel, gestoßen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz gestoßen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rosmarin gemahlen",
        "pct": 0.07,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeer gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren gemahlen",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "ZZ_RS-MettW",
    "name": "Mettwurst Niederrhein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "Pfeffer weiß gem."
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, Pfeffer weiß gem..",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, Pfeffer weiß gem..",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweinefleisch SIV",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rindfleisch RII",
        "pct": 19.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz fein",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Pfeffer weiß gem.",
        "pct": 0.35,
        "typ": "spice",
        "allergen": true,
        "hinweis": ""
      },
      {
        "name": "Rohrzucker",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "Kräuter-BW",
    "name": "Kräuter-Bratwurst",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebauch S5",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Eisschnee / Wasser",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.9,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß gem.",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Petersilie gerebelt",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel gem.",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatnuss gem.",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer gem.",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "Nuss_Roh",
    "name": "Bio-Nuß-Schinken",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "Lagerung im Kühlraum bei max. +4°C.\n5. Pökeldauer: ca. 1,5 Tage pro kg Fleischgewicht. Die Beutel sollten alle 2 Tage gewendet werden, um eine optimale Verteilung zu gewährleisten.\nVorbereitung zum Räuchern:\n1. Nach der Pökelzeit die Nüsse aus dem Beutel nehmen und kurz mit kaltem Wasser abspülen.\n2. Durchbrennen: 2-3 Tage hängend bei +6°C trocknen/durchbrennen lassen.\nRäuchern (Rational Dämpfer):\n1. Ausschließlich im Rational Dämpfer bei Kaltrauch (max. 20°C).\n2. 3-4 Intervalle à 6 Stunden.\nQualitätskontrolle:\n• HACCP: pH-Wert < 5,3 sicherstellen.\n• Allergene: Enthält Senfmehl.",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinenuss (schier)",
        "pct": 95.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (geschrotet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren (gequetscht)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.05,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "Huefte_Roh",
    "name": "Bio-Schinkenspeck",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinehüfte (m. Speck und Schwarte)",
        "pct": 95.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (geschrotet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren (gequetscht)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.05,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "RUB01",
    "name": "Galloway Gold",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Brauner Rohrohrzucker",
        "pct": 30,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Meersalz (grob)",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schwarzer Pfeffer",
        "pct": 15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpulver",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chiliflocken",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Shiitake-Pilzpulver",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer (gemahlen)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "RUB02",
    "name": "Honey-Garlic-Crunch",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Rohrohrzucker",
        "pct": 45,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Knoblauch (granuliert)",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz (fein)",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer",
        "pct": 6,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronenschale",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "RUB03",
    "name": "Pinoy Smoke & Spice",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Brauner Rohrohrzucker",
        "pct": 30,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Rauchsalz",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Sumach",
        "pct": 8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schwarzer Pfeffer",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Sternanis (gemahlen)",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "RW001",
    "name": "Rote Wurst",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10000",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Bioland",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Schweineschulter (mager)",
        "pct": 42.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Speck (Rücken/Backe)",
        "pct": 27.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Trinkwasser (Eis-Schnee)",
        "pct": 25,
        "typ": "liquid",
        "allergen": false,
        "hinweis": "Trinkwasser"
      },
      {
        "name": "Rindfleisch (sehnenarm)",
        "pct": 5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Meersalz",
        "pct": 18,
        "typ": "additive",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel (gemahlen)",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "H-FW-90",
    "name": "Hähnchen-Fleischwurst (90er)",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir kein NPS nutzen, bleibt die Wurst natur-hell. Achtet penibel auf die Kälte beim Kuttern, Geflügelbrät ist thermisch extrem instabil.",
    "haltbar": "Haltbarkeit: 14 Tage bei < 4°C (vakuumiert).",
    "hinweis": "Produktionshinweis: CCP: Kerntemp. 72°C",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten. Bei Gefluegel besonders zuegig und hygienisch arbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Hühnerfleisch mager",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": "CCP: Kerntemp. 72°C"
      },
      {
        "name": "Hühnerfett / -Haut",
        "pct": 20,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser / Eis",
        "pct": 20,
        "typ": "base",
        "allergen": false,
        "hinweis": "eiskalt"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "BioTex Pure (KHM)",
        "pct": 0.9,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Kutterhilfsmittel"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gemahlen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Curcuma",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "für die Farbe"
      },
      {
        "name": "Ingwer",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "Gallo-Lamb-Merguez-Bio",
    "name": "Merguez Galloway-Lamm",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir kein NPS nutzen, ist die mikrobiologische Stabilität bei frischer Bratwurst das A und O. Arbeitet extrem zügig beim Wolfen. Wenn Ihr die Merguez noch „kickiger“ wollt, könnt Ihr 0,5% frische Minze fein gehackt unterheben – das passt perfekt zum Lamm.",
    "haltbar": "Haltbarkeit: 3 Tage bei < 4°C (Frischware) oder 180 Tage bei -18°C.",
    "hinweis": "Produktionshinweis: Kerntemperatur 0°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway RII (mager)",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kerntemperatur 0°C"
      },
      {
        "name": "Lammfleisch / -fett (LII/LIV)",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "CCP: Salzwaage prüfen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.45,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "Gallo-Citron-Sauge-Bio",
    "name": "Saucisse de Gallo (Citron & Sauge)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Achtet bei den Salzzitronen darauf, nur die Schale zu verwenden und das bittere Fruchtfleisch zu entfernen. Da wir kein Phosphat nutzen, ist die Bindung rein mechanisch – arbeitet zügig, damit das Fett nicht schmiert.",
    "haltbar": "Haltbarkeit: 3 Tage bei < 4°C oder 180 Tage bei -18°C.",
    "hinweis": "Produktionshinweis: Kerntemperatur < 2°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway RII (mager)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kerntemperatur < 2°C"
      },
      {
        "name": "Rinderfett (kernig)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Salzzitrone (Bio, fein gehackt)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur Schale verwenden"
      },
      {
        "name": "Salbei (getrocknet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gerebelt"
      },
      {
        "name": "Pfeffer weiß (gemahlen)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch (frisch, fein gewürfelt)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
  },
  {
    "id": "alt_Schwein-Mettwurst",
    "name": "StevesHof Mettwurst_alt",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Kontrolliert am 2. Tag den \"Zipfel-Test\". Sind die Enden geschmeidig, passt die Feuchte. Werden sie trocken, riskiert ihr einen Trockenrand (Verschalung) – dann sofort Luftfeuchte leicht erhöhen!",
    "haltbar": "Haltbarkeit: 7 Tage bei <4°C (frisch) oder 21 Tage gereift bei <15°C.",
    "hinweis": "Produktionshinweis: pH-Wert < 5,8",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweineschulter S II",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH-Wert < 5,8"
      },
      {
        "name": "Rückenspeck S IV",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig & eiskalt"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (grob)",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat (gemahlen)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch (frisch)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Bakterienfutter"
      }
    ]
  },
  {
    "id": "neu_Schwein-Mettwurst",
    "name": "Bio Mettwurst (geräuchert & luftgetrocknet)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir ohne NPS arbeiten, ist der pH-Wert-Verlauf kritisch. Ziel-pH nach 48h: 4,8 bis 5,1. Achtet darauf, dass die Wurst im Rauch nicht \"absperrt\" (Trockenrand), sonst fault sie von innen.",
    "haltbar": "Haltbarkeit: 60 Tage bei <12°C (nach Reifung).",
    "hinweis": "Produktionshinweis: Gekühlt bei 0-2°C verarbeiten",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweinefleisch mager (S II)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "Gekühlt bei 0-2°C verarbeiten"
      },
      {
        "name": "Rückenspeck ohne Schwarte (S VIII)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig, gut gekühlt"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Konservierung durch Salz-Hürde"
      },
      {
        "name": "Pfeffer schwarz, gemahlen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer, gemahlen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatblüte (Macis)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander, gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "BIO Rosalin S (Glucosesirup)",
        "pct": 0.4,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Futter für Milchsäurebakterien"
      },
      {
        "name": "BIO Pökulus",
        "pct": 0.2,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Enthält E301 zur Umrötung"
      },
      {
        "name": "Acerola-Pulver (optional)",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Natürliches Vitamin C (Vorschlag)"
      }
    ]
  },
  {
    "id": "cocktail_Gallo-Mary-Brat-Bio",
    "name": "Gallo-Mary Bratwurst (Bloody Mary Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "Typisches Aroma"
    ],
    "tipp": "Meister-Tipp: Da Galloway-Fett einen niedrigeren Schmelzpunkt hat als Hausschwein, arbeitet im Menger zügig. Das BIO Kutterpower mit der Pastinaken-Note unterstützt das Gemüseprofil der Bloody Mary hervorragend und hält den Wodka sicher in der Bindung, damit die Wurst auf dem Grill saftig bleibt und nicht spritzt.",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Allergene pruefen: Typisches Aroma.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Typisches Aroma.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "R II (Galloway mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH-Wert 5,8 - 6,0"
      },
      {
        "name": "R IV (Galloway Speck)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig kühlen"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Für Brätfestigkeit"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farberhalt (E300)"
      },
      {
        "name": "Tomatenmark (Bio)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "2-fach konzentriert"
      },
      {
        "name": "Bio-Wodka",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "40% Vol."
      },
      {
        "name": "Selleriesalz",
        "pct": 0.25,
        "typ": "spice",
        "allergen": true,
        "hinweis": "Typisches Aroma"
      },
      {
        "name": "Pfeffer schwarz (grob)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Frisch geschrotet"
      },
      {
        "name": "Zitronenschale (Bio)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur Abrieb"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ]
  },
  {
    "id": "cocktail_Huelser-Gin-Griller-Bio",
    "name": "Hülser Gin-Griller (Gin-Tonic Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Der Gin fungiert als Extraktionsmittel für den Wacholder. Achtet darauf, den Limettenabrieb wirklich erst ganz am Ende zuzugeben. Die ätherischen Öle der Schale sind flüchtig und reagieren empfindlich auf zu langes Mengen. Das Ergebnis auf dem Grill ist eine echte Aroma-Explosion!",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Produktionshinweis: pH 5,8 - 6,0; gut gekühlt",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2 (Bio)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH 5,8 - 6,0; gut gekühlt"
      },
      {
        "name": "Schweinebauch S5 (Bio)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernige Fettstruktur"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Bio-Gin (hochwertig)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "40-45% Vol."
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Stabilisierung & Bindung"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farberhalt ohne NPS"
      },
      {
        "name": "Wacholderbeeren (Bio)",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Grob zerstoßen"
      },
      {
        "name": "Limettenabrieb (Bio)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur die grüne Schale"
      },
      {
        "name": "Pfeffer weiß (gemahlen)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Mildes Profil"
      },
      {
        "name": "Koriandersaat (Bio)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gemahlen"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ]
  },
  {
    "id": "cocktail_Dark-Stormy-Brat-Bio",
    "name": "Dark & Stormy Griller (Rum & Ginger Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Der dunkle Rum enthält natürliche Melasse-Noten, die zusammen mit dem kleinen Anteil Rohrohrzucker auf dem Grill karamellisieren – das gibt ein unglaubliches Aroma. Achtet beim Ingwer auf absolute Frische; die ätherischen Öle sind der Gegenspieler zum fetten Schweinebauch und machen die Wurst extrem süffig.",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Produktionshinweis: pH 5,8 - 6,0; max. 2°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2 (Bio)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH 5,8 - 6,0; max. 2°C"
      },
      {
        "name": "Schweinebauch S5 (Bio)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernige Struktur"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Bio-Rum (Dunkel)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Aroma-Geber"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rein, ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Emulsionsstabilität"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farbstabilität"
      },
      {
        "name": "Ingwer (Bio, frisch gerieben)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Schärfe & Frische"
      },
      {
        "name": "Limettensaft (Bio)",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Für die Säurestruktur"
      },
      {
        "name": "Rohrohrzucker (Bio)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Für die Karamelisierung"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Gemahlen"
      },
      {
        "name": "Piment (Bio)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gemahlen"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ]
  }
];

function recipeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getSafeFirestoreId(id) {
  return String(id || '')
    .replace(/\//g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const localRecipeIndex = new Map(bratwurstRecipes.map((recipe) => [String(recipe.id), recipe]));
const localRecipeLookup = new Map();
bratwurstRecipes.forEach((recipe) => {
  localRecipeIndex.set(getSafeFirestoreId(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(getSafeFirestoreId(recipe.id)), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.name), recipe);
});

function recipeIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b)
    || getSafeFirestoreId(a) === getSafeFirestoreId(b)
    || recipeLookupKey(a) === recipeLookupKey(b);
}

function findLocalRecipe(recipe, fallbackId = '') {
  if (!shouldUseBratwurstMasterlist()) return null;
  return localRecipeIndex.get(String(recipe?.id))
    || localRecipeIndex.get(String(fallbackId))
    || localRecipeLookup.get(recipeLookupKey(recipe?.id))
    || localRecipeLookup.get(recipeLookupKey(recipe?.name))
    || localRecipeLookup.get(recipeLookupKey(fallbackId))
    || bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipe?.id) || recipeIdsMatch(entry.id, fallbackId))
    || null;
}

function ingredientsFromBratwurstSeed(recipeId) {
  if (!shouldUseBratwurstMasterlist()) return [];
  if (recipeId == null || recipeId === '') return [];
  const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipeId));
  if (seedRecipe?.ingredients?.length) {
    return seedRecipe.ingredients;
  }
  const localRecipe = findLocalRecipe({ id: recipeId }, recipeId);
  return Array.isArray(localRecipe?.ingredients) ? localRecipe.ingredients : [];
}

function ensureRecipeIngredients(recipe, recipeId = recipe?.id) {
  if (!recipe) return null;

  let ingredients = recipe.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    const fallbackIngredients = ingredientsFromBratwurstSeed(recipeId || recipe.id);
    if (fallbackIngredients.length) {
      console.warn('[CharcuLogic Wurstküche] Cloud ohne Zutaten – Fallback aus bratwurstRecipes:', recipeId || recipe.id);
      ingredients = fallbackIngredients;
    } else {
      ingredients = [];
    }
  }

  return { ...recipe, ingredients };
}

function recipesForKitchenList() {
  const recipesById = new Map();

  if (shouldUseBratwurstMasterlist()) {
    bratwurstRecipes.forEach((recipe) => {
      recipesById.set(String(recipe.id), ensureRecipeIngredients(recipe, recipe.id));
    });
  }

  productionState.recipes.forEach((cloudRecipe) => {
    const localRecipe = findLocalRecipe(cloudRecipe, cloudRecipe.id || cloudRecipe.docId);
    const mergedId = String(localRecipe?.id || cloudRecipe.id || cloudRecipe.docId);
    const mergedRecipe = localRecipe
      ? {
          ...localRecipe,
          ...cloudRecipe,
          id: mergedId,
          ingredients: localRecipe.ingredients?.length
            ? localRecipe.ingredients
            : cloudRecipe.ingredients,
        }
      : cloudRecipe;

    recipesById.set(mergedId, ensureRecipeIngredients(mergedRecipe, mergedId));
  });

  return Array.from(recipesById.values()).filter(Boolean);
}

function getRecipeWithLocalFallback(recipeId) {
  const cloudRecipe = productionState.recipes.find(
    (recipe) => recipeIdsMatch(recipe.id, recipeId) || recipeIdsMatch(recipe.docId, recipeId)
  );
  const localRecipe = findLocalRecipe(cloudRecipe, recipeId);

  if (!cloudRecipe) {
    return ensureRecipeIngredients(localRecipe, recipeId);
  }

  const merged = localRecipe
    ? { ...localRecipe, ...cloudRecipe, ingredients: localRecipe.ingredients ?? cloudRecipe.ingredients }
    : cloudRecipe;

  return ensureRecipeIngredients(merged, recipeId);
}

function normalizeRecipeDoc(doc) {
  const cloudRecipe = { docId: doc.id, id: doc.id, ...doc.data() };
  const localRecipe = findLocalRecipe(cloudRecipe, doc.id);
  if (!localRecipe) {
    return ensureRecipeIngredients(cloudRecipe, doc.id);
  }
  return ensureRecipeIngredients({
    ...localRecipe,
    ...cloudRecipe,
    ingredients: localRecipe.ingredients?.length
      ? localRecipe.ingredients
      : cloudRecipe.ingredients,
  }, doc.id);
}


async function importBratwurstRecipesToCloud() {
  if (!shouldUseBratwurstMasterlist()) {
    console.warn('[CharcuLogic Firebase] Rezept-Seed nur für Mandanten mit Bratwurst-Masterliste.');
    return;
  }

  const tenantId = requireProductionTenantId();

  if (!tenantId) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Seed abgebrochen - productionState.tenantId fehlt.');
    return;
  }

  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Firebase nicht initialisiert.');
    return;
  }

  validateBratwurstMasterlist();

  try {
    const collectionRef = rezepteCollectionRef();
    if (!collectionRef) {
      console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Keine gültige Rezept-Collection.');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const recipe of bratwurstRecipes) {
      const docId = String(recipe.id);
      const safeId = getSafeFirestoreId(docId);
      const recipePayload = {
        ...recipe,
        id: docId,
        firestoreId: safeId,
        ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
      };

      try {
        await collectionRef.doc(safeId).set(recipePayload);
        successCount += 1;
      } catch (error) {
        failureCount += 1;
        console.warn('[CharcuLogic Firebase] Rezept-Seed fehlgeschlagen:', recipe.id, error.message);
      }
    }

    console.info(`[CharcuLogic Firebase] ${successCount} Rezepte erfolgreich im Firestore validiert.${failureCount ? ` Blockiert: ${failureCount}.` : ''}`);
  } catch (error) {
    console.error('[CharcuLogic Firebase] Rezept-Seed blockiert:', error.message);
  }
}

function mapRecipeDoc(doc) {
  return normalizeRecipeDoc(doc);
}

function loadRecipesFromCloud() {
  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Firebase nicht initialisiert.');
    return;
  }
  const collectionRef = rezepteCollectionRef();
  if (!collectionRef) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Keine gültige Rezept-Collection – Tenant prüfen.');
    return;
  }
  if (productionState.recipesUnsubscribe) {
    productionState.recipesUnsubscribe();
    productionState.recipesUnsubscribe = null;
  }
  productionState.recipesUnsubscribe = collectionRef.onSnapshot(
    (snapshot) => {
      productionState.recipes = snapshot.docs.map(mapRecipeDoc);
      validateCloudRecipesAgainstMasterlist(productionState.recipes);
      if (productionState.activeTab === 'kitchen') {
        renderRecipes();
      } else if (productionState.activeTab === 'batches') {
        renderRecipeCloudAudit();
      }
    },
    (err) => {
      console.error('[CharcuLogic Firebase] Rezept Live-Sync Fehler:', err);
    }
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mapProductionBatchDoc(doc) {
  const data = doc.data() || {};
  return {
    ...data,
    id: doc.id,
    chargenNummer: data.chargenNummer || doc.id,
  };
}

function formatBatchTimestamp(value) {
  if (!value) return 'Noch ohne Serverzeit';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Noch ohne Serverzeit';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filteredProductionBatches() {
  const query = productionState.batchSearchQuery.trim().toLowerCase();
  const batches = Array.isArray(productionState.productionBatches) ? productionState.productionBatches : [];
  if (!query) return batches;
  return batches.filter((batch) => {
    const haystack = `${batch.chargenNummer || ''} ${batch.rezeptName || ''} ${batch.macher || ''} ${batch.abweichungen || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderProductionBatches() {
  const container = document.getElementById('batch-list-container');
  if (!container) return;

  const visibleBatches = filteredProductionBatches();
  if (!visibleBatches.length) {
    container.innerHTML = `
      <div class="batch-empty-hint">
        ${productionState.productionBatches.length ? 'Keine Charge für diese Suche gefunden.' : 'Noch keine Produktionscharge dokumentiert.'}
      </div>`;
    return;
  }

  container.innerHTML = visibleBatches.map((batch) => {
    const deviations = String(batch.abweichungen || '').trim();
    const ingredientCount = Array.isArray(batch.zutatenBerechnet) ? batch.zutatenBerechnet.length : 0;
    const labelStatus = batch.etikettBasis?.status || 'vorbereitet';
    const unitTotal = batch.verkaufsEinheiten?.gesamt ?? batch.etikettBasis?.etikettenAnzahl ?? '-';
    return `
      <article class="batch-card">
        <div class="batch-card-title">${escapeHtml(batch.rezeptName || 'Unbekanntes Rezept')}</div>
        <div class="recipe-subinfo">${escapeHtml(batch.chargenNummer)} · ${escapeHtml(formatBatchTimestamp(batch.zeitstempel))}</div>
        <div class="batch-card-meta">
          <div>
            <span class="batch-card-label">Menge</span>
            <span class="batch-card-value">${escapeHtml(batch.produktionsmengeKg ?? '-')} kg</span>
          </div>
          <div>
            <span class="batch-card-label">Macher</span>
            <span class="batch-card-value">${escapeHtml(batch.macher || '-')}</span>
          </div>
          <div>
            <span class="batch-card-label">pH / Kern</span>
            <span class="batch-card-value">${escapeHtml(batch.phWert ?? '-')} / ${escapeHtml(batch.kerntemperatur ?? '-')} °C</span>
          </div>
          <div>
            <span class="batch-card-label">Etikettenbasis</span>
            <span class="batch-card-value">${escapeHtml(labelStatus)} · ${ingredientCount} Zutaten</span>
          </div>
          <div>
            <span class="batch-card-label">Verkaufseinheiten</span>
            <span class="batch-card-value">${escapeHtml(unitTotal)}</span>
          </div>
        </div>
        ${deviations ? `<div class="batch-card-deviation">Abweichungen: ${escapeHtml(deviations)}</div>` : ''}
      </article>
    `;
  }).join('');
}

function initBatchArchiveSearch() {
  const searchInput = document.getElementById('batch-search-input');
  if (!searchInput || searchInput.dataset.eventsBound === '1') return;
  searchInput.dataset.eventsBound = '1';
  searchInput.addEventListener('input', (event) => {
    productionState.batchSearchQuery = event.target.value || '';
    renderProductionBatches();
  });
}

function loadProductionBatchesFromCloud() {
  if (!isFirebaseReady() || !productionState.db) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Firebase nicht initialisiert.');
    return;
  }

  const collectionPath = productionBatchesCollectionPath();
  if (!collectionPath) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Kein gültiger Chargen-Pfad.');
    return;
  }

  if (productionState.productionBatchesUnsubscribe) {
    productionState.productionBatchesUnsubscribe();
    productionState.productionBatchesUnsubscribe = null;
  }

  productionState.productionBatchesUnsubscribe = productionState.db.collection(collectionPath)
    .orderBy('zeitstempel', 'desc')
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        productionState.productionBatches = snapshot.docs.map(mapProductionBatchDoc);
        if (productionState.activeTab === 'batches') {
          renderProductionBatches();
        }
      },
      (err) => {
        console.error('[CharcuLogic Firebase] Chargen Live-Sync Fehler:', err);
      }
    );
}


// --- SCREEN 2: WURSTKUECHE LOGIC ---
function setRecipeDetailText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function populateRecipeDetailView(recipe) {
  if (!recipe) return;

  setRecipeDetailText('detail-recipe-title', recipe.name);
  setRecipeDetailText('detail-recipe-warning', recipe.hinweis);
  setRecipeDetailText('recipe-phase-a-text', recipe.anweisung_A);
  setRecipeDetailText('recipe-phase-b-text', recipe.anweisung_B);
  setRecipeDetailText('recipe-phase-c-text', recipe.anweisung_C);
  setRecipeDetailText('recipe-phase-d-text', recipe.anweisung_D);
  setRecipeDetailText('recipe-meister-tipp-text', recipe.tipp);
  setRecipeDetailText('recipe-haltbarkeit-text', recipe.haltbar);

  const tippRow = document.getElementById('recipe-meister-tipp');
  if (tippRow) tippRow.hidden = !recipe.tipp;

  const haltbarRow = document.getElementById('recipe-haltbarkeit');
  if (haltbarRow) haltbarRow.hidden = !recipe.haltbar;
}

function recipeCategoryOf(recipe) {
  return recipe?.kat || recipe?.Kategorie || 'Ohne Kategorie';
}

function recipeSearchText(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((ing) => ingredientNameOf(ing)).join(' ')
    : '';
  return `${recipe?.name || ''} ${recipe?.id || ''} ${recipeCategoryOf(recipe)} ${ingredients}`.toLowerCase();
}

function renderRecipeCategoryFilters(recipes) {
  const filter = document.getElementById('recipe-category-filter');
  if (!filter) return;

  const categories = Array.from(new Set(recipes.map(recipeCategoryOf))).sort((a, b) => a.localeCompare(b, 'de'));
  const buttons = [
    { id: 'all', label: `Alle (${recipes.length})` },
    ...categories.map((category) => ({
      id: category,
      label: `${category} (${recipes.filter((recipe) => recipeCategoryOf(recipe) === category).length})`,
    })),
  ];
  const activeButton = buttons.find((button) => button.id === productionState.recipeCategoryFilter) || buttons[0];
  const filterLabel = document.getElementById('recipe-category-filter-label');
  if (filterLabel) filterLabel.textContent = activeButton?.label || 'Alle Kategorien';

  filter.innerHTML = buttons.map((button) => `
    <button type="button" class="recipe-category-chip ${productionState.recipeCategoryFilter === button.id ? 'active-category' : ''}" data-category="${button.id}">
      ${button.label}
    </button>
  `).join('');
}

function filteredRecipesForKitchen(recipes) {
  const query = productionState.recipeSearchQuery.trim().toLowerCase();
  const category = productionState.recipeCategoryFilter;
  return recipes.filter((recipe) => {
    const categoryMatches = category === 'all' || recipeCategoryOf(recipe) === category;
    const queryMatches = !query || recipeSearchText(recipe).includes(query);
    return categoryMatches && queryMatches;
  });
}

function initRecipeSearchAndFilters() {
  const searchInput = document.getElementById('recipe-search-input');
  const categoryFilter = document.getElementById('recipe-category-filter');
  const categoryButton = document.getElementById('recipe-category-filter-button');
  const categorySheet = document.getElementById('recipe-category-sheet');
  const categoryBackdrop = document.getElementById('recipe-category-backdrop');
  const categoryClose = document.getElementById('recipe-category-sheet-close');

  const closeCategorySheet = () => {
    if (!categorySheet || !categoryBackdrop || !categoryButton) return;
    categorySheet.classList.add('hidden');
    categoryBackdrop.classList.add('hidden');
    categorySheet.hidden = true;
    categoryBackdrop.hidden = true;
    categoryButton.setAttribute('aria-expanded', 'false');
  };

  const openCategorySheet = () => {
    if (!categorySheet || !categoryBackdrop || !categoryButton) return;
    categorySheet.hidden = false;
    categoryBackdrop.hidden = false;
    categorySheet.classList.remove('hidden', 'closed');
    categoryBackdrop.classList.remove('hidden');
    categoryButton.setAttribute('aria-expanded', 'true');
  };

  if (searchInput && searchInput.dataset.eventsBound !== '1') {
    searchInput.dataset.eventsBound = '1';
    searchInput.addEventListener('input', (event) => {
      productionState.recipeSearchQuery = event.target.value || '';
      renderRecipes();
    });
  }

  if (categoryButton && categoryButton.dataset.eventsBound !== '1') {
    categoryButton.dataset.eventsBound = '1';
    categoryButton.addEventListener('click', openCategorySheet);
  }

  if (categoryBackdrop && categoryBackdrop.dataset.eventsBound !== '1') {
    categoryBackdrop.dataset.eventsBound = '1';
    categoryBackdrop.addEventListener('click', closeCategorySheet);
  }

  if (categoryClose && categoryClose.dataset.eventsBound !== '1') {
    categoryClose.dataset.eventsBound = '1';
    categoryClose.addEventListener('click', closeCategorySheet);
  }

  if (categoryFilter && categoryFilter.dataset.eventsBound !== '1') {
    categoryFilter.dataset.eventsBound = '1';
    categoryFilter.addEventListener('click', (event) => {
      const button = event.target.closest('.recipe-category-chip');
      if (!button) return;
      productionState.recipeCategoryFilter = button.dataset.category || 'all';
      renderRecipes();
      closeCategorySheet();
    });
  }
}

function renderRecipes() {
  const container = document.getElementById('recipe-list-container');
  if (!container) return;
  initRecipeSearchAndFilters();

  const recipes = recipesForKitchenList();
  const searchInput = document.getElementById('recipe-search-input');
  if (searchInput && searchInput.value !== productionState.recipeSearchQuery) {
    searchInput.value = productionState.recipeSearchQuery;
  }
  renderRecipeCategoryFilters(recipes);
  const visibleRecipes = filteredRecipesForKitchen(recipes);

  if (!recipes.length) {
    const emptyHint = shouldUseBratwurstMasterlist()
      ? (isFirebaseReady() ? 'Keine Rezepte in der Cloud. Seed läuft?' : 'Firebase nicht konfiguriert – Rezepte können nicht geladen werden.')
      : (isProductionAdmin()
        ? 'Noch keine Rezepte. Als Admin unten „Neues Rezept anlegen“ nutzen.'
        : 'Noch keine Rezepte hinterlegt. Bitte einen Admin bitten, Rezepte anzulegen.');
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        ${emptyHint}
      </div>`;
    return;
  }

  if (!visibleRecipes.length) {
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        Keine Rezepte f?r diese Suche/Kategorie gefunden.
      </div>`;
    return;
  }

  container.innerHTML = visibleRecipes.map(recipe => `
    <div class="recipe-card ${recipeIdsMatch(productionState.selectedRecipeId, recipe.id) ? 'active-recipe' : ''}" data-recipe-id="${String(recipe.id).replace(/"/g, '&quot;')}">
      <div class="recipe-meta-group">
        <span class="recipe-title">${recipe.name}</span>
        <span class="recipe-subinfo">${recipeCategoryOf(recipe)} - ${Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0} Zutaten${recipe.kaliber ? ' - ' + recipe.kaliber : ''}</span>
      </div>
      <div class="recipe-arrow">&gt;</div>
    </div>
  `).join('');
}
function resolveActiveRecipeForDetail(recipeId) {
  const resolvedId = String(recipeId);
  let recipe = getRecipeWithLocalFallback(resolvedId);
  if (!recipe) return null;

  if (shouldUseBratwurstMasterlist() && (!recipe.ingredients || recipe.ingredients.length === 0)) {
    const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, resolvedId));
    if (seedRecipe?.ingredients?.length) {
      recipe = { ...recipe, ingredients: [...seedRecipe.ingredients] };
    }
  }

  return ensureRecipeIngredients(recipe, resolvedId);
}

function closeRecipeDetailPanel() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel) return;
  panel.classList.remove('active');
  panel.style.display = '';
}

function initRecipeDetailPanelEvents() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel || panel.dataset.eventsBound === '1') return;
  panel.dataset.eventsBound = '1';

  panel.addEventListener('click', (event) => {
    if (event.target.closest('#btn-recipe-back')) {
      productionState.playClickSound(700, 0.05, 0.15);
      closeRecipeDetailPanel();
    }
  });
}

function openRecipeDetail(recipeId) {
  initRecipeDetailPanelEvents();

  productionState.selectedRecipeId = String(recipeId);

  const recipe = resolveActiveRecipeForDetail(productionState.selectedRecipeId);
  if (recipe) {
    productionState.activeRecipeDetail = recipe;
    populateRecipeDetailView(recipe);
    productionState.playClickSound(1000, 0.06, 0.15);
  }

  const panel = document.getElementById('recipe-detail-panel');
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'flex';
  }

  calculateIngredients();
};

// Zutaten-Berechnung
const inputProdTarget = document.getElementById('production-target');
const btnProdMinus = document.getElementById('btn-prod-minus');
const btnProdPlus = document.getElementById('btn-prod-plus');

function roundToButcherPrecision(gramm) {
  if (!Number.isFinite(gramm)) return 0;
  if (gramm >= 1000) return Math.round(gramm / 50) * 50;
  if (gramm >= 100) return Math.round(gramm / 5) * 5;
  return Math.round(gramm);
}

function formatButcherAmount(gramm) {
  if (!Number.isFinite(gramm)) return '0 g';
  if (gramm >= 1000) {
    const kg = gramm / 1000;
    return Number(kg.toFixed(2)).toString().replace('.', ',') + ' kg';
  }
  return Math.round(gramm).toString() + ' g';
}

function ingredientNameOf(ing) {
  return ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || ing?.Produkt
    || ing?.Producto
    || ing?.ingredient
    || ing?.Ingredient
    || ing?.label
    || ing?.Label
    || 'Unbekannte Zutat';
}

function ingredientPctOf(ing) {
  const raw = ing?.pct
    ?? ing?.Pct
    ?? ing?.Prozent
    ?? ing?.prozent
    ?? ing?.percent
    ?? ing?.Percent
    ?? ing?.Prozentwert
    ?? ing?.anteil
    ?? ing?.Anteil
    ?? ing?.['Anteil %']
    ?? ing?.['Anteil%'];
  if (raw === undefined || raw === null || raw === '') return NaN;
  const normalized = String(raw).replace('%', '').replace(',', '.').trim();
  const pct = parseFloat(normalized);
  return Number.isFinite(pct) ? pct : NaN;
}

function renderableIngredientCount(recipe) {
  const rows = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return rows.filter((ing) => ingredientNameOf(ing) && Number.isFinite(ingredientPctOf(ing))).length;
}

function validateBratwurstMasterlist() {
  const invalidRecipes = bratwurstRecipes
    .map((recipe) => ({
      id: recipe?.id,
      name: recipe?.name,
      ingredientCount: Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0,
      renderableCount: renderableIngredientCount(recipe),
    }))
    .filter((recipe) => !recipe.id || !recipe.name || recipe.ingredientCount === 0 || recipe.renderableCount !== recipe.ingredientCount);

  if (invalidRecipes.length) {
    console.error('[CharcuLogic Wurstküche] MASTERLISTE UNVOLLSTÄNDIG:', invalidRecipes);
    return false;
  }

  console.info(`[CharcuLogic Wurstkueche] ${bratwurstRecipes.length} Rezepte lokal validiert.`);
  return true;
}

function isRezeptAuditEnabled() {
  return window.BRANDING?.modules?.rezeptAudit !== false;
}

function validateCloudRecipesAgainstMasterlist(cloudRecipes = productionState.recipes) {
  if (!shouldUseBratwurstMasterlist() || !isRezeptAuditEnabled()) return null;

  const missing = [];
  const incomplete = [];
  const cloudCount = Array.isArray(cloudRecipes) ? cloudRecipes.length : 0;

  bratwurstRecipes.forEach((localRecipe) => {
    const cloudRecipe = cloudRecipes.find((entry) =>
      recipeIdsMatch(entry.id, localRecipe.id) || recipeIdsMatch(entry.docId, localRecipe.id) || recipeIdsMatch(entry.firestoreId, localRecipe.id)
    );
    const localCount = renderableIngredientCount(localRecipe);
    const cloudRenderable = renderableIngredientCount(cloudRecipe);

    if (!cloudRecipe) {
      missing.push(localRecipe.id);
    } else if (cloudRenderable < localCount) {
      incomplete.push({
        id: localRecipe.id,
        cloud: cloudRenderable,
        master: localCount,
      });
    }
  });

  const audit = {
    masterCount: bratwurstRecipes.length,
    cloudCount,
    missing,
    incomplete,
    ok: missing.length === 0 && incomplete.length === 0 && cloudCount >= bratwurstRecipes.length,
  };
  productionState.recipeCloudAudit = audit;
  renderRecipeCloudAudit();
  return audit;
}

function renderRecipeCloudAudit() {
  const card = document.getElementById('recipe-cloud-audit-card');
  if (!isRezeptAuditEnabled() || card?.hidden) return;

  const masterEl = document.getElementById('audit-master-count');
  const cloudEl = document.getElementById('audit-cloud-count');
  const statusEl = document.getElementById('audit-cloud-status');
  const detailEl = document.getElementById('audit-cloud-detail');
  if (!masterEl || !cloudEl || !statusEl || !detailEl) return;

  const audit = productionState.recipeCloudAudit;
  if (!audit) {
    masterEl.textContent = String(bratwurstRecipes.length);
    cloudEl.textContent = '-';
    statusEl.textContent = 'Warte auf Daten';
    detailEl.textContent = 'Die Rezeptdaten werden automatisch geprüft, sobald Firestore antwortet.';
    return;
  }

  masterEl.textContent = String(audit.masterCount);
  cloudEl.textContent = String(audit.cloudCount);
  statusEl.textContent = audit.ok ? 'Vollständig' : 'Prüfen';
  statusEl.style.color = audit.ok ? '#1B5E20' : '#B71C1C';

  if (audit.ok) {
    detailEl.textContent = 'Alle Master-Rezepte sind in der Cloud vorhanden und besitzen vollständige Zutatenlisten.';
    return;
  }

  const missingText = audit.missing.length ? `Fehlt: ${audit.missing.slice(0, 4).join(', ')}${audit.missing.length > 4 ? ' ...' : ''}.` : '';
  const incompleteText = audit.incomplete.length ? `Unvollständig: ${audit.incomplete.map((item) => `${item.id} (${item.cloud}/${item.master})`).slice(0, 3).join(', ')}${audit.incomplete.length > 3 ? ' ...' : ''}.` : '';
  detailEl.textContent = `${missingText} ${incompleteText}`.trim() || 'Cloud-Bestand weicht von der Masterliste ab.';
}

function updateRecipeDataSourceBadge(source) {
  const badge = document.getElementById('recipe-data-source-badge');
  if (!badge) return;

  const isCloud = source === 'cloud';
  badge.textContent = isCloud ? '🟢 Live-Cloud' : '🟡 Lokaler Speicher (Sicherheitsgurt)';
  badge.style.background = isCloud ? '#E8F5E9' : '#FFF8E1';
  badge.style.color = isCloud ? '#1B5E20' : '#8A5A00';
  badge.style.border = isCloud ? '1px solid #A5D6A7' : '1px solid #FFE082';
}

function calculateIngredients() {
  const listContainer = document.getElementById('recipe-ingredients-list');
  if (!listContainer) {
    console.error('Kritisch: #recipe-ingredients-list fehlt im statischen HTML.');
    return;
  }

  if (!productionState.selectedRecipeId) {
    console.error('[CharcuLogic Wurstkueche] calculateIngredients(): Keine selectedRecipeId gesetzt.');
    return;
  }

  const cloudRecipe = productionState.recipes.find(r => recipeIdsMatch(r.id, productionState.selectedRecipeId));
  const localRecipe = shouldUseBratwurstMasterlist()
    ? bratwurstRecipes.find(r => recipeIdsMatch(r.id, productionState.selectedRecipeId))
    : null;
  const cloudRenderableCount = renderableIngredientCount(cloudRecipe);
  const localRenderableCount = renderableIngredientCount(localRecipe);
  let activeRecipe = cloudRecipe;
  let dataSource = 'cloud';

  // SKELETT-FALLE KORREKTUR (nur StevesHof-Masterliste):
  // Wenn Cloud fehlt oder weniger renderbare Zutaten als die Masterliste hat -> lokale Vollversion nutzen.
  if (shouldUseBratwurstMasterlist()
    && (!activeRecipe || cloudRenderableCount === 0 || localRenderableCount > cloudRenderableCount)) {
    activeRecipe = localRecipe;
    dataSource = 'local';
  }

  const ingredients = Array.isArray(activeRecipe?.ingredients) ? activeRecipe.ingredients : [];
  productionState.activeRecipeDetail = activeRecipe || productionState.activeRecipeDetail;
  productionState.activeRecipeDataSource = dataSource;
  updateRecipeDataSourceBadge(dataSource);

  listContainer.innerHTML = '';

  if (!ingredients.length) {
    listContainer.innerHTML = "<div style='color:red; padding:15px; font-weight:bold;'>&#9888;&#65039; Keine Zutaten in den Daten gefunden!</div>";
    return;
  }

  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  let targetKg = parseFloat(rawInput);
  if (!Number.isFinite(targetKg) || targetKg <= 0) {
    targetKg = productionState.productionTargetKg || 10;
  }
  productionState.productionTargetKg = targetKg;

  ingredients.forEach((ing) => {
    try {
      const zutatName = ingredientNameOf(ing);
      const zutatPct = ingredientPctOf(ing);
      if (!Number.isFinite(zutatPct)) return;

      const amountG = (targetKg * 1000) * (zutatPct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      const amountStr = formatButcherAmount(roundedG);
      const pctText = `${zutatPct.toFixed(2).replace('.', ',')}%`;
      const rowHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 2px solid #eee; background: #fff; font-size: 18px;">
          <div style="font-weight: bold; flex: 2; color: #333;">${zutatName}</div>
          <div style="flex: 1; text-align: center; color: #666;">${pctText}</div>
          <div style="flex: 1; text-align: right; font-weight: 900; color: #2E7D32; font-size: 20px;">${amountStr}</div>
        </div>
      `;

      listContainer.insertAdjacentHTML('beforeend', rowHTML);
    } catch (e) {
      console.error('Fehler bei Zutat:', ing, e);
    }
  });
}

function currentProductionTargetKg() {
  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  const targetKg = parseFloat(rawInput);
  return Number.isFinite(targetKg) && targetKg > 0 ? targetKg : productionState.productionTargetKg || 10;
}

function scaledIngredientsForRecipe(recipe, targetKg) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return ingredients
    .map((ing) => {
      const pct = ingredientPctOf(ing);
      if (!Number.isFinite(pct)) return null;
      const amountG = (targetKg * 1000) * (pct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      return {
        name: ingredientNameOf(ing),
        pct,
        amountG: roundedG,
        amountText: formatButcherAmount(roundedG),
        typ: ing.typ || ing.Typ || '',
        allergen: Boolean(ing.allergen || ing.Allergen),
        hinweis: ing.hinweis || ing.Hinweis || '',
      };
    })
    .filter(Boolean);
}

function generateRecipeBatchNumber(recipeId) {
  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const cleanId = String(recipeId || 'REZEPT').replace(/[^A-Za-z0-9]+/g, '').slice(0, 8).toUpperCase() || 'REZEPT';
  const suffix = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  return `CH-${dateStr}-${cleanId}-${suffix}`;
}

function buildLabelBasis(recipe, scaledIngredients, targetKg) {
  const allergene = Array.isArray(recipe?.allergene)
    ? recipe.allergene.filter(Boolean)
    : scaledIngredients.filter((ing) => ing.allergen).map((ing) => ing.name);
  const sortedIngredients = [...scaledIngredients].sort((a, b) => (b.amountG || 0) - (a.amountG || 0));

  return {
    status: 'vorbereitet',
    druckSchnittstelle: 'Ausbaustufe 2',
    etikettenAnzahl: null,
    produktname: recipe?.name || '',
    nettoFuellmengeKg: targetKg,
    zutatenlisteVorbereitet: sortedIngredients.map((ing) => ing.name).join(', '),
    quidBasis: sortedIngredients.map((ing) => ({
      name: ing.name,
      pct: ing.pct,
      amountG: ing.amountG,
    })),
    allergene,
    preisBasis: {
      status: 'offen',
      ziel: 'Preis je Etikett/Packung in Ausbaustufe 2 berechnen',
    },
    barcodeBasis: {
      status: 'offen',
      ziel: 'Barcode-Drucker und Etikettenanzahl in Ausbaustufe 2 anbinden',
    },
  };
}

function readProductionUnits() {
  const readNumber = (id) => {
    const value = parseInt(document.getElementById(id)?.value || '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const units = {
    grosskaliber: readNumber('recipe-unit-large'),
    sbPackungen: readNumber('recipe-unit-sb'),
    loseStueck: readNumber('recipe-unit-loose'),
    glaeserDosen: readNumber('recipe-unit-glass'),
    notiz: document.getElementById('recipe-unit-note')?.value.trim() || '',
  };
  units.gesamt = units.grosskaliber + units.sbPackungen + units.loseStueck + units.glaeserDosen;
  return units;
}

const PRODUCTION_FORM_FIELDS = [
  'recipe-batch-maker', 'recipe-batch-ph', 'recipe-batch-core-temp',
  'recipe-batch-deviations', 'recipe-unit-large', 'recipe-unit-sb',
  'recipe-unit-loose', 'recipe-unit-glass', 'recipe-unit-note',
];

const RECIPE_CREATE_FORM_FIELDS = [
  'recipe-create-name', 'recipe-create-category', 'recipe-create-haltbar',
  'recipe-create-mhd-days',
];

function buildMhdRecordFromProductionBatch({ recipe, batchNumber, targetKg, maker }) {
  const standardMhdTage = parseInt(recipe?.standardMhdTage, 10);
  if (!Number.isFinite(standardMhdTage) || standardMhdTage < 0) return null;

  const mhdPath = mhdListeCollectionPath();
  if (!mhdPath) return null;

  const mhdDateObj = addDaysToToday(standardMhdTage);
  const mhdDateIso = formatIsoDateLocal(mhdDateObj);
  const postenId = `${getSafeFirestoreId(batchNumber)}_${Date.now().toString(36)}`;
  const qty = Math.max(1, Math.round(targetKg) || 1);
  const actor = maker || productionState.getAuditActorName?.() || '';

  return {
    collectionPath: mhdPath,
    docId: postenId,
    onlineData: {
      id: postenId,
      postenId,
      produkt: recipe.name,
      name: recipe.name,
      marke: '',
      brand: '',
      mhd: mhdDateIso,
      mhdDate: mhdDateIso,
      mhdText: `${standardMhdTage} Resttage`,
      mhdTimestamp: mhdDateObj,
      date: mhdDateObj.toLocaleDateString('de-DE'),
      tage: standardMhdTage,
      resttage: standardMhdTage,
      status: 'aktiv',
      qty,
      menge: targetKg,
      eingangMenge: targetKg,
      mengeEinheit: 'kg',
      einheit: 'kg',
      kategorie: recipe.kat || 'Eigenproduktion',
      warenKategorie: recipe.kat || 'Eigenproduktion',
      soldOut: false,
      lot: batchNumber,
      chargenNummer: batchNumber,
      lieferant: EIGENPRODUKTION_SUPPLIER,
      source: EIGENPRODUKTION_SOURCE,
      postentyp: EIGENPRODUKTION_SOURCE,
      wareneingangAt: new Date().toISOString(),
      scannedBy: actor,
      tenantId: productionState.tenantId || getGlobalTenantId(),
      updatedAt: serverTimestampFallback(),
    },
    queueData: null,
  };
}

async function syncMhdEntryFromProductionBatch(context) {
  const mhdWrite = buildMhdRecordFromProductionBatch(context);
  if (!mhdWrite) return null;

  const queuePayload = {
    ...mhdWrite.onlineData,
    mhdTimestamp: mhdWrite.onlineData.mhdDate,
    updatedAt: new Date().toISOString(),
  };

  await productionState.writeOrQueueFirestore({
    collectionPath: mhdWrite.collectionPath,
    docId: mhdWrite.docId,
    op: 'set',
    onlineData: mhdWrite.onlineData,
    queueData: queuePayload,
    offlineMessage: 'MHD-Posten wird nachträglich synchronisiert.',
  });

  return mhdWrite.docId;
}

async function createRecipeFromForm() {
  if (!isProductionAdmin()) {
    productionState.showHUD('Keine Berechtigung', 'Nur Admins können Rezepte anlegen.', '!');
    return;
  }

  const name = document.getElementById('recipe-create-name')?.value.trim() || '';
  const kat = document.getElementById('recipe-create-category')?.value.trim() || 'Hauptgericht';
  const haltbar = document.getElementById('recipe-create-haltbar')?.value.trim() || '';
  const mhdDaysRaw = document.getElementById('recipe-create-mhd-days')?.value;
  const standardMhdTage = parseInt(String(mhdDaysRaw ?? '').trim(), 10);

  if (!name) {
    productionState.showHUD('Name fehlt', 'Bitte einen Rezeptnamen eintragen.', '!');
    return;
  }
  if (!Number.isFinite(standardMhdTage) || standardMhdTage < 0) {
    productionState.showHUD('MHD-Tage fehlen', 'Bitte gültige Haltbarkeit in Tagen eintragen (z. B. 3).', '!');
    return;
  }

  const collectionPath = rezepteCollectionPath();
  if (!collectionPath) {
    productionState.showHUD('Mandant fehlt', 'Rezept konnte keinem Betrieb zugeordnet werden.', '!');
    return;
  }

  const logicalId = slugRecipeIdFromName(name);
  if (!logicalId) {
    productionState.showHUD('Ungültiger Name', 'Der Rezeptname ergibt keine gültige ID.', '!');
    return;
  }

  const existing = productionState.recipes.find(
    (entry) => recipeIdsMatch(entry.id, logicalId) || recipeIdsMatch(entry.docId, logicalId),
  );
  if (existing) {
    productionState.showHUD('Rezept existiert', `„${name}" ist bereits hinterlegt.`, '!');
    return;
  }

  const tenantId = requireProductionTenantId();
  const recipePayload = {
    id: logicalId,
    firestoreId: logicalId,
    name,
    kat,
    haltbar: haltbar || `${standardMhdTage} Tage bei < 4°C`,
    standardMhdTage,
    kaliber: '',
    basis_g: '1.000,00',
    allergene: [],
    ingredients: [],
    hinweis: '',
    tipp: '',
    anweisung_A: '',
    anweisung_B: '',
    anweisung_C: '',
    anweisung_D: '',
    tenantId,
    createdAt: serverTimestampFallback(),
  };

  const saveBtn = document.getElementById('btn-recipe-create-save');
  try {
    if (saveBtn) saveBtn.disabled = true;
    await productionState.writeOrQueueFirestore({
      collectionPath,
      docId: logicalId,
      op: 'set',
      onlineData: recipePayload,
      queueData: { ...recipePayload, createdAt: new Date().toISOString() },
      offlineMessage: 'Rezept wird nachträglich synchronisiert.',
    });

    RECIPE_CREATE_FORM_FIELDS.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) field.value = '';
    });

    productionState.showHUD('Rezept gespeichert', `„${name}" wurde angelegt.`);
    productionState.playClickSound(1200, 0.06, 0.15);
    renderRecipes();
  } catch (error) {
    console.error('[CharcuLogic Firebase] Rezept anlegen fehlgeschlagen:', error);
    productionState.showHUD('Fehler', 'Rezept konnte nicht gespeichert werden.', '!');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function initRecipeCreateForm() {
  const formPanel = document.getElementById('kitchen-recipe-create-panel');
  const saveBtn = document.getElementById('btn-recipe-create-save');
  if (!formPanel || !saveBtn || saveBtn.dataset.productionBound === '1') return;
  saveBtn.dataset.productionBound = '1';
  saveBtn.addEventListener('click', async () => {
    productionState.playClickSound(1100, 0.05, 0.12);
    await createRecipeFromForm();
  });
}

async function documentRecipeBatch() {
  if (productionState.batchDocumentInFlight) return;
  if (!productionState.selectedRecipeId) {
    productionState.showHUD("⚠️ Kein Rezept", "Bitte zuerst ein Rezept öffnen.", "⚠️");
    return;
  }

  const recipe = productionState.activeRecipeDetail || resolveActiveRecipeForDetail(productionState.selectedRecipeId);
  if (!recipe) {
    productionState.showHUD("⚠️ Rezept fehlt", "Die Charge konnte keinem Rezept zugeordnet werden.", "⚠️");
    return;
  }

  const maker = document.getElementById('recipe-batch-maker')?.value.trim() || '';
  if (!maker) {
    productionState.showHUD("⚠️ Macher fehlt", "Bitte eintragen, wer die Charge hergestellt hat.", "⚠️");
    return;
  }


  const targetKg = currentProductionTargetKg();
  const scaledIngredients = scaledIngredientsForRecipe(recipe, targetKg);
  const labelBasis = buildLabelBasis(recipe, scaledIngredients, targetKg);
  const verkaufsEinheiten = readProductionUnits();
  labelBasis.etikettenAnzahl = verkaufsEinheiten.gesamt || null;
  const phRaw = document.getElementById('recipe-batch-ph')?.value;
  const tempRaw = document.getElementById('recipe-batch-core-temp')?.value;
  const phValue = phRaw ? parseFloat(String(phRaw).replace(',', '.')) : null;
  const coreTempValue = tempRaw ? parseFloat(String(tempRaw).replace(',', '.')) : null;
  const batchNumber = generateRecipeBatchNumber(recipe.id);

  const batchEntry = {
    chargenNummer: batchNumber,
    rezeptId: recipe.id,
    rezeptName: recipe.name,
    kategorie: recipe.kat || '',
    produktionsmengeKg: targetKg,
    macher: maker,
    phWert: Number.isFinite(phValue) ? phValue : null,
    kerntemperatur: Number.isFinite(coreTempValue) ? coreTempValue : null,
    abweichungen: document.getElementById('recipe-batch-deviations')?.value.trim() || '',
    datenquelle: productionState.activeRecipeDataSource,
    zutatenBerechnet: scaledIngredients,
    verkaufsEinheiten,
    etikettBasis: labelBasis,
    tenantId: productionState.tenantId,
    zeitstempel: serverTimestampFallback(),
  };

  const batchBtn = document.getElementById('btn-document-recipe-batch');

  try {
    productionState.batchDocumentInFlight = true;
    if (batchBtn) batchBtn.disabled = true;
        const collectionPath = productionBatchesCollectionPath();
        if (!collectionPath) {
            productionState.showHUD("Mandant fehlt", "Die Charge konnte keinem Betrieb zugeordnet werden.");
            return;
        }

        await productionState.writeOrQueueFirestore({
          collectionPath,
          docId: batchNumber,
          op: 'set',
          onlineData: batchEntry,
          queueData: { ...batchEntry, zeitstempel: new Date().toISOString() },
          offlineMessage: 'Charge wird nachträglich synchronisiert.',
        });

    let mhdPostenId = null;
    let mhdSyncFailed = false;
    try {
      mhdPostenId = await syncMhdEntryFromProductionBatch({
        recipe,
        batchNumber,
        targetKg,
        maker,
      });
    } catch (mhdError) {
      mhdSyncFailed = true;
      console.error('[CharcuLogic Firebase] MHD-Posten aus Charge fehlgeschlagen:', mhdError);
      productionState.showHUD(
        'Charge gespeichert',
        `${batchNumber} wurde dokumentiert, aber der MHD-Posten konnte nicht angelegt werden.`,
        '!',
      );
    }

    productionState.onFormSaved(PRODUCTION_FORM_FIELDS);
    if (!mhdSyncFailed) {
      if (mhdPostenId) {
        productionState.showHUD(
          'Charge dokumentiert',
          `${batchNumber} gespeichert – MHD-Posten „${recipe.name}" angelegt.`,
        );
      } else {
        productionState.showHUD('Charge dokumentiert', `${batchNumber} wurde gespeichert.`);
      }
    }
    productionState.productionBatches = [{ ...batchEntry, id: batchNumber, zeitstempel: new Date() }, ...productionState.productionBatches]
      .filter((batch, index, self) => self.findIndex((entry) => entry.id === batch.id) === index)
      .slice(0, 50);
    renderProductionBatches();
    const deviations = document.getElementById('recipe-batch-deviations');
    if (deviations) deviations.value = '';
    ['recipe-unit-large', 'recipe-unit-sb', 'recipe-unit-loose', 'recipe-unit-glass', 'recipe-unit-note'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
  } catch (error) {
    console.error('[CharcuLogic Firebase] Charge speichern fehlgeschlagen:', error);
    productionState.showHUD("⚠️ Fehler", "Charge konnte nicht gespeichert werden.", "⚠️");
  } finally {
    productionState.batchDocumentInFlight = false;
    if (batchBtn) batchBtn.disabled = false;
  }
}

function initProductionControls() {
  if (inputProdTarget) {
    inputProdTarget.addEventListener('input', (e) => {
      let val = parseFloat(String(e.target.value).replace(',', '.'));
      if (isNaN(val) || val <= 0) val = 0.5;
      productionState.productionTargetKg = val;
      calculateIngredients();
    });
  }

  if (btnProdMinus) {
    btnProdMinus.addEventListener('click', () => {
      productionState.productionTargetKg = Math.max(0.5, productionState.productionTargetKg - 0.5);
      inputProdTarget.value = productionState.productionTargetKg.toFixed(1);
      productionState.playClickSound(1100, 0.03, 0.12);
      inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  if (btnProdPlus) {
    btnProdPlus.addEventListener('click', () => {
      productionState.productionTargetKg = Math.min(500, productionState.productionTargetKg + 0.5);
      inputProdTarget.value = productionState.productionTargetKg.toFixed(1);
      productionState.playClickSound(1400, 0.03, 0.12);
      inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const btnDocumentRecipeBatch = document.getElementById('btn-document-recipe-batch');
  if (btnDocumentRecipeBatch) {
    btnDocumentRecipeBatch.addEventListener('click', async () => {
      productionState.playClickSound(1150, 0.08, 0.18);
      await documentRecipeBatch();
    });
  }
}

function bindRecipeListEvents() {
  const container = document.getElementById('recipe-list-container');
  if (!container || container.dataset.productionBound === '1') return;
  container.dataset.productionBound = '1';
  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-recipe-id]');
    if (!card) return;
    openRecipeDetail(card.dataset.recipeId);
  });
}

export function initProductionModule(databaseInstance, writeOrQueueFirestoreFunction, soundAPI = {}, showHudCallback, options = {}) {
  productionState.db = databaseInstance || productionState.db;
  productionState.writeOrQueueFirestore = writeOrQueueFirestoreFunction || productionState.writeOrQueueFirestore;
  productionState.playClickSound = soundAPI.playClickSound || soundAPI.playFeedbackSound || productionState.playClickSound;
  productionState.showHUD = showHudCallback || productionState.showHUD;
  productionState.tenantId = options.tenantId || productionState.tenantId;
  productionState.getFirebase = options.getFirebase || productionState.getFirebase;
  productionState.onFormSaved = typeof options.onFormSaved === 'function' ? options.onFormSaved : productionState.onFormSaved;
  productionState.restoreDraftFields = typeof options.restoreDraftFields === 'function'
    ? options.restoreDraftFields
    : productionState.restoreDraftFields;
  productionState.getAuditActorName = typeof options.getAuditActorName === 'function'
    ? options.getAuditActorName
    : productionState.getAuditActorName;

  if (!productionState.initialized) {
    initRecipeSearchAndFilters();
    initBatchArchiveSearch();
    initRecipeDetailPanelEvents();
    bindRecipeListEvents();
    initRecipeCreateForm();
    initProductionControls();
    productionState.initialized = true;
  }

  syncRecipeAdminFormVisibility();
  renderRecipeCloudAudit();
  renderRecipes();
  renderProductionBatches();
  restoreProductionDraftFields();
}

export function disableProductionModule() {
  if (productionState.recipesUnsubscribe) {
    productionState.recipesUnsubscribe();
    productionState.recipesUnsubscribe = null;
  }
  if (productionState.productionBatchesUnsubscribe) {
    productionState.productionBatchesUnsubscribe();
    productionState.productionBatchesUnsubscribe = null;
  }
  productionState.recipes = [];
  productionState.productionBatches = [];
  productionState.tenantId = '';
}

function restoreProductionDraftFields() {
  productionState.restoreDraftFields(PRODUCTION_FORM_FIELDS);
}

function syncRecipeAdminFormVisibility() {
  const panel = document.getElementById('kitchen-recipe-create-panel');
  if (!panel) return;
  const visible = isProductionAdmin();
  panel.hidden = !visible;
  panel.classList.toggle('hidden', !visible);
}

export function activateKitchenTab() {
  productionState.activeTab = 'kitchen';
  syncRecipeAdminFormVisibility();
  renderRecipes();
  restoreProductionDraftFields();
  window.applyProfileKitchenRestrictions?.();
}

export function activateBatchesTab() {
  productionState.activeTab = 'batches';
  if (isRezeptAuditEnabled()) renderRecipeCloudAudit();
  renderProductionBatches();
  restoreProductionDraftFields();
}

export {
  calculateIngredients,
  createRecipeFromForm,
  documentRecipeBatch as saveCharge,
  filteredProductionBatches as searchChargen,
  filteredRecipesForKitchen as searchRecipes,
  importBratwurstRecipesToCloud,
  loadProductionBatchesFromCloud,
  loadRecipesFromCloud,
  renderProductionBatches as renderChargenList,
  renderProductionBatches,
  renderRecipes,
  syncRecipeAdminFormVisibility,
};
