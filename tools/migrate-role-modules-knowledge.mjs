/**
 * Entfernt Legacy-Sperren knowledge:false für admin/employee in
 * tenants/{tenantId}/settings/role_modules.
 *
 * Helper.knowledge:false bleibt unverändert.
 *
 * Beispiele:
 *   node tools/migrate-role-modules-knowledge.mjs --dry-run
 *   node tools/migrate-role-modules-knowledge.mjs --project=hofsync-production --yes
 *   node tools/migrate-role-modules-knowledge.mjs --credentials --yes
 */
import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectId = process.env.GCLOUD_PROJECT
  || process.env.GOOGLE_CLOUD_PROJECT
  || 'hofsync-production';

function parseArgs(argv) {
  const args = {
    dryRun: true,
    yes: false,
    credentials: false,
    project: projectId,
  };
  argv.forEach((raw) => {
    const arg = String(raw || '');
    if (arg === '--yes' || arg === '-y') args.yes = true;
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--apply') args.dryRun = false;
    if (arg === '--credentials') args.credentials = true;
    if (arg.startsWith('--project=')) args.project = arg.slice('--project='.length).trim() || args.project;
  });
  if (args.yes) args.dryRun = false;
  return args;
}

function initAdmin(args) {
  if (admin.apps.length) return;
  const saPath = resolve('serviceAccountKey.json');
  if (args.credentials && existsSync(saPath)) {
    const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || args.project,
    });
    return;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || existsSync(saPath)) {
    if (existsSync(saPath) && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || args.project,
      });
      return;
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: args.project,
    });
    return;
  }
  admin.initializeApp({ projectId: args.project });
}

/**
 * @param {FirebaseFirestore.DocumentData|undefined} data
 * @returns {{ patch: Record<string, unknown>|null, roles: string[] }}
 */
export function buildKnowledgeSanitizePatch(data) {
  if (!data || typeof data !== 'object') return { patch: null, roles: [] };
  /** @type {string[]} */
  const roles = [];
  /** @type {Record<string, unknown>} */
  const patch = {};
  ['admin', 'employee'].forEach((role) => {
    const map = data[role];
    if (!map || typeof map !== 'object' || Array.isArray(map)) return;
    if (!Object.prototype.hasOwnProperty.call(map, 'knowledge')) return;
    if (map.knowledge !== false) return;
    patch[role] = { ...map, knowledge: true };
    roles.push(role);
  });
  if (!roles.length) return { patch: null, roles: [] };
  return { patch, roles };
}

async function migrate() {
  const args = parseArgs(process.argv.slice(2));
  initAdmin(args);
  const db = admin.firestore();
  console.log(`Projekt: ${args.project}`);
  console.log(args.dryRun ? 'Modus: DRY-RUN (kein Schreiben)' : 'Modus: APPLY');

  const tenantsSnap = await db.collection('tenants').get();
  let scanned = 0;
  let withDoc = 0;
  let needingFix = 0;
  let written = 0;

  for (const tenantDoc of tenantsSnap.docs) {
    scanned += 1;
    const tenantId = tenantDoc.id;
    const roleRef = tenantDoc.ref.collection('settings').doc('role_modules');
    const roleSnap = await roleRef.get();
    if (!roleSnap.exists) continue;
    withDoc += 1;
    const data = roleSnap.data() || {};
    const { patch, roles } = buildKnowledgeSanitizePatch(data);
    if (!patch) continue;
    needingFix += 1;
    console.log(`  ${tenantId}: legacy knowledge:false → true (${roles.join(', ')})`);
    if (args.dryRun) continue;
    await roleRef.set({
      ...patch,
      knowledgeSanitizedAt: admin.firestore.FieldValue.serverTimestamp(),
      knowledgeSanitizedBy: 'migrate-role-modules-knowledge',
    }, { merge: true });
    written += 1;
  }

  console.log(`\nMandanten gescannt: ${scanned}`);
  console.log(`role_modules vorhanden: ${withDoc}`);
  console.log(`mit knowledge:false (admin/employee): ${needingFix}`);
  console.log(`geschrieben: ${written}`);
  if (args.dryRun && needingFix > 0) {
    console.log('\nZum Anwenden: node tools/migrate-role-modules-knowledge.mjs --yes');
  }
}

import { pathToFileURL } from 'node:url';

const invokedAsCli = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedAsCli) {
  migrate().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
