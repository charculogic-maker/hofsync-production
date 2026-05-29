import 'package:flutter/material.dart';
import 'dart:math';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  bool isFirebaseConnected = false;
  try {
    // Cloud-Erkennung bleibt für spätere Live-Schaltung vorbereitet
    isFirebaseConnected = false; 
  } catch (e) {
    isFirebaseConnected = false;
  }

  runApp(CharcuLogicApp(firebaseActive: isFirebaseConnected));
}

class CharcuLogicApp extends StatelessWidget {
  final bool firebaseActive;
  const CharcuLogicApp({super.key, required this.firebaseActive});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CharcuLogic PRO',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        primaryColor: const Color(0xFF2E7D32),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2E7D32),
          primary: const Color(0xFF2E7D32),
          error: const Color(0xFFF44336),
          warning: const Color(0xFFEF6C00),
        ),
      ),
      home: MainNavigationHub(firebaseActive: firebaseActive),
    );
  }
}

class MainNavigationHub extends StatefulWidget {
  final bool firebaseActive;
  const MainNavigationHub({super.key, required this.firebaseActive});

  @override
  State<MainNavigationHub> createState() => _MainNavigationHubState();
}

class _MainNavigationHubState extends State<MainNavigationHub> {
  int _currentIndex = 0;

  // Zentraler App-State für den Simulationslauf
  List<Map<String, dynamic>> mockMhdItems = [
    {"id": "1", "ean": "4001234567890", "produkt": "Bioland Rindersteak", "marke": "StevesHof", "menge": 3.0, "tage": -2, "status": "aktiv"},
    {"id": "2", "ean": "4012345678901", "produkt": "Hausmacher Leberwurst", "marke": "StevesHof", "menge": 8.0, "tage": 1, "status": "aktiv"},
    {"id": "3", "ean": "4023456789012", "produkt": "Frische Bratwurst", "marke": "Demeter", "menge": 12.0, "tage": 5, "status": "aktiv"}
  ];

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      MhdMonitorScreen(items: mockMhdItems, onUpdate: () => setState(() {})),
      const WurstkuecheScreen(),
      const HaccpProtokollScreen(),
    ];

    return Scaffold(
      body: Column(
        children: [
          if (!widget.firebaseActive)
            Container(
              color: const Color(0xFFEF6C00),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
              child: const SafeArea(
                bottom: false,
                child: Center(
                  child: Text(
                    '⚠️ INTERAKTIVER OFFLINE-MOCK-MODUS (Cursor Live-Engine)',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
              ),
            ),
          Expanded(child: screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) => setState(() => _currentIndex = index),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.date_range, size: 28), label: 'MHD-Monitor'),
            NavigationDestination(icon: Icon(Icons.soup_kitchen, size: 28), label: 'Wurstküche'),
            NavigationDestination(icon: Icon(Icons.shield, size: 28), label: 'HACCP'),
          ],
        ),
      ),
    );
  }
}

// ***************************************************************************
// 1. SCREEN: MHD-MONITOR
// ***************************************************************************
class MhdMonitorScreen extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final VoidCallback onUpdate;
  const MhdMonitorScreen({super.key, required this.items, required this.onUpdate});

  void _openScanSimulator(BuildContext context) {
    String simulatedEan = "";
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [Icon(Icons.camera_alt, color: Color(0xFF2E7D32)), Text(' EAN-Scanner Sim')],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Scanne einen Artikel am Regal oder gib eine Test-EAN ein:'),
            const SizedBox(height: 12),
            TextField(
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'z.B. 40999999'),
              onChanged: (val) => simulatedEan = val.trim(),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(context);
              _handleScannedEan(context, simulatedEan);
            },
            child: const Text('Scan simulieren'),
          ),
        ],
      ),
    );
  }

  void _handleScannedEan(BuildContext context, String ean) {
    if (ean.isEmpty) return;
    final existingIndex = items.indexWhere((it) => it["ean"] == ean);

    if (existingIndex >= 0) {
      items[existingIndex]["menge"]++;
      items[existingIndex]["status"] = "aktiv";
      onUpdate();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('➕ Menge erhöht für: ${items[existingIndex]["produkt"]}'), backgroundColor: const Color(0xFF2E7D32)),
      );
    } else {
      String neuerName = "";
      String neueMarke = "";
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('📦 Neuer Artikel erkannt!', style: TextStyle(color: Color(0xFFEF6C00))),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Der Barcode $ean ist unbekannt. Bitte einmalig benennen:'),
              const SizedBox(height: 8),
              TextField(
                decoration: const InputDecoration(labelText: 'Produktname'),
                onChanged: (val) => neuerName = val.trim(),
              ),
              TextField(
                decoration: const InputDecoration(labelText: 'Marke / Erzeuger'),
                onChanged: (val) => neueMarke = val.trim(),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white),
              onPressed: () {
                if (neuerName.isNotEmpty) {
                  items.insert(0, {
                    "id": DateTime.now().millisecondsSinceEpoch.toString(),
                    "ean": ean,
                    "produkt": neuerName,
                    "marke": neueMarke.isEmpty ? "StevesHof" : neueMarke,
                    "menge": 1.0,
                    "tage": 7,
                    "status": "aktiv"
                  });
                  onUpdate();
                  Navigator.pop(context);
                }
              },
              child: const Text('Artikel lernen & einbuchen'),
            )
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MHD-Monitor', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2E7D32),
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.camera_alt, size: 30), onPressed: () => _openScanSimulator(context)),
          const SizedBox(width: 12),
        ],
      ),
      body: Stack(
        children: [
          ListView.builder(
            padding: const EdgeInsets.only(top: 12, left: 12, right: 12, bottom: 100),
            itemCount: items.length,
            itemBuilder: (context, index) {
              final it = items[index];
              bool isSoldOut = it["status"] == "ausverkauft";
              Color leftBarColor = Colors.green;
              if (it["tage"] < 0) leftBarColor = const Color(0xFFF44336);
              else if (it["tage"] <= 2) leftBarColor = const Color(0xFFEF6C00);

              return Opacity(
                opacity: isSoldOut ? 0.4 : 1.0,
                child: Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: Container(
                    decoration: BoxDecoration(border: Border(left: BorderSide(color: leftBarColor, width: 8))),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(it["produkt"], style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, decoration: isSoldOut ? TextDecoration.lineThrough : null)),
                        Text('EAN: ${it["ean"]} • ${it["marke"]} • Resttage: ${it["tage"]}', style: const TextStyle(color: Colors.grey)),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: isSoldOut ? Colors.grey : const Color(0xFFF44336), foregroundColor: Colors.white),
                              onPressed: () {
                                it["status"] = isSoldOut ? "aktiv" : "ausverkauft";
                                if (!isSoldOut) it["menge"] = 0.0;
                                onUpdate();
                              },
                              child: Text(isSoldOut ? 'Reaktivieren' : '🗑️ Ausverkauft'),
                            ),
                            Row(
                              children: [
                                InkWell(
                                  onTap: isSoldOut ? null : () { if (it["menge"] > 0) { it["menge"]--; onUpdate(); } },
                                  child: Container(width: 48, height: 48, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(8)), child: const Center(child: Text('-', style: TextStyle(fontSize: 20)))),
                                ),
                                SizedBox(width: 40, child: Center(child: Text('${it["menge"].toInt()}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)))),
                                InkWell(
                                  onTap: isSoldOut ? null : () { it["menge"]++; onUpdate(); },
                                  child: Container(width: 48, height: 48, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(8)), child: const Center(child: Text('+', style: TextStyle(fontSize: 20)))),
                                ),
                              ],
                            )
                          ],
                        )
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          Positioned(
            bottom: 16, left: 16, right: 16,
            child: PositionBoxSave(onSave: () {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ WriteBatch übertragen! Änderungen synchronisiert.'), backgroundColor: Color(0xFF2E7D32)));
            }),
          )
        ],
      ),
    );
  }
}

class PositionBoxSave extends StatelessWidget {
  final VoidCallback onSave;
  const PositionBoxSave({super.key, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 60), backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), elevation: 4),
      onPressed: onSave,
      child: const Text('💾 Änderungen speichern', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
    );
  }
}

// ***************************************************************************
// 2. SCREEN: WURSTKÜCHE (ALLE 13 BRATWURST-REZEPTE AUS DER CSV)
// ***************************************************************************
class WurstkuecheScreen extends StatefulWidget {
  const WurstkuecheScreen({super.key});

  @override
  State<WurstkuecheScreen> createState() => _WurstkuecheScreenState();
}

class _WurstkuecheScreenState extends State<WurstkuecheScreen> {
  Map<String, dynamic>? selectedRecipe;
  double productionTarget = 10.0; 

  final List<Map<String, dynamic>> bratwurstRecipes = [
    {
      "id": "Gallo-Rizo-BW",
      "name": "Frische Bratwurst Gallo-Rizo",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 20/22",
      "allergene": ["Sulfite", "Alkohol"],
      "tipp": "Hobby-Tipp: Nutze Einweg-Handschuhe über Textil-Handschuhen, um die Masse vor Körperwärme zu isolieren.",
      "haltbar": "Frisch: Max. 12 Std. bei < 4°C. Gefroren: Vakuumverpackt 6 Monate.",
      "hinweis": "Ziel: Rohstoffe und Brät möglichst bei 0°C bis 4°C halten. Rotwein-Gewürz-Infusion kalt vorbereiten und erst nach beginnender Bindung einarbeiten.",
      "anweisung_A": "Rindfleisch und Fett auf 0°C bis 2°C kühlen. Rotwein, Paprika, Pfeffer, Chili, Knoblauch, Cayenne und Koriander kalt ansetzen und 10 Min. quellen lassen. Salz separat halten. Saitlinge spülen und wässern.",
      "anweisung_B": "Magerfleisch und Fett sehr kalt durch die 5mm Lochscheibe wolfen. Bei Schmieren, grauem Schnittbild oder Fettfilm sofort rückkühlen und Schneidsatz prüfen.",
      "anweisung_C": "Zuerst mageren Anteil mit Meersalz mengen, bis deutliche Klebrigkeit entsteht. Fettanteil einarbeiten. Rotwein-Gewürz-Infusion langsam im letzten Drittel zugeben und nur bis zur Aufnahme mengen.",
      "anweisung_D": "Brät luftarm in Schafsaitlinge 20/22 füllen und gleichmäßig abdrehen. Ziel-Brättemperatur unter 6°C; 10°C ist Sperrgrenze. Sofort kühlen und Charge dokumentieren.",
      "ingredients": [
        {"name": "RII (Rindfleisch mager)", "pct": 73.35},
        {"name": "RIV (Fettabschnitte)", "pct": 19.06},
        {"name": "Rotwein (Bio)", "pct": 2.86},
        {"name": "Meersalz fein", "pct": 1.91},
        {"name": "Paprika edelsüß", "pct": 1.72},
        {"name": "Pfeffer weiß gemahlen", "pct": 0.29},
        {"name": "Chili gemahlen", "pct": 0.24},
        {"name": "Knoblauchflocken", "pct": 0.24},
        {"name": "Cayenne", "pct": 0.19},
        {"name": "Koriander", "pct": 0.14}
      ]
    },
    {
      "id": "G-BW",
      "name": "Frische Bratwurst vom Galloway",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 22/24",
      "allergene": [],
      "tipp": "Reines Weiderind besitzt festes Fettgewebe. Der Myosin-Aufschluss benötigt kräftige mechanische Energie.",
      "haltbar": "Frisch: Max. 24 Std. bei < 2°C. Gefroren: Vakuumverpackt 6 Monate.",
      "hinweis": "Rinderfett braucht sehr kalte Führung und scharfen Schnitt. Bindung über Salz und mageres Fleisch aufbauen, Fett erst danach kurz einarbeiten.",
      "anweisung_A": "Galloway-Magerfleisch und Rinderfett getrennt auf 0°C bis 2°C kühlen. Rinderfett bei Bedarf leicht anfrieren. Gewürze und Salz separat einwiegen.",
      "anweisung_B": "Magerfleisch und Fett getrennt durch die 4mm Scheibe wolfen. Schnittbild kontrollieren: kein Fettfilm, kein Quetschen, kein sichtbarer Saftaustritt.",
      "anweisung_C": "Magerfleisch mit Salz und Gewürzen auf Klebrigkeit mengen. Rinderfett danach kurz und gleichmäßig einarbeiten, damit die kernige Struktur erhalten bleibt.",
      "anweisung_D": "In Schafsaitlinge 22/24 füllen und auf Zielgewicht abdrehen. Ziel-Brättemperatur unter 6°C halten. Sofort vakuumieren oder abgedeckt kühlen.",
      "ingredients": [
        {"name": "Galloway Rindfleisch mager", "pct": 68.29},
        {"name": "Galloway Rinderfett", "pct": 26.34},
        {"name": "Zitronensaft", "pct": 0.24},
        {"name": "eiskaltes Wasser", "pct": 2.68},
        {"name": "Meersalz fein", "pct": 1.95},
        {"name": "Pfeffer weiß", "pct": 0.20},
        {"name": "Thymian", "pct": 0.15},
        {"name": "Paprika edelsüß", "pct": 0.10},
        {"name": "Muskat", "pct": 0.05}
      ]
    },
    {
      "id": "H-BW",
      "name": "Frische Bratwurst vom Hähnchen",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 20/22",
      "allergene": [],
      "tipp": "Geflügelfett schmilzt extrem früh. Eis-Schüttung eiskalt halten!",
      "haltbar": "Frisch: Sofort verarbeiten / Max 12 Std. Gefroren: 3 Monate.",
      "hinweis": "Geflügel ist mikrobiologisch besonders sensibel. Kreuzkontamination vermeiden, Geräte direkt vor Start desinfizieren und Brät unter 6°C halten.",
      "anweisung_A": "Hähnchenfleisch mit Haut, Eis/Wasser und Geräte auf 0°C bis 2°C bringen. Arbeitsflächen desinfizieren. Saitlinge spülen und wässern.",
      "anweisung_B": "Einmal durch die 3mm Lochscheibe wolfen. Jede Unterbrechung sofort zum Rückkühlen nutzen; keine Erwärmung zulassen.",
      "anweisung_C": "Mit Salz und eiskalter Schüttung zügig auf Bindung mengen. Temperatur laufend prüfen: Ziel unter 4°C, maximal 6°C.",
      "anweisung_D": "Zügig in Schafsaitlinge füllen. Sofort kühlen und zeitnah vollständig durcherhitzen oder schockfrosten. Charge nur mit dokumentierter Kühlkette freigeben.",
      "ingredients": [
        {"name": "Hähnchenfleisch mager", "pct": 68.20},
        {"name": "Hähnchenhaut / Fettanteil", "pct": 26.30},
        {"name": "eiskaltes Wasser", "pct": 2.92},
        {"name": "Meersalz fein", "pct": 1.75},
        {"name": "Majoran", "pct": 0.39},
        {"name": "Pfeffer weiß", "pct": 0.19},
        {"name": "Muskat", "pct": 0.10},
        {"name": "Paprika edelsüß", "pct": 0.10},
        {"name": "Piment gemahlen", "pct": 0.05}
      ]
    },
    {
      "id": "S-BW",
      "name": "Frische Bratwurst vom Schwein",
      "kat": "frische Bratwurst",
      "kaliber": "Schweinedarm 28/30",
      "allergene": [],
      "tipp": "Der handwerkliche Klassiker. Majoran entfaltet sein Aroma am besten, wenn er leicht mitgemengt wird.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Traditionelle grobe Struktur wahren, nicht übermengen.",
      "anweisung_A": "Schweineschulter und Bauch auf 0°C bis 2°C kühlen. Naturdärme gründlich spülen und in lauwarmem Wasser geschmeidig machen.",
      "anweisung_B": "Rohmaterial im Wechsel durch die grobe 5mm Lochscheibe wolfen. Sauberes Schnittbild sichern.",
      "anweisung_C": "Gewolftes Fleisch mit Salz, Pfeffer und Majoran mengen, bis die Masse zusammenhält und leicht klebrig ist. Nicht bis zur feinen Emulsion überarbeiten.",
      "anweisung_D": "In Schweinedärme füllen, auf 120g portionieren und abdrehen. Sofort bei 0°C bis 4°C kühlen und Kühlkette dokumentieren.",
      "ingredients": [
        {"name": "Schweinefleisch mager (S II)", "pct": 75.12},
        {"name": "Schweinebauch / Speck (S IV)", "pct": 19.51},
        {"name": "Zitronensaft", "pct": 0.29},
        {"name": "eiskaltes Wasser", "pct": 2.63},
        {"name": "Meersalz fein", "pct": 1.95},
        {"name": "Pfeffer weiß", "pct": 0.20},
        {"name": "Thymian", "pct": 0.15},
        {"name": "Paprika edelsüß", "pct": 0.10},
        {"name": "Muskat", "pct": 0.05}
      ]
    },
    {
      "id": "S-Chorizo-Griller",
      "name": "Griller Chorizo vom Schwein",
      "kat": "frische Bratwurst",
      "kaliber": "Schweinedarm 26/28",
      "allergene": ["Sulfite", "Alkohol"],
      "tipp": "Das intensive Pimenton de la Vera gibt die feurige rote Farbe. Zügig füllen.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Knoblauch-Wasser und Paprika kalt halten und erst nach beginnender Bindung einarbeiten, damit Struktur und Bindung stabil bleiben.",
      "anweisung_A": "Fleisch, Speck und Knoblauch-Wasser auf 0°C bis 2°C kühlen. Paprika und Gewürze exakt vorwiegen.",
      "anweisung_B": "Magerfleisch und Speck getrennt oder im Wechsel durch die 4mm Scheibe wolfen. Fett darf nicht schmieren.",
      "anweisung_C": "Zuerst Magerfleisch mit Salz auf Bindung mengen. Speck, Paprika und Knoblauch-Wasser portionsweise einarbeiten.",
      "anweisung_D": "In Naturdärme füllen, fest aber nicht überfüllt abdrehen. Brättemperatur unter 7°C halten und sofort kühlen.",
      "ingredients": [
        {"name": "Schweinefleisch mager (S II)", "pct": 71.91},
        {"name": "Schweinebauch / Speck (S IV)", "pct": 17.97},
        {"name": "Rotwein (spanisch)", "pct": 4.94},
        {"name": "Meersalz", "pct": 1.98},
        {"name": "Paprika edelsüß", "pct": 1.89},
        {"name": "Knoblauchflocken", "pct": 0.31},
        {"name": "Zucker", "pct": 0.31},
        {"name": "Pfeffer", "pct": 0.27},
        {"name": "Chili", "pct": 0.18},
        {"name": "Cayenne", "pct": 0.13},
        {"name": "Koriander", "pct": 0.07},
        {"name": "Kreuzkümmel", "pct": 0.04}
      ]
    },
    {
      "id": "GS-Rost-BW",
      "name": "Niederrheinische grobe Rostbratwurst",
      "kat": "frische Bratwurst",
      "kaliber": "Schweinedarm 28/30",
      "allergene": ["Senf"],
      "tipp": "Etwas Kümmel und Muskatblüte geben den typisch niederrheinischen Charakter.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Traditionelles Rezept. Keine Phosphatzusätze erlaubt, rein physikalische Bindung.",
      "anweisung_A": "Schweineschulter und Speck auf 0°C bis 2°C kühlen. Därme gründlich spülen und wässern. Allergenstatus der Gewürzmischung prüfen.",
      "anweisung_B": "Das gesamte Material grob durch die 6mm Lochscheibe wolfen. Kernige Struktur muss sichtbar bleiben.",
      "anweisung_C": "Salz und Naturgewürze hinzufügen. Von Hand oder im Menger kurz, aber kräftig auf Bindung bringen.",
      "anweisung_D": "In Schweinedärme füllen und auf ca. 140g lange Würste abdrehen. Sofort bei 0°C bis 4°C im Kühlraum lagern.",
      "ingredients": [
        {"name": "Galloway-Rindfleisch mager", "pct": 41.85},
        {"name": "Schweinefleisch mager", "pct": 30.00},
        {"name": "Schweinefett (Rückenspeck)", "pct": 20.00},
        {"name": "Eiskaltes Wasser", "pct": 5.00},
        {"name": "Meersalz", "pct": 1.80},
        {"name": "Zwiebelpulver / getrocknete Zwiebeln", "pct": 0.50},
        {"name": "weißer Pfeffer, gemahlen", "pct": 0.20},
        {"name": "Majoran, gerebelt", "pct": 0.20},
        {"name": "Brauner Zucker / Rübenkraut", "pct": 0.20},
        {"name": "Senfsaat, grob gestoßen", "pct": 0.10},
        {"name": "Knoblauchpulver", "pct": 0.10},
        {"name": "Piment, gemahlen", "pct": 0.05}
      ]
    },
    {
      "id": "S-Salsiccia",
      "name": "Salsiccia",
      "kat": "frische Bratwurst",
      "kaliber": "Schweinedarm 30/32",
      "allergene": ["Sulfite", "Alkohol"],
      "tipp": "Fenchelsaat kann kurz trocken angeröstet werden, muss vor dem Mengen aber vollständig auskühlen.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Weißwein ist bindungskritisch: kalt halten, langsam dosieren und erst nach beginnender Bindung einarbeiten.",
      "anweisung_A": "Fleisch und Weißwein auf 0°C bis 2°C kühlen. Fenchelsaat grob stoßen; angeröstete Saat vollständig auskühlen lassen. Gewürze vorwiegen.",
      "anweisung_B": "Schweinefleisch halbgrob durch die 5mm Scheibe wolfen. Gleichmäßiges Schnittbild wahren.",
      "anweisung_C": "Fleisch mit Salz auf Bindung mengen. Wein-Gewürz-Mischung langsam zugeben und nur bis zur vollständigen Aufnahme weiter mengen.",
      "anweisung_D": "In Schweinedarm 30/32 füllen und kurz-dick abbinden. Sofort kühlen; Sulfit- und Alkoholhinweis dokumentieren.",
      "ingredients": [
        {"name": "Schweinefleisch mager (S II)", "pct": 46.61},
        {"name": "Schweinebauch (S VIII)", "pct": 27.97},
        {"name": "Schweine-/Rindfleisch Anteil", "pct": 18.65},
        {"name": "trockener ital. Rotwein", "pct": 3.73},
        {"name": "Meersalz fein", "pct": 1.86},
        {"name": "Knoblauchgranulat", "pct": 0.14},
        {"name": "Fenchelsaat, gestoßen", "pct": 0.33},
        {"name": "Kümmel, gestoßen", "pct": 0.14},
        {"name": "Pfeffer schwarz gestoßen", "pct": 0.28},
        {"name": "Piment", "pct": 0.09},
        {"name": "Rosmarin gemahlen", "pct": 0.07},
        {"name": "Lorbeer gemahlen", "pct": 0.05},
        {"name": "Macis", "pct": 0.05},
        {"name": "Wacholderbeeren gemahlen", "pct": 0.03}
      ]
    },
    {
      "id": "Kräuter-BW",
      "name": "Kräuter-Bratwurst",
      "kat": "frische Bratwurst",
      "kaliber": "Schweinedarm 26/28",
      "allergene": ["Senf"],
      "tipp": "Frische Kräuter wie Petersilie und Schnittlauch erst ganz zum Schluss unterheben, damit sie grün bleiben.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Frische Kräuter erhöhen Keim- und Feuchteeintrag. Hygienisch vorbereiten, sehr gut trocknen und erst am Ende zugeben.",
      "anweisung_A": "Kräuter verlesen, waschen, sehr gut trocknen und fein schneiden. Fleisch auf 0°C bis 2°C vorkühlen. Allergenstatus prüfen, falls Senfmehl enthalten ist.",
      "anweisung_B": "Schweinemasse sauber durch die 4mm Scheibe wolfen.",
      "anweisung_C": "Fleisch mit Salz und Basisgewürzen auf Bindung mengen. Kräuter erst am Ende kurz und gleichmäßig unterheben.",
      "anweisung_D": "In Därme füllen und auf 100g abdrehen. Brättemperatur unter 7°C halten und sofort kühlen.",
      "ingredients": [
        {"name": "Schweineschulter S2", "pct": 60.00},
        {"name": "Schweinebauch S5", "pct": 30.00},
        {"name": "Eisschnee / Wasser", "pct": 7.00},
        {"name": "Meersalz", "pct": 1.90},
        {"name": "Pfeffer weiß gem.", "pct": 0.25},
        {"name": "Knoblauchgranulat", "pct": 0.20},
        {"name": "Senfmehl", "pct": 0.20},
        {"name": "Petersilie gerebelt", "pct": 0.20},
        {"name": "Kümmel gem.", "pct": 0.10},
        {"name": "Muskatnuss gem.", "pct": 0.10},
        {"name": "Ingwer gem.", "pct": 0.05}
      ]
    },
    {
      "id": "Gallo-Lamb-Merguez-Bio",
      "name": "Merguez Galloway-Lamm",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 22/24",
      "allergene": [],
      "tipp": "Harissa-Paste sorgt für die traditionelle nordafrikanische Schärfe. Schutzbrille beim Mengen empfohlen!",
      "haltbar": "Frisch: Max. 24 Std. bei < 2°C.",
      "hinweis": "Harissa kann Salz, Säure oder Öl enthalten. Paste erst nach beginnender Bindung dosieren und Allergen-/Zusatzstoffstatus prüfen.",
      "anweisung_A": "Rind, Lamm und Fett auf 0°C bis 2°C kühlen. Harissa, Knoblauch und Gewürze vorwiegen. Schafsaitlinge wässern.",
      "anweisung_B": "Fleisch und Fett durch die 3mm bis 4mm Lochscheibe wolfen. Sehr scharfen Schneidsatz verwenden.",
      "anweisung_C": "Mageranteil mit Salz auf Bindung mengen. Harissa und Gewürze danach einarbeiten; ölige Pasten nur bis zur homogenen Verteilung mengen.",
      "anweisung_D": "In Schafsaitlinge füllen und dünne Merguez abdrehen. Zieltemperatur unter 6°C halten und sofort kühlen.",
      "ingredients": [
        {"name": "Galloway RII (mager)", "pct": 58.29},
        {"name": "Lammfleisch / -fett (LII/LIV)", "pct": 38.87},
        {"name": "Meersalz", "pct": 1.75},
        {"name": "Paprika edelsüß", "pct": 0.44},
        {"name": "Zwiebelgranulat", "pct": 0.15},
        {"name": "Knoblauch", "pct": 0.15},
        {"name": "Muskat", "pct": 0.05},
        {"name": "Kreuzkümmel", "pct": 0.10},
        {"name": "Cayenne", "pct": 0.05},
        {"name": "Chili", "pct": 0.05},
        {"name": "Koriander", "pct": 0.10}
      ]
    },
    {
      "id": "Gallo-Citron-Sauge-Bio",
      "name": "Saucisse de Gallo (Citron & Sauge)",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 22/24",
      "allergene": [],
      "tipp": "Frischer Bio-Salbei besitzt intensive ätherische Öle. Nicht überdosieren.",
      "haltbar": "Frisch: Max. 24 Std. bei < 4°C.",
      "hinweis": "Zitrone dient Aroma und pH-Steuerung, ersetzt aber keine Hygiene oder Kühlung. Zitronensaft erst am Ende sparsam dosieren.",
      "anweisung_A": "Fleisch und Fett auf 0°C bis 2°C kühlen. Salbei fein schneiden. Zitronenschale abreiben; Zitronensaft kalt und sparsam bereitstellen.",
      "anweisung_B": "Galloway-Rindfleisch und Schweinebauch im Wechsel durch die 4mm Scheibe wolfen.",
      "anweisung_C": "Fleisch mit Salz auf Bindung mengen, Salbei und Zitronenschale einarbeiten. Zitronensaft erst am Ende langsam dosieren und nur bis zur Aufnahme mengen.",
      "anweisung_D": "In Schafsaitlinge füllen und abdrehen. Brättemperatur unter 7°C halten. Sofort kühlen und kurze Haltbarkeit dokumentieren.",
      "ingredients": [
        {"name": "Galloway RII (mager)", "pct": 61.93},
        {"name": "Rinderfett (kernig)", "pct": 33.35},
        {"name": "Meersalz", "pct": 1.72},
        {"name": "Salzzitrone (Bio, fein gehackt)", "pct": 2.38},
        {"name": "Salbei (getrocknet)", "pct": 0.24},
        {"name": "Pfeffer weiß (gemahlen)", "pct": 0.19},
        {"name": "Knoblauch (frisch, fein gewürfelt)", "pct": 0.14},
        {"name": "Macis", "pct": 0.05}
      ]
    },
    {
      "id": "cocktail_Gallo-Mary-Brat-Bio",
      "name": "Gallo-Mary Bratwurst (Bloody Mary Style)",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 20/22",
      "allergene": ["Sellerie", "Alkohol"],
      "tipp": "BIO Nadurot (Acerola) schützt die Fleischfarbe auf natürlichem Weg ohne Pökelstoff.",
      "haltbar": "Frisch: Max. 24 Std. bei < 2°C.",
      "hinweis": "Wodka und Tomatenmark können die Bindung schwächen. Erst nach stabiler Bindung langsam einarbeiten; Sellerie-Allergen dokumentieren.",
      "anweisung_A": "Tomatenmark, Wodka, Selleriesalz und Gewürze kalt vorwiegen. Kutterhilfsmittel und Nadurot exakt einwiegen. Saitlinge spülen.",
      "anweisung_B": "Rind- und Schweinefleisch eiskalt durch die feine 3mm Lochscheibe wolfen. Schnittbild prüfen.",
      "anweisung_C": "Fleisch mit Salz und Kutterpower auf stabile Bindung mengen. Tomaten-Wodka-Mix langsam am Ende einarbeiten; stoppen, wenn die Masse sichtbar weicher wird.",
      "anweisung_D": "In Schafsaitlinge füllen und als kleine Cocktail-Griller abdrehen. Brättemperatur unter 6°C halten; Sellerie- und Alkoholhinweis dokumentieren.",
      "ingredients": [
        {"name": "R II (Galloway mager)", "pct": 61.51},
        {"name": "R IV (Galloway Speck)", "pct": 26.36},
        {"name": "Eisschnee", "pct": 4.39},
        {"name": "Meersalz", "pct": 1.58},
        {"name": "BIO Kutterpower OH AF", "pct": 0.88},
        {"name": "BIO Nadurot", "pct": 0.26},
        {"name": "Tomatenmark (Bio)", "pct": 2.64},
        {"name": "Bio-Wodka", "pct": 1.76},
        {"name": "Selleriesalz", "pct": 0.22},
        {"name": "Pfeffer schwarz (grob)", "pct": 0.22},
        {"name": "Zitronenschale (Bio)", "pct": 0.09},
        {"name": "Acerola-Pulver", "pct": 0.09}
      ]
    },
    {
      "id": "cocktail_Huelser-Gin-Griller-Bio",
      "name": "Hülser Gin-Griller (Gin-Tonic Style)",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 20/22",
      "allergene": ["Alkohol"],
      "tipp": "Wacholderbeeren grob stoßen, nicht pulverisieren; zu feiner Wacholder kann beim Mengen bitter wirken.",
      "haltbar": "Frisch: Max. 24 Std. bei < 2°C.",
      "hinweis": "Gin ist bindungskritisch. Kalt halten, langsam dosieren und erst im letzten Drittel einarbeiten.",
      "anweisung_A": "Gin, Gewürze, Limettenabrieb und Hilfsstoffe auf 0°C bis 2°C bereitstellen. Wacholder grob stoßen.",
      "anweisung_B": "Schweinefleisch und Speck eiskalt durch die 3mm Scheibe wolfen. Temperaturanstieg vermeiden.",
      "anweisung_C": "Fleisch mit Salz und Kutterpower auf Bindung mengen. Gin langsam im letzten Drittel zugeben und nur bis zur vollständigen Aufnahme weiter mengen.",
      "anweisung_D": "In dünne Saitlinge füllen und als Minis abdrehen. Brättemperatur unter 7°C halten und sofort kühlen.",
      "ingredients": [
        {"name": "Schweineschulter S2 (Bio)", "pct": 58.27},
        {"name": "Schweinebauch S5 (Bio)", "pct": 31.38},
        {"name": "Eisschnee", "pct": 4.48},
        {"name": "Bio-Gin (hochwertig)", "pct": 2.24},
        {"name": "Meersalz", "pct": 1.61},
        {"name": "BIO Kutterpower OH AF", "pct": 0.90},
        {"name": "BIO Nadurot", "pct": 0.27},
        {"name": "Wacholderbeeren (Bio)", "pct": 0.36},
        {"name": "Limettenabrieb (Bio)", "pct": 0.13},
        {"name": "Pfeffer weiß (gemahlen)", "pct": 0.18},
        {"name": "Koriandersaat (Bio)", "pct": 0.09},
        {"name": "Acerola-Pulver", "pct": 0.09}
      ]
    },
    {
      "id": "cocktail_Dark-Stormy-Brat-Bio",
      "name": "Dark & Stormy Griller (Rum & Ginger Style)",
      "kat": "frische Bratwurst",
      "kaliber": "Schafsaitling 20/22",
      "allergene": ["Alkohol"],
      "tipp": "Der frische, geriebene Ingwer gibt eine spritzige Schärfe, die perfekt mit dem dunklen Rum harmoniert.",
      "haltbar": "Frisch: Max. 24 Std. bei < 2°C.",
      "hinweis": "Rum und Limettensaft sind bindungskritisch. Sehr kalt und erst am Ende portionsweise einarbeiten.",
      "anweisung_A": "Rum, frisch geriebenen Ingwer, Limettensaft und Hilfsstoffe kalt bereitstellen. Ingwer unmittelbar vor Verarbeitung reiben und abgedeckt kühlen.",
      "anweisung_B": "Fleisch eiskalt durch die 3mm Lochscheibe wolfen. Bei Schmieren stoppen und Schneidsatz prüfen.",
      "anweisung_C": "Masse mit Salz, BIO Kutterpower und Nadurot auf Bindung mengen. Rum, Ingwer und Limettensaft am Ende portionsweise zugeben.",
      "anweisung_D": "Sofort in Schafsaitlinge füllen und portionieren. Zieltemperatur unter 6°C bis 7°C; 10°C ist Sperrgrenze. Kühlkette dokumentieren.",
      "ingredients": [
        {"name": "Schweineschulter S2 (Bio)", "pct": 57.88},
        {"name": "Schweinebauch S5 (Bio)", "pct": 31.17},
        {"name": "Eisschnee", "pct": 4.45},
        {"name": "Bio-Rum (Dunkel)", "pct": 2.23},
        {"name": "Meersalz", "pct": 1.60},
        {"name": "BIO Kutterpower OH AF", "pct": 0.89},
        {"name": "BIO Nadurot", "pct": 0.27},
        {"name": "Ingwer (Bio, frisch gerieben)", "pct": 0.53},
        {"name": "Limettensaft (Bio)", "pct": 0.45},
        {"name": "Rohrohrzucker (Bio)", "pct": 0.22},
        {"name": "Pfeffer weiß", "pct": 0.18},
        {"name": "Piment (Bio)", "pct": 0.04},
        {"name": "Acerola-Pulver", "pct": 0.09}
      ]
    }
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Wurstküche & Rezepte', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2E7D32),
        foregroundColor: Colors.white,
      ),
      body: selectedRecipe == null ? buildRecipeList() : buildRecipeDetail(),
    );
  }

  Widget buildRecipeList() {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: bratwurstRecipes.length,
      itemBuilder: (context, index) {
        final r = bratwurstRecipes[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 2,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            leading: const CircleAvatar(backgroundColor: Color(0xFF2E7D32), foregroundColor: Colors.white, child: Icon(Icons.restaurant_menu)),
            title: Text(r["name"], style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            subtitle: Text('Darm: ${r["kaliber"]} • ${r["kat"]}'),
            trailing: const Icon(Icons.arrow_forward_ios, color: Color(0xFF2E7D32), size: 18),
            onTap: () => setState(() => selectedRecipe = r),
          ),
        );
      },
    );
  }

  Widget buildRecipeDetail() {
    List<dynamic> allergens = selectedRecipe!["allergene"];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.grey[300], foregroundColor: Colors.black80),
            icon: const Icon(Icons.arrow_back),
            label: const Text('Zurück zur Auswahl', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () => setState(() => selectedRecipe = null),
          ),
          const SizedBox(height: 16),
          Text(selectedRecipe!["name"], style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32))),
          Text('Kategorie: ${selectedRecipe!["kat"]} • Kaliber: ${selectedRecipe!["kaliber"]}', style: TextStyle(color: Colors.grey[600], fontSize: 14)),
          const SizedBox(height: 12),
          
          // ALLERGEN CHIPS
          if (allergens.isNotEmpty)
            Wrap(
              spacing: 8,
              children: allergens.map((all) => Chip(
                label: Text(all, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                backgroundColor: const Color(0xFFFFCC80),
                side: BorderSide.none,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              )).toList(),
            ),
          const SizedBox(height: 16),
          
          // CHARGEN-RECHNER MATRIX
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.grey[300]!)),
            child: Row(
              children: [
                const Expanded(child: Text('Gewünschte Charge:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                SizedBox(
                  width: 110,
                  child: TextField(
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32)),
                    decoration: const InputDecoration(suffixText: ' kg', contentPadding: EdgeInsets.zero),
                    onChanged: (val) {
                      setState(() {
                        productionTarget = double.tryParse(val.replaceAll(',', '.')) ?? 10.0;
                      });
                    },
                    controller: TextEditingController(text: productionTarget.toStringAsFixed(0))..selection = TextSelection.fromPosition(TextPosition(offset: productionTarget.toStringAsFixed(0).length)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // PRÄMISSE BOX
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: const Color(0xFFFFEBEE), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFF44336))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(children: [Icon(Icons.gavel, color: Color(0xFFF44336), size: 20), SizedBox(width: 6), Text('QUALITÄTS-PRÄMISSE', style: TextStyle(color: Color(0xFFF44336), fontWeight: FontWeight.bold, fontSize: 14))]),
                const SizedBox(height: 6),
                Text(selectedRecipe!["hinweis"], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(height: 20),

          const Text('Skalierte Zutaten-Matrix:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),

          // TABELLE FÜR MATRIX
          Table(
            border: TableBorder.all(color: Colors.grey[300]!, width: 1, borderRadius: BorderRadius.circular(8)),
            columnWidths: const {0: FlexColumnWidth(3), 1: FlexColumnWidth(1), 2: FlexColumnWidth(2)},
            children: [
              TableRow(
                decoration: BoxDecoration(color: Colors.grey[300]),
                children: const [
                  Padding(padding: EdgeInsets.all(10), child: Text('Zutat', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                  Padding(padding: EdgeInsets.all(10), child: Text('%', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                  Padding(padding: EdgeInsets.all(10), child: Text('Menge', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                ]
              ),
              ...((selectedRecipe!["ingredients"] as List).map((ing) {
                double computedGramm = (productionTarget * 1000) * (ing["pct"] / 100);
                String displayWeight = computedGramm >= 1000 
                  ? '${(computedGramm / 1000).toStringAsFixed(2)} kg' 
                  : computedGramm < 1
                    ? '${computedGramm.toStringAsFixed(2)} g'
                    : computedGramm < 10
                      ? '${computedGramm.toStringAsFixed(1)} g'
                      : '${computedGramm.toStringAsFixed(0)} g';
                return TableRow(
                  children: [
                    Padding(padding: const EdgeInsets.all(10), child: Text(ing["name"], style: const TextStyle(fontSize: 13))),
                    Padding(padding: const EdgeInsets.all(10), child: Text('${ing["pct"]}%', style: const TextStyle(fontSize: 13))),
                    Padding(padding: const EdgeInsets.all(10), child: Text(displayWeight, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E7D32), fontSize: 13))),
                  ]
                );
              }).toList())
            ],
          ),
          const SizedBox(height: 24),

          const Text('4-Phasen Standard Operating Procedure (SOP):', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          // FARBIGE PHASEN KARTEN (A - D)
          buildPhaseCard('PHASE A', 'Präzisions-Mise-en-Place', selectedRecipe!["anweisung_A"], const Color(0xFFE8F5E9), const Color(0xFF2E7D32)),
          buildPhaseCard('PHASE B', 'Struktur-Wolfen', selectedRecipe!["anweisung_B"], const Color(0xFFE3F2FD), const Color(0xFF1565C0)),
          buildPhaseCard('PHASE C', 'Myosin-Bindung & Emulgierung', selectedRecipe!["anweisung_C"], const Color(0xFFFFF8E1), const Color(0xFFF57F17)),
          buildPhaseCard('PHASE D', 'Konfektionierung & HACCP', selectedRecipe!["anweisung_D"], const Color(0xFFFFF3E0), const Color(0xFFE65100)),
          
          const SizedBox(height: 16),
          // MEISTER TIPP BLOCK
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.blueGrey[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.blueGrey[200]!)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [Icon(Icons.star, color: Colors.blueGrey[700], size: 20), const SizedBox(width: 6), Text('MEISTER-TIPP', style: TextStyle(color: Colors.blueGrey[800], fontWeight: FontWeight.bold, fontSize: 14))]),
                const SizedBox(height: 6),
                Text(selectedRecipe!["tipp"], style: TextStyle(fontSize: 13, color: Colors.blueGrey[900], height: 1.3, fontStyle: FontStyle.italic)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // HALTBARKEIT BLOCK
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.green[200]!)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [Icon(Icons.timelapse, color: Colors.green[700], size: 20), const SizedBox(width: 6), Text('LAGERUNG & HALTBARKEIT', style: TextStyle(color: Colors.green[800], fontWeight: FontWeight.bold, fontSize: 14))]),
                const SizedBox(height: 6),
                Text(selectedRecipe!["haltbar"], style: TextStyle(fontSize: 13, color: Colors.green[900], height: 1.3)),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget buildPhaseCard(String label, String subtitle, String text, Color bgColor, Color accentColor) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(12), border: Border.all(color: accentColor.withOpacity(0.3))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: TextStyle(color: accentColor, fontWeight: FontWeight.black, fontSize: 15, letterSpacing: 1)),
              Text(subtitle, style: TextStyle(color: accentColor.withOpacity(0.9), fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          Text(text, style: const TextStyle(fontSize: 13, height: 1.4, color: Colors.black87)),
        ],
      ),
    );
  }
}

// ***************************************************************************
// 3. SCREEN: HACCP-QUALITÄTSPROTOKOLL
// ***************************************************************************
class HaccpProtokollScreen extends StatefulWidget {
  const HaccpProtokollScreen({super.key});

  @override
  State<HaccpProtokollScreen> createState() => _HaccpProtokollScreenState();
}

class _HaccpProtokollScreenState extends State<HaccpProtokollScreen> {
  double phValue = 5.5;
  double temperature = 2.0;
  String batchNumber = "CH-20260523-A";

  void generateNewBatch() {
    final rand = Random();
    final chars = 'ABCDEFGH';
    setState(() {
      batchNumber = "CH-20260523-${chars[rand.nextInt(chars.length)]}";
    });
  }

  @override
  Widget build(BuildContext context) {
    bool isPse = phValue < 5.3;
    bool isDfd = phValue > 6.2;

    return Scaffold(
      appBar: AppBar(
        title: const Text('HACCP Qualitätssicherung', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2E7D32),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Chargendokumentation', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(8)),
                    child: Text('Charge: $batchNumber', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(minimumSize: const Size(60, 52), backgroundColor: const Color(0xFF2E7D32), foregroundColor: Colors.white),
                  onPressed: generateNewBatch,
                  child: const Icon(Icons.refresh),
                )
              ],
            ),
            const SizedBox(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('pH-Wert Messung:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text(phValue.toStringAsFixed(2), style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: (isPse || isDfd) ? const Color(0xFFF44336) : const Color(0xFF2E7D32))),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 18), trackHeight: 8),
              child: Slider(
                value: phValue, min: 4.0, max: 7.0,
                divisions: 30,
                activeColor: (isPse || isDfd) ? const Color(0xFFF44336) : const Color(0xFF2E7D32),
                onChanged: (val) => setState(() => phValue = val),
              ),
            ),

            if (isPse)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFEF6C00))),
                child: const Text('⚠️ Verdacht auf PSE-Fleisch! Schlechte Wasserbindung. Ungeeignet für Brühwurst/Kochpökelware.', style: TextStyle(color: Color(0xFFE65100), fontWeight: FontWeight.w500)),
              ),
            if (isDfd)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFFEBEE), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFF44336))),
                child: const Text('🚨 KRITISCHER KONTROLLPUNKT (CCP)! DFD-Fleisch detektiert. Stark verminderte Haltbarkeit, hohes Keimrisiko!', style: TextStyle(color: Color(0xFFC62828), fontWeight: FontWeight.bold)),
              ),

            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Brättemperatur / Kerntemperatur:', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                Text('${temperature.toStringAsFixed(1)} °C', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: temperature > 4.0 ? Colors.orange : const Color(0xFF2E7D32))),
              ],
            ),
            SliderTheme(
              data: SliderTheme.of(context).copyWith(thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 18), trackHeight: 8),
              child: Slider(
                value: temperature, min: -5.0, max: 20.0,
                divisions: 25,
                activeColor: temperature > 4.0 ? Colors.orange : const Color(0xFF2E7D32),
                onChanged: (val) => setState(() => temperature = val),
              ),
            ),
            if (temperature > 4.0)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.orange)),
                child: const Text('⚠️ Temperatur über 4° C! Kühlkette prüfen (Mikrobielles Verderbrisiko erhöht).', style: TextStyle(color: Color(0xFFE65100))),
              ),
            const SizedBox(height: 40),

            ElevatedButton(
              style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 60), backgroundColor: (isPse || isDfd) ? const Color(0xFFEF6C00) : const Color(0xFF2E7D32), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('📝 HACCP-Log für Charge $batchNumber erfolgreich archiviert!'), backgroundColor: const Color(0xFF2E7D32)));
              },
              child: const Text('📝 Protokoll eintragen', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            )
          ],
        ),
      ),
    );
  }
}
