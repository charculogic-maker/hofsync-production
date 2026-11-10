/**
 * Unit-Tests: CSV-Artikelstamm-Importer (Parser, Mapping, Payload).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProductMasterImportDoc,
  detectCsvDelimiter,
  mapImportCategory,
  parseProductMasterCsv,
} from '../web/csv-product-importer.js';
import { RECEIVING_SMART_CATEGORIES } from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const dashSrc = readFileSync(path.join(root, 'web/dev-dashboard.js'), 'utf8');
const swSrc = readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const rulesSrc = readFileSync(path.join(root, 'firebase.rules'), 'utf8');

describe('CSV product master importer', () => {
  it('detects semicolon vs comma delimiters', () => {
    assert.equal(detectCsvDelimiter('EAN;Name;Kategorie'), ';');
    assert.equal(detectCsvDelimiter('EAN,Name,Category'), ',');
  });

  it('parses German supplier CSV with flexible headers', () => {
    const csv = [
      'GTIN;Bezeichnung;Warengruppe;Haltbarkeit;Lieferant;ArtNr',
      '4006040007999;"Bionella Schokocreme";Trockenware;45;Rapunzel;BN-1',
      ';"Bio Vollmilch 3,5%";Milch/Joghurt;5;Molkerei Hof;MIL-9',
      '4012346156491;"Anis ganz";Gewürze;;Lebensbaum;',
    ].join('\n');

    const parsed = parseProductMasterCsv(csv);
    assert.equal(parsed.delimiter, ';');
    assert.equal(parsed.rows.length, 3);
    assert.equal(parsed.rows[0].ean, '4006040007999');
    assert.equal(parsed.rows[0].name, 'Bionella Schokocreme');
    assert.equal(parsed.rows[0].category, RECEIVING_SMART_CATEGORIES.trockenware);
    assert.equal(parsed.rows[0].daysFresh, 45);
    assert.equal(parsed.rows[0].supplier, 'Rapunzel');

    assert.equal(parsed.rows[1].category, RECEIVING_SMART_CATEGORIES.mopro);
    assert.ok(String(parsed.rows[1].ean).startsWith('gen_') || /^\d+$/.test(parsed.rows[1].ean));
    assert.equal(parsed.rows[1].daysFresh, 5);

    assert.equal(parsed.rows[2].category, RECEIVING_SMART_CATEGORIES.gewuerze);
    assert.equal(parsed.rows[2].daysFresh, 7);
  });

  it('maps meat keywords to Metzgerei/Aufschnitt bucket', () => {
    assert.equal(
      mapImportCategory('Wurstwaren', 'Bio Bratwurst'),
      RECEIVING_SMART_CATEGORIES.aufschnitt,
    );
    assert.equal(
      mapImportCategory('', 'Frischer Blattsalat'),
      RECEIVING_SMART_CATEGORIES.frische,
    );
  });

  it('builds rules-compatible Firestore payload with supplier', () => {
    const doc = buildProductMasterImportDoc('test_auto_seed', {
      ean: '4006040007999',
      name: 'Bionella',
      category: RECEIVING_SMART_CATEGORIES.trockenware,
      daysFresh: 30,
      supplier: 'Rapunzel',
    }, 'admin@example.com');
    assert.equal(doc.tenantId, 'test_auto_seed');
    assert.equal(doc.articleName, 'Bionella');
    assert.equal(doc.name, 'Bionella');
    assert.equal(doc.supplier, 'Rapunzel');
    assert.equal(doc.active, true);
    assert.ok(doc.updatedAt);
    assert.equal(doc.updatedBy, 'admin@example.com');
  });

  it('wires Mein Betrieb UI and SW cache bump', () => {
    assert.ok(indexSrc.includes('id="dev-dashboard-csv-product-import"'));
    assert.ok(indexSrc.includes('csv-product-import-dropzone'));
    assert.ok(indexSrc.includes('Erkannte Spalten: EAN/Barcode'));
    assert.ok(dashSrc.includes('bindCsvProductImporter'));
    assert.ok(dashSrc.includes('importProductMasterRows'));
    assert.ok(dashSrc.includes('parseProductMasterCsv'));
    assert.match(swSrc, /charculogic-v20261110-csv-perm-v2/);
    assert.ok(swSrc.includes('/csv-product-importer.js'));
    assert.ok(rulesSrc.includes("'supplier'"));
    assert.ok(rulesSrc.includes('canWriteProductMaster'));
    assert.ok(rulesSrc.includes('request.auth.token.superAdmin == true'));
    assert.ok(dashSrc.includes('[CSV-Import] Detailfehler beim Schreiben:'));
  });
});
