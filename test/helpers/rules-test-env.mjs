/** Shared helpers for Firebase Security Rules emulator tests. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

export const TEST_PROJECT_ID = process.env.FIREBASE_EMULATOR_PROJECT_ID
  || process.env.GCLOUD_PROJECT
  || 'demo-charculogic-rules';

export const TENANTS = {
  TORFABRIK: 'torfabrik',
  STEVES_HOF: 'StevesHof_Hauptbetrieb',
};

const RULES_PATHS = {
  firestore: join(ROOT_DIR, 'firebase.rules'),
  storage: join(ROOT_DIR, 'storage.rules'),
};

/** Build Custom Claims payload matching production set-user-claims.mjs. */
export function buildClaims(tenantId, role) {
  const claims = { tenantId, role };
  if (role === 'admin') claims.isAdmin = true;
  return claims;
}

export async function createRulesTestEnvironment() {
  return initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATHS.firestore, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(RULES_PATHS.storage, 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
}

export function authContext(testEnv, uid, tenantId, role) {
  return testEnv.authenticatedContext(uid, buildClaims(tenantId, role));
}

export function tenantDocPath(tenantId, ...segments) {
  return ['tenants', tenantId, ...segments].join('/');
}

export async function resetEmulatorData(testEnv) {
  await Promise.all([
    testEnv.clearFirestore(),
    testEnv.clearStorage(),
  ]);
}

export async function seedFirestoreDoc(testEnv, docPath, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), docPath), data);
  });
}

export async function expectFirestoreAllow(ctx, docPath, operation, payload = {}) {
  const db = ctx.firestore();
  const ref = doc(db, docPath);

  if (operation === 'read') {
    await assertSucceeds(getDoc(ref));
    return;
  }
  if (operation === 'write' || operation === 'create') {
    await assertSucceeds(setDoc(ref, payload));
    return;
  }
  if (operation === 'update') {
    await assertSucceeds(updateDoc(ref, payload));
    return;
  }
  if (operation === 'delete') {
    await assertSucceeds(deleteDoc(ref));
    return;
  }
  if (operation === 'list') {
    const segments = docPath.split('/');
    const collectionPath = segments.slice(0, -1).join('/');
    await assertSucceeds(getDocs(collection(db, collectionPath)));
    return;
  }

  throw new Error(`Unknown operation: ${operation}`);
}

export async function expectFirestoreDeny(ctx, docPath, operation, payload = {}) {
  const db = ctx.firestore();
  const ref = doc(db, docPath);

  if (operation === 'read') {
    await assertFails(getDoc(ref));
    return;
  }
  if (operation === 'write' || operation === 'create') {
    await assertFails(setDoc(ref, payload));
    return;
  }
  if (operation === 'update') {
    await assertFails(updateDoc(ref, payload));
    return;
  }
  if (operation === 'delete') {
    await assertFails(deleteDoc(ref));
    return;
  }
  if (operation === 'list') {
    const segments = docPath.split('/');
    const collectionPath = segments.slice(0, -1).join('/');
    await assertFails(getDocs(collection(db, collectionPath)));
    return;
  }

  throw new Error(`Unknown operation: ${operation}`);
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

export async function expectStorageUploadAllow(ctx, objectPath, contentType = 'image/jpeg') {
  const storage = ctx.storage();
  const objectRef = ref(storage, objectPath);
  await assertSucceeds(uploadBytes(objectRef, JPEG_BYTES, { contentType }));
}

export async function expectStorageUploadDeny(ctx, objectPath, contentType = 'image/jpeg') {
  const storage = ctx.storage();
  const objectRef = ref(storage, objectPath);
  await assertFails(uploadBytes(objectRef, JPEG_BYTES, { contentType }));
}

export function sampleMhdItem(tenantId) {
  return {
    name: 'Emulator Test Artikel',
    qty: 1,
    tenantId,
  };
}

export function sampleInventoryItem(tenantId) {
  return {
    artikel: 'Emulator Test Ware',
    menge: 1,
    tenantId,
    source: 'rules-test',
    createdBy: 'rules-test',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export function sampleTask(tenantId, author = 'Tester') {
  return {
    title: 'Emulator Test Task',
    author,
    status: 'open',
    tenantId,
  };
}

export function sampleSettings(tenantId) {
  return {
    employees: ['Stephan'],
    groups: { team: { label: 'Team', members: ['Stephan'] } },
    tenantId,
    updatedBy: 'rules-test',
  };
}

/** Production path is bulletin/ (singular) – see web/teamboard.js */
export function bulletinObjectPath(tenantId, fileName = 'image.jpg') {
  return `tenants/${tenantId}/bulletin/${fileName}`;
}

export {
  assertFails,
  assertSucceeds,
};
