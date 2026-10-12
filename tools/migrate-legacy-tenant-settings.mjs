/**
 * Migriert die früheren Shop-Sonderlocken von StevesHof und TorFabrik
 * nach tenants/{tenantId}/settings/{terminal,profile,suppliers}.
 *
 * Die App liest betriebsName, defaultTeam, primaryColor und suppliers.names.
 * Ausführung (einmalig, Projekt hofsync-production):
 *   node tools/migrate-legacy-tenant-settings.mjs
 */
import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectId = process.env.GCLOUD_PROJECT
  || process.env.GOOGLE_CLOUD_PROJECT
  || 'hofsync-production';

function initAdmin() {
  if (admin.apps.length) return;
  const saPath = resolve('serviceAccountKey.json');
  if (existsSync(saPath)) {
    const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
    return;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return;
  }
  admin.initializeApp({ projectId });
}

const TENANT_SETTINGS = {
  StevesHof_Hauptbetrieb: {
    terminal: {
      isFixedTerminal: true,
      bypassPin: true,
      defaultOperatorName: 'Laden-Team',
      terminalUser: 'bestellung@steveshof-hofladen.de',
    },
    profile: {
      betriebsName: 'StevesHof Hofladen',
      appName: 'HofSync',
      primaryColor: '#5D4037',
      primaryColorHover: '#4E342E',
      darkHeaderBg: '#3E2723',
      standardBereich: 'Laden / Verkauf',
      defaultTeam: [
        'Paddy',
        'Stephie',
        'Bettina',
        'Nicole',
        'Heiko',
        'Melanie',
        'Thomas',
        'Finn',
        'Efecan',
        'Mimi',
      ],
    },
    suppliers: {
      names: [
        'Weiling',
        'Naturverbund',
        'Stautenhof',
        'Eigene Produktion',
      ],
    },
  },
  torfabrik: {
    terminal: {
      isFixedTerminal: false,
      bypassPin: false,
      defaultOperatorName: 'Kaffee-Team',
      terminalUser: 'barista@torfabrik.de',
    },
    profile: {
      betriebsName: 'TorFabrik Krefeld',
      appName: 'HofSync',
      primaryColor: '#d97706',
      primaryColorHover: '#b45309',
      darkHeaderBg: '#78350f',
      standardBereich: 'Laden',
      defaultTeam: ['Barista 1', 'Röster', 'Laden-Team'],
    },
    suppliers: {
      names: ['Rohkaffee-Import', 'Verpackung', 'Großhandel', 'Milchhof'],
    },
  },
};

async function migrate() {
  initAdmin();
  const db = admin.firestore();
  console.log(`Projekt: ${projectId}`);
  console.log('Starte Migration der Mandanten-Settings...');

  for (const [tenantId, configs] of Object.entries(TENANT_SETTINGS)) {
    console.log(`\nMandant: ${tenantId}`);
    for (const [section, data] of Object.entries(configs)) {
      const docRef = db.collection('tenants').doc(tenantId).collection('settings').doc(section);
      await docRef.set({
        ...data,
        tenantId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'migrate-legacy-tenant-settings',
      }, { merge: true });
      console.log(`  tenants/${tenantId}/settings/${section} geschrieben`);
    }
  }

  console.log('\nLegacy-Einstellungen in Firestore überführt.');
}

migrate().catch((err) => {
  console.error('Migration fehlgeschlagen:', err?.message || err);
  process.exitCode = 1;
});
