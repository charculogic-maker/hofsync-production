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

  const lock = document.getElementById('auth-lock-screen');
  if (lock) {
    lock.style.display = 'none';
    lock.classList.remove('active');
  }

  const seed = [
    { id: 'frisch-2', ean: '4035626114608', name: 'Frischmilch Hof 3,8%', produkt: 'Frischmilch Hof 3,8%', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'frisch-1', ean: '4035626114622', name: 'b*Vollmilch Demeter 3,8% Flasche', produkt: 'b*Vollmilch Demeter 3,8% Flasche', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
    { id: 'frisch-0', ean: '4035626100274', name: 'b*Milch Demeter 1,5% Flasche', produkt: 'b*Milch Demeter 1,5% Flasche', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'joghurt-4', ean: '4035626114509', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(4), mhd: isoDaysFromToday(4), status: 'aktiv' },
    { id: 'joghurt-1', ean: '4035626114510', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
    { id: 'joghurt-0', ean: '4035626114511', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'kuehl-3', ean: '8008161501796', name: 'Ital. Mortadella', produkt: 'Ital. Mortadella', qty: 1, kategorie: '🥗 Kühlware', mhdDate: isoDaysFromToday(3), mhd: isoDaysFromToday(3), status: 'aktiv' },
    { id: 'tk-6', ean: '4000417025005', name: 'TK Beeren', produkt: 'TK Beeren', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(6), mhd: isoDaysFromToday(6), status: 'aktiv' },
    { id: 'tk-4', ean: '4000417025006', name: 'TK Spinat', produkt: 'TK Spinat', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(4), mhd: isoDaysFromToday(4), status: 'aktiv' },
    { id: 'tk-2', ean: '4000417025007', name: 'TK Erbsen', produkt: 'TK Erbsen', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'tk-0', ean: '4000417025008', name: 'TK Pizza', produkt: 'TK Pizza', qty: 1, kategorie: '🧊 TK', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'gewuerz-5', ean: '4000417025010', name: 'Pfeffer ganz', produkt: 'Pfeffer ganz', qty: 1, kategorie: '🌿 Gewürze', mhdDate: isoDaysFromToday(5), mhd: isoDaysFromToday(5), status: 'aktiv' },
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

  const badgeById = (id) => document.querySelector(`#mhd-card-${id} .mhd-action-badge`)?.textContent.replace(/\s+/g, ' ').trim() || '';
  const badgeClassById = (id) => document.querySelector(`#mhd-card-${id} .mhd-action-badge`)?.className || '';

  steps.push({ name: 'frischmilch 2 days is Regulär', pass: badgeById('frisch-2') === 'Regulär', got: badgeById('frisch-2') });
  steps.push({ name: 'frischmilch 2 days hides percent class', pass: !badgeClassById('frisch-2').includes('mhd-action-badge--percent'), got: badgeClassById('frisch-2') });
  steps.push({ name: 'frischmilch 1 day is 10%', pass: badgeById('frisch-1') === '10%', got: badgeById('frisch-1') });
  steps.push({ name: 'frischmilch MHD day is 20%', pass: badgeById('frisch-0') === '20%', got: badgeById('frisch-0') });
  steps.push({ name: 'joghurt 4 days is 20%', pass: badgeById('joghurt-4') === '20%', got: badgeById('joghurt-4') });
  steps.push({ name: 'joghurt 1 day is 50%', pass: badgeById('joghurt-1') === '50%', got: badgeById('joghurt-1') });
  steps.push({ name: 'joghurt MHD day is 50%', pass: badgeById('joghurt-0') === '50%', got: badgeById('joghurt-0') });
  steps.push({ name: 'kuehlware 3 days is 20%', pass: badgeById('kuehl-3') === '20%', got: badgeById('kuehl-3') });

  const trockenTab = document.querySelector('[data-mhd-category-filter="trockenware"]')
    || Array.from(document.querySelectorAll('button, [role="tab"], .mhd-filter-chip, .chip, .btn'))
      .find((el) => /Trockenware/i.test(el.textContent || ''));
  if (trockenTab) trockenTab.click();
  await new Promise((resolve) => setTimeout(resolve, 200));

  steps.push({ name: 'TK 6 days is Regulär', pass: badgeById('tk-6') === 'Regulär', got: badgeById('tk-6') });
  steps.push({ name: 'TK 4 days is 20%', pass: badgeById('tk-4') === '20%', got: badgeById('tk-4') });
  steps.push({ name: 'TK 2 days is 50%', pass: badgeById('tk-2') === '50%', got: badgeById('tk-2') });
  steps.push({ name: 'TK MHD day is 50%', pass: badgeById('tk-0') === '50%', got: badgeById('tk-0') });
  steps.push({ name: 'Gewürze 5 days is 20%', pass: badgeById('gewuerz-5') === '20%', got: badgeById('gewuerz-5') });
  steps.push({ name: 'Getränke 1 day is 50%', pass: badgeById('getraenk-1') === '50%', got: badgeById('getraenk-1') });
  steps.push({
    name: 'renders MoPro seed cards plus TK after filter switch',
    pass: document.querySelectorAll('.mhd-card').length >= 1 && Boolean(badgeById('tk-4')),
    got: document.querySelectorAll('.mhd-card').length,
  });

  return {
    steps,
    names: seed.map((item) => ({ id: item.id, badge: badgeById(item.id), className: badgeClassById(item.id) })),
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
