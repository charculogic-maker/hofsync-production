/**
 * Pure helper checks mirrored from web/delivery-upload.js
 * (avoids loading Firebase/auth browser modules under Node).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif']);
const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
};
const MAX_DELIVERY_FILE_BYTES = 12 * 1024 * 1024;

function getDeliveryFileExtension(fileOrName) {
  const name = typeof fileOrName === 'string' ? fileOrName : String(fileOrName?.name || '');
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isAllowedDeliveryFile(file) {
  const ext = getDeliveryFileExtension(file);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  return false;
}

function resolveDeliveryMimeType(file) {
  const ext = getDeliveryFileExtension(file);
  const rawMime = String(file?.type || '').trim().toLowerCase();
  if (rawMime && rawMime !== 'application/octet-stream') {
    return rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
  }
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

function buildDeliveryNoteStoragePath(tenantId, fileName, now = Date.now()) {
  return `tenants/${tenantId}/delivery_notes/${now}_${fileName}`;
}

describe('delivery-upload helper contract', () => {
  it('accepts HEIC/PDF by extension despite octet-stream MIME', () => {
    assert.equal(isAllowedDeliveryFile({ name: 'lieferschein.HEIC', type: 'application/octet-stream' }), true);
    assert.equal(isAllowedDeliveryFile({ name: 'schein.pdf', type: '' }), true);
    assert.equal(isAllowedDeliveryFile({ name: 'x.docx', type: 'application/octet-stream' }), false);
  });

  it('resolves MIME from extension when MIME is generic', () => {
    assert.equal(resolveDeliveryMimeType({ name: 'a.heic', type: 'application/octet-stream' }), 'image/heic');
    assert.equal(resolveDeliveryMimeType({ name: 'a.jpg', type: '' }), 'image/jpeg');
  });

  it('builds tenant-rooted delivery_notes path', () => {
    assert.equal(
      buildDeliveryNoteStoragePath('TorFabrik', 'Foto_1.jpg', 1700000000000),
      'tenants/TorFabrik/delivery_notes/1700000000000_Foto_1.jpg',
    );
  });

  it('keeps 12 MB limit', () => {
    assert.equal(MAX_DELIVERY_FILE_BYTES, 12 * 1024 * 1024);
  });
});
