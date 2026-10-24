/**
 * Smoke: Ampel-Badge ist tippbar und togglied auf MHD-Datum.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhdSrc = readFileSync(path.join(root, 'web/mhd.js'), 'utf8');
const htmlSrc = readFileSync(path.join(root, 'web/index.html'), 'utf8');
const filterSrc = readFileSync(path.join(root, 'web/mhd-monitor-filter.js'), 'utf8');

assert.ok(mhdSrc.includes('data-mhd-days-badge="1"'), 'Ampel hat data-mhd-days-badge');
assert.ok(mhdSrc.includes('data-mhd-date-label'), 'Ampel speichert MHD-Datum');
assert.ok(mhdSrc.includes('toggleMhdDaysBadge'), 'Toggle-Helper vorhanden');
assert.ok(mhdSrc.includes('Tippen für MHD-Datum'), 'Hinweistext für Tippen');
assert.ok(mhdSrc.includes('buildMhdAmpelBadgeHtml(resttage, prod)'), 'Hauptkarte übergibt Produkt');
assert.ok(mhdSrc.includes("return 'kuehlware'"), 'Kühlware als eigene Monitor-Gruppe');

assert.ok(htmlSrc.includes('data-mhd-category-filter="kuehlware"'), 'Kühlware-Filter-Button');
assert.ok(htmlSrc.includes('data-mhd-category-filter="mopro"'), 'MoPro-Filter-Button');
assert.ok(
  !htmlSrc.includes('data-mhd-category-filter="mopro"')
    || !/<button[^>]*data-mhd-category-filter="mopro"[^>]*>\s*🥛 MoPro &(?:amp;)? Kühlware\s*<\/button>/.test(htmlSrc),
  'Kombinierter MoPro&Kühlware-Monitor-Filter entfernt',
);
assert.ok(/data-mhd-category-filter="mopro"[^>]*>\s*🥛 MoPro\s*</.test(htmlSrc), 'MoPro-Button-Label getrennt');

assert.ok(filterSrc.includes("kuehlware: 2"), 'Kühlware-Horizont 2 Tage');
assert.ok(filterSrc.includes("mopro: '🥛 MoPro'"), 'MoPro-Label getrennt');
assert.ok(filterSrc.includes("kuehlware: '❄️ Kühlware'"), 'Kühlware-Label getrennt');

console.log('OK smoke-mhd-ampel-date-toggle: Filter-Split + Ampel-Datum-Toggle vorhanden.');
