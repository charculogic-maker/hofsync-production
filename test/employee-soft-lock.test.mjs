/**
 * Soft-Lock Mitarbeiter-Schnellwechsler + 10-Minuten-Inaktivität.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Mitarbeiter Soft-Lock (#modal-employee-picker)', () => {
  const indexHtml = read('web/index.html');
  const appJs = read('web/app.js');
  const styleCss = read('web/style.css');
  const swJs = read('web/sw.js');
  const mhdJs = read('web/mhd.js');
  const ordersJs = read('web/customer-orders.js');

  it('renders #modal-employee-picker with close control and list host', () => {
    expect(indexHtml).to.match(/id="modal-employee-picker"/);
    expect(indexHtml).to.match(/id="employee-picker-list"/);
    expect(indexHtml).to.match(/id="employee-picker-close"/);
    expect(indexHtml).to.match(/id="btn-team"/);
  });

  it('stores active employee under charculogic.activeEmployee and mirrors scoped key', () => {
    expect(appJs).to.match(/SOFT_LOCK_EMPLOYEE_STORAGE_KEY\s*=\s*'charculogic\.activeEmployee'/);
    expect(appJs).to.match(/function writeSoftLockEmployeeMirror/);
    expect(appJs).to.match(/function clearSoftLockEmployeeMirror/);
    expect(appJs).to.match(/localStorage\.setItem\(SOFT_LOCK_EMPLOYEE_STORAGE_KEY/);
  });

  it('opens soft-lock modal from #btn-team and blocks close without selection', () => {
    expect(appJs).to.match(/function openEmployeePickerModal/);
    expect(appJs).to.match(/function ensureSoftLockEmployeeSelected/);
    expect(appJs).to.match(/employeePickerState\.mandatory/);
    expect(appJs).to.match(/Bitte zuerst einen Namen wählen/);
    expect(appJs).to.match(/openEmployeePickerModal\(\{\s*mandatory:\s*!readActiveEmployee/);
  });

  it('tracks inactivity for 600000 ms and clears the session', () => {
    expect(appJs).to.match(/EMPLOYEE_INACTIVITY_MS\s*=\s*600_000/);
    expect(appJs).to.match(/\['touchstart',\s*'pointerdown',\s*'click',\s*'keydown'\]/);
    expect(appJs).to.match(/function handleEmployeeInactivityTimeout/);
    expect(appJs).to.match(/function resetEmployeeInactivityTimer/);
    expect(appJs).to.match(/clearActiveEmployeeForSoftLock/);
    expect(appJs).to.match(/PROFILE_SESSION_IDLE_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  });

  it('uses admin login on Dev-Dashboard idle and soft-lock only on operative tabs', () => {
    expect(appJs).to.match(/const OPERATIVE_SOFT_LOCK_TABS\s*=\s*PIN_PROTECTED_TABS/);
    expect(appJs).to.match(/function isDevDashboardContext/);
    expect(appJs).to.match(/function isOperativeSoftLockTab/);
    expect(appJs).to.match(/function handleAdminDashboardIdleTimeout/);
    expect(appJs).to.match(/isDevDashboardContext\(\)[\s\S]*?handleAdminDashboardIdleTimeout/);
    expect(appJs).to.match(/isOperativeSoftLockTab\(\)/);
    expect(appJs).to.match(/promptLogin\('Sitzung abgelaufen\. Bitte erneut als Betriebs-Admin anmelden\.'\)/);
    expect(appJs).to.match(/async function ensureSoftLockEmployeeSelected[\s\S]*?if \(isDevDashboardContext\(\)\) return readActiveEmployee\(\);/);
    expect(appJs).to.match(/showDevDashboardLoginRequired\(\)/);
    expect(appJs).to.match(/logoutTenant\(\{\s*clearPersistence:\s*true\s*\}\)/);
  });

  it('does not force-navigate away from Neu/Wareneingang on soft-lock or scan idle', () => {
    // Soft-Lock/Picker: ensureActiveTabAllowed() ohne force — erlaubtes Neu bleibt.
    expect(appJs).to.match(/function clearActiveEmployeeForSoftLock[\s\S]*?ensureActiveTabAllowed\(\);/);
    expect(appJs).to.match(/function selectEmployeeFromPicker[\s\S]*?ensureActiveTabAllowed\(\);/);
    expect(appJs).to.match(/charculogic:active-employee-changed[\s\S]*?ensureActiveTabAllowed\(\);/);
    // Start-Tab darf weiterhin force nutzen.
    expect(appJs).to.match(/function showPreferredStartTab\(\) \{\s*return ensureActiveTabAllowed\(\{\s*force:\s*true\s*\}\);/);
    expect(appJs).to.match(/isScannerOverlayOpen\(\)/);
    expect(appJs).to.match(/Serien-Scan am Kamerabildschirm/);
    // Scan-/Schreibaktivität zählt für Soft-Lock mit (nicht nur Touch).
    expect(appJs).to.match(/function touchProfileLastActionTime[\s\S]*?resetEmployeeInactivityTimer/);
  });

  it('loads employees from canonical teamDashboard list with fallback', () => {
    const teamConfigJs = read('web/team-config.js');
    expect(appJs).to.match(/EMPLOYEE_PICKER_FALLBACK\s*=\s*\['Paddy',\s*'Laden-Team',\s*'Küche',\s*'Metzgerei',\s*'Büro'\]/);
    expect(appJs).to.match(/function loadEmployeePickerNamesFromFirestore/);
    expect(appJs).to.match(/ensureTeamEmployeesLoaded/);
    expect(appJs).to.match(/getTenantDefaultTeam/);
    expect(appJs).to.match(/\[HofSync\] Geladene Mitarbeiter für Mandant:/);
    expect(teamConfigJs).to.match(/TEAM_CONFIG_DOC_ID\s*=\s*'teamDashboard'/);
    expect(teamConfigJs).to.match(/export async function ensureTeamEmployeesLoaded/);
    expect(teamConfigJs).to.match(/export function extractActiveEmployeeNames/);
    expect(teamConfigJs).to.match(/entry\.active\s*===\s*false/);
  });

  it('times out employee list load and offers retry + fallback', () => {
    expect(appJs).to.match(/EMPLOYEE_PICKER_LOAD_TIMEOUT_MS\s*=\s*5000/);
    expect(appJs).to.match(/function withEmployeePickerLoadTimeout/);
    expect(appJs).to.match(/function refreshEmployeePickerNames/);
    expect(appJs).to.match(/data-employee-picker-retry/);
    expect(appJs).to.match(/Standardnamen nutzen oder erneut versuchen/);
  });

  it('dismisses the update toast once per session', () => {
    expect(appJs).to.match(/UPDATE_TOAST_DISMISSED_SESSION_KEY\s*=\s*'hofsync\.updateToastDismissed'/);
    expect(appJs).to.match(/function isUpdateToastDismissedThisSession/);
    expect(appJs).to.match(/hideUpdateToast\(\{\s*rememberDismiss:\s*true\s*\}\)/);
    expect(appJs).to.match(/if \(isUpdateToastDismissedThisSession\(\)\) return;/);
  });

  it('shows TEAM badge when anonymous and named badge otherwise', () => {
    expect(appJs).to.match(/👤 TEAM/);
    expect(appJs).to.match(/`👤 \$\{firstName\}`/);
  });

  it('attaches employeeName on MHD/Wareneingang and Packtisch writes', () => {
    expect(mhdJs).to.match(/fields\.employeeName\s*=\s*actor/);
    expect(mhdJs).to.match(/employeeName:\s*getActiveEmployee\(\)\s*\|\|\s*getAuditActorName\(\)/);
    expect(ordersJs).to.match(/employeeName:\s*employee/);
  });

  it('styles the centered soft-lock overlay with scrollable list', () => {
    expect(styleCss).to.match(/\.employee-picker-overlay/);
    expect(styleCss).to.match(/\.employee-picker-overlay\.is-open/);
    expect(styleCss).to.match(/\.employee-picker-overlay\.is-mandatory/);
    expect(styleCss).to.match(/max-height:\s*70vh/);
    expect(styleCss).to.match(/-webkit-overflow-scrolling:\s*touch/);
    expect(styleCss).to.match(/#employee-picker-list/);
  });

  it('uses stale-while-revalidate cache for employee list', () => {
    expect(appJs).to.match(/CACHED_EMPLOYEES_STORAGE_KEY\s*=\s*'charculogic\.cachedEmployees'/);
    expect(appJs).to.match(/function readCachedEmployeePickerList/);
    expect(appJs).to.match(/function writeCachedEmployeePickerList/);
    expect(appJs).to.match(/hasCache\s*=\s*cachedEmployees\.length\s*>\s*0/);
  });

  it('bumps the service-worker cache for we-herkunft-lot', () => {
    expect(swJs).to.include("const CACHE_NAME = 'charculogic-v20261031-arch-mhd-nav-v1'");
  });

  it('re-applies module visibility when employee is picked or cleared', () => {
    expect(appJs).to.match(/function selectEmployeeFromPicker/);
    expect(appJs).to.match(/applyModuleVisibility\(window\.BRANDING/);
    expect(appJs).to.match(/function clearActiveEmployeeForSoftLock/);
    expect(appJs).to.match(/resolveKitchenNavEnabled/);
    expect(appJs).to.match(/charculogic:active-employee-changed/);
    // Nach Picker/Clear: ensureActiveTabAllowed ohne force-Sprung auf MHD.
    expect(appJs).to.match(/function selectEmployeeFromPicker[\s\S]*?ensureActiveTabAllowed\(\);/);
    expect(appJs).to.match(/function clearActiveEmployeeForSoftLock[\s\S]*?ensureActiveTabAllowed\(\);/);
  });
});
