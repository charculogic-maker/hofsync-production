---
name: price-pipeline-auditor
description: >-
  Audits the fetchWeeklyMeatPrices pipeline, Anti-Corruption validation, and ERR_LLM_VALIDATION_FAILED
  failsafe. Use when changing functions/meatPrices.js, Gemini prompts, fleischpreise documents, or
  meat price tests.
---

# Skill: Meat Price Pipeline Auditor

## Purpose

Audits and tests the automated meat price fetching pipeline (`fetchWeeklyMeatPrices`) against structural corruption or edge cases.

## When to Use

Activate this skill when changing `functions/meatPrices.js`, Gemini prompts, price validation, scheduler/cron config, admin Callable triggers, or Firestore documents under `tenants/{tenantId}/fleischpreise/`.

## Core Rules

1. **Anti-Corruption-Guard:** Ensure validation in `validateParsedPrices()` / `normalizePriceEntry()` robustly catches malformed LLM responses:
   - Fewer than `MIN_PRICE_ENTRIES` (3) rows.
   - Prices outside the **0–500 EUR** window (`MAX_PRICE_EUR`, via `isPositiveMarketPrice()`).
   - Missing or empty `category` or `cut` fields.
   - Non-numeric or negative `price_conv` / `price_bio` with neither side valid.

2. **Failsafe fallback:** Verify that on validation or publish failure the pipeline does **not** overwrite `tenants/{tenantId}/fleischpreise/{kw}`. Failed runs must set `priceRuns/{runId}` to `status: 'failed'` with `errorCode: ERR_LLM_VALIDATION_FAILED` (or related codes from `ERROR_CODES`) so the **previous week's prices remain** the live source in the UI.

3. **Success path only writes validated data:** `publishValidatedPrices()` runs only after `validateParsedPrices()` succeeds. Scheduler default tenant (`MEAT_PRICE_TENANT_ID` / `StevesHof_Hauptbetrieb`) must still pass explicit `tenantId` through `executeMeatPriceRun()`.

4. **Regression tests:** Add or extend Vitest coverage for:
   - Valid minimal JSON array (happy path).
   - Markdown-wrapped JSON (`sanitizeGeminiResponseText` / `extractJsonArray`).
   - Corrupt rows triggering `ERR_LLM_VALIDATION_FAILED`.
   - API/parse failures (`ERR_GEMINI_API_FAILED`, `ERR_LLM_PARSE_FAILED`) without Firestore price doc mutation.

5. **Observability:** Confirm `priceRuns` logs include `correlationId`, `targetPath`, and `modelVersion` without leaking raw API keys in client-visible errors.

## Audit Checklist

- [ ] Run or review tests touching `classifyRunError()` and validation edge cases.
- [ ] Manually inspect a failed run doc in `priceRuns` — `fleischpreise/{kw}` unchanged.
- [ ] Callable admin trigger uses authenticated tenant context, not arbitrary tenant override.
- [ ] UI meat-price errors use operator-friendly German (`operator-errors.js`, context `meat-prices`), not raw Gemini stack traces.
