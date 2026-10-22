/**
 * MHD edit/list stability: pending merge on live sync, renderKey, post-save render.
 * Source-contract + shell repro driver (no Firebase).
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
  });

  it('shell-repro bestätigt Fix-Signale (kein Wipe, Completion im RenderKey, post-save Render)', () => {
    const repro = path.join(root, 'tools/mhd-edit-stability-repro.mjs');
    expect(fs.existsSync(repro)).to.equal(true);
    const run = spawnSync(process.execPath, [repro], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MHD_DEBUG_RUN_ID: 'mocha-post-fix' },
    });
    expect(run.status, run.stderr || run.stdout).to.equal(0);
    const logPath = '/opt/cursor/logs/debug.log';
    expect(fs.existsSync(logPath)).to.equal(true);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    const parsed = lines.map((line) => JSON.parse(line));
    const postFix = parsed.filter((row) => row.runId === 'mocha-post-fix' || row.runId === 'post-fix');
    const rows = postFix.length ? postFix : parsed;
    const wipe = [...rows].reverse().find((row) => row.message === 'live-merge-assigned');
    expect(wipe?.data?.usedPendingMerge).to.equal(true);
    expect(wipe?.data?.wipedPendingLocalFields).to.equal(0);
    const key = [...rows].reverse().find((row) => row.message === 'render-key-includes-completion');
    expect(key?.data?.keyOmitsCompletionFields).to.equal(false);
    expect(key?.data?.keyKeepsCompletionAfterLiveSync).to.equal(true);
    const save = [...rows].reverse().find((row) => row.message === 'cleared-pending-with-render');
    expect(save?.data?.willCallRender).to.equal(true);
    expect(save?.data?.reappearsInOffen).to.equal(false);
  });
});
