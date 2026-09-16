/**
 * Gemeinsame Härtung für Lieferschein-Uploads (Foto/PDF):
 * Endungs-Toleranz (inkl. HEIC), clientseitige Bildkompression,
 * direkter Firebase-Storage-Upload, präzise Laden-Toasts.
 */

import { getAuthContext } from './auth.js';
import { waitForAppCheckReady } from './app-check.js';
import { createHttpsCallable } from './firebase-functions.js';

export const MAX_DELIVERY_FILE_BYTES = 12 * 1024 * 1024;
export const DELIVERY_IMAGE_MAX_EDGE = 2000;
export const DELIVERY_JPEG_QUALITY = 0.8;

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif']);

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
};

const COMPRESSIBLE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']);

export class DeliveryUploadError extends Error {
  /**
   * @param {'file-too-large'|'unsupported-type'|'network'|'timeout'|'offline'|'generic'} kind
   * @param {string} message
   * @param {unknown} [cause]
   */
  constructor(kind, message, cause) {
    super(message);
    this.name = 'DeliveryUploadError';
    this.kind = kind;
    this.cause = cause;
  }
}

export function getDeliveryFileExtension(fileOrName) {
  const name = typeof fileOrName === 'string'
    ? fileOrName
    : String(fileOrName?.name || '');
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

export function isAllowedDeliveryFile(file) {
  if (!file) return false;
  const ext = getDeliveryFileExtension(file);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;

  // Fallback nur wenn keine Endung vorliegt (z. B. Kamerastream ohne Name).
  const mime = String(file.type || '').trim().toLowerCase();
  if (!mime || mime === 'application/octet-stream') return false;
  if (mime === 'application/pdf') return true;
  if (mime.startsWith('image/')) {
    const sub = mime.slice('image/'.length);
    return ALLOWED_EXTENSIONS.has(sub) || sub === 'jpg' || sub === 'jpeg' || sub === 'png'
      || sub === 'heic' || sub === 'heif' || sub === 'webp';
  }
  return false;
}

export function resolveDeliveryMimeType(file, fallbackExt = '') {
  const ext = getDeliveryFileExtension(file) || String(fallbackExt || '').replace(/^\./, '').toLowerCase();
  const rawMime = String(file?.type || '').trim().toLowerCase();
  if (rawMime && rawMime !== 'application/octet-stream') {
    if (rawMime === 'image/jpg') return 'image/jpeg';
    return rawMime;
  }
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

function sanitizeStorageFileName(name) {
  const raw = String(name || 'lieferschein').trim() || 'lieferschein';
  return raw
    .replace(/[\\/]+/g, '_')
    .replace(/[^\w.\-äöüÄÖÜß]+/gi, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'lieferschein';
}

/**
 * Tenant-isolierter Storage-Pfad.
 * Architektur: tenants/{tenantId}/delivery_notes/{timestamp}_{filename}
 * (entspricht delivery_notes/{tenantId}/… inhaltlich, mit Rules-konformer Wurzel).
 */
export function buildDeliveryNoteStoragePath(tenantId, fileName, now = Date.now()) {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) {
    throw new DeliveryUploadError('generic', 'Mandant fehlt für den Lieferschein-Upload.');
  }
  const safeName = sanitizeStorageFileName(fileName);
  return `tenants/${cleanTenant}/delivery_notes/${now}_${safeName}`;
}

function dataUrlToBlob(dataUrl, mimeType = 'image/jpeg') {
  const comma = String(dataUrl || '').indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Komprimiert Fotos auf max. Kantenlänge (JPEG q=0.8).
 * PDF und HEIC/HEIF bleiben unverändert (Canvas dekodiert HEIC auf dem iPhone oft nicht).
 */
export async function compressDeliveryImageIfNeeded(file, {
  maxEdge = DELIVERY_IMAGE_MAX_EDGE,
  quality = DELIVERY_JPEG_QUALITY,
} = {}) {
  const mime = resolveDeliveryMimeType(file);
  const ext = getDeliveryFileExtension(file);

  if (mime === 'application/pdf' || ext === 'pdf') {
    return { blob: file, mimeType: 'application/pdf', compressed: false };
  }
  if (ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif') {
    return { blob: file, mimeType: mime.startsWith('image/') ? mime : resolveDeliveryMimeType(file), compressed: false };
  }
  if (!COMPRESSIBLE_MIME.has(mime) && !mime.startsWith('image/')) {
    return { blob: file, mimeType: mime, compressed: false };
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return { blob: file, mimeType: mime || 'image/jpeg', compressed: false };
    }

    const compressedDataUrl = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const srcW = img.width || maxEdge;
        const srcH = img.height || maxEdge;
        const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
        const width = Math.max(1, Math.round(srcW * scale));
        const height = Math.max(1, Math.round(srcH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });

    if (!compressedDataUrl) {
      return { blob: file, mimeType: mime || 'image/jpeg', compressed: false };
    }

    const blob = dataUrlToBlob(compressedDataUrl, 'image/jpeg');
    return { blob, mimeType: 'image/jpeg', compressed: true };
  } catch (err) {
    console.warn('[DeliveryUpload] Kompression übersprungen:', err);
    return { blob: file, mimeType: mime || 'image/jpeg', compressed: false };
  }
}

export function mapDeliveryUploadError(error) {
  if (error instanceof DeliveryUploadError) {
    switch (error.kind) {
      case 'file-too-large':
        return 'Die Datei ist zu groß (max. 12 MB). Bitte ein kleineres Foto oder PDF wählen.';
      case 'unsupported-type':
        return 'Bitte ein Foto oder PDF vom Lieferschein oder der Rechnung wählen (JPG, PNG, HEIC oder PDF).';
      case 'offline':
      case 'network':
        return 'Das Laden-iPhone hat kurz die Verbindung verloren. Bitte versuche es noch einmal.';
      case 'timeout':
        return 'Die KI-Analyse hat zu lange gedauert. Bitte manuell erfassen.';
      default:
        return error.message || 'Lieferschein/Rechnung konnte gerade nicht verarbeitet werden. Bitte manuell erfassen.';
    }
  }

  const code = String(error?.code || '').toLowerCase();
  const raw = String(error?.message || error || '').toLowerCase();

  if (code.includes('deadline-exceeded') || raw.includes('timeout') || raw.includes('deadline')) {
    return 'Die KI-Analyse hat zu lange gedauert. Bitte manuell erfassen.';
  }
  if (
    code.includes('unavailable')
    || code.includes('network')
    || raw.includes('network')
    || raw.includes('offline')
    || raw.includes('failed to fetch')
    || typeof navigator !== 'undefined' && navigator.onLine === false
  ) {
    return 'Das Laden-iPhone hat kurz die Verbindung verloren. Bitte versuche es noch einmal.';
  }
  if (raw.includes('zu groß') || raw.includes('too large') || raw.includes('12 mb')) {
    return 'Die Datei ist zu groß (max. 12 MB). Bitte ein kleineres Foto oder PDF wählen.';
  }
  return 'Lieferschein/Rechnung konnte gerade nicht verarbeitet werden. Bitte manuell erfassen.';
}

/**
 * Kompatibilitäts-API für Metzgerei-Foto/PDF-Anhänge im Wareneingang.
 * @returns {{ ok: true, mimeType: string } | { ok: false, message: string }}
 */
export function validateDeliveryUploadFile(file) {
  if (!file) {
    return { ok: false, message: 'Bitte ein Foto oder PDF vom Lieferschein oder der Rechnung wählen.' };
  }
  const size = Number(file.size) || 0;
  if (size <= 0) {
    return { ok: false, message: 'Die Datei ist leer. Bitte ein anderes Foto oder PDF wählen.' };
  }
  if (size > MAX_DELIVERY_FILE_BYTES) {
    return {
      ok: false,
      message: 'Die Datei ist zu groß (max. 12 MB). Bitte ein kleineres Foto oder PDF wählen.',
    };
  }
  if (!isAllowedDeliveryFile(file)) {
    return {
      ok: false,
      message: 'Bitte ein Foto oder PDF vom Lieferschein oder der Rechnung wählen (JPG, PNG, HEIC oder PDF).',
    };
  }
  return { ok: true, mimeType: resolveDeliveryMimeType(file) };
}

export function isPdfMimeType(mimeType) {
  return String(mimeType || '').trim().toLowerCase() === 'application/pdf';
}

function assertOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new DeliveryUploadError('offline', 'Offline');
  }
}

/**
 * Lädt die Datei nach Firebase Storage und liefert den mandantensicheren Pfad.
 */
export async function uploadDeliveryNoteToStorage({
  file,
  tenantId,
  getFirebase,
} = {}) {
  assertOnline();

  if (!isAllowedDeliveryFile(file)) {
    throw new DeliveryUploadError('unsupported-type', 'Unsupported file');
  }

  const sourceSize = Number(file?.size) || 0;
  if (sourceSize > MAX_DELIVERY_FILE_BYTES) {
    throw new DeliveryUploadError('file-too-large', 'File too large');
  }

  const firebase = typeof getFirebase === 'function' ? getFirebase() : null;
  if (!firebase?.storage) {
    throw new DeliveryUploadError('generic', 'Foto-Speicher ist gerade nicht bereit.');
  }

  const cleanTenant = String(tenantId || getAuthContext()?.tenantId || '').trim();
  if (!cleanTenant) {
    throw new DeliveryUploadError('generic', 'Mandant fehlt für den Lieferschein-Upload.');
  }

  const { blob, mimeType, compressed } = await compressDeliveryImageIfNeeded(file);
  if ((Number(blob.size) || 0) > MAX_DELIVERY_FILE_BYTES) {
    throw new DeliveryUploadError('file-too-large', 'File too large after compress');
  }

  let uploadName = String(file?.name || 'lieferschein.jpg');
  if (compressed) {
    const base = uploadName.replace(/\.[^.]+$/, '') || 'lieferschein';
    uploadName = `${base}.jpg`;
  }

  const storagePath = buildDeliveryNoteStoragePath(cleanTenant, uploadName);
  const ref = firebase.storage().ref(storagePath);

  try {
    console.info('[DeliveryUpload] Storage-Upload start', {
      tenantId: cleanTenant,
      storagePath,
      mimeType,
      compressed,
      bytes: blob.size,
    });
    await ref.put(blob, { contentType: mimeType });
    console.info('[DeliveryUpload] Storage-Upload fertig', { storagePath });
  } catch (err) {
    console.error('[DeliveryUpload] Storage-Upload fehlgeschlagen:', err);
    const mappedKind = (typeof navigator !== 'undefined' && navigator.onLine === false)
      ? 'offline'
      : 'network';
    throw new DeliveryUploadError(
      mappedKind,
      'Storage upload failed',
      err,
    );
  }

  return {
    storagePath,
    mimeType,
    tenantId: cleanTenant,
    downloadUrl: '',
  };
}

/**
 * Upload + Callable parseDeliveryNote (nur Storage-Pfad, kein Base64).
 */
export async function analyzeDeliveryNoteFile({
  file,
  tenantId,
  getFirebase,
  callableTimeoutMs = 120000,
} = {}) {
  assertOnline();

  const upload = await uploadDeliveryNoteToStorage({ file, tenantId, getFirebase });
  const firebase = typeof getFirebase === 'function' ? getFirebase() : null;
  if (!firebase?.app && !firebase?.functions) {
    throw new DeliveryUploadError('generic', 'Lieferschein-Einlesen ist gerade nicht bereit.');
  }

  const callable = createHttpsCallable(
    'parseDeliveryNote',
    { timeout: callableTimeoutMs },
    firebase,
  );
  await waitForAppCheckReady();

  try {
    console.info('[DeliveryUpload] parseDeliveryNote start', {
      storagePath: upload.storagePath,
      mimeType: upload.mimeType,
    });
    const result = await callable({
      storagePath: upload.storagePath,
      mimeType: upload.mimeType,
    });
    console.info('[DeliveryUpload] parseDeliveryNote fertig', {
      itemCount: Array.isArray(result?.data?.items) ? result.data.items.length : 0,
    });
    return {
      items: Array.isArray(result?.data?.items) ? result.data.items : [],
      storagePath: upload.storagePath,
      mimeType: upload.mimeType,
      raw: result?.data || null,
    };
  } catch (err) {
    console.error('[DeliveryUpload] parseDeliveryNote fehlgeschlagen:', err);
    const code = String(err?.code || '').toLowerCase();
    const raw = String(err?.message || '').toLowerCase();
    if (code.includes('deadline-exceeded') || raw.includes('timeout') || raw.includes('deadline')) {
      throw new DeliveryUploadError('timeout', 'KI timeout', err);
    }
    if (
      code.includes('unavailable')
      || code.includes('network')
      || raw.includes('network')
      || raw.includes('offline')
      || (typeof navigator !== 'undefined' && navigator.onLine === false)
    ) {
      throw new DeliveryUploadError('network', 'Network error', err);
    }
    throw err;
  }
}
