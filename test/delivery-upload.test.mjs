import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  validateDeliveryUploadFile,
  isPdfMimeType,
  MAX_DELIVERY_UPLOAD_BYTES,
  DELIVERY_UPLOAD_ACCEPT,
} from '../web/delivery-upload.js';

function fakeFile({ size, type, name }) {
  return { size, type, name };
}

describe('delivery-upload validation', () => {
  it('exposes PDF + image accept string for mobile file pickers', () => {
    expect(DELIVERY_UPLOAD_ACCEPT).to.equal('application/pdf,image/*');
  });

  it('accepts jpeg and pdf within size limit', () => {
    expect(validateDeliveryUploadFile(fakeFile({
      size: 1024,
      type: 'image/jpeg',
      name: 'lieferschein.jpg',
    })).ok).to.equal(true);

    const pdf = validateDeliveryUploadFile(fakeFile({
      size: 2048,
      type: 'application/pdf',
      name: 'rechnung.pdf',
    }));
    expect(pdf.ok).to.equal(true);
    expect(pdf.mimeType).to.equal('application/pdf');
    expect(isPdfMimeType(pdf.mimeType)).to.equal(true);
  });

  it('rejects oversized files with shop-friendly German message', () => {
    const result = validateDeliveryUploadFile(fakeFile({
      size: MAX_DELIVERY_UPLOAD_BYTES + 1,
      type: 'application/pdf',
      name: 'zu-gross.pdf',
    }));
    expect(result.ok).to.equal(false);
    expect(result.message).to.match(/zu groß/i);
    expect(result.message).to.match(/12 MB/);
  });

  it('rejects unsupported mime types', () => {
    const result = validateDeliveryUploadFile(fakeFile({
      size: 100,
      type: 'text/plain',
      name: 'notiz.txt',
    }));
    expect(result.ok).to.equal(false);
    expect(result.message).to.match(/Fotos|PDF/i);
  });

  it('infers pdf mime from filename when type is empty (iOS quirk)', () => {
    const result = validateDeliveryUploadFile(fakeFile({
      size: 500,
      type: '',
      name: 'Weiling-LS.pdf',
    }));
    expect(result.ok).to.equal(true);
    expect(result.mimeType).to.equal('application/pdf');
  });
});
