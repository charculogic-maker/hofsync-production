#!/usr/bin/env node
import { chromium } from 'playwright';
import { sanitizeProductName } from '../web/utils.js';

const sanitizeCases = [
  { input: 'Weiáenhorner Paprika Creme', expected: 'Weißenhorner Paprika Creme' },
  { input: 'Weiáhorner', expected: 'Weißhorner' },
];
const sanitizeSteps = sanitizeCases.map(({ input, expected }) => ({
  name: `sanitize ${input}`,
  pass: sanitizeProductName(input) === expected,
  got: sanitizeProductName(input),
  expected,
}));
if (sanitizeSteps.some((step) => !step.pass)) {
  console.error('Sanitize failures:', sanitizeSteps.filter((step) => !step.pass));
  process.exit(1);
}

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=mhd-stammdaten-edit';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

await page.evaluate(() => {
  const lock = document.getElementById('auth-lock-screen');
  if (lock) {
    lock.style.display = 'none';
    lock.classList.remove('active');
  }
});

const result = await page.evaluate(async () => {
  const steps = [];
  const writes = [];
  const tenantId = 'StevesHof_Hauptbetrieb';
  localStorage.setItem('charculogic.tenantId', tenantId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoInTwoDays = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const seed = [
    {
      id: 'weissenhorner-paprika',
      ean: '4028332320111',
      name: 'Weiáenhorner Paprika Creme',
      produkt: 'Weiáenhorner Paprika Creme',
      marke: '',
      qty: 2,
      tage: 2,
      kategorie: '📦 Trockenware',
      mhdDate: isoInTwoDays,
      mhd: isoInTwoDays,
      status: 'aktiv',
    },
    {
      id: 'other-trocken',
      ean: '4012345678901',
      name: 'Rapunzel Linsen',
      produkt: 'Rapunzel Linsen',
      qty: 1,
      tage: 2,
      kategorie: '📦 Trockenware',
      mhdDate: isoInTwoDays,
      mhd: isoInTwoDays,
      status: 'aktiv',
    },
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
    limit: () => ({ get: async () => ({ empty: false, docs: [] }) }),
    doc: () => ({ set: async () => {}, update: async () => {}, delete: async () => {} }),
  });

  const { initMhdModule, getMhdProducts } = await import('./mhd.js');
  initMhdModule({ collection: () => makeCollection() }, {
    writeOrQueueFirestore: async (payload) => {
      writes.push(payload);
      return 'written';
    },
    addPendingSync: () => {},
  }, { playClickSound: () => {} }, {
    showHUD: () => {},
    isFirebaseReady: () => true,
    getFirebase: () => window.firebase,
    tenantId,
  });

  await new Promise((resolve) => setTimeout(resolve, 500));

  document.querySelector('[data-mhd-category-filter="trockenware"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 200));

  const card = document.getElementById('mhd-card-weissenhorner-paprika');
  const editBtn = card?.querySelector('[data-mhd-command="stammdaten"]');
  steps.push({
    name: 'edit-button-on-card',
    pass: Boolean(editBtn) && editBtn.textContent.includes('Bearbeiten'),
    label: editBtn?.textContent.trim() || null,
  });

  editBtn?.click();
  await new Promise((resolve) => setTimeout(resolve, 150));

  const modal = document.getElementById('mhd-stammdaten-modal');
  const nameInput = document.getElementById('mhd-stammdaten-name');
  steps.push({
    name: 'modal-opens',
    pass: Boolean(modal) && !modal.hidden && modal.classList.contains('is-open'),
    title: document.getElementById('mhd-stammdaten-title')?.textContent || null,
  });

  nameInput.value = 'Weißenhorner Paprika Creme';
  document.getElementById('mhd-stammdaten-brand').value = 'Weißenhorner';
  document.querySelector('[data-mhd-stammdaten-group="mopro"]')?.click();
  document.getElementById('mhd-stammdaten-save')?.click();
  await new Promise((resolve) => setTimeout(resolve, 300));

  const written = writes.find((entry) => entry.docId === 'weissenhorner-paprika');
  const writtenName = written?.queueData?.name || written?.onlineData?.name;
  const writtenCategory = written?.queueData?.kategorie || written?.onlineData?.kategorie;
  steps.push({
    name: 'firestore-write',
    pass: writtenName === 'Weißenhorner Paprika Creme' && String(writtenCategory).includes('MoPro'),
    writtenName,
    writtenCategory,
    collectionPath: written?.collectionPath || null,
  });

  steps.push({
    name: 'modal-closed',
    pass: Boolean(modal?.hidden) && !modal?.classList.contains('is-open'),
  });

  const moproActive = document.querySelector('[data-mhd-category-filter="mopro"]')?.classList.contains('is-active');
  const visibleCard = document.getElementById('mhd-card-weissenhorner-paprika');
  const visibleName = visibleCard?.querySelector('.mhd-product-name')?.textContent || '';
  const product = getMhdProducts().find((item) => item.id === 'weissenhorner-paprika');
  steps.push({
    name: 'card-moves-to-mopro',
    pass: moproActive && Boolean(visibleCard) && visibleName.includes('Weißenhorner Paprika Creme') && !visibleName.includes('Weiá'),
    moproActive,
    visibleName,
    productCategory: product?.kategorie || null,
  });

  return {
    steps,
    allPass: steps.every((step) => step.pass),
    tenantPathOk: String(written?.collectionPath || '').includes(`tenants/${tenantId}/`),
  };
});

console.log(JSON.stringify({ sanitizeSteps, result }, null, 2));
await browser.close();
if (!result.allPass || result.tenantPathOk === false) process.exit(1);
console.log('MHD stammdaten edit check passed.');
