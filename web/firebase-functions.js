/**
 * Cloud Functions – Region und Base-URL abhängig vom aktiven Firebase-Projekt.
 */
import { resolveFirebaseConfig, resolveFirebaseProjectKey } from './firebase-config.js';

export const FUNCTIONS_REGION = 'europe-west3';

export function resolveFunctionsProjectId() {
  return resolveFirebaseConfig().projectId;
}

export function resolveFunctionsBaseUrl(projectId = resolveFunctionsProjectId()) {
  const cleanProjectId = String(projectId || '').trim();
  if (!cleanProjectId) {
    throw new Error('Cloud-Functions-Projekt-ID fehlt.');
  }
  return `https://${FUNCTIONS_REGION}-${cleanProjectId}.cloudfunctions.net`;
}

/**
 * Compat-Äquivalent zu `getFunctions(getApp(), 'europe-west3')`.
 * Ohne Region fällt das SDK auf us-central1 zurück (NOT_FOUND / CORS).
 */
export function getRegionalFunctions(
  firebaseApi = typeof firebase !== 'undefined' ? firebase : null,
  region = FUNCTIONS_REGION,
) {
  if (!firebaseApi?.apps?.length) {
    throw new Error('Firebase App muss vor Functions-Aufrufen initialisiert sein.');
  }
  const expectedProjectId = resolveFunctionsProjectId();
  const app = typeof firebaseApi.app === 'function' ? firebaseApi.app() : firebaseApi.apps[0];
  const activeProjectId = String(app?.options?.projectId || '').trim();
  if (activeProjectId && expectedProjectId && activeProjectId !== expectedProjectId) {
    console.warn(
      '[CharcuLogic Functions] Projekt-Mismatch — '
      + `aktive App="${activeProjectId}", erwartet="${expectedProjectId}" `
      + `(${resolveFirebaseProjectKey()}). Callable-URL: ${resolveFunctionsBaseUrl(expectedProjectId)}`,
    );
  }

  const requestedRegion = String(region || FUNCTIONS_REGION).trim() || FUNCTIONS_REGION;

  // Compat-Äquivalent zu getFunctions(getApp(), 'europe-west3'):
  // firebase.app().functions('europe-west3'). firebase.functions(app) ohne Region
  // fällt auf us-central1 zurück (stumme NOT_FOUND / CORS).
  if (app && typeof app.functions === 'function') {
    try {
      const fromApp = app.functions(requestedRegion);
      if (fromApp && typeof fromApp.httpsCallable === 'function') {
        return fromApp;
      }
    } catch (err) {
      console.warn('[CharcuLogic Functions] app.functions(region) fehlgeschlagen:', requestedRegion, err);
    }
  }

  if (typeof firebaseApi.functions === 'function') {
    try {
      const viaNamespace = firebaseApi.functions(app, requestedRegion);
      if (viaNamespace && typeof viaNamespace.httpsCallable === 'function') {
        return viaNamespace;
      }
    } catch (_) { /* Namespace-Variante ohne explizite Region */ }
  }

  throw new Error('Firebase Functions SDK fehlt (httpsCallable).');
}

export function createHttpsCallable(
  name,
  options = undefined,
  firebaseApi = typeof firebase !== 'undefined' ? firebase : null,
  region = FUNCTIONS_REGION,
) {
  const regionalFunctions = getRegionalFunctions(firebaseApi, region);
  return options
    ? regionalFunctions.httpsCallable(name, options)
    : regionalFunctions.httpsCallable(name);
}
