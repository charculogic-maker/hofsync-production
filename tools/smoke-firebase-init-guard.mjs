#!/usr/bin/env node
/**
 * Smoke: Firebase Default-App muss vor Login/Auth erzwungen werden.
 * Verhindert Regression von app-compat/no-app auf dem Anmelde-Bildschirm.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const authSrc = read('web/auth.js');
const initSrc = read('web/firebase-init.js');
const configSrc = read('web/firebase-config.js');
const indexSrc = read('web/index.html');
const swSrc = read('web/sw.js');
const appSrc = read('web/app.js');

assert.match(authSrc, /import\s*\{\s*ensureFirebaseApp\s*\}\s*from\s*'\.\/firebase-init\.js'/);
assert.match(authSrc, /ensureFirebaseApp\(firebaseApi\)/);
assert.match(authSrc, /async function ensureAuthConfigured/);
assert.match(authSrc, /persistTenantSessionAfterLogin/);
assert.match(authSrc, /sessionStorage\.setItem\(CACHED_TENANT_ID_KEY/);
assert.match(authSrc, /loginTenant[\s\S]*ensureAuthConfigured/);
assert.match(authSrc, /loginWithToken[\s\S]*ensureAuthConfigured/);

assert.match(initSrc, /export function ensureFirebaseApp/);
assert.match(initSrc, /window\.firebaseConfig/);
assert.match(initSrc, /FIREBASE_CONFIG/);
assert.match(initSrc, /if \(!firebaseApi\.apps\?\.length\)/);

assert.match(configSrc, /window\.firebaseConfig\s*=\s*toFirebaseSdkConfig/);

const firebaseScriptTags = [...indexSrc.matchAll(/<script\b[^>]*src="[^"]*firebase[^"]*"[^>]*>/gi)]
  .map((m) => m[0]);
assert.ok(firebaseScriptTags.length >= 3, 'Firebase SDK Script-Tags erwartet');
for (const tag of firebaseScriptTags) {
  assert.doesNotMatch(tag, /\sdefer\b|\sasync\b/i, `Firebase-Script darf kein defer/async haben: ${tag}`);
}
const sdkPos = indexSrc.indexOf('src="/libs/firebase-app.js"');
const appModulePos = indexSrc.search(/src="\/app\.js\?v=\d{8}-[^"]+"/);
assert.ok(sdkPos >= 0 && appModulePos > sdkPos, 'Firebase SDK muss vor app.js-Modul geladen werden');
assert.match(indexSrc, /src="\/app\.js\?v=\d{8}-[^"]+"/);
assert.match(indexSrc, /firestore-perm-packliste-v1/);

assert.match(swSrc, /CACHE_NAME = 'charculogic-v\d{8}-[^']+'/);
assert.match(swSrc, /firestore-perm-packliste-v1/);
assert.match(appSrc, /sw\.js\?v=\d{8}-[^'"]+/);
assert.match(appSrc, /firestore-perm-packliste-v1/);

console.log('OK smoke-firebase-init-guard: Login-Init-Guard, Script-Reihenfolge und SW-Cache gesetzt.');
