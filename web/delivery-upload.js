/**
 * Helfer für Lieferschein-Foto/PDF-Anhänge im Metzgerei-Wareneingang
 * (ohne KI-/OCR-Analyse — die liegt unter legacy/).
 */

export const MAX_DELIVERY_FILE_BYTES = 12 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif']);

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function showOperatorToast(message) {
  const text = String(message || '').trim();
  if (!text) return;
  window.showToast?.(text, 'warning');
}

/**
 * Wartet, bis Firebase Auth die Sitzung kennt, und holt einen frischen ID-Token.
 */
export async function ensureDeliveryNoteAuth(firebase) {
  const auth = typeof firebase?.auth === 'function' ? firebase.auth() : null;
  if (!auth || typeof auth.onAuthStateChanged !== 'function') {
    showOperatorToast('Bitte zuerst in HofSync anmelden.');
    return null;
  }
  if (!auth.currentUser) {
    await new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }
  if (!auth.currentUser) {
    showOperatorToast('Bitte zuerst in HofSync anmelden.');
    return null;
  }
  if (typeof auth.currentUser.getIdToken === 'function') {
    await auth.currentUser.getIdToken(true);
  }
  return auth.currentUser;
}

export class DeliveryUploadError extends Error {
  /**
   * @param {'file-too-large'|'unsupported-type'|'network'|'timeout'|'offline'|'generic'|'unauthenticated'} kind
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
 * Tenant-isolierter Storage-Pfad (für spätere Büro-/Desktop-Nutzung).
 * Architektur: tenants/{tenantId}/delivery_notes/{timestamp}_{filename}
 */
export function buildDeliveryNoteStoragePath(tenantId, fileName, now = Date.now()) {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) {
    throw new DeliveryUploadError('generic', 'Mandant fehlt für den Lieferschein-Upload.');
  }
  const safeName = sanitizeStorageFileName(fileName);
  return `tenants/${cleanTenant}/delivery_notes/${now}_${safeName}`;
}

/**
 * Kompatibilitäts-API für Metzgerei-Foto/PDF-Anhänge im Wareneingang.
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
  if (size > MAX_DELIVERY_FILE_BYTES) {
    return {
      ok: false,
      message: 'Die Datei ist zu groß (max. 12 MB). Bitte ein kleineres Foto oder PDF wählen.',
    };
  }
  if (!isAllowedDeliveryFile(file)) {
    return {
      ok: false,
      message: 'Bitte ein Foto oder PDF vom Lieferschein wählen (JPG, PNG, HEIC oder PDF).',
    };
  }
  return { ok: true, mimeType: resolveDeliveryMimeType(file) };
}

export function isPdfMimeType(mimeType) {
  return String(mimeType || '').trim().toLowerCase() === 'application/pdf';
}
