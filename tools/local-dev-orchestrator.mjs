/**
 * Unified local dev: Firebase emulators + tenant seed + static web server.
 *
 * Usage: npm run dev:local
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIR = path.join(ROOT_DIR, 'web');
const EMULATOR_READY_MARKER = 'All emulators ready!';
const IS_WIN = process.platform === 'win32';

const STEVESHOF_TEST_CREDENTIALS = {
  employeePins: {
    Stephie: '1122',
    Finn: '2233',
    Nicole: '3344',
    Bettina: '4455',
    Heiko: '5566',
    Paddy: '6677',
  },
  meisterPin: '7788',
};

const managedChildren = [];
let seedStarted = false;
let shuttingDown = false;

function logOrch(message) {
  process.stdout.write(`[ORCH] ${message}\n`);
}

function writePrefixedLine(tag, line, stream = process.stdout) {
  stream.write(`[${tag}] ${line}\n`);
}

function attachPrefixedOutput(child, tag, { onLine } = {}) {
  const handleStream = (stream, outStream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        writePrefixedLine(tag, line, outStream);
        onLine?.(line);
      }
    });
    stream.on('end', () => {
      if (buffer) writePrefixedLine(tag, buffer, outStream);
    });
  };

  if (child.stdout) handleStream(child.stdout, process.stdout);
  if (child.stderr) handleStream(child.stderr, process.stderr);
}

function spawnManaged(command, args, options, tag) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  managedChildren.push(child);
  attachPrefixedOutput(child, tag, options.onLine ? { onLine: options.onLine } : {});
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    writePrefixedLine(tag, `process exited (${reason})`, process.stderr);
    if (tag === 'BACKEND' && code !== 0) {
      shutdown(1);
    }
  });
  return child;
}

function killProcessTree(child) {
  if (!child?.pid) return;
  try {
    if (IS_WIN) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch (_) { /* noop */ }
}

function logSeedCredentials() {
  logOrch('── Test-Zugangsdaten (StevesHof_Hauptbetrieb) ──');
  Object.entries(STEVESHOF_TEST_CREDENTIALS.employeePins).forEach(([name, pin]) => {
    logOrch(`  Mitarbeiter-PIN ${name}: ${pin}`);
  });
  logOrch(`  Meister-PIN: ${STEVESHOF_TEST_CREDENTIALS.meisterPin}`);
  logOrch('── Lokale URLs ──');
  logOrch('  Web-App:     http://127.0.0.1:5173');
  logOrch('  Emulator UI: http://127.0.0.1:4000');
  logOrch('  Käse-Theke:  advancedKaeseUpgrade ist aktiv (branding.js)');
  logOrch('  HACCP-Seed:  team + credentials + haccp_geraete (inkl. Fliegenschutz)');
}

function runSeedBootstrap() {
  if (seedStarted || shuttingDown) return;
  seedStarted = true;
  logOrch('Emulatoren bereit — starte Mandanten-Bootstrap …');

  const seed = spawn(
    process.execPath,
    [
      'tools/seed-tenant-bootstrap.mjs',
      '--tenant=StevesHof_Hauptbetrieb',
      '--all',
    ],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || 'hofsync-production',
        FIREBASE_PROJECT: process.env.FIREBASE_PROJECT || 'hofsync-production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  attachPrefixedOutput(seed, 'SEED');
  seed.on('close', (code) => {
    if (shuttingDown) return;
    if (code === 0) {
      logSeedCredentials();
      logOrch('Bootstrap abgeschlossen. Entwicklungsumgebung läuft — Strg+C zum Beenden.');
    } else {
      writePrefixedLine('SEED', `Bootstrap fehlgeschlagen (code ${code})`, process.stderr);
    }
  });
}

function onEmulatorLine(line) {
  if (!seedStarted && line.includes(EMULATOR_READY_MARKER)) {
    runSeedBootstrap();
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logOrch('Beende lokale Prozesse …');
  for (const child of managedChildren) {
    killProcessTree(child);
  }
  setTimeout(() => process.exit(exitCode), IS_WIN ? 400 : 150);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

logOrch('Starte Firebase-Emulatoren und Web-Server …');
logOrch(`Projektverzeichnis: ${ROOT_DIR}`);

spawnManaged(
  'firebase',
  ['emulators:start'],
  {
    cwd: ROOT_DIR,
    shell: IS_WIN,
    onLine: onEmulatorLine,
  },
  'BACKEND',
);

spawnManaged(
  IS_WIN ? 'python' : 'python3',
  ['-m', 'http.server', '5173', '--bind', '127.0.0.1'],
  {
    cwd: WEB_DIR,
    shell: false,
  },
  'FRONTEND',
);
