/**
 * Wareneingang-Abschluss: Pfade tenant-scoped, Rules-Felder aligned, MoPro ohne Temp.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStrictHaccpTemperatureRequired } from '../web/receiving.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhd = fs.readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');

describe('Wareneingang Finalize Permissions Guard', () => {
  it('schreibt nur unter tenants/{tenantId}/wareneingang_lieferungen und mhd_liste', () => {
    expect(mhd).to.match(/deliveryPath:\s*`tenants\/\$\{tenantId\}\/wareneingang_lieferungen`/);
    expect(mhd).to.match(/mhdPath:\s*`tenants\/\$\{tenantId\}\/mhd_liste`/);
    expect(mhd).to.not.match(/collectionPath:\s*['"]deliveries['"]/);
    expect(mhd).to.not.match(/db\.collection\(\s*['"]deliveries['"]\s*\)/);
  });

  it('aligned DELIVERY_WRITE_FIELDS mit firebase.rules hasOnly', () => {
    const setMatch = mhd.match(/const DELIVERY_WRITE_FIELDS = new Set\(\[([\s\S]*?)\]\)/);
    expect(setMatch).to.be.ok;
    const fields = [...setMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const block = rules.match(
      /match \/tenants\/\{tenantId\}\/wareneingang_lieferungen\/\{document\}[\s\S]*?allow delete:[^\n]+\n\s*\}/,
    )?.[0] || '';
    expect(block).to.include('warenKategorieMetzgerei');
    fields.forEach((field) => {
      expect(block, `Rules missing ${field}`).to.include(`'${field}'`);
    });
  });

  it('lässt StevesHof MoPro Laden-Abschluss ohne Temperatur zu', () => {
    const blocked = isStrictHaccpTemperatureRequired({
      mode: 'schnell',
      warenKategorie: '🥛MoPro',
      warenKategorieMetzgerei: '',
    }) && true;
    expect(blocked).to.equal(false);
    expect(mhd).to.include('withSanitizedDeliveryAudit');
    expect(mhd).to.include('silentPermissionDenied: true');
    expect(mhd).to.include('persistPendingDeliveryFallback');
  });
});
