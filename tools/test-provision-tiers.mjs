/**
 * Legt die Testmandanten für 79 € und 149 € in hofsync-production an
 * und prüft Tier, Status und Modulschalter.
 * Einladungstexte werden nicht ausgegeben.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
process.env.GCLOUD_PROJECT = 'hofsync-production';
process.env.GOOGLE_CLOUD_PROJECT = 'hofsync-production';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function useFirebaseCliAsApplicationDefault() {
  const file = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
  const tokens = JSON.parse(readFileSync(file, 'utf8')).tokens || {};
  if (!tokens.refresh_token) return;
  const adcPath = join(tmpdir(), 'hofsync-tier-test-adc.json');
  writeFileSync(adcPath, JSON.stringify({
    type: 'authorized_user',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: tokens.refresh_token,
  }));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
}

if (!getApps().some((app) => app && app.name === '[DEFAULT]')) {
  useFirebaseCliAsApplicationDefault();
  initializeApp({ projectId: 'hofsync-production' });
}

const { parseBillingEvent } = require('../functions/billingTiers.js');
const { provisionNewCustomerTenantInner } = require('../functions/tenantAdmin.js');

const CASES = [
  {
    label: '79,00 € Hofladen Komplett',
    companyName: 'Hofladen Lindenhof',
    email: 'kontakt@lindenhof-frische.de',
    amount: 7900,
    tier: 'hofladen_komplett',
    expectOn: ['mhdMonitor', 'wareneingang', 'haccp', 'team', 'batches', 'retterBox'],
    expectOff: ['wurstkueche'],
    expectNine: false,
  },
  {
    label: '149,00 € Metzgerei Pro',
    companyName: 'Landfleischerei Kremer',
    email: 'meister@fleischerei-kremer.de',
    amount: 14900,
    tier: 'metzgerei_pro',
    expectOn: ['wurstkueche', 'rezeptAudit'],
    expectOff: [],
    expectNine: true,
  },
];

const NINE = ['start', 'team', 'mhd', 'receiving', 'kitchen', 'haccp', 'knowledge', 'buero', 'chargenDoku'];

function checkoutEvent(testCase) {
  return parseBillingEvent('stripe', {
    id: `evt_tier_${testCase.amount}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        customer_email: testCase.email,
        customer_details: { email: testCase.email, name: testCase.companyName },
        metadata: {},
        amount_total: testCase.amount,
      },
    },
  });
}

function flag(modules, key) {
  return modules?.[key] === true;
}

async function main() {
  const db = getFirestore();
  const rows = [];

  for (const testCase of CASES) {
    const event = checkoutEvent(testCase);
    if (event.tier !== testCase.tier || event.companyName !== testCase.companyName) {
      throw new Error(
        `${testCase.label}: Fallback lieferte tier=${event.tier} name=${event.companyName}`,
      );
    }

    const result = await provisionNewCustomerTenantInner({
      companyName: event.companyName,
      adminEmail: event.email,
      tier: event.tier,
      actorUid: 'tier-test',
      billing: {
        provider: 'stripe',
        adminEmail: event.email,
        subscriptionId: `sub_test_${testCase.amount}`,
        customerId: `cus_test_${testCase.amount}`,
      },
    });

    const snap = await db.doc(`tenants/${result.tenantId}`).get();
    const data = snap.data() || {};
    const modules = data.enabledModules || {};
    const problems = [];
    if (!snap.exists) problems.push('Dokument fehlt');
    if (data.status !== 'active') problems.push(`status=${data.status || 'leer'}`);
    if (data.tier !== testCase.tier) problems.push(`tier=${data.tier || 'leer'}`);
    testCase.expectOn.forEach((key) => {
      if (!flag(modules, key)) problems.push(`${key} ist aus`);
    });
    testCase.expectOff.forEach((key) => {
      if (flag(modules, key)) problems.push(`${key} ist an`);
    });
    if (testCase.expectNine) {
      const on = NINE.filter((key) => flag(modules, key));
      if (on.length !== NINE.length) {
        problems.push(`Module ${on.length}/9, aus: ${NINE.filter((key) => !flag(modules, key)).join(', ')}`);
      }
    }

    rows.push({
      label: testCase.label,
      tenantId: result.tenantId,
      created: result.created === true,
      status: data.status || '',
      tier: data.tier || '',
      wurstkueche: flag(modules, 'wurstkueche'),
      rezeptAudit: flag(modules, 'rezeptAudit'),
      nine: `${NINE.filter((key) => flag(modules, key)).length}/9`,
      ok: problems.length === 0,
      problems,
    });
  }

  console.log('--- Tarif-Provisionierung hofsync-production ---');
  rows.forEach((row) => {
    console.log(
      `${row.ok ? 'OK' : 'FEHLER'} ${row.label} | tenants/${row.tenantId} | status=${row.status} | tier=${row.tier} | Module ${row.nine} | wurstkueche=${row.wurstkueche} | rezeptAudit=${row.rezeptAudit} | ${row.created ? 'neu angelegt' : 'bestehend aktualisiert'}`,
    );
    if (row.problems.length) console.log(`  ${row.problems.join('; ')}`);
  });
  const passed = rows.filter((row) => row.ok).length;
  console.log(`Zusammenfassung: ${passed}/${rows.length} Mandanten mit Status active und den erwarteten Modulschaltern.`);
  if (passed !== rows.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
