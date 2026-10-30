/**
 * Smoke: MHD-Tageslauf-SLA Verdrahtung (Badge, Banner, Cron, Cache).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label}: erwartet "${needle}"`);
}

const mhdSrc = read('web/mhd.js');
const slaSrc = read('web/mhd-sla.js');
const indexSrc = read('web/index.html');
const styleSrc = read('web/style.css');
const swSrc = read('web/sw.js');
const fnIndex = read('functions/index.js');
const fnSla = read('functions/mhdSla.js');

assertIncludes(slaSrc, 'countMhdSlaCriticalOpen', 'Frontend Zähler');
assertIncludes(slaSrc, 'updateMhdSlaBadge', 'Frontend Badge');
assertIncludes(slaSrc, 'MHD_SLA_DEFAULT_CRITICAL_MAX_RESTTAGE = 1', 'Schwelle 1');
assertIncludes(styleSrc, 'white-space: nowrap', 'Banner-Zähler nowrap');
assertIncludes(slaSrc, 'mhd-sla-banner-count', 'Banner-Zähler-Span');
assert.ok(
  !slaSrc.includes('MHD_SLA_MIN_RESTTAGE_FOR_CRITICAL'),
  'Keine Untergrenze: Tippfehler-MHDs bleiben im Tageslauf',
);

assertIncludes(mhdSrc, "from './mhd-sla.js'", 'mhd.js importiert mhd-sla');
assertIncludes(mhdSrc, 'refreshMhdSlaIndicators()', 'SLA-Refresh angebunden');
assertIncludes(mhdSrc, 'openMhdCriticalSlaView', 'Banner öffnet MHD-Ansicht');

assertIncludes(indexSrc, 'id="mhd-sla-banner"', 'Banner im Markup');
assertIncludes(styleSrc, '.mhd-sla-banner', 'Banner-CSS');

assertIncludes(swSrc, '/mhd-sla.js', 'SW cached mhd-sla.js');
assertIncludes(swSrc, 'mhd-sla-wrap', 'SW Cache-Bump');

assertIncludes(fnSla, 'handleMhdSlaScheduled', 'Backend Scheduler Handler');
assertIncludes(fnSla, "normalizedStage = stage === 's2' ? 's2' : 's1'", 'Backend Stufen s1/s2');
assertIncludes(fnSla, 'slaTaskDocId', 'Idempotente Task-IDs');
assertIncludes(fnSla, "DEFAULT_AUDIENCE_GROUP = 'laden'", 'Default-Zielgruppe Laden');
assertIncludes(fnIndex, "schedule: '30 7 * * *'", 'Cron 07:30');
assertIncludes(fnIndex, "schedule: '0 10 * * *'", 'Cron 10:00');
assertIncludes(fnIndex, 'mhdSlaReminderScheduled', 'Export Reminder');
assertIncludes(fnIndex, 'mhdSlaEscalateScheduled', 'Export Eskalation');

console.log('OK smoke-mhd-sla: Reminder/Eskalation-Verdrahtung erfüllt.');
