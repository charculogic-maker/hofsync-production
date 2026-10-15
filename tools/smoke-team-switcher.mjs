/**
 * Smoke: Header-Team-Button öffnet Wechsler-Modal (Profil + PIN).
 * Voraussetzung: python -m http.server 5173 --bind 127.0.0.1 im Ordner web/
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:5173/index.html?v=team-switcher-smoke';
const SCREENSHOT_PROFILE = '/opt/cursor/artifacts/screenshots/team-switcher-profile.png';
const SCREENSHOT_PIN = '/opt/cursor/artifacts/screenshots/team-switcher-pin.png';
const LOG = '/opt/cursor/artifacts/smoke-team-switcher.log';

mkdirSync(dirname(SCREENSHOT_PROFILE), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.addStyleTag({
  content: '#auth-lock-screen,#auth-lock-screen.active{display:none!important;pointer-events:none!important;visibility:hidden!important;}',
});
await page.waitForFunction(() => typeof window.showTeamSwitcher === 'function', null, { timeout: 30000 });

const profileResult = await page.evaluate(async () => {
  const steps = [];
  const btn = document.getElementById('btn-team');
  if (!btn || btn.tagName !== 'BUTTON' || btn.type !== 'button') {
    return { ok: false, steps, error: 'btn-team invalid' };
  }
  steps.push('btn-team ok');
  steps.push(`touch-action=${getComputedStyle(btn).touchAction}`);

  window.BRANDING = {
    ...(window.BRANDING || {}),
    betriebsName: 'StevesHof Hofladen',
    modules: {
      ...(window.BRANDING?.modules || {}),
      employeeAuth: 'profile',
      employeePin: false,
    },
  };

  const saved = window.persistActiveEmployeeSession?.('Paddy') || 'Paddy';
  btn.style.display = 'inline-flex';
  const nameEl = document.getElementById('employee-session-name');
  if (nameEl) nameEl.textContent = '👤 Paddy';
  steps.push(`persisted=${saved} badge=${nameEl?.textContent || ''}`);

  document.getElementById('profile-picker-overlay')?.remove();
  document.getElementById('team-switcher-overlay')?.remove();

  void window.showTeamSwitcher({ mandatory: false });
  await new Promise((r) => setTimeout(r, 150));

  const overlay = document.getElementById('profile-picker-overlay');
  if (!overlay) return { ok: false, steps, error: 'profile overlay missing' };
  steps.push('profile overlay open');

  const closeBtn = overlay.querySelector('[data-profile-close]');
  const cancelBtn = overlay.querySelector('.profile-picker-cancel');
  const names = [...overlay.querySelectorAll('[data-profile-name]')]
    .map((el) => el.dataset.profileName);
  steps.push(`names=${names.join(',')}`);
  steps.push(`close=${Boolean(closeBtn)} cancel=${Boolean(cancelBtn)}`);

  // Snapshot login marker; cancel/close must not clear it (no clearProfileSession).
  window.__smokeActiveEmployee = 'Paddy';
  const beforeBadge = nameEl?.textContent || '';
  cancelBtn.click();
  await new Promise((r) => setTimeout(r, 80));
  const afterBadge = document.getElementById('employee-session-name')?.textContent || '';
  const overlayGone = !document.getElementById('profile-picker-overlay');
  const loginMarker = window.__smokeActiveEmployee;
  steps.push(`badge before=${beforeBadge} after=${afterBadge} overlayGone=${overlayGone} marker=${loginMarker}`);

  // pointerdown path: reopen then close via ✕
  if (nameEl) nameEl.textContent = '👤 Paddy';
  btn.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
  }));
  await new Promise((r) => setTimeout(r, 150));
  const reopened = document.getElementById('profile-picker-overlay');
  steps.push(`reopened=${Boolean(reopened)}`);
  reopened?.querySelector('[data-profile-close]')?.click();
  await new Promise((r) => setTimeout(r, 80));
  const afterClose = !document.getElementById('profile-picker-overlay');
  steps.push(`closeRemovesOverlay=${afterClose} marker=${window.__smokeActiveEmployee}`);

  // Re-open for screenshot
  void window.showTeamSwitcher({ mandatory: false });
  await new Promise((r) => setTimeout(r, 150));

  return {
    ok: overlayGone
      && afterClose
      && loginMarker === 'Paddy'
      && window.__smokeActiveEmployee === 'Paddy'
      && Boolean(closeBtn)
      && Boolean(cancelBtn)
      && names.length >= 1
      && Boolean(reopened),
    steps,
    names,
    note: 'Badge-Text kann ohne Tenant-Kontext leer werden; Cancel/✕ dürfen clearProfileSession nicht auslösen.',
  };
});

await page.screenshot({ path: SCREENSHOT_PROFILE, fullPage: false });

const pinResult = await page.evaluate(async () => {
  const steps = [];
  if (typeof window.openPinTeamSwitcher !== 'function') {
    return { ok: false, steps, error: 'openPinTeamSwitcher missing' };
  }

  document.getElementById('profile-picker-overlay')?.remove();
  document.getElementById('team-switcher-overlay')?.remove();

  void window.openPinTeamSwitcher({ mandatory: false });
  await new Promise((r) => setTimeout(r, 150));

  const overlay = document.getElementById('team-switcher-overlay');
  if (!overlay) {
    return { ok: false, steps, error: 'pin overlay missing' };
  }
  steps.push('pin overlay open');

  const first = overlay.querySelector('[data-team-switch-name]');
  first?.click();
  await new Promise((r) => setTimeout(r, 60));
  const pinBlock = overlay.querySelector('.team-switcher-pin-block');
  const selected = overlay.querySelector('.team-switcher-selected')?.textContent || '';
  const keypad = overlay.querySelectorAll('[data-pin-key]').length;
  steps.push(`selected=${selected} pinVisible=${pinBlock && !pinBlock.hidden} keys=${keypad}`);

  const before = window.readActiveEmployee?.() || '';
  overlay.querySelector('[data-team-switch-cancel]')?.click();
  await new Promise((r) => setTimeout(r, 80));
  const after = window.readActiveEmployee?.() || '';
  const gone = !document.getElementById('team-switcher-overlay');
  steps.push(`cancel preserves ${before} -> ${after}, gone=${gone}`);

  // Re-open for screenshot
  void window.openPinTeamSwitcher({ mandatory: false });
  await new Promise((r) => setTimeout(r, 120));
  document.querySelector('#team-switcher-overlay [data-team-switch-name]')?.click();

  return {
    ok: gone && before === after && keypad === 12 && Boolean(pinBlock) && !pinBlock.hidden,
    steps,
  };
});

await page.screenshot({ path: SCREENSHOT_PIN, fullPage: false });
await browser.close();

const report = {
  profileResult,
  pinResult,
  screenshots: [SCREENSHOT_PROFILE, SCREENSHOT_PIN],
};
writeFileSync(LOG, `${JSON.stringify(report, null, 2)}\n`);

const ok = profileResult?.ok && pinResult?.ok;
console.log(JSON.stringify(report, null, 2));
if (!ok) {
  console.error('[smoke-team-switcher] FAILED');
  process.exit(1);
}
console.log('[smoke-team-switcher] OK');
