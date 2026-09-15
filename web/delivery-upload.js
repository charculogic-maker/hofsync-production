/**
 * Gemeinsame Validierung für Lieferschein-/Wareneingangs-Uploads (Foto + PDF).
 * Backend-Limit in functions/deliveryNote.js: MAX_IMAGE_BASE64_LENGTH = 16 MB Base64 ≈ 12 MB Datei.
 */

export const DELIVERY_UPLOAD_ACCEPT = 'application/pdf,image/*';
export const MAX_DELIVERY_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_DELIVERY_UPLOAD_LABEL = '12 MB';

const IMAGE_MIME_RE = /^image\//i;
const PDF_MIME = 'application/pdf';

/**
 * @param {File|Blob|null|undefined} file
 * @returns {{ ok: true, mimeType: string } | { ok: false, message: string }}
 */
export function validateDeliveryUploadFile(file) {
  if (!file) {
    return { ok: false, message: 'Bitte ein Foto oder PDF vom Lieferschein wählen.' };
  }

  const size = Number(file.size) || 0;
  if (size <= 0) {
    return { ok: false, message: 'Die Datei ist leer. Bitte ein anderes Foto oder PDF wählen.' };
  }
  if (size > MAX_DELIVERY_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `Die Datei ist zu groß (max. ${MAX_DELIVERY_UPLOAD_LABEL}). Bitte ein kleineres Foto oder PDF wählen.`,
    };
  }

  const name = String(file.name || '').toLowerCase();
  let mimeType = String(file.type || '').trim().toLowerCase();
  if (!mimeType && name.endsWith('.pdf')) mimeType = PDF_MIME;
  if (!mimeType && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)) {
    mimeType = 'image/jpeg';
  }
  if (!mimeType) mimeType = 'image/jpeg';

  const allowed = mimeType === PDF_MIME || IMAGE_MIME_RE.test(mimeType);
  if (!allowed) {
    return {
      ok: false,
      message: 'Nur Fotos (JPG/PNG) oder PDF vom Lieferschein sind möglich.',
    };
  }

  return { ok: true, mimeType };
}

export function isPdfMimeType(mimeType) {
  return String(mimeType || '').trim().toLowerCase() === PDF_MIME;
}
