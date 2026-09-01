import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  clearMhdPendingChangesDraft,
  getMhdPendingChangesStorageKey,
  loadMhdPendingChangesDraft,
  saveMhdPendingChangesDraft,
} from '../web/mhd-pending-changes.mjs';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

describe('MHD pending changes draft storage', () => {
  it('stores staged MHD actions under a tenant-scoped key and restores them after reload', () => {
    const storage = new MemoryStorage();
    const tenantId = 'StevesHof_Hauptbetrieb';
    const changes = {
      'mhd-1': {
        mhdActionStatus: 'geprueft',
        lastCheckedDate: '2026-09-01',
        lastMhdCheckDate: '2026-09-01',
        qty: undefined,
      },
    };

    const result = saveMhdPendingChangesDraft({ tenantId, changes, storage });
    const restored = loadMhdPendingChangesDraft({ tenantId, storage });

    expect(result).to.deep.equal({ saved: true, count: 1 });
    expect(storage.getItem(getMhdPendingChangesStorageKey('TorFabrik'))).to.equal(null);
    expect(restored.count).to.equal(1);
    expect(restored.changes).to.deep.equal({
      'mhd-1': {
        mhdActionStatus: 'geprueft',
        lastCheckedDate: '2026-09-01',
        lastMhdCheckDate: '2026-09-01',
      },
    });
  });

  it('does not restore another tenant draft from the current tenant key', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      getMhdPendingChangesStorageKey('StevesHof_Hauptbetrieb'),
      JSON.stringify({
        version: 1,
        tenantId: 'TorFabrik',
        changes: { 'mhd-foreign': { qty: 0 } },
      }),
    );

    const restored = loadMhdPendingChangesDraft({
      tenantId: 'StevesHof_Hauptbetrieb',
      storage,
    });

    expect(restored).to.deep.equal({ changes: {}, count: 0 });
  });

  it('clears the tenant draft after pending changes have been saved or queued', () => {
    const storage = new MemoryStorage();
    const tenantId = 'StevesHof_Hauptbetrieb';
    const key = getMhdPendingChangesStorageKey(tenantId);

    saveMhdPendingChangesDraft({
      tenantId,
      storage,
      changes: { 'mhd-1': { qty: 3 } },
    });

    expect(storage.getItem(key)).to.be.a('string');
    expect(clearMhdPendingChangesDraft({ tenantId, storage })).to.equal(true);
    expect(storage.getItem(key)).to.equal(null);
  });
});
