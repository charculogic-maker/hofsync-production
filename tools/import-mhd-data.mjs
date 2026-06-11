import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const DEFAULT_TENANT_ID = 'StevesHof_Hauptbetrieb';
const BATCH_SIZE = 400;

function resolveCsvPath() {
  const root = process.cwd();
  const direct = path.resolve(root, 'mhd-import.csv');
  const fallback = path.resolve(root, 'data', 'mhd-import.csv.csv');
  if (fs.existsSync(direct)) return direct;
  if (fs.existsSync(fallback)) return fallback;
  throw new Error(`CSV nicht gefunden. Erwartet: "${direct}" oder "${fallback}"`);
}

function detectDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvLine(line, delimiter) {
  const out = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  out.push(current);
  return out;
}

function cleanValue(value) {
  return String(value ?? '').replace(/\uFEFF/g, '').trim().replace(/^"(.*)"$/u, '$1').trim();
}

function toNumber(value, fallback = 0) {
  const cleaned = cleanValue(value).replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : fallback;
}

function parseGermanDateToIso(value) {
  const raw = cleanValue(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(raw)) return raw;

  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/u);
  if (!m) return '';
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

function restDaysFromIso(isoDate) {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function rowToDoc(row, tenantId) {
  const artikelName = cleanValue(row.Produktname || row.produkt || row.Name || row.Artikelname);
  const marke = cleanValue(row.Marke || row.marke);
  const barcode = cleanValue(row.Barcode || row.EAN || row.ean);
  const csvId = cleanValue(row.ID || row.id);
  const mhdIso = parseGermanDateToIso(row.MHD || row.mhd || row.Mhd);
  const qty = Math.max(0, Math.round(toNumber(row.Menge || row.qty || row.menge, 0)));
  const kategorie = cleanValue(row.kategorie || row.Kategorie) || '📦 Trockenware';
  const tage = restDaysFromIso(mhdIso);

  const docId = csvId || (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `mhd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const mhdDate = mhdIso;
  const mhdTimestamp = mhdDate ? admin.firestore.Timestamp.fromDate(new Date(`${mhdDate}T00:00:00`)) : null;
  const mhdText = Number.isFinite(tage) ? `${tage} Resttage` : '';

  return {
    docId,
    data: {
      id: docId,
      postenId: docId,
      ean: barcode,
      barcode,
      produkt: artikelName || 'Unbekannt',
      name: artikelName || 'Unbekannt',
      marke,
      brand: marke,
      mhd: mhdDate,
      mhdDate,
      mhdText,
      mhdTimestamp,
      date: mhdDate ? new Date(`${mhdDate}T00:00:00`).toLocaleDateString('de-DE') : '',
      tage,
      resttage: tage,
      status: 'offen',
      mhdActionStatus: 'offen',
      qty,
      menge: qty,
      eingangMenge: qty,
      kategorie,
      soldOut: cleanValue(row.abverkauft).toLowerCase() === 'true',
      source: 'csv-import',
      tenantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  };
}

function parseCsv(csvContent) {
  const normalized = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map(cleanValue);

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i], delimiter).map(cleanValue);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

async function commitInBatches(db, docs, tenantId) {
  let imported = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    const collectionRef = db.collection('tenants').doc(tenantId).collection('mhd_liste');

    chunk.forEach((entry) => {
      batch.set(collectionRef.doc(entry.docId), entry.data, { merge: true });
    });

    await batch.commit();
    imported += chunk.length;
    console.log(`Zwischenstand: ${imported} Artikel importiert...`);
  }
}

async function main() {
  const tenantId = process.env.TENANT_ID || DEFAULT_TENANT_ID;
  const csvPath = resolveCsvPath();
  console.log(`Starte Import aus: ${csvPath}`);
  console.log(`Mandant: ${tenantId}`);

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'hofsync-production',
    });
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  if (!rows.length) {
    console.log('Keine Datensätze in CSV gefunden. Import beendet.');
    return;
  }

  const docs = rows.map((row) => rowToDoc(row, tenantId));
  const db = admin.firestore();
  await commitInBatches(db, docs, tenantId);

  console.log(`✅ Import abgeschlossen. Gesamtzahl importierter Artikel: ${docs.length}`);
}

main().catch((err) => {
  console.error('❌ Import fehlgeschlagen:', err);
  process.exitCode = 1;
});
