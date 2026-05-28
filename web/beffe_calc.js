const MATERIAL_KEYS = [
  'S I', 'S II', 'S III', 'S IV Bauch', 'S V Bauch Fett', 'S V II Speck', 'S V III Kutterfett',
  'R I', 'R II', 'R III',
  'Leber', 'Kopffleisch', 'Zunge', 'Schwarten',
  'Einlage S I', 'Einlage S II', 'Einlage SIV Bauch', 'Einlage Wamme', 'Einlage Speck',
  'Eis / Brühe', 'Blut',
];

const SCHWEIN_CLASS_MATERIALS = ['S I', 'S II', 'S III', 'S IV Bauch'];
const RIND_CLASS_MATERIALS = ['R I', 'R II', 'R III'];

export class BeffeCalcEngine {
  constructor(preParsedJson = {}) {
    this.rohstoffe = preParsedJson.rohstoffe || {};
    this.rohstoffeByKategorie = preParsedJson.rohstoffeByKategorie || {};
    this.rezepte = preParsedJson.rezepte || {};
    this.generatedAt = preParsedJson.generatedAt || '';
    this.fleischpreiseMeta = null;
    this.tagesPreise = {};
  }

  applyLiveMeatPrices(priceEntries = [], meta = {}) {
    this.tagesPreise = buildTagesPreiseFromFleischnotierung(priceEntries);
    this.fleischpreiseMeta = meta;

    Object.entries(this.tagesPreise).forEach(([material, priceKg]) => {
      if (this.rohstoffe[material]) {
        this.rohstoffe[material] = { ...this.rohstoffe[material], preis: priceKg };
      }
      Object.keys(this.rohstoffeByKategorie).forEach((key) => {
        if (!key.endsWith(`::${material}`)) return;
        this.rohstoffeByKategorie[key] = {
          ...this.rohstoffeByKategorie[key],
          preis: priceKg,
        };
      });
    });

    return this.tagesPreise;
  }

  getRecipeNames() {
    return Object.keys(this.rezepte).sort((a, b) => a.localeCompare(b, 'de'));
  }

  getRecipe(recipeName) {
    return this.rezepte[recipeName] || null;
  }

  calculateCharge(recipeName, targetTotalKg, tagesPreise = {}) {
    const recipe = this.getRecipe(recipeName);
    if (!recipe) {
      throw new Error(`Rezept nicht gefunden: ${recipeName}`);
    }

    const targetKg = parseNumber(targetTotalKg);
    if (targetKg <= 0) {
      throw new Error('Zielgewicht muss groesser als 0 kg sein.');
    }

    const baseTotalKg = recipe.baseTotalKg || recipe.ingredients.reduce((sum, item) => sum + item.amountKg, 0);
    if (baseTotalKg <= 0) {
      throw new Error(`Rezept ohne aktive Basismenge: ${recipeName}`);
    }

    const scale = targetKg / baseTotalKg;
    let totalCost = 0;
    let totalBeffeKg = 0;
    let totalFatKg = 0;
    let totalWaterKg = 0;

    const ingredients = recipe.ingredients.map((ingredient) => {
      const categoryKey = `${ingredient.category || recipe.category}::${ingredient.material}`;
      const materialData = this.rohstoffeByKategorie[categoryKey] || this.rohstoffe[ingredient.material] || {};
      const amountKg = ingredient.amountKg * scale;
      const livePrices = Object.keys(tagesPreise).length ? tagesPreise : this.tagesPreise;
      const priceKg = resolvePrice(ingredient.material, livePrices, materialData.preis, ingredient.basePriceKg);
      const wasserProzent = materialData.wasser ?? 0;
      const beffeProzent = materialData.beffe ?? 0;
      const fettProzent = materialData.fett ?? 0;
      const cost = amountKg * priceKg;
      const beffeKg = amountKg * beffeProzent / 100;
      const fatKg = amountKg * fettProzent / 100;
      const waterKg = amountKg * wasserProzent / 100;

      totalCost += cost;
      totalBeffeKg += beffeKg;
      totalFatKg += fatKg;
      totalWaterKg += waterKg;

      return {
        material: ingredient.material,
        amountKg,
        amountG: amountKg * 1000,
        percent: amountKg / targetKg * 100,
        priceKg,
        cost,
        wasserProzent,
        beffeProzent,
        fettProzent,
      };
    });

    const totals = {
      totalKg: targetKg,
      baseTotalKg,
      totalCost,
      costPerKg: totalCost / targetKg,
      beffeProzent: totalBeffeKg / targetKg * 100,
      fettProzent: totalFatKg / targetKg * 100,
      wasserProzent: totalWaterKg / targetKg * 100,
    };

    const warnings = createWarnings(recipe, totals);
    return { recipeName, category: recipe.category, ingredients, totals, warnings };
  }
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = cleanText(value);
  const text = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!text) return 0;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function resolvePrice(material, tagesPreise, lookupPrice, fallbackPrice) {
  const liveValue = tagesPreise?.[material] ?? tagesPreise?.[cleanText(material)];
  const livePrice = parseNumber(liveValue);
  if (livePrice > 0) return livePrice;
  if (lookupPrice > 0) return lookupPrice;
  return fallbackPrice > 0 ? fallbackPrice : 0;
}

function createWarnings(recipe, totals) {
  const warnings = [];
  const category = cleanText(recipe.category).toLowerCase();
  const isBruehwurst = category.includes('bruehwurst') || category.includes('brühwurst');

  if (isBruehwurst && totals.beffeProzent < 12) {
    warnings.push(`BEFFE ${formatNumber(totals.beffeProzent)} % liegt unter 12 % fuer Bruehwurst.`);
  }
  if (totals.fettProzent > 40) {
    warnings.push(`Fett ${formatNumber(totals.fettProzent)} % ist kritisch hoch.`);
  } else if (totals.fettProzent > 30) {
    warnings.push(`Fett ${formatNumber(totals.fettProzent)} % liegt ueber der Warnmarke von 30 %.`);
  }

  return warnings;
}

export function buildTagesPreiseFromFleischnotierung(priceEntries = []) {
  const tagesPreise = {};
  if (!Array.isArray(priceEntries) || priceEntries.length === 0) return tagesPreise;

  const schweinQueue = [...SCHWEIN_CLASS_MATERIALS];
  const rindQueue = [...RIND_CLASS_MATERIALS];

  priceEntries.forEach((entry, index) => {
    const priceKg = pickMarketPrice(entry);
    if (!(priceKg > 0)) return;

    const material = resolveMaterialFromMarketEntry(entry, {
      schweinQueue,
      rindQueue,
      index,
    });
    if (material) {
      tagesPreise[material] = priceKg;
    }
  });

  return tagesPreise;
}

function pickMarketPrice(entry) {
  const conv = Number(entry?.price_conv);
  const bio = Number(entry?.price_bio);
  if (Number.isFinite(conv) && conv > 0) return conv;
  if (Number.isFinite(bio) && bio > 0) return bio;
  return 0;
}

function normalizeMarketText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveMaterialFromMarketEntry(entry, queues) {
  const cut = normalizeMarketText(entry?.cut);
  const category = normalizeMarketText(entry?.category);

  for (const material of MATERIAL_KEYS) {
    const token = normalizeMarketText(material);
    if (cut.includes(token) || category.includes(token)) {
      return material;
    }
  }

  if (category.includes('schwein') || cut.includes('schwein') || /^s\s/i.test(entry?.cut || '')) {
    if (/\b(iv|4|viertel|bauch)\b/.test(cut) && queues.schweinQueue.includes('S IV Bauch')) {
      return shiftQueue(queues.schweinQueue, 'S IV Bauch');
    }
    const classIndex = parseClassIndex(cut);
    if (classIndex > 0) {
      const material = ['', 'S I', 'S II', 'S III'][classIndex];
      if (material && queues.schweinQueue.includes(material)) {
        return shiftQueue(queues.schweinQueue, material);
      }
    }
    return shiftQueue(queues.schweinQueue);
  }

  if (category.includes('rind') || cut.includes('rind') || /^r\s/i.test(entry?.cut || '')) {
    const classIndex = parseClassIndex(cut);
    if (classIndex > 0) {
      const material = ['', 'R I', 'R II', 'R III'][classIndex];
      if (material && queues.rindQueue.includes(material)) {
        return shiftQueue(queues.rindQueue, material);
      }
    }
    return shiftQueue(queues.rindQueue);
  }

  if (cut.includes('leber')) return 'Leber';
  if (cut.includes('kopf')) return 'Kopffleisch';
  if (cut.includes('zunge')) return 'Zunge';
  if (cut.includes('schwarte')) return 'Schwarten';

  const numericId = Number(entry?.id);
  if (Number.isFinite(numericId) && numericId >= 1 && numericId <= 3) {
    if (category.includes('schwein')) return shiftQueue(queues.schweinQueue);
    if (category.includes('rind')) return shiftQueue(queues.rindQueue);
  }

  return null;
}

function parseClassIndex(cut) {
  const match = cut.match(/\b(i{1,3}|1|2|3)\b/);
  if (!match) return 0;
  const token = match[1];
  if (token === '1' || token === 'i') return 1;
  if (token === '2' || token === 'ii') return 2;
  if (token === '3' || token === 'iii') return 3;
  return 0;
}

function shiftQueue(queue, preferred) {
  if (preferred && queue.includes(preferred)) {
    const index = queue.indexOf(preferred);
    queue.splice(index, 1);
    return preferred;
  }
  return queue.shift() || null;
}

export function pickLatestFleischpreiseDoc(docs = []) {
  if (!docs.length) return null;

  const scored = docs.map((doc) => {
    const data = doc.data || doc;
    const id = String(doc.id || data.kw || '');
    const idMatch = id.match(/^(\d{4})_kw(\d{1,2})$/i);
    const year = Number(data.year) || Number(idMatch?.[1]) || 0;
    const week = Number(data.week) || Number(idMatch?.[2]) || 0;
    const fetchedAt = data.fetchedAt?.toDate?.()
      ? data.fetchedAt.toDate().getTime()
      : Date.parse(data.fetchedAt || data.updatedAt || 0) || 0;
    return { doc, year, week, fetchedAt, score: year * 100 + week };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.fetchedAt - a.fetchedAt;
  });

  return scored[0]?.doc || docs[0];
}

export function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}
