/**
 * RBAC-Guard für den Mandanten-/Betriebs-Admin-Bereich (/dev-dashboard).
 *
 * Entspricht dem Hook useTenantAdminAuth(): prüft Rolle admin (Tenant-Admin)
 * bzw. Plattform-Super-Admin. Ohne Recht → Denied-/Login-Fallback (kein weißer Screen).
 */

export const TENANT_ADMIN_ROLE = 'admin';

export const PLATFORM_SUPER_ADMIN_EMAIL = 'patrik@charculogic.de';

export const PLATFORM_SUPER_ADMIN_UIDS = Object.freeze([
  'VYwMy5IAlAR26pj8ZbFfc5PNdou2',
]);

const FALLBACK_ROOT_ID = 'dev-dashboard-boot-fallback';

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isTenantAdminRoute(path = window.location?.pathname || '') {
  const clean = String(path || '');
  return clean === '/dev-dashboard' || clean.endsWith('/dev-dashboard');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fail-safe Root: App-Shell falls vorhanden, sonst document.body.
 * @returns {HTMLElement}
 */
export function resolveAdminFallbackRoot() {
  return (
    document.getElementById('page-dev-dashboard')
    || document.getElementById('app-content')
    || document.getElementById('app')
    || document.querySelector('.app-container')
    || document.body
    || document.documentElement
  );
}

function openLoginFromFallback() {
  try {
    window.__charculogicLoginPromptOpen = true;
    const boot = document.getElementById(FALLBACK_ROOT_ID);
    if (boot) {
      boot.hidden = true;
      boot.style.display = 'none';
    }
    const message = 'Mit Betriebs-Admin- oder Super-Admin-Konto anmelden.';
    if (typeof window.openAuthOverlay === 'function') {
      window.openAuthOverlay(message);
      return;
    }
    if (typeof window.promptLogin === 'function') {
      window.promptLogin(message);
      return;
    }
    window.dispatchEvent(new CustomEvent('charculogic:prompt-login'));
    // Auth-Modul ggf. noch nicht geladen → kurz pollen.
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (typeof window.promptLogin === 'function') {
        window.clearInterval(timer);
        window.promptLogin(message);
      } else if (tries >= 20) {
        window.clearInterval(timer);
        window.location.assign('/?login=1');
      }
    }, 150);
  } catch (_) {
    window.location.assign('/?login=1');
  }
}

/**
 * Globales Fallback-UI (auch wenn Dev-Dashboard-DOM fehlt / Module crashen).
 * @param {string} message
 * @param {boolean} [showLoginBtn=true]
 */
export function renderFallbackUI(message, showLoginBtn = true) {
  try {
    document.body?.classList.add('is-dev-dashboard');
    document.body?.classList.remove('dev-dashboard-view');
    document.body && (document.body.hidden = false);
    document.body?.removeAttribute('hidden');
    window.__charculogicDevDashboardReady = false;
  } catch (_) { /* noop */ }

  const safeMessage = escapeHtml(
    message || 'Bitte erst als Betriebs-Admin anmelden.',
  );
  const markup = `
    <div class="dev-dashboard-boot-fallback-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;box-sizing:border-box;">
      <h2 style="margin:0 0 12px;font-size:1.35rem;">Kein Zugriff</h2>
      <p style="color:#64748b;margin:0 0 20px;max-width:28rem;line-height:1.5;">${safeMessage}</p>
      <p style="color:#94a3b8;margin:0 0 16px;max-width:28rem;font-size:0.9rem;line-height:1.4;">Super-Admin und Betriebs-Admin melden sich mit E-Mail und Passwort an.</p>
      ${showLoginBtn ? '<button type="button" id="fallback-login-btn" style="padding:12px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;min-height:46px;">Anmelden</button>' : ''}
      <button type="button" id="fallback-home-btn" style="margin-top:10px;padding:10px 18px;background:transparent;color:#334155;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;min-height:42px;">Zurück zur App</button>
    </div>
  `;

  let host = document.getElementById(FALLBACK_ROOT_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = FALLBACK_ROOT_ID;
    host.setAttribute('role', 'alert');
  }
  host.hidden = false;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:block;background:#f8fafc;';
  host.innerHTML = markup;

  if (!host.isConnected) {
    try {
      document.body.appendChild(host);
    } catch (_) {
      try {
        resolveAdminFallbackRoot().appendChild(host);
      } catch (err) {
        console.error('[Tenant-Admin] Fallback-UI konnte nicht gemountet werden:', err);
      }
    }
  }

  document.getElementById('fallback-login-btn')?.addEventListener('click', () => {
    openLoginFromFallback();
  });
  document.getElementById('fallback-home-btn')?.addEventListener('click', () => {
    leaveDevDashboardToPhoneApp();
  });

  return host;
}

/** Zurück in die Laden-App — bevorzugt wieder die Smartphone-Simulation. */
export function leaveDevDashboardToPhoneApp() {
  window.__charculogicLoginPromptOpen = false;
  window.__charculogicDevDashboardReady = false;
  try {
    sessionStorage.setItem('charculogic_prefer_phone_shell', '1');
  } catch (_) { /* noop */ }
  try {
    document.body?.classList.remove(
      'is-dev-dashboard',
      'dev-dashboard-view',
      'desktop-wide-layout',
      'app-shell-sidebar',
      'has-admin-nav',
      'auth-lock-open',
    );
    document.body && (document.body.hidden = false);
    document.body?.removeAttribute('hidden');
  } catch (_) { /* noop */ }
  window.location.replace('/');
}

export function clearAdminFallbackUI(options = {}) {
  // Sticky: nicht entfernen, solange das Dashboard nicht erfolgreich gemountet ist.
  if (!options.force && !window.__charculogicDevDashboardReady) return;
  document.getElementById(FALLBACK_ROOT_ID)?.remove();
}

/**
 * @param {{ email?: string, uid?: string }|null|undefined} user
 * @returns {boolean}
 */
export function isPlatformSuperAdmin(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (email && email === PLATFORM_SUPER_ADMIN_EMAIL) return true;
  const uid = String(user?.uid || '').trim();
  return Boolean(uid && PLATFORM_SUPER_ADMIN_UIDS.includes(uid));
}

/**
 * Tenant-Admin = Claim-Rolle admin / isAdmin, oder Plattform-Super-Admin.
 * @param {{ email?: string, uid?: string }|null|undefined} user
 * @param {{ role?: string, isAdmin?: boolean, tenantId?: string }|null|undefined} authContext
 * @returns {boolean}
 */
export function isTenantAdmin(user, authContext = null) {
  if (authContext?.role === TENANT_ADMIN_ROLE || authContext?.isAdmin === true) return true;
  return isPlatformSuperAdmin(user);
}

/**
 * Guard / „Hook“ für den Admin-Bereich.
 *
 * @param {Object} [options]
 * @param {{ email?: string, uid?: string }|null} [options.user]
 * @param {{ role?: string, isAdmin?: boolean, tenantId?: string }|null} [options.authContext]
 * @param {boolean} [options.redirect=true] Bei false nur prüfen, nicht umleiten
 * @param {string} [options.redirectTo='/'] Ziel analog /dashboard → Haupt-App
 * @param {boolean} [options.requireRoute=true] Redirect nur auf /dev-dashboard
 * @param {boolean} [options.renderFallback=true] Denied-UI bei fehlendem Zugriff
 * @returns {{ allowed: boolean, role: string, tenantId: string, isSuperAdmin: boolean, needsLogin: boolean }}
 */
export function useTenantAdminAuth({
  user = null,
  authContext = null,
  redirect = true,
  redirectTo = '/',
  requireRoute = true,
  renderFallback = true,
} = {}) {
  try {
    const needsLogin = !user?.uid;
    let allowed = false;
    let isSuperAdmin = false;
    try {
      allowed = !needsLogin && isTenantAdmin(user, authContext);
      isSuperAdmin = isPlatformSuperAdmin(user);
    } catch (err) {
      console.error('[Tenant-Admin] Rollenprüfung fehlgeschlagen:', err);
      if (renderFallback && isTenantAdminRoute()) {
        renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
      }
      return {
        allowed: false,
        role: '',
        tenantId: String(authContext?.tenantId || ''),
        isSuperAdmin: false,
        needsLogin: true,
      };
    }

    const result = {
      allowed,
      role: String(authContext?.role || ''),
      tenantId: String(authContext?.tenantId || ''),
      isSuperAdmin,
      needsLogin,
    };

    if (allowed || !redirect) return result;

    const onAdminRoute = !requireRoute || isTenantAdminRoute();
    if (!onAdminRoute) return result;

    if (needsLogin) {
      if (renderFallback) {
        renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
      }
      return result;
    }

    if (renderFallback) {
      renderFallbackUI('Dieser Bereich ist nur für Betriebs-Admins.');
    }

    try {
      sessionStorage.setItem(
        'charculogic_post_redirect_toast',
        JSON.stringify({
          message: 'Die Verwaltung ist nur für Betriebs-Admins.',
          type: 'warning',
        }),
      );
    } catch (_) { /* noop */ }

    try {
      window.location.replace(redirectTo || '/');
    } catch (_) {
      window.location.href = redirectTo || '/';
    }

    return result;
  } catch (err) {
    console.error('[Tenant-Admin] useTenantAdminAuth fehlgeschlagen:', err);
    if (renderFallback && isTenantAdminRoute()) {
      renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
    }
    return {
      allowed: false,
      role: '',
      tenantId: '',
      isSuperAdmin: false,
      needsLogin: true,
    };
  }
}

/**
 * Zeigt ggf. Toast nach Redirect vom Admin-Guard.
 */
export function consumeTenantAdminRedirectToast() {
  try {
    const raw = sessionStorage.getItem('charculogic_post_redirect_toast');
    if (!raw) return;
    sessionStorage.removeItem('charculogic_post_redirect_toast');
    const payload = JSON.parse(raw);
    const message = String(payload?.message || '').trim();
    if (!message) return;
    window.showToast?.(message, payload?.type || 'warning');
  } catch (_) { /* noop */ }
}

/**
 * Sichtbarkeit der Verwaltungs-Navigation (Sidebar / Bottom-Nav-Zone).
 * @param {HTMLElement|null} zoneEl
 * @param {boolean} show
 */
export function applyTenantAdminNavVisibility(zoneEl, show) {
  if (!zoneEl) return;
  zoneEl.hidden = !show;
  zoneEl.style.display = show ? '' : 'none';
  document.body.classList.toggle('has-admin-nav', Boolean(show));
}

/** Einmalige Error-Listener für Direktaufruf /dev-dashboard (Modul-Crash → Fallback statt Weiß). */
export function installTenantAdminBootGuards() {
  if (!isTenantAdminRoute() || window.__charculogicAdminBootGuards) return;
  window.__charculogicAdminBootGuards = true;
  window.__charculogicDevDashboardReady = false;

  const showBootFallback = (reason) => {
    if (window.__charculogicDevDashboardReady) return;
    console.error('[Tenant-Admin] Boot-Guard:', reason);
    renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
  };

  window.addEventListener('error', (event) => {
    if (!isTenantAdminRoute() || window.__charculogicDevDashboardReady) return;
    // Ressourcen-/Script-404s und ResizeObserver-Rauschen ignorieren
    const msg = String(event?.message || event?.error?.message || '');
    if (/ResizeObserver|Loading chunk|Script error\.?$/i.test(msg)) return;
    showBootFallback(event?.error || event?.message || 'uncaught-error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (!isTenantAdminRoute() || window.__charculogicDevDashboardReady) return;
    showBootFallback(event?.reason || 'unhandledrejection');
  });
}

if (typeof window !== 'undefined' && isTenantAdminRoute()) {
  try {
    installTenantAdminBootGuards();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
      }, { once: true });
    } else {
      renderFallbackUI('Bitte erst als Betriebs-Admin anmelden.');
    }
  } catch (err) {
    console.error('[Tenant-Admin] Sofort-Fallback fehlgeschlagen:', err);
  }
}
