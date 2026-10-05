import { afterEach, describe, expect, test } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('Firebase Admin app wrapper', () => {
  afterEach(async () => {
    const { deleteApp, getApps } = require('firebase-admin/app');
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  test('ensureAdminApp uses the modular Admin app registry', () => {
    const firebaseAdmin = require('../firebaseAdmin');

    expect(() => firebaseAdmin.ensureAdminApp()).not.toThrow();
    expect(firebaseAdmin.apps.map((app) => app.name)).toContain('[DEFAULT]');
  });
});
