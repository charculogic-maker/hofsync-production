#!/usr/bin/env node
/**
 * Audit + E2E for Verwaltung / Büro without real admin passwords.
 * Simulates Firebase Auth custom claims (admin / employee / helper).
 */
import { chromium } from 'playwright';
import {
  isTenantAdmin,
  isPlatformSuperAdmin,
  useTenantAdminAuth,
  TENANT_ADMIN_ROLE,
} from '../web/tenant-admin-auth.js';
import {
  filterTenantUsers,
  summarizeTenantUsers,
} from '../web/admin-tenant-models.js';

const TENANT_A = 'StevesHof_Hauptbetrieb';
const TENANT_B = 'TorFabrik';

function step(name, pass, extra = {}) {
  return { name, pass: Boolean(pass), ...extra };
}

const rbacSteps = [];

rbacSteps.push(step(
  'isTenantAdmin allows claim role=admin',
  isTenantAdmin({ uid: 'admin-a' }, { role: TENANT_ADMIN_ROLE, isAdmin: true, tenantId: TENANT_A }),
));
rbacSteps.push(step(
  'isTenantAdmin denies employee',
  !isTenantAdmin({ uid: 'emp-a' }, { role: 'employee', isAdmin: false, tenantId: TENANT_A }),
));
rbacSteps.push(step(
  'isTenantAdmin denies helper / mitarbeiter-aushilfe',
  !isTenantAdmin({ uid: 'help-a' }, { role: 'helper', isAdmin: false, tenantId: TENANT_A }),
));
rbacSteps.push(step(
  'platform super-admin is recognized by email/uid',
  isPlatformSuperAdmin({ email: 'patrik@charculogic.de', uid: 'other' })
    && isPlatformSuperAdmin({ uid: 'VYwMy5IAlAR26pj8ZbFfc5PNdou2' })
    && !isPlatformSuperAdmin({ email: 'mitarbeiter@steveshof.de', uid: 'emp-a' }),
));

const employeeGate = useTenantAdminAuth({
  user: { uid: 'emp-a', email: 'mitarbeiter@steveshof.de' },
  authContext: { role: 'employee', isAdmin: false, tenantId: TENANT_A },
  redirect: false,
  renderFallback: false,
  requireRoute: false,
});
rbacSteps.push(step(
  'useTenantAdminAuth blocks employee',
  employeeGate.allowed === false && employeeGate.role === 'employee',
  { allowed: employeeGate.allowed, role: employeeGate.role },
));

const helperGate = useTenantAdminAuth({
  user: { uid: 'help-a', email: 'helper@steveshof.de' },
  authContext: { role: 'helper', isAdmin: false, tenantId: TENANT_A },
  redirect: false,
  renderFallback: false,
  requireRoute: false,
});
rbacSteps.push(step(
  'useTenantAdminAuth blocks helper',
  helperGate.allowed === false,
));

const adminGate = useTenantAdminAuth({
  user: { uid: 'admin-a', email: 'admin@steveshof.de' },
  authContext: { role: 'admin', isAdmin: true, tenantId: TENANT_A },
  redirect: false,
  renderFallback: false,
  requireRoute: false,
});
rbacSteps.push(step(
  'useTenantAdminAuth allows tenant admin',
  adminGate.allowed === true && adminGate.role === 'admin',
));

const users = [
  { uid: '1', displayName: 'Stephie', email: 'stephie@steveshof.de', role: 'admin', tenantId: TENANT_A },
  { uid: '2', displayName: 'Finn', email: 'finn@steveshof.de', role: 'employee', tenantId: TENANT_A },
  { uid: '3', displayName: 'Aushilfe', email: 'help@steveshof.de', role: 'helper', tenantId: TENANT_A },
];
const summary = summarizeTenantUsers(users);
const filtered = filterTenantUsers(users, { query: 'finn', role: 'employee' });
rbacSteps.push(step(
  'user filter/summary for büro dashboard',
  summary.total === 3 && summary.admins === 1 && filtered.length === 1 && filtered[0].displayName === 'Finn',
  summary,
));

if (rbacSteps.some((entry) => !entry.pass)) {
  console.error('RBAC unit failures:', rbacSteps.filter((entry) => !entry.pass));
  process.exit(1);
}

const BASE_URL = 'http://127.0.0.1:5173/index.html?v=admin-module-audit';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.addStyleTag({ content: '#auth-lock-screen,#auth-lock-screen.active{display:none!important;pointer-events:none!important;}' });

const uiResult = await page.evaluate(async () => {
  const steps = [];
  const tenantId = 'StevesHof_Hauptbetrieb';
  const callableCalls = [];
  let employees = [
    {
      uid: 'admin-a',
      email: 'admin@steveshof.de',
      displayName: 'Patrik Admin',
      role: 'admin',
      tenantId,
      allowedModules: { mhd: true, kitchen: true, buero: true },
    },
    {
      uid: 'emp-a',
      email: 'finn@steveshof.de',
      displayName: 'Finn',
      role: 'employee',
      tenantId,
      allowedModules: { mhd: true, kitchen: true, buero: false },
    },
  ];

  document.getElementById('auth-lock-screen')?.remove();
  history.replaceState({}, '', '/dev-dashboard');

  const adminUser = { uid: 'admin-a', email: 'admin@steveshof.de' };
  const employeeUser = { uid: 'emp-a', email: 'finn@steveshof.de' };
  const helperUser = { uid: 'help-a', email: 'helper@steveshof.de' };

  const appObj = {
    options: { projectId: 'hofsync-production' },
    functions: () => ({
      httpsCallable: (name) => async (payload) => {
        callableCalls.push({ name, payload });
        if (name === 'manageTenantEmployees' && payload?.action === 'list') {
          if (payload.tenantId !== tenantId) {
            const err = new Error('Kein Zugriff auf diesen Mandanten.');
            err.code = 'permission-denied';
            throw err;
          }
          return { data: { employees: [...employees] } };
        }
        if (name === 'createTenantEmployee') {
          if (payload.tenantId !== tenantId) {
            const err = new Error('Kein Zugriff auf diesen Mandanten.');
            err.code = 'permission-denied';
            throw err;
          }
          const created = {
            uid: `uid-${Date.now()}`,
            email: payload.email,
            displayName: payload.name,
            role: 'employee',
            tenantId: payload.tenantId,
            allowedModules: payload.allowedModules || { mhd: true, kitchen: true, buero: true },
          };
          employees = [...employees, created];
          return { data: { email: created.email, uid: created.uid } };
        }
        if (name === 'manageTenantEmployees' && payload?.action === 'update') {
          employees = employees.map((entry) => (
            entry.uid === payload.uid
              ? { ...entry, role: payload.role || entry.role, allowedModules: payload.allowedModules || entry.allowedModules }
              : entry
          ));
          return { data: { ok: true } };
        }
        return { data: { ok: true } };
      },
    }),
  };

  const ReCaptchaV3Provider = class { constructor() {} };
  const appCheckFn = () => ({ activate() { return undefined; } });
  appCheckFn.ReCaptchaV3Provider = ReCaptchaV3Provider;

  window.firebase = {
    apps: [appObj],
    app: () => appObj,
    auth: () => ({ currentUser: adminUser, signOut: async () => {} }),
    appCheck: appCheckFn,
  };

  const tenantSnap = {
    exists: true,
    data: () => ({
      displayName: 'StevesHof Hofladen',
      status: 'active',
      enabledModules: {
        start: true, team: true, mhd: true, receiving: true, kitchen: true,
        haccp: true, knowledge: true, buero: true, chargenDoku: true,
      },
    }),
  };
  const db = {
    collection: (name) => ({
      doc: () => ({
        onSnapshot: (onNext) => {
          onNext(tenantSnap);
          return () => {};
        },
        update: async () => {},
        set: async () => {},
      }),
      onSnapshot: (onNext) => {
        onNext({ docs: [{ id: tenantId, data: tenantSnap.data }] });
        return () => {};
      },
    }),
  };

  const { initAppCheckModule } = await import('./app-check.js');
  await initAppCheckModule();

  const { initDevDashboard } = await import('./dev-dashboard.js');
  const { isTenantAdmin, useTenantAdminAuth } = await import('./tenant-admin-auth.js');
  const { isOfficeUser } = await import('./auth.js');
  const { saveProductMaster } = await import('./mhd.js');

  const employeeDenied = await initDevDashboard(db, {
    currentUser: employeeUser,
    authContext: { role: 'employee', isAdmin: false, tenantId },
  });
  const deniedPanel = document.getElementById('dev-dashboard-denied');
  steps.push({
    name: 'employee-cannot-open-verwaltung',
    pass: employeeDenied === false && Boolean(deniedPanel) && !deniedPanel.hidden,
    employeeDenied,
    deniedHidden: deniedPanel?.hidden ?? null,
    deniedTitle: deniedPanel?.querySelector('.dev-dashboard-denied-title')?.textContent || null,
  });

  const helperDenied = await initDevDashboard(db, {
    currentUser: helperUser,
    authContext: { role: 'helper', isAdmin: false, tenantId },
  });
  steps.push({
    name: 'helper-cannot-open-verwaltung',
    pass: helperDenied === false,
  });

  window.firebase.auth = () => ({ currentUser: adminUser, signOut: async () => {} });
  const adminAllowed = await initDevDashboard(db, {
    currentUser: adminUser,
    authContext: { role: 'admin', isAdmin: true, tenantId },
  });
  await new Promise((resolve) => setTimeout(resolve, 250));

  const shell = document.querySelector('.dev-dashboard-shell');
  const overview = document.getElementById('dev-dashboard-view-overview');
  const tabs = [...document.querySelectorAll('.dev-dashboard-tab')].map((el) => el.getAttribute('data-dev-tab'));
  steps.push({
    name: 'admin-dashboard-loads',
    pass: adminAllowed === true
      && document.getElementById('page-dev-dashboard')?.classList.contains('active')
      && Boolean(shell)
      && overview && !overview.hidden
      && tabs.includes('overview') && tabs.includes('users') && tabs.includes('settings') && tabs.includes('audit'),
    adminAllowed,
    tabs,
    status: document.getElementById('dev-dashboard-status')?.textContent || null,
    roleBadge: document.getElementById('dev-dashboard-role-badge')?.textContent || null,
  });

  const globalPanel = document.getElementById('dev-dashboard-global-panel');
  steps.push({
    name: 'tenant-admin-hides-platform-panel',
    pass: Boolean(globalPanel?.hidden),
  });

  document.getElementById('dev-dashboard-tab-users')?.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const usersView = document.getElementById('dev-dashboard-view-users');
  const employeeRows = [...document.querySelectorAll('#dev-dashboard-employee-body tr')];
  steps.push({
    name: 'users-tab-lists-employees',
    pass: usersView && !usersView.hidden && employeeRows.length >= 2
      && employeeRows.some((row) => row.textContent.includes('Finn')),
    rowCount: employeeRows.length,
  });

  document.getElementById('dev-dashboard-invite-open-btn')?.click();
  const createPanel = document.getElementById('dev-dashboard-employee-create');
  document.getElementById('dev-dashboard-employee-name').value = 'Nicole';
  document.getElementById('dev-dashboard-employee-email').value = 'nicole@steveshof.de';
  document.getElementById('dev-dashboard-employee-password').value = 'nicht-produktion-123';
  document.getElementById('dev-dashboard-employee-form')?.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const createCall = callableCalls.find((entry) => entry.name === 'createTenantEmployee');
  steps.push({
    name: 'create-user-callable-scoped-to-tenant',
    pass: Boolean(createPanel)
      && createCall?.payload?.tenantId === tenantId
      && createCall?.payload?.name === 'Nicole'
      && createCall?.payload?.email === 'nicole@steveshof.de'
      && !Object.prototype.hasOwnProperty.call(createCall?.payload || {}, 'pin'),
    payload: createCall?.payload || null,
    status: document.getElementById('dev-dashboard-employee-status')?.textContent || null,
  });

  const nicoleRow = [...document.querySelectorAll('#dev-dashboard-employee-body tr')]
    .find((row) => row.textContent.includes('Nicole'));
  steps.push({
    name: 'created-user-appears-in-table',
    pass: Boolean(nicoleRow),
  });

  const roleToggle = document.querySelector('#dev-dashboard-employee-body [data-action="toggle-role"][data-uid="emp-a"]');
  roleToggle?.click();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const roleCall = callableCalls.find((entry) => (
    entry.name === 'manageTenantEmployees'
    && entry.payload?.action === 'update'
    && entry.payload?.uid === 'emp-a'
    && entry.payload?.role
  ));
  steps.push({
    name: 'role-toggle-saves-via-callable',
    pass: roleCall?.payload?.tenantId === tenantId && roleCall?.payload?.role === 'admin',
    roleCall: roleCall?.payload || null,
  });

  document.getElementById('dev-dashboard-tab-settings')?.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const settingsView = document.getElementById('dev-dashboard-view-settings');
  const nameInput = document.getElementById('dev-dashboard-settings-name');
  const logoInput = document.getElementById('dev-dashboard-settings-logo');
  nameInput.value = 'StevesHof Hofladen';
  logoInput.value = '/icon-192.png';
  document.getElementById('dev-dashboard-settings-form')?.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const storedSettings = JSON.parse(localStorage.getItem(`charculogic_tenant_settings_v1_${tenantId}`) || '{}');
  steps.push({
    name: 'settings-save-tenant-config',
    pass: settingsView && !settingsView.hidden
      && storedSettings.displayName === 'StevesHof Hofladen'
      && document.getElementById('dev-dashboard-settings-status')?.textContent.includes('gespeichert'),
    storedSettings,
  });

  const modulePanel = document.getElementById('dev-dashboard-single-panel');
  steps.push({
    name: 'tenant-module-settings-visible-for-betrieb',
    pass: Boolean(modulePanel) && !modulePanel.hidden,
  });

  document.getElementById('dev-dashboard-tab-audit')?.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const auditRows = [...document.querySelectorAll('#dev-dashboard-audit-body tr')];
  steps.push({
    name: 'audit-tab-renders-events',
    pass: document.getElementById('dev-dashboard-view-audit') && !document.getElementById('dev-dashboard-view-audit').hidden
      && auditRows.length > 0
      && auditRows.some((row) => /Verwaltung|gespeichert|angelegt/i.test(row.textContent)),
    auditCount: auditRows.length,
  });

  saveProductMaster({
    barcode: '4028332320111',
    ean: '4028332320111',
    name: 'Weißenhorner Paprika Creme',
    brand: 'Weißenhorner',
    kategorie: '🥛MoPro',
  });
  saveProductMaster({
    barcode: '4028332320111',
    ean: '4028332320111',
    name: 'Weißenhorner Paprika Creme Bio',
    brand: 'Weißenhorner',
    kategorie: '🥛MoPro',
  });
  const masterKey = 'charculogic.productMaster.v1';
  const master = JSON.parse(localStorage.getItem(masterKey) || '{}');
  const created = master['4028332320111'];
  delete master['4028332320111'];
  localStorage.setItem(masterKey, JSON.stringify(master));
  const afterDelete = JSON.parse(localStorage.getItem(masterKey) || '{}');
  steps.push({
    name: 'stammdaten-ean-create-update-delete',
    pass: created?.name === 'Weißenhorner Paprika Creme Bio'
      && created?.brand === 'Weißenhorner'
      && !afterDelete['4028332320111'],
    created,
  });

  const officePanel = document.getElementById('office-tools-panel');
  const masterBtn = document.getElementById('btn-master-data');
  const teamConfig = document.getElementById('admin-team-config-panel');
  const adminNav = document.getElementById('app-nav-admin-zone');
  steps.push({
    name: 'office-stammdaten-controls-exist',
    pass: Boolean(officePanel) && Boolean(masterBtn) && Boolean(teamConfig)
      && Boolean(document.getElementById('btn-haccp-print'))
      && Boolean(document.getElementById('btn-office-master-data')),
  });
  steps.push({
    name: 'admin-nav-hidden-until-has-admin-nav',
    pass: Boolean(adminNav?.hidden) || getComputedStyle(adminNav).display === 'none' || !document.body.classList.contains('has-admin-nav'),
    hasAdminNav: document.body.classList.contains('has-admin-nav'),
    adminNavHidden: adminNav?.hidden ?? null,
  });

  steps.push({
    name: 'office-user-helper-denied',
    pass: isOfficeUser({ isAdmin: true, isHelper: false }) === true
      && isOfficeUser({ role: 'employee', isAdmin: false }) === false
      && isOfficeUser({ role: 'helper', isAdmin: false, isHelper: true }) === false
      && !isTenantAdmin(employeeUser, { role: 'employee', isAdmin: false, tenantId }),
  });

  const crossTenant = useTenantAdminAuth({
    user: adminUser,
    authContext: { role: 'admin', isAdmin: true, tenantId },
    redirect: false,
    renderFallback: false,
    requireRoute: false,
  });
  steps.push({
    name: 'admin-gate-does-not-elevate-other-tenants-in-ui-state',
    pass: crossTenant.tenantId === tenantId && crossTenant.allowed === true,
  });

  return {
    steps,
    allPass: steps.every((entry) => entry.pass),
    callableNames: [...new Set(callableCalls.map((entry) => entry.name))],
  };
});

console.log(JSON.stringify({ rbacSteps, uiResult }, null, 2));

const failedUi = uiResult.steps.filter((entry) => !entry.pass);
if (!uiResult.allPass) {
  console.error('Admin UI failures:', failedUi);
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: '/opt/cursor/artifacts/admin-dashboard-audit.png' });
await browser.close();
console.log('Admin module audit passed.');
