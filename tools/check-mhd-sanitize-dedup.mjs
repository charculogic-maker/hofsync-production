#!/usr/bin/env node
import { chromium } from 'playwright';
import { sanitizeProductName } from '../web/utils.js';

const sanitizeCases = [
  { input: 'Brat- und Back"l', expected: 'Brat- und Backöl' },
  { input: 'b*Mozzarella Kugel, 100g', expected: 'Bio Mozzarella Kugel, 100g' },
  { input: 'b*Sultaninen', expected: 'Bio Sultaninen' },
  { input: 'Wanda Frischk\u0084se Walnuss/Karamell', expected: 'Wanda Frischkäse Walnuss/Karamell' },
  { input: 'Grie\u00e1pudding Traditionell', expected: 'Grießpudding Traditionell' },
  { input: 'b*Butter S\u00fc\u00e1rahm', expected: 'Bio Butter Süßrahm' },
  { input: 'Weiáenhorner Paprika Creme', expected: 'Weißenhorner Paprika Creme' },
  { input: 'Weiáhorner Joghurt', expected: 'Weißhorner Joghurt' },
];

const sanitizeSteps = sanitizeCases.map(({ input, expected }) => ({
  name: `sanitize ${input.slice(0, 24)}`,
  pass: sanitizeProductName(input) === expected,
  got: sanitizeProductName(input),
  expected,
}));

const failedSanitize = sanitizeSteps.filter((step) => !step.pass);
if (failedSanitize.length) {
  console.error('Sanitize failures:', failedSanitize);
  process.exit(1);
}

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=mhd-sanitize-dedup';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

const uiResult = await page.evaluate(async () => {
  const steps = [];
  const tenantId = 'StevesHof_Hauptbetrieb';
  localStorage.setItem('charculogic.tenantId', tenantId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoInOneDay = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  const isoInTwoDays = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const seed = [
    { id: 'dup-a', ean: '4035626114509', name: 'Brat- und Back\u0022l', produkt: 'Brat- und Back\u0022l', qty: 2, tage: 1, kategorie: '\uD83E\uDD5BMoPro', mhdDate: isoInOneDay, mhd: isoInOneDay, status: 'aktiv' },
    { id: 'dup-b', ean: '4035626114509', name: 'Brat- und Back\u0022l', produkt: 'Brat- und Back\u0022l', qty: 3, tage: 1, kategorie: '\uD83E\uDD5BMoPro', mhdDate: isoInOneDay, mhd: isoInOneDay, status: 'aktiv' },
    { id: 'single', ean: '4035626111614', name: 'b*Mozzarella Kugel', produkt: 'b*Mozzarella Kugel', qty: 1, tage: 2, kategorie: '\uD83E\uDD5BMoPro', mhdDate: isoInTwoDays, mhd: isoInTwoDays, status: 'aktiv' },
  ];

  window.firebase = { apps: [{}], auth: () => ({ currentUser: { uid: 'employee-user' } }) };
  window.canStartFirestoreLiveListeners = () => true;
  window.hasActiveFirebaseAuthUser = () => true;

  const makeCollection = () => ({
    onSnapshot: (onNext) => {
      onNext({
        docs: seed.map((item) => ({ id: item.id, data: () => ({ ...item }) })),
        metadata: { fromCache: false },
        empty: false,
      });
      return () => {};
    },
    where: () => makeCollection(),
    limit: () => ({ get: async () => ({ empty: true, docs: [] }) }),
    doc: () => ({ set: async () => {}, update: async () => {}, delete: async () => {} }),
  });

  const { initMhdModule } = await import('./mhd.js');
  initMhdModule({ collection: () => makeCollection() }, {
    writeOrQueueFirestore: async () => 'written',
    addPendingSync: () => {},
  }, { playClickSound: () => {} }, {
    showHUD: () => {},
    isFirebaseReady: () => true,
    getFirebase: () => window.firebase,
    tenantId,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  const cards = [...document.querySelectorAll('.mhd-card')];
  const duplicateBadge = document.querySelector('.mhd-duplicate-badge');
  const names = [...document.querySelectorAll('.mhd-product-name')].map((el) => el.textContent.trim());
  const qtyInput = document.querySelector('#mhd-card-dup-a .mhd-qty-input, .mhd-qty-input');

  steps.push({ name: 'renders grouped cards', pass: cards.length === 2 });
  steps.push({ name: 'shows duplicate badge', pass: Boolean(duplicateBadge?.textContent.includes('Duplikat (2x)')) });
  steps.push({ name: 'sanitized Backöl name', pass: names.some((name) => name.includes('Back\u00f6l')) });
  steps.push({ name: 'sanitized Bio Mozzarella name', pass: names.some((name) => name.includes('Bio Mozzarella')) });
  steps.push({ name: 'summed duplicate qty', pass: qtyInput && Number(qtyInput.value) === 5 });

  return { steps, cards: cards.length, names, duplicateBadge: duplicateBadge?.textContent || null };
});

console.log(JSON.stringify({ sanitizeSteps, uiResult }, null, 2));
const failedUi = uiResult.steps.filter((step) => !step.pass);
if (failedUi.length) {
  console.error('UI failures:', failedUi);
  process.exit(1);
}

await browser.close();
console.log('MHD sanitize + dedup check passed.');
