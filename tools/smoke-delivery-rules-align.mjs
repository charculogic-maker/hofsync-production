#!/usr/bin/env node
/**
 * Smoke: DELIVERY_WRITE_FIELDS (web/mhd.js) muss in firebase.rules hasOnly
 * für wareneingang_lieferungen enthalten sein — sonst permission-denied an der Rampe.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = fs.readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const rulesSrc = fs.readFileSync(path.join(root, 'firebase.rules'), 'utf8');

const setMatch = mhdSrc.match(/const DELIVERY_WRITE_FIELDS = new Set\(\[([\s\S]*?)\]\)/);
assert.ok(setMatch, 'DELIVERY_WRITE_FIELDS Set in mhd.js');
const fields = [...setMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.ok(fields.includes('warenKategorieMetzgerei'), 'Client kennt warenKategorieMetzgerei');
assert.ok(fields.includes('lieferant'), 'Client kennt lieferant');

const blockMatch = rulesSrc.match(
  /match \/tenants\/\{tenantId\}\/wareneingang_lieferungen\/\{document\}[\s\S]*?allow delete:[^\n]+\n\s*\}/,
);
assert.ok(blockMatch, 'wareneingang_lieferungen Block in firebase.rules');
const block = blockMatch[0];

for (const field of fields) {
  assert.ok(
    block.includes(`'${field}'`),
    `firebase.rules hasOnly fehlt Feld '${field}' (würde permission-denied auslösen)`,
  );
}

assert.match(mhdSrc, /withSanitizedDeliveryAudit/);
assert.match(mhdSrc, /persistPendingDeliveryFallback/);
assert.match(mhdSrc, /charculogic_pending_deliveries/);
assert.match(mhdSrc, /Cloud-Sync verzögert/);
assert.match(mhdSrc, /resolveFinalizeDeliveryFirestoreTargets/);
assert.match(mhdSrc, /tenants\/\$\{tenantId\}\/wareneingang_lieferungen/);

console.log(`OK smoke-delivery-rules-align: ${fields.length} Delivery-Felder in Rules aligned.`);
