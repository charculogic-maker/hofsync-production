#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=mhd-kuehl-rabatt';
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
    { id: 'h-2', ean: '4101530008811', name: 'H-Milch 3,5%', produkt: 'H-Milch 3,5%', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
    { id: 'h-1', ean: '4101530008812', name: 'Pasteurisierte Milch 1,5%', produkt: 'Pasteurisierte Milch 1,5%', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(1), mhd: isoDaysFromToday(1), status: 'aktiv' },
    { id: 'joghurt-0', ean: '4035626114509', name: 'b*Joghurt mild 1,8% Demeter Glas', produkt: 'b*Joghurt mild 1,8% Demeter Glas', qty: 2, kategorie: '🥛MoPro', mhdDate: isoDaysFromToday(0), mhd: isoDaysFromToday(0), status: 'aktiv' },
    { id: 'kuehl-2', ean: '8008161501796', name: 'Ital. Mortadella', produkt: 'Ital. Mortadella', qty: 1, kategorie: '🥗 Kühlware', mhdDate: isoDaysFromToday(2), mhd: isoDaysFromToday(2), status: 'aktiv' },
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
  const nameById = (id) => document.querySelector(`#mhd-card-${id} .mhd-product-name`)?.textContent.trim() || '';

  steps.push({ name: 'frischmilch 2 days stays OK', pass: badgeById('frisch-2') === 'OK', got: badgeById('frisch-2') });
  steps.push({ name: 'frischmilch 1 day is 10%', pass: badgeById('frisch-1') === '10%', got: badgeById('frisch-1') });
  steps.push({ name: 'frischmilch MHD day is 20%', pass: badgeById('frisch-0') === '20%', got: badgeById('frisch-0') });
  steps.push({ name: 'H-Milch 2 days is 10%', pass: badgeById('h-2') === '10%', got: badgeById('h-2') });
  steps.push({ name: 'pasteurized milk 1 day is 20%', pass: badgeById('h-1') === '20%', got: badgeById('h-1') });
  steps.push({ name: 'joghurt MHD day is 50%', pass: badgeById('joghurt-0') === '50%', got: badgeById('joghurt-0') });
  steps.push({ name: 'kuehlware 2 days is 10%', pass: badgeById('kuehl-2') === '10%', got: badgeById('kuehl-2') });
  steps.push({ name: 'renders all seeded cards', pass: document.querySelectorAll('.mhd-card').length === seed.length, got: document.querySelectorAll('.mhd-card').length });

  return {
    steps,
    names: seed.map((item) => ({ id: item.id, name: nameById(item.id), badge: badgeById(item.id) })),
  };
});

console.log(JSON.stringify(uiResult, null, 2));
const failedUi = uiResult.steps.filter((step) => !step.pass);
if (failedUi.length) {
  console.error('UI failures:', failedUi);
  process.exit(1);
}

await browser.close();
console.log('MHD Kühlware-Rabatt UI-Check bestanden.');
