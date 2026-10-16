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
    expect(appJs).to.match(/function employeePickerCacheStorageKey/);
    expect(appJs).to.match(/scopedTeamboardStorageKey\(\s*CACHED_EMPLOYEES_STORAGE_KEY/);
    expect(appJs).to.match(/function readCachedEmployeePickerList/);
    expect(appJs).to.match(/function writeCachedEmployeePickerList/);
    expect(appJs).to.match(/hasCache\s*=\s*cachedEmployees\.length\s*>\s*0/);
  });

  it('bumps the service-worker cache to tenant-cache-v1', () => {
    expect(swJs).to.include("const CACHE_NAME = 'charculogic-v20261016-tenant-cache-v1'");
  });
});
