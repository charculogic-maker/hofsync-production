/**
 * RBAC-Guard für den Mandanten-/Betriebs-Admin-Bereich (/dev-dashboard).
 *
 * Entspricht dem Hook useTenantAdminAuth(): prüft Rolle admin (Tenant-Admin)
 * bzw. Plattform-Super-Admin. Ohne Recht → Weiterleitung zur Haupt-App (/).
 */

export const TENANT_ADMIN_ROLE = 'admin';

export const PLATFORM_SUPER_ADMIN_EMAIL = 'patrik@charculogic.de';

export const PLATFORM_SUPER_ADMIN_UIDS = Object.freeze([
  'VYwMy5IAlAR26pj8ZbFfc5PNdou2',
]);

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isTenantAdminRoute(path = window.location?.pathname || '') {
  const clean = String(path || '');
  return clean === '/dev-dashboard' || clean.endsWith('/dev-dashboard');
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
 * @returns {{ allowed: boolean, role: string, tenantId: string, isSuperAdmin: boolean }}
 */
export function useTenantAdminAuth({
  user = null,
  authContext = null,
  redirect = true,
  redirectTo = '/',
  requireRoute = true,
} = {}) {
  const allowed = isTenantAdmin(user, authContext);
  const isSuperAdmin = isPlatformSuperAdmin(user);
  const result = {
    allowed,
    role: String(authContext?.role || ''),
    tenantId: String(authContext?.tenantId || ''),
    isSuperAdmin,
  };

  if (allowed || !redirect) return result;

  const onAdminRoute = !requireRoute || isTenantAdminRoute();
  if (!onAdminRoute) return result;

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
