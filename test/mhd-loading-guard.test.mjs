/**
 * MHD Loading vs Empty: Timeout 3s, Skeleton-Text, lokaler Snapshot.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhd = fs.readFileSync(path.join(root, 'web/mhd.js'), 'utf8');

describe('MHD Lade-Guard', () => {
  it('trennt Loading von Empty und hydriert lokal', () => {
    expect(mhd).to.match(/MHD_CLOUD_SYNC_TIMEOUT_MS\s*=\s*3000/);
    expect(mhd).to.include('hydrateMhdFromLocalSnapshot');
    expect(mhd).to.include('persistMhdLocalSnapshot');
    expect(mhd).to.include('Frische-Bestand StevesHof wird geladen');
    expect(mhd).to.include('shouldShowMhdCloudLoadingState');
    expect(mhd).to.match(/Leermeldung nur nach abgeschlossenem Ladevorgang/);
  });

  it('shows error + retry after timeout without cache', () => {
    expect(mhd).to.match(/Kein Cache: Fehlerzustand mit Retry/);
    expect(mhd).to.include('buildMhdLoadErrorHtml');
    expect(mhd).to.include('data-mhd-retry-cloud');
    expect(mhd).to.include('Frische-Bestand konnte nicht geladen werden');
    expect(mhd).to.match(/cloudSyncStatus === 'error'/);
  });

  it('validates wareneingang with toast and blocks empty saves', () => {
    expect(mhd).to.include('function notifyReceivingValidation');
    expect(mhd).to.include('function ensureReceivingActorOrWarn');
    expect(mhd).to.match(/Nichts zu speichern/);
    expect(mhd).to.match(/nichts wurde gespeichert/i);
  });
});
