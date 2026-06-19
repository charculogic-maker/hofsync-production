import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readWebFile(fileName) {
  return readFile(path.join(projectRoot, 'web', fileName), 'utf8');
}

describe('critical web receiving regressions', () => {
  it('uses scanned product matches to update existing MHD stock', async () => {
    const source = await readWebFile('mhd.js');
    assert.doesNotMatch(source, /const\s+existing\s*=\s*null\s*;/);
    assert.match(source, /const\s+existing\s*=\s*selectedProduct\?\.existingProduct\s*\|\|\s*null\s*;/);
  });

  it('does not show receiving success after rejected MHD item writes', async () => {
    const source = await readWebFile('mhd.js');
    assert.match(source, /const\s+failedMhdWrite\s*=\s*mhdResults\.find\(\(result\)\s*=>\s*result\.status\s*===\s*'rejected'\);/);
    assert.match(source, /if\s*\(failedMhdWrite\)\s*\{\s*throw\s+failedMhdWrite\.reason/s);
  });

  it('includes tenantId in KI delivery-parser MHD records', async () => {
    const source = await readWebFile('delivery-parser.js');
    assert.match(source, /const\s+parserState\s*=\s*\{[\s\S]*?tenantId:\s*''/);
    assert.match(source, /tenantId:\s*parserState\.tenantId/);
    assert.match(source, /parserState\.tenantId\s*=\s*options\.tenantId\s*\|\|\s*'';/);
  });

  it('waits for App Check before TorFabrik delivery-note callable calls', async () => {
    const source = await readWebFile('delivery-note.js');
    assert.match(source, /import\s+\{\s*waitForAppCheckReady\s*\}\s+from\s+'\.\/app-check\.js';/);
    assert.match(source, /await\s+waitForAppCheckReady\(\);/);
  });
});
