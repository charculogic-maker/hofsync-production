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
  it('hat Pending-Merge-Helfer (werden auf Live-Sync angewandt erwartet)', () => {
    expect(mhd).to.include('function mergeCloudProductsWithPendingChanges');
    expect(mhd).to.include('function mergeMhdLiveProducts');
    expect(mhd).to.include('function buildMhdListRenderKey');
    expect(mhd).to.include('function saveAllPendingMhdChanges');
  });

  it('shell-repro schreibt Bug-Signale (pre-fix) oder Fix-Signale', () => {
    const repro = path.join(root, 'tools/mhd-edit-stability-repro.mjs');
    expect(fs.existsSync(repro)).to.equal(true);
    const run = spawnSync(process.execPath, [repro], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MHD_DEBUG_RUN_ID: 'mocha-repro' },
    });
    // Pre-fix: exit 0 with bug confirmed. Post-fix we may flip expectations.
    expect(run.status, run.stderr || run.stdout).to.equal(0);
    const logPath = '/opt/cursor/logs/debug.log';
    expect(fs.existsSync(logPath)).to.equal(true);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean);
    const parsed = lines.map((line) => JSON.parse(line));
    const wipe = parsed.find((row) => row.message === 'live-merge-assigned');
    expect(wipe?.data?.wipedPendingLocalFields).to.be.at.least(1);
    const skip = parsed.find((row) => row.message === 'render-skipped-same-key');
    expect(skip?.data?.renderSkipped).to.equal(true);
    const save = parsed.find((row) => row.message === 'cleared-pending-no-render');
    expect(save?.data?.reappearsInOffen).to.equal(true);
  });
});
