#!/usr/bin/env node
/**
 * Verwaltung → Protokoll: Datumsfilter, Aktions-Badges und CSV-Export.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { berlinDayStartMs, berlinTodayIso, defaultReportFromIso } from '../web/mhd-audit.js';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=admin-protokoll-report';
const ARTIFACT_DIR = '/opt/cursor/artifacts';

function createMockTenantDb({ auditDocs = [], listeDocs = [], masterDocs = [] } = {}) {
  const store = {
    mhd_audit: Object.fromEntries(auditDocs.map((entry) => [entry.id, { ...entry.data }])),
    audit_logs: {},
    mhd_liste: Object.fromEntries(listeDocs.map((entry) => [entry.id, { ...entry.data }])),
    product_master: Object.fromEntries(masterDocs.map((entry) => [entry.id, { ...entry.data }])),
  };

  const makeDoc = (colName, id) => ({
    id,
    data: () => ({ ...(store[colName][id] || {}) }),
    async get() {
      const data = store[colName][id];
      return { exists: Boolean(data), id, data: () => ({ ...data }) };
    },
    async update(patch) {
      if (!store[colName][id]) {
        const err = new Error('missing');
        err.code = 'not-found';
        throw err;
      }
      store[colName][id] = { ...store[colName][id], ...patch };
    },
    async set(patch) {
      store[colName][id] = { ...(store[colName][id] || {}), ...patch };
    },
  });

  const makeCol = (name, filters = []) => {
    if (!store[name]) store[name] = {};
    const api = {
      _filters: filters,
      _after: false,
      where(field, op, value) {
        return makeCol(name, [...api._filters, { field, op, value }]);
      },
      orderBy() { return api; },
      limit() { return api; },
      startAfter() {
        api._after = true;
        return api;
      },
      doc(id) { return makeDoc(name, id); },
      async get() {
        if (api._after) return { docs: [] };
        let docs = Object.entries(store[name] || {}).map(([id, data]) => ({
          id,
          data: () => ({ ...data }),
        }));
        api._filters.forEach(({ field, op, value }) => {
          docs = docs.filter((doc) => {
            const current = doc.data()[field];
            if (op === '==') return current === value;
            if (op === '>=') return current >= value;
            if (op === '<=') return current <= value;
            return true;
          });
        });
        return { docs };
      },
    };
    return api;
  };

  return {
    store,
    collection: () => ({
      doc: () => ({
        collection: (name) => makeCol(name),
      }),
    }),
  };
}

function fail(message, extra) {
  console.error(message, extra || '');
  process.exit(1);
}

async function activateProtokoll(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({
    content: '#auth-lock-screen,#auth-lock-screen.active,#dev-dashboard-boot-fallback{display:none!important;pointer-events:none!important;}',
  });
  await page.evaluate(() => {
    const hideAuth = () => {
      ['auth-lock-screen', 'dev-dashboard-boot-fallback', 'pin-auth-overlay'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('hidden', '');
      });
      document.body?.classList.remove('auth-lock-open', 'auth-loop-lockdown');
    };
    hideAuth();
    history.replaceState({}, '', '/dev-dashboard');
    document.documentElement.classList.add('is-dev-dashboard-html');
    document.body.classList.add('is-dev-dashboard');
    document.body.classList.remove('app-shell-sidebar', 'dev-dashboard-view');
    document.body.hidden = false;
    document.querySelectorAll('.page').forEach((pageEl) => {
      const active = pageEl.id === 'page-dev-dashboard';
      pageEl.classList.toggle('active', active);
      pageEl.hidden = !active;
      pageEl.style.display = active ? 'block' : 'none';
    });
    document.querySelectorAll('.dev-dashboard-tab').forEach((tabEl) => {
      const on = tabEl.getAttribute('data-dev-tab') === 'audit';
      tabEl.classList.toggle('is-active', on);
      tabEl.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
      view.hidden = view.id !== 'dev-dashboard-view-audit';
    });
  });
  await page.waitForFunction(() => Boolean(window.__hofsyncMovementReport), { timeout: 20000 });
  await page.evaluate((factorySource) => {
    window.__createProtokollMockDb = new Function(`return (${factorySource});`)();
  }, createMockTenantDb.toString());
  await page.evaluate(() => window.__hofsyncMovementReport.bind());
}

async function showProtokoll(page) {
  await page.evaluate(() => {
    ['auth-lock-screen', 'dev-dashboard-boot-fallback', 'pin-auth-overlay'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('hidden', '');
    });
    const pageEl = document.getElementById('page-dev-dashboard');
    if (pageEl) {
      pageEl.hidden = false;
      pageEl.classList.add('active');
      pageEl.style.display = 'block';
    }
    document.querySelectorAll('.page').forEach((el) => {
      const on = el.id === 'page-dev-dashboard';
      el.classList.toggle('active', on);
      el.hidden = !on;
      el.style.display = on ? 'block' : 'none';
    });
    document.querySelectorAll('.dev-dashboard-tab').forEach((tabEl) => {
      const on = tabEl.getAttribute('data-dev-tab') === 'audit';
      tabEl.classList.toggle('is-active', on);
      tabEl.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
      view.hidden = view.id !== 'dev-dashboard-view-audit';
    });
  });
}

async function setReportDates(page, from, to) {
  await showProtokoll(page);
  await page.evaluate(({ from, to }) => {
    const fromEl = document.getElementById('dev-dashboard-report-from');
    const toEl = document.getElementById('dev-dashboard-report-to');
    if (fromEl) fromEl.value = from;
    if (toEl) toEl.value = to;
    document.getElementById('dev-dashboard-report-filters')?.dispatchEvent(new Event('change', { bubbles: true }));
  }, { from, to });
}

await mkdir(ARTIFACT_DIR, { recursive: true });
const headed = process.env.HEADED === '1';
const recordVideo = process.env.RECORD_VIDEO === '1' || headed;
const browser = await chromium.launch({
  headless: !headed,
  slowMo: recordVideo ? 350 : 0,
  args: headed ? ['--window-size=1280,900'] : [],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
  recordVideo: recordVideo ? { dir: ARTIFACT_DIR, size: { width: 1280, height: 900 } } : undefined,
});
const page = await context.newPage();
await activateProtokoll(page);

const today = berlinTodayIso();
const yesterdayDate = new Date(berlinDayStartMs(today) - 12 * 60 * 60 * 1000);
const yesterday = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(yesterdayDate);

const todayMorning = berlinDayStartMs(today) + 11 * 60 * 60 * 1000 + 15 * 60 * 1000;
const todayNoon = berlinDayStartMs(today) + 13 * 60 * 60 * 1000;
const yesterdayMs = berlinDayStartMs(yesterday) + 9 * 60 * 60 * 1000;

const shell = await page.evaluate(() => {
  const actorOptions = [...document.querySelectorAll('#dev-dashboard-report-actor option')].map((el) => el.textContent.trim());
  const actionOptions = [...document.querySelectorAll('#dev-dashboard-report-action option')].map((el) => ({
    value: el.value,
    label: el.textContent.trim(),
  }));
  const headers = [...document.querySelectorAll('#dev-dashboard-report-table thead th')].map((el) => el.textContent.trim());
  const exportBtn = document.getElementById('dev-dashboard-report-export-btn');
  return {
    from: document.getElementById('dev-dashboard-report-from')?.value || '',
    to: document.getElementById('dev-dashboard-report-to')?.value || '',
    actorOptions,
    actionOptions,
    headers,
    presets: [...document.querySelectorAll('#dev-dashboard-report-presets [data-report-days]')].map((el) => ({
      days: el.getAttribute('data-report-days'),
      label: el.textContent.trim(),
    })),
    exportLabel: String(exportBtn && exportBtn.textContent ? exportBtn.textContent : '').replace(/\s+/g, ' ').trim(),
  };
});

const defaultFrom = defaultReportFromIso();
if (shell.from !== defaultFrom || shell.to !== today) {
  fail('Default date filter is not seit vorgestern', shell);
}
if (!shell.presets.some((entry) => entry.label === 'Seit vorgestern' && entry.days === '2')) {
  fail('Missing Seit vorgestern preset', shell.presets);
}
const expectedActors = ['Alle', 'Paddy', 'Stephie', 'Bettina', 'Nicole', 'Heiko'];
if (!expectedActors.every((name) => shell.actorOptions.includes(name))) {
  fail('Actor dropdown missing shop names', shell.actorOptions);
}
const actionValues = shell.actionOptions.map((entry) => entry.value);
if (!['', 'neu', 'menge', 'abschreiben', 'raus'].every((value) => actionValues.includes(value))) {
  fail('Action dropdown missing types', shell.actionOptions);
}
if (!['Zeitstempel', 'Mitarbeiter', 'Artikel & EAN', 'Aktion', 'Mengen-Delta', 'Korrigieren'].every((h) => shell.headers.includes(h))) {
  fail('Report table headers mismatch', shell.headers);
}
if (!String(shell.exportLabel || '').includes('Report als CSV exportieren')) {
  fail('CSV export button label mismatch', shell);
}

await page.evaluate(({ todayMorning, todayNoon, yesterdayMs, today }) => {
  const auditDocs = [
    {
      id: 'mv-today-stephie',
      data: {
        atMs: todayMorning,
        actorName: 'Stephie',
        articleName: 'Rapunzel Schokolade Karamell',
        ean: '4006040000000',
        actionType: 'menge',
        qtyFrom: 12,
        qtyTo: 8,
        mhdDate: '2026-09-20',
        tenantId: 'StevesHof_Hauptbetrieb',
      },
    },
    {
      id: 'mv-today-bettina',
      data: {
        atMs: todayNoon,
        actorName: 'Bettina',
        articleName: 'Hofmilch 1l',
        ean: '4000000000001',
        actionType: 'raus',
        qtyFrom: 3,
        qtyTo: 0,
        tenantId: 'StevesHof_Hauptbetrieb',
      },
    },
    {
      id: 'mv-yesterday-paddy',
      data: {
        atMs: yesterdayMs,
        actorName: 'Paddy',
        articleName: 'Landbrot',
        ean: '4000000000002',
        actionType: 'neu',
        qtyFrom: 0,
        qtyTo: 6,
        tenantId: 'StevesHof_Hauptbetrieb',
      },
    },
  ];
  const db = window.__createProtokollMockDb({ auditDocs });
  window.__hofsyncMovementReport.injectDb(db);
  window.__hofsyncMovementReport.setTenant('StevesHof_Hauptbetrieb');
  window.__hofsyncMovementReport.bind();
  document.getElementById('dev-dashboard-report-actor').value = '';
  document.getElementById('dev-dashboard-report-action').value = '';
}, { todayMorning, todayNoon, yesterdayMs, today });

await page.evaluate(() => window.__hofsyncMovementReport.load());
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 3, { timeout: 10000 });
await showProtokoll(page);
await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-seit-vorgestern.png`,
  fullPage: false,
});

await page.evaluate(() => document.querySelector('[data-report-days="0"]')?.click());
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 2, { timeout: 10000 });

const todayView = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#dev-dashboard-report-body tr')].map((tr) => (
    [...tr.querySelectorAll('td')].map((td) => td.innerText.replace(/\s+/g, ' ').trim())
  ));
  const badges = [...document.querySelectorAll('#dev-dashboard-report-body .dev-dashboard-action-badge')].map((el) => ({
    action: el.getAttribute('data-action'),
    label: el.textContent.trim(),
  }));
  return {
    rowCount: rows.length,
    rows,
    badges,
    status: document.getElementById('dev-dashboard-report-status')?.textContent || '',
  };
});

if (todayView.rowCount !== 2) fail('Today filter should show 2 movements', todayView);
if (!todayView.rows.some((row) => row.join(' ').includes('Rapunzel Schokolade Karamell') && row.join(' ').includes('12 → 8 (-4)'))) {
  fail('Missing Stephie quantity change row', todayView.rows);
}
if (!todayView.badges.some((badge) => badge.action === 'menge' && badge.label === 'MENGE GEÄNDERT')) {
  fail('Missing MENGE GEÄNDERT badge', todayView.badges);
}
if (!todayView.badges.some((badge) => badge.action === 'raus' && badge.label === 'RAUS')) {
  fail('Missing RAUS badge', todayView.badges);
}

await page.selectOption('#dev-dashboard-report-actor', 'Stephie');
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 1, { timeout: 10000 });
const stephieOnly = await page.evaluate(() => window.__hofsyncMovementReport.getRows().map((row) => row.actorName));
if (stephieOnly.join() !== 'Stephie') fail('Actor filter did not isolate Stephie', stephieOnly);

await page.selectOption('#dev-dashboard-report-actor', '');
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 2, { timeout: 10000 });
await page.selectOption('#dev-dashboard-report-action', 'raus');
await page.waitForFunction(() => {
  const rows = window.__hofsyncMovementReport.getRows() || [];
  return rows.length === 1 && rows[0].actionType === 'raus';
}, { timeout: 10000 });

await page.selectOption('#dev-dashboard-report-action', '');
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 2, { timeout: 10000 });
await setReportDates(page, yesterday, yesterday);
await page.waitForFunction(() => {
  const rows = window.__hofsyncMovementReport.getRows() || [];
  return rows.length === 1 && rows[0].actorName === 'Paddy';
}, { timeout: 10000 });

await setReportDates(page, today, today);
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 2, { timeout: 10000 });
await showProtokoll(page);
if (headed) await page.waitForTimeout(800);

await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-warenbericht-table.png`,
  fullPage: false,
});

const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.evaluate(() => document.getElementById('dev-dashboard-report-export-btn')?.click()),
]);
const suggested = download.suggestedFilename();
if (suggested !== `HofSync_Warenbericht_${today}.csv`) {
  fail('CSV filename mismatch', suggested);
}
const csvPath = await download.path();
const csv = readFileSync(csvPath);
const csvText = csv.toString('utf8');
if (csv[0] !== 0xEF || csv[1] !== 0xBB || csv[2] !== 0xBF) {
  fail('CSV is missing UTF-8 BOM', csv.slice(0, 8));
}
if (!csvText.includes('Zeitstempel;Mitarbeiter;Artikel') || !csvText.includes('Rapunzel Schokolade Karamell') || !csvText.includes('MENGE GEÄNDERT') || !csvText.includes(';MHD')) {
  fail('CSV content missing expected columns/rows', csvText.slice(0, 400));
}

await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-csv-export-ready.png`,
  fullPage: false,
});

await page.evaluate(({ todayMorning }) => {
  const auditDocs = [
    {
      id: 'mv-umlaut-bettina',
      data: {
        atMs: todayMorning,
        actorName: 'Bettina',
        articleName: 'Cold Brew Süáe Kräuter',
        ean: '4012346200507',
        actionType: 'neu',
        qtyFrom: 0,
        qtyTo: 6,
        mhdDate: '2026-09-20',
        mhdListeId: 'cold-brew-1',
        tenantId: 'StevesHof_Hauptbetrieb',
      },
    },
    {
      id: 'mv-umlaut-herbs',
      data: {
        atMs: todayMorning + 60 * 1000,
        actorName: 'Paddy',
        articleName: 'Kr\u2261uterremoulade mit Gew\u2261rzgurken',
        ean: '4018462158708',
        actionType: 'raus',
        qtyFrom: 2,
        qtyTo: 0,
        tenantId: 'StevesHof_Hauptbetrieb',
      },
    },
  ];
  const listeDocs = [
    {
      id: 'cold-brew-1',
      data: {
        name: 'Cold Brew Süáe Kräuter',
        ean: '4012346200507',
        barcode: '4012346200507',
        qty: 6,
        mhd: '2026-09-20',
        mhdDate: '2026-09-20',
        scannedBy: 'Bettina',
      },
    },
    {
      id: 'cold-brew-old',
      data: {
        name: 'Cold Brew Süáe Kräuter',
        ean: '4012346200507',
        barcode: '4012346200507',
        qty: 2,
        mhd: '2026-08-01',
        mhdDate: '2026-08-01',
        scannedBy: 'Paddy',
      },
    },
  ];
  window.__protokollMock = window.__createProtokollMockDb({ auditDocs, listeDocs });
  window.__hofsyncMovementReport.injectDb(window.__protokollMock);
  window.__hofsyncMovementReport.setTenant('StevesHof_Hauptbetrieb');
  window.__hofsyncMovementReport.bind();
  document.getElementById('dev-dashboard-report-actor').value = '';
  document.getElementById('dev-dashboard-report-action').value = '';
}, { todayMorning });

await setReportDates(page, today, today);
await page.waitForFunction(() => (window.__hofsyncMovementReport.getRows() || []).length === 2, { timeout: 10000 });
await showProtokoll(page);

const umlautView = await page.evaluate(() => {
  const names = [...document.querySelectorAll('#dev-dashboard-report-body .dev-dashboard-report-article strong')].map((el) => el.textContent.trim());
  const badges = [...document.querySelectorAll('#dev-dashboard-report-body .dev-dashboard-action-badge')].map((el) => el.textContent.trim());
  const editButtons = [...document.querySelectorAll('#dev-dashboard-report-body [data-report-edit]')].map((el) => el.textContent.trim());
  return { names, badges, editButtons };
});
if (!umlautView.names.includes('Cold Brew Süße Kräuter')) {
  fail('Umlaut name was not sanitized in the table', umlautView.names);
}
if (!umlautView.names.includes('Kräuterremoulade mit Gewürzgurken')) {
  fail('Herb umlaut name was not sanitized in the table', umlautView.names);
}
if (!umlautView.badges.includes('NEU') || !umlautView.badges.includes('RAUS')) {
  fail('Action badges should stay untruncated', umlautView.badges);
}
if (umlautView.editButtons.length !== 2 || umlautView.editButtons.some((label) => label !== 'Korrigieren')) {
  fail('Missing Korrigieren buttons', umlautView.editButtons);
}

await page.setViewportSize({ width: 390, height: 844 });
await showProtokoll(page);
await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-row-edit-portrait.png`,
  fullPage: false,
});

await page.locator('#dev-dashboard-report-body [data-report-edit="mv-umlaut-bettina"]').click();
await page.waitForFunction(() => {
  const modal = document.getElementById('dev-dashboard-report-edit-modal');
  return Boolean(modal) && !modal.hidden;
}, { timeout: 5000 });

const modalOpen = await page.evaluate(() => ({
  name: document.getElementById('dev-dashboard-report-edit-name')?.value || '',
  qty: document.getElementById('dev-dashboard-report-edit-qty')?.value || '',
  mhd: document.getElementById('dev-dashboard-report-edit-mhd')?.value || '',
  hint: document.querySelector('#dev-dashboard-report-edit-modal .dev-dashboard-intro')?.textContent || '',
}));
if (modalOpen.name !== 'Cold Brew Süße Kräuter') fail('Edit modal did not prefill sanitized name', modalOpen);
if (modalOpen.qty !== '6') fail('Edit modal did not prefill quantity', modalOpen);
if (modalOpen.mhd !== '2026-09-20') fail('Edit modal did not prefill MHD', modalOpen);
if (!modalOpen.hint.includes('nächsten Wareneingang') || !modalOpen.hint.includes('nur für diesen Posten')) {
  fail('Edit modal missing scope copy', modalOpen.hint);
}

await page.fill('#dev-dashboard-report-edit-name', 'Cold Brew Süße Kräuter');
await page.fill('#dev-dashboard-report-edit-qty', '5');
await page.fill('#dev-dashboard-report-edit-mhd', '2026-09-22');
await page.click('#dev-dashboard-report-edit-save');
await page.waitForFunction(() => Boolean(window.__hofsyncMovementReport.getLastCorrection?.()), { timeout: 10000 });

const correction = await page.evaluate(() => {
  const writes = window.__hofsyncMovementReport.getWrites() || [];
  const store = window.__protokollMock?.store || {};
  return {
    plan: window.__hofsyncMovementReport.getLastCorrection(),
    writes: writes.map((entry) => ({
      collection: entry.collection,
      docId: entry.docId,
      qty: entry.patch?.qty,
      qtyTo: entry.patch?.qtyTo,
      name: entry.patch?.name || entry.patch?.articleName,
      mhdDate: entry.patch?.mhdDate,
    })),
    listeCurrent: store.mhd_liste?.['cold-brew-1'] || null,
    listeOld: store.mhd_liste?.['cold-brew-old'] || null,
    audit: store.mhd_audit?.['mv-umlaut-bettina'] || null,
    master: store.product_master?.['4012346200507'] || null,
    modalHidden: Boolean(document.getElementById('dev-dashboard-report-edit-modal')?.hidden),
  };
});
if (!correction.plan?.nameAppliesToAllWithEan || !correction.plan?.qtyMhdAppliesToThisPostenOnly) {
  fail('Correction plan scope mismatch', correction.plan);
}
if (correction.listeCurrent?.name !== 'Cold Brew Süße Kräuter' || correction.listeCurrent?.qty !== 5 || correction.listeCurrent?.mhdDate !== '2026-09-22') {
  fail('Current posten was not updated with name/qty/MHD', correction.listeCurrent);
}
if (correction.listeOld?.name !== 'Cold Brew Süße Kräuter' || correction.listeOld?.qty !== 2 || correction.listeOld?.mhdDate !== '2026-08-01') {
  fail('Older posten should only receive the name, not qty/MHD', correction.listeOld);
}
if (correction.audit?.articleName !== 'Cold Brew Süße Kräuter' || correction.audit?.qtyTo !== 5) {
  fail('Audit row was not updated', correction.audit);
}
if (correction.master?.articleName !== 'Cold Brew Süße Kräuter') {
  fail('Shared product master was not written', correction.master);
}
if (!correction.modalHidden) fail('Edit modal should close after save', correction);

await showProtokoll(page);
await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-row-edit-saved.png`,
  fullPage: false,
});
await page.setViewportSize({ width: 1280, height: 900 });

if (recordVideo) await page.waitForTimeout(600);
const videoHandle = page.video();
await context.close();
await browser.close();
if (videoHandle) {
  const rawPath = await videoHandle.path();
  const { copyFile } = await import('node:fs/promises');
  await copyFile(rawPath, `${ARTIFACT_DIR}/admin_protokoll_date_filter_and_csv.webm`);
}
console.log(JSON.stringify({
  ok: true,
  today,
  yesterday,
  filename: suggested,
  csvHasBom: true,
  todayRows: 2,
}, null, 2));
