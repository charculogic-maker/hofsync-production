# Herkunft (LMIV / Digitale Thekenklade)

Fleisch-Rückverfolgbarkeit nach LMIV: Etikett fotografieren, Charge und Herkunft erfassen. Der Eintrag erscheint in der digitalen Thekenklade.

> **Tab:** **Herkunft** (untere Leiste) · **Code:** `web/traceability.js`  
> **Admin:** `/dev-dashboard` → Tab **Rückverfolgbarkeit**  
> **Nicht verwechseln** mit Büro-**Chargen** (Produktionschargen) — siehe [05-chargen.md](./05-chargen.md).

## Erfassung am Laden-iPhone

1. Tab **Herkunft** öffnen (Profilpflicht wie bei MHD/Neu).
2. **📸 Etikett fotografieren / scannen** — Kamera des Laden-iPhones. Die KI liest das Etikett vor und füllt die Felder; wir prüfen kurz und speichern.
3. **Charge / LOT-Nummer** (Pflicht) und optional **Identitätskennzeichen** (oval).
4. Optional **Öko-Kontrollstelle** (z. B. DE-ÖKO-006) und **Bio-Verband** (EU-Bio, Bioland, Demeter, Naturland oder Keine / Konventionell).
5. **Tierart** wählen: Rind · Schwein · Geflügel · Schaf · Ziege.
6. Herkunft:
   - **Ursprung aus einem einzigen Land?** aktiv → nur Länderauswahl.
   - inaktiv → Mehrländer-Felder (**Aufgezogen/Gemästet**, **Geschlachtet**; bei **Rind** zusätzlich **Geboren**, **Zerlegt**, Zulassungsnummer).
7. **💾 Herkunft speichern** — Status **aktiv in der Theke**.

Offline: Unsere App speichert lokal und synchronisiert bei WLAN (*„Herkunftseintrag wird automatisch synchronisiert, sobald WLAN verfügbar ist.“*).

## Digitale Thekenklade (Admin)

Unter **/dev-dashboard → Rückverfolgbarkeit**:

- Tabelle aller `chargendoku`-Einträge (Legacy: `traceabilityRecords`)
- Suche nach LOT / Kennzeichen, Filter nach Erfassungsdatum
- Status umschalten: **Aktiv in Theke** ↔ **Archiviert**
- Detail: Original-Etikettfoto + formatierte LMIV-Daten für Kontrollen
- Bei Bio-Ware: Abschnitt **Bio-Zertifizierung** (Öko-Kontrollstelle, Bio-Verband) sowie Spalte/Badge in der Tabelle

## Technik (Kurz)

| Thema | Wert |
|-------|------|
| Modul-Key | `enabledModules.chargenDoku` / `modules.chargenDoku` (Legacy: `traceability`) |
| Firestore | `tenants/{tenantId}/chargendoku/{id}` (Legacy: `traceabilityRecords`) |
| Storage | `tenants/{tenantId}/chargendoku/{recordId}.jpg` |
| Create/Read | Mandanten-Nutzer |
| Status-Update | Admin |

Kollegen: [KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md §2b](../KOLLEGEN_ANLEITUNG_HOFLADEN_APP.md)
