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

export function getRegionalFunctions(firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  if (!firebaseApi?.apps?.length) {
    throw new Error('Firebase App muss vor Functions-Aufrufen initialisiert sein.');
  }
  const expectedProjectId = resolveFunctionsProjectId();
  const app = firebaseApi.app();
  const activeProjectId = String(app.options?.projectId || '').trim();
  if (activeProjectId && activeProjectId !== expectedProjectId) {
    console.warn(
      '[CharcuLogic Functions] Projekt-Mismatch — '
      + `aktive App="${activeProjectId}", erwartet="${expectedProjectId}" `
      + `(${resolveFirebaseProjectKey()}). Callable-URL: ${resolveFunctionsBaseUrl(expectedProjectId)}`,
    );
  }
  return app.functions(FUNCTIONS_REGION);
}

export function createHttpsCallable(name, options = undefined, firebaseApi = typeof firebase !== 'undefined' ? firebase : null) {
  const regionalFunctions = getRegionalFunctions(firebaseApi);
  return options ? regionalFunctions.httpsCallable(name, options) : regionalFunctions.httpsCallable(name);
}
