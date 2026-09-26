/* @charculogic/core browser build. Generated file, edit the package sources. */

// src/data/gevoProfiles.ts
var GEVO_PROFILES = {
  S_I: {
    id: "S_I",
    label: "Schweinefleisch mager (sehnenfrei)",
    species: "schwein",
    lsCode: "LS 1.2.1.2.1",
    proteinAvgPct: 20,
    fatAvgPct: 5,
    connectiveTissueAvgPct: 1,
    waterAvgPct: 75
  },
  S_II: {
    id: "S_II",
    label: "Schweinefleisch grob entfettet",
    species: "schwein",
    lsCode: "LS 1.2.1.2.1",
    proteinAvgPct: 19,
    fatAvgPct: 8,
    connectiveTissueAvgPct: 1.5,
    waterAvgPct: 73
  },
  S_III: {
    id: "S_III",
    label: "Schweinefleisch sehnenreich",
    species: "schwein",
    lsCode: "LS 1.2.1.2.1",
    proteinAvgPct: 19,
    fatAvgPct: 11,
    connectiveTissueAvgPct: 2.9,
    waterAvgPct: 70
  },
  S_IV: {
    id: "S_IV",
    label: "Schweinebauch / Schulter mittelfett",
    species: "schwein",
    lsCode: "LS 1.2.1.2.2",
    proteinAvgPct: 14,
    fatAvgPct: 33,
    connectiveTissueAvgPct: 2.1,
    waterAvgPct: 53
  },
  S_V: {
    id: "S_V",
    label: "Schweinebauch fett / mit Schwarte",
    species: "schwein",
    lsCode: "LS 1.2.1.2.2",
    proteinAvgPct: 8,
    fatAvgPct: 60,
    connectiveTissueAvgPct: 1.2,
    waterAvgPct: 32
  },
  S_VI: {
    id: "S_VI",
    label: "Schweinekopffleisch",
    species: "schwein",
    lsCode: "LS 1.1.1.2",
    proteinAvgPct: 20,
    fatAvgPct: 29,
    connectiveTissueAvgPct: 5.1,
    waterAvgPct: 51
  },
  S_VII: {
    id: "S_VII",
    label: "Backenspeck / Schulterspeck",
    species: "schwein",
    lsCode: "LS 1.1.1.2.2",
    proteinAvgPct: 2.6,
    fatAvgPct: 90,
    connectiveTissueAvgPct: 1.7,
    waterAvgPct: 8
  },
  S_VIII: {
    id: "S_VIII",
    label: "R\xFCckenspeck / Kutterfett",
    species: "schwein",
    lsCode: "LS 1.1.1.2.2",
    proteinAvgPct: 5,
    fatAvgPct: 70,
    connectiveTissueAvgPct: 2.5,
    waterAvgPct: 25
  },
  S_IX: {
    id: "S_IX",
    label: "Fettzuschnitte",
    species: "schwein",
    lsCode: "LS 1.1.1.2",
    proteinAvgPct: 3.5,
    fatAvgPct: 80,
    connectiveTissueAvgPct: 1.5,
    waterAvgPct: 15
  },
  S_X: {
    id: "S_X",
    label: "Wamme mittelfett",
    species: "schwein",
    lsCode: "LS 1.1.1.2.2",
    proteinAvgPct: 10,
    fatAvgPct: 50,
    connectiveTissueAvgPct: 3,
    waterAvgPct: 40
  },
  S_LEBER: {
    id: "S_LEBER",
    label: "Schweineleber",
    species: "schwein",
    lsCode: "LS 1.1.1.6",
    proteinAvgPct: 19,
    fatAvgPct: 5,
    connectiveTissueAvgPct: 1,
    waterAvgPct: 76
  },
  R_I: {
    id: "R_I",
    label: "Rindfleisch mager (sehnenarm)",
    species: "rind",
    lsCode: "LS 1.2.1.1.1",
    proteinAvgPct: 21,
    fatAvgPct: 4,
    connectiveTissueAvgPct: 1.5,
    waterAvgPct: 75
  },
  R_II: {
    id: "R_II",
    label: "Rindfleisch grob entsehnt",
    species: "rind",
    lsCode: "LS 1.2.1.1.1",
    proteinAvgPct: 20,
    fatAvgPct: 8,
    connectiveTissueAvgPct: 3,
    waterAvgPct: 72
  },
  R_III: {
    id: "R_III",
    label: "Rindfleisch sehnenreich",
    species: "rind",
    lsCode: "LS 1.2.1.1.2",
    proteinAvgPct: 19,
    fatAvgPct: 12,
    connectiveTissueAvgPct: 3.4,
    waterAvgPct: 69
  },
  R_IV: {
    id: "R_IV",
    label: "Rinder-Kernfett / fettgewebereich",
    species: "rind",
    lsCode: "LS 1.1.1.2.3",
    proteinAvgPct: 12,
    fatAvgPct: 25,
    connectiveTissueAvgPct: 2,
    waterAvgPct: 50
  },
  R_V: {
    id: "R_V",
    label: "Rindfleisch fett (> 30 %)",
    species: "rind",
    lsCode: "LS 1.2.1.1.2 / 1.1.1.2.3",
    proteinAvgPct: 11,
    fatAvgPct: 35,
    connectiveTissueAvgPct: 2,
    waterAvgPct: 45
  }
};
function getGevoProfile(cutId) {
  return GEVO_PROFILES[cutId];
}

// src/calculator.ts
function calculateBeffe(meatProteinKg, connectiveTissueProteinKg) {
  const meatProtein = Number.isFinite(meatProteinKg) ? meatProteinKg : 0;
  const connectiveTissueProtein = Number.isFinite(connectiveTissueProteinKg) ? connectiveTissueProteinKg : 0;
  const beffeAbsoluteKg = Math.max(0, meatProtein - connectiveTissueProtein);
  const beffeInMeatProteinPct = meatProtein > 0 ? beffeAbsoluteKg / meatProtein * 100 : null;
  return { beffeAbsoluteKg, beffeInMeatProteinPct };
}
function calculateMeatComposition(components) {
  let rawMeatWeightKg = 0;
  let meatProteinKg = 0;
  let connectiveTissueProteinKg = 0;
  for (const component of components) {
    const weightKg = Number.isFinite(component.weightKg) ? component.weightKg : 0;
    const profile = getGevoProfile(component.cutId);
    const proteinAvgPct = Number.isFinite(component.proteinAvgPct) ? component.proteinAvgPct : profile.proteinAvgPct;
    const connectiveTissueAvgPct = Number.isFinite(component.connectiveTissueAvgPct) ? component.connectiveTissueAvgPct : profile.connectiveTissueAvgPct;
    rawMeatWeightKg += weightKg;
    meatProteinKg += weightKg * (proteinAvgPct / 100);
    connectiveTissueProteinKg += weightKg * (connectiveTissueAvgPct / 100);
  }
  const beffe = calculateBeffe(meatProteinKg, connectiveTissueProteinKg);
  return {
    rawMeatWeightKg,
    meatProteinKg,
    connectiveTissueProteinKg,
    beffeAbsoluteKg: beffe.beffeAbsoluteKg,
    beffeInMeatProteinPct: beffe.beffeInMeatProteinPct
  };
}

// src/data/leitsatzProfiles.ts
var HACKFLEISCH_LEITSAETZE = [
  { id: "tatar", label: "Tatar / Schabefleisch", maxFatPct: 6, minBeffeMassPct: 18 },
  { id: "rind", label: "Rinderhackfleisch", maxFatPct: 20, minBeffeMassPct: 14 },
  { id: "schwein", label: "Schweinehackfleisch", maxFatPct: 35, minBeffeMassPct: 11.5 },
  { id: "gemischt", label: "Gemischtes Hackfleisch (Rind/Schwein)", maxFatPct: 30, minBeffeMassPct: 12.5 }
];
var FINISHED_PRODUCT_BEFFE_MINIMA = [
  { id: "rohwurst", label: "Rohwurst", minBeffeGPer100g: 11 },
  { id: "schnittfesteRohwurst", label: "Schnittfeste Rohwurst", minBeffeGPer100g: 11 },
  { id: "bruehwurst", label: "Br\xFChwurst", minBeffeGPer100g: 10 },
  { id: "kochwurst", label: "Kochwurst", minBeffeGPer100g: 8 },
  { id: "schinken", label: "Schinken", minBeffeGPer100g: 13 },
  { id: "spezialitaet", label: "Spezialit\xE4t", minBeffeGPer100g: 9 }
];

// src/lmiv/allergens.ts
var ALLERGENS = [
  { key: "gluten", labelDe: "Gluten" },
  { key: "crustaceans", labelDe: "Krebstiere" },
  { key: "eggs", labelDe: "Eier" },
  { key: "fish", labelDe: "Fisch" },
  { key: "peanuts", labelDe: "Erdn\xFCsse" },
  { key: "soy", labelDe: "Soja" },
  { key: "milk", labelDe: "Milch" },
  { key: "nuts", labelDe: "Schalenfr\xFCchte" },
  { key: "celery", labelDe: "Sellerie" },
  { key: "mustard", labelDe: "Senf" },
  { key: "sesame", labelDe: "Sesam" },
  { key: "sulphites", labelDe: "Schwefeldioxid und Sulfite" },
  { key: "lupin", labelDe: "Lupinen" },
  { key: "molluscs", labelDe: "Weichtiere" }
];
var ALLERGEN_KEYS = ALLERGENS.map((entry) => entry.key);

// src/lmiv/additives.ts
var ADDITIVES = {
  KHM: { name: "Diphosphate", additiveClass: "Stabilisator", eNumber: "E 450" },
  DIPHOSPHAT: { name: "Diphosphate", additiveClass: "Stabilisator", eNumber: "E 450" },
  TRIPHOSPHAT: { name: "Triphosphate", additiveClass: "Stabilisator", eNumber: "E 451" },
  POLYPHOSPHAT: { name: "Polyphosphate", additiveClass: "Stabilisator", eNumber: "E 452" },
  ASCORBIN: { name: "Ascorbins\xE4ure", additiveClass: "Antioxidationsmittel", eNumber: "E 300" },
  ERYTHORBAT: { name: "Natriumerythorbat", additiveClass: "Antioxidationsmittel", eNumber: "E 316" },
  GDL: { name: "Glucono-delta-Lacton", additiveClass: "S\xE4uerungsmittel", eNumber: "E 575" },
  CITRAT: { name: "Natriumcitrat", additiveClass: "Stabilisator", eNumber: "E 331" }
};
function lookupAdditive(name) {
  const key = name.trim().toUpperCase().replace(/\s+/g, "");
  return ADDITIVES[key];
}

// src/lmiv/declarationEngine.ts
var FAT_CUTS = /* @__PURE__ */ new Set(["S_VII", "S_VIII", "R_V"]);
var WATER_OMIT_BELOW_PCT = 5;
function roundQuid(value) {
  return Math.round(value);
}
function speciesOf(component) {
  if (component.species) return component.species;
  if (component.gevoCutId?.startsWith("S_")) return "pork";
  if (component.gevoCutId?.startsWith("R_")) return "beef";
  return void 0;
}
function isFatTissue(component) {
  return component.type === "fat" || component.gevoCutId != null && FAT_CUTS.has(component.gevoCutId);
}
function meatName(species) {
  return species === "beef" ? "Rindfleisch" : "Schweinefleisch";
}
function fatName(species) {
  return species === "beef" ? "Rinderfett" : "Speck";
}
function finishedMassKg(recipe, rawKg) {
  if (recipe.finishedWeightKg != null && recipe.finishedWeightKg > 0) return recipe.finishedWeightKg;
  const loss = recipe.dryingLossPct ?? 0;
  if (loss > 0) return rawKg * (1 - loss / 100);
  return rawKg;
}
function mapSub(component) {
  const additive = component.type === "additive" ? lookupAdditive(component.name) : void 0;
  const item = {
    name: additive?.name ?? component.name,
    weightKg: component.weightKg,
    isMeat: false,
    isAllergen: component.allergenKey != null
  };
  if (component.allergenKey) item.allergenKey = component.allergenKey;
  const additiveClass = component.additiveClass ?? additive?.additiveClass;
  const eNumber = component.eNumber ?? additive?.eNumber;
  if (additiveClass) item.additiveClass = additiveClass;
  if (eNumber) item.eNumber = eNumber;
  if (component.subIngredients?.length) {
    item.subIngredients = [...component.subIngredients].sort((a, b) => b.weightKg - a.weightKg).map(mapSub);
  }
  return item;
}
function collectAllergens(items, found) {
  for (const item of items) {
    if (item.allergenKey && !found.includes(item.allergenKey)) found.push(item.allergenKey);
    if (item.subIngredients) collectAllergens(item.subIngredients, found);
  }
}
function generateIngredientDeclaration(recipe) {
  const rawKg = recipe.components.reduce((sum, component) => sum + component.weightKg, 0);
  const finishedKg = finishedMassKg(recipe, rawKg);
  const meatKgBySpecies = /* @__PURE__ */ new Map();
  const fatKgByName = /* @__PURE__ */ new Map();
  const rest = [];
  for (const component of recipe.components) {
    if (isFatTissue(component)) {
      const name = fatName(speciesOf(component));
      fatKgByName.set(name, (fatKgByName.get(name) ?? 0) + component.weightKg);
      continue;
    }
    if (component.type === "meat") {
      const species = speciesOf(component) ?? "pork";
      meatKgBySpecies.set(species, (meatKgBySpecies.get(species) ?? 0) + component.weightKg);
      continue;
    }
    if (component.type === "water") {
      const share = finishedKg > 0 ? component.weightKg / finishedKg * 100 : 0;
      if (share < WATER_OMIT_BELOW_PCT) continue;
      rest.push({ name: "Trinkwasser", weightKg: component.weightKg, isMeat: false, isAllergen: false });
      continue;
    }
    rest.push(mapSub(component));
  }
  const meatItems = [...meatKgBySpecies.entries()].map(([species, weightKg]) => ({
    name: meatName(species),
    weightKg,
    isMeat: true,
    isAllergen: false
  }));
  const fatItems = [...fatKgByName.entries()].map(([name, weightKg]) => ({
    name,
    weightKg,
    isMeat: false,
    isAllergen: false
  }));
  const items = [...meatItems, ...fatItems, ...rest].sort((a, b) => b.weightKg - a.weightKg);
  const meatKg = [...meatKgBySpecies.values()].reduce((sum, kg) => sum + kg, 0);
  const rawMeatPer100gFinished = finishedKg > 0 ? roundQuid(meatKg / finishedKg * 100) : 0;
  const allergensPresent = [];
  collectAllergens(items, allergensPresent);
  const result = {
    items,
    rawMeatPer100gFinished,
    allergensPresent
  };
  if (rawMeatPer100gFinished <= 100) {
    result.quidMeatPct = rawMeatPer100gFinished;
    for (const item of items) {
      if (item.isMeat) item.percentage = rawMeatPer100gFinished;
    }
  } else {
    const meatLabel = meatItems.length === 1 ? meatItems[0].name : "Fleisch";
    result.productionStatement = `100 g ${recipe.name} hergestellt aus ${rawMeatPer100gFinished} g ${meatLabel}`;
  }
  return result;
}
export {
  ADDITIVES,
  ALLERGENS,
  ALLERGEN_KEYS,
  FINISHED_PRODUCT_BEFFE_MINIMA,
  HACKFLEISCH_LEITSAETZE,
  calculateBeffe,
  calculateMeatComposition,
  generateIngredientDeclaration,
  getGevoProfile,
  GEVO_PROFILES as gevoProfiles,
  lookupAdditive
};
