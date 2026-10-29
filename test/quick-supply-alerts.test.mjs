/**
 * Schnellmelde & Bedarfs-Stammdaten – statische Guardrails.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Schnellmelde & Bedarfs-Stammdaten', () => {
  const indexHtml = read('web/index.html');
  const appJs = read('web/app.js');
  const quickAlertJs = read('web/quick-alert.js');
  const teamConfigJs = read('web/team-config.js');
  const devDashboardJs = read('web/dev-dashboard.js');
  const swJs = read('web/sw.js');
  const rules = read('firebase.rules');

  it('exposes freitext modal, Bedarf checklist page and catalog admin', () => {
    expect(indexHtml).to.match(/id="btn-quick-alert"/);
    expect(indexHtml).to.match(/id="modal-quick-alert"/);
    expect(indexHtml).to.match(/id="page-bedarf"/);
    expect(indexHtml).to.match(/id="supply-alert-inbox"/);
    expect(indexHtml).to.match(/id="bedarf-quick-add"/);
    expect(indexHtml).to.match(/id="bedarf-quick-add-input"/);
    expect(indexHtml).to.match(/id="btn-bedarf-melden"/);
    expect(indexHtml).to.not.match(/id="supply-alert-banner"/);
    expect(indexHtml).to.match(/id="quick-alert-freetext"/);
    expect(indexHtml).to.match(/id="quick-alert-empty"/);
    expect(indexHtml).to.match(/id="btn-supply-alert-start"/);
    expect(indexHtml).to.match(/Zum Bedarf/);
    expect(indexHtml).to.match(/Bedarfsliste/);
    expect(indexHtml).to.match(/id="dev-dashboard-supply-catalog"/);
    expect(indexHtml).to.match(/id="dev-dashboard-supply-catalog-body"/);
    expect(indexHtml).to.match(/Bedarfs-Stammdaten/);
    expect(quickAlertJs).to.match(/export function openSupplyAlertModule/);
    expect(quickAlertJs).to.match(/renderSupplyAlertInbox/);
    expect(quickAlertJs).to.match(/groupAlertsByCategory/);
    expect(quickAlertJs).to.match(/handleBedarfQuickAdd/);
    expect(quickAlertJs).to.match(/bedarf-check-item/);
    expect(quickAlertJs).to.not.match(/function renderAlertBanner/);
  });

  it('wires quick-alert module into app boot and service worker cache', () => {
    expect(appJs).to.match(/import \{ initQuickAlertModule \} from '\.\/quick-alert\.js'/);
    expect(appJs).to.match(/initQuickAlertModule\(db/);
    expect(swJs).to.match(/charculogic-v\d{8}-/);
    expect(swJs).to.match(/\/quick-alert\.js/);
  });

  it('grows quick buttons from supply_catalog instead of hardcoded tiles', () => {
    expect(quickAlertJs).to.not.match(/export const QUICK_ALERT_CATEGORIES/);
    expect(quickAlertJs).to.not.match(/DEFAULT_QUICK_BUTTONS/);
    expect(quickAlertJs).to.not.match(/Handtuchpapier/);
    expect(quickAlertJs).to.not.match(/Kassenrollen/);
    expect(quickAlertJs).to.not.match(/isDefaultSeed/);
    expect(quickAlertJs).to.match(/SUPPLY_CATALOG_COLLECTION\s*=\s*'supply_catalog'/);
    expect(quickAlertJs).to.match(/QUICK_BUTTON_MIN_USES\s*=\s*2/);
    expect(quickAlertJs).to.match(/export function resolveQuickAlertButtons/);
    expect(quickAlertJs).to.match(/eigene_produktion/);
    expect(quickAlertJs).to.match(/zukauf_fleisch_wurst/);
    expect(quickAlertJs).to.match(/zukauf_laden/);
    expect(quickAlertJs).to.match(/export function catalogKeyFromLabel/);
    expect(quickAlertJs).to.match(/export async function upsertSupplyCatalogFromReport/);
    expect(quickAlertJs).to.match(/export function getQuickButtonCatalogItems/);
    expect(quickAlertJs).to.match(/export function renderSupplyCatalogAdminTable/);
    expect(quickAlertJs).to.match(/Bedarf gemeldet!/);
    expect(devDashboardJs).to.match(/renderSupplyCatalogAdminTable/);
    expect(indexHtml).to.match(/id="quick-alert-category"/);
    expect(indexHtml).to.match(/id="quick-alert-assignee"/);
    expect(indexHtml).to.match(/Zuweisen an/);
    expect(indexHtml).to.match(/Noch keine Schnell-Buttons/);
    expect(quickAlertJs).to.match(/assignedTo/);
    expect(quickAlertJs).to.match(/populateAssigneeSelect/);
  });

  it('stores departmentAssignments on teamDashboard with primary + canOrder', () => {
    expect(teamConfigJs).to.match(/departmentAssignments/);
    expect(teamConfigJs).to.match(/DEPARTMENT_KEYS/);
    expect(teamConfigJs).to.match(/export async function saveEmployeeDepartmentAssignment/);
    expect(teamConfigJs).to.match(/export function normalizeDepartmentAssignmentEntry/);
    expect(teamConfigJs).to.match(/primaryDepartment/);
    expect(teamConfigJs).to.match(/canOrder/);
    expect(teamConfigJs).to.match(/resolveTeamConfigTenantId|getGlobalTenantId/);
    expect(teamConfigJs).to.match(/saveEmployeeDepartmentAssignment[\s\S]*?op:\s*'update'/);
    expect(devDashboardJs).to.match(/setTeamConfigTenantId/);
    expect(devDashboardJs).to.match(/set-user-primary-department/);
    expect(devDashboardJs).to.match(/toggle-user-department/);
    expect(devDashboardJs).to.match(/toggle-user-can-order/);
    expect(devDashboardJs).to.match(/Bedarfe erledigen/);
    expect(devDashboardJs).to.match(/readDepartmentAssignmentFromRow/);
    expect(indexHtml).to.match(/Fachbereiche/);
  });

  it('allows supply_alerts and supply_catalog in Firestore rules', () => {
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/supply_alerts\/\{alertId\}/);
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/supply_catalog\/\{itemId\}/);
    expect(rules).to.match(/departmentAssignments/);
    expect(rules).to.match(/teamDashboardAllowedKeys/);
    expect(rules).to.match(/'sonstig'/);
    expect(rules).to.match(/'assignedTo'/);
  });
});

describe('catalogKeyFromLabel helpers (source contract)', () => {
  const source = read('web/quick-alert.js');

  it('normalizes umlauts and spaces in catalogKeyFromLabel implementation', () => {
    expect(source).to.match(/replace\(\/ß\/g,\s*'ss'\)/);
    expect(source).to.match(/normalize\('NFD'\)/);
  });
});

describe('Bedarf status visibility (Bestellt / Erledigt)', () => {
  const quickAlertJs = read('web/quick-alert.js');
  const styleCss = read('web/style.css');

  it('renders checklist rows with optional Bestellt and tap-to-done', () => {
    expect(quickAlertJs).to.match(/bedarf-check-item--\$\{/);
    expect(quickAlertJs).to.match(/bedarf-check-ordered/);
    expect(quickAlertJs).to.match(/Als bestellt markieren/);
    expect(quickAlertJs).to.match(/>Bestellt</);
    expect(quickAlertJs).to.match(/data-supply-alert-status="done"/);
    expect(quickAlertJs).to.match(/data-supply-alert-status="ordered"/);
    expect(quickAlertJs).to.match(/export function supplyAlertStatusClass/);
    expect(quickAlertJs).to.match(/bedarf-check-item\.is-interactive/);
    expect(quickAlertJs).to.match(/bestellt/);
    expect(quickAlertJs).to.match(/Freie Bedarfsliste \(all\)/);
  });

  it('styles ordered vs open checklist states distinctly', () => {
    expect(styleCss).to.match(/\.bedarf-check-item--ordered/);
    expect(styleCss).to.match(/\.bedarf-check-item--urgent/);
    expect(styleCss).to.match(/\.bedarf-check-ordered/);
    expect(styleCss).to.match(/\.bedarf-check-toggle/);
    expect(styleCss).to.match(/\.bedarf-quick-add/);
  });
});
