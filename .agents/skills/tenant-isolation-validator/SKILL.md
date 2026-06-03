---
name: tenant-isolation-validator
description: >-
  Validates absolute Firestore data isolation between Hofladen tenants (e.g. StevesHof_Hauptbetrieb,
  TorFabrik). Use when reviewing queries, security rules, Cloud Functions, storage paths, or tests
  for cross-tenant reads and writes.
---

# Skill: Multi-Tenant Isolation Validator

## Purpose

Ensures absolute data isolation between different shop tenants (e.g., `StevesHof_Hauptbetrieb`, `TorFabrik`) within the multi-tenant architecture.

## When to Use

Activate this skill when adding or reviewing Firestore reads/writes, security rules, Cloud Functions, storage uploads, or Vitest tests that touch tenant-owned data.

## Core Rules

1. **Scan all Firestore access** in frontend (`web/`) and backend (`functions/`) code. Include `onSnapshot`, `get`, `set`, `update`, `add`, `collectionGroup`, and Storage paths.

2. **Enforce tenant-rooted paths:** Every collection, document, or group query must explicitly root from or filter by `/tenants/{tenantId}/`. Prefer existing helpers:
   - Frontend: `getTenantCollection()`, `mhdCollectionPath()`, `normalizeTenantCollectionPath()` in `web/tenant-db.js` and `web/sync.js`.
   - Backend: paths like ``tenants/${tenantId}/...`` with `cleanTenantId()` from `functions/authContext.js`.

3. **Flag loose or global access:** Alert on any read/write that lacks a validated tenant context (e.g. hard-coded collection names, `collection('mhd_liste')` without tenant prefix, or `tenants/{otherId}` when the active session tenant differs). Treat `sync.js` paths that already start with `tenants/` as compliant only if the embedded `tenantId` matches the authenticated tenant.

4. **Cross-tenant test matrix:** For changes under `functions/` or `firestore.rules`, require Vitest cases that prove tenant A cannot read or mutate tenant B data. Reuse patterns from the security-test-coverage skill (`StevesHof_Hauptbetrieb` vs. other tenant IDs).

5. **Documented exceptions:** Global collections (e.g. `priceRuns`, `system_errors`, auth profile lookups) are allowed only when documented and rules-backed. New exceptions need an explicit security review comment in code.

## Audit Checklist

- [ ] Grep for `.collection(` and `.doc(` outside `tenant-db.js` / `sync.js` helpers — each hit must resolve to `tenants/{tenantId}/`.
- [ ] Callable functions validate `tenantId` from auth context, not from unchecked client input alone.
- [ ] Firestore security rules scope reads/writes under `match /tenants/{tenantId}/`.
- [ ] No cross-tenant leakage in localStorage keys (pending sync queues must be tenant-suffixed, as in `web/sync.js`).
