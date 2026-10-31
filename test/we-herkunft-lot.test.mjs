/**
 * Phase C.2: Wareneingang ↔ Herkunft über LOT / lieferungId koppeln.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Wareneingang ↔ Herkunft LOT-Kopplung', () => {
  const mhd = read('web/mhd.js');
  const trace = read('web/traceability.js');
  const html = read('web/index.html');
  const rules = read('firebase.rules');
  const css = read('web/style.css');
  const sw = read('web/sw.js');
  const app = read('web/app.js');

  it('schreibt lieferungId/receivingLot/source in Herkunft-Payload', () => {
    expect(trace).to.match(/payload\.lieferungId\s*=/);
    expect(trace).to.match(/payload\.receivingLot\s*=/);
    expect(trace).to.match(/source:\s*lieferungId \? 'wareneingang' : 'manual'/);
    expect(trace).to.match(/receivingLink/);
  });

  it('prefills mit lieferungId und stashed Später-Pending', () => {
    expect(trace).to.match(/export function prefillChargenDokuFromReceiving/);
    expect(trace).to.match(/lieferungId\s*=\s*''/);
    expect(trace).to.match(/export function stashLmivPendingFromReceiving/);
    expect(trace).to.match(/export function clearLmivPendingLocal/);
    expect(mhd).to.match(/stashLmivPendingFromReceiving\(/);
    expect(mhd).to.match(/lmivPending:\s*true/);
    expect(mhd).to.match(/lieferungId:\s*deliveryId/);
  });

  it('zeigt Banner für offene LMIV aus Wareneingang', () => {
    expect(html).to.match(/id="trace-receiving-link-banner"/);
    expect(html).to.match(/id="trace-receiving-link-apply"/);
    expect(css).to.match(/\.trace-receiving-link-banner/);
    expect(trace).to.match(/syncReceivingLinkBanner/);
  });

  it('erlaubt Kopplungsfelder in Firestore-Rules', () => {
    expect(rules).to.match(/'lieferungId',\s*'receivingLot',\s*'source'/);
    expect(rules).to.match(/'lmivPending',\s*'lmivPendingAt',\s*'chargenDokuId'/);
  });

  it('übernimmt LOT in MHD-Posten und Delivery-Write-Fields', () => {
    expect(mhd).to.match(/record\.lot\s*=\s*headLot/);
    expect(mhd).to.match(/'lmivPending',\s*'lmivPendingAt',\s*'chargenDokuId'/);
    expect(mhd).to.match(/\/\/ LOT\/Charge: immer mitschreiben/);
  });

  it('zeigt Wareneingang-Bezug im Thekenklade-Detail', () => {
    expect(trace).to.match(/record\.lieferungId/);
    expect(trace).to.match(/Wareneingang/);
  });

  it('bumpt den Service-Worker-Cache', () => {
    expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261031-arch-mhd-nav-v1'");
    expect(app).to.include('sw.js?v=20261031-arch-mhd-nav-v1');
  });
});
