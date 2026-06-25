/**
 * Localhost Firebase Emulator wiring (compat SDK).
 * Must run before any Auth / Firestore / Functions traffic.
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

let emulatorsAttached = false;

export function isLocalFirebaseEmulatorHost() {
  return isLocalDevHost();
}

export function attachLocalFirebaseEmulators(firebaseApi) {
  if (!isLocalFirebaseEmulatorHost() || emulatorsAttached) return false;
  if (!firebaseApi?.apps?.length) {
    throw new Error('Firebase App muss vor Emulator-Anbindung initialisiert sein.');
  }

  if (typeof firebaseApi.auth === 'function') {
    firebaseApi.auth().useEmulator(EMULATOR_AUTH_URL);
  }

  if (typeof firebaseApi.firestore === 'function') {
    firebaseApi.firestore().useEmulator(EMULATOR_FIRESTORE_HOST, EMULATOR_FIRESTORE_PORT);
  }

  try {
    firebaseApi.app().functions(FUNCTIONS_REGION).useEmulator(
      EMULATOR_FUNCTIONS_HOST,
      EMULATOR_FUNCTIONS_PORT,
    );
  } catch (_) {
    if (typeof firebaseApi.functions === 'function') {
      firebaseApi.functions().useEmulator(EMULATOR_FUNCTIONS_HOST, EMULATOR_FUNCTIONS_PORT);
    }
  }

  try {
    if (typeof firebaseApi.storage === 'function') {
      firebaseApi.storage().useEmulator(EMULATOR_STORAGE_HOST, EMULATOR_STORAGE_PORT);
    }
  } catch (_) { /* storage optional */ }

  emulatorsAttached = true;
  console.info(
    '[CharcuLogic Firebase] Emulator-Modus aktiv '
    + `(Auth ${EMULATOR_AUTH_URL}, Firestore ${EMULATOR_FIRESTORE_HOST}:${EMULATOR_FIRESTORE_PORT}).`,
  );
  return true;
}

export function areLocalFirebaseEmulatorsAttached() {
  return emulatorsAttached;
}
