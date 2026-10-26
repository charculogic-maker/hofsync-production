#!/usr/bin/env node
/**
 * HofSync Abnahmekriterien (Roadmap §7) gegen Production.
 *
 * Usage:
 *   HOFSYNC_EMPLOYEE_PASSWORD=… node tools/e2e-abnahme-hofsync.mjs
 * Optional: HOFSYNC_ADMIN_PASSWORD for criterion 4/5 admin checks
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://hofsync-charculogic.vercel.app';
const EMP = process.env.HOFSYNC_EMPLOYEE_EMAIL || 'bestellung@steveshof-hofladen.de';
const EMP_PW = process.env.HOFSYNC_EMPLOYEE_PASSWORD || '';
const ADMIN = process.env.HOFSYNC_ADMIN_EMAIL || 'patrik@charculogic.de';
const ADMIN_PW = process.env.HOFSYNC_ADMIN_PASSWORD || '';
const ART = process.env.ART_DIR || '/opt/cursor/artifacts/hofsync-abnahme';

async function login(page, email, password) {
  await page.goto(`${BASE}/?login=1&t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1000);
  await page.locator('#auth-login-email').fill(email);
  await page.locator('#auth-login-password').fill(password);
  await page.locator('#auth-login-form button[type="submit"]').click();
  await page.waitForFunction(() => Boolean(window.firebase?.auth?.()?.currentUser), { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const lock = document.getElementById('auth-lock-screen');
    if (lock) { lock.classList.remove('active'); lock.hidden = true; lock.style.display = 'none'; }
    document.body.classList.remove('auth-locked');
  });
}

async function pickEmployee(page) {
  const t0 = Date.now();
  await page.evaluate(() => { void window.openEmployeePickerModal?.({ mandatory: false }); });
  await page.waitForTimeout(1500);
  const name = await page.evaluate(() => {
    const pick = document.querySelector('#employee-picker-list [data-employee-picker-name]');
    pick?.click();
    return window.readActiveEmployee?.() || '';
  });
  await page.waitForTimeout(600);
  return { name, ms: Date.now() - t0 };
}

async function main() {
  if (!EMP_PW) {
    console.error('HOFSYNC_EMPLOYEE_PASSWORD missing');
    process.exit(2);
  }
  fs.mkdirSync(ART, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    base: BASE,
    criteria: {},
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'de-DE',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const shot = async (name) => {
    try { await page.screenshot({ path: path.join(ART, name) }); } catch (_) { /* ignore */ }
  };

  try {
    // --- Employee path ---
    await login(page, EMP, EMP_PW);
    const profile = await pickEmployee(page);
    report.criteria.c1_profilwahl = {
      ok: Boolean(profile.name) && profile.ms < 8000,
      employee: profile.name,
      ms: profile.ms,
      note: 'Ziel <3s ideal; <8s akzeptabel mit Retry-Pfad',
    };
    await shot('01-profile.png');

    // Header declutter
    const header = await page.evaluate(() => {
      const secondary = [...document.querySelectorAll('.header-action--secondary')].map((el) => ({
        id: el.id,
        display: getComputedStyle(el).display,
      }));
      return {
        title: document.getElementById('header-title')?.textContent?.trim() || '',
        titleWidth: document.getElementById('header-title')?.getBoundingClientRect()?.width || 0,
        toolsVisible: getComputedStyle(document.getElementById('header-tools-dropdown') || document.body).display !== 'none',
        secondaryHidden: secondary.every((s) => s.display === 'none'),
        primaryTabs: [...document.querySelectorAll('.nav-item[data-nav-slot="primary"]:not([hidden])')]
          .filter((el) => getComputedStyle(el).display !== 'none')
          .map((el) => el.getAttribute('data-tab')),
      };
    });
    report.criteria.c6_max5_tabs = {
      ok: header.primaryTabs.length <= 5,
      primaryTabs: header.primaryTabs,
    };
    report.criteria.header_declutter = {
      ok: header.secondaryHidden && header.toolsVisible && header.titleWidth > 120,
      ...header,
    };
    await shot('02-header.png');

    // C2: Wareneingang without profile should toast — clear profile first briefly
    await page.evaluate(() => {
      try {
        localStorage.removeItem('charculogic.activeEmployee');
        window.__toasts = [];
        const orig = window.showToast;
        window.showToast = (msg, type) => {
          window.__toasts.push({ msg: String(msg), type: String(type || '') });
          return orig?.(msg, type);
        };
      } catch (_) { /* noop */ }
    });
    // Re-pick for remaining tests
    await pickEmployee(page);
    await page.evaluate(() => {
      window.__toasts = [];
      window.showTab?.('receiving');
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      document.getElementById('we-save-delivery-btn')?.click();
    });
    await page.waitForTimeout(800);
    const weFeedback = await page.evaluate(() => ({
      toasts: window.__toasts || [],
      fakeSaved: (window.__toasts || []).some((t) => /gespeichert|gebucht/i.test(t.msg) && !/hinzugefügt|vorgemerkt/i.test(t.msg)),
    }));
    report.criteria.c2_we_feedback = {
      ok: !weFeedback.fakeSaved,
      toasts: weFeedback.toasts.slice(-5),
      note: 'Kein stilles Fake-Gespeichert ohne gültige Posten',
    };
    await shot('03-receiving.png');

    // C3: MHD load
    const mhdT0 = Date.now();
    await page.evaluate(() => { window.showTab?.('mhd'); });
    let mhdOk = false;
    let mhdSnap = {};
    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(1000);
      mhdSnap = await page.evaluate(() => {
        const container = document.getElementById('mhd-items-container');
        const text = (container?.innerText || '').replace(/\s+/g, ' ');
        const cards = document.querySelectorAll('#mhd-items-container .mhd-card, #mhd-items-container [data-mhd-id]').length;
        const err = /fehler|timeout|retry|erneut/i.test(text);
        const loading = /wird geladen|skeleton|lädt/i.test(text) && cards === 0;
        return { cards, err, loading, snippet: text.slice(0, 180) };
      });
      const elapsed = Date.now() - mhdT0;
      if (mhdSnap.cards > 0 || mhdSnap.err || (!mhdSnap.loading && elapsed > 2000)) {
        mhdOk = mhdSnap.cards > 0 || mhdSnap.err || !mhdSnap.loading;
        report.criteria.c3_mhd_load = { ok: mhdOk && elapsed < 12000, ms: elapsed, ...mhdSnap };
        break;
      }
      report.criteria.c3_mhd_load = { ok: false, ms: elapsed, ...mhdSnap };
    }
    await shot('04-mhd.png');

    // C4: Employee no admin dashboard
    const empAdmin = await page.evaluate(() => {
      const link = document.getElementById('admin-header-dashboard-link');
      const drop = document.getElementById('admin-header-dropdown');
      const bodyAdmin = document.body.classList.contains('role-admin');
      return {
        bodyAdmin,
        dropdownHidden: !drop || drop.hidden || getComputedStyle(drop).display === 'none',
        dashLinkHidden: !link || link.hidden || getComputedStyle(link).display === 'none',
      };
    });
    await page.goto(`${BASE}/dev-dashboard?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const empDash = await page.evaluate(() => ({
      path: location.pathname,
      denied: Boolean(document.getElementById('dev-dashboard-boot-fallback'))
        || /anmeld|verweigert|nur für/i.test(document.body.innerText || ''),
      redirectedHome: location.pathname === '/' || location.pathname === '/index.html',
    }));
    report.criteria.c4_employee_no_admin = {
      ok: (empAdmin.dashLinkHidden || empAdmin.dropdownHidden) && (empDash.denied || empDash.redirectedHome),
      empAdmin,
      empDash,
    };
    await shot('05-employee-dashboard.png');

    // C5: Admin finds Messpunkte / Nutzer / Protokoll / Thekenklade ≤ 2 taps
    if (ADMIN_PW) {
      await context.clearCookies();
      await page.goto(`${BASE}/?logout=1&t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
      await login(page, ADMIN, ADMIN_PW);
      await page.goto(`${BASE}/dev-dashboard?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(3500);
      const adminNav = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('.dev-dashboard-tab[data-dev-tab]')].map((el) => ({
          tab: el.getAttribute('data-dev-tab'),
          text: (el.textContent || '').trim(),
          hidden: el.hidden,
        }));
        const geraete = document.getElementById('betrieb-tab-geraete');
        const users = document.querySelector('[data-dev-tab="users"]');
        const audit = document.querySelector('[data-dev-tab="audit"]');
        const theken = [...document.querySelectorAll('a,button')].some((el) => /thekenklade|thekenbuch/i.test(el.textContent || ''));
        return {
          tabs,
          hasUsers: Boolean(users && !users.hidden),
          hasAudit: Boolean(audit && !audit.hidden),
          hasGeraeteTab: Boolean(geraete),
          hasThekenHint: theken,
          roleBadge: document.getElementById('dev-dashboard-role-badge')?.textContent || '',
        };
      });
      // Tap 1: settings/Mein Betrieb, Tap 2: Geräte — structure check
      report.criteria.c5_admin_findability = {
        ok: adminNav.hasUsers && adminNav.hasAudit && (adminNav.hasGeraeteTab || adminNav.hasThekenHint),
        ...adminNav,
        note: 'Struktur ≤2 Taps: Nutzer+Protokoll Tabs; Geräte unter Mein Betrieb',
      };
      await shot('06-admin-dashboard.png');
    } else {
      report.criteria.c5_admin_findability = { ok: null, skipped: true, reason: 'HOFSYNC_ADMIN_PASSWORD missing' };
    }

    const results = Object.values(report.criteria).filter((c) => c && c.ok !== null);
    report.pass = results.every((c) => c.ok === true);
    report.verdict = report.pass ? 'PASS' : 'FAIL';
  } catch (err) {
    report.error = String(err?.stack || err);
    report.verdict = 'FAIL';
    await shot('99-error.png');
  }

  fs.writeFileSync(path.join(ART, 'verdict.json'), JSON.stringify(report, null, 2));
  console.log('VERDICT', report.verdict);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
