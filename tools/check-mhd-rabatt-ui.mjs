#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=mhd-product-rabatt';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

const uiResult = await page.evaluate(async () => {
  const isoDaysFromToday = (days) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  };
  const steps = [];
  const tenantId = 'StevesHof_Hauptbetrieb';
  localStorage.setItem('charculogic.tenantId', tenantId);
  // Ensure default matrix (no stale tenant override from earlier runs).
  localStorage.removeItem(`charculogic_discount_matrix_${tenantId}`);

  const lock = document.getElementById('auth-lock-screen');
  if (lock) {
    lock.style.display = 'none';
    lock.classList.remove('active');
  }

  const seed = [
    { id: 'frisch-2', ean: '4035626114608', name: 'Frischmilch Hof 3,8%', produkt: 'Frischmilch Hof 3,8%', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'frisch-1', ean: '4035626114622', name: 'b*Vollmilch Demeter 3,8% Flasche', produkt: 'b*Vollmilch Demeter 3,8% Flasche', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
    { id: 'frisch-0', ean: '4035626100274', name: 'b*Milch Demeter 1,5% Flasche', produkt: 'b*Milch Demeter 1,5% Flasche', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'joghurt-3', ean: '4035626114509', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(3), mhd: isoDaysFromToday(3), status: 'aktiv' },
    { id: 'joghurt-2', ean: '4035626114512', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'joghurt-1', ean: '4035626114510', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
    { id: 'joghurt-0', ean: '4035626114511', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'kuehl-3', ean: '8008161501796', name: 'Ital. Mortadella', produkt: 'Ital. Mortadella', qty: 1, kategorie: '🥗 Kühlware', mhdDate: isoDaysFromToday(3), mhd: isoDaysFromToday(3), status: 'aktiv' },
    { id: 'kuehl-2', ean: '8008161501797', name: 'Ital. Mortadella', produkt: 'Ital. Mortadella', qty: 1, kategorie: '🥗 Kühlware', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'tk-30', ean: '4000417025005', name: 'TK Beeren', produkt: 'TK Beeren', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(30), mhd: isoDaysFromToday(30), status: 'aktiv' },
    { id: 'tk-20', ean: '4000417025006', name: 'TK Spinat', produkt: 'TK Spinat', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(20), mhd: isoDaysFromToday(20), status: 'aktiv' },
    { id: 'tk-10', ean: '4000417025007', name: 'TK Erbsen', produkt: 'TK Erbsen', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(10), mhd: isoDaysFromToday(10), status: 'aktiv' },
    { id: 'tk-5', ean: '4000417025008', name: 'TK Pizza', produkt: 'TK Pizza', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(5), mhd: isoDaysFromToday(5), status: 'aktiv' },
    { id: 'gewuerz-15', ean: '4000417025010', name: 'Pfeffer ganz', produkt: 'Pfeffer ganz', qty: 1, kategorie: '🌿 Gewürze', mhdDate: isoDaysFromToday(15), mhd: isoDaysFromToday(15), status: 'aktiv' },
    { id: 'getraenk-1', ean: '4000417025011', name: 'Apfelsaft 1l', produkt: 'Apfelsaft 1l', qty: 1, kategorie: '🍺 Getränke', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
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

  const chipById = (id) => document.querySelector(`#mhd-card-${id} .mhd-sticker-chip`)?.textContent.replace(/\s+/g, ' ').trim() || '';
  const hasChip = (id) => Boolean(document.querySelector(`#mhd-card-${id} .mhd-sticker-chip`));

  steps.push({ name: 'milch 2 days has no sticker', pass: !hasChip('frisch-2'), got: chipById('frisch-2') });
  steps.push({ name: 'milch 1 day is -10%', pass: chipById('frisch-1') === '-10%', got: chipById('frisch-1') });
  steps.push({ name: 'milch MHD day is -20%', pass: chipById('frisch-0') === '-20%', got: chipById('frisch-0') });
  steps.push({ name: 'joghurt 3 days has no sticker', pass: !hasChip('joghurt-3'), got: chipById('joghurt-3') });
  steps.push({ name: 'joghurt 2 days is -10%', pass: chipById('joghurt-2') === '-10%', got: chipById('joghurt-2') });
  steps.push({ name: 'joghurt 1 day is -20%', pass: chipById('joghurt-1') === '-20%', got: chipById('joghurt-1') });
  steps.push({ name: 'joghurt MHD day is -50%', pass: chipById('joghurt-0') === '-50%', got: chipById('joghurt-0') });
  steps.push({ name: 'kuehlware 3 days has no sticker', pass: !hasChip('kuehl-3'), got: chipById('kuehl-3') });
  steps.push({ name: 'kuehlware 2 days is -10%', pass: chipById('kuehl-2') === '-10%', got: chipById('kuehl-2') });

  const trockenTab = document.querySelector('[data-mhd-category-filter="trockenware"]')
    || Array.from(document.querySelectorAll('button, [role="tab"], .mhd-filter-chip, .chip, .btn'))
      .find((el) => /Trockenware/i.test(el.textContent || ''));
  if (trockenTab) trockenTab.click();
  await new Promise((resolve) => setTimeout(resolve, 200));

  steps.push({ name: 'TK 30 days is -10%', pass: chipById('tk-30') === '-10%', got: chipById('tk-30') });
  steps.push({ name: 'TK 20 days is -10%', pass: chipById('tk-20') === '-10%', got: chipById('tk-20') });
  steps.push({ name: 'TK 10 days is -20%', pass: chipById('tk-10') === '-20%', got: chipById('tk-10') });
  steps.push({ name: 'TK 5 days is -50%', pass: chipById('tk-5') === '-50%', got: chipById('tk-5') });
  steps.push({ name: 'Gewürze 15 days is -20%', pass: chipById('gewuerz-15') === '-20%', got: chipById('gewuerz-15') });
  steps.push({ name: 'Getränke 1 day is -50%', pass: chipById('getraenk-1') === '-50%', got: chipById('getraenk-1') });
  steps.push({
    name: 'renders Trockenware seed cards after filter switch',
    pass: document.querySelectorAll('.mhd-card').length >= 1 && Boolean(document.querySelector('#mhd-card-tk-5')),
    got: document.querySelectorAll('.mhd-card').length,
  });

  return {
    steps,
    names: seed.map((item) => ({ id: item.id, chip: chipById(item.id), hasChip: hasChip(item.id) })),
  };
});

console.log(JSON.stringify(uiResult, null, 2));
const failedUi = uiResult.steps.filter((step) => !step.pass);
if (failedUi.length) {
  console.error('UI failures:', failedUi);
  process.exit(1);
}

await browser.close();
console.log('MHD Produkt-Rabatt UI-Check bestanden.');
