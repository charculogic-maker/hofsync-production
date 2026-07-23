# Herkunft (LMIV / Digitale Thekenklade)

Fleisch-Rückverfolgbarkeit nach LMIV: Etikett fotografieren, Charge und Herkunft erfassen. Der Eintrag erscheint in der digitalen Thekenklade.

> **Tab:** **Herkunft** (untere Leiste) · **Code:** `web/traceability.js`  
> **Admin:** `/dev-dashboard` → Tab **Rückverfolgbarkeit**  
> **Nicht verwechseln** mit Büro-**Chargen** (Produktionschargen) — siehe [05-chargen.md](./05-chargen.md).

## Erfassung am Laden-iPhone

1. Tab **Herkunft** öffnen (Profilpflicht wie bei MHD/Neu).
2. **📸 Etikett fotografieren** — Kamera des Laden-iPhones.
3. **Charge / LOT-Nummer** (Pflicht) und optional **Identitätskennzeichen** (oval).
4. **Tierart** wählen: Rind · Schwein · Geflügel · Schaf · Ziege.
5. Herkunft:
   - **Ursprung aus einem einzigen Land?** aktiv → nur Länderauswahl.
   - inaktiv → Mehrländer-Felder (**Aufgezogen/Gemästet**, **Geschlachtet**; bei **Rind** zusätzlich **Geboren**, **Zerlegt**, Zulassungsnummer).
6. **💾 Herkunft speichern** — Status **aktiv in der Theke**.

Offline: Unsere App speichert lokal und synchronisiert bei WLAN (*„Herkunftseintrag wird automatisch synchronisiert, sobald WLAN verfügbar ist.“*).

## Digitale Thekenklade (Admin)

Unter **/dev-dashboard → Rückverfolgbarkeit**:

- Tabelle aller `traceabilityRecords`
- Suche nach LOT / Kennzeichen, Filter nach Erfassungsdatum
- Status umschalten: **Aktiv in Theke** ↔ **Archiviert**
- Detail: Original-Etikettfoto + formatierte LMIV-Daten für Kontrollen

## Technik (Kurz)

| Thema | Wert |
|-------|------|
| Modul-Key | `enabledModules.traceability` / `modules.traceability` |
| Firestore | `tenants/{tenantId}/traceabilityRecords/{id}` |
| Storage | `tenants/{tenantId}/traceability/{recordId}.jpg` |
| Create/Read | Mandanten-Nutzer |
| Status-Update | Admin |

Kollegen: [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md §2b](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md)
