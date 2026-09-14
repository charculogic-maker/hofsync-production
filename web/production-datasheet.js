/**
 * DIN-A4-Produktionsdatenblatt — Recipe-to-Print-Matrix für den Tab „Prod.“.
 *
 * Füllt das 2-Seiten-Template (produktionsdatenblatt_galloway_bratwurst.html)
 * dynamisch aus HofSync-Rezeptdaten, skaliert Standard-Chargen und erzeugt
 * LMIV-/QUID-Etikettentext.
 */

export const STANDARD_BATCH_PROFILE_ID = 'alexanderwerk-oskar20-16';

/** @type {MachineBatchProfile[]} */
export const MACHINE_BATCH_PROFILES = [
  {
    id: STANDARD_BATCH_PROFILE_ID,
    label: 'Standard-Charge Alexanderwerk / OSKAR 20: 16,0 kg',
    shortLabel: '16,0 kg',
    cutterType: 'Alexanderwerk / 3-Sichel / M1/S1 – M2/S2',
    fillerType: 'OSKAR 20 (20 Liter)',
    targetKg: 16,
    pieceWeightG: 100,
  },
  {
    id: 'alexanderwerk-oskar20-10',
    label: 'WRS-Basis Alexanderwerk / OSKAR 20: 10,0 kg',
    shortLabel: '10,0 kg',
    cutterType: 'Alexanderwerk / 3-Sichel / M1/S1 – M2/S2',
    fillerType: 'OSKAR 20 (20 Liter)',
    targetKg: 10,
    pieceWeightG: 100,
  },
];

export const DEFAULT_MACHINE_PARK = {
  cutterType: 'Alexanderwerk / 3-Sichel / M1/S1 – M2/S2',
  fillerType: 'OSKAR 20 (20 Liter)',
  pieceWeightG: 100,
};

/**
 * @typedef {Object} MachineBatchProfile
 * @property {string} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} cutterType
 * @property {string} fillerType
 * @property {number} targetKg
 * @property {number} pieceWeightG
 */

/**
 * @typedef {Object} ProductionDatasheetMeta
 * @property {string} recipeName
 * @property {string} recipeId
 * @property {string} productCategory
 * @property {string} leitsatzNr
 * @property {string} version
 * @property {string} createdBy
 * @property {string} dateIso
 * @property {string} dateLabel
 */

/**
 * @typedef {Object} ProductionDatasheetMachines
 * @property {string} profileId
 * @property {string} cutterType
 * @property {string} fillerType
 * @property {number} targetYieldKg
 * @property {number} pieceCount
 * @property {number} pieceWeightG
 * @property {string} yieldLabel
 */

/**
 * @typedef {Object} MeatRow
 * @property {string} name
 * @property {string} class
 * @property {number} weightKg
 * @property {number} percentage
 * @property {string} conditioning
 * @property {string} quidGroup
 * @property {string} quidLabel
 */

/**
 * @typedef {Object} SpiceRow
 * @property {string} name
 * @property {string} supplier
 * @property {number} dosePerKg
 * @property {number} weightTotal
 * @property {string} function
 * @property {string} lmivDecl
 * @property {boolean} allergen
 * @property {boolean} organic
 */

/**
 * @typedef {Object} QuidComponent
 * @property {string} id
 * @property {string} label
 * @property {number} percentage
 * @property {number} weightKg
 */

/**
 * @typedef {Object} TechnoKpis
 * @property {number|null} beffe
 * @property {number|null} wev
 * @property {number} waterAdditionPercent
 * @property {number} targetPh
 * @property {string} targetPhRange
 * @property {number} coreTempTarget
 * @property {string} coreTempLabel
 */

/**
 * @typedef {Object} HaccpCheckpoint
 * @property {string} id
 * @property {string} name
 * @property {string} limit
 * @property {string} auditField
 * @property {string} measured
 */

/**
 * @typedef {Object} LmivLabel
 * @property {string} productName
 * @property {string} ingredientsText
 * @property {string} allergenText
 * @property {string} bioFootnote
 * @property {string} legalNotice
 * @property {QuidComponent[]} quid
 */

/**
 * @typedef {Object} ProductionDatasheetData
 * @property {ProductionDatasheetMeta} meta
 * @property {ProductionDatasheetMachines} machines
 * @property {MeatRow[]} meat
 * @property {SpiceRow[]} spices
 * @property {TechnoKpis} kpis
 * @property {HaccpCheckpoint[]} haccp
 * @property {LmivLabel} lmiv
 * @property {string} sopHint
 * @property {string} accentColor
 * @property {string} logoUrl
 * @property {string} brandName
 */

const LEITSATZ_BY_CATEGORY = [
  { match: /frische\s*bratwurst|bratwurst/, nr: '2.221', gattung: 'Frische Bratwurst (Brühwurstartiges Erzeugnis zum Braten)' },
  { match: /brühwurst|bruehwurst/, nr: '2.21', gattung: 'Brühwurst' },
  { match: /rohwurst|salami|peitsche|pfefferbeißer|peperoni/, nr: '2.23', gattung: 'Rohwurst' },
  { match: /kochwurst|leberwurst|blutwurst|aspik/, nr: '2.232', gattung: 'Kochwurst' },
  { match: /pattie|hack/, nr: '2.11', gattung: 'Hackfleischzubereitung' },
  { match: /schinken|pastrami/, nr: '2.14', gattung: 'Pökelware / Kochpökelware' },
];

const ADDITIVE_LOOKUP = [
  { match: /natriumcarbonat|sodium carbonate|e500/, fn: 'Säureregulator', lmiv: 'Natriumcarbonate', supplier: 'Zukauf' },
  { match: /natriumcitrat|citrat|e331/, fn: 'Säureregulator', lmiv: 'Natriumcitrate', supplier: 'Zukauf' },
  { match: /ascorb|e300|nadurot|acerola/, fn: 'Antioxidationsmittel', lmiv: 'Ascorbinsäure', supplier: 'Zukauf' },
  { match: /phosphat|e450|diphosphat/, fn: 'Stabilisator', lmiv: 'Diphosphate', supplier: 'Zukauf' },
  { match: /nitrit|pökelsalz|poekelsalz/, fn: 'Konservierungsstoff', lmiv: 'Nitritpökelsalz', supplier: 'Zukauf' },
  { match: /kutterpower|kutterhilfsmittel/, fn: 'Kutterhilfsmittel', lmiv: 'Pflanzenfaser / Bindemittel', supplier: 'Zukauf' },
  { match: /meersalz|speisesalz|nitritfrei.*salz|^salz/, fn: 'Würzung', lmiv: 'Meersalz', supplier: 'Zukauf' },
];

const ALLERGEN_LOOKUP = [
  { match: /sulfit|wein|rotwein/, label: 'SULFITE' },
  { match: /senf|mustard/, label: 'SENF' },
  { match: /sellerie|celery/, label: 'SELLERIE' },
  { match: /soja|soy/, label: 'SOJA' },
  { match: /milch|laktos|butter|sahne/, label: 'MILCH' },
  { match: /ei\b|eigelb|eiweiß/, label: 'EI' },
  { match: /gluten|weizen|roggen|gerste|dinkel/, label: 'GLUTEN' },
  { match: /sesam/, label: 'SESAM' },
  { match: /schalenfrucht|mandel|haselnuss|walnuss/, label: 'SCHALENFRÜCHTE' },
];

const BIO_FOOTNOTE = '*aus kontrolliert biologischer Landwirtschaft';

export function getMachineBatchProfile(profileId) {
  return MACHINE_BATCH_PROFILES.find((profile) => profile.id === profileId) || null;
}

export function parseIngredientPct(ing) {
  const raw = ing?.pct
    ?? ing?.Pct
    ?? ing?.Prozent
    ?? ing?.prozent
    ?? ing?.percent
    ?? ing?.Percent
    ?? ing?.anteil
    ?? ing?.Anteil;
  if (raw === undefined || raw === null || raw === '') return NaN;
  const normalized = String(raw).replace('%', '').replace(',', '.').trim();
  const pct = Number.parseFloat(normalized);
  return Number.isFinite(pct) ? pct : NaN;
}

export function ingredientDisplayName(ing) {
  return String(
    ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || '',
  ).trim() || 'Unbekannte Zutat';
}

export function formatDeNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '–';
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatKg(value) {
  return `${formatDeNumber(value, 3)} kg`;
}

export function formatPercent(value) {
  return `${formatDeNumber(value, 2)} %`;
}

export function todayIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDeDate(date = new Date()) {
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function resolveLeitsatz(recipe) {
  const category = String(recipe?.kat || recipe?.Kategorie || '').toLowerCase();
  const name = String(recipe?.name || '').toLowerCase();
  const haystack = `${category} ${name}`;
  const hit = LEITSATZ_BY_CATEGORY.find((entry) => entry.match.test(haystack));
  return {
    nr: recipe?.leitsatzNr || recipe?.leitsatz || hit?.nr || '2.221',
    gattung: recipe?.produktgattung || hit?.gattung || (recipe?.kat || 'Frische Bratwurst'),
  };
}

export function classifyIngredient(ing) {
  const name = ingredientDisplayName(ing);
  const typ = String(ing?.typ || ing?.Typ || '').toLowerCase();
  const hint = String(ing?.hinweis || ing?.Hinweis || '').trim();
  const pct = parseIngredientPct(ing);
  const hay = normalizeMatchText(`${name} ${typ} ${hint}`);

  const allergenHit = ALLERGEN_LOOKUP.find((entry) => entry.match.test(hay));
  const additiveHit = ADDITIVE_LOOKUP.find((entry) => entry.match.test(hay));
  const organic = /bio|\*/.test(hay) || /galloway|steveshof/.test(hay);
  const allergen = Boolean(ing?.allergen || ing?.Allergen || allergenHit);

  if (isWaterLike(hay)) {
    return {
      bucket: 'water',
      name,
      class: '—',
      quidGroup: '',
      quidLabel: '',
      conditioning: hint || 'eiskalt / Trinkwasserqualität',
      supplier: 'Betrieb',
      function: 'Schüttung',
      lmivDecl: 'Trinkwasser',
      organic: false,
      allergen,
      allergenLabel: allergenHit?.label || '',
      pct,
    };
  }

  if (isCasingLike(hay)) {
    return {
      bucket: 'spice',
      name,
      class: '—',
      quidGroup: '',
      quidLabel: '',
      conditioning: hint || 'gewässert',
      supplier: 'Zukauf',
      function: 'Hülle',
      lmivDecl: lmivCasingName(name),
      organic,
      allergen,
      allergenLabel: allergenHit?.label || '',
      pct,
    };
  }

  const meat = classifyMeat(hay, name, typ);
  if (meat) {
    return {
      bucket: 'meat',
      name,
      class: meat.class,
      quidGroup: meat.quidGroup,
      quidLabel: meat.quidLabel,
      conditioning: hint || '0–2 °C, kernig / nicht schmierend',
      supplier: 'Eigenproduktion',
      function: 'Fleischeinsatz',
      lmivDecl: meat.lmivDecl,
      organic: true,
      allergen,
      allergenLabel: allergenHit?.label || '',
      pct,
    };
  }

  return {
    bucket: 'spice',
    name,
    class: '—',
    quidGroup: '',
    quidLabel: '',
    conditioning: hint || '',
    supplier: additiveHit?.supplier || inferSpiceSupplier(hay),
    function: additiveHit?.fn || inferSpiceFunction(hay),
    lmivDecl: additiveHit?.lmiv || spiceLmivName(name, organic),
    organic,
    allergen,
    allergenLabel: allergenHit?.label || '',
    pct,
  };
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss');
}

function isWaterLike(hay) {
  return /(?:^|[^a-z])(?:eiskalt|eisschnee|schnee|\beis\b|wasser|trinkwasser|bruehe|bruhe|schuttung|schuettung)/.test(hay)
    && !/(fleisch|speck|wurst|pfeffer)/.test(hay);
}

function isCasingLike(hay) {
  return /(darm|saitling|huelle|hulle|kaliber|collagen)/.test(hay);
}

function classifyMeat(hay, name, typ) {
  const looksMeatTyp = typ === 'base' || typ === 'meat' || typ === 'fleisch';
  const hasMeatWord = /(fleisch|galloway|rind|schwein|speck|lamm|hahnchen|huhn|pute|gefluegel|leber|fett|bauch|wamme|parure|ri+\b|si+\b|r\s*[ivx]+|s\s*[ivx]+)/.test(hay);
  if (!looksMeatTyp && !hasMeatWord) return null;
  if (/(salz|pfeffer|gewurz|gewuerz|thymian|muskat|paprika|zitron|senf|citrat|carbonat|wasser|eis)/.test(hay) && !hasMeatWord) {
    return null;
  }

  if (/(speck|kutterfett|bauchfett|rueckenspeck)/.test(hay) || (/\bs\s*v\b|\bsv\b/.test(hay) && /fett|speck/.test(hay))) {
    return {
      class: inferMeatClass(hay, name, 'S V'),
      quidGroup: 'speck',
      quidLabel: 'Bio-Speck',
      lmivDecl: 'Bio-Speck*',
    };
  }
  if (/(rinderfett|gallowayfett|galloway fett|riv\b|r\s*iv|r iv)/.test(hay) || /galloway/.test(hay) && /fett|speck/.test(hay)) {
    return {
      class: inferMeatClass(hay, name, 'R IV'),
      quidGroup: 'galloway-fett',
      quidLabel: 'Bio-Galloway-Fett',
      lmivDecl: 'Bio-Galloway-Fett*',
    };
  }
  if (/(lamm|lamb)/.test(hay)) {
    return {
      class: inferMeatClass(hay, name, 'L II'),
      quidGroup: 'lamm',
      quidLabel: 'Bio-Lammfleisch',
      lmivDecl: 'Bio-Lammfleisch*',
    };
  }
  if (/(hahnchen|huhn|gefluegel|pute|hii|hiv)/.test(hay)) {
    return {
      class: inferMeatClass(hay, name, 'H II'),
      quidGroup: 'gefluegel',
      quidLabel: 'Bio-Geflügelfleisch',
      lmivDecl: 'Bio-Geflügelfleisch*',
    };
  }
  if (/(schwein|\bsii\b|\bsii\b|s\s*ii|s\s*i\b|s\s*iii)/.test(hay)) {
    return {
      class: inferMeatClass(hay, name, 'S II'),
      quidGroup: 'schwein',
      quidLabel: 'Bio-Schweinefleisch',
      lmivDecl: 'Bio-Schweinefleisch*',
    };
  }
  if (/(galloway|rind|\bri+\b|r\s*ii|r\s*i\b|r\s*iii)/.test(hay) || looksMeatTyp) {
    return {
      class: inferMeatClass(hay, name, 'R II'),
      quidGroup: 'galloway',
      quidLabel: 'Bio-Galloway-Rindfleisch',
      lmivDecl: 'Bio-Galloway-Rindfleisch*',
    };
  }
  return null;
}

function inferMeatClass(hay, name, fallback) {
  const fromName = String(name).match(/\b([RSHL]\s*[IVX]+|[RSHL]\s*[I1]{1,3})\b/i);
  if (fromName) return fromName[1].replace(/\s+/g, ' ').toUpperCase();
  const compact = hay.match(/\b([rshl])\s*([ivx]+)\b/);
  if (compact) return `${compact[1].toUpperCase()} ${compact[2].toUpperCase()}`;
  return fallback;
}

function inferSpiceSupplier(hay) {
  if (/(eigen|hof|steveshof)/.test(hay)) return 'Eigenproduktion';
  return 'Zukauf';
}

function inferSpiceFunction(hay) {
  if (/(pfeffer|thymian|muskat|paprika|majoran|chili|piment|kraeuter|gewuerz)/.test(hay)) return 'Würzung';
  if (/(zitron|saeure|essig)/.test(hay)) return 'Säuerung';
  if (/(wein|wodka|gin|alkohol)/.test(hay)) return 'Aroma';
  if (/(salz)/.test(hay)) return 'Würzung';
  return 'Zutat';
}

function spiceLmivName(name, organic) {
  const cleaned = String(name || '').replace(/\s+/g, ' ').trim();
  if (organic && !cleaned.includes('*')) return `${cleaned}*`;
  return cleaned;
}

function lmivCasingName(name) {
  if (/lamm/i.test(name)) return 'Lamm-Saitling';
  if (/schwein/i.test(name)) return 'Schweinedarm';
  return String(name || 'Naturdarm');
}

export function scaleIngredientWeightKg(pct, targetKg) {
  if (!Number.isFinite(pct) || !Number.isFinite(targetKg)) return 0;
  return (targetKg * pct) / 100;
}

export function computeQuidValues(meatRows) {
  const groups = new Map();
  meatRows.forEach((row) => {
    if (!row?.quidGroup) return;
    const current = groups.get(row.quidGroup) || {
      id: row.quidGroup,
      label: row.quidLabel,
      percentage: 0,
      weightKg: 0,
    };
    current.percentage += Number(row.percentage) || 0;
    current.weightKg += Number(row.weightKg) || 0;
    groups.set(row.quidGroup, current);
  });
  return [...groups.values()].sort((a, b) => b.percentage - a.percentage);
}

export function buildLmivLabel(recipe, meatRows, spiceRows, quid, options = {}) {
  const productName = recipe?.name || 'Erzeugnis';
  const entries = [
    ...meatRows.map((row) => ({
      name: row.lmivDecl || row.quidLabel || row.name,
      weightKg: row.weightKg,
      percentage: row.percentage,
      allergen: false,
      allergenLabel: '',
      organic: true,
      function: '',
      quidGroup: row.quidGroup,
    })),
    ...spiceRows.map((row) => ({
      name: row.lmivDecl || row.name,
      weightKg: row.weightTotal,
      percentage: row.dosePerKg / 10,
      allergen: row.allergen,
      allergenLabel: row.allergenLabel,
      organic: row.organic,
      function: row.function,
      quidGroup: '',
    })),
  ].filter((entry) => Number.isFinite(entry.weightKg) && entry.weightKg > 0);

  const merged = mergeLmivEntries(entries);
  merged.sort((a, b) => b.weightKg - a.weightKg);

  const quidByGroup = new Map(quid.map((item) => [item.id, item]));
  const usedQuid = new Set();
  const htmlParts = [];
  const plainParts = [];

  merged.forEach((entry) => {
    const quidItem = entry.quidGroup ? quidByGroup.get(entry.quidGroup) : null;
    const showQuid = Boolean(quidItem) && !usedQuid.has(entry.quidGroup);
    if (showQuid) usedQuid.add(entry.quidGroup);

    let display = entry.name;
    if (isAdditiveFunction(entry.function) && !/^säureregulator|^antioxidationsmittel|^stabilisator|^konservierungsstoff|^kutterhilfsmittel/i.test(display)) {
      display = `${entry.function}: ${stripStar(display)}`;
      if (entry.organic && !display.includes('*')) display += '*';
    }

    const quidSuffix = showQuid ? ` (${formatDeNumber(quidItem.percentage, 1)} %)` : '';
    const plain = `${display}${quidSuffix}`;
    plainParts.push(plain);

    const htmlName = entry.allergen
      ? `<strong>${escapeHtml(display)}</strong>`
      : escapeHtml(display);
    htmlParts.push(`${htmlName}${escapeHtml(quidSuffix)}`);
  });

  const recipeAllergens = uniqueAllergens(recipe, spiceRows);
  const allergenText = recipeAllergens.length
    ? `Allergene: ${recipeAllergens.join(', ')}.`
    : 'Allergene: keine deklarationspflichtigen Allergene im Rezept.';
  const hasOrganic = merged.some((entry) => entry.organic) || meatRows.length > 0;

  return {
    productName,
    ingredientsText: `Zutaten: ${plainParts.join(', ')}.`,
    ingredientsHtml: `Zutaten: ${htmlParts.join(', ')}.`,
    allergenText,
    allergenHtml: allergenHtml(allergenText),
    bioFootnote: hasOrganic ? BIO_FOOTNOTE : '',
    legalNotice: options.legalNotice
      || 'QUID-Angaben beziehen sich auf die Gesamtmasse der Charge. Deklaration gemäß LMIV (EU) Nr. 1169/2011.',
    quid,
  };
}

function mergeLmivEntries(entries) {
  const merged = [];
  const indexByKey = new Map();
  entries.forEach((entry) => {
    const key = entry.quidGroup
      ? `quid:${entry.quidGroup}`
      : `row:${normalizeMatchText(entry.name)}`;
    if (indexByKey.has(key)) {
      const current = merged[indexByKey.get(key)];
      current.weightKg += entry.weightKg;
      current.percentage += entry.percentage;
      current.allergen = current.allergen || entry.allergen;
      current.allergenLabel = current.allergenLabel || entry.allergenLabel;
      current.organic = current.organic || entry.organic;
      return;
    }
    indexByKey.set(key, merged.length);
    merged.push({ ...entry });
  });
  return merged;
}

function isAdditiveFunction(fn) {
  return /säureregulator|antioxidationsmittel|stabilisator|konservierungsstoff|kutterhilfsmittel/i.test(String(fn || ''));
}

function stripStar(value) {
  return String(value || '').replace(/\*+$/, '').trim();
}

function uniqueAllergens(recipe, spiceRows) {
  const fromRecipe = Array.isArray(recipe?.allergene)
    ? recipe.allergene.map((item) => String(item || '').toUpperCase())
    : [];
  const fromRows = spiceRows
    .filter((row) => row.allergen)
    .map((row) => row.allergenLabel || String(row.name || '').toUpperCase());
  return [...new Set([...fromRecipe, ...fromRows].map((item) => item.trim()).filter(Boolean))];
}

function allergenHtml(allergenText) {
  return escapeHtml(allergenText).replace(
    /(SULFITE|SENF|SELLERIE|SOJA|MILCH|EI|GLUTEN|SESAM|SCHALENFRÜCHTE)/g,
    '<strong>$1</strong>',
  );
}

function categoryTechnoDefaults(recipe) {
  const hay = normalizeMatchText(`${recipe?.kat || ''} ${recipe?.name || ''}`);
  if (/(kochwurst|leberwurst|bruehwurst|bruhwurst)/.test(hay) && !/frische/.test(hay)) {
    return {
      targetPh: 6.2,
      targetPhRange: '6,0–6,4',
      coreTempTarget: 72,
      coreTempLabel: 'Kerntemperatur-Soll Garprozess 72 °C',
    };
  }
  if (/(rohwurst|salami|peitsche)/.test(hay)) {
    return {
      targetPh: 5.2,
      targetPhRange: '4,8–5,4',
      coreTempTarget: 22,
      coreTempLabel: 'Reifungsraum-Soll gemäß Rezept',
    };
  }
  return {
    targetPh: 5.8,
    targetPhRange: '5,6–6,2',
    coreTempTarget: 4,
    coreTempLabel: 'Brät-/Kerntemperatur-Soll ≤ 4 °C (Sperre 7 °C)',
  };
}

function buildHaccpCheckpoints(recipe, kpis, options = {}) {
  const measuredPh = Number.isFinite(options.measuredPh) ? formatDeNumber(options.measuredPh, 2) : '';
  const measuredTemp = Number.isFinite(options.measuredCoreTemp) ? `${formatDeNumber(options.measuredCoreTemp, 1)} °C` : '';
  return [
    {
      id: 'ccp-raw',
      name: 'CCP 1 Rohstofftemperatur',
      limit: '0–2 °C (Fleisch/Fett kernig, nicht schmierend)',
      auditField: 'Ist-Wert / Uhrzeit / Kürzel',
      measured: '',
    },
    {
      id: 'ccp-batter',
      name: 'CCP 2 Brättemperatur nach Kutter',
      limit: `≤ ${formatDeNumber(Math.min(kpis.coreTempTarget, 4), 0)} °C, Sperre 7 °C`,
      auditField: 'Ist-Wert / Uhrzeit / Kürzel',
      measured: measuredTemp,
    },
    {
      id: 'ccp-ph',
      name: 'pH-Wert Fertigbrät',
      limit: `Soll ${kpis.targetPhRange} (Ziel ${formatDeNumber(kpis.targetPh, 1)})`,
      auditField: 'Ist-Wert / Gerät / Kürzel',
      measured: measuredPh,
    },
    {
      id: 'ccp-fill',
      name: 'CCP 3 Füllen / Portionieren',
      limit: 'Luftarm, ohne Überdruck; OSKAR 20 nicht überfüllen',
      auditField: 'Sichtkontrolle / Uhrzeit / Kürzel',
      measured: '',
    },
    {
      id: 'ccp-chill',
      name: 'CCP 4 Kühlung Fertigware',
      limit: '≤ 4 °C innerhalb von 2 Stunden',
      auditField: 'Ist-Wert / Uhrzeit / Kürzel',
      measured: '',
    },
  ];
}

function resolveCreatedBy(options = {}) {
  return String(
    options.createdBy
    || (typeof window !== 'undefined' ? window.BRANDING?.betriebsName : '')
    || 'StevesHof Hofladen',
  ).trim() || 'StevesHof Hofladen';
}

function resolveBrand(options = {}) {
  const branding = options.branding || (typeof window !== 'undefined' ? window.BRANDING : null) || {};
  return {
    brandName: options.brandName || branding.appName || 'HofSync',
    accentColor: options.accentColor || branding.primaryColor || '#2E7D32',
    logoUrl: absolutizeUrl(options.logoUrl || branding.logoUrl || '/icon-192.png'),
  };
}

function absolutizeUrl(path) {
  const value = String(path || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (typeof window !== 'undefined' && window.location?.href) {
    try {
      return new URL(value, window.location.href).href;
    } catch {
      return value;
    }
  }
  return value;
}

export function buildProductionDatasheetData(recipe, options = {}) {
  if (!recipe) {
    throw new Error('Rezept fehlt – Datenblatt kann nicht erzeugt werden.');
  }

  const profile = options.machineProfile || getMachineBatchProfile(options.profileId) || {
    id: options.profileId || 'custom',
    ...DEFAULT_MACHINE_PARK,
    targetKg: Number(options.targetKg) || 10,
  };
  const targetKg = Number(options.targetKg) > 0 ? Number(options.targetKg) : profile.targetKg;
  const pieceWeightG = Number(options.pieceWeightG) > 0 ? Number(options.pieceWeightG) : (profile.pieceWeightG || 100);
  const pieceCount = Number(options.pieceCount) > 0
    ? Number(options.pieceCount)
    : Math.max(1, Math.round((targetKg * 1000) / pieceWeightG));
  const leitsatz = resolveLeitsatz(recipe);
  const now = options.now instanceof Date ? options.now : new Date();
  const brand = resolveBrand(options);
  const rows = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .map((ing) => {
      const classified = classifyIngredient(ing);
      const pct = classified.pct;
      if (!Number.isFinite(pct)) return null;
      const weightKg = scaleIngredientWeightKg(pct, targetKg);
      return { ...classified, weightKg, percentage: pct };
    })
    .filter(Boolean);

  const meat = rows
    .filter((row) => row.bucket === 'meat')
    .map((row) => ({
      name: row.name,
      class: row.class,
      weightKg: row.weightKg,
      percentage: row.percentage,
      conditioning: row.conditioning,
      quidGroup: row.quidGroup,
      quidLabel: row.quidLabel,
      lmivDecl: row.lmivDecl,
    }));

  const spices = rows
    .filter((row) => row.bucket !== 'meat')
    .map((row) => ({
      name: row.name,
      supplier: row.supplier,
      dosePerKg: row.percentage * 10,
      weightTotal: row.weightKg,
      function: row.function,
      lmivDecl: row.lmivDecl,
      allergen: row.allergen,
      allergenLabel: row.allergenLabel,
      organic: row.organic,
      percentage: row.percentage,
      bucket: row.bucket,
    }));

  const waterAdditionPercent = spices
    .filter((row) => row.bucket === 'water')
    .reduce((sum, row) => sum + (Number(row.percentage) || 0), 0);

  const quid = computeQuidValues(meat);
  const techDefaults = categoryTechnoDefaults(recipe);
  const kpis = {
    beffe: Number.isFinite(options.kpis?.beffe) ? options.kpis.beffe : null,
    wev: Number.isFinite(options.kpis?.wev) ? options.kpis.wev : null,
    waterAdditionPercent,
    targetPh: Number.isFinite(options.kpis?.targetPh) ? options.kpis.targetPh : techDefaults.targetPh,
    targetPhRange: options.kpis?.targetPhRange || techDefaults.targetPhRange,
    coreTempTarget: Number.isFinite(options.kpis?.coreTempTarget) ? options.kpis.coreTempTarget : techDefaults.coreTempTarget,
    coreTempLabel: options.kpis?.coreTempLabel || techDefaults.coreTempLabel,
  };

  if (options.beffeEngine && typeof options.beffeEngine.calculateCharge === 'function') {
    try {
      const calc = options.beffeEngine.calculateCharge(recipe.name, targetKg);
      if (Number.isFinite(calc?.totals?.beffeProzent)) kpis.beffe = calc.totals.beffeProzent;
      if (Number.isFinite(calc?.totals?.wasserProzent) && kpis.beffe > 0) {
        kpis.wev = calc.totals.wasserProzent / kpis.beffe;
      }
    } catch {
      // WRS-Rezeptname muss nicht 1:1 zur Küchenliste passen.
    }
  }

  const lmiv = buildLmivLabel(recipe, meat, spices, quid, options);
  const sopHint = [recipe.anweisung_A, recipe.anweisung_B, recipe.anweisung_C, recipe.anweisung_D]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  return {
    meta: {
      recipeName: recipe.name || '',
      recipeId: recipe.id || '',
      productCategory: leitsatz.gattung,
      leitsatzNr: leitsatz.nr,
      version: String(recipe.version || recipe.Version || '1.0'),
      createdBy: resolveCreatedBy(options),
      dateIso: todayIso(now),
      dateLabel: formatDeDate(now),
    },
    machines: {
      profileId: profile.id || 'custom',
      cutterType: options.cutterType || profile.cutterType || DEFAULT_MACHINE_PARK.cutterType,
      fillerType: options.fillerType || profile.fillerType || DEFAULT_MACHINE_PARK.fillerType,
      targetYieldKg: targetKg,
      pieceCount,
      pieceWeightG,
      yieldLabel: `${pieceCount} Stück à ${formatDeNumber(pieceWeightG, 0)} g`,
    },
    meat,
    spices,
    kpis,
    haccp: buildHaccpCheckpoints(recipe, kpis, options),
    lmiv,
    sopHint,
    accentColor: brand.accentColor,
    logoUrl: brand.logoUrl,
    brandName: brand.brandName,
  };
}

export function scaleDatasheetToTargetKg(data, targetKg, extra = {}) {
  if (!data) return null;
  const factor = targetKg / (data.machines.targetYieldKg || 1);
  if (!(factor > 0)) return data;
  const meat = data.meat.map((row) => ({
    ...row,
    weightKg: row.weightKg * factor,
  }));
  const spices = data.spices.map((row) => ({
    ...row,
    weightTotal: row.weightTotal * factor,
  }));
  const quid = computeQuidValues(meat);
  const pieceWeightG = extra.pieceWeightG || data.machines.pieceWeightG;
  const pieceCount = extra.pieceCount || Math.max(1, Math.round((targetKg * 1000) / pieceWeightG));
  return {
    ...data,
    machines: {
      ...data.machines,
      targetYieldKg: targetKg,
      pieceCount,
      pieceWeightG,
      yieldLabel: `${pieceCount} Stück à ${formatDeNumber(pieceWeightG, 0)} g`,
      profileId: extra.profileId || data.machines.profileId,
      cutterType: extra.cutterType || data.machines.cutterType,
      fillerType: extra.fillerType || data.machines.fillerType,
    },
    meat,
    spices,
    lmiv: {
      ...data.lmiv,
      quid,
    },
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const DATASHEET_PRINT_CSS = `
:root { --ds-accent: #2E7D32; --ds-ink: #1a1a1a; --ds-muted: #4b5563; --ds-line: #c5c9c3; --ds-fill: #f3f6f1; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: #e8e6e1;
  color: var(--ds-ink);
  font-family: "Source Sans 3", "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.35;
}
.no-print { }
.datasheet-toolbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; gap: 10px; align-items: center; justify-content: center;
  padding: 12px 16px;
  background: #111; color: #fff;
}
.datasheet-toolbar button {
  min-height: 44px; padding: 0 18px; border: 0; border-radius: 8px;
  font-weight: 800; cursor: pointer;
}
.datasheet-toolbar .btn-print { background: #fff; color: #111; }
.datasheet-toolbar .btn-close { background: #374151; color: #fff; }
.datasheet-toolbar p { font-size: 12px; opacity: 0.85; }
.sheet-wrap { padding: 12px 0 32px; }
.sheet {
  width: 210mm;
  min-height: 297mm;
  height: 297mm;
  margin: 12px auto;
  background: #fff;
  padding: 10mm 11mm 12mm;
  box-shadow: 0 8px 28px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
}
.sheet:last-child { page-break-after: auto; break-after: auto; }
.sheet-head {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  align-items: center;
  border-bottom: 3px solid var(--ds-accent);
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.sheet-head img { width: 28px; height: 28px; object-fit: contain; }
.kicker { font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ds-accent); font-weight: 800; }
.sheet-head h1 { font-size: 15pt; line-height: 1.15; }
.confidential { font-size: 8pt; font-weight: 800; color: #7f1d1d; text-align: right; text-transform: uppercase; }
.meta-grid, .kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 8px 0;
}
.meta-item, .kpi-item {
  background: var(--ds-fill);
  border: 1px solid var(--ds-line);
  padding: 6px 8px;
  min-height: 42px;
}
.meta-item span, .kpi-item span, .tbl caption span, th span { display: block; font-size: 7pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ds-muted); font-weight: 700; }
.meta-item strong, .kpi-item strong { font-size: 10pt; }
h2 {
  font-size: 10pt;
  margin: 10px 0 4px;
  padding: 3px 0;
  border-bottom: 1.5px solid var(--ds-accent);
  color: var(--ds-accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.tbl { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.tbl th, .tbl td { border: 1px solid var(--ds-line); padding: 4px 6px; vertical-align: top; }
.tbl th { background: var(--ds-accent); color: #fff; text-align: left; font-weight: 700; }
.tbl tr:nth-child(even) td { background: #fafbf8; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.audit { min-width: 72px; height: 22px; }
.label-box {
  border: 2px solid #111;
  padding: 10px 12px;
  min-height: 118px;
  font-size: 9.5pt;
  line-height: 1.45;
}
.quid-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.quid-chip {
  border: 1px solid var(--ds-accent);
  background: var(--ds-fill);
  padding: 5px 8px;
  font-weight: 800;
  font-size: 9pt;
}
.sop { font-size: 8pt; color: var(--ds-muted); margin-top: 8px; max-height: 52px; overflow: hidden; }
.sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: auto; padding-top: 18px; }
.sign-row div { border-top: 1px solid #111; padding-top: 4px; font-size: 8pt; }
.sheet-foot {
  display: flex; justify-content: space-between;
  font-size: 7.5pt; color: var(--ds-muted);
  margin-top: 8px; border-top: 1px solid var(--ds-line); padding-top: 4px;
}
.legal { font-size: 7.5pt; color: var(--ds-muted); margin-top: 8px; }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; width: 210mm; }
  .no-print { display: none !important; }
  .sheet-wrap { padding: 0; }
  .sheet {
    box-shadow: none;
    margin: 0;
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
}
`;

function kpiDisplay(value, suffix = '', digits = 1) {
  if (!Number.isFinite(value)) return '–';
  return `${formatDeNumber(value, digits)}${suffix}`;
}

function meatTableRows(meat) {
  if (!meat.length) {
    return '<tr><td colspan="5">Kein Fleischeinsatz in diesem Rezept.</td></tr>';
  }
  return meat.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.class)}</td>
      <td class="num">${escapeHtml(formatKg(row.weightKg))}</td>
      <td class="num">${escapeHtml(formatPercent(row.percentage))}</td>
      <td>${escapeHtml(row.conditioning)}</td>
    </tr>`).join('');
}

function spiceTableRows(spices) {
  const rows = spices.filter((row) => row.bucket !== 'meat');
  if (!rows.length) {
    return '<tr><td colspan="6">Keine Gewürze oder Zusatzstoffe.</td></tr>';
  }
  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.supplier)}</td>
      <td class="num">${escapeHtml(formatDeNumber(row.dosePerKg, 2))} g/kg</td>
      <td class="num">${escapeHtml(formatKg(row.weightTotal))}</td>
      <td>${escapeHtml(row.function)}</td>
      <td>${escapeHtml(row.lmivDecl)}</td>
    </tr>`).join('');
}

function haccpRows(checkpoints) {
  return checkpoints.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.limit)}</td>
      <td>${escapeHtml(row.measured || ' ')}</td>
      <td class="audit"></td>
    </tr>`).join('');
}

export function renderProductionDatasheetHtml(data, options = {}) {
  const accent = data.accentColor || '#2E7D32';
  const autoPrint = options.autoPrint !== false;
  const quidChips = data.lmiv.quid.map((item) => (
    `<span class="quid-chip">${escapeHtml(item.label)}* ${escapeHtml(formatPercent(item.percentage))}</span>`
  )).join('') || '<span class="quid-chip">Keine Fleisch-QUID-Komponente</span>';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Produktionsdatenblatt – ${escapeHtml(data.meta.recipeName)}</title>
  <style>${DATASHEET_PRINT_CSS.replace('#2E7D32', accent)}</style>
</head>
<body>
  <div class="datasheet-toolbar no-print">
    <button type="button" class="btn-print" onclick="window.print()">Drucken</button>
    <button type="button" class="btn-close" onclick="window.close()">Schließen</button>
    <p>DIN A4 hoch · genau 2 Seiten · Hintergründe im Druckdialog aktiv lassen</p>
  </div>
  <div class="sheet-wrap">
    <section class="sheet" id="datasheet-page-1">
      <header class="sheet-head">
        ${data.logoUrl ? `<img src="${escapeHtml(data.logoUrl)}" alt="">` : '<span></span>'}
        <div>
          <div class="kicker">${escapeHtml(data.brandName)} · Produktionsdatenblatt DIN A4</div>
          <h1>${escapeHtml(data.meta.recipeName)}</h1>
        </div>
        <div class="confidential">Betriebsintern<br>Seite 1 / 2</div>
      </header>
      <div class="meta-grid">
        <div class="meta-item"><span>Produktgattung</span><strong>${escapeHtml(data.meta.productCategory)}</strong></div>
        <div class="meta-item"><span>Leitsatz-Nr.</span><strong>${escapeHtml(data.meta.leitsatzNr)}</strong></div>
        <div class="meta-item"><span>Version</span><strong>${escapeHtml(data.meta.version)}</strong></div>
        <div class="meta-item"><span>Ersteller / Freigabe</span><strong>${escapeHtml(data.meta.createdBy)}</strong></div>
        <div class="meta-item"><span>Datum</span><strong>${escapeHtml(data.meta.dateLabel)}</strong></div>
        <div class="meta-item"><span>Rezept-ID</span><strong>${escapeHtml(data.meta.recipeId || '–')}</strong></div>
      </div>
      <h2>Maschinenpark &amp; Zielausbeute</h2>
      <div class="meta-grid">
        <div class="meta-item"><span>Kutter</span><strong>${escapeHtml(data.machines.cutterType)}</strong></div>
        <div class="meta-item"><span>Füller</span><strong>${escapeHtml(data.machines.fillerType)}</strong></div>
        <div class="meta-item"><span>Zielausbeute</span><strong>${escapeHtml(formatDeNumber(data.machines.targetYieldKg, 1))} kg · ${escapeHtml(data.machines.yieldLabel)}</strong></div>
      </div>
      <h2>Tab 1 · Fleischeinsatz</h2>
      <table class="tbl">
        <thead><tr><th>Rohstoff</th><th>Klasse</th><th>Gewicht</th><th>Anteil</th><th>Konditionierung</th></tr></thead>
        <tbody>${meatTableRows(data.meat)}</tbody>
      </table>
      <h2>Tab 2 · Gewürze &amp; Zusatzstoffe</h2>
      <table class="tbl">
        <thead><tr><th>Zutat</th><th>Lieferant</th><th>Dosis / kg</th><th>Gesamt</th><th>Funktion</th><th>LMIV</th></tr></thead>
        <tbody>${spiceTableRows(data.spices)}</tbody>
      </table>
      <h2>Technologische KPIs</h2>
      <div class="kpi-grid">
        <div class="kpi-item"><span>BEFFE</span><strong>${escapeHtml(kpiDisplay(data.kpis.beffe, ' %', 1))}</strong></div>
        <div class="kpi-item"><span>WEV</span><strong>${escapeHtml(kpiDisplay(data.kpis.wev, '', 2))}</strong></div>
        <div class="kpi-item"><span>Wasserzusatz</span><strong>${escapeHtml(formatPercent(data.kpis.waterAdditionPercent))}</strong></div>
        <div class="kpi-item"><span>Ziel-pH</span><strong>${escapeHtml(formatDeNumber(data.kpis.targetPh, 1))} (${escapeHtml(data.kpis.targetPhRange)})</strong></div>
        <div class="kpi-item"><span>Kerntemperatur-Soll</span><strong>${escapeHtml(data.kpis.coreTempLabel)}</strong></div>
        <div class="kpi-item"><span>Gesamtmasse</span><strong>${escapeHtml(formatDeNumber(data.machines.targetYieldKg, 1))} kg</strong></div>
      </div>
      <div class="sheet-foot">
        <span>${escapeHtml(data.meta.createdBy)} · ${escapeHtml(data.meta.recipeName)}</span>
        <span>Seite 1 / 2</span>
      </div>
    </section>
    <section class="sheet" id="datasheet-page-2">
      <header class="sheet-head">
        ${data.logoUrl ? `<img src="${escapeHtml(data.logoUrl)}" alt="">` : '<span></span>'}
        <div>
          <div class="kicker">LMIV-Etikett · QUID · HACCP</div>
          <h1>${escapeHtml(data.meta.recipeName)}</h1>
        </div>
        <div class="confidential">Betriebsintern<br>Seite 2 / 2</div>
      </header>
      <h2>QUID Hauptfleischkomponenten</h2>
      <div class="quid-list">${quidChips}</div>
      <h2>Etikettentext (LMIV)</h2>
      <div class="label-box">
        <strong>${escapeHtml(data.lmiv.productName)}</strong><br>
        ${data.lmiv.ingredientsHtml}<br>
        ${data.lmiv.allergenHtml}
        ${data.lmiv.bioFootnote ? `<br>${escapeHtml(data.lmiv.bioFootnote)}` : ''}
      </div>
      <p class="legal">${escapeHtml(data.lmiv.legalNotice)}</p>
      <h2>HACCP-Prüfpunkte &amp; Audit</h2>
      <table class="tbl">
        <thead><tr><th>Prüfpunkt</th><th>Grenzwert / Soll</th><th>Ist</th><th>Audit / Kürzel</th></tr></thead>
        <tbody>${haccpRows(data.haccp)}</tbody>
      </table>
      ${data.sopHint ? `<p class="sop">${escapeHtml(data.sopHint)}</p>` : ''}
      <div class="sign-row">
        <div>Herstellung · ${escapeHtml(data.meta.createdBy)}</div>
        <div>Freigabe QS / Meister</div>
        <div>Datum ${escapeHtml(data.meta.dateLabel)}</div>
      </div>
      <div class="sheet-foot">
        <span>Leitsatz ${escapeHtml(data.meta.leitsatzNr)} · Version ${escapeHtml(data.meta.version)}</span>
        <span>Seite 2 / 2</span>
      </div>
    </section>
  </div>
  ${autoPrint ? '<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 250); });</script>' : ''}
</body>
</html>`;
}

export function openProductionDatasheetPrint(data, hooks = {}) {
  const html = renderProductionDatasheetHtml(data, { autoPrint: hooks.autoPrint !== false });
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { mode: 'none', html };
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return { mode: 'popup', html, printWindow };
  }

  let frame = document.getElementById('production-datasheet-print-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'production-datasheet-print-frame';
    frame.className = 'production-datasheet-print-frame no-print';
    frame.setAttribute('title', 'Druckdatenblatt DIN A4');
    document.body.appendChild(frame);
  }
  const frameDoc = frame.contentDocument || frame.contentWindow?.document;
  if (!frameDoc) {
    hooks.onBlocked?.();
    return { mode: 'blocked', html };
  }
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  const triggerPrint = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch (error) {
      console.error('[CharcuLogic Produktionsdatenblatt] iframe-Druck fehlgeschlagen:', error);
      hooks.onBlocked?.(error);
    }
  };
  if (frame.contentWindow?.document.readyState === 'complete') {
    setTimeout(triggerPrint, 250);
  } else {
    frame.onload = () => setTimeout(triggerPrint, 250);
  }
  return { mode: 'iframe', html, frame };
}
