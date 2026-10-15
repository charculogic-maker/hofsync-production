/**
 * Theken-Rezeptur-Nachschlagewerk — Client-seitige Suche & Karten für Kunden-Auskunft.
 * Schwere Produktions-Berechnung bleibt in production.js (Desktop/Tablet).
 */

/**
 * Zentrale Rezepturen-Masterliste (Bratwurst-/Wurstküchen-Seed).
 * Physikalische Prüfung: `node tools/audit-recipe-physics.mjs`
 */
export const bratwurstRecipes = [
  {
    "id": "Gallo-Rizo-Patties",
    "name": "Burgerpatties Gallo-Rizo",
    "kat": "Patties",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULFITE"
    ],
    "tipp": "Hobby-Tipp: Nutze Einweg-Handschuhe über Textil-Handschuhen, um die Fleischmasse vor deiner Körperwärme zu isolieren.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Allergene pruefen: SULFITE.",
    "anweisung_A": "Fleisch und Fett auf 0 bis 2 Grad C kuehlen. Gewuerze, Salz und fluessige Zutaten getrennt abwiegen. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen. Nur kurz mengen, bis die Masse zusammenhaelt; Patties sollen locker bleiben und nicht wie Bruehwurst binden.",
    "anweisung_C": "Gleichmaessig portionieren, schonend formen und bei Bedarf eine leichte Mulde eindruecken. Patties nicht warm stehen lassen.",
    "anweisung_D": "Patties sofort kuehlen, flach lagern und als empfindliches Hackfleischprodukt behandeln.",
    "ingredients": [
      {
        "name": "RII (Rindfleisch mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV (Rindfleisch fett/Abschnitte)",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rotwein",
        "pct": 3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULFITE"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 1.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Patties",
    "name": "Burgerpatties vom Galloway (G-Patties)",
    "kat": "Patties",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Hobby-Tipp: Wenn du keine Patty-Presse hast, nutze einen großen Servierring und drücke die Masse nur leicht fest.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Fleisch und Fett auf 0 bis 2 Grad C kuehlen. Gewuerze, Salz und fluessige Zutaten getrennt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen. Nur kurz mengen, bis die Masse zusammenhaelt; Patties sollen locker bleiben und nicht wie Bruehwurst binden.",
    "anweisung_C": "Gleichmaessig portionieren, schonend formen und bei Bedarf eine leichte Mulde eindruecken. Patties nicht warm stehen lassen.",
    "anweisung_D": "Patties sofort kuehlen, flach lagern und als empfindliches Hackfleischprodukt behandeln.",
    "ingredients": [
      {
        "name": "Rindfleisch II (mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rindfleisch IV (fett)",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "CC-Griller",
    "name": "Chili Cheese Griller",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "MILCH, 5mm Würfel",
      "SENF"
    ],
    "tipp": "Tipp für die Frischetheke: Wenn du beim Supermarkt-Metzger kein reines, kerniges Keulen- oder Rückenfett bekommst, frage nach sehr fettem Schweinebauch ohne Schwarte oder einfachem weißen Speckabschnitt. Achtung: Dieses Ersatzfett ist weicher! Schneide es in Würfel und friere es für ca. 30–45 Minuten leicht an, bevor es in den Wolf geht. Schmiert das weiche Fett beim Wolfen, ist die Emulsion später ruiniert.)",
    "haltbar": "Haltbarkeit & Lagerung\nFür die Sicherheit und den optimalen Genuss gelten folgende Richtwerte:\nFrisch (Roh / Ungebrüht): Falls die Würste nicht sofort gebrüht werden, sind sie extrem empfindlich. Lagerung maximal 24 Stunden bei konstant unter 2 °C.\nGebrüht (Vakuumiert): Nach dem Abschrecken und vollständigen Abtrocknen vakuumiert bei maximal 4 °C lagern. Haltbarkeit: 10 bis 14 Tage.\nGebrüht & Tiefgefroren: Im Vakuumbeutel bei -18 °C tiefkühlen. Haltbarkeit: 6 Monate für optimalen Geschmack (bis zu 12 Monate technisch möglich).",
    "hinweis": "Allergene pruefen: MILCH, 5mm Würfel, SENF.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Milch, Senf.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Rindfleisch R II",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": "mager, sehnenarm 0° bis 2° C"
      },
      {
        "name": "Schweinefleisch S II",
        "pct": 16,
        "typ": "base",
        "allergen": false,
        "hinweis": "80/20 Sortierung 0° bis 2° C"
      },
      {
        "name": "Schweine-Keulenfett S VII",
        "pct": 15,
        "typ": "base",
        "allergen": false,
        "hinweis": "frisch, kernig 0° bis 2° C"
      },
      {
        "name": "Crushed Ice",
        "pct": 15,
        "typ": "base",
        "allergen": false,
        "hinweis": "eiskalt"
      },
      {
        "name": "Bergkäse (gewürfelt)",
        "pct": 14,
        "typ": "base",
        "allergen": true,
        "hinweis": "MILCH, 5mm Würfel"
      },
      {
        "name": "Meersalz fein",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "ohne Trennmittel"
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.7,
        "typ": "spice",
        "allergen": false,
        "hinweis": "trocken"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "trocken"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gemahlen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Schärfe prüfen"
      },
      {
        "name": "Majoran",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gerebelt"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Gallo-Rizo-BW",
    "name": "Frische Bratwurst Gallo-Rizo",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "Sulphite"
    ],
    "tipp": "Hobby-Tipp: Nutze zum Mengen kalte Rührhaken oder arbeite zügig von Hand, um die 12 °C Marke niemals zu überschreiten.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Allergene pruefen: Sulphite.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "RII",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Rotwein",
        "pct": 3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "Sulphite"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Pfeffer weiß gemahlen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Chili gemahlen",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Cayenne",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      },
      {
        "name": "Koriander",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wein rehydrieren"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-BW",
    "name": "Frische Bratwurst vom Galloway",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "RII",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "RIV",
        "pct": 27,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Zitronensaft",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "H-BW",
    "name": "Frische Bratwurst vom Hähnchen",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "HII",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "HIV",
        "pct": 27,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 3,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Meersalz fein",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Muskat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "Piment gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-BW",
    "name": "Frische Bratwurst vom Schwein",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Tipp: Ein scharfer Schnitt ist für die Optik im Saitling entscheidend. Achte darauf, dass der Speck beim Wolfen nicht schmiert, um eine klare Fettkörnung im Brät zu erhalten.",
    "haltbar": "Haltbarkeit & Lagerung",
    "hinweis": "Produktionshinweis: 0° bis 2° C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0° bis 2° C"
      },
      {
        "name": "Zitronensaft",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Wasser mischen"
      },
      {
        "name": "eiskaltes Wasser",
        "pct": 2.7,
        "typ": "spice",
        "allergen": false,
        "hinweis": "mit Zitronensaft mischen"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Thymian",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "in Wasser-Zitronensaft-Mischung rehydrieren"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "GS-Pfälzer-LW",
    "name": "Galloway & Schwein Pfälzer Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "SOP Kochwurst Leitsatz 2.232: Warmemulsion Fertigbrätemperatur 42–46 °C — KEINE Kaltkutterung / keine Eisschüttung als Brätziel. Leberzugabe erst bei Kuttergut ≤48 °C. Extra Schüssel: Leber mit Salz schaumig aufschließen.",
    "haltbar": "Gekühlt lagern; Charge und Kerntemperatur (≥72 °C) dokumentieren.",
    "hinweis": "Produktionshinweis: extra Schüssel, mit Leber schaumig kuttern Warmemulsion 42–46 °C; Leber kalt vorhalten.",
    "anweisung_A": "Fleisch, Fett, Leber und Schüttung getrennt vorbereiten. Gegarte Rohstoffe zur Warmemulsion (Ziel 42–46 °C) vorbereiten, rohe Leber kalt halten. Allergenstatus der Zutaten vor Produktionsbeginn prüfen.",
    "anweisung_B": "Warmemulsion: Vorgegarte Fleischanteile heiß/warm wolfen oder kuttern. Ziel Fertigbrätemperatur 42–46 °C — KEINE Kaltkutterung auf ≤4 °C. Leber mit Salz fein aufschließen und erst einarbeiten, wenn das Kuttergut ≤48 °C hat.",
    "anweisung_C": "Gewuerze und weitere Zutaten gleichmaessig einarbeiten. In Glas, Darm oder Form fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Erhitzen/Dämpfen bis Kerntemperatur ≥72 °C. Danach zügig abkühlen, kalt lagern und bei Glasware Deckel, Vakuum und Charge prüfen.",
    "ingredients": [
      {
        "name": "Galloway RIV (Wade/Bug/Brust, gegart)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebauch ohne Schwarte",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebacke / Wamme",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderleber",
        "pct": 18,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfel",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Kartoffelpüree-Pulver",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "extra Schüssel, mit Leber schaumig kuttern"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronenpulver",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Aspik",
    "name": "Galloway Aspik",
    "kat": "Konserven",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SELLERIE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SELLERIE.",
    "anweisung_A": "Rohstoffe vorbereiten, sauber parieren und Zutaten vollstaendig abwiegen. Glaeser, Deckel und Werkzeuge hygienisch bereitstellen. Allergene kennzeichnen: Sellerie.",
    "anweisung_B": "Fleisch, Fond, Gemuese und Gewuerze nach Rezeptur garen oder ansetzen. Heisse Komponenten zuegig verarbeiten und Fuelltemperatur sowie Sauberkeit im Blick behalten.",
    "anweisung_C": "Glaeser mit korrektem Kopfraum fuellen, Raender sauber abwischen und sofort verschliessen. Anschliessend nach validiertem Programm erhitzen; Hausrezept allein ersetzt keine Prozessvalidierung.",
    "anweisung_D": "Nur mit validiertem Erhitzungsprogramm freigeben; Deckel, Vakuum, Charge und Lagerprobe dokumentieren.",
    "ingredients": [
      {
        "name": "Trinkwasser",
        "pct": 150,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Sehnen / Parüren / Silberhaut",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Gelenk-Knochen (klein gesägt)",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln (mit Schale)",
        "pct": 15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Karotten / Sellerie (grob)",
        "pct": 5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SELLERIE"
      },
      {
        "name": "Apfelessig (Naturtrüb)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "LapCheong",
    "name": "Galloway Lap Cheong (Bio)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SOJA",
      "ALKOHOL",
      "weißer Pfeffer"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SOJA, ALKOHOL, weißer Pfeffer.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Soja, Alkohol, weißer Pfeffer.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway Rindfleisch R II",
        "pct": 75,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweine-Rückenspeck S VIII",
        "pct": 23,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Sojasauce (Tamari)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SOJA"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Reiswein",
        "pct": 2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "ALKOHOL"
      },
      {
        "name": "Fünf-Gewürze-Pulver",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "weißer Pfeffer",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": ""
      },
      {
        "name": "Ingwerpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rote-Bete-Pulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-LW",
    "name": "Galloway Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "45",
    "basis_g": "20.000,00",
    "allergene": [
      "MILCH"
    ],
    "tipp": "SOP Kochwurst Leitsatz 2.232: Warmemulsion Fertigbraettemperatur 42–46 °C — KEINE Kaltkutterung auf ≤4 °C. Leberzugabe erst bei Kuttergut ≤48 °C (Schutz vor thermischem Lebereiweiss-Gerinnen). Garprozess: Rational SCC Daempfen 78–80 °C bis Kerntemperatur ≥72 °C. Maschinen: Alexanderwerk Kutter (ohne Fleischwolf), OSKAR 20 (Fuellrohr 30 mm, Kal. 45).",
    "haltbar": "Gekühlt lagern; Charge und Kerntemperatur (≥72 °C) dokumentieren.",
    "hinweis": "Allergene: MILCH (Bio-Butter). Charge-Basis 20,0 kg Gesamtmasse. Fleisch & Kollagentraeger 77 %, Gewuerze & Zusaetze 23 %.",
    "anweisung_A": "Charge 20,0 kg ansetzen. Fleisch & Kollagentraeger (77 %): Rinderleber frisch 6,00 kg, Rinderbauch/Brust 5,50 kg, Rinderwade/Vorderhaxe 3,70 kg, Galloway-Glace 0,20 kg. Gewuerze & Zusaetze (23 %) exakt abwiegen: SCC-Kochsud, gegarte Schulter/Oberschale, gedampfte Zwiebeln, Bio-Butter, Meersalz, Traubensaft rot, Kartoffelflocken, Apfelessig, Pfeffer weiss, Majoran, Piment, Ingwer, Muskat. Allergene kennzeichnen: MILCH (Bio-Butter). Maschinen: Alexanderwerk Kutter (ohne Fleischwolf), OSKAR 20.",
    "anweisung_B": "Warmemulsion im Alexanderwerk-Kutter: Gegarte Rohstoffe und Schuettung zur Warmemulsion kuttern. Ziel Fertigbraettemperatur 42–46 °C — KEINE Kaltkutterung auf ≤4 °C. Leber mit Meersalz erst einarbeiten, wenn das Kuttergut ≤48 °C hat (Schutz vor thermischem Lebereiweiss-Gerinnen).",
    "anweisung_C": "Gewuerze und restliche Zusaetze gleichmaessig einarbeiten. Mit OSKAR 20 (Fuellrohr 30 mm) in Kaliber 45 fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Rational SCC Daempfen 78–80 °C bis Kerntemperatur ≥72 °C (Ueber-Nacht-Daempfen nach Betriebs-SOP). Danach zuegig abkuehlen, kalt lagern und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Rinderleber frisch",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "6,00 kg / 30 % bei 20 kg Charge"
      },
      {
        "name": "Rinderbauch/Brust",
        "pct": 27.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "5,50 kg / 27,5 % bei 20 kg Charge"
      },
      {
        "name": "Rinderwade/Vorderhaxe",
        "pct": 18.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "3,70 kg / 18,5 % bei 20 kg Charge"
      },
      {
        "name": "Galloway-Glace",
        "pct": 1,
        "typ": "base",
        "allergen": false,
        "hinweis": "0,20 kg / 1,0 % bei 20 kg Charge"
      },
      {
        "name": "SCC-Kochsud",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": "1,40 kg bei 20 kg Charge"
      },
      {
        "name": "Rinderschulter/Oberschale gegart",
        "pct": 6.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": "1,27 kg bei 20 kg Charge"
      },
      {
        "name": "Zwiebeln gedämpft",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,60 kg bei 20 kg Charge"
      },
      {
        "name": "Bio-Butter",
        "pct": 2.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "MILCH — 0,50 kg bei 20 kg Charge"
      },
      {
        "name": "Meersalz",
        "pct": 1.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,35 kg — Extra Schüssel für Leber!"
      },
      {
        "name": "Traubensaft rot",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,20 kg bei 20 kg Charge"
      },
      {
        "name": "Bio-Kartoffelflocken",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,16 kg bei 20 kg Charge"
      },
      {
        "name": "Apfelessig",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,06 kg bei 20 kg Charge"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,030 kg bei 20 kg Charge"
      },
      {
        "name": "Majoran",
        "pct": 0.06,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,012 kg bei 20 kg Charge"
      },
      {
        "name": "Piment",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,010 kg bei 20 kg Charge"
      },
      {
        "name": "Ingwer",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,004 kg bei 20 kg Charge"
      },
      {
        "name": "Muskat",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0,004 kg bei 20 kg Charge"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Peitsche - SALZ",
    "name": "Galloway Peitsche - Salz Pur (18/20)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway mager",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway fett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Peitsche - SCHARF",
    "name": "Galloway Peitsche - Scharf (18/20)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway mager",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway fett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz, unjodiert",
        "pct": 2.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio Nadurot",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkultur (Lyoph.)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Bierwurst / G-Bier-Griller",
    "name": "Galloway-Bierwurst",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Gallowayfleisch (R I - Mager)",
        "pct": 50,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweine-Rückenspeck (kernig)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schüttung",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln frisch",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.6,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Rohrzucker",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kardamom",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-Chorizo-Griller",
    "name": "Griller Chorizo vom Schwein",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rotwein (spanisch JOSE)",
        "pct": 5.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 2.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "H-Wiener",
    "name": "Hühner-Wiener",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Mageres Hühnerfleisch",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Hühnerfett / -Haut",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Crushed Ice / H-Brühe",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Natriumcitrat",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "GS-Rost-BW",
    "name": "Niederrheinische grobe Rostbratwurst",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway-Rindfleisch mager",
        "pct": 41.85,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinefleisch mager",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinefett (Rückenspeck)",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Eiskaltes Wasser",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver / getrocknete Zwiebeln",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "weißer Pfeffer, gemahlen",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran, gerebelt",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Brauner Zucker / Rübenkraut",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfsaat, grob gestoßen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment, gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-Pastrami",
    "name": "Pastrami vom Galloway",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF Lake",
      "SENF Rub"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF Lake, SENF Rub.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "G-Brust, Tafelspitz",
        "pct": 100,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Meersalz (Brine)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Rohrohrzucker (Brine)",
        "pct": 1.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Paprika edelsüß (Brine)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Pfeffer (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Koriander (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Paprika (Rub)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Pfeffer (Brine)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Koriander (Brine)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Knoblauch (Brine)",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Lake"
      },
      {
        "name": "Senfsaat (Brine)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF Lake"
      },
      {
        "name": "Knoblauch (Rub)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Zwiebelpulver (Rub)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Senfsaat (Rub)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF Rub"
      },
      {
        "name": "Lorbeer (Rub)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      },
      {
        "name": "Piment  (Rub)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rub"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "G-PB",
    "name": "Pfefferbeißer vom Galloway",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "E300"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, E300.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, E300.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Galloway Rindfleisch (Mager)",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway Rinderfett",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Trinkwasser (kalt)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz, gebrochen",
        "pct": 0.33,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Bio-Nadurot (E300)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": true,
        "hinweis": "E300"
      },
      {
        "name": "Paprikapulver",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili geschrotet",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schabzigerklee",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.06,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rosmarin",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-PB",
    "name": "Pfefferbeißer vom Schwein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "E300"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, E300.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, E300.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer bunt, geschrotet",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Oregano (gerebelt)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel, fein zerstoßen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika rosenscharf",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Traubenzucker / Rosalin",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkultur PRIMAL SK natur rapid 50",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Nadurot (E300)",
        "pct": 0.03,
        "typ": "spice",
        "allergen": true,
        "hinweis": "E300"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-Räucherbauch",
    "name": "Räucherbauch Schwein",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Rohstoffe kalt fuehren, Zutaten exakt einwiegen und Charge dokumentieren.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinebauch",
        "pct": 100,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpaste",
        "pct": 0.3,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.3,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.2,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren",
        "pct": 0.1,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeerblätter",
        "pct": 0.05,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-Chorizo-Salami",
    "name": "Salami Chorizo vom Schwein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 80,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIV",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rotwein (spanisch JOSE)",
        "pct": 5.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 2.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchflocken",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zucker",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "T-SPX (Bio) Starterkulturen",
        "pct": 0.08,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfel-Essig",
        "pct": 0.07,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "S-Salsiccia",
    "name": "Salsiccia",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SULPHITE"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SULPHITE.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergene kennzeichnen: Sulfite.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "SII",
        "pct": 50,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SVIII",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "SIII / RIII",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "trockener ital. Rotwein",
        "pct": 4,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SULPHITE"
      },
      {
        "name": "Meersalz fein",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Fenchelsaat, gestoßen",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel, gestoßen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz gestoßen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Piment",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rosmarin gemahlen",
        "pct": 0.07,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Lorbeer gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren gemahlen",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "ZZ_RS-MettW",
    "name": "Mettwurst Niederrhein",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF",
      "Pfeffer weiß gem."
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF, Pfeffer weiß gem..",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergene kennzeichnen: Senf, Pfeffer weiß gem..",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweinefleisch SIV",
        "pct": 77,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rindfleisch RII",
        "pct": 19.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz fein",
        "pct": 2.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfkörner ganz",
        "pct": 0.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Pfeffer weiß gem.",
        "pct": 0.35,
        "typ": "spice",
        "allergen": true,
        "hinweis": ""
      },
      {
        "name": "Rohrzucker",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Starterkulturen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Kräuter-BW",
    "name": "Kräuter-Bratwurst",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schweinebauch S5",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Eisschnee / Wasser",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.9,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß gem.",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.2,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Petersilie gerebelt",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel gem.",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatnuss gem.",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer gem.",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Nuss_Roh",
    "name": "Bio-Nuß-Schinken",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "Lagerung im Kühlraum bei max. +4°C.\n5. Pökeldauer: ca. 1,5 Tage pro kg Fleischgewicht. Die Beutel sollten alle 2 Tage gewendet werden, um eine optimale Verteilung zu gewährleisten.\nVorbereitung zum Räuchern:\n1. Nach der Pökelzeit die Nüsse aus dem Beutel nehmen und kurz mit kaltem Wasser abspülen.\n2. Durchbrennen: 2-3 Tage hängend bei +6°C trocknen/durchbrennen lassen.\nRäuchern (Rational Dämpfer):\n1. Ausschließlich im Rational Dämpfer bei Kaltrauch (max. 20°C).\n2. 3-4 Intervalle à 6 Stunden.\nQualitätskontrolle:\n• HACCP: pH-Wert < 5,3 sicherstellen.\n• Allergene: Enthält Senfmehl.",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinenuss (schier)",
        "pct": 95.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (geschrotet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren (gequetscht)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.05,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Huefte_Roh",
    "name": "Bio-Schinkenspeck",
    "kat": "Aufschnitt",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "SENF"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: SENF.",
    "anweisung_A": "Fleisch parieren, Sehnen oder lose Gewebeteile entfernen und Zutaten exakt abwiegen. Bei Poekelware Lake oder Trockenmischung sauber herstellen. Allergene kennzeichnen: Senf.",
    "anweisung_B": "Fleisch gleichmaessig einreiben, spritzen oder einlegen und die Reife- oder Poekelzeit dokumentieren. Stuecke regelmaessig wenden und durchgehend gekuehlt halten.",
    "anweisung_C": "Vor dem Garen, Raeuchern oder Trocknen die Oberflaeche abtrocknen lassen. Danach nach Produktspezifikation garen, raeuchern oder reifen; Kerntemperatur und Prozessdaten festhalten.",
    "anweisung_D": "Vor dem Aufschneiden vollstaendig durchkuehlen lassen; Anschnitt, Kerntemperatur und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweinehüfte (m. Speck und Schwarte)",
        "pct": 95.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 3.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (geschrotet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wacholderbeeren (gequetscht)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronensaft",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Senfmehl",
        "pct": 0.05,
        "typ": "spice",
        "allergen": true,
        "hinweis": "SENF"
      },
      {
        "name": "Knoblauchgranulat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "RUB01",
    "name": "Galloway Gold",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Brauner Rohrohrzucker",
        "pct": 30,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Meersalz (grob)",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schwarzer Pfeffer",
        "pct": 15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpulver",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chiliflocken",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Shiitake-Pilzpulver",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Ingwer (gemahlen)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "RUB02",
    "name": "Honey-Garlic-Crunch",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Rohrohrzucker",
        "pct": 45,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Knoblauch (granuliert)",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz (fein)",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer",
        "pct": 6,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zitronenschale",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "RUB03",
    "name": "Pinoy Smoke & Spice",
    "kat": "Rubs & Marinaden",
    "kaliber": "",
    "basis_g": "1,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Trockenmischung",
    "anweisung_A": "Alle Gewuerze und trockenen Zutaten sauber abwiegen. Arbeitsgeraete trocken halten, damit die Mischung nicht verklumpt. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Zutaten in einer trockenen Wanne oder einem Mischer homogen vermengen. Grobe Bestandteile vorher gleichmaessig zerkleinern, damit jede Portion gleich schmeckt.",
    "anweisung_C": "Mischung sofort in saubere, trockene Behaelter fuellen und eindeutig beschriften. Bei Marinaden fluessige Komponenten erst kurz vor der Anwendung zugeben.",
    "anweisung_D": "Trocken, kuehl, dunkel und verschlossen lagern; Kreuzkontamination und Allergenverschleppung vermeiden.",
    "ingredients": [
      {
        "name": "Brauner Rohrohrzucker",
        "pct": 30,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trockenmischung"
      },
      {
        "name": "Rauchsalz",
        "pct": 25,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 20,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelpulver",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Sumach",
        "pct": 8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schwarzer Pfeffer",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Sternanis (gemahlen)",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "RW001",
    "name": "Rote Wurst",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10000",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: Bioland",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Schweineschulter (mager)",
        "pct": 42.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Speck (Rücken/Backe)",
        "pct": 27.5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Trinkwasser (Eis-Schnee)",
        "pct": 25,
        "typ": "liquid",
        "allergen": false,
        "hinweis": "Trinkwasser"
      },
      {
        "name": "Rindfleisch (sehnenarm)",
        "pct": 5,
        "typ": "base",
        "allergen": false,
        "hinweis": "Bioland"
      },
      {
        "name": "Meersalz",
        "pct": 18,
        "typ": "additive",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Paprika edelsüß",
        "pct": 4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kümmel (gemahlen)",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauchpulver",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "H-FW-90",
    "name": "Hähnchen-Fleischwurst (90er)",
    "kat": "Brühwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir kein NPS nutzen, bleibt die Wurst natur-hell. Achtet penibel auf die Kälte beim Kuttern, Geflügelbrät ist thermisch extrem instabil.",
    "haltbar": "Haltbarkeit: 14 Tage bei < 4°C (vakuumiert).",
    "hinweis": "Produktionshinweis: CCP: Kerntemp. 72°C",
    "anweisung_A": "Fleisch, Fett, Eis oder Schuettung auf 0 bis 2 Grad C vorkuehlen. Gewuerze, Salz und Hilfsstoffe exakt abwiegen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Magerfleisch mit Salz und einem Teil der Schuettung fein kuttern oder sehr fein wolfen, bis Bindung entsteht. Fett und restliche Schuettung kalt einarbeiten; die Masse moeglichst unter 12 Grad C halten. Bei Gefluegel besonders zuegig und hygienisch arbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse blasenfrei fuellen, nicht ueberfuellen und die Portionen gleichmaessig abdrehen oder in Formen bringen.",
    "anweisung_D": "Bei 72 bis 78 Grad C bruehen oder daempfen, bis die erforderliche Kerntemperatur erreicht ist. Nach dem Bruehen zuegig kalt duschen oder im Eiswasser abkuehlen und danach bei 0 bis 4 Grad C lagern.",
    "ingredients": [
      {
        "name": "Hühnerfleisch mager",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": "CCP: Kerntemp. 72°C"
      },
      {
        "name": "Hühnerfett / -Haut",
        "pct": 20,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Wasser / Eis",
        "pct": 20,
        "typ": "base",
        "allergen": false,
        "hinweis": "eiskalt"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "BioTex Pure (KHM)",
        "pct": 0.9,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Kutterhilfsmittel"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "gemahlen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Curcuma",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "für die Farbe"
      },
      {
        "name": "Ingwer",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Gallo-Lamb-Merguez-Bio",
    "name": "Merguez Galloway-Lamm",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir kein NPS nutzen, ist die mikrobiologische Stabilität bei frischer Bratwurst das A und O. Arbeitet extrem zügig beim Wolfen. Wenn Ihr die Merguez noch „kickiger“ wollt, könnt Ihr 0,5% frische Minze fein gehackt unterheben – das passt perfekt zum Lamm.",
    "haltbar": "Haltbarkeit: 3 Tage bei < 4°C (Frischware) oder 180 Tage bei -18°C.",
    "hinweis": "Produktionshinweis: Kerntemperatur 0°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Zutaten gleichmaessig verteilen. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway RII (mager)",
        "pct": 60,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kerntemperatur 0°C"
      },
      {
        "name": "Lammfleisch / -fett (LII/LIV)",
        "pct": 40,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "CCP: Salzwaage prüfen"
      },
      {
        "name": "Paprika edelsüß",
        "pct": 0.45,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebelgranulat",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kreuzkümmel",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Cayenne",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Chili",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "Gallo-Citron-Sauge-Bio",
    "name": "Saucisse de Gallo (Citron & Sauge)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Achtet bei den Salzzitronen darauf, nur die Schale zu verwenden und das bittere Fruchtfleisch zu entfernen. Da wir kein Phosphat nutzen, ist die Bindung rein mechanisch – arbeitet zügig, damit das Fett nicht schmiert.",
    "haltbar": "Haltbarkeit: 3 Tage bei < 4°C oder 180 Tage bei -18°C.",
    "hinweis": "Produktionshinweis: Kerntemperatur < 2°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Formen, Glaeser, Beutel oder Huellen passend zum Produkt vorbereiten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Galloway RII (mager)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kerntemperatur < 2°C"
      },
      {
        "name": "Rinderfett (kernig)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Salzzitrone (Bio, fein gehackt)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur Schale verwenden"
      },
      {
        "name": "Salbei (getrocknet)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gerebelt"
      },
      {
        "name": "Pfeffer weiß (gemahlen)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch (frisch, fein gewürfelt)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Macis",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "alt_Schwein-Mettwurst",
    "name": "Mettwurst_alt",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Kontrolliert am 2. Tag den \"Zipfel-Test\". Sind die Enden geschmeidig, passt die Feuchte. Werden sie trocken, riskiert ihr einen Trockenrand (Verschalung) – dann sofort Luftfeuchte leicht erhöhen!",
    "haltbar": "Haltbarkeit: 7 Tage bei <4°C (frisch) oder 21 Tage gereift bei <15°C.",
    "hinweis": "Produktionshinweis: pH-Wert < 5,8",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweineschulter S II",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH-Wert < 5,8"
      },
      {
        "name": "Rückenspeck S IV",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig & eiskalt"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer schwarz (grob)",
        "pct": 0.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskat (gemahlen)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Knoblauch (frisch)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rohrohrzucker",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Bakterienfutter"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "neu_Schwein-Mettwurst",
    "name": "Bio Mettwurst (geräuchert & luftgetrocknet)",
    "kat": "Rohwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Da wir ohne NPS arbeiten, ist der pH-Wert-Verlauf kritisch. Ziel-pH nach 48h: 4,8 bis 5,1. Achtet darauf, dass die Wurst im Rauch nicht \"absperrt\" (Trockenrand), sonst fault sie von innen.",
    "haltbar": "Haltbarkeit: 60 Tage bei <12°C (nach Reifung).",
    "hinweis": "Produktionshinweis: Gekühlt bei 0-2°C verarbeiten",
    "anweisung_A": "Fleisch und Speck gut durchkuehlen oder leicht anfrieren, damit der Wolf sauber schneidet. Gewuerze, Salz, Kulturen oder Hilfsstoffe exakt abwiegen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Speck passend zur gewuenschten Koernung wolfen. Masse nur so lange mengen, bis sie bindet; Fett darf nicht schmieren.",
    "anweisung_C": "Luftarm in geeignete Daerme fuellen und straff abbinden. Danach nach Produktspezifikation umroeten, reifen, trocknen und bei Bedarf kalt raeuchern; Temperatur und Luftfeuchte dokumentieren.",
    "anweisung_D": "Nur freigeben, wenn Reifeverlauf, pH-/aw-Ziel, Gewichtsverlust sowie Sicht- und Geruchskontrolle zur Produktspezifikation passen.",
    "ingredients": [
      {
        "name": "Schweinefleisch mager (S II)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "Gekühlt bei 0-2°C verarbeiten"
      },
      {
        "name": "Rückenspeck ohne Schwarte (S VIII)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig, gut gekühlt"
      },
      {
        "name": "Meersalz",
        "pct": 2.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Konservierung durch Salz-Hürde"
      },
      {
        "name": "Pfeffer schwarz, gemahlen",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Weißer Pfeffer, gemahlen",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatblüte (Macis)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Koriander, gemahlen",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "BIO Rosalin S (Glucosesirup)",
        "pct": 0.4,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Futter für Milchsäurebakterien"
      },
      {
        "name": "BIO Pökulus",
        "pct": 0.2,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Enthält E301 zur Umrötung"
      },
      {
        "name": "Acerola-Pulver (optional)",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Natürliches Vitamin C (Vorschlag)"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "cocktail_Gallo-Mary-Brat-Bio",
    "name": "Gallo-Mary Bratwurst (Bloody Mary Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "Typisches Aroma"
    ],
    "tipp": "Meister-Tipp: Da Galloway-Fett einen niedrigeren Schmelzpunkt hat als Hausschwein, arbeitet im Menger zügig. Das BIO Kutterpower mit der Pastinaken-Note unterstützt das Gemüseprofil der Bloody Mary hervorragend und hält den Wodka sicher in der Bindung, damit die Wurst auf dem Grill saftig bleibt und nicht spritzt.",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Allergene pruefen: Typisches Aroma.",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergene kennzeichnen: Typisches Aroma.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "R II (Galloway mager)",
        "pct": 70,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH-Wert 5,8 - 6,0"
      },
      {
        "name": "R IV (Galloway Speck)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernig kühlen"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Für Brätfestigkeit"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farberhalt (E300)"
      },
      {
        "name": "Tomatenmark (Bio)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "2-fach konzentriert"
      },
      {
        "name": "Bio-Wodka",
        "pct": 2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "40% Vol."
      },
      {
        "name": "Selleriesalz",
        "pct": 0.25,
        "typ": "spice",
        "allergen": true,
        "hinweis": "Typisches Aroma"
      },
      {
        "name": "Pfeffer schwarz (grob)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Frisch geschrotet"
      },
      {
        "name": "Zitronenschale (Bio)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur Abrieb"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "cocktail_Huelser-Gin-Griller-Bio",
    "name": "Hülser Gin-Griller (Gin-Tonic Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Der Gin fungiert als Extraktionsmittel für den Wacholder. Achtet darauf, den Limettenabrieb wirklich erst ganz am Ende zuzugeben. Die ätherischen Öle der Schale sind flüchtig und reagieren empfindlich auf zu langes Mengen. Das Ergebnis auf dem Grill ist eine echte Aroma-Explosion!",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Produktionshinweis: pH 5,8 - 6,0; gut gekühlt",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2 (Bio)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH 5,8 - 6,0; gut gekühlt"
      },
      {
        "name": "Schweinebauch S5 (Bio)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernige Fettstruktur"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Bio-Gin (hochwertig)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "40-45% Vol."
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Stabilisierung & Bindung"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farberhalt ohne NPS"
      },
      {
        "name": "Wacholderbeeren (Bio)",
        "pct": 0.4,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Grob zerstoßen"
      },
      {
        "name": "Limettenabrieb (Bio)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Nur die grüne Schale"
      },
      {
        "name": "Pfeffer weiß (gemahlen)",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Mildes Profil"
      },
      {
        "name": "Koriandersaat (Bio)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gemahlen"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "cocktail_Dark-Stormy-Brat-Bio",
    "name": "Dark & Stormy Griller (Rum & Ginger Style)",
    "kat": "frische Bratwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "Meister-Tipp: Der dunkle Rum enthält natürliche Melasse-Noten, die zusammen mit dem kleinen Anteil Rohrohrzucker auf dem Grill karamellisieren – das gibt ein unglaubliches Aroma. Achtet beim Ingwer auf absolute Frische; die ätherischen Öle sind der Gegenspieler zum fetten Schweinebauch und machen die Wurst extrem süffig.",
    "haltbar": "Haltbarkeit: 3 Tage bei <4°C.",
    "hinweis": "Produktionshinweis: pH 5,8 - 6,0; max. 2°C",
    "anweisung_A": "Rohstoffe vorbereiten, Zutaten exakt abwiegen und Arbeitsmittel hygienisch bereitstellen. Daerme oder Huellen vorbereiten, waessern und auf Risse pruefen. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Fleisch und Fett kalt wolfen oder schneiden. Salz und Gewuerze einarbeiten, bis eine passende Bindung entsteht; die Masse darf nicht warm werden. Alkoholhaltige Zutaten sehr kalt halten und erst nach beginnender Bindung portionsweise einarbeiten.",
    "anweisung_C": "Stueckige oder aromaempfindliche Zutaten erst am Schluss kurz und gleichmaessig unterheben. Masse fuellen, formen oder portionieren und dabei Lufteinschluesse vermeiden.",
    "anweisung_D": "Fertigware sofort kuehlen, sauber kennzeichnen und Charge dokumentieren.",
    "ingredients": [
      {
        "name": "Schweineschulter S2 (Bio)",
        "pct": 65,
        "typ": "base",
        "allergen": false,
        "hinweis": "pH 5,8 - 6,0; max. 2°C"
      },
      {
        "name": "Schweinebauch S5 (Bio)",
        "pct": 35,
        "typ": "base",
        "allergen": false,
        "hinweis": "Kernige Struktur"
      },
      {
        "name": "Eisschnee",
        "pct": 5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Trinkwasserqualität"
      },
      {
        "name": "Bio-Rum (Dunkel)",
        "pct": 2.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Aroma-Geber"
      },
      {
        "name": "Meersalz",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Rein, ohne Zusätze"
      },
      {
        "name": "BIO Kutterpower OH AF",
        "pct": 1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Emulsionsstabilität"
      },
      {
        "name": "BIO Nadurot",
        "pct": 0.3,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Farbstabilität"
      },
      {
        "name": "Ingwer (Bio, frisch gerieben)",
        "pct": 0.6,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Schärfe & Frische"
      },
      {
        "name": "Limettensaft (Bio)",
        "pct": 0.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Für die Säurestruktur"
      },
      {
        "name": "Rohrohrzucker (Bio)",
        "pct": 0.25,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Für die Karamelisierung"
      },
      {
        "name": "Pfeffer weiß",
        "pct": 0.2,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Gemahlen"
      },
      {
        "name": "Piment (Bio)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Fein gemahlen"
      },
      {
        "name": "Acerola-Pulver",
        "pct": 0.1,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Vorschlag: 1g/kg"
      }
    ],
    "auditStatus": "verified"
  },
  {
    "id": "SH-BGW-160",
    "name": "Bio-Galloway Rostbrat- & Currywurst",
    "kat": "Brühwurst",
    "produktgattung": "Rostbratwurst & Currywurst",
    "leitsatzNr": "2.221.03",
    "leitsatz": "2.221.03 (Feine Rostbratwurst)",
    "kaliber": "Schweinedarm Kaliber 28/30",
    "basis_g": "1.000,00",
    "version": "1.0",
    "pieceWeightG": 118,
    "stueckgewicht_g": 118,
    "standardChargeKg": 16,
    "chargePresetsKg": [
      8,
      12,
      16,
      20
    ],
    "zertifizierung": "Bio (DE-ÖKO-006, nps-frei, phosphatfrei)",
    "cutterType": "Alexanderwerk 3-Sichel (M1: 1500 U/min, M2: 3000 U/min)",
    "fillerType": "OSKAR 20 (20 Liter)",
    "maschinen": {
      "kutter": "Alexanderwerk 3-Sichel (M1: 1500 U/min, M2: 3000 U/min)",
      "fueller": "OSKAR 20 (20 Liter)"
    },
    "kpis": {
      "beffe": 8.5,
      "beffeLabel": "≥ 8,5 % BEFFE i. FE",
      "fatPercentRange": "24–26 %",
      "wev": 4,
      "wevLabel": "≤ 4,0",
      "targetPh": 6.05,
      "targetPhRange": "5,9–6,2",
      "coreTempTarget": 70,
      "coreTempLabel": "Kerntemperatur-Soll Brühen 68–70 °C",
      "kutterEndTempMax": 11
    },
    "allergene": [],
    "tipp": "Meister-Tipp: Standard-Charge 16,0 kg auf Alexanderwerk / OSKAR 20. Stückgewicht 118 g im Schweinedarm 28/30. Zwei-Stufen-Garen einhalten – erst brühen, dann pasteurisieren. Bio, nps-frei und phosphatfrei (DE-ÖKO-006).",
    "haltbar": "Nach Pasteurisieren und Rückkühlung auf ≤ 4 °C gekühlt lagern. Charge und Kerntemperatur dokumentieren.",
    "hinweis": "Zertifizierung: Bio (DE-ÖKO-006, nps-frei, phosphatfrei). CCP Kutterendtemperatur max. 11,0 °C. Leitsatz 2.221.03 (Feine Rostbratwurst).",
    "anweisung_A": "Bio-Galloway mager, Bio-Schweinefleisch mager und Bio-Schweinerückenspeck 3 mm wolfen und flachgefroren (−18 °C) bereitstellen. Meersalz, BIO Kutterpower OH AF, BIO Tex Pure und alle WIBERG-Gewürze exakt auf 1.000 g Gesamtmasse abwiegen. Schweinedarm Kaliber 28/30 wässern und auf Risse prüfen. Crushed Ice bzw. Flacheisschollen sowie Eiswasser (0–1 °C) bereitlegen.",
    "anweisung_B": "Magerfleisch mit Meersalz, BIO Kutterpower OH AF und einem Teil der Schüttung im Alexanderwerk 3-Sichel kuttern (M1: 1.500 U/min, danach M2: 3.000 U/min), bis Bindung entsteht. Speck, restliche Schüttung und Gewürze kalt einarbeiten. BIO Tex Pure für Knack und Hitzestabilität mitziehen. Kutterendtemperatur (CCP) max. 11,0 °C; Ziel-pH Brät 5,9–6,2.",
    "anweisung_C": "Brät blasenfrei auf dem OSKAR 20 (20 Liter) in Schweinedarm Kaliber 28/30 füllen. Gleichmäßig abdrehen auf Stückgewicht 118 g. Nicht überfüllen; Portionen und Kaliber kontrollieren.",
    "anweisung_D": "Zwei-Stufen-Garen: (1) Brühen im Wasserbad 75 °C bis Kerntemperatur 68–70 °C (ca. 25 Min.), danach im Eiswasserbad auf < 15 °C kühlen und abtrocknen lassen. (2) Vakuumieren, im Wasserbad 75 °C für 20–25 Min. pasteurisieren, anschließend Rückkühlung auf ≤ 4 °C. Charge, Kerntemperatur und Kühlung dokumentieren.",
    "ingredients": [
      {
        "name": "Bio-Galloway mager (dry-aged, hofeigen)",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": "3 mm gewolft, flachgefroren (−18 °C)"
      },
      {
        "name": "Bio-Schweinefleisch mager (Zukauf DE-ÖKO-006)",
        "pct": 25,
        "typ": "base",
        "allergen": false,
        "hinweis": "3 mm gewolft, flachgefroren (−18 °C)",
        "supplier": "Zukauf DE-ÖKO-006"
      },
      {
        "name": "Bio-Schweinerückenspeck kernig (Zukauf DE-ÖKO-006)",
        "pct": 25,
        "typ": "base",
        "allergen": false,
        "hinweis": "3 mm gewolft, flachgefroren (−18 °C)",
        "supplier": "Zukauf DE-ÖKO-006"
      },
      {
        "name": "Crushed Ice / Flacheisschollen",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Crushed Ice oder dünne Flacheisschollen"
      },
      {
        "name": "Eiswasser (Trinkwasser)",
        "pct": 10,
        "typ": "spice",
        "allergen": false,
        "hinweis": "0–1 °C, Direktzugabe"
      },
      {
        "name": "Meersalz (unbehandelt, fein)",
        "pct": 1.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Geschmack & Eiweißquellung",
        "supplier": "NovaTaste / WIBERG"
      },
      {
        "name": "BIO Kutterpower OH AF (NovaTaste / WIBERG)",
        "pct": 0.25,
        "typ": "additive",
        "allergen": false,
        "hinweis": "",
        "funktion": "pH-Puffer & Eiweißaufschluss (Citratbasis)",
        "supplier": "NovaTaste / WIBERG"
      },
      {
        "name": "BIO Tex Pure (NovaTaste / WIBERG)",
        "pct": 0.8,
        "typ": "additive",
        "allergen": false,
        "hinweis": "Bockshornklee-Galactomannane",
        "funktion": "Knack, Hitzestabilität & Geleeschutz (Bockshornklee-Galactomannane)",
        "supplier": "NovaTaste / WIBERG"
      },
      {
        "name": "BIO Pfeffer weiß gemahlen (WIBERG)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Grundschärfe (helle Optik)",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Macisblüte gemahlen (WIBERG)",
        "pct": 0.1,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Klassische Bratwurst-Körpernote",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Zwiebelpulver (WIBERG)",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Herzhafte Grundwürze",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Koriander gemahlen (WIBERG)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Kräuterwürze & Frische",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Ingwer gemahlen (WIBERG)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Frische & Würztiefe",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Zitronenschale gemahlen (WIBERG)",
        "pct": 0.05,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Frischeakzent",
        "supplier": "WIBERG"
      },
      {
        "name": "BIO Cardamom gemahlen (WIBERG)",
        "pct": 0.03,
        "typ": "spice",
        "allergen": false,
        "hinweis": "",
        "funktion": "Feine Kopfnote",
        "supplier": "WIBERG"
      }
    ],
    "auditStatus": "verified"
  }
];

export function getBratwurstRecipes() {
  return bratwurstRecipes;
}



export const THEKE_MOBILE_MEDIA_QUERY = '(max-width: 768px)';

export const THEKE_QUICK_FILTERS = [
  { id: 'galloway', label: 'Galloway Rind', query: 'galloway' },
  { id: 'bratwurst', label: 'Bratwurst', query: 'bratwurst' },
  { id: 'schinken', label: 'Schinken', query: 'schinken' },
  { id: 'allergenfrei', label: 'Allergenfrei', query: '', allergenFree: true },
];

export function isThekeMobileViewport(win = typeof window !== 'undefined' ? window : null) {
  try {
    return Boolean(win?.matchMedia?.(THEKE_MOBILE_MEDIA_QUERY)?.matches);
  } catch (_) {
    return false;
  }
}

export function normalizeThekeQuery(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function escapeThekeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function recipeCategoryLabel(recipe) {
  return recipe?.kat || recipe?.Kategorie || 'Ohne Kategorie';
}

export function ingredientNameOf(ing) {
  return ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || ing?.Produkt
    || ing?.ingredient
    || ing?.Ingredient
    || ing?.label
    || ing?.Label
    || 'Unbekannte Zutat';
}

export function ingredientTypOf(ing) {
  return String(ing?.typ || ing?.Typ || ing?.type || '').toLowerCase();
}

export function isSpiceIngredient(ing) {
  const typ = ingredientTypOf(ing);
  return typ === 'spice' || typ === 'gewuerz' || typ === 'gewürz' || typ.includes('spice') || typ.includes('gewuerz');
}

export function isBaseIngredient(ing) {
  const typ = ingredientTypOf(ing);
  if (isSpiceIngredient(ing)) return false;
  return !typ || typ === 'base' || typ === 'fleisch' || typ === 'meat' || typ.includes('base');
}

export function recipeAllergensOf(recipe) {
  const fromField = Array.isArray(recipe?.allergene)
    ? recipe.allergene.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (fromField.length) {
    return Array.from(new Set(fromField.map((label) => label.toUpperCase())));
  }
  const fromIngredients = (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .filter((ing) => Boolean(ing?.allergen || ing?.Allergen))
    .map((ing) => String(ing?.hinweis || ing?.Hinweis || ingredientNameOf(ing)).trim())
    .filter(Boolean);
  return Array.from(new Set(fromIngredients.map((label) => label.toUpperCase())));
}

export function isAllergenFreeRecipe(recipe) {
  if (recipeAllergensOf(recipe).length) return false;
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return !ingredients.some((ing) => Boolean(ing?.allergen || ing?.Allergen));
}

export function splitRecipeIngredients(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const spices = [];
  const bases = [];
  const other = [];
  ingredients.forEach((ing) => {
    if (isSpiceIngredient(ing)) spices.push(ing);
    else if (isBaseIngredient(ing)) bases.push(ing);
    else other.push(ing);
  });
  return { bases: [...bases, ...other], spices };
}

export function formatHaltbarkeitHint(recipe) {
  const raw = String(recipe?.haltbar || '').trim();
  if (!raw) return 'Haltbarkeit bitte im Rezept prüfen';
  const firstLine = raw.split(/\n+/)[0].trim();
  if (/haltbarkeit|lagerung|gekühlt|gekuehlt|max\.?\s*\d/i.test(firstLine) && firstLine.length <= 120) {
    return firstLine;
  }
  if (firstLine.length <= 90) return firstLine;
  return `${firstLine.slice(0, 87).trim()}…`;
}

export function recipeSearchHaystack(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((ing) => `${ingredientNameOf(ing)} ${ing?.hinweis || ''} ${ing?.Hinweis || ''}`).join(' ')
    : '';
  const allergens = recipeAllergensOf(recipe).join(' ');
  return normalizeThekeQuery([
    recipe?.name || '',
    recipe?.id || '',
    recipeCategoryLabel(recipe),
    recipe?.kaliber || '',
    recipe?.hinweis || '',
    recipe?.haltbar || '',
    recipe?.tipp || '',
    ingredients,
    allergens,
    isAllergenFreeRecipe(recipe) ? 'allergenfrei frei von allergenen ohne allergene' : '',
  ].join(' '));
}

/**
 * @param {object} recipe
 * @param {string} query
 * @param {{ allergenFree?: boolean, query?: string } | null} quickFilter
 */
export function matchesThekeRecipe(recipe, query, quickFilter = null) {
  if (quickFilter?.allergenFree && !isAllergenFreeRecipe(recipe)) return false;
  const needle = normalizeThekeQuery(quickFilter?.query || query);
  if (!needle) return true;
  return recipeSearchHaystack(recipe).includes(needle);
}

function renderAllergenBadges(recipe) {
  const allergens = recipeAllergensOf(recipe);
  if (!allergens.length) {
    return '<span class="recipe-allergen-badge recipe-allergen-badge--free">Frei von Allergenen</span>';
  }
  return allergens
    .map((label) => `<span class="recipe-allergen-badge">${escapeThekeHtml(label)}</span>`)
    .join('');
}

function renderIngredientList(items, emptyLabel) {
  if (!items.length) {
    return `<p class="recipe-ing-empty">${escapeThekeHtml(emptyLabel)}</p>`;
  }
  return `<ul class="recipe-ing-list">${items.map((ing) => {
    const name = ingredientNameOf(ing);
    const allergen = Boolean(ing?.allergen || ing?.Allergen);
    return `<li class="recipe-ing-item${allergen ? ' recipe-ing-item--allergen' : ''}">${escapeThekeHtml(name)}</li>`;
  }).join('')}</ul>`;
}

/**
 * Kompakte Theken-Karte: Name, Art, Allergene, Zutaten/Gewürze, Haltbarkeit.
 */
export function renderThekeRecipeCardHtml(recipe, { selected = false } = {}) {
  const id = String(recipe?.id || '');
  const name = recipe?.name || 'Unbenanntes Rezept';
  const category = recipeCategoryLabel(recipe);
  const { bases, spices } = splitRecipeIngredients(recipe);
  const haltbar = formatHaltbarkeitHint(recipe);
  const safeId = escapeThekeHtml(id).replace(/"/g, '&quot;');

  return `
    <article class="recipe-card recipe-card--theke${selected ? ' active-recipe' : ''}" data-recipe-id="${safeId}" data-theke-card="1">
      <div class="recipe-card-head">
        <h3 class="recipe-title">${escapeThekeHtml(name)}</h3>
        <p class="recipe-subinfo">${escapeThekeHtml(category)}${recipe?.kaliber ? ` · ${escapeThekeHtml(recipe.kaliber)}` : ''}</p>
      </div>
      <div class="recipe-allergen-row" aria-label="Allergene">${renderAllergenBadges(recipe)}</div>
      <div class="recipe-ingredients-block">
        <div class="recipe-ing-section">
          <h4 class="recipe-ing-heading">Zutaten</h4>
          ${renderIngredientList(bases, 'Keine Grundzutaten hinterlegt')}
        </div>
        <div class="recipe-ing-section">
          <h4 class="recipe-ing-heading">Gewürze</h4>
          ${renderIngredientList(spices, 'Keine Gewürze hinterlegt')}
        </div>
      </div>
      <p class="recipe-haltbar-hint">${escapeThekeHtml(haltbar)}</p>
    </article>
  `;
}

export function renderCompactRecipeCardHtml(recipe, { selected = false } = {}) {
  const id = String(recipe?.id || '');
  const name = recipe?.name || 'Unbenanntes Rezept';
  const category = recipeCategoryLabel(recipe);
  const count = Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0;
  const safeId = escapeThekeHtml(id).replace(/"/g, '&quot;');
  return `
    <div class="recipe-card${selected ? ' active-recipe' : ''}" data-recipe-id="${safeId}">
      <div class="recipe-meta-group">
        <span class="recipe-title">${escapeThekeHtml(name)}</span>
        <span class="recipe-subinfo">${escapeThekeHtml(category)} - ${count} Zutaten${recipe?.kaliber ? ` - ${escapeThekeHtml(recipe.kaliber)}` : ''}</span>
      </div>
      <div class="recipe-arrow" aria-hidden="true">&gt;</div>
    </div>
  `;
}
