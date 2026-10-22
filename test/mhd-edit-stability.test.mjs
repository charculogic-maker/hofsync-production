/**
 * MHD edit/list stability: pending merge on live sync, renderKey, post-save render.
 */
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mhd = fs.readFileSync(path.join(root, 'web/mhd.js'), 'utf8');

describe('MHD Edit/List Stability', () => {
  it('wendet Pending-Merge im Live-Sync an und hält Render/Save konsistent', () => {
    expect(mhd).to.match(/function mergeMhdLiveProducts\([\s\S]*?mergeCloudProductsWithPendingChanges\(cloudProducts\)/);
    expect(mhd).to.match(/function buildMhdListRenderKey\([\s\S]*?lastCheckedDate[\s\S]*?mhdActionStatus/);
    expect(mhd).to.match(/clearMhdPendingChanges\(\);\s*\n\s*renderMhdList\(\);/);
    expect(mhd).to.not.include('mhdAgentDebugLog');
    expect(mhd).to.not.include('#region agent log');
  });

  it('shell-repro bestätigt Fix-Signale (kein Wipe, Completion im RenderKey, post-save Render)', () => {
    const repro = path.join(root, 'tools/mhd-edit-stability-repro.mjs');
    expect(fs.existsSync(repro)).to.equal(true);
    const run = spawnSync(process.execPath, [repro], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(run.status, run.stderr || run.stdout).to.equal(0);
    const summary = JSON.parse((run.stdout || '').trim().split('\n').pop());
    expect(summary.ok).to.equal(true);
    expect(summary.wiped).to.equal(false);
    expect(summary.reappearsInOffen).to.equal(false);
    expect(summary.keyKeepsCompletion).to.equal(true);
    expect(summary.noAgentDebugLog).to.equal(true);
  });
});
