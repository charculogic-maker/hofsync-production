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
if (!['Zeitstempel', 'Mitarbeiter', 'Artikel & EAN', 'Aktion', 'Mengen-Delta'].every((h) => shell.headers.includes(h))) {
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
  const colFor = (name) => {
    const docs = name === 'mhd_audit' ? auditDocs : [];
    const api = {
      where() { return api; },
      orderBy() { return api; },
      limit() { return api; },
      startAfter() {
        api._after = true;
        return api;
      },
      async get() {
        if (api._after) return { docs: [] };
        return {
          docs: docs.map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          })),
        };
      },
    };
    return api;
  };
  const db = {
    collection: () => ({
      doc: () => ({
        collection: (name) => colFor(name),
      }),
    }),
  };
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
if (!csvText.includes('Zeitstempel;Mitarbeiter;Artikel') || !csvText.includes('Rapunzel Schokolade Karamell') || !csvText.includes('MENGE GEÄNDERT')) {
  fail('CSV content missing expected columns/rows', csvText.slice(0, 400));
}

await page.screenshot({
  path: `${ARTIFACT_DIR}/admin-protokoll-csv-export-ready.png`,
  fullPage: false,
});

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
