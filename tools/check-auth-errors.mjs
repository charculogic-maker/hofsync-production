import { describeAuthError, isReferrerBlockedError } from '../web/auth-errors.js';

const cases = [
  [{ code: 'auth/unauthorized-domain' }, 'Domain nicht autorisiert'],
  [{ message: 'Requests from referer https://hofsync.vercel.app/ are blocked.' }, 'Domain nicht autorisiert'],
  [{ code: 'auth/user-not-found' }, 'Nutzer nicht gefunden'],
  [{ code: 'auth/wrong-password' }, 'Falsches Passwort'],
  [{ code: 'auth/invalid-credential' }, 'E-Mail oder Passwort ist falsch'],
  [{ code: 'auth/invalid-custom-token' }, 'Geräte-Zugangscode ist ungültig'],
];

let failed = 0;
for (const [err, expected] of cases) {
  const text = describeAuthError(err, 'hofsync.vercel.app');
  const ok = text.includes(expected);
  console.log(`${ok ? 'OK' : 'FAIL'} ${err.code || err.message} -> ${text}`);
  if (!ok) failed += 1;
}

if (!isReferrerBlockedError({ message: 'API_KEY_HTTP_REFERRER_BLOCKED' })) {
  console.error('FAIL referrer detector');
  failed += 1;
} else {
  console.log('OK referrer detector');
}

if (failed) {
  process.exit(1);
}
console.log('Auth-Fehlertexte verifiziert.');
