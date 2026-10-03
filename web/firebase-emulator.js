/**
 * Localhost Firebase Emulator wiring (compat SDK).
 * Must run before any Auth / Firestore / Functions traffic.
 *
 * Opt-in only (never auto-attach on plain localhost):
 *   - window.USE_EMULATORS === true
 *   - ?emulators=1 / ?useEmulators=true (persists to localStorage)
 *   - localStorage charculogic_use_emulators=1
 *
 * Disable: window.USE_EMULATORS = false, or ?emulators=0
 */
import { isLocalDevHost } from './dev-guards.js';
import { FUNCTIONS_REGION } from './firebase-functions.js';

const EMULATOR_AUTH_URL = 'http://127.0.0.1:9099';
const EMULATOR_FIRESTORE_HOST = '127.0.0.1';
const EMULATOR_FIRESTORE_PORT = 8080;
const EMULATOR_FUNCTIONS_HOST = '127.0.0.1';
const EMULATOR_FUNCTIONS_PORT = 5001;
const EMULATOR_STORAGE_HOST = '127.0.0.1';
const EMULATOR_STORAGE_PORT = 9199;
const EMULATOR_STORAGE_KEY = 'charculogic_use_emulators';

/**
 * TEMP (UI gegen Staging): Emulator-Anbindung komplett aus.
 * Auf true setzen, um Auth/Firestore-Emulatoren wieder zuzulassen.
 */
const ENABLE_FIREBASE_EMULATORS = false;

let emulatorsAttached = false;

export function isLocalFirebaseEmulatorHost() {
  return isLocalDevHost();
}

/**
 * Explizites Opt-in für Emulatoren — localhost allein reicht nicht.
 * @returns {boolean}
 */
export function shouldUseFirebaseEmulators() {
  // TEMP: Live-Staging auch auf localhost — keine useEmulator()-Calls.
  if (!ENABLE_FIREBASE_EMULATORS) return false;

  if (!isLocalFirebaseEmulatorHost()) return false;
  if (typeof window === 'undefined') return false;

  if (window.USE_EMULATORS === false) return false;
  if (window.USE_EMULATORS === true) return true;

  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('emulators') || params.get('useEmulators');
    if (raw === '1' || raw === 'true') {
      try { localStorage.setItem(EMULATOR_STORAGE_KEY, '1'); } catch (_) { /* noop */ }
      return true;
    }
    if (raw === '0' || raw === 'false') {
      try { localStorage.removeItem(EMULATOR_STORAGE_KEY); } catch (_) { /* noop */ }
      return false;
    }
  } catch (_) { /* noop */ }

  try {
    return localStorage.getItem(EMULATOR_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function tryUseAuthEmulator(firebaseApi) {
  if (typeof firebaseApi.auth !== 'function') return false;
  try {
    firebaseApi.auth().useEmulator(EMULATOR_AUTH_URL);
    return true;
  } catch (err) {
    console.warn(
      '[CharcuLogic Firebase] Auth-Emulator nicht erreichbar/anbindbar — Live-Auth bleibt aktiv.',
      err?.message || err,
    );
    return false;
  }
}

function tryUseFirestoreEmulator(firebaseApi) {
  if (typeof firebaseApi.firestore !== 'function') return false;
  try {
    firebaseApi.firestore().useEmulator(EMULATOR_FIRESTORE_HOST, EMULATOR_FIRESTORE_PORT);
    return true;
  } catch (err) {
    console.warn(
      '[CharcuLogic Firebase] Firestore-Emulator nicht erreichbar/anbindbar — Live-Firestore bleibt aktiv.',
      err?.message || err,
    );
    return false;
  }
}

function tryUseFunctionsEmulator(firebaseApi) {
  try {
    firebaseApi.app().functions(FUNCTIONS_REGION).useEmulator(
      EMULATOR_FUNCTIONS_HOST,
      EMULATOR_FUNCTIONS_PORT,
    );
    return true;
  } catch (primaryErr) {
    try {
      if (typeof firebaseApi.functions === 'function') {
        firebaseApi.functions().useEmulator(EMULATOR_FUNCTIONS_HOST, EMULATOR_FUNCTIONS_PORT);
        return true;
      }
    } catch (fallbackErr) {
      console.warn(
        '[CharcuLogic Firebase] Functions-Emulator übersprungen — Live-Functions bleiben aktiv.',
        fallbackErr?.message || primaryErr?.message || primaryErr,
      );
    }
    return false;
  }
}

function tryUseStorageEmulator(firebaseApi) {
  try {
    if (typeof firebaseApi.storage === 'function') {
      firebaseApi.storage().useEmulator(EMULATOR_STORAGE_HOST, EMULATOR_STORAGE_PORT);
      return true;
    }
  } catch (err) {
    console.warn(
      '[CharcuLogic Firebase] Storage-Emulator übersprungen.',
      err?.message || err,
    );
  }
  return false;
}

/**
 * Bindet Emulatoren nur bei lokalem Opt-in. Fehler pro Service → kein Hard-Fail,
 * damit ohne laufende Ports 9099/8080 weiterhin Live-Firebase genutzt werden kann.
 * @param {typeof firebase} firebaseApi
 * @returns {boolean} true wenn Auth+Firestore erfolgreich angebunden
 */
export function attachLocalFirebaseEmulators(firebaseApi) {
  if (!shouldUseFirebaseEmulators() || emulatorsAttached) return false;
  if (!firebaseApi?.apps?.length) {
    throw new Error('Firebase App muss vor Emulator-Anbindung initialisiert sein.');
  }

  const authOk = tryUseAuthEmulator(firebaseApi);
  const firestoreOk = tryUseFirestoreEmulator(firebaseApi);

  // Functions/Storage sind optional — Fehler blockieren den Boot nicht.
  if (authOk || firestoreOk) {
    tryUseFunctionsEmulator(firebaseApi);
    tryUseStorageEmulator(firebaseApi);
  }

  if (authOk && firestoreOk) {
    emulatorsAttached = true;
    console.info(
      '[CharcuLogic Firebase] Emulator-Modus aktiv '
      + `(Auth ${EMULATOR_AUTH_URL}, Firestore ${EMULATOR_FIRESTORE_HOST}:${EMULATOR_FIRESTORE_PORT}).`,
    );
    return true;
  }

  console.warn(
    '[CharcuLogic Firebase] Emulator-Opt-in gesetzt, aber Auth/Firestore-Emulator nicht angebunden. '
    + 'Weiter mit Live-Firebase. Tipp: Emulatoren starten oder Opt-in entfernen '
    + '(?emulators=0 / localStorage charculogic_use_emulators).',
  );
  return false;
}

export function areLocalFirebaseEmulatorsAttached() {
  return emulatorsAttached;
}
