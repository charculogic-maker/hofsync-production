# Herkunft (LMIV / Digitale Thekenklade)

Fleisch-Rückverfolgbarkeit nach LMIV: Etikett fotografieren, Charge und Herkunft erfassen. Der Eintrag erscheint in der digitalen Thekenklade.

> **Tab:** **Herkunft** (untere Leiste, Primärslot) · Unterseiten **Erfassen** / **Thekenklade**  
> **Code:** `web/traceability.js` · Modul-Key `chargenDoku` (Legacy: `traceability`)  
> **Admin-Shortcut:** ⚙️ → **Thekenklade** oder `/#thekenbuch` (≤ 2 Taps)  
> **Nicht verwechseln** mit Büro-**Chargen** (Produktionschargen) — siehe [05-chargen.md](./05-chargen.md).

## Erfassung am Laden-iPhone

1. Tab **Herkunft** öffnen (Profilpflicht wie bei MHD/Neu).
2. Unter **Erfassen**: **📸 Etikett fotografieren / scannen** — Kamera des Laden-iPhones.
3. **Charge / LOT-Nummer** (Pflicht) und optional **Identitätskennzeichen** (oval).
4. Optional **Öko-Kontrollstelle** (z. B. DE-ÖKO-006) und **Bio-Verband**.
5. **Tierart** wählen: Rind · Schwein · Geflügel · Schaf · Ziege.
6. Herkunftsländer setzen und **💾 Herkunft speichern** — Status **aktiv in der Theke**.

Offline: Speicherung lokal, Sync bei WLAN.

## Digitale Thekenklade (Buch)

Pfad: **Herkunft → Thekenklade** (nicht mehr unter `/dev-dashboard`).

- Liste der Herkunftseinträge (LOT / Kennzeichen, Datum)
- Status **Aktiv in Theke** ↔ **Archiviert**
- Detail mit Etikettfoto + LMIV-Daten
- Deep-Link: `/#thekenbuch`

## Technik (Kurz)

| Thema | Wert |
|-------|------|
| Modul-Key | `enabledModules.chargenDoku` (Legacy `traceability`) |
| Firestore | `tenants/{tenantId}/chargendoku/{id}` (+ Legacy `traceabilityRecords`) |
| Storage | `tenants/{tenantId}/traceability/{recordId}.jpg` |
| Create/Read | Mandanten-Nutzer |
| Status-Update | Admin |

Kollegen: [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md §2b](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md)
