---
name: offline-resilience-checker
description: >-
  Checks offline-first behavior for the Laden-iPhone web app: Firestore persistence, sync queue,
  and graceful MHD/network failures. Use when changing web/sync.js, web/app.js persistence, or
  offlineMessage toasts in MHD, HACCP, orders, or Herkunft/traceability.
---

# Skill: Offline & Sync Resilience Checker

## Purpose

Guarantees the mobile frontend (iPhone) remains fully operational and resilient during unstable Wi-Fi or cellular connections in cold storage or farm shop environments.

## When to Use

Activate this skill when changing Firestore init, sync queue logic, MHD/HACCP/production/customer-order/traceability mutations, sync status UI, or offline toast/HUD messaging in `web/`.

## Core Rules

1. **Local persistence:** Monitor Firestore configuration for local persistence activation. In `web/app.js`, `db.enablePersistence()` must remain enabled (or an equivalent supported API); log and handle `failed-precondition` / multi-tab conflicts without breaking the app shell.

2. **Queued mutations:** Ensure UI operations that write data use the sync engine (`web/sync.js`) or module helpers that enqueue locally instead of crashing when `isFirebaseReady()` is false or the device is offline. Pending items must use **tenant-scoped** keys (`charculogic.pendingSyncs.{tenantId}`).

3. **Graceful disconnect handling:** Verify that network drops during critical actions (MHD status changes, stock updates, HACCP logs, deliveries, customer orders, Herkunft saves) are caught with:
   - `offlineMessage` strings passed into sync helpers (see `web/mhd.js`, `web/haccp.js`, `web/customer-orders.js`, `web/traceability.js`).
   - User-visible retry or queue feedback via `showToast` / sync HUD — no uncaught promise rejections on `offline` events.

4. **Online/offline UX:** `window` `online` / `offline` listeners and sync badge states (`sync-dot--offline`, `SYNC_STATUS.offline` in `web/app.js`) must stay consistent with queue flush behavior in `sync.js`.

5. **QA simulation (localhost only):** When using QA latency/teardown hooks in `sync.js`, confirm production builds have zero overhead and real devices still flush the queue after reconnect.

## Audit Checklist

- [ ] New Firestore writes go through `normalizeTenantCollectionPath()` and sync queue where applicable.
- [ ] Airplane-mode test: MHD action queues, toast shows Warteschlange wording, no white screen.
- [ ] Reconnect triggers flush without duplicate writes or lost tenant context.
- [ ] Operator errors from sync use `logAndMapOperatorError(..., 'sync')` — not raw Firebase codes in the UI.
