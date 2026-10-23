import { parseBarcodeScan } from './barcode-normalize.js';

const WEBRTC_ADAPTER_SCRIPT_URL = './libs/webrtc-adapter.min.js';
const ZXING_BROWSER_SCRIPT_URL = './libs/zxing-browser.min.js';
const QUAGGA_SCRIPT_URL = './libs/quagga2.min.js';

let activeCameraStream = null;
let lastScanExtras = null;
let scanSimulationTimeout = null;
let scanAnimationFrame = null;
let barcodeDetector = null;
let html5QrCode = null;
let zxingReader = null;
let zxingControls = null;
let scannerRunning = false;
let quaggaActive = false;
let quaggaTimeout = null;
let zxingTimeout = null;
let zxingLoadPromise = null;
let quaggaLoadPromise = null;
let adapterLoadPromise = null;
let scannerSessionId = 0;
let scannerStartPromise = null;
let lastAcceptedCode = '';
let lastAcceptedAt = 0;
let resumeScannerTimer = null;
const SCAN_DEBOUNCE_MS = 1100;

function detectCameraAvailability() {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');
}

export function refreshCameraAvailability() {
  window.isCameraAvailable = detectCameraAvailability();
  return window.isCameraAvailable;
}

if (typeof window !== 'undefined') {
  refreshCameraAvailability();
}

let scannerContext = {
  onScanSuccess: () => {},
  onScanError: () => {},
  onStatusChange: () => {},
  onSound: () => {},
  elements: {},
};

export function initScannerEngine({
  onScanSuccess,
  onScanError,
  onStatusChange,
  onSound,
  elements,
} = {}) {
  try {
    scannerContext = {
      onScanSuccess: typeof onScanSuccess === 'function' ? onScanSuccess : scannerContext.onScanSuccess,
      onScanError: typeof onScanError === 'function' ? onScanError : scannerContext.onScanError,
      onStatusChange: typeof onStatusChange === 'function' ? onStatusChange : scannerContext.onStatusChange,
      onSound: typeof onSound === 'function' ? onSound : scannerContext.onSound,
      elements: elements || scannerContext.elements,
    };
    refreshCameraAvailability();
  } catch (err) {
    window.isCameraAvailable = false;
    console.warn('[CharcuLogic Scanner] Initialisierung abgefangen:', err);
  }
}

export function isScannerRunning() {
  return scannerRunning;
}

export function isScannerOverlayOpen() {
  const { scannerOverlay } = getElements();
  if (!scannerOverlay) return false;
  const display = scannerOverlay.style.display;
  if (display === 'none') return false;
  if (display === 'block' || display === 'flex') return true;
  return window.getComputedStyle?.(scannerOverlay)?.display !== 'none';
}

/** Pause detections briefly (e.g. after a hit) without tearing down the camera. */
export function pauseScannerListening() {
  scannerRunning = false;
}

/**
 * Resume barcode listening if the scanner overlay is still open.
 * Used for Wareneingang serien-scans without closing the camera UI.
 */
export function resumeScannerListening(delayMs = 900) {
  if (resumeScannerTimer) {
    clearTimeout(resumeScannerTimer);
    resumeScannerTimer = null;
  }
  const sessionId = scannerSessionId;
  resumeScannerTimer = setTimeout(() => {
    resumeScannerTimer = null;
    if (sessionId !== scannerSessionId) return;
    if (!isScannerOverlayOpen()) return;
    scannerRunning = true;
    setScannerStatus('Bereit für den nächsten Scan.', 'Scanner bereit');
  }, Math.max(0, Number(delayMs) || 0));
}

function getElements() {
  const configured = scannerContext.elements || {};
  return {
    scannerOverlay: configured.scannerOverlay || document.getElementById('scanner-overlay'),
    previewVideo: configured.previewVideo || document.getElementById('preview-video'),
    quaggaReader: configured.quaggaReader || document.getElementById('quagga-reader'),
    html5Reader: configured.html5Reader || document.getElementById('html5-reader'),
    scannerManualEntry: configured.scannerManualEntry || document.getElementById('scanner-manual-entry'),
    btnManualBarcode: configured.btnManualBarcode || document.getElementById('btn-manual-barcode'),
    manualBarcodeInput: configured.manualBarcodeInput || document.getElementById('scanner-manual-barcode-input'),
  };
}

function setScannerStatus(message, status = null) {
  scannerContext.onStatusChange({ message, status });
}

function reportScanError(title, message, icon = '!') {
  scannerContext.onScanError({ title, message, icon });
}

function cleanScannedBarcode(rawCode) {
  return parseBarcodeScan(rawCode).ean;
}

/**
 * Letzte GS1-Zusatzfelder vom Kamerascan (MHD/Charge), falls vorhanden.
 * @returns {{ bestBeforeIso?: string, expiryIso?: string, lot?: string, isGs1?: boolean }|null}
 */
export function getLastScanExtras() {
  return lastScanExtras;
}

function isMhdMonitorPageActive() {
  return Boolean(document.getElementById('page-mhd')?.classList.contains('active'));
}

function openExistingMhdBatches(code) {
  if (!isMhdMonitorPageActive()) return false;
  const openInspection = window.openMhdBatchInspection;
  if (typeof openInspection !== 'function') return false;
  return openInspection(code) === true;
}

function emitScanSuccess(decodedText) {
  if (!scannerRunning) return;
  const parsed = parseBarcodeScan(decodedText);
  const code = parsed.ean;
  if (!code) return;
  const now = Date.now();
  if (code === lastAcceptedCode && (now - lastAcceptedAt) < SCAN_DEBOUNCE_MS) return;
  lastAcceptedCode = code;
  lastAcceptedAt = now;
  lastScanExtras = parsed.isGs1
    ? {
        bestBeforeIso: parsed.bestBeforeIso,
        expiryIso: parsed.expiryIso,
        lot: parsed.lot,
        isGs1: true,
        gtin: parsed.gtin,
      }
    : null;
  scannerRunning = false;
  clearDetectionTimeouts();
  let opened = false;
  try {
    opened = openExistingMhdBatches(code);
  } catch (err) {
    console.warn('[CharcuLogic Scanner] Multi-MHD-Stichprobe fehlgeschlagen:', err);
  }
  if (opened) {
    closeScanner();
    return;
  }
  scannerContext.onScanSuccess(code, lastScanExtras);
}

function clearDetectionTimeouts() {
  if (scanSimulationTimeout) {
    clearTimeout(scanSimulationTimeout);
    scanSimulationTimeout = null;
  }
  if (scanAnimationFrame) {
    cancelAnimationFrame(scanAnimationFrame);
    scanAnimationFrame = null;
  }
  if (quaggaTimeout) {
    clearTimeout(quaggaTimeout);
    quaggaTimeout = null;
  }
  if (zxingTimeout) {
    clearTimeout(zxingTimeout);
    zxingTimeout = null;
  }
}

export function resetScannerState() {
  scannerRunning = false;
  clearDetectionTimeouts();
}

export async function openScanner() {
  if (scannerStartPromise) return scannerStartPromise;
  const sessionId = ++scannerSessionId;
  scannerStartPromise = openScannerSession(sessionId)
    .catch((err) => {
      window.isCameraAvailable = false;
      console.warn('[CharcuLogic Scanner] Scanner-Start abgefangen:', err);
      reportScanError('Kamera nicht verfuegbar', 'Scanner konnte nicht gestartet werden. Bitte Barcode manuell eintippen.');
      setScannerStatus('Kamera nicht verfuegbar. Bitte eintippen.', 'Kamera blockiert');
    })
    .finally(() => {
      if (scannerSessionId === sessionId) scannerStartPromise = null;
    });
  return scannerStartPromise;
}

async function openScannerSession(sessionId) {
  const {
    scannerOverlay,
    previewVideo,
    quaggaReader,
    html5Reader,
    scannerManualEntry,
    btnManualBarcode,
    manualBarcodeInput,
  } = getElements();
  if (!scannerOverlay || !previewVideo) return;

  scannerOverlay.style.display = 'block';
  previewVideo.style.display = 'none';
  scannerManualEntry?.classList.remove('is-open');
  btnManualBarcode?.classList.remove('hidden');
  if (manualBarcodeInput) manualBarcodeInput.value = '';
  setScannerStatus('Scanner wird vorbereitet...', 'Scanner wird vorbereitet');
  scannerContext.onSound(1200, 0.05, 0.15);

  if (window.isSecureContext === false) {
    setScannerStatus('Kamera braucht HTTPS. Bitte die https://... Adresse oeffnen.', 'Unsichere Seite');
    return;
  }

  if (!refreshCameraAvailability()) {
    reportScanError(
      'Kamera nicht verfuegbar',
      'Kamera-Zugriff wird von diesem Browser im Offline-Modus nicht unterstuetzt. Bitte Barcode manuell eintippen.'
    );
    setScannerStatus('Kamera nicht verfuegbar. Bitte eintippen.', 'Kamera blockiert');
    return;
  }

  try {
    const testStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    testStream.getTracks().forEach((t) => t.stop());
    window.isCameraAvailable = true;
  } catch (camErr) {
    window.isCameraAvailable = false;
    const isDenied = camErr?.name === 'NotAllowedError' || camErr?.name === 'PermissionDeniedError';
    const msg = isDenied
      ? 'Kamera-Zugriff wurde verweigert. Bitte in den Einstellungen erlauben oder Barcode eintippen.'
      : 'Kamera konnte nicht gestartet werden. Bitte Barcode manuell eintippen.';
    reportScanError('Kamera-Fehler', msg);
    setScannerStatus(msg, 'Kamera blockiert');
    return;
  }

  const zxingReady = await loadZxingLibrary();
  if (sessionId !== scannerSessionId) return;
  if (zxingReady) {
    if (quaggaReader) quaggaReader.style.display = 'none';
    if (html5Reader) html5Reader.style.display = 'none';
    previewVideo.style.display = 'block';
    startZxingScanner();
    return;
  }

  const quaggaReady = await loadQuaggaLibrary();
  if (sessionId !== scannerSessionId) return;
  if (quaggaReady && quaggaReader) {
    quaggaReader.style.display = 'block';
    if (html5Reader) html5Reader.style.display = 'none';
    startQuaggaScanner();
    return;
  }

  if (typeof Html5Qrcode !== 'undefined' && html5Reader) {
    if (quaggaReader) quaggaReader.style.display = 'none';
    html5Reader.style.display = 'block';
    startHtml5QrScanner();
    return;
  }

  reportScanError("Scanner fehlt", "Die Barcode-Bibliothek wurde nicht geladen.");
  setScannerStatus('Scanner konnte nicht geladen werden.', 'Scanner fehlt');
}

export function closeScanner() {
  const { scannerOverlay, previewVideo, html5Reader, quaggaReader } = getElements();
  scannerSessionId += 1;
  scannerStartPromise = null;
  scannerRunning = false;
  if (resumeScannerTimer) {
    clearTimeout(resumeScannerTimer);
    resumeScannerTimer = null;
  }
  clearDetectionTimeouts();
  stopZxingScanner();

  if (html5QrCode) {
    const scanner = html5QrCode;
    html5QrCode = null;
    scanner.stop()
      .then(() => scanner.clear())
      .catch((err) => console.warn('[CharcuLogic Scanner] html5-qrcode konnte nicht gestoppt werden:', err));
  }

  stopQuaggaScanner();

  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach((track) => track.stop());
    activeCameraStream = null;
  }

  if (previewVideo) {
    previewVideo.srcObject = null;
    previewVideo.style.display = 'block';
  }

  if (html5Reader) {
    html5Reader.style.display = 'none';
    html5Reader.innerHTML = '';
  }

  if (quaggaReader) {
    quaggaReader.style.display = 'none';
    quaggaReader.innerHTML = '';
  }

  if (scannerOverlay) {
    scannerOverlay.style.display = 'none';
  }

  scannerContext.onSound(700, 0.04, 0.12);
}

function loadExternalScript(src, id, timeoutMs = 4000) {
  const existing = document.getElementById(id);
  if (existing?.dataset.loaded === 'true') return Promise.resolve(true);
  if (!document?.head) return Promise.resolve(false);

  return new Promise((resolve) => {
    const script = existing || document.createElement('script');
    const timeoutId = window.setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      resolve(false);
    }, timeoutMs);

    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      window.clearTimeout(timeoutId);
      script.dataset.loaded = 'true';
      resolve(true);
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve(false);
    };

    if (!existing) document.head.appendChild(script);
  });
}

async function loadQuaggaLibrary() {
  if (typeof Quagga !== 'undefined') return Promise.resolve(true);
  if (quaggaLoadPromise) return quaggaLoadPromise;

  quaggaLoadPromise = (async () => {
    setScannerStatus('Kamera-Kompatibilitaet wird vorbereitet...', 'Scanner wird vorbereitet');
    if (!adapterLoadPromise) {
      adapterLoadPromise = loadExternalScript(WEBRTC_ADAPTER_SCRIPT_URL, 'webrtc-adapter-script', 2500);
    }
    await adapterLoadPromise;

    setScannerStatus('EAN-Scanner wird geladen...', 'Scanner wird geladen');
    const loaded = await loadExternalScript(QUAGGA_SCRIPT_URL, 'quagga2-script', 4500);
    if (!loaded || typeof Quagga === 'undefined') {
      console.warn('[CharcuLogic Scanner] Quagga konnte nicht geladen werden. Fallback aktiv.');
      return false;
    }
    return true;
  })();

  return quaggaLoadPromise;
}

async function loadZxingLibrary() {
  if (typeof ZXingBrowser !== 'undefined') return Promise.resolve(true);
  if (zxingLoadPromise) return zxingLoadPromise;

  zxingLoadPromise = (async () => {
    setScannerStatus('ZXing-Scanner wird geladen...', 'Scanner wird geladen');
    const loaded = await loadExternalScript(ZXING_BROWSER_SCRIPT_URL, 'zxing-browser-script', 6500);
    if (!loaded || typeof ZXingBrowser === 'undefined') {
      console.warn('[CharcuLogic Scanner] ZXing konnte nicht geladen werden. Fallback aktiv.');
      return false;
    }
    return true;
  })();

  return zxingLoadPromise;
}

function stopZxingScanner() {
  if (zxingControls) {
    try {
      zxingControls.stop();
    } catch (err) {
      console.warn('[CharcuLogic Scanner] ZXing konnte nicht gestoppt werden:', err);
    }
    zxingControls = null;
  }
  zxingReader = null;
}

async function startZxingScanner() {
  const { previewVideo, quaggaReader, html5Reader } = getElements();
  if (typeof ZXingBrowser === 'undefined' || !previewVideo) {
    startQuaggaScanner();
    return;
  }

  const sessionId = scannerSessionId;
  scannerRunning = true;
  setScannerStatus('Barcode waagerecht halten. Bei langen Karton-Codes etwas mehr Abstand.', 'ZXing-Scanner aktiv');

  // Bewährte iPhone-Constraints — keine Constructor-Hints (hatten schwarzes Preview verursacht).
  // GS1-Parsing läuft nach dem Decode in barcode-normalize.js.
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      advanced: [
        { focusMode: 'continuous' },
      ],
    },
    audio: false,
  };

  const fallbackConstraints = {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  const markZxingNoHit = () => {
    if (zxingTimeout) clearTimeout(zxingTimeout);
    zxingTimeout = setTimeout(() => {
      if (!scannerRunning) return;
      setScannerStatus('Noch kein Treffer. Bei Umverpackung 25–40 cm Abstand oder EAN unter dem Strichcode eintippen.', 'Kein Barcode erkannt');
    }, 9000);
  };

  const onZxingResult = (result) => {
    if (sessionId !== scannerSessionId) return;
    const raw = result?.getText ? result.getText() : result?.text;
    if (!raw || !scannerRunning) return;
    emitScanSuccess(raw);
  };

  try {
    zxingReader = new ZXingBrowser.BrowserMultiFormatOneDReader();
    zxingControls = await zxingReader.decodeFromConstraints(
      constraints,
      previewVideo,
      onZxingResult
    );
    if (sessionId !== scannerSessionId) {
      zxingControls?.stop?.();
      zxingControls = null;
      return;
    }
    try {
      previewVideo.muted = true;
      previewVideo.setAttribute('playsinline', 'true');
      await previewVideo.play?.();
    } catch (playErr) {
      console.warn('[CharcuLogic Scanner] Video-Play nach ZXing-Start:', playErr);
    }
    markZxingNoHit();
  } catch (err) {
    console.warn('[CharcuLogic Scanner] ZXing Start mit Fokus-Constraint fehlgeschlagen:', err);
    try {
      stopZxingScanner();
      zxingReader = new ZXingBrowser.BrowserMultiFormatOneDReader();
      zxingControls = await zxingReader.decodeFromConstraints(
        fallbackConstraints,
        previewVideo,
        onZxingResult
      );
      if (sessionId !== scannerSessionId) {
        zxingControls?.stop?.();
        zxingControls = null;
        return;
      }
      try {
        previewVideo.muted = true;
        previewVideo.setAttribute('playsinline', 'true');
        await previewVideo.play?.();
      } catch (playErr) {
        console.warn('[CharcuLogic Scanner] Video-Play (Fallback):', playErr);
      }
      markZxingNoHit();
    } catch (fallbackErr) {
      console.warn('[CharcuLogic Scanner] ZXing Start fehlgeschlagen:', fallbackErr);
      stopZxingScanner();
      setScannerStatus('ZXing startet nicht. EAN-Rueckfall wird versucht...', 'Scanner wechselt');
      if (quaggaReader) quaggaReader.style.display = 'block';
      previewVideo.style.display = 'none';
      const quaggaReady = await loadQuaggaLibrary();
      if (quaggaReady) {
        startQuaggaScanner();
      } else if (html5Reader && typeof Html5Qrcode !== 'undefined') {
        if (quaggaReader) quaggaReader.style.display = 'none';
        html5Reader.style.display = 'block';
        startHtml5QrScanner();
      } else {
        setScannerStatus('Kamera-Scanner konnte nicht geladen werden. Bitte eintippen.', 'Scanner fehlt');
      }
    }
  }
}

function handleQuaggaDetected(result) {
  if (!scannerRunning) return;

  const raw = result?.codeResult?.code;
  if (!raw || !cleanScannedBarcode(raw)) return;

  emitScanSuccess(raw);
}

function stopQuaggaScanner() {
  if (!quaggaActive || typeof Quagga === 'undefined') return;

  try {
    Quagga.offDetected(handleQuaggaDetected);
    Quagga.stop();
  } catch (err) {
    console.warn('[CharcuLogic Scanner] Quagga konnte nicht gestoppt werden:', err);
  } finally {
    quaggaActive = false;
  }
}

function startQuaggaScanner() {
  const { quaggaReader, html5Reader } = getElements();
  if (!quaggaReader || typeof Quagga === 'undefined') {
    startHtml5QrScanner();
    return;
  }

  const sessionId = scannerSessionId;
  scannerRunning = true;
  setScannerStatus('Barcode waagerecht halten. Lange Karton-Codes: mehr Abstand.', 'EAN-Scanner aktiv');
  quaggaReader.innerHTML = '';

  const workerCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: quaggaReader,
      constraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 1.3333333 },
      },
      // Etwas breitere Zone für lange GS1-128, ohne das Preview zu sprengen.
      area: {
        top: '34%',
        right: '2%',
        left: '2%',
        bottom: '34%',
      },
    },
    locator: {
      patchSize: 'large',
      halfSample: false,
    },
    numOfWorkers: workerCount,
    frequency: 12,
    decoder: {
      readers: [
        'code_128_reader',
        'ean_reader',
        'ean_8_reader',
        'upc_reader',
        'upc_e_reader',
        'code_39_reader',
        'i2of5_reader',
      ],
      multiple: false,
    },
    locate: true,
  }, (err) => {
    if (sessionId !== scannerSessionId) {
      quaggaActive = false;
      return;
    }
    if (err) {
      console.warn('[CharcuLogic Scanner] Quagga Start fehlgeschlagen:', err);
      quaggaActive = false;
      setScannerStatus('EAN-Scanner startet nicht. Rueckfall wird versucht...', 'Scanner wechselt');
      if (quaggaReader) quaggaReader.style.display = 'none';
      if (html5Reader) html5Reader.style.display = 'block';
      startHtml5QrScanner();
      return;
    }

    quaggaActive = true;
    Quagga.offDetected(handleQuaggaDetected);
    Quagga.onDetected(handleQuaggaDetected);
    Quagga.start();

    if (quaggaTimeout) clearTimeout(quaggaTimeout);
    quaggaTimeout = setTimeout(() => {
      if (!scannerRunning) return;
      setScannerStatus('Noch kein Treffer. Bei Umverpackung 25–40 cm Abstand oder Zahl unter dem Strichcode eintippen.', 'Kein Barcode erkannt');
    }, 9000);
  });
}

async function preferredHtml5CameraConfig() {
  try {
    const cameras = await Html5Qrcode.getCameras();
    const backCamera = cameras.find((camera) =>
      /back|rear|environment|rück|rueck|kamera 0/i.test(camera.label || '')
    ) || cameras[cameras.length - 1];

    if (backCamera?.id) {
      return { deviceId: { exact: backCamera.id } };
    }
  } catch (err) {
    console.warn('[CharcuLogic Scanner] Kameraliste konnte nicht gelesen werden:', err);
  }

  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

async function startHtml5QrScanner() {
  const { html5Reader } = getElements();
  if (!html5Reader || typeof Html5Qrcode === 'undefined') return;

  const sessionId = scannerSessionId;
  scannerRunning = true;
  setScannerStatus('Fallback-Scanner aktiv. Lange Karton-Codes: mehr Abstand.', 'Scanner aktiv');
  html5QrCode = new Html5Qrcode('html5-reader', {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
    ],
    useBarCodeDetectorIfSupported: false,
    verbose: false,
  });

  try {
    const cameraConfig = await preferredHtml5CameraConfig();
    if (sessionId !== scannerSessionId) return;
    const videoConstraints = {
      ...cameraConfig,
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
    };
    await html5QrCode.start(
      cameraConfig,
      {
        fps: 24,
        qrbox: (viewfinderWidth, viewfinderHeight) => ({
          width: Math.min(Math.floor(viewfinderWidth * 0.96), 800),
          height: Math.max(90, Math.min(Math.floor(viewfinderHeight * 0.2), 180)),
        }),
        aspectRatio: 1.3333333,
        disableFlip: true,
        rememberLastUsedCamera: true,
        videoConstraints,
      },
      (decodedText) => {
        if (sessionId !== scannerSessionId) return;
        emitScanSuccess(decodedText);
      },
      () => {}
    );
    if (sessionId !== scannerSessionId && html5QrCode) {
      const staleScanner = html5QrCode;
      html5QrCode = null;
      staleScanner.stop().then(() => staleScanner.clear()).catch(() => {});
    }
  } catch (err) {
    console.warn('[CharcuLogic Scanner] html5-qrcode Start fehlgeschlagen:', err);
    reportScanError("Scanner nicht verfügbar", "Der Kamera-Scanner konnte nicht gestartet werden.");
    setScannerStatus('Scanner konnte nicht gestartet werden.', 'Scanner nicht verfügbar');
    closeScanner();
  }
}

async function ensureBarcodeDetector() {
  if (barcodeDetector) return barcodeDetector;
  if (!('BarcodeDetector' in window)) return null;

  try {
    barcodeDetector = new BarcodeDetector({
      formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf']
    });
  } catch (err) {
    barcodeDetector = new BarcodeDetector();
  }
  return barcodeDetector;
}

async function startBarcodeDetection() {
  const { previewVideo } = getElements();
  const detector = await ensureBarcodeDetector();
  if (!detector) {
    reportScanError("Scanner nicht verfügbar", "Dieser Browser kann Barcodes mit der Kamera nicht direkt lesen.");
    setScannerStatus('Scanner nicht verfügbar', 'Scanner nicht verfügbar');
    return;
  }

  scannerRunning = true;
  setScannerStatus('Scanner aktiv', 'Scanner aktiv');

  const scanFrame = async () => {
    if (!scannerRunning) return;

    if (!previewVideo || previewVideo.readyState < 2) {
      scanAnimationFrame = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const barcodes = await detector.detect(previewVideo);
      const rawValue = barcodes?.[0]?.rawValue;
      if (rawValue && cleanScannedBarcode(rawValue)) {
        emitScanSuccess(rawValue);
        return;
      }
    } catch (err) {
      console.warn('[CharcuLogic Scanner] Barcode-Erkennung fehlgeschlagen:', err);
    }

    if (scannerRunning) scanAnimationFrame = requestAnimationFrame(scanFrame);
  };

  scanAnimationFrame = requestAnimationFrame(scanFrame);
}
