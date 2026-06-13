import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function createElementStub() {
  const classes = new Set();
  return {
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    appendChild: () => {},
    addEventListener: () => {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
}

function installBrowserGlobals() {
  const elements = {
    'auth-lock-screen': createElementStub(),
    'auth-login-error': createElementStub(),
    'auth-login-form': createElementStub(),
    'auth-token-form': createElementStub(),
  };
  const storage = new Map();
  const dispatchedEvents = [];

  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.window = {
    location: { hostname: 'localhost' },
    applyResolvedBranding: () => {},
    dispatchEvent: (event) => {
      dispatchedEvents.push(event);
      return true;
    },
    showToast: () => {},
  };
  globalThis.document = {
    documentElement: { dataset: {} },
    body: { appendChild: () => {} },
    head: { appendChild: () => {} },
    createElement: () => createElementStub(),
    getElementById: (id) => elements[id] || null,
  };

  return { dispatchedEvents, elements, storage };
}

function createUser(uid, email, tenantId, role) {
  return {
    uid,
    email,
    getIdToken: async () => 'token',
    getIdTokenResult: async () => ({
      claims: {
        tenantId,
        role,
        isAdmin: role === 'admin',
      },
    }),
  };
}

function createFirestoreStub() {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false, data: () => ({}) }),
      }),
    }),
  };
}

function createFirebaseAuthStub(initialUser) {
  let authStateHandler = async () => {};
  const authApi = {
    currentUser: initialUser,
    nextSignInUser: initialUser,
    setPersistence: async () => {},
    onAuthStateChanged: (handler) => {
      authStateHandler = handler;
      return () => {};
    },
    signInWithEmailAndPassword: async () => {
      authApi.currentUser = authApi.nextSignInUser;
      await authStateHandler(authApi.currentUser);
      return { user: authApi.currentUser };
    },
    updateCurrentUser: async (user) => {
      authApi.currentUser = user;
      await authStateHandler(user);
    },
    signOut: async () => {
      authApi.currentUser = null;
      await authStateHandler(null);
    },
  };
  const authFn = () => authApi;
  authFn.Auth = { Persistence: { LOCAL: 'LOCAL' } };

  return {
    authApi,
    firebase: { auth: authFn },
    emitAuthState: (user) => authStateHandler(user),
  };
}

test('Buro login rejection restores the previous tenant session', async () => {
  const { dispatchedEvents } = installBrowserGlobals();
  const terminalUser = createUser('terminal', 'terminal@example.test', 'StevesHof_Hauptbetrieb', 'helper');
  const employeeUser = createUser('employee', 'employee@example.test', 'torfabrik', 'employee');
  const { authApi, firebase, emitAuthState } = createFirebaseAuthStub(terminalUser);
  const authModule = await import('../web/auth.js?office-rollback');

  const ready = authModule.initAuthModule(firebase, createFirestoreStub(), { showHUD: () => {} });
  await emitAuthState(terminalUser);
  await ready;
  assert.equal(authModule.getAuthContext().tenantId, 'StevesHof_Hauptbetrieb');

  authApi.nextSignInUser = employeeUser;
  await assert.rejects(
    () => authModule.loginOfficeTenant('employee@example.test', 'pw'),
    { code: 'auth/not-office-user' },
  );

  assert.equal(authApi.currentUser.uid, 'terminal');
  assert.equal(authModule.getAuthContext().tenantId, 'StevesHof_Hauptbetrieb');
  assert.equal(globalThis.document.documentElement.dataset.authenticatedTenant, 'StevesHof_Hauptbetrieb');
  assert.equal(dispatchedEvents.at(-1).detail.tenantId, 'StevesHof_Hauptbetrieb');
});

test('delivery finalize summary treats any MHD item rejection as a failure', async () => {
  installBrowserGlobals();
  const { summarizeDeliveryFinalizeWrites } = await import('../web/mhd.js?delivery-summary');
  const failure = new Error('permission-denied');
  const summary = summarizeDeliveryFinalizeWrites('written', [
    { status: 'fulfilled', value: 'written' },
    { status: 'rejected', reason: failure },
  ]);

  assert.equal(summary.failedWrite.reason, failure);
  assert.equal(summary.hasQueuedWrites, false);

  const queuedSummary = summarizeDeliveryFinalizeWrites('written', [
    { status: 'fulfilled', value: 'queued' },
  ]);
  assert.equal(queuedSummary.failedWrite, null);
  assert.equal(queuedSummary.hasQueuedWrites, true);
});

test('TorFabrik delivery-note scanner imports App Check readiness guard', async () => {
  const source = await readFile(new URL('../web/delivery-note.js', import.meta.url), 'utf8');
  assert.match(source, /import\s+\{\s*waitForAppCheckReady\s*\}\s+from\s+['"]\.\/app-check\.js['"]/);
});
