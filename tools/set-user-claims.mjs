/**
 * Synchronisiert Firestore-Profile (/users/{uid}) → Firebase Auth Custom Claims.
 *
 * Setzt nur Claims – invalidiert KEINE Refresh Tokens (bestehende Sessions bleiben gültig
 * bis zum natürlichen Ablauf; Clients sollten nach dem Lauf getIdToken(true) aufrufen).
 *
 * Usage:
 *   node tools/set-user-claims.mjs --uid=ABC123 --project=hofsync-production
 *   node tools/set-user-claims.mjs --tenant=torfabrik --project=charculogic-whitelabel-test
 *   node tools/set-user-claims.mjs --all --project=hofsync-production
 *   FIREBASE_PROJECT=hofsync-production node tools/set-user-claims.mjs --all
 */
import admin from 'firebase-admin';

const ALLOWED_ROLES = new Set(['admin', 'employee', 'helper']);

function parseArgs(argv) {
  const args = {
    uid: '',
    tenant: '',
    all: false,
    project: process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || '',
    dryRun: false,
  };

  argv.forEach((arg) => {
    if (arg === '--all') args.all = true;
    if (arg === '--dry-run') args.dryRun = true;
    if (arg.startsWith('--uid=')) args.uid = arg.slice('--uid='.length).trim();
    if (arg.startsWith('--tenant=')) args.tenant = arg.slice('--tenant='.length).trim();
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim();
  });

  return args;
}

function tenantIdFromRecord(data = {}) {
  const value = data.tenantId ?? data.tenant_id ?? data.tenantID ?? '';
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(data = {}) {
  if (data.admin === true) return 'admin';
  const raw = typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';
  if (ALLOWED_ROLES.has(raw)) return raw;
  if (raw === 'user' || raw === '') return 'employee';
  return '';
}

function buildClaims(tenantId, role) {
  return {
    tenantId,
    role,
    isAdmin: role === 'admin',
  };
}

function claimsNeedUpdate(existing = {}, next = {}) {
  return existing.tenantId !== next.tenantId
    || existing.role !== next.role
    || existing.isAdmin !== next.isAdmin;
}

async function fetchUserDocs(db, { uid, tenant, all }) {
  if (uid) {
    const snap = await db.doc(`users/${uid}`).get();
    return snap.exists ? [{ uid, data: snap.data() || {} }] : [];
  }

  const snap = await db.collection('users').get();
  let rows = snap.docs.map((doc) => ({ uid: doc.id, data: doc.data() || {} }));

  if (tenant) {
    rows = rows.filter(({ data }) => tenantIdFromRecord(data) === tenant);
  }

  if (!all && !tenant) {
    return [];
  }

  return rows;
}

function renderProgress(current, total, uid, status) {
  const pad = String(current).padStart(String(total).length, ' ');
  const icon = status === 'ok' ? '✓' : status === 'skip' ? '○' : '✗';
  process.stdout.write(`[${pad}/${total}] ${icon} ${uid}\n`);
}

async function applyClaimsForUser(auth, { uid, data }, dryRun) {
  const tenantId = tenantIdFromRecord(data);
  const role = normalizeRole(data);

  if (!tenantId) {
    return { uid, status: 'failed', reason: 'tenantId fehlt im Firestore-Profil' };
  }
  if (!role) {
    return { uid, status: 'failed', reason: `Ungültige Rolle: "${data.role ?? ''}"` };
  }

  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      return { uid, status: 'failed', reason: 'Auth-Nutzer existiert nicht' };
    }
    return { uid, status: 'failed', reason: err?.message || String(err) };
  }

  const nextClaims = buildClaims(tenantId, role);
  const existingClaims = authUser.customClaims || {};

  if (!claimsNeedUpdate(existingClaims, nextClaims)) {
    return { uid, status: 'skipped', reason: 'Claims bereits aktuell', claims: nextClaims };
  }

  if (dryRun) {
    return { uid, status: 'dry-run', claims: nextClaims };
  }

  await auth.setCustomUserClaims(uid, nextClaims);
  return { uid, status: 'ok', claims: nextClaims, email: authUser.email || '' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.project) {
    console.error('Projekt fehlt. Setze --project=<id> oder FIREBASE_PROJECT.');
    process.exitCode = 1;
    return;
  }
  if (!args.uid && !args.all && !args.tenant) {
    console.error('Bitte --uid=, --tenant= oder --all angeben.');
    process.exitCode = 1;
    return;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: args.project });
  }

  const db = admin.firestore();
  const auth = admin.auth();

  const rows = await fetchUserDocs(db, args);
  if (!rows.length) {
    console.log('Keine passenden /users-Dokumente gefunden.');
    return;
  }

  console.log(`Projekt: ${args.project}`);
  console.log(`Nutzer:  ${rows.length}${args.dryRun ? ' (dry-run)' : ''}`);
  console.log('Hinweis: Refresh Tokens werden nicht widerrufen – Clients refreshen Claims via getIdToken(true).\n');

  const summary = { ok: 0, skipped: 0, failed: 0, dryRun: 0 };
  const failures = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const result = await applyClaimsForUser(auth, row, args.dryRun);

    if (result.status === 'ok') {
      summary.ok += 1;
      renderProgress(i + 1, rows.length, result.uid, 'ok');
    } else if (result.status === 'skipped') {
      summary.skipped += 1;
      renderProgress(i + 1, rows.length, result.uid, 'skip');
    } else if (result.status === 'dry-run') {
      summary.dryRun += 1;
      renderProgress(i + 1, rows.length, result.uid, 'ok');
      console.log(`         → würde setzen: ${JSON.stringify(result.claims)}`);
    } else {
      summary.failed += 1;
      renderProgress(i + 1, rows.length, result.uid, 'fail');
      failures.push(result);
      console.log(`         → ${result.reason}`);
    }
  }

  console.log('\n--- Zusammenfassung ---');
  if (args.dryRun) {
    console.log(`Dry-run: ${summary.dryRun} würden aktualisiert, ${summary.skipped} unverändert, ${summary.failed} fehlgeschlagen`);
  } else {
    console.log(`Erfolgreich: ${summary.ok}, übersprungen: ${summary.skipped}, fehlgeschlagen: ${summary.failed}`);
  }

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Claims-Migration fehlgeschlagen:', err);
  process.exitCode = 1;
});
