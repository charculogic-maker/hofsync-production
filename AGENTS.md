# AGENTS.md

Guidance for cloud agents working in this repository.

## Cursor Cloud specific instructions

### Branch layout

- **`main`** currently contains only `web/app.js` (monolithic prototype slice). It has no `package.json`, `index.html`, or test harness.
- **`feature/white-label-preparation`** is the full CharcuLogic / HofSync PWA: modular `web/` app, Firebase rules, Cloud Functions, and npm scripts. **Check out this branch before installing dependencies, running tests, or serving the app.**

```bash
git fetch origin feature/white-label-preparation
git checkout feature/white-label-preparation
```

### Product overview

CharcuLogic (HofSync) is a touch-optimized PWA for farm shops and butcher operations: MHD monitoring, goods receiving, production recipes, HACCP, batch traceability, and team board. Frontend is vanilla JavaScript (ES modules) with Firebase (Firestore, Auth, Storage, Cloud Functions). There is no webpack/vite build step for the client.

### Required services (local dev)

| Service | Command | Port |
|---------|---------|------|
| Static web server | `cd web && python3 -m http.server 5173 --bind 127.0.0.1` | 5173 |

Open **http://127.0.0.1:5173/index.html** (prefer `127.0.0.1` over `[::]` / bare localhost).

Firebase (Firestore, Auth) is cloud-hosted. The login overlay ("Betriebs-Login") appears without valid credentials; full E2E flows need a tenant user or device access token. Optional dev overrides on localhost: `?firebase=whitelabel` or `?firebase=production` (see `web/dev-guards.js`).

Cloud Functions and Firebase emulators are optional for frontend-only work.

### Common commands (on `feature/white-label-preparation`)

See [README.md](README.md) for full detail.

| Task | Command |
|------|---------|
| Install root deps | `npm install` |
| Install functions deps | `npm --prefix functions install` |
| Pre-deploy validation (lint/syntax/PWA checks) | `npm run build` |
| Functions security tests | `npm run test:functions:security` |
| Firestore/Storage rules tests | `npm run test:rules` (needs JDK 21+; Firebase CLI via `npx firebase` or global `firebase-tools`) |

Node **20** is specified for Cloud Functions (`functions/package.json`); Node 22 runs with an engine warning. JDK **21+** is required only for `npm run test:rules`.

### Gotchas

- After editing `web/app.js`, `web/mhd.js`, or `web/index.html`, bump `CACHE_NAME` in `web/sw.js` or `npm run build` fails.
- `npm run build` runs `build-data` first and regenerates `web/data/beffe_data.json`.
- Firestore connection errors in the browser console are expected without authentication or when offline; the UI still loads.
- Do not commit `node_modules/`, emulator logs, or regenerated lockfiles unless intentionally updating dependencies.
