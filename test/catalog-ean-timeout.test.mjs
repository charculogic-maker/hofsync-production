/**
 * C.1 follow-up: catalog EAN reads must not hang finalizeDelivery.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Catalog EAN timeout (finalize guard)', () => {
  const catalog = read('web/catalog-ean.js');
  const mhd = read('web/mhd.js');
  const sw = read('web/sw.js');
  const app = read('web/app.js');

  it('timeoutet Stammdaten-/product_master-GETs', () => {
    expect(catalog).to.match(/CATALOG_READ_TIMEOUT_MS\s*=\s*3500/);
    expect(catalog).to.match(/withCatalogReadTimeout/);
    expect(catalog).to.match(/CatalogReadTimeoutError/);
    expect(catalog).to.match(/Promise\.all\(\[/);
    expect(catalog).to.match(/loadCatalogCollectionSnap\('stammdaten'/);
    expect(catalog).to.match(/loadCatalogCollectionSnap\('product_master'/);
  });

  it('wird von finalizeDelivery vor MHD-Writes geladen', () => {
    expect(mhd).to.match(/loadCatalogEanIndex\(/);
    expect(mhd).to.match(/finalizeDelivery/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261026-phase-d-header-v1'");
    expect(app).to.include('sw.js?v=20261026-phase-d-header');
  });
});
