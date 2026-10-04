import { afterEach, describe, expect, test } from 'vitest';
import { deleteApp, getApps } from 'firebase-admin/app';

async function deleteDefaultApps() {
  await Promise.all(getApps().map((app) => deleteApp(app).catch(() => null)));
}

describe('Firebase Admin wrapper', () => {
  afterEach(async () => {
    await deleteDefaultApps();
  });

  test('initializes the default Admin app and binds Firestore/Auth to it', async () => {
    await deleteDefaultApps();

    const admin = await import('../firebaseAdmin.js');
    const app = admin.ensureAdminApp();
    const db = admin.getAdminDb();
    const auth = admin.getAdminAuth();

    expect(app.name).toBe('[DEFAULT]');
    expect(getApps().map((entry) => entry.name)).toEqual(['[DEFAULT]']);
    expect(db.app.name).toBe('[DEFAULT]');
    expect(auth.app.name).toBe('[DEFAULT]');
    expect(typeof admin.firestore.FieldValue.serverTimestamp).toBe('function');
    expect(typeof admin.firestore.Timestamp.fromMillis).toBe('function');
  });
});
