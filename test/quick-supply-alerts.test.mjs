/**
 * Schnellmelde- & Bedarfs-Widget (supply_alerts) – statische Guardrails.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Schnellmelde & Bedarfs-Widget', () => {
  const indexHtml = read('web/index.html');
  const appJs = read('web/app.js');
  const quickAlertJs = read('web/quick-alert.js');
  const teamConfigJs = read('web/team-config.js');
  const devDashboardJs = read('web/dev-dashboard.js');
  const swJs = read('web/sw.js');
  const rules = read('firebase.rules');

  it('exposes header button, modal and banner markup', () => {
    expect(indexHtml).to.match(/id="btn-quick-alert"/);
    expect(indexHtml).to.match(/id="modal-quick-alert"/);
    expect(indexHtml).to.match(/id="supply-alert-banner"/);
    expect(indexHtml).to.match(/id="quick-alert-grid"/);
    expect(indexHtml).to.match(/Bereiche/);
  });

  it('wires quick-alert module into app boot and service worker cache', () => {
    expect(appJs).to.match(/import \{ initQuickAlertModule \} from '\.\/quick-alert\.js'/);
    expect(appJs).to.match(/initQuickAlertModule\(db/);
    expect(swJs).to.match(/charculogic-v20261025-supply-alerts-v1/);
    expect(swJs).to.match(/\/quick-alert\.js/);
  });

  it('defines 1-tap categories and Firestore supply_alerts writes', () => {
    expect(quickAlertJs).to.match(/QUICK_ALERT_CATEGORIES/);
    expect(quickAlertJs).to.match(/sb_theke/);
    expect(quickAlertJs).to.match(/metzgerei_bedarf/);
    expect(quickAlertJs).to.match(/verbrauchsmaterial/);
    expect(quickAlertJs).to.match(/SUPPLY_ALERTS_COLLECTION\s*=\s*'supply_alerts'/);
    expect(quickAlertJs).to.match(/export async function createSupplyAlert/);
    expect(quickAlertJs).to.match(/Bedarf gemeldet!/);
  });

  it('stores departmentAssignments on teamDashboard with canOrder', () => {
    expect(teamConfigJs).to.match(/departmentAssignments/);
    expect(teamConfigJs).to.match(/DEPARTMENT_KEYS/);
    expect(teamConfigJs).to.match(/export async function saveEmployeeDepartmentAssignment/);
    expect(teamConfigJs).to.match(/canOrder/);
    expect(devDashboardJs).to.match(/toggle-user-department/);
    expect(devDashboardJs).to.match(/toggle-user-can-order/);
    expect(devDashboardJs).to.match(/renderEmployeeDepartmentToggles/);
  });

  it('allows supply_alerts in Firestore rules and departmentAssignments on teamDashboard', () => {
    expect(rules).to.match(/match \/tenants\/\{tenantId\}\/supply_alerts\/\{alertId\}/);
    expect(rules).to.match(/departmentAssignments/);
    expect(rules).to.match(/isSupplyAlertStatusTransition/);
  });
});
