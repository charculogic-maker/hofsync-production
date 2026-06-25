/**
 * Einmaliges Setzen von Custom Claims im Whitelabel-Testprojekt.
 *   node force-claims.js
 *
 * Referenz-Benutzer:
 *   patrik@charculogic.de      → admin (VYwMy5IAlAR26pj8ZbFfc5PNdou2)
 *   rehm.patrik@gmail.com      → employee (3Jqh3C0YJaSK7ssPPNLvLWGGkfo1)
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'charculogic-whitelabel-test';
const UID = 'VYwMy5IAlAR26pj8ZbFfc5PNdou2';
const CLAIMS = {
  tenantId: 'AP23',
  role: 'admin',
  isAdmin: true,
};

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }

  await admin.auth().setCustomUserClaims(UID, CLAIMS);
  const user = await admin.auth().getUser(UID);

  console.log(`Projekt:  ${PROJECT_ID}`);
  console.log(`UID:      ${UID}`);
  console.log(`E-Mail:   ${user.email || '(keine)'}`);
  console.log(`Claims:   ${JSON.stringify(CLAIMS)}`);
  console.log('Fertig — Client muss getIdToken(true) aufrufen, damit die Claims greifen.');
}

main().catch((err) => {
  console.error('Claims konnten nicht gesetzt werden:', err);
  process.exitCode = 1;
});
