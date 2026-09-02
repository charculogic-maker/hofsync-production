#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=mhd-sticky-save-bar';
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
  const tenantId = 'StevesHof_Hauptbetrieb';
  localStorage.setItem('charculogic.tenantId', tenantId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoInTwoDays = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);

  const seed = Array.from({ length: 24 }, (_, index) => ({
    id: `mhd-sticky-${index}`,
    name: `Testartikel ${index + 1}`,
    produkt: `Testartikel ${index + 1}`,
    qty: 3,
    tage: 2,
    kategorie: '🥛MoPro',
    mhdDate: isoInTwoDays,
    mhd: isoInTwoDays,
    status: 'aktiv',
  }));

  let snapshotHandler = null;
  const makeCollection = () => ({
    onSnapshot: (onNext) => {
      snapshotHandler = onNext;
      onNext({
        docs: seed.map((item) => ({ id: item.id, data: () => ({ ...item }) })),
        metadata: { fromCache: false },
        empty: false,
      });
      return () => {};
    },
    where: () => makeCollection(),
    limit: () => ({ get: async () => ({ empty: false, docs: seed.slice(0, 1).map((item) => ({ id: item.id, data: () => ({ ...item }) })) }) }),
    doc: () => ({ set: async () => {}, update: async () => {}, delete: async () => {} }),
  });

  window.firebase = { apps: [{}], auth: () => ({ currentUser: { uid: 'employee-user' } }) };
  window.canStartFirestoreLiveListeners = () => true;
  window.hasActiveFirebaseAuthUser = () => true;

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

  await new Promise((resolve) => setTimeout(resolve, 600));

  const appContent = document.getElementById('app-content');
  appContent.scrollTop = Math.floor(appContent.scrollHeight / 2);
  steps.push({ name: 'scrolled-mid-list', scrollTop: appContent.scrollTop });

  const firstCard = document.querySelector('#mhd-items-container .mhd-card');
  const productId = firstCard?.id?.replace(/^mhd-card-/, '') || seed[0].id;
  const plusBtn = firstCard?.querySelector('[data-mhd-command="adjust"][data-mhd-change="1"]');
  if (!plusBtn) throw new Error('Kein +-Button in MHD-Karte gefunden');
  plusBtn.click();
  await new Promise((resolve) => setTimeout(resolve, 400));

  const bar = document.getElementById('mhd-sticky-save-bar');
  const saveBtn = document.getElementById('btn-save-mhd');
  const bottomNav = document.getElementById('bottom-nav');
  const barStyle = getComputedStyle(bar);
  const barRect = bar.getBoundingClientRect();
  const navRect = bottomNav.getBoundingClientRect();
  const saveRect = saveBtn.getBoundingClientRect();
  const appContentContainsBar = appContent.contains(bar);

  steps.push({
    name: 'save-bar-visible',
    pass: !bar.hidden && bar.classList.contains('is-visible'),
    hidden: bar.hidden,
    isVisible: bar.classList.contains('is-visible'),
    saveText: saveBtn.textContent.trim(),
  });

  steps.push({
    name: 'save-bar-fixed-above-nav',
    pass: barStyle.position === 'fixed'
      && parseInt(barStyle.zIndex, 10) >= 99999
      && barRect.bottom <= navRect.top + 2
      && saveRect.top >= 0
      && saveRect.bottom <= navRect.top,
    position: barStyle.position,
    zIndex: barStyle.zIndex,
    barBottom: Math.round(barRect.bottom),
    navTop: Math.round(navRect.top),
    saveTop: Math.round(saveRect.top),
  });

  steps.push({
    name: 'save-bar-outside-scroll-container',
    pass: !appContentContainsBar,
    appContentContainsBar,
  });

  steps.push({
    name: 'save-bar-stays-on-scroll',
    pass: (() => {
      const before = bar.getBoundingClientRect().top;
      appContent.scrollTop = 0;
      const afterScrollUp = bar.getBoundingClientRect().top;
      appContent.scrollTop = appContent.scrollHeight;
      const afterScrollDown = bar.getBoundingClientRect().top;
      return Math.abs(before - afterScrollUp) < 2 && Math.abs(before - afterScrollDown) < 2;
    })(),
  });

  const targetId = productId;
  if (snapshotHandler) {
    const remoteUpdate = seed.map((item) => (
      item.id === targetId
        ? { ...item, qty: 1, mhdActionStatus: 'offen' }
        : item
    ));
    snapshotHandler({
      docs: remoteUpdate.map((item) => ({ id: item.id, data: () => ({ ...item }) })),
      metadata: { fromCache: false },
      empty: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const cardAfterRemote = document.getElementById(`mhd-card-${targetId}`);
  const qtyValue = cardAfterRemote?.querySelector('.mhd-qty-input')?.value;
  const { getMhdProducts } = await import('./mhd.js');
  const productQty = getMhdProducts().find((item) => item.id === targetId)?.qty;
  steps.push({
    name: 'pending-survives-remote-snapshot',
    pass: qtyValue === '4' && productQty === 4,
    qtyValue,
    productQty,
  });

  return { steps, allPass: steps.every((step) => step.pass !== false) };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.allPass) process.exit(1);
