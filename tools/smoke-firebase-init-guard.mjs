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

const firebaseSdkBlock = indexSrc.slice(
  indexSrc.indexOf('firebase-app.js') - 120,
  indexSrc.indexOf('html5-qrcode.min.js') + 80,
);
assert.doesNotMatch(firebaseSdkBlock, /\b(defer|async)\b/);
assert.ok(
  indexSrc.indexOf('/libs/firebase-app.js') < indexSrc.indexOf('/app.js'),
  'Firebase SDK muss vor app.js geladen werden',
);
assert.match(indexSrc, /app\.js\?v=20261015-firebase-init-fix-v1/);

assert.match(swSrc, /CACHE_NAME = 'charculogic-v20261015-firebase-init-fix-v1'/);
assert.match(appSrc, /sw\.js\?v=20261015-firebase-init-fix-v1/);

console.log('OK smoke-firebase-init-guard: Login-Init-Guard, Script-Reihenfolge und SW-Cache gesetzt.');
