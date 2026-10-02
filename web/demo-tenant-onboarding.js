/**
 * Schnell-Onboarding: Demo-Mandant anlegen + Einladungs-Link (provisionDemoTenant).
 * Sichtbar für Plattform-Super-Admins (Büro / page-batches + Dev-Dashboard).
 */
import { createHttpsCallable } from './firebase-functions.js';
import { waitForAppCheckReady } from './app-check.js';
import { isPlatformSuperAdmin } from './tenant-admin-auth.js';

const MODULE_DEFS = [
  { key: 'mhd', label: 'MHD' },
  { key: 'receiving', label: 'Wareneingang' },
  { key: 'kitchen', label: 'Wurstküche' },
  { key: 'cutting', label: 'Zerlegung / Avery 3475' },
  { key: 'haccp', label: 'HACCP' },
];

let provisionCallable = null;

function getProvisionCallable() {
  if (provisionCallable) return provisionCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  provisionCallable = createHttpsCallable('provisionDemoTenant', { timeout: 60000 }, firebaseApi);
  return provisionCallable;
}

function currentUser() {
  try {
    return firebase?.auth?.()?.currentUser || null;
  } catch {
    return null;
  }
}

function readModules(form) {
  const modules = {};
  MODULE_DEFS.forEach(({ key }) => {
    const input = form.querySelector(`[data-demo-mod="${key}"]`);
    modules[key] = input instanceof HTMLInputElement ? input.checked : false;
  });
  return modules;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function setStatus(root, message, tone = 'info') {
  const el = root.querySelector('[data-demo-onboarding-status]');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.tone = tone;
  el.hidden = !message;
}

function showResult(root, result) {
  const box = root.querySelector('[data-demo-onboarding-result]');
  const linkEl = root.querySelector('[data-demo-invite-link]');
  const metaEl = root.querySelector('[data-demo-onboarding-meta]');
  if (!box || !linkEl) return;
  box.hidden = false;
  linkEl.value = result.inviteLink || '';
  if (metaEl) {
    metaEl.textContent = `Mandant ${result.tenantId} · ${result.email}`;
  }
}

function bindForm(root) {
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const form = root.querySelector('[data-demo-onboarding-form]');
  const copyBtn = root.querySelector('[data-demo-copy-link]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const companyName = String(form.querySelector('[name="companyName"]')?.value || '').trim();
    const adminName = String(form.querySelector('[name="adminName"]')?.value || '').trim();
    const adminEmail = String(form.querySelector('[name="adminEmail"]')?.value || '').trim();

    if (!companyName || !adminName || !adminEmail) {
      setStatus(root, 'Bitte Betriebsname, Name und E-Mail ausfüllen.', 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setStatus(root, 'Lege Test-Mandant an…', 'info');
    const resultBox = root.querySelector('[data-demo-onboarding-result]');
    if (resultBox) resultBox.hidden = true;

    try {
      await waitForAppCheckReady();
      const callable = getProvisionCallable();
      if (!callable) {
        throw new Error('Cloud Functions nicht verfügbar. Bitte neu laden.');
      }
      const response = await callable({
        companyName,
        adminName,
        adminEmail,
        modules: readModules(form),
        continueUrl: `${window.location.origin}/`,
      });
      const data = response?.data || response || {};
      if (!data.success || !data.inviteLink) {
        throw new Error('Unerwartete Server-Antwort.');
      }
      showResult(root, data);
      setStatus(root, `Mandant „${data.tenantId}“ angelegt. Link kopieren und senden.`, 'success');
      window.showToast?.(`Demo-Mandant ${data.tenantId} bereit.`, 'success');
    } catch (err) {
      console.error('[demo-onboarding] provision failed:', err);
      const msg = err?.message || err?.details?.reason || 'Anlage fehlgeschlagen.';
      setStatus(root, msg, 'error');
      window.showToast?.('Test-Mandant konnte nicht angelegt werden.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  copyBtn?.addEventListener('click', async () => {
    const linkEl = root.querySelector('[data-demo-invite-link]');
    const link = String(linkEl?.value || '').trim();
    if (!link) return;
    try {
      const ok = await copyText(link);
      setStatus(root, ok ? 'Link in Zwischenablage kopiert.' : 'Kopieren fehlgeschlagen.', ok ? 'success' : 'error');
      if (ok) window.showToast?.('Einladungs-Link kopiert.', 'success');
    } catch (err) {
      setStatus(root, 'Kopieren fehlgeschlagen.', 'error');
    }
  });
}

export function syncDemoOnboardingVisibility() {
  const user = currentUser();
  const show = isPlatformSuperAdmin(user);
  document.querySelectorAll('[data-demo-onboarding-card]').forEach((card) => {
    card.hidden = !show;
    if (show) bindForm(card);
  });
}

export function initDemoTenantOnboarding() {
  syncDemoOnboardingVisibility();
  try {
    firebase?.auth?.()?.onAuthStateChanged(() => {
      syncDemoOnboardingVisibility();
    });
  } catch (_) {
    /* auth not ready */
  }
}

if (typeof window !== 'undefined') {
  window.initDemoTenantOnboarding = initDemoTenantOnboarding;
  window.syncDemoOnboardingVisibility = syncDemoOnboardingVisibility;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initDemoTenantOnboarding();
  }, { once: true });
} else {
  initDemoTenantOnboarding();
}
