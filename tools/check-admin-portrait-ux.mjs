#!/usr/bin/env node
/**
 * iPhone portrait UX: Verwaltung header/tabs/KPIs must stay readable
 * (no squeezed brand column, no overlap with the status bar).
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=admin-portrait-ux';

async function activateDashboard(page, tab = 'overview') {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({
    content: '#auth-lock-screen,#auth-lock-screen.active,#dev-dashboard-boot-fallback{display:none!important;pointer-events:none!important;}',
  });
  return page.evaluate((nextTab) => {
    document.getElementById('auth-lock-screen')?.remove();
    document.getElementById('dev-dashboard-boot-fallback')?.remove();
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
      const on = tabEl.getAttribute('data-dev-tab') === nextTab;
      tabEl.classList.toggle('is-active', on);
      tabEl.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
      view.hidden = view.id !== `dev-dashboard-view-${nextTab}`;
    });
    const name = document.querySelector('#dev-dashboard-tenant-header .tenant-header-name');
    if (name) name.textContent = "Steve's Hof";
    const status = document.getElementById('dev-dashboard-status');
    if (status) status.textContent = 'Angemeldet als paddy@steveshof-hofladen.de · Steve’s Hof';
    const badge = document.getElementById('dev-dashboard-role-badge');
    if (badge) {
      badge.dataset.role = 'super';
      badge.textContent = 'Super Admin';
    }
    const kpiUsers = document.getElementById('dev-kpi-users');
    if (kpiUsers) kpiUsers.textContent = '9';
    const kpiUsersHint = document.getElementById('dev-kpi-users-hint');
    if (kpiUsersHint) kpiUsersHint.textContent = '9 Mitarbeiter · 0 Admins';
    const kpiAdmins = document.getElementById('dev-kpi-admins');
    if (kpiAdmins) kpiAdmins.textContent = '0';
    const kpiModules = document.getElementById('dev-kpi-modules');
    if (kpiModules) kpiModules.textContent = '0/9';
    const kpiStatus = document.getElementById('dev-kpi-status');
    if (kpiStatus) kpiStatus.textContent = 'Aktiv';
    return true;
  }, tab);
}

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const title = document.querySelector('.dev-dashboard-page-title');
    const back = document.getElementById('dev-dashboard-back-btn');
    const tabs = document.querySelector('.dev-dashboard-tabs');
    const kpi = document.querySelector('.dev-dashboard-kpi-grid');
    const brand = document.getElementById('dev-dashboard-tenant-header');
    const titleRect = title?.getBoundingClientRect();
    const backRect = back?.getBoundingClientRect();
    const brandRect = brand?.getBoundingClientRect();
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
      titleText: title?.textContent?.trim() || '',
      titleWidth: titleRect?.width || 0,
      titleHeight: titleRect?.height || 0,
      titleTop: titleRect?.top || 0,
      backTop: backRect?.top || 0,
      backHeight: backRect?.height || 0,
      brandWidth: brandRect?.width || 0,
      tabsDisplay: cs(tabs)?.display || '',
      tabsColumns: cs(tabs)?.gridTemplateColumns || '',
      kpiColumns: cs(kpi)?.gridTemplateColumns || '',
      topbarAreas: cs(document.querySelector('.dev-dashboard-topbar'))?.gridTemplateAreas || '',
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

await activateDashboard(page, 'overview');
const overview = await layoutMetrics(page);
await page.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-ux-overview.png', fullPage: false });

await page.locator('#dev-dashboard-tab-users').click();
await page.evaluate(() => {
  document.querySelectorAll('.dev-dashboard-tab').forEach((el) => {
    const on = el.id === 'dev-dashboard-tab-users';
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
    view.hidden = view.id !== 'dev-dashboard-view-users';
  });
});
await page.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-ux-users.png', fullPage: false });

await page.locator('#dev-dashboard-tab-settings').click();
await page.evaluate(() => {
  document.querySelectorAll('.dev-dashboard-tab').forEach((el) => {
    const on = el.id === 'dev-dashboard-tab-settings';
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
    view.hidden = view.id !== 'dev-dashboard-view-settings';
  });
});
await page.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-ux-settings.png', fullPage: false });

const pass = overview.overflowX
  && overview.titleText === 'Verwaltung'
  && overview.titleWidth > 140
  && overview.titleHeight < 48
  && overview.backTop >= 8
  && overview.backHeight >= 40
  && overview.brandWidth > 300
  && overview.tabsDisplay === 'grid'
  && overview.tabsColumns.split(' ').length === 2
  && overview.kpiColumns.split(' ').length === 2
  && overview.topbarAreas.includes('brand brand');

const result = { overview, pass };
await writeFile('/opt/cursor/artifacts/admin-portrait-ux-results.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!pass) process.exit(1);
console.log('Admin portrait UX check passed.');
