---
name: shop-wording-cop
description: >-
  Polishes German UI copy for farm shop staff: bans dev jargon, enforces Laden-iPhone and
  Wir-Perspektive. Use when editing toasts, dialogs, operator-errors.js, or Hofladen manuals.
---

# Skill: Hofladen UX Wording Protector

## Purpose

Polishes user-facing text, error messages, and labels to keep them clear, non-technical, and highly actionable for farm shop staff.

## When to Use

Activate this skill when editing toasts, dialogs, form labels, empty states, sync/HUD messages, `web/operator-errors.js`, or German docs under `docs/` that describe on-device workflows.

## Core Rules

1. **Ban developer jargon** in any UI string visible to Hofladen staff. Do not ship text such as:
   - "Auth Failed", "UNAUTHENTICATED", "Data Out of Sync"
   - "Null Pointer Exception", "PERMISSION_DENIED", "ERR_LLM_VALIDATION_FAILED"
   - English-only technical labels unless they are internal `console.error` logs.

2. **Friendly German alternatives:** Replace with short, actionable copy, for example:
   - Connection loss: *"Das iPhone hat kurz die Verbindung verloren. Bitte versuche es noch einmal."*
   - Queued sync: *"Wird automatisch synchronisiert, sobald WLAN verfügbar ist."* (align with `web/sync.js` / MHD `offlineMessage` tone)
   - Expired session: *"Anmeldung abgelaufen. Bitte erneut anmelden."* (see `mapOperatorError` in `web/operator-errors.js`)

3. **Laden-iPhone terminology:** Maintain the exclusive **"Laden-iPhone"** (or **"iPhone"**) wording for shop devices. Never use **"Tablet"** in user-facing German text or colleague manuals.

4. **Wir-Perspektive:** Use the collective team voice — *"unsere App"*, *"wir scannen"*, *"unser MHD-Monitor"*. Do not address staff as *"Ihr"* / *"Euch"* in in-app copy or Hofladen guides.

5. **Technical detail boundary:** Raw errors belong in `console.error` via `logAndMapOperatorError()`. The UI shows only `mapOperatorError()` results or curated `offlineMessage` strings.

## Audit Checklist

- [ ] Grep new UI strings for English error codes, `Failed`, `Error:`, or stack fragments.
- [ ] Toasts and modals tell the user **what to do next** (retry, wait for WLAN, contact admin).
- [ ] Meat-price, KI, and sync failures use existing operator-error contexts before inventing new phrasing.
- [ ] Documentation changes stay aligned with `hofladen-doc-generator` (device + perspective rules).
