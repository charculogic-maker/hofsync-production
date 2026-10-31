/**
 * Phase D: Protokoll „Meine Schicht“, Progressive Disclosure, Super-Admin-Trennung,
 * Header-Entschlackung.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isBetriebsAdmin,
  isPlatformSuperAdmin,
  isTenantAdmin,
} from '../web/tenant-admin-auth.js';
import { resolveTabsForClaimRole, ACCESS_MODULE_KEYS } from '../web/tenant-modules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const TENANT_ALL = Object.fromEntries(ACCESS_MODULE_KEYS.map((k) => [k, true]));

describe('Phase D Admin-Feinschliff', () => {
  const html = read('web/index.html');
  const dash = read('web/dev-dashboard.js');
  const auth = read('web/tenant-admin-auth.js');
  const app = read('web/app.js');
  const css = read('web/style.css');
  const sw = read('web/sw.js');
  const rbacDoc = read('docs/testing/admin-rbac-matrix.md');

  describe('D.1 RBAC-Matrix gegen UI-Tabs', () => {
    it('Employee vs Admin vs Helper bleibt in resolveTabsForClaimRole', () => {
      const employee = resolveTabsForClaimRole('employee', { tenantModules: TENANT_ALL });
      const admin = resolveTabsForClaimRole('admin', { tenantModules: TENANT_ALL });
      const helper = resolveTabsForClaimRole('helper', { tenantModules: TENANT_ALL });
      expect(employee).to.include('mhd');
      expect(employee).to.not.include('batches');
      expect(admin).to.include('batches');
      expect(helper).to.not.include('receiving');
    });

    it('verweist die Testmatrix auf Laden-Claims-Doku', () => {
      expect(rbacDoc).to.match(/Betriebs-Admin|Super-Admin/);
      expect(read('docs/CLAIMS_TABS_MAPPING.md')).to.match(/Employee vs Admin/);
    });
  });

  describe('D.2 Protokoll Meine Schicht', () => {
    it('bietet Preset Meine Schicht im Markup', () => {
      expect(html).to.match(/data-report-shift="mine"/);
      expect(html).to.match(/Meine Schicht/);
    });

    it('bindet applyMeineSchichtFilter in dev-dashboard.js', () => {
      expect(dash).to.match(/function applyMeineSchichtFilter\s*\(/);
      expect(dash).to.match(/function resolveReportSessionActorName\s*\(/);
      expect(dash).to.match(/data-report-shift="mine"/);
      expect(dash).to.match(/applyMeineSchicht:\s*applyMeineSchichtFilter/);
    });
  });

  describe('D.3 Progressive Disclosure', () => {
    it('blendet Hygiene/Geräte/Rabattstaffel modulabhängig aus', () => {
      expect(dash).to.match(/function syncBetriebProgressivePanels\s*\(/);
      expect(dash).to.match(/betrieb-tab-hygiene/);
      expect(dash).to.match(/betrieb-tab-geraete/);
      expect(dash).to.match(/dev-dashboard-discount-matrix/);
      expect(dash).to.match(/syncBetriebProgressivePanels\(dashboardStateRef\)/);
    });
  });

  describe('D.4 Super-Admin vs Betriebs-Admin', () => {
    it('trennt isBetriebsAdmin von isPlatformSuperAdmin', () => {
      expect(auth).to.match(/export function isBetriebsAdmin\s*\(/);
      const superUser = { email: 'patrik@charculogic.de', uid: 'x' };
      expect(isPlatformSuperAdmin(superUser)).to.equal(true);
      expect(isBetriebsAdmin(superUser, { role: 'admin', isAdmin: true })).to.equal(false);
      expect(isTenantAdmin(superUser, { role: 'admin' })).to.equal(true);
      expect(isBetriebsAdmin(null, { role: 'admin', isAdmin: true })).to.equal(true);
      expect(isTenantAdmin(null, { role: 'admin' })).to.equal(true);
    });

    it('startet Super-Admin ohne Tenant auf Plattform-Tab', () => {
      expect(dash).to.match(/activeTab = 'platform'/);
      expect(dash).to.match(/Zuerst Betrieb/);
      expect(dash).to.match(/role-super-admin/);
      expect(dash).to.match(/role-betriebs-admin/);
    });
  });

  describe('Header-Entschlackung', () => {
    it('legt ⋯-Overflow für Theme/Refresh/Version an', () => {
      expect(html).to.match(/id="header-tools-dropdown"/);
      expect(html).to.match(/data-header-tool="theme"/);
      expect(html).to.match(/data-header-tool="refresh"/);
      expect(html).to.match(/data-header-tool="version"/);
      expect(html).to.match(/header-action--secondary/);
    });

    it('bindet und styled den Overflow mobile-first', () => {
      expect(app).to.match(/function bindHeaderToolsDropdown\s*\(/);
      expect(css).to.match(/\.header-tools-dropdown/);
      expect(css).to.match(/\.header-action--secondary/);
      expect(css).to.match(/Sekundäraktionen/);
    });

    it('bumpt den Service-Worker-Cache', () => {
      expect(sw).to.include("const CACHE_NAME = 'charculogic-v20261031-knowledge-employee-v1'");
      expect(app).to.include('sw.js?v=20261031-knowledge-employee-v1');
    });
  });
});
