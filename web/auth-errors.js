/**
 * Reine Auth-Fehlertexte — ohne DOM, damit sie lokal und in der UI gleich laufen.
 */

function combinedAuthText(err) {
  return `${err?.code || ''} ${err?.message || err || ''}`.toLowerCase();
}

export function isReferrerBlockedError(err) {
  const text = combinedAuthText(err);
  return text.includes('referer')
    || text.includes('referrer')
    || text.includes('api_key_http_referrer_blocked')
    || text.includes('unauthorized_domain')
    || text.includes('unauthorized domain')
    || String(err?.code || '') === 'auth/unauthorized-domain';
}

export function describeAuthError(err, hostname = '') {
  const code = String(err?.code || '');
  const message = String(err?.message || err || '').trim();
  const host = String(hostname || '').trim();

  if (isReferrerBlockedError(err)) {
    const hostHint = host ? ` (${host})` : '';
    return `Domain nicht autorisiert${hostHint}. `
      + 'Diese Website ist in Firebase Auth eingetragen, der API-Key blockiert den HTTP-Referrer aber noch. '
      + 'Bitte in Google Cloud → API-Schlüssel die HTTP-Referrer '
      + 'https://hofsync.vercel.app/* und https://*.vercel.app/* ergänzen.';
  }

  if (code === 'auth/user-not-found' || /email_not_found|user-not-found/.test(combinedAuthText(err))) {
    return 'Nutzer nicht gefunden. Bitte E-Mail prüfen oder im Büro ein Konto anlegen lassen.';
  }
  if (code === 'auth/wrong-password') {
    return 'Falsches Passwort.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || combinedAuthText(err).includes('invalid_login_credentials')) {
    return 'E-Mail oder Passwort ist falsch.';
  }
  if (code === 'auth/invalid-email') {
    return 'Die E-Mail-Adresse ist ungültig.';
  }
  if (code === 'auth/user-disabled') {
    return 'Dieses Konto ist deaktiviert. Bitte im Büro Bescheid geben.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Zu viele Anmeldeversuche. Bitte kurz warten und erneut versuchen.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Netzwerkfehler. Bitte Verbindung prüfen und erneut versuchen.';
  }
  if (code === 'auth/invalid-custom-token' || code === 'auth/custom-token-mismatch') {
    return 'Geräte-Zugangscode ist ungültig oder abgelaufen.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'E-Mail/Passwort-Login ist in diesem Firebase-Projekt nicht aktiviert.';
  }
  if (message.includes('Mandant') || message.includes('vollständig eingerichtet')) {
    return message;
  }
  if (message.includes('E-Mail und Passwort sind erforderlich') || message.includes('Zugangscode fehlt')) {
    return message;
  }
  if (message) return message;
  return 'Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.';
}

export function logAuthFailure(context, err, config = {}) {
  console.warn(`[CharcuLogic Auth] ${context}`, {
    host: typeof window !== 'undefined' ? window.location?.hostname : null,
    origin: typeof window !== 'undefined' ? window.location?.origin : null,
    projectId: config.projectId || null,
    authDomain: config.authDomain || null,
    apiKeyPrefix: config.apiKey ? String(config.apiKey).slice(0, 8) : null,
    code: err?.code || null,
    message: err?.message || String(err || ''),
  });
}
