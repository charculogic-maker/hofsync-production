const admin = require('firebase-admin');
const { GoogleGenerativeAI, GoogleGenerativeAIFetchError } = require('@google/generative-ai');
const { HttpsError } = require('firebase-functions/v2/https');
const { requireEmployeeAccess, resolveAuthContext } = require('./authContext');

const DELIVERY_NOTE_MODEL = process.env.GEMINI_DELIVERY_NOTE_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = 16 * 1024 * 1024;
const MAX_PARSED_ITEMS = 200;
const MAX_PDF_SCAN_PAGES = 12;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const EXT_TO_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

const DELIVERY_NOTE_PROMPT = [
  'Du bist ein präziser OCR-Parser für den Hofladen-Wareneingang.',
  'Analysiere diesen Lieferschein ODER diese Rechnung (auch mehrseitig, auch Scan/Foto).',
  'Lieferanten können z.B. Weiling, Naturverbund, Stautenhof, Metro oder Jakob Bayen sein.',
  'Extrahiere ALLE Warenpositionen von allen Seiten.',
  'Überspringe Zwischensummen, Fortsetzung-Zeilen, reine Logistikpauschalen,',
  'Pfand-/Leergut-/IFCO-/Rollwagen-/Kisten-Pfand-Positionen und Fußzeilen.',
  'menge: numerische Liefermenge. Nutze die Spalte Menge (Anzahl Gebinde/Stück).',
  'Wenn die Position vor allem als Gewicht geliefert wird (z.B. 5,5 kg), nimm das Gewicht als Zahl.',
  'Dezimalzahlen mit Punkt (nicht Komma).',
  'kategorie: kurze Warengruppe falls erkennbar, sonst leer.',
  "Antworte AUSSCHLIESSLICH mit einem validen JSON-Array im Format:",
  "[{ \"artikel\": \"...\", \"menge\": 2, \"kategorie\": \"...\" }].",
  'Kein Markdown, kein Text drumherum, nur das nackte JSON-Array.',
].join(' ');

function sanitizeGeminiResponseText(responseText) {
  return String(responseText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonArray(responseText) {
  const cleanText = sanitizeGeminiResponseText(responseText);
  if (!cleanText) {
    throw new Error('Gemini lieferte eine leere Antwort.');
  }

  try {
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed)) return parsed;
  } catch (_err) {
    // continue with bracket extraction
  }

  const start = cleanText.indexOf('[');
  const end = cleanText.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Kein JSON-Array in der Gemini-Antwort gefunden.');
  }

  const parsed = JSON.parse(cleanText.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('Gemini-Antwort ist kein JSON-Array.');
  }
  return parsed;
}

function normalizeDeliveryLine(entry, index) {
  const mengeRaw = entry?.menge ?? entry?.quantity ?? entry?.qty ?? 1;
  const menge = Number(mengeRaw);
  return {
    artikel: String(entry?.artikel || entry?.name || entry?.produkt || '').trim(),
    menge: Number.isFinite(menge) && menge > 0 ? menge : 1,
    kategorie: String(entry?.kategorie || entry?.category || '').trim(),
    _index: index,
  };
}

function resolveGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'DEIN_AI_STUDIO_KEY') {
    throw new HttpsError('failed-precondition', 'GEMINI_API_KEY ist nicht konfiguriert.');
  }
  return apiKey;
}

function validateParsedItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_PARSED_ITEMS) {
    throw new HttpsError('invalid-argument', 'Ungültige Artikelliste aus dem Lieferschein/der Rechnung.');
  }
  return items.map((line, index) => {
    const artikel = String(line.artikel || '').trim().slice(0, 200);
    const kategorie = String(line.kategorie || '').trim().slice(0, 80);
    const menge = Number(line.menge);
    if (!artikel) {
      throw new HttpsError('invalid-argument', `Artikel in Zeile ${index + 1} fehlt.`);
    }
    if (!Number.isFinite(menge) || menge <= 0 || menge > 99999) {
      throw new HttpsError('invalid-argument', `Ungültige Menge in Zeile ${index + 1}.`);
    }
    return { artikel, menge, kategorie };
  });
}

/**
 * Scan-PDFs (z. B. Weiling-Rechnung) speichern Seiten oft als DCTDecode-JPEGs.
 * Gemini liest solche PDFs als application/pdf unzuverlässig – Seitenbilder sind robuster.
 * @param {Buffer|Uint8Array} pdfBuffer
 * @returns {Buffer[]}
 */
function extractEmbeddedJpegPages(pdfBuffer) {
  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer || []);
  if (buf.length < 32) return [];

  const marker = Buffer.from('DCTDecode');
  const streamCrLf = Buffer.from('stream\r\n');
  const streamLf = Buffer.from('stream\n');
  const endstream = Buffer.from('endstream');
  const pages = [];
  let pos = 0;

  while (pos < buf.length && pages.length < MAX_PDF_SCAN_PAGES) {
    const markerAt = buf.indexOf(marker, pos);
    if (markerAt < 0) break;

    let streamAt = buf.indexOf(streamCrLf, markerAt);
    let headerLen = 8;
    if (streamAt < 0 || streamAt - markerAt > 800) {
      streamAt = buf.indexOf(streamLf, markerAt);
      headerLen = 7;
    }
    if (streamAt < 0 || streamAt - markerAt > 800) {
      pos = markerAt + marker.length;
      continue;
    }

    const dataStart = streamAt + headerLen;
    const dataEnd = buf.indexOf(endstream, dataStart);
    if (dataEnd < 0) {
      pos = markerAt + marker.length;
      continue;
    }

    let jpeg = buf.subarray(dataStart, dataEnd);
    if (jpeg[0] === 0x0d && jpeg[1] === 0x0a) jpeg = jpeg.subarray(2);
    else if (jpeg[0] === 0x0a) jpeg = jpeg.subarray(1);
    if (jpeg[jpeg.length - 1] === 0x0a) jpeg = jpeg.subarray(0, jpeg.length - 1);
    if (jpeg[jpeg.length - 1] === 0x0d) jpeg = jpeg.subarray(0, jpeg.length - 1);

    if (jpeg.length > 512 && jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[jpeg.length - 2] === 0xff && jpeg[jpeg.length - 1] === 0xd9) {
      pages.push(Buffer.from(jpeg));
    }
    pos = markerAt + marker.length;
  }

  return pages;
}

/**
 * Baut Gemini-Parts: Scan-PDF → Seiten-JPEGs; sonst eine Datei.
 * @param {string} imageBase64
 * @param {string} mimeType
 */
function buildGenerativeContentParts(imageBase64, mimeType = 'image/jpeg') {
  const mime = normalizeMimeType(mimeType);
  const parts = [{ text: DELIVERY_NOTE_PROMPT }];

  if (mime === 'application/pdf') {
    const pdfBuffer = Buffer.from(String(imageBase64 || ''), 'base64');
    const jpegPages = extractEmbeddedJpegPages(pdfBuffer);
    if (jpegPages.length > 0) {
      console.log('[parseDeliveryNote] Scan-PDF: Seiten als JPEG an KI', {
        pageCount: jpegPages.length,
        pageBytes: jpegPages.map((page) => page.length),
      });
      for (const page of jpegPages) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: page.toString('base64'),
          },
        });
      }
      return { parts, transport: 'pdf-scan-jpeg-pages', pageCount: jpegPages.length };
    }
  }

  parts.push({
    inlineData: {
      mimeType: mime,
      data: String(imageBase64 || ''),
    },
  });
  return { parts, transport: mime, pageCount: 1 };
}

function normalizeMimeType(mimeType, storagePath = '') {
  let mime = String(mimeType || '').trim().toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (mime && mime !== 'application/octet-stream' && ALLOWED_MIME_TYPES.has(mime)) {
    return mime;
  }
  const extMatch = String(storagePath || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  const fromExt = extMatch ? EXT_TO_MIME[extMatch[1]] : '';
  if (fromExt) return fromExt;
  return mime || 'image/jpeg';
}

function assertAllowedMimeType(mimeType) {
  const mime = normalizeMimeType(mimeType);
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new HttpsError('invalid-argument', 'Dateityp nicht erlaubt.');
  }
  return mime;
}

/**
 * Erzwingt tenants/{tenantId}/… und blockiert Path-Traversal / Cross-Tenant.
 */
function assertTenantStoragePath(tenantId, storagePath) {
  const cleaned = String(storagePath || '').trim().replace(/^\/+/, '');
  const prefix = `tenants/${tenantId}/`;
  if (!cleaned || !cleaned.startsWith(prefix)) {
    throw new HttpsError('permission-denied', 'Speicherpfad gehört nicht zu diesem Mandanten.');
  }
  if (cleaned.includes('..') || cleaned.includes('\\')) {
    throw new HttpsError('invalid-argument', 'Ungültiger Speicherpfad.');
  }
  if (!cleaned.startsWith(`${prefix}delivery_notes/`)) {
    throw new HttpsError('invalid-argument', 'Speicherpfad muss unter delivery_notes liegen.');
  }
  return cleaned;
}

async function loadImageFromStorage(tenantId, storagePath) {
  const cleaned = assertTenantStoragePath(tenantId, storagePath);
  console.log('[parseDeliveryNote] Storage-Pfad verifiziert', { tenantId, storagePath: cleaned });

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(cleaned);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'Lieferschein-Datei wurde nicht gefunden.');
    }
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const mimeType = assertAllowedMimeType(
      normalizeMimeType(metadata?.contentType, cleaned),
    );
    const imageBase64 = buffer.toString('base64');
    if (!imageBase64 || imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    return { imageBase64, mimeType, storagePath: cleaned };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[parseDeliveryNote] Storage-Download fehlgeschlagen:', error?.message || error);
    throw new HttpsError('internal', 'Lieferschein konnte nicht aus dem Speicher geladen werden.');
  }
}

async function resolveImagePayload(requestData, tenantId) {
  const imageBase64 = String(
    requestData?.imageBase64
    || requestData?.imageBytes
    || '',
  ).trim();
  const storagePath = String(requestData?.storagePath || requestData?.imagePath || '').trim();
  const mimeHint = String(requestData?.mimeType || '').trim().toLowerCase();

  if (storagePath) {
    return loadImageFromStorage(tenantId, storagePath);
  }

  if (imageBase64) {
    if (imageBase64.length < 32) {
      throw new HttpsError('invalid-argument', 'Bilddaten fehlen oder sind zu kurz.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Bild ist zu groß (max. 12 MB).');
    }
    const mimeType = assertAllowedMimeType(normalizeMimeType(mimeHint || 'image/jpeg'));
    return { imageBase64, mimeType, storagePath: '' };
  }

  throw new HttpsError('invalid-argument', 'Bilddaten oder Speicherpfad fehlen.');
}

async function parseWithGemini(model, parts, meta = {}) {
  try {
    const result = await model.generateContent(parts);
    const responseText = result?.response?.text?.() || '';
    return extractJsonArray(responseText)
      .map(normalizeDeliveryLine)
      .filter((line) => line.artikel);
  } catch (error) {
    console.error('[parseDeliveryNote] Gemini-Fehler:', {
      message: error?.message,
      status: error?.status,
      isFetchError: error instanceof GoogleGenerativeAIFetchError,
      ...meta,
    });
    throw new HttpsError('internal', 'Lieferschein/Rechnung konnte nicht analysiert werden.');
  }
}

async function parseDeliveryNoteImage(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = resolveGeminiApiKey();
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: DELIVERY_NOTE_MODEL,
    generationConfig: { temperature: 0.1 },
  });

  const { parts, transport, pageCount } = buildGenerativeContentParts(imageBase64, mimeType);
  const promptPart = parts[0];
  const mediaParts = parts.slice(1);

  console.log('[parseDeliveryNote] OCR/KI-Extraktion gestartet', {
    model: DELIVERY_NOTE_MODEL,
    mimeType,
    transport,
    pageCount,
    mediaParts: mediaParts.length,
    base64Length: imageBase64?.length || 0,
  });

  /** Mehrseitige Scan-Rechnungen: 2 Seiten pro Aufruf (Timeout/Payload). */
  const BATCH_SIZE = 2;
  const parsed = [];

  if (mediaParts.length <= BATCH_SIZE) {
    parsed.push(...await parseWithGemini(model, parts, { transport, pageCount, batch: 'all' }));
  } else {
    for (let offset = 0; offset < mediaParts.length; offset += BATCH_SIZE) {
      const batchMedia = mediaParts.slice(offset, offset + BATCH_SIZE);
      const batchIndex = Math.floor(offset / BATCH_SIZE) + 1;
      console.log('[parseDeliveryNote] Seiten-Batch', {
        batchIndex,
        pages: `${offset + 1}-${offset + batchMedia.length}`,
        of: mediaParts.length,
      });
      const batchItems = await parseWithGemini(
        model,
        [promptPart, ...batchMedia],
        { transport, pageCount, batch: batchIndex },
      );
      parsed.push(...batchItems);
    }
  }

  if (!parsed.length) {
    throw new HttpsError('invalid-argument', 'Keine Artikel auf dem Lieferschein/der Rechnung erkannt.');
  }

  return validateParsedItems(
    parsed.map(({ artikel, menge, kategorie }) => ({ artikel, menge, kategorie })),
  );
}

async function handleParseDeliveryNote(request) {
  // Jeder angemeldete Mitarbeiter/Admin liest den Lieferschein für den
  // eigenen Mandanten ein. Die KI liefert nur die erkannten Posten zurück –
  // ein mandantenübergreifender Zugriff ist dadurch ausgeschlossen.
  const callerContext = resolveAuthContext(request.auth);
  const tenantContext = requireEmployeeAccess(request.auth, callerContext.tenantId);

  console.log('[parseDeliveryNote] Upload empfangen', {
    tenantId: tenantContext.tenantId,
    hasStoragePath: Boolean(request.data?.storagePath || request.data?.imagePath),
    hasBase64: Boolean(request.data?.imageBase64 || request.data?.imageBytes),
    mimeHint: request.data?.mimeType || null,
  });

  const { imageBase64, mimeType, storagePath } = await resolveImagePayload(
    request.data || {},
    tenantContext.tenantId,
  );

  const items = await parseDeliveryNoteImage(imageBase64, mimeType);
  const response = {
    items,
    model: DELIVERY_NOTE_MODEL,
    tenantId: tenantContext.tenantId,
    previewOnly: true,
    storagePath: storagePath || null,
  };

  console.log('[parseDeliveryNote] Ergebnis zurückgesendet', {
    tenantId: tenantContext.tenantId,
    itemCount: items.length,
    storagePath: storagePath || null,
  });

  return response;
}

module.exports = {
  DELIVERY_NOTE_MODEL,
  ALLOWED_MIME_TYPES,
  MAX_PARSED_ITEMS,
  assertTenantStoragePath,
  buildGenerativeContentParts,
  extractEmbeddedJpegPages,
  handleParseDeliveryNote,
  normalizeMimeType,
  parseDeliveryNoteImage,
  resolveImagePayload,
  validateParsedItems,
};
