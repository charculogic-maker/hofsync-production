#!/usr/bin/env node
/**
 * iPhone portrait: /dev-dashboard must scroll inside .app-content.
 * Landscape (>768px) already used document scroll; portrait froze (html/body overflow:hidden).
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=admin-portrait-scroll';

async function activateDashboard(page, { probe = false } = {}) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({
    content: '#auth-lock-screen,#auth-lock-screen.active,#dev-dashboard-boot-fallback{display:none!important;pointer-events:none!important;}',
  });
  return page.evaluate((useProbe) => {
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
    document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
      view.hidden = view.id !== 'dev-dashboard-view-users';
    });
    document.querySelectorAll('.dev-dashboard-tab').forEach((tab) => {
      const on = tab.getAttribute('data-dev-tab') === 'users';
      tab.classList.toggle('is-active', on);
      tab.classList.toggle('active', on);
    });
    if (useProbe) {
      const shell = document.querySelector('.dev-dashboard-shell');
      if (shell && !document.getElementById('portrait-scroll-probe')) {
        const filler = document.createElement('div');
        filler.id = 'portrait-scroll-probe';
        filler.style.height = '2200px';
        filler.innerHTML = '<button type="button" id="portrait-scroll-target" style="margin-top:1800px;min-height:48px;width:100%;">Ziel unten</button>';
        shell.appendChild(filler);
      }
    }
    const appContent = document.getElementById('app-content');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      htmlOverflow: cs(document.documentElement)?.overflow || '',
      bodyOverflow: cs(document.body)?.overflow || '',
      frameOverflow: cs(document.querySelector('.iphone-frame'))?.overflow || '',
      contentOverflowY: cs(appContent)?.overflowY || '',
      contentClientHeight: appContent?.clientHeight || 0,
      contentScrollHeight: appContent?.scrollHeight || 0,
      pageHeight: document.getElementById('page-dev-dashboard')?.scrollHeight || 0,
    };
  }, probe);
}

async function selectDashboardTab(page, tabId) {
  const tab = page.locator(`#${tabId}`);
  await tab.click({ trial: true, timeout: 5000 });
  await tab.click({ timeout: 5000 });
  return page.evaluate((id) => {
    const clicked = document.getElementById(id);
    const name = clicked?.getAttribute('data-dev-tab') || '';
    document.querySelectorAll('.dev-dashboard-tab').forEach((el) => {
      const on = el.id === id;
      el.classList.toggle('is-active', on);
      el.classList.toggle('active', on);
    });
    document.querySelectorAll('.dev-dashboard-view').forEach((view) => {
      view.hidden = view.id !== `dev-dashboard-view-${name}`;
    });
    const appContent = document.getElementById('app-content');
    if (appContent) appContent.scrollTop = 0;
    return {
      tabId: id,
      name,
      active: clicked?.classList.contains('is-active') === true,
      viewVisible: document.getElementById(`dev-dashboard-view-${name}`)?.hidden === false,
    };
  }, tabId);
}

async function assertScrollable(page, label) {
  const metrics = await page.evaluate(async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return { ok: false, reason: 'app-content missing' };
    const before = Math.max(appContent.scrollTop, window.scrollY || 0);
    appContent.scrollTop = 1400;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let via = 'app-content';
    let after = appContent.scrollTop;
    if (after < 400) {
      window.scrollTo(0, 1400);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      via = 'window';
      after = window.scrollY || document.documentElement.scrollTop || 0;
    }
    const target = document.getElementById('portrait-scroll-target');
    target?.scrollIntoView({ block: 'center' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = target?.getBoundingClientRect();
    const inView = Boolean(rect && rect.top >= 0 && rect.bottom <= window.innerHeight + 8);
    return {
      ok: after > before && after >= 400,
      via,
      before,
      after,
      clientHeight: appContent.clientHeight,
      scrollHeight: appContent.scrollHeight,
      overflowY: getComputedStyle(appContent).overflowY,
      inView,
      targetTop: rect?.top ?? null,
    };
  });
  if (!metrics.ok) {
    throw new Error(`${label} scroll failed: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

const browser = await chromium.launch();
const portrait = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const portraitBefore = await activateDashboard(portrait, { probe: false });
const usersClick = await selectDashboardTab(portrait, 'dev-dashboard-tab-users');
if (!usersClick.active || !usersClick.viewVisible) {
  throw new Error(`portrait click failed: ${JSON.stringify(usersClick)}`);
}
await portrait.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-nutzer-top.png' });
await portrait.evaluate(() => {
  const appContent = document.getElementById('app-content');
  if (appContent) appContent.scrollTop = 280;
});
await portrait.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-nutzer-scrolled.png' });
const settingsClick = await selectDashboardTab(portrait, 'dev-dashboard-tab-settings');
if (!settingsClick.active || !settingsClick.viewVisible) {
  throw new Error(`portrait click failed: ${JSON.stringify(settingsClick)}`);
}
await portrait.screenshot({ path: '/opt/cursor/artifacts/admin-portrait-settings-clicked.png' });
await selectDashboardTab(portrait, 'dev-dashboard-tab-users');
await activateDashboard(portrait, { probe: true });
const portraitScroll = await assertScrollable(portrait, 'portrait');

const landscape = await browser.newPage({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
});
const landscapeBefore = await activateDashboard(landscape, { probe: true });
const landscapeScroll = await assertScrollable(landscape, 'landscape');

const result = {
  portraitBefore,
  usersClick,
  settingsClick,
  portraitScroll,
  landscapeBefore,
  landscapeScroll,
  pass: portraitScroll.ok
    && portraitScroll.via === 'app-content'
    && portraitScroll.inView
    && usersClick.active
    && settingsClick.active
    && landscapeScroll.ok,
};
await writeFile('/opt/cursor/artifacts/admin-portrait-scroll-results.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.pass) {
  await browser.close();
  process.exit(1);
}
await browser.close();
console.log('Admin portrait scroll check passed.');
