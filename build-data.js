const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const ROHSTOFFE_PATH = path.join(ROOT, 'data', 'beffe_rohstoffe.csv');
const REZEPTE_PATH = path.join(ROOT, 'data', 'beffe_rezepte.csv');
const OUTPUT_DIR = path.join(ROOT, 'web', 'data');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'beffe_data.json');

function parseCsv(csvData) {
  const text = String(csvData || '').replace(/^\uFEFF/, '');
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => cleanText(value))) records.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => cleanText(value))) records.push(row);
  if (records.length < 2) return [];

  const headers = records[0].map(cleanText);
  return records.slice(1).map((record) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = record[index] ?? '';
    });
    return item;
  });
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = cleanText(value);
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parseRohstoffe(csvData) {
  const rows = parseCsv(csvData);
  const rohstoffe = {};
  const rohstoffeByKategorie = {};

  rows.forEach((row) => {
    const material = cleanText(row.Material);
    if (!material) return;

    const kategorie = cleanText(row.Kategorie);
    const beffe = parseNumber(row.BEFFE_Prozent);
    const be = parseNumber(row.BE_Prozent);
    const item = {
      preis: parseNumber(row.Preis_kg),
      wasser: parseNumber(row.Wasser_Prozent),
      beffe,
      be,
      fe: Math.round((beffe + be) * 10000) / 10000,
      fett: parseNumber(row.Fett_Prozent),
    };

    if (!rohstoffe[material]) rohstoffe[material] = item;
    if (kategorie) rohstoffeByKategorie[`${kategorie}::${material}`] = item;
  });

  return { rohstoffe, rohstoffeByKategorie };
}

function parseRezepte(csvData) {
  const rows = parseCsv(csvData);
  const rezepte = {};

  rows.forEach((row) => {
    const aktiv = cleanText(row.Aktiv).toUpperCase() === 'TRUE';
    const anteilProzent = parseNumber(row.Anteil_Prozent);
    if (!aktiv || anteilProzent <= 0) return;

    const rezept = cleanText(row.Rezept);
    const material = cleanText(row.Material);
    if (!rezept || !material) return;

    if (!rezepte[rezept]) {
      rezepte[rezept] = {
        name: rezept,
        category: cleanText(row.Kategorie),
        ingredients: [],
      };
    }

    rezepte[rezept].ingredients.push({
      material,
      amountKg: parseNumber(row.Menge_kg),
      percent: anteilProzent,
      basePriceKg: parseNumber(row.Preis_kg),
      category: cleanText(row.Kategorie),
    });
  });

  Object.values(rezepte).forEach((recipe) => {
    recipe.ingredients.sort((a, b) => b.amountKg - a.amountKg || a.material.localeCompare(b.material, 'de'));
    recipe.baseTotalKg = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.amountKg, 0);
  });

  return rezepte;
}

function buildBeffeData() {
  const rohstoffeCsv = fs.readFileSync(ROHSTOFFE_PATH, 'utf8');
  const rezepteCsv = fs.readFileSync(REZEPTE_PATH, 'utf8');
  const { rohstoffe, rohstoffeByKategorie } = parseRohstoffe(rohstoffeCsv);
  const rezepte = parseRezepte(rezepteCsv);

  const payload = {
    generatedAt: new Date().toISOString(),
    rohstoffe,
    rohstoffeByKategorie,
    rezepte,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload)}\n`, 'utf8');

  console.log(`[BEFFE] ${Object.keys(rohstoffe).length} Rohstoffe exportiert.`);
  console.log(`[BEFFE] ${Object.keys(rezepte).length} aktive Rezepte exportiert.`);
  console.log(`[BEFFE] ${path.relative(ROOT, OUTPUT_PATH)} geschrieben.`);
}

buildBeffeData();
