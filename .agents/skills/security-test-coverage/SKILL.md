---
name: security-test-coverage
description: >-
  Audits App Check on Callable functions, multi-tenant Vitest isolation, and secret scanning in
  functions/ and rules. Use when adding Cloud Functions, Firestore rules, or security-related tests.
---

# Skill: Firebase Security Test Coverage Auditor

## Purpose

Ensures maximum test coverage for security, tenant isolation, and App Check integration across all backend functions and Firestore rules.

## Core Rules & Constraints

1. **App Check Enforcement:** Verify that every new or modified Callable Cloud Function in `functions/` has `enforceAppCheck: true` configured.

2. **Multi-Tenant Isolation:** Automatically generate Vitest test cases ensuring that data belonging to `StevesHof_Hauptbetrieb` is strictly separated from other tenant IDs. Test for cross-tenant data leakage.

3. **Secret Scanning:** Scan all configurations, bootstrap tools, and environment code for exposed plain-text API keys or client secrets. Alert immediately if a key is found outside the authorized Firebase config structures.