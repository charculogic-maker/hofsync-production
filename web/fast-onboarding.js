/**
 * Fast-Onboarding: Test-Mandant anlegen + Einladungs-Link (provisionDemoTenant).
 * Sichtbar für Büro-Admins (isOfficeUser) in #page-batches und im Dev-Dashboard.
 */
import { createHttpsCallable, resolveFunctionsBaseUrl } from './firebase-functions.js';
import { isAppCheckInitialized, isRecaptchaAppCheckError, waitForAppCheckReady } from './app-check.js';
import { getAuthContext, isOfficeUser } from './auth.js';

const MODULE_DEFS = [
  { key: 'mhdMonitor', label: 'MHD-Monitor' },
  { key: 'wareneingang', label: 'Wareneingang & KI-Lieferschein' },
  { key: 'wurstkueche', label: 'Wurstküche & BEFFE-Kalkulation' },
  { key: 'haccp', label: 'HACCP-Tageskontrollen' },
  { key: 'zerlegung', label: 'Galloway-Zerlegung & Avery 3475 Etiketten' },
];

let provisionCallable = null;

function getProvisionCallable() {
  if (provisionCallable) return provisionCallable;
  const firebaseApi = typeof firebase !== 'undefined' ? firebase : null;
  if (!firebaseApi?.apps?.length) return null;
  provisionCallable = createHttpsCallable('provisionDemoTenant', { timeout: 60000 }, firebaseApi);
  return provisionCallable;
}

function readAppCheckService() {
  try {
    if (typeof firebase === 'undefined' || typeof firebase.appCheck !== 'function') return null;
    if (!firebase.apps?.length) return null;
    return firebase.appCheck();
  } catch {
    return null;
  }
}

/**
 * httpsCallable holt selbst ein App-Check-Token und bricht bei recaptcha-error ab.
 * Für provisionDemoTenant ist das Token optional: bei Fehler liefert getToken
 * `{ error }`, damit der Functions-Client den Header weglässt.
 */
async function invokeProvisionCallable(payload) {
  const callable = getProvisionCallable();
  if (!callable) {
    throw new Error('Cloud Functions nicht verfügbar. Bitte neu laden.');
  }

  const appCheck = readAppCheckService();
  const originalGetToken = appCheck && typeof appCheck.getToken === 'function'
    ? appCheck.getToken.bind(appCheck)
    : null;

  if (appCheck && originalGetToken) {
    appCheck.getToken = async (...args) => {
      try {
        return await originalGetToken(...args);
      } catch (err) {
        if (!isRecaptchaAppCheckError(err)) throw err;
        console.warn('[fast-onboarding] App Check Token übersprungen, Callable läuft ohne Token.');
        return { token: '', error: err };
      }
    };
  }

  try {
    return await callable(payload);
  } catch (err) {
    if (!isRecaptchaAppCheckError(err)) throw err;
    console.warn('[fast-onboarding] Callable ohne App-Check-Token wiederholt.');
    return postProvisionWithoutAppCheck(payload);
  } finally {
    if (appCheck && originalGetToken) appCheck.getToken = originalGetToken;
  }
}

async function postProvisionWithoutAppCheck(payload) {
  const user = typeof firebase !== 'undefined' ? firebase.auth?.().currentUser : null;
  if (!user) {
    const err = new Error('Bitte zuerst anmelden.');
    err.code = 'functions/unauthenticated';
    throw err;
  }
  const idToken = await user.getIdToken();
  const response = await fetch(`${resolveFunctionsBaseUrl()}/provisionDemoTenant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: payload }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.error) {
    const status = String(json?.error?.status || '').toLowerCase().replace(/_/g, '-');
    const err = new Error(json?.error?.message || 'Fehler beim Anlegen des Test-Mandanten');
    err.code = status ? `functions/${status}` : 'functions/internal';
    err.details = json?.error?.details;
    throw err;
  }
  return { data: json?.data ?? json?.result };
}

async function callProvisionDemoTenant(payload) {
  try {
    await waitForAppCheckReady();
  } catch (err) {
    console.warn('[fast-onboarding] App Check nicht bereit, Callable startet trotzdem.', err?.code || err?.message || err);
  }

  if (!isAppCheckInitialized()) {
    console.warn('[fast-onboarding] App Check nicht initialisiert, Callable startet ohne Token.');
    return postProvisionWithoutAppCheck(payload);
  }

  const appCheck = readAppCheckService();
  if (appCheck && typeof appCheck.getToken === 'function') {
    const tokenPromise = appCheck.getToken(false);
    tokenPromise.catch(() => {});
    let timer;
    try {
      await Promise.race([
        tokenPromise,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const err = new Error('reCAPTCHA timeout');
            err.code = 'app-check/recaptcha-error';
            reject(err);
          }, 4000);
        }),
      ]);
    } catch (err) {
      console.warn(
        '[fast-onboarding] reCAPTCHA/App Check übersprungen, Callable startet ohne Token.',
        err?.code || err?.message || err,
      );
      return postProvisionWithoutAppCheck(payload);
    } finally {
      clearTimeout(timer);
    }
  }

  return invokeProvisionCallable(payload);
}

function readModules(form) {
  const modules = {};
  MODULE_DEFS.forEach(({ key }) => {
    const input = form.querySelector(`[data-fast-mod="${key}"]`);
    modules[key] = input instanceof HTMLInputElement ? input.checked : false;
  });
  return modules;
}

function detailText(err) {
  const details = err?.details ?? err?.customData;
  if (typeof details === 'string') return details.trim();
  if (details && typeof details === 'object') {
    return String(details.reason || details.message || '').trim();
  }
  return '';
}

function isGenericInternal(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text === 'internal' || text === 'firebaseerror: internal';
}

function friendlyCallableError(err) {
  const code = String(err?.code || '').replace(/^functions\//, '');
  const message = [detailText(err), String(err?.message || '').trim()].find((part) => !isGenericInternal(part)) || '';
  if (code === 'permission-denied' || /permission|Admin|Plattform/i.test(message)) {
    return 'Keine Berechtigung: Nur Plattform-Admins dürfen Test-Mandanten anlegen.';
  }
  if (code === 'already-exists' || /existiert bereits|already/i.test(message)) {
    return message || 'Dieser Betrieb oder diese E-Mail existiert bereits.';
  }
  if (code === 'invalid-argument' || /E-Mail|ungültig|erforderlich/i.test(message)) {
    return message || 'Bitte Eingaben prüfen (Betriebsname, Name, E-Mail).';
  }
  if (code === 'unauthenticated') {
    return 'Bitte zuerst anmelden.';
  }
  return message || 'Fehler beim Anlegen des Test-Mandanten';
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
  const el = root.querySelector('[data-fast-onboarding-status]');
  if (!el) return;
  el.textContent = message || '';
  el.dataset.tone = tone;
  el.hidden = !message;
}

function setSubmitting(root, busy) {
  const btn = root.querySelector('[data-fast-submit]');
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle('is-loading', busy);
  const label = btn.querySelector('[data-fast-submit-label]');
  if (label) {
    label.textContent = busy ? 'Wird erstellt…' : '⚡ Test-Mandant jetzt erstellen';
  }
}

function showResult(root, result, formValues) {
  const form = root.querySelector('[data-fast-onboarding-form]');
  const box = root.querySelector('[data-fast-onboarding-result]');
  const tenantEl = root.querySelector('[data-fast-tenant-id]');
  const linkEl = root.querySelector('[data-fast-invite-link]');
  const metaEl = root.querySelector('[data-fast-onboarding-meta]');
  if (form) form.hidden = true;
  if (!box || !linkEl) return;
  box.hidden = false;
  if (tenantEl) tenantEl.textContent = result.tenantId || '—';
  linkEl.value = result.inviteLink || '';
  if (metaEl) {
    metaEl.textContent = `${formValues.adminName || result.adminName || ''} · ${result.email || formValues.adminEmail || ''}`;
  }
  root.dataset.lastCompany = formValues.companyName || result.companyName || '';
  root.dataset.lastAdminName = formValues.adminName || result.adminName || '';
  root.dataset.lastInvite = result.inviteLink || '';
}

function resetCard(root) {
  const form = root.querySelector('[data-fast-onboarding-form]');
  const box = root.querySelector('[data-fast-onboarding-result]');
  if (form instanceof HTMLFormElement) {
    form.reset();
    MODULE_DEFS.forEach(({ key }) => {
      const input = form.querySelector(`[data-fast-mod="${key}"]`);
      if (input instanceof HTMLInputElement) input.checked = true;
    });
    form.hidden = false;
  }
  if (box) box.hidden = true;
  setStatus(root, '');
  delete root.dataset.lastCompany;
  delete root.dataset.lastAdminName;
  delete root.dataset.lastInvite;
}

function bindForm(root) {
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const form = root.querySelector('[data-fast-onboarding-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const companyName = String(form.querySelector('[name="companyName"]')?.value || '').trim();
    const adminName = String(form.querySelector('[name="adminName"]')?.value || '').trim();
    const adminEmail = String(form.querySelector('[name="adminEmail"]')?.value || '').trim();

    if (!companyName || !adminName || !adminEmail) {
      setStatus(root, 'Bitte Betriebsname, Inhaber und E-Mail ausfüllen.', 'error');
      return;
    }

    setSubmitting(root, true);
    setStatus(root, 'Lege Test-Mandant an…', 'info');
    const resultBox = root.querySelector('[data-fast-onboarding-result]');
    if (resultBox) resultBox.hidden = true;

    try {
      const response = await callProvisionDemoTenant({
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
      showResult(root, data, { companyName, adminName, adminEmail });
      setStatus(root, `Mandant „${data.tenantId}“ angelegt.`, 'success');
      window.showToast?.(`Test-Mandant ${data.tenantId} bereit.`, 'success');
    } catch (err) {
      console.error('[fast-onboarding] provision failed:', err);
      const payloadText = [detailText(err), String(err?.message || '').trim()]
        .find((part) => !isGenericInternal(part));
      const msg = payloadText || friendlyCallableError(err) || 'Fehler beim Anlegen des Test-Mandanten';
      setStatus(root, msg, 'error');
      window.showToast?.(msg, 'error');
    } finally {
      setSubmitting(root, false);
    }
  });

  root.querySelector('[data-fast-copy-link]')?.addEventListener('click', async () => {
    const link = String(root.querySelector('[data-fast-invite-link]')?.value || root.dataset.lastInvite || '').trim();
    if (!link) return;
    try {
      const ok = await copyText(link);
      if (ok) {
        setStatus(root, 'Link in Zwischenablage kopiert!', 'success');
        window.showToast?.('Link in Zwischenablage kopiert!', 'success');
      } else {
        setStatus(root, 'Kopieren fehlgeschlagen.', 'error');
      }
    } catch {
      setStatus(root, 'Kopieren fehlgeschlagen.', 'error');
    }
  });

  root.querySelector('[data-fast-whatsapp]')?.addEventListener('click', () => {
    const link = String(root.querySelector('[data-fast-invite-link]')?.value || root.dataset.lastInvite || '').trim();
    const adminName = root.dataset.lastAdminName || 'Kollege';
    const companyName = root.dataset.lastCompany || 'euren Betrieb';
    if (!link) return;
    const text = `Hallo ${adminName}, hier ist dein Zugang zu CharcuLogic / HofSync für ${companyName}: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  });

  root.querySelector('[data-fast-reset]')?.addEventListener('click', () => {
    resetCard(root);
  });
}

export function syncFastOnboardingVisibility() {
  const show = isOfficeUser(getAuthContext());
  document.querySelectorAll('[data-fast-onboarding-card]').forEach((card) => {
    card.hidden = !show;
    if (show) bindForm(card);
  });
}

export function initFastOnboarding() {
  syncFastOnboardingVisibility();
  try {
    firebase?.auth?.()?.onAuthStateChanged(() => {
      syncFastOnboardingVisibility();
    });
  } catch (_) {
    /* auth not ready */
  }
  window.addEventListener('charculogic:auth-changed', () => {
    syncFastOnboardingVisibility();
  });
}

if (typeof window !== 'undefined') {
  window.initFastOnboarding = initFastOnboarding;
  window.syncFastOnboardingVisibility = syncFastOnboardingVisibility;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initFastOnboarding();
  }, { once: true });
} else {
  initFastOnboarding();
}
