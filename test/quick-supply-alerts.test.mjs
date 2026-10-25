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

  it('exposes freitext-first modal, catalog admin table and banner', () => {
    expect(indexHtml).to.match(/id="btn-quick-alert"/);
    expect(indexHtml).to.match(/id="modal-quick-alert"/);
    expect(indexHtml).to.match(/id="supply-alert-banner"/);
    expect(indexHtml).to.match(/id="quick-alert-freetext"/);
    expect(indexHtml).to.match(/id="quick-alert-empty"/);
    expect(indexHtml).to.match(/id="btn-supply-alert-start"/);
    expect(indexHtml).to.match(/Bedarf eintragen/);
    expect(indexHtml).to.match(/id="dev-dashboard-supply-catalog"/);
    expect(indexHtml).to.match(/id="dev-dashboard-supply-catalog-body"/);
    expect(indexHtml).to.match(/Bedarfs-Stammdaten/);
  });

  it('wires quick-alert module into app boot and service worker cache', () => {
    expect(appJs).to.match(/import \{ initQuickAlertModule \} from '\.\/quick-alert\.js'/);
    expect(appJs).to.match(/initQuickAlertModule\(db/);
    expect(swJs).to.match(/charculogic-v\d{8}-/);
    expect(swJs).to.match(/\/quick-alert\.js/);
  });

  it('grows quick buttons from supply_catalog instead of hardcoded tiles', () => {
    expect(quickAlertJs).to.not.match(/export const QUICK_ALERT_CATEGORIES/);
    expect(quickAlertJs).to.match(/SUPPLY_CATALOG_COLLECTION\s*=\s*'supply_catalog'/);
    expect(quickAlertJs).to.match(/QUICK_BUTTON_MIN_USES\s*=\s*2/);
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
  });

  it('stores departmentAssignments on teamDashboard with canOrder', () => {
    expect(teamConfigJs).to.match(/departmentAssignments/);
    expect(teamConfigJs).to.match(/DEPARTMENT_KEYS/);
    expect(teamConfigJs).to.match(/export async function saveEmployeeDepartmentAssignment/);
    expect(teamConfigJs).to.match(/canOrder/);
    expect(teamConfigJs).to.match(/saveEmployeeDepartmentAssignment[\s\S]*?op:\s*'update'/);
    expect(devDashboardJs).to.match(/toggle-user-department/);
    expect(devDashboardJs).to.match(/toggle-user-can-order/);
  });

  it('allows supply_alerts and supply_catalog in Firestore rules', () => {
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/supply_alerts\/\{alertId\}/);
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/supply_catalog\/\{itemId\}/);
    expect(rules).to.match(/departmentAssignments/);
    expect(rules).to.match(/teamDashboardAllowedKeys/);
    expect(rules).to.match(/'sonstig'/);
  });
});

describe('catalogKeyFromLabel helpers (source contract)', () => {
  const source = read('web/quick-alert.js');

  it('normalizes umlauts and spaces in catalogKeyFromLabel implementation', () => {
    expect(source).to.match(/replace\(\/ß\/g,\s*'ss'\)/);
    expect(source).to.match(/normalize\('NFD'\)/);
  });
});
