// MHD-Bestand aus data/mhd_bestand.csv (aktive MoPro/Kühlware) + Trockenware-Tests
const mhdBestandSeed = [
  {"id": "1b334d1b", "ean": "4035626114509", "produkt": "b*Joghurt mild 1,8% Demeter Glas", "marke": "", "menge": 6, "tage": 0, "status": "aktiv"},
  {"id": "1f7c33ff", "ean": "4035626001137", "produkt": "b*Joghurt Pfirsich-Maracuja 3,5%", "marke": "", "menge": 4, "tage": 3, "status": "aktiv"},
  {"id": "f08c0f90", "ean": "4035626111614", "produkt": "b*Mozzarella Kugel, 100g", "marke": "", "menge": 1, "tage": 20, "status": "aktiv"},
  {"id": "04ec4037", "ean": "4035626114608", "produkt": "b*Vollmilch Demeter 3,8% Flasche", "marke": "", "menge": 6, "tage": 4, "status": "aktiv"},
  {"id": "5f537c22", "ean": "4026367043111", "produkt": "Bioland Harzer Natur", "marke": "", "menge": 5, "tage": 22, "status": "aktiv"},
  {"id": "e92183bc", "ean": "4260650730948", "produkt": "daikon kimchi (scharf)", "marke": "", "menge": 1, "tage": 22, "status": "aktiv"},
  {"id": "c331d90e", "ean": "4260712620002", "produkt": "Unbekannt", "marke": "", "menge": 12, "tage": 5, "status": "aktiv"},
  {"id": "66625d78", "ean": "3273227082587", "produkt": "Soja Alternative zu Quark Natur", "marke": "", "menge": 5, "tage": 6, "status": "aktiv"},
  {"id": "56dc1a34", "ean": "4035626114622", "produkt": "b*Milch Demeter 1,5% Flasche", "marke": "", "menge": 6, "tage": 6, "status": "aktiv"},
  {"id": "75482acb", "ean": "4035626100274", "produkt": "b*Vollmilch 3,7% Karton", "marke": "", "menge": 10, "tage": 9, "status": "aktiv"},
  {"id": "174d9a85", "ean": "4035626101394", "produkt": "b*Milch 1,5% Karton", "marke": "", "menge": 10, "tage": 9, "status": "aktiv"},
  {"id": "a1760838", "ean": "8008161501727", "produkt": "Ital. Landschinken Crudo", "marke": "", "menge": 1, "tage": 27, "status": "aktiv"},
  {"id": "81d2ea0d", "ean": "4035626000949", "produkt": "b*Schlagsahne 0,5 l Flasche", "marke": "", "menge": 6, "tage": 11, "status": "aktiv"},
  {"id": "ee5e72ba", "ean": "4030068015513", "produkt": "Putenschinken a.d. Putenbrust", "marke": "", "menge": 3, "tage": 11, "status": "aktiv"},
  {"id": "cf4e83fe", "ean": "4035626001243", "produkt": "b*Joghurt Mango-Vanille 3,5%", "marke": "", "menge": 6, "tage": 12, "status": "aktiv"},
  {"id": "bce6abf9", "ean": "4260100870019", "produkt": "Ziegen Frischkäse Natur 100g", "marke": "", "menge": 6, "tage": 13, "status": "aktiv"},
  {"id": "51599dc7", "ean": "4035661162770", "produkt": "b*Butter Süárahm", "marke": "", "menge": 10, "tage": 14, "status": "aktiv"},
  {"id": "4abec60a", "ean": "4260712620019", "produkt": "Natur Joghurt Bioland Schauhof", "marke": "", "menge": 12, "tage": 14, "status": "aktiv"},
  {"id": "7d790925", "ean": "4260100870033", "produkt": "Unbekannt", "marke": "", "menge": 6, "tage": 14, "status": "aktiv"},
  {"id": "253a679c", "ean": "4008471507031", "produkt": "Vanille-Pudding", "marke": "", "menge": 6, "tage": 15, "status": "aktiv"},
  {"id": "0e626c3b", "ean": "8008161501796", "produkt": "Ital. Mortadella", "marke": "", "menge": 5, "tage": 15, "status": "aktiv"},
  {"id": "7e76467f", "ean": "4004689500550", "produkt": "Frischcreme Lachs", "marke": "", "menge": 1, "tage": 32, "status": "aktiv"},
  {"id": "8b00c64a", "ean": "4008471491057", "produkt": "Sahnekefir auf Pflaume-Walnuss - Weidemilch", "marke": "", "menge": 6, "tage": 16, "status": "aktiv"},
  {"id": "77a14b03", "ean": "4260423370395", "produkt": "Wanda Frischkse Walnuss/Karamell", "marke": "", "menge": 4, "tage": 16, "status": "aktiv"},
  {"id": "5a7896be", "ean": "4260423370593", "produkt": "Freches Frollein Ziege Pepita Chili & Paprika", "marke": "", "menge": 4, "tage": 17, "status": "aktiv"},
  {"id": "dcccef8e", "ean": "4035626002356", "produkt": "b*Rahmjoghurt mild 10%", "marke": "", "menge": 6, "tage": 18, "status": "aktiv"},
  {"id": "86e77895", "ean": "8008161501772", "produkt": "Ital. Prosciutto Arrosto alle erbe", "marke": "", "menge": 6, "tage": 19, "status": "aktiv"},
  {"id": "4d4bd5fd", "ean": "4035626111645", "produkt": "b*Joghurt mild 3,5% Demeter Glas", "marke": "", "menge": 6, "tage": 19, "status": "aktiv"},
  {"id": "76360bc2", "ean": "4008471492894", "produkt": "Kefir mild 1,5%", "marke": "", "menge": 6, "tage": 19, "status": "aktiv"},
  {"id": "303a59ce", "ean": "4101530008811", "produkt": "Alpenmilch laktosefrei 1,5%", "marke": "", "menge": 10, "tage": 20, "status": "aktiv"},
  {"id": "9489c69f", "ean": "4008471514565", "produkt": "Reibekäse Gouda", "marke": "", "menge": 9, "tage": 37, "status": "aktiv"},
  {"id": "6026beb2", "ean": "4008471507383", "produkt": "Grieápudding Traditionell", "marke": "", "menge": 6, "tage": 22, "status": "aktiv"},
  {"id": "0f3f9c26", "ean": "4260423370302", "produkt": "Fanti das Schaf Fetacreme mit Paprika", "marke": "", "menge": 4, "tage": 22, "status": "aktiv"},
  {"id": "e866bbd0", "ean": "4260028360425", "produkt": "Hefepaste Bioreal", "marke": "", "menge": 12, "tage": 22, "status": "aktiv"},
  {"id": "86c537c1", "ean": "4035626113274", "produkt": "b*Schlagsahne 30% - im Becher", "marke": "", "menge": 10, "tage": 23, "status": "aktiv"},
  {"id": "82512cb0", "ean": "4008471491002", "produkt": "Sahnekefir auf Himbeere - Weidemilch", "marke": "", "menge": 6, "tage": 23, "status": "aktiv"},
  {"id": "47f62a7a", "ean": "4104060027659", "produkt": "Lassi Mango 3,5%", "marke": "", "menge": 10, "tage": 24, "status": "aktiv"},
  {"id": "27c55441", "ean": "4000915029116", "produkt": "Tortellini mit Käse und Tomaten", "marke": "", "menge": 8, "tage": 41, "status": "aktiv"},
  {"id": "52035b03", "ean": "8714685903373", "produkt": "Hummus Pikant", "marke": "", "menge": 3, "tage": 41, "status": "aktiv"},
  {"id": "063e4e0b", "ean": "3254550032807", "produkt": "Camembert D'Isigny", "marke": "", "menge": 3, "tage": 25, "status": "aktiv"},
  {"id": "e525c45c", "ean": "3296651110671", "produkt": "Brillat Savarin IGP Affin‚, 5x100g", "marke": "", "menge": 6, "tage": 25, "status": "aktiv"},
  {"id": "189a21aa", "ean": "4032277012512", "produkt": "Wheaty Vegane Merguez 2.0", "marke": "", "menge": 2, "tage": 42, "status": "aktiv"},
  {"id": "eb200efc", "ean": "4035661162107", "produkt": "b*Speisequark/Topfen Vollfettstufe 40%", "marke": "", "menge": 6, "tage": 26, "status": "aktiv"},
  {"id": "aaad2039", "ean": "4035626002035", "produkt": "b*Skyr Natur", "marke": "", "menge": 12, "tage": 26, "status": "aktiv"},
  {"id": "ef280971", "ean": "4035626001205", "produkt": "b*Joghurt Stracciatella 3,5%", "marke": "", "menge": 6, "tage": 26, "status": "aktiv"},
  {"id": "fa9b619d", "ean": "4028332323013", "produkt": "Kreta Frische Creme", "marke": "", "menge": 6, "tage": 26, "status": "aktiv"},
  {"id": "086b7d7d", "ean": "4027468000010", "produkt": "Meerrettich", "marke": "", "menge": 3, "tage": 43, "status": "aktiv"},
  {"id": "28c7e466", "ean": "4104060025969", "produkt": "Lassi Himbeere 3,5%", "marke": "", "menge": 6, "tage": 27, "status": "aktiv"},
  {"id": "1492a62e", "ean": "4008471492115", "produkt": "Joghurt Mango-Vanille 3,8%", "marke": "", "menge": 6, "tage": 28, "status": "aktiv"},
  {"id": "d07997a2", "ean": "4035626002974", "produkt": "b*Speisequark/Topfen Magerstufe 0,1%", "marke": "", "menge": 6, "tage": 28, "status": "aktiv"},
  {"id": "5a1ce225", "ean": "4008471492122", "produkt": "Joghurt Pfirsich-Maracuja 3,8%", "marke": "", "menge": 6, "tage": 28, "status": "aktiv"},
  {"id": "4f9211c7", "ean": "4260423370197", "produkt": "Schani das Schaf Frischkäse Curry/Dattel", "marke": "", "menge": 4, "tage": 29, "status": "aktiv"},
  {"id": "709db0b0", "ean": "4008471507024", "produkt": "Schoko Pudding", "marke": "", "menge": 6, "tage": 29, "status": "aktiv"},
  {"id": "b6421662", "ean": "4035626001373", "produkt": "b*Schmand 24% - im Becher", "marke": "", "menge": 10, "tage": 29, "status": "aktiv"},
  {"id": "b4b076c0", "ean": "4260423370203", "produkt": "Kurt das Schaf Frischkäse Kräuter/Knoblauch", "marke": "", "menge": 4, "tage": 29, "status": "aktiv"},
  {"id": "594cf8f5", "ean": "8058056170910", "produkt": "La Rusticana - Pinsa Teig (2x250g)", "marke": "", "menge": 8, "tage": 29, "status": "aktiv"},
  {"id": "18a594b7", "ean": "4260423370265", "produkt": "Fanti das Schaf Fetacreme mit Paprika", "marke": "", "menge": 4, "tage": 29, "status": "aktiv"},
  {"id": "d3a6ea0d", "ean": "4260423370586", "produkt": "Freches Frollein Ziege Sweet Curry", "marke": "", "menge": 4, "tage": 29, "status": "aktiv"},
  {"id": "e7891c5b", "ean": "4008471507505", "produkt": "Milchreis Natur", "marke": "", "menge": 6, "tage": 30, "status": "aktiv"},
  {"id": "a8b8d181", "ean": "4008471505006", "produkt": "Weidemilchjoghurt ABC 3,8%", "marke": "", "menge": 6, "tage": 30, "status": "aktiv"},
  {"id": "5eeab4df", "ean": "4032277005231", "produkt": "Wheaty Vegane Chorizo Bratwurst", "marke": "", "menge": 4, "tage": 48, "status": "aktiv"},
  {"id": "352135b5", "ean": "4017194462220", "produkt": "Joghurt Natur mild 3,5%", "marke": "", "menge": 6, "tage": 31, "status": "aktiv"},
  {"id": "fecd22c1", "ean": "4008471497042", "produkt": "Joghurt Zitronencreme 7,5%", "marke": "", "menge": 6, "tage": 32, "status": "aktiv"},
  {"id": "9f7f5918", "ean": "4035626003018", "produkt": "b*Speisequark/Topfen halbfett 20%", "marke": "", "menge": 6, "tage": 33, "status": "aktiv"},
  {"id": "99086048", "ean": "4035626002554", "produkt": "b*Tofu geräuchert VEGANI", "marke": "", "menge": 8, "tage": 34, "status": "aktiv"},
  {"id": "ed2d3c58", "ean": "4260067150599", "produkt": "Griechischer Ziegen Weichkse mariniert", "marke": "", "menge": 3, "tage": 35, "status": "aktiv"},
  {"id": "f3ca6ef4", "ean": "4035626114585", "produkt": "b*Quarkzubereitung Magerstufe 0,3%", "marke": "", "menge": 6, "tage": 36, "status": "aktiv"},
  {"id": "67c40e88", "ean": "4000915029147", "produkt": "Tortelli mit Steinpilz", "marke": "", "menge": 6, "tage": 38, "status": "aktiv"},
  {"id": "00dd85bc", "ean": "4035661163395", "produkt": "b*Frischkäse Kräuter", "marke": "", "menge": 6, "tage": 40, "status": "aktiv"},
  {"id": "f22c0b52", "ean": "4260067150193", "produkt": "Original griechischer Feta, mariniert", "marke": "", "menge": 3, "tage": 43, "status": "aktiv"},
  {"id": "b979b73a", "ean": "4000915029154", "produkt": "Frische Tagliatelle - Bandnudeln", "marke": "", "menge": 8, "tage": 45, "status": "aktiv"},
  {"id": "1a3400b3", "ean": "4035661162336", "produkt": "b*Frischkäse Natur", "marke": "", "menge": 6, "tage": 47, "status": "aktiv"},
  {"id": "6509ef93", "ean": "4008471514558", "produkt": "Reibekäse Quattro formaggi", "marke": "", "menge": 10, "tage": 48, "status": "aktiv"},
  {"id": "eeb454e0", "ean": "4035661162756", "produkt": "b*Butter Sauerrahm", "marke": "", "menge": 16, "tage": 49, "status": "aktiv"},
  {"id": "75b29f3e", "ean": "9007833008440", "produkt": "Schafquark Natur", "marke": "", "menge": 6, "tage": 49, "status": "aktiv"},
  {"id": "f0b6c3d3", "ean": "4000915101027", "produkt": "Sahne Schmelzkäsezubereitung", "marke": "", "menge": 7, "tage": 66, "status": "aktiv"},
  {"id": "56163bcb", "ean": "8714685907531", "produkt": "Hummus", "marke": "", "menge": 6, "tage": 51, "status": "aktiv"},
  {"id": "3c8f7e7e", "ean": "4012359115003", "produkt": "Seidentofu", "marke": "", "menge": 6, "tage": 52, "status": "aktiv"},
  {"id": "4bb216a6", "ean": "4000915105049", "produkt": "Ravioli mit Rucola & Ricotta", "marke": "", "menge": 6, "tage": 52, "status": "aktiv"},
  {"id": "ee96b53d", "ean": "4260289422030", "produkt": "Veganes Hack", "marke": "", "menge": 3, "tage": 72, "status": "aktiv"},
  {"id": "78b44a59", "ean": "4028332320111", "produkt": "Weiáenhorner Kräutercreme", "marke": "", "menge": 6, "tage": 58, "status": "aktiv"},
  {"id": "30.107.754", "ean": "4032277002704", "produkt": "Wheaty Vegane Slices Chorizo", "marke": "", "menge": 7, "tage": 76, "status": "aktiv"},
  {"id": "1bec8093", "ean": "4018462160572", "produkt": "Sahne Meerrettich, kühlpflichtig", "marke": "", "menge": 4, "tage": 77, "status": "aktiv"},
  {"id": "13e88670", "ean": "4002724000775", "produkt": "Alsan-Bio Margarine", "marke": "", "menge": 11, "tage": 63, "status": "aktiv"},
  {"id": "f9c90408", "ean": "4000915104547", "produkt": "Pesto Bärlauch, frisch", "marke": "", "menge": 6, "tage": 65, "status": "aktiv"},
  {"id": "6f690d4c", "ean": "4000915103410", "produkt": "Frische Gnocchi Originale", "marke": "", "menge": 6, "tage": 72, "status": "aktiv"},
  {"id": "4d467113", "ean": "4012359111104", "produkt": "Räuchertofu klassik", "marke": "", "menge": 8, "tage": 73, "status": "aktiv"},
  {"id": "01b15aa1", "ean": "4002824150943", "produkt": "Landkrone Bio Veganer Block", "marke": "", "menge": 12, "tage": 86, "status": "aktiv"},
  {"id": "314c3241", "ean": "8710488933296", "produkt": "Rodekool - Chou rouge", "marke": "Kramer", "menge": 12, "tage": 103, "status": "aktiv"},
  {"id": "15c88445", "ean": "4012359113405", "produkt": "Black Forest Tofu", "marke": "", "menge": 8, "tage": 90, "status": "aktiv"},
  {"id": "10a7a952", "ean": "4012359113108", "produkt": "Räuchertofu Mandel-Sesam", "marke": "", "menge": 6, "tage": 90, "status": "aktiv"},
  {"id": "a9da5ab0", "ean": "4032277005279", "produkt": "Wheaty Veganes Virginia Steak", "marke": "", "menge": 5, "tage": 101, "status": "aktiv"},
  {"id": "1f7ec9a9", "ean": "4260254440014", "produkt": "Rote bete", "marke": "Nordseeküstengenuss", "menge": 6, "tage": 130, "status": "aktiv"},
  {"id": "d0bd2344", "ean": "4032277012499", "produkt": "Wheaty Super Griller 2.0", "marke": "", "menge": 5, "tage": 122, "status": "aktiv"},
  {"id": "badb19e2", "ean": "4000915104592", "produkt": "Aioli Classico", "marke": "", "menge": 6, "tage": 122, "status": "aktiv"},
  {"id": "ac0248ba", "ean": "4260289420418", "produkt": "Hafer Joghurt Natur Alternative", "marke": "", "menge": 6, "tage": 124, "status": "aktiv"},
  {"id": "74bc623d", "ean": "4260289420456", "produkt": "Hafer Joghurt Mango-Maracuja Alternative", "marke": "", "menge": 6, "tage": 125, "status": "aktiv"},
  {"id": "f0482acf", "ean": "4250073460027", "produkt": "Kräuter Baguette", "marke": "", "menge": 12, "tage": 128, "status": "aktiv"},
  {"id": "125d5ce4", "ean": "4035626111607", "produkt": "b*griechischer Feta g.U.", "marke": "", "menge": 6, "tage": 130, "status": "aktiv"},
  {"id": "e093b94f", "ean": "4032277012475", "produkt": "Wheaty Superhero Burger 2.0", "marke": "", "menge": 5, "tage": 136, "status": "aktiv"},
  {"id": "023946bc", "ean": "4000915103373", "produkt": "Crostello Brat- & Grillkäse mariniert", "marke": "", "menge": 12, "tage": 141, "status": "aktiv"},
  {"id": "2cda549a", "ean": "4035626103824", "produkt": "b*Hafer Jogh.altern. Natur VEGANI", "marke": "", "menge": 6, "tage": 145, "status": "aktiv"},
  {"id": "8f6165aa", "ean": "4015533054266", "produkt": "Smoothie Spinat Minze Spirulina", "marke": "", "menge": 5, "tage": 185, "status": "aktiv"},
  {"id": "ed9be2a1", "ean": "4026913162280", "produkt": "Schaf Feta PDO \"Der Grieche\"", "marke": "", "menge": 10, "tage": 188, "status": "aktiv"},
  {"id": "cdd61989", "ean": "4260669270831", "produkt": "Classic Kimchi", "marke": "", "menge": 6, "tage": 210, "status": "aktiv"},
  {"id": "eca28aa0", "ean": "4015533052361", "produkt": "RAW Kombucha Ingwer Lemongras", "marke": "", "menge": 10, "tage": 211, "status": "aktiv"},
  {"id": "64d55b5d", "ean": "4260669270022", "produkt": "Love craft Kraut - Kurkuma & Curry", "marke": "", "menge": 6, "tage": 218, "status": "aktiv"},
  {"id": "f7403999", "ean": "4015533054365", "produkt": "Smoothie Erdbeere Himbeere", "marke": "", "menge": 6, "tage": 260, "status": "aktiv"},
  {"id": "9e47eea5", "ean": "4260669270008", "produkt": "Love craft Kraut - Rote Beete & Ingwer", "marke": "", "menge": 6, "tage": 260, "status": "aktiv"},
  {"id": "c9cb095c", "ean": "4035626103510", "produkt": "b*Beeren Müsli", "marke": "", "menge": 6, "tage": 276, "status": "aktiv"},
  {"id": "4b6973e7", "ean": "4100570016237", "produkt": "Ayurvedische Ghee Butter", "marke": "", "menge": 6, "tage": 290, "status": "aktiv"},
  {"id": "c639c437", "ean": "4035626103602", "produkt": "b*Bircher Müsli", "marke": "", "menge": 6, "tage": 290, "status": "aktiv"},
  {"id": "1b7e16db", "ean": "4035626113410", "produkt": "b*Vollkorn Spaghetti", "marke": "", "menge": 12, "tage": 352, "status": "aktiv"},
  {"id": "833672ea", "ean": "4035661162527", "produkt": "b*Brat”l Olive", "marke": "", "menge": 6, "tage": 365, "status": "aktiv"},
  {"id": "c92affd9", "ean": "4051147009827", "produkt": "Apfelschmalz im Glas", "marke": "", "menge": 2, "tage": 438, "status": "aktiv"},
  {"id": "8c42a2ed", "ean": "4051147009803", "produkt": "Schmalz im Glas", "marke": "", "menge": 1, "tage": 427, "status": "aktiv"},
  {"id": "3f888727", "ean": "4051147009810", "produkt": "Griebenschmalz im Glas", "marke": "", "menge": 1, "tage": 428, "status": "aktiv"},
  {"id": "2b4d915a", "ean": "4250073456075", "produkt": "Dinkel-Pizza Verdura vegan", "marke": "", "menge": 7, "tage": 453, "status": "aktiv"},
  {"id": "9acf329e", "ean": "4000915101522", "produkt": "Sonnengetrocknete Tomaten", "marke": "", "menge": 4, "tage": 495, "status": "aktiv"},
  {"id": "dad11c59", "ean": "4260515260023", "produkt": "Vegane Art Teewurst mit feinen Zutaten", "marke": "", "menge": 3, "tage": 507, "status": "aktiv"},
  {"id": "ba1ad2f9", "ean": "4260515260085", "produkt": "Vegane Art Leberwurst mit feinen Zutaten", "marke": "", "menge": 1, "tage": 541, "status": "aktiv"},
  {"id": "d771248d", "ean": "4026813020024", "produkt": "Brechbohnen", "marke": "", "menge": 1, "tage": 627, "status": "aktiv"},
  {"id": "t1", "ean": "9004145012134", "produkt": "Adios Salz mediterran", "marke": "SONNENTOR", "menge": 5, "tage": 15, "kategorie": "📦 Trockenware", "status": "aktiv"},
  {"id": "t2", "ean": "9004145123618", "produkt": "Adios Salz Gartengemüse", "marke": "SONNENTOR", "menge": 2, "tage": 2, "kategorie": "📦 Trockenware", "status": "aktiv"},
  {"id": "t3", "ean": "4012346156491", "produkt": "Anis ganz Tüte", "marke": "LEBENSBAUM", "menge": 3, "tage": 1, "kategorie": "📦 Trockenware", "status": "aktiv"},
  {"id": "t4", "ean": "4012346123456", "produkt": "Dinkel Bauernspätzle hell", "marke": "SPIELBERGER", "menge": 10, "tage": -2, "kategorie": "📦 Trockenware", "status": "aktiv"},
  {"id": "t5", "ean": "4006040007999", "produkt": "Bionella Schokocreme", "marke": "RAPUNZEL", "menge": 6, "tage": 45, "kategorie": "📦 Trockenware", "status": "aktiv"},
];

// ============================================================================
// FIREBASE / FIRESTORE (White-Label Mandanten-Architektur)
// ============================================================================

const currentTenantId = 'StevesHof_Hauptbetrieb';
const appsScriptWebAppUrl = 'https://script.google.com/macros/s/AKfycbzzSzR4isL2meZGxsA5tMJ7ShPko47T6I7n_izcAWQ3FgIdajKaMUE2Nw_H9fu9H3RI/exec';

function requireTenantId() {
  const tenantId = typeof currentTenantId === 'string' ? currentTenantId.trim() : '';
  if (!tenantId) {
    console.error('[CharcuLogic Firebase] currentTenantId ist nicht initialisiert – Cloud-Pfad würde tenants/undefined/... lauten.');
    return null;
  }
  return tenantId;
}

if (!requireTenantId()) {
  console.error('[CharcuLogic Firebase] Mandanten-ID fehlt beim App-Start. Seed und Cloud-Pfade werden abgebrochen.');
}

const firebaseConfig = {
  apiKey: "AIzaSyAdbEHEVn5gxB2OWPmX6AqNOdqiM9FPlPg",
  authDomain: "hofsync-production.firebaseapp.com",
  projectId: "hofsync-production",
  storageBucket: "hofsync-production.firebasestorage.app",
  messagingSenderId: "610455484308",
  appId: "1:610455484308:web:ebb65b005da77124da8181",
  measurementId: "G-BRTGB862D0"
};

let db = null;
let firebaseReady = false;
let mhdUnsubscribe = null;
let productionBatchesUnsubscribe = null;

function isFirebaseConfigValid(config) {
  if (!config || typeof config !== 'object') return false;
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const placeholderPatterns = [/^YOUR_/i, /^\.\.\.$/, /^$/, /^undefined$/i, /^null$/i];
  return requiredKeys.every((key) => {
    const value = config[key];
    if (typeof value !== 'string') {
      console.error(`[CharcuLogic Firebase] Config-Feld "${key}" fehlt oder ist kein String.`);
      return false;
    }
    if (placeholderPatterns.some((pattern) => pattern.test(value.trim()))) {
      console.error(`[CharcuLogic Firebase] Config-Feld "${key}" enthält noch Platzhalter-Wert: "${value}"`);
      return false;
    }
    return true;
  });
}

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('[CharcuLogic Firebase] Firebase SDK nicht geladen. Prüfe die Script-Tags in index.html.');
    return false;
  }
  if (!isFirebaseConfigValid(firebaseConfig)) {
    console.error('[CharcuLogic Firebase] Ungültige firebaseConfig – bitte echte Projekt-Credentials eintragen.');
    return false;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    firebaseReady = true;
    console.log(`[CharcuLogic Firebase] Verbunden mit Projekt "${firebaseConfig.projectId}" (Tenant: ${currentTenantId}).`);
    return true;
  } catch (err) {
    console.error('[CharcuLogic Firebase] Initialisierung fehlgeschlagen:', err);
    db = null;
    firebaseReady = false;
    return false;
  }
}

function mhdCollectionPath() {
  const tenantId = requireTenantId();
  return tenantId ? `tenants/${tenantId}/mhd_liste` : null;
}

function haccpCollectionPath() {
  const tenantId = requireTenantId();
  return tenantId ? `tenants/${tenantId}/haccp_logs` : null;
}

function productionBatchesCollectionPath() {
  const tenantId = requireTenantId();
  return tenantId ? `tenants/${tenantId}/produktion_chargen` : null;
}

function rezepteCollectionPath() {
  const tenantId = requireTenantId();
  return tenantId ? `tenants/${tenantId}/rezepte` : null;
}

function rezepteCollectionRef() {
  const tenantId = requireTenantId();
  if (!tenantId || !db) return null;
  return db.collection('tenants').doc(tenantId).collection('rezepte');
}

let recipesUnsubscribe = null;

function mhdDocRef(docId) {
  return db.doc(`${mhdCollectionPath()}/${docId}`);
}

// Bratwurst-Rezepte aus main.dart
const bratwurstRecipes = [
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "GS-Pfälzer-LW",
    "name": "Galloway & Schwein Pfälzer Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Produktionshinweis: extra Schüssel, mit Leber schaumig kuttern",
    "anweisung_A": "Fleisch, Fett, Leber und Schuettung getrennt vorbereiten. Gegarte Rohstoffe warm verarbeiten, rohe Leber kalt halten. Allergenstatus der Zutaten vor Produktionsbeginn pruefen.",
    "anweisung_B": "Vorgegarte Fleischanteile passend wolfen oder kuttern. Leber mit Salz fein aufschliessen und erst einarbeiten, wenn die Masse nicht mehr zu heiss ist.",
    "anweisung_C": "Gewuerze und weitere Zutaten gleichmaessig einarbeiten. In Glas, Darm oder Form fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Nach dem Erhitzen zuegig abkuehlen, kalt lagern und bei Glasware Deckel, Vakuum und Charge pruefen.",
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "G-LW",
    "name": "Galloway Leberwurst",
    "kat": "Kochwurst",
    "kaliber": "",
    "basis_g": "10.000,00",
    "allergene": [
      "MILCH"
    ],
    "tipp": "",
    "haltbar": "",
    "hinweis": "Allergene pruefen: MILCH.",
    "anweisung_A": "Fleisch, Fett, Leber und Schuettung getrennt vorbereiten. Gegarte Rohstoffe warm verarbeiten, rohe Leber kalt halten. Allergene kennzeichnen: Milch.",
    "anweisung_B": "Vorgegarte Fleischanteile passend wolfen oder kuttern. Leber mit Salz fein aufschliessen und erst einarbeiten, wenn die Masse nicht mehr zu heiss ist.",
    "anweisung_C": "Gewuerze und weitere Zutaten gleichmaessig einarbeiten. In Glas, Darm oder Form fuellen; Lufteinschluesse vermeiden und Fuellgewichte kontrollieren.",
    "anweisung_D": "Nach dem Erhitzen zuegig abkuehlen, kalt lagern und bei Glasware Deckel, Vakuum und Charge pruefen.",
    "ingredients": [
      {
        "name": "Rinderleber (Galloway), frisch",
        "pct": 30,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderbauch / Brust (Fett)",
        "pct": 27.5,
        "typ": "base",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Rinderwade / Rosenstück (Geliermaterial)",
        "pct": 18.5,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Kochsud (Aromatisch, fetthaltig)",
        "pct": 7,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Schulter / Oberschale (Magerfleisch)",
        "pct": 6.35,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Zwiebeln (Frisch)",
        "pct": 3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Butter",
        "pct": 2.5,
        "typ": "spice",
        "allergen": true,
        "hinweis": "MILCH"
      },
      {
        "name": "Meersalz",
        "pct": 1.75,
        "typ": "spice",
        "allergen": false,
        "hinweis": "Extra Schüssel für Leber!"
      },
      {
        "name": "Traubensaft (Rot, Direktsaft)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Galloway-Glace (Kollagen-Konzentrat)",
        "pct": 1,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Bio-Kartoffelflocken (Rein)",
        "pct": 0.8,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Apfelessig (Naturtrüb)",
        "pct": 0.3,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Pfeffer weiß, gemahlen",
        "pct": 0.15,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Majoran, gerebelt",
        "pct": 0.06,
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
      },
      {
        "name": "Ingwer, gemahlen",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      },
      {
        "name": "Muskatnuss, gemahlen",
        "pct": 0.02,
        "typ": "spice",
        "allergen": false,
        "hinweis": ""
      }
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    "id": "alt_Schwein-Mettwurst",
    "name": "StevesHof Mettwurst_alt",
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  }
];

function recipeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getSafeFirestoreId(id) {
  return String(id || '')
    .replace(/\//g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const localRecipeIndex = new Map(bratwurstRecipes.map((recipe) => [String(recipe.id), recipe]));
const localRecipeLookup = new Map();
bratwurstRecipes.forEach((recipe) => {
  localRecipeIndex.set(getSafeFirestoreId(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.id), recipe);
  localRecipeLookup.set(recipeLookupKey(getSafeFirestoreId(recipe.id)), recipe);
  localRecipeLookup.set(recipeLookupKey(recipe.name), recipe);
});

function recipeIdsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b)
    || getSafeFirestoreId(a) === getSafeFirestoreId(b)
    || recipeLookupKey(a) === recipeLookupKey(b);
}

function findLocalRecipe(recipe, fallbackId = '') {
  return localRecipeIndex.get(String(recipe?.id))
    || localRecipeIndex.get(String(fallbackId))
    || localRecipeLookup.get(recipeLookupKey(recipe?.id))
    || localRecipeLookup.get(recipeLookupKey(recipe?.name))
    || localRecipeLookup.get(recipeLookupKey(fallbackId))
    || bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipe?.id) || recipeIdsMatch(entry.id, fallbackId))
    || null;
}

function ingredientsFromBratwurstSeed(recipeId) {
  if (recipeId == null || recipeId === '') return [];
  const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, recipeId));
  if (seedRecipe?.ingredients?.length) {
    return seedRecipe.ingredients;
  }
  const localRecipe = findLocalRecipe({ id: recipeId }, recipeId);
  return Array.isArray(localRecipe?.ingredients) ? localRecipe.ingredients : [];
}

function ensureRecipeIngredients(recipe, recipeId = recipe?.id) {
  if (!recipe) return null;

  let ingredients = recipe.ingredients;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    const fallbackIngredients = ingredientsFromBratwurstSeed(recipeId || recipe.id);
    if (fallbackIngredients.length) {
      console.warn('[CharcuLogic Wurstküche] Cloud ohne Zutaten – Fallback aus bratwurstRecipes:', recipeId || recipe.id);
      ingredients = fallbackIngredients;
    } else {
      ingredients = [];
    }
  }

  return { ...recipe, ingredients };
}

function recipesForKitchenList() {
  const recipesById = new Map();

  bratwurstRecipes.forEach((recipe) => {
    recipesById.set(String(recipe.id), ensureRecipeIngredients(recipe, recipe.id));
  });

  AppState.recipes.forEach((cloudRecipe) => {
    const localRecipe = findLocalRecipe(cloudRecipe, cloudRecipe.id || cloudRecipe.docId);
    const mergedId = String(localRecipe?.id || cloudRecipe.id || cloudRecipe.docId);
    const mergedRecipe = localRecipe
      ? {
          ...localRecipe,
          ...cloudRecipe,
          id: mergedId,
          ingredients: localRecipe.ingredients?.length
            ? localRecipe.ingredients
            : cloudRecipe.ingredients,
        }
      : cloudRecipe;

    recipesById.set(mergedId, ensureRecipeIngredients(mergedRecipe, mergedId));
  });

  return Array.from(recipesById.values()).filter(Boolean);
}

function getRecipeWithLocalFallback(recipeId) {
  const cloudRecipe = AppState.recipes.find(
    (recipe) => recipeIdsMatch(recipe.id, recipeId) || recipeIdsMatch(recipe.docId, recipeId)
  );
  const localRecipe = findLocalRecipe(cloudRecipe, recipeId);

  if (!cloudRecipe) {
    return ensureRecipeIngredients(localRecipe, recipeId);
  }

  const merged = localRecipe
    ? { ...localRecipe, ...cloudRecipe, ingredients: localRecipe.ingredients ?? cloudRecipe.ingredients }
    : cloudRecipe;

  return ensureRecipeIngredients(merged, recipeId);
}

function normalizeRecipeDoc(doc) {
  const cloudRecipe = { docId: doc.id, id: doc.id, ...doc.data() };
  const localRecipe = findLocalRecipe(cloudRecipe, doc.id);
  if (!localRecipe) {
    return ensureRecipeIngredients(cloudRecipe, doc.id);
  }
  return ensureRecipeIngredients({
    ...localRecipe,
    ...cloudRecipe,
    ingredients: localRecipe.ingredients?.length
      ? localRecipe.ingredients
      : cloudRecipe.ingredients,
  }, doc.id);
}

// State-Management für den Web-Prototypen
const AppState = {
  activeTab: 'mhd',
  wetHandsMode: false,
  currentSubTab: 'mopro',
  mhdSearchQuery: '',
  mhdUrgencyFilter: 'alarm',

  // MHD-Monitor – wird live aus Firestore geladen
  mhdProducts: [],
  // Wurstküche – live aus Firestore (tenants/.../rezepte)
  recipes: [],
  recipeSearchQuery: '',
  recipeCategoryFilter: 'all',
  selectedRecipeId: null,
  activeRecipeDetail: null,
  activeRecipeDataSource: 'local',
  productionTargetKg: 10.0,
  productionBatches: [],
  batchSearchQuery: '',
  recipeCloudAudit: null
};

// Web Audio API für Taktiles Feedback (Haptik)
let audioCtx = null;

function playClickSound(frequency = 1200, duration = 0.04, volume = 0.12) {
  try {
    // Initialisiere AudioContext beim ersten Klick
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Kurzer, knackiger "Klick"-Ton
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration + 0.02);
  } catch (e) {
    console.warn("Audio Haptik fehlgeschlagen: ", e);
  }
}

// Zeitaktualisierung in der Statusleiste
function updateStatusTime() {
  const timeEl = document.getElementById('status-time');
  if (timeEl) {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hrs}:${mins}`;
  }
}
setInterval(updateStatusTime, 10000);
updateStatusTime();

// Tab-Umschaltung
const tabs = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const headerTitle = document.getElementById('header-title');
const headerSubtitle = document.getElementById('header-subtitle');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');
    AppState.activeTab = targetTab;
    
    // Haptischer Klick (tiefere Frequenz für Nav-Tabs)
    playClickSound(800, 0.05, 0.15);
    
    // Navigationselemente aktualisieren
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Seiten anzeigen
    pages.forEach(p => p.classList.remove('active'));
    
    // Header anpassen
    if (targetTab === 'mhd') {
      document.getElementById('page-mhd').classList.add('active');
      headerTitle.textContent = "MHD-Monitor";
      headerSubtitle.textContent = "Qualitätssicherung";
      renderMhdList();
    } else if (targetTab === 'receiving') {
      document.getElementById('page-receiving').classList.add('active');
      headerTitle.textContent = "Wareneingang";
      headerSubtitle.textContent = "Lieferung erfassen";
      renderReceivingStatus();
    } else if (targetTab === 'kitchen') {
      document.getElementById('page-kitchen').classList.add('active');
      headerTitle.textContent = "Wurstküche";
      headerSubtitle.textContent = "Produktion";
      renderRecipes();
    } else if (targetTab === 'haccp') {
      document.getElementById('page-haccp').classList.add('active');
      headerTitle.textContent = "HACCP-Protokoll";
      headerSubtitle.textContent = "Dokumentation";
      updateHACCPAlerts();
    } else if (targetTab === 'batches') {
      document.getElementById('page-batches').classList.add('active');
      headerTitle.textContent = "Chargen-Archiv";
      headerSubtitle.textContent = "Büro & Rückverfolgung";
      renderRecipeCloudAudit();
      renderProductionBatches();
    }
    updateScannerButtonVisibility();
  });
});

// --- SCREEN 1: MHD-MONITOR LOGIC (Firestore Cloud-Sync) ---

const MHD_TROCKEN_CATEGORY = '📦 Trockenware';
const MHD_RENDER_LIMIT = 50;
const MHD_URGENCY_FILTERS = {
  alarm: '🚨 ALARM',
  action: '🏷️ AKTION',
  all: '📋 ALLE',
  done: '✅ ERLEDIGT',
};

// Rabatt-Matrix: Schwellwerte in Resttagen (Prüfen | 30% | 50% | Tonne)
const MHD_RABATT_MATRIX = {
  '🍎 Frische': { pruefen: 2, rabatt30: 1, rabatt50: 0, tonne: -1 },
  '🥛MoPro': { pruefen: 2, rabatt30: 1, rabatt50: 0, tonne: -1 },
  '🥗 Kühlware': { pruefen: 7, rabatt30: 3, rabatt50: 0, tonne: -1 },
  '📦 Trockenware': { pruefen: 30, rabatt30: 2, rabatt50: 1, tonne: -1 },
};

const MHD_ACTION_STYLES = {
  tonne: { label: '🗑️ ABSCHREIBEN / TONNE', color: '#F44336', bg: 'rgba(244, 67, 54, 0.14)' },
  rabatt50: { label: '🔥 50% RABATT', color: '#EF6C00', bg: 'rgba(239, 108, 0, 0.14)' },
  rabatt30: { label: '🏷️ 30% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  pruefen: { label: '👀 PRÜFEN', color: '#1565C0', bg: 'rgba(21, 101, 192, 0.14)' },
  ok: { label: '✅ OK (Regal)', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.14)' },
};

function normalizeMhdCategory(kategorie) {
  const kat = (kategorie || '').trim();
  if (!kat) return '🥛MoPro';
  if (kat === '❄️Kühlware') return '🥗 Kühlware';
  return kat;
}

function getProductCategory(prod) {
  return normalizeMhdCategory(prod.kategorie);
}

function resolveMhdActionKey(category, tage) {
  const rules = MHD_RABATT_MATRIX[category] || MHD_RABATT_MATRIX['🥛MoPro'];
  if (tage <= rules.tonne) return 'tonne';
  if (tage <= rules.rabatt50) return 'rabatt50';
  if (tage <= rules.rabatt30) return 'rabatt30';
  if (tage <= rules.pruefen) return 'pruefen';
  return 'ok';
}

function getMhdResttage(prod) {
  const rawValue = prod.tage ?? prod.resttage;
  const days = Number(rawValue);
  return Number.isFinite(days) ? days : Number.POSITIVE_INFINITY;
}

function sortMhdProductsByResttage(products) {
  return [...products].sort((a, b) => getMhdResttage(a) - getMhdResttage(b));
}

function isMhdActionWindow(prod) {
  const days = getMhdResttage(prod);
  if (!Number.isFinite(days)) return false;
  const category = getProductCategory(prod);
  const upperLimit = category === MHD_TROCKEN_CATEGORY ? 15 : 3;
  return days >= 1 && days <= upperLimit;
}

function matchesMhdUrgencyFilter(prod) {
  if (AppState.mhdUrgencyFilter === 'done') return Boolean(prod.soldOut);
  if (prod.soldOut) return false;

  const days = getMhdResttage(prod);
  if (AppState.mhdUrgencyFilter === 'alarm') return days <= 0;
  if (AppState.mhdUrgencyFilter === 'action') return isMhdActionWindow(prod);
  return true;
}

function filterMhdProducts(products) {
  const query = AppState.mhdSearchQuery.trim();
  return products.filter((prod) => {
    const category = getProductCategory(prod);
    const matchesTab = AppState.currentSubTab === 'mopro'
      ? category !== MHD_TROCKEN_CATEGORY
      : category === MHD_TROCKEN_CATEGORY;
    if (!matchesTab) return false;
    if (!matchesMhdUrgencyFilter(prod)) return false;
    if (!query) return true;
    const name = (prod.name || prod.produkt || '').toLowerCase();
    const brand = (prod.brand || prod.marke || '').toLowerCase();
    return name.includes(query) || brand.includes(query);
  });
}

function computeMhdAction(prod) {
  const tage = prod.tage ?? 0;
  const category = getProductCategory(prod);
  const key = resolveMhdActionKey(category, tage);
  if (key === 'pruefen' && category === MHD_TROCKEN_CATEGORY) {
    return { label: '📦 SONDERFLÄCHE / 20%', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' };
  }
  return MHD_ACTION_STYLES[key];
}

function initMhdSubnavAndSearch() {
  const subtabMopro = document.getElementById('subtab-mopro');
  const subtabTrocken = document.getElementById('subtab-trocken');
  const searchInput = document.getElementById('mhd-search-input');
  const urgencyButtons = document.querySelectorAll('.mhd-urgency-tab');

  subtabMopro?.addEventListener('click', () => {
    AppState.currentSubTab = 'mopro';
    subtabMopro.classList.add('active-subtab');
    subtabTrocken?.classList.remove('active-subtab');
    playClickSound(900, 0.04, 0.12);
    renderMhdList();
  });

  subtabTrocken?.addEventListener('click', () => {
    AppState.currentSubTab = 'trocken';
    subtabTrocken.classList.add('active-subtab');
    subtabMopro?.classList.remove('active-subtab');
    playClickSound(900, 0.04, 0.12);
    renderMhdList();
  });

  searchInput?.addEventListener('input', (event) => {
    AppState.mhdSearchQuery = event.target.value.toLowerCase();
    renderMhdList();
  });

  urgencyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      AppState.mhdUrgencyFilter = button.dataset.mhdUrgency || 'all';
      urgencyButtons.forEach((entry) => entry.classList.remove('active-urgency'));
      button.classList.add('active-urgency');
      playClickSound(980, 0.04, 0.12);
      renderMhdList();
    });
  });
}

function mapMhdDoc(doc) {
  const data = doc.data();
  const tage = data.tage ?? data.resttage ?? null;
  const category = normalizeMhdCategory(data.kategorie);
  let status = data.status;
  if (status === 'aktiv' && tage != null) {
    const actionKey = resolveMhdActionKey(category, tage);
    status = actionKey === 'tonne' ? 'expired' : actionKey === 'rabatt50' || actionKey === 'rabatt30' ? 'critical' : actionKey === 'pruefen' ? 'warning' : 'ok';
  }
  return {
    ...data,
    id: doc.id,
    ean: data.ean,
    name: data.produkt || data.name || 'Unbekannt',
    brand: data.marke || data.brand || '',
    qty: data.qty ?? data.menge ?? 0,
    tage,
    status: status || 'ok',
    mhdText: data.mhdText || (tage != null ? `${tage} Resttage` : ''),
    kategorie: data.kategorie || '',
    soldOut: data.soldOut ?? false
  };
}

function loadMhdFromCloud() {
  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] loadMhdFromCloud(): Firebase ist nicht initialisiert.');
    return;
  }

  if (mhdUnsubscribe) {
    mhdUnsubscribe();
    mhdUnsubscribe = null;
  }

  mhdUnsubscribe = db.collection(mhdCollectionPath()).onSnapshot(
    (snapshot) => {
      AppState.mhdProducts = snapshot.docs.map(mapMhdDoc);
      renderMhdList();
    },
    (err) => {
      console.error('[CharcuLogic Firebase] MHD Live-Sync Fehler:', err);
    }
  );
}

async function isMhdCollectionEmpty() {
  const snap = await db.collection("tenants/" + currentTenantId + "/mhd_liste").limit(1).get();
  return snap.empty;
}

async function importMhdBestandToCloud() {
  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] importMhdBestandToCloud(): Firebase nicht initialisiert.');
    return;
  }
  try {
    const empty = await isMhdCollectionEmpty();
    if (!empty) {
      console.info('[CharcuLogic Firebase] mhd_liste nicht leer – MHD-Seed übersprungen.');
      return;
    }
    await Promise.all(
      mhdBestandSeed.map((item) =>
        db.collection("tenants/" + currentTenantId + "/mhd_liste").doc(item.id).set(item)
      )
    );
    console.info(`[CharcuLogic Firebase] ${mhdBestandSeed.length} MHD-Artikel in Firestore geseedet.`);
  } catch (err) {
    console.error('[CharcuLogic Firebase] MHD-Seed fehlgeschlagen:', err);
  }
}

async function importBratwurstRecipesToCloud() {
  const tenantId = requireTenantId();
  console.log('AKTUELLER TENANT:', tenantId);

  if (!tenantId) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Seed abgebrochen - currentTenantId fehlt.');
    return;
  }

  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Firebase nicht initialisiert.');
    return;
  }

  console.log('AKTIVE PROJECT ID:', db.app.options.projectId);
  validateBratwurstMasterlist();

  try {
    const collectionRef = rezepteCollectionRef();
    if (!collectionRef) {
      console.error('[CharcuLogic Firebase] importBratwurstRecipesToCloud(): Keine gültige Rezept-Collection.');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const recipe of bratwurstRecipes) {
      const docId = String(recipe.id);
      const safeId = getSafeFirestoreId(docId);
      const recipePayload = {
        ...recipe,
        id: docId,
        firestoreId: safeId,
        ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
      };

      try {
        console.log('Sende Rezept an Pfad:', `tenants/${tenantId}/rezepte/${safeId}`);
        await collectionRef.doc(safeId).set(recipePayload);
        successCount += 1;
        console.log('\uD83D\uDD25 REZEPT PHYSISCH IM FIRESTORE GEBUCHT UNTER ID:', recipe.id);
      } catch (error) {
        failureCount += 1;
        console.error("\u274C CLOUD-UPLOAD BLOCKIERT:", error.message);
      }
    }

    console.log(`Force-Seed: ${successCount}/${bratwurstRecipes.length} Rezepte physisch vom Google-Server quittiert. Blockiert: ${failureCount}.`);
  } catch (error) {
    console.error("\u274C CLOUD-UPLOAD BLOCKIERT:", error.message);
  }
}

function mapRecipeDoc(doc) {
  return normalizeRecipeDoc(doc);
}

function loadRecipesFromCloud() {
  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Firebase nicht initialisiert.');
    return;
  }
  const collectionRef = rezepteCollectionRef();
  if (!collectionRef) {
    console.error('[CharcuLogic Firebase] loadRecipesFromCloud(): Keine gültige Rezept-Collection – Tenant prüfen.');
    return;
  }
  if (recipesUnsubscribe) {
    recipesUnsubscribe();
    recipesUnsubscribe = null;
  }
  recipesUnsubscribe = collectionRef.onSnapshot(
    (snapshot) => {
      AppState.recipes = snapshot.docs.map(mapRecipeDoc);
      validateCloudRecipesAgainstMasterlist(AppState.recipes);
      if (AppState.activeTab === 'kitchen') {
        renderRecipes();
      } else if (AppState.activeTab === 'batches') {
        renderRecipeCloudAudit();
      }
    },
    (err) => {
      console.error('[CharcuLogic Firebase] Rezept Live-Sync Fehler:', err);
    }
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mapProductionBatchDoc(doc) {
  const data = doc.data() || {};
  return {
    ...data,
    id: doc.id,
    chargenNummer: data.chargenNummer || doc.id,
  };
}

function formatBatchTimestamp(value) {
  if (!value) return 'Noch ohne Serverzeit';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Noch ohne Serverzeit';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function filteredProductionBatches() {
  const query = AppState.batchSearchQuery.trim().toLowerCase();
  const batches = Array.isArray(AppState.productionBatches) ? AppState.productionBatches : [];
  if (!query) return batches;
  return batches.filter((batch) => {
    const haystack = `${batch.chargenNummer || ''} ${batch.rezeptName || ''} ${batch.macher || ''} ${batch.abweichungen || ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderProductionBatches() {
  const container = document.getElementById('batch-list-container');
  if (!container) return;

  const visibleBatches = filteredProductionBatches();
  if (!visibleBatches.length) {
    container.innerHTML = `
      <div class="batch-empty-hint">
        ${AppState.productionBatches.length ? 'Keine Charge für diese Suche gefunden.' : 'Noch keine Produktionscharge dokumentiert.'}
      </div>`;
    return;
  }

  container.innerHTML = visibleBatches.map((batch) => {
    const deviations = String(batch.abweichungen || '').trim();
    const ingredientCount = Array.isArray(batch.zutatenBerechnet) ? batch.zutatenBerechnet.length : 0;
    const labelStatus = batch.etikettBasis?.status || 'vorbereitet';
    return `
      <article class="batch-card">
        <div class="batch-card-title">${escapeHtml(batch.rezeptName || 'Unbekanntes Rezept')}</div>
        <div class="recipe-subinfo">${escapeHtml(batch.chargenNummer)} · ${escapeHtml(formatBatchTimestamp(batch.zeitstempel))}</div>
        <div class="batch-card-meta">
          <div>
            <span class="batch-card-label">Menge</span>
            <span class="batch-card-value">${escapeHtml(batch.produktionsmengeKg ?? '-')} kg</span>
          </div>
          <div>
            <span class="batch-card-label">Macher</span>
            <span class="batch-card-value">${escapeHtml(batch.macher || '-')}</span>
          </div>
          <div>
            <span class="batch-card-label">pH / Kern</span>
            <span class="batch-card-value">${escapeHtml(batch.phWert ?? '-')} / ${escapeHtml(batch.kerntemperatur ?? '-')} °C</span>
          </div>
          <div>
            <span class="batch-card-label">Etikettenbasis</span>
            <span class="batch-card-value">${escapeHtml(labelStatus)} · ${ingredientCount} Zutaten</span>
          </div>
        </div>
        ${deviations ? `<div class="batch-card-deviation">Abweichungen: ${escapeHtml(deviations)}</div>` : ''}
      </article>
    `;
  }).join('');
}

function initBatchArchiveSearch() {
  const searchInput = document.getElementById('batch-search-input');
  if (!searchInput || searchInput.dataset.eventsBound === '1') return;
  searchInput.dataset.eventsBound = '1';
  searchInput.addEventListener('input', (event) => {
    AppState.batchSearchQuery = event.target.value || '';
    renderProductionBatches();
  });
}

function loadProductionBatchesFromCloud() {
  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Firebase nicht initialisiert.');
    return;
  }

  const collectionPath = productionBatchesCollectionPath();
  if (!collectionPath) {
    console.error('[CharcuLogic Firebase] loadProductionBatchesFromCloud(): Kein gültiger Chargen-Pfad.');
    return;
  }

  if (productionBatchesUnsubscribe) {
    productionBatchesUnsubscribe();
    productionBatchesUnsubscribe = null;
  }

  productionBatchesUnsubscribe = db.collection(collectionPath)
    .orderBy('zeitstempel', 'desc')
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        AppState.productionBatches = snapshot.docs.map(mapProductionBatchDoc);
        if (AppState.activeTab === 'batches') {
          renderProductionBatches();
        }
      },
      (err) => {
        console.error('[CharcuLogic Firebase] Chargen Live-Sync Fehler:', err);
      }
    );
}

function renderMhdList() {
  const container = document.getElementById('mhd-items-container');
  if (!container) return;

  if (!AppState.mhdProducts.length) {
    container.innerHTML = `
      <div class="mhd-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        ${firebaseReady ? 'Keine MHD-Artikel in der Cloud. Scanne einen Barcode zum Einlernen.' : 'Firebase nicht konfiguriert – MHD-Daten können nicht geladen werden.'}
      </div>`;
    return;
  }

  const sortedProducts = sortMhdProductsByResttage(AppState.mhdProducts);
  const visibleProducts = filterMhdProducts(sortedProducts);
  const renderedProducts = visibleProducts.slice(0, MHD_RENDER_LIMIT);

  if (!visibleProducts.length) {
    const activeFilterLabel = MHD_URGENCY_FILTERS[AppState.mhdUrgencyFilter] || MHD_URGENCY_FILTERS.all;
    container.innerHTML = `
      <div class="mhd-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        Keine Artikel in dieser Kategorie${AppState.mhdSearchQuery ? ' für deine Suche' : ''} im Filter ${activeFilterLabel}.
      </div>`;
    return;
  }

  const limitHint = visibleProducts.length > MHD_RENDER_LIMIT
    ? `<div class="mhd-render-limit-hint">Zeige die dringendsten ${MHD_RENDER_LIMIT} von ${visibleProducts.length} Treffern. Nutze die Suche zum Eingrenzen.</div>`
    : '';

  container.innerHTML = limitHint + renderedProducts.map((prod) => {
    const action = computeMhdAction(prod);
    return `
    <div class="mhd-card status-${prod.status || 'ok'} ${prod.soldOut ? 'sold-out' : ''}" id="mhd-card-${prod.id}">
      <div class="mhd-action-badge" style="color:${action.color};background:${action.bg};border:2px solid ${action.color};box-shadow:0 0 14px ${action.bg};font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;margin-bottom:4px;letter-spacing:0.3px;">
        ${action.label}
      </div>
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">${prod.name}</span>
          <span class="mhd-product-meta">${prod.brand ? prod.brand + ' · ' : ''}${prod.mhdText || ''}</span>
        </div>
        <div class="mhd-badge" style="color:${action.color};background:${action.bg};">${prod.tage ?? '–'} Tage</div>
      </div>
      <div class="mhd-controls-row">
        <div class="qty-stepper">
          <button class="btn-stepper" onclick="adjustQty('${prod.id}', -1)">−</button>
          <div class="qty-value-container">
            <span id="qty-val-${prod.id}">${prod.qty ?? 0}</span>
          </div>
          <button class="btn-stepper" onclick="adjustQty('${prod.id}', 1)">+</button>
        </div>
        <button class="btn btn-soldout" onclick="setSoldOut('${prod.id}')">
          🗑️ Ausverkauft
        </button>
      </div>
    </div>
  `;
  }).join('');
}

window.adjustQty = async function(id, change) {
  const prod = AppState.mhdProducts.find(p => p.id === id);
  if (!prod || prod.soldOut) return;

  const newQty = Math.max(0, (prod.qty ?? 0) + change);
  playClickSound(change > 0 ? 1400 : 1100, 0.03, 0.12);

  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] adjustQty(): Keine Cloud-Verbindung – Update abgebrochen.');
    return;
  }

  try {
    await mhdDocRef(id).update({ qty: newQty });
  } catch (err) {
    console.error('[CharcuLogic Firebase] adjustQty() Update fehlgeschlagen:', err);
  }
};

window.setSoldOut = async function(id) {
  const prod = AppState.mhdProducts.find(p => p.id === id);
  if (!prod) return;

  const newSoldOut = !prod.soldOut;
  playClickSound(400, 0.08, 0.2);

  if (!firebaseReady || !db) {
    console.error('[CharcuLogic Firebase] setSoldOut(): Keine Cloud-Verbindung – Update abgebrochen.');
    return;
  }

  try {
    await mhdDocRef(id).update({
      soldOut: newSoldOut,
      qty: newSoldOut ? 0 : (prod.qty ?? 0)
    });
  } catch (err) {
    console.error('[CharcuLogic Firebase] setSoldOut() Update fehlgeschlagen:', err);
  }
};

// "Änderungen speichern" Button
const btnSaveMhd = document.getElementById('btn-save-mhd');
if (btnSaveMhd) {
  btnSaveMhd.addEventListener('click', () => {
    playClickSound(900, 0.1, 0.2);
    if (firebaseReady) {
      showHUD("☁️ Cloud-Sync aktiv", "MHD-Bestände werden live in Firestore gespeichert.");
    } else {
      showHUD("⚠️ Offline", "Firebase nicht konfiguriert – keine Cloud-Synchronisation.", "⚠️");
    }
  });
}

// --- BARCODE-SCANNER (Kamera + Lernmodus) ---
const scannerOverlay = document.getElementById('scanner-overlay');
const previewVideo = document.getElementById('preview-video');
const html5Reader = document.getElementById('html5-reader');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseScanner = document.getElementById('close-scanner-btn');
const btnReceivingScan = document.getElementById('btn-receiving-scan');
const RECEIVING_CATEGORIES = [
  { value: '📦 Trockenware', label: '📦 Trockenware' },
  { value: '🍎 Frische', label: '🍎 Frische' },
  { value: '🥛MoPro', label: '🥛 MoPro' },
  { value: '❄️Kühlware', label: '❄️ Kühlware' },
  { value: '🧊 TK', label: '🧊 TK' },
];
const VPE_MASTER_STORAGE_KEY = 'charculogic.vpeMaster.v1';
const PRODUCT_MASTER_STORAGE_KEY = 'charculogic.productMaster.v1';
const VPE_MASTER_CSV_URL = 'vpe-master.csv';

let activeCameraStream = null;
let scanSimulationTimeout = null;
let scanAnimationFrame = null;
let barcodeDetector = null;
let html5QrCode = null;
let scannerRunning = false;
let learnModeOverlay = null;
let currentBarcode = '';
let activeScan = null;
let selectedProduct = null;
let csvVpeMaster = {};

function updateScannerButtonVisibility() {
  if (!btnOpenScanner) return;
  btnOpenScanner.classList.toggle('hidden', AppState.activeTab !== 'receiving');
}

function renderReceivingStatus({ lastScan = null, status = 'Bereit' } = {}) {
  const vpeCountEl = document.getElementById('receiving-vpe-count');
  const lastScanEl = document.getElementById('receiving-last-scan');
  const statusEl = document.getElementById('receiving-status');
  if (vpeCountEl) vpeCountEl.textContent = String(Object.keys(csvVpeMaster).length || '-');
  if (lastScanEl && lastScan) lastScanEl.textContent = lastScan;
  if (statusEl) statusEl.textContent = status;
}

async function openScanner() {
  if (!scannerOverlay || !previewVideo) return;
  resetScanState({ keepLearnOverlay: false });

  if (typeof Html5Qrcode !== 'undefined' && html5Reader) {
    scannerOverlay.style.display = 'block';
    previewVideo.style.display = 'none';
    html5Reader.style.display = 'block';
    playClickSound(1200, 0.05, 0.15);
    startHtml5QrScanner();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showHUD("📷 Keine Kamera", "getUserMedia wird in diesem Browser nicht unterstützt.", "⚠️");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    activeCameraStream = stream;
    previewVideo.srcObject = stream;
    await previewVideo.play();
    scannerOverlay.style.display = 'block';

    playClickSound(1200, 0.05, 0.15);
    startBarcodeDetection();

    // Nach 3 Sekunden simulierten Scan auslösen (unbekannter Barcode → Lernmodus)
    if (scanSimulationTimeout) clearTimeout(scanSimulationTimeout);
    scanSimulationTimeout = setTimeout(() => {
      renderReceivingStatus({ status: 'Kein Barcode erkannt' });
    }, 10000);
  } catch (err) {
    console.warn('Kamera-Zugriff fehlgeschlagen:', err);
    showHUD("📷 Kamera blockiert", "Bitte Kamera-Zugriff erlauben oder HTTPS nutzen.", "⚠️");
  }
}

function closeScanner({ preserveScanState = false } = {}) {
  scannerRunning = false;

  if (scanSimulationTimeout) {
    clearTimeout(scanSimulationTimeout);
    scanSimulationTimeout = null;
  }

  if (scanAnimationFrame) {
    cancelAnimationFrame(scanAnimationFrame);
    scanAnimationFrame = null;
  }

  if (html5QrCode) {
    const scanner = html5QrCode;
    html5QrCode = null;
    scanner.stop()
      .then(() => scanner.clear())
      .catch((err) => console.warn('[CharcuLogic Scanner] html5-qrcode konnte nicht gestoppt werden:', err));
  }

  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
    activeCameraStream = null;
  }

  if (previewVideo) {
    previewVideo.srcObject = null;
    previewVideo.style.display = 'block';
  }

  if (html5Reader) {
    html5Reader.style.display = 'none';
    html5Reader.innerHTML = '';
  }

  if (scannerOverlay) {
    scannerOverlay.style.display = 'none';
  }

  if (!preserveScanState && !learnModeOverlay) {
    resetScanState({ keepLearnOverlay: true });
  }

  playClickSound(700, 0.04, 0.12);
}

async function startHtml5QrScanner() {
  if (!html5Reader || typeof Html5Qrcode === 'undefined') return;

  scannerRunning = true;
  renderReceivingStatus({ status: 'Scanner aktiv' });
  html5QrCode = new Html5Qrcode('html5-reader', {
    formatsToSupport: [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
    ],
    useBarCodeDetectorIfSupported: false,
    verbose: false,
  });

  try {
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        rememberLastUsedCamera: true,
        videoConstraints: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          facingMode: 'environment'
        },
      },
      (decodedText) => onScanSuccess(decodedText),
      () => {}
    );
  } catch (err) {
    console.warn('[CharcuLogic Scanner] html5-qrcode Start fehlgeschlagen:', err);
    showHUD("Scanner nicht verfügbar", "Der Kamera-Scanner konnte nicht gestartet werden.", "!");
    renderReceivingStatus({ status: 'Scanner nicht verfügbar' });
    closeScanner();
  }
}

async function ensureBarcodeDetector() {
  if (barcodeDetector) return barcodeDetector;
  if (!('BarcodeDetector' in window)) return null;

  try {
    barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf']
    });
  } catch (err) {
    barcodeDetector = new BarcodeDetector();
  }
  return barcodeDetector;
}

async function startBarcodeDetection() {
  const detector = await ensureBarcodeDetector();
  if (!detector) {
    showHUD("Scanner nicht verfügbar", "Dieser Browser kann Barcodes mit der Kamera nicht direkt lesen.", "!");
    renderReceivingStatus({ status: 'Scanner nicht verfügbar' });
    return;
  }

  scannerRunning = true;
  renderReceivingStatus({ status: 'Scanner aktiv' });

  const scanFrame = async () => {
    if (!scannerRunning) return;

    if (!previewVideo || previewVideo.readyState < 2) {
      scanAnimationFrame = requestAnimationFrame(scanFrame);
      return;
    }

    try {
      const barcodes = await detector.detect(previewVideo);
      const value = cleanScannedBarcode(barcodes?.[0]?.rawValue);
      if (value) {
        onScanSuccess(value);
        return;
      }
    } catch (err) {
      console.warn('[CharcuLogic Scanner] Barcode-Erkennung fehlgeschlagen:', err);
    }

    if (scannerRunning) scanAnimationFrame = requestAnimationFrame(scanFrame);
  };

  scanAnimationFrame = requestAnimationFrame(scanFrame);
}

function cleanScannedBarcode(rawCode) {
  return String(rawCode || '').trim().replace(/[^0-9]/g, '');
}

function resetScanState({ keepLearnOverlay = false } = {}) {
  currentBarcode = '';
  activeScan = null;
  selectedProduct = null;

  if (!keepLearnOverlay && learnModeOverlay) {
    learnModeOverlay.remove();
    learnModeOverlay = null;
  }
}

function readLocalMaster(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') || {};
  } catch (err) {
    console.warn('[CharcuLogic Scanner] Lokale Stammdaten konnten nicht gelesen werden:', err);
    return {};
  }
}

function writeLocalMaster(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value || {}));
  } catch (err) {
    console.warn('[CharcuLogic Scanner] Lokale Stammdaten konnten nicht gespeichert werden:', err);
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== '')) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '');
}

function parseVpeSize(value) {
  const parsed = parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function mapVpeCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return {};

  const headers = rows[0].map(normalizeCsvHeader);
  const indexes = {
    gebinde: headers.findIndex((header) => header === 'gebindeean' || header === 'gebinde'),
    einzel: headers.findIndex((header) => header === 'einzelean' || header === 'einzel'),
    name: headers.findIndex((header) => header === 'produktname' || header === 'produkt'),
    size: headers.findIndex((header) => header === 'vpe' || header === 'vpeinhalt'),
    brand: headers.findIndex((header) => header === 'hersteller' || header === 'marke'),
  };

  return rows.slice(1).reduce((master, row) => {
    const barcode = cleanScannedBarcode(row[indexes.gebinde]);
    if (!barcode) return master;

    master[barcode] = {
      barcode,
      einzelBarcode: cleanScannedBarcode(row[indexes.einzel]),
      name: String(row[indexes.name] || '').trim(),
      brand: String(row[indexes.brand] || '').trim(),
      packageSize: parseVpeSize(row[indexes.size]),
      category: '📦 Trockenware',
      isVpe: true,
      source: 'csv-vpe-stammdaten',
    };
    return master;
  }, {});
}

async function loadVpeMasterFromCsv() {
  try {
    const response = await fetch(VPE_MASTER_CSV_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    csvVpeMaster = mapVpeCsv(await response.text());
    console.info(`[CharcuLogic Scanner] ${Object.keys(csvVpeMaster).length} VPE-Barcodes aus CSV geladen.`);
    renderReceivingStatus({ status: 'VPE-Stamm geladen' });
  } catch (err) {
    csvVpeMaster = {};
    console.warn('[CharcuLogic Scanner] VPE-CSV konnte nicht geladen werden:', err);
    renderReceivingStatus({ status: 'VPE-Stamm fehlt' });
  }
}

function saveProductMaster(product) {
  const barcode = cleanScannedBarcode(product.barcode || product.ean);
  if (!barcode || !product.name) return;
  const productMaster = readLocalMaster(PRODUCT_MASTER_STORAGE_KEY);
  productMaster[barcode] = {
    barcode,
    name: product.name,
    brand: product.brand || '',
    category: product.kategorie || product.category || '📦 Trockenware',
  };
  if (product.scanBarcode && cleanScannedBarcode(product.scanBarcode) !== barcode) {
    productMaster[cleanScannedBarcode(product.scanBarcode)] = {
      ...productMaster[barcode],
      barcode: cleanScannedBarcode(product.scanBarcode),
      einzelBarcode: barcode,
    };
  }
  writeLocalMaster(PRODUCT_MASTER_STORAGE_KEY, productMaster);
}

function saveVpeMaster(vpe) {
  const barcode = cleanScannedBarcode(vpe.barcode);
  const packageSize = Number(vpe.packageSize);
  if (!barcode || !vpe.name || !Number.isFinite(packageSize) || packageSize <= 1) return;
  const vpeMaster = readLocalMaster(VPE_MASTER_STORAGE_KEY);
  vpeMaster[barcode] = {
    barcode,
    name: vpe.name,
    brand: vpe.brand || '',
    category: vpe.category || '📦 Trockenware',
    packageSize,
  };
  writeLocalMaster(VPE_MASTER_STORAGE_KEY, vpeMaster);
}

function lookupScannedProduct(scannedCode) {
  const vpeMaster = readLocalMaster(VPE_MASTER_STORAGE_KEY);
  if (vpeMaster[scannedCode]) {
    const existingProduct = AppState.mhdProducts.find(p => cleanScannedBarcode(p.ean || p.barcode || p.id) === scannedCode);
    return { ...vpeMaster[scannedCode], barcode: scannedCode, existingProduct, isVpe: true, source: 'vpe-stammdaten' };
  }

  if (csvVpeMaster[scannedCode]) {
    const csvVpe = csvVpeMaster[scannedCode];
    const existingProduct = AppState.mhdProducts.find((product) => {
      const productBarcode = cleanScannedBarcode(product.ean || product.barcode || product.id);
      return productBarcode === cleanScannedBarcode(csvVpe.einzelBarcode) || productBarcode === scannedCode;
    });
    return { ...csvVpe, existingProduct };
  }

  const csvProduct = Object.values(csvVpeMaster).find((entry) =>
    cleanScannedBarcode(entry.einzelBarcode) === scannedCode
  );
  if (csvProduct) {
    const existingProduct = AppState.mhdProducts.find((product) => {
      const productBarcode = cleanScannedBarcode(product.ean || product.barcode || product.id);
      return productBarcode === scannedCode || productBarcode === cleanScannedBarcode(csvProduct.barcode);
    });
    return {
      barcode: scannedCode,
      name: csvProduct.name,
      brand: csvProduct.brand,
      category: csvProduct.category || '📦 Trockenware',
      existingProduct,
      source: 'csv-produkt-stammdaten',
    };
  }

  const existing = AppState.mhdProducts.find(p => cleanScannedBarcode(p.ean || p.barcode || p.id) === scannedCode);
  if (existing) {
    return {
      barcode: scannedCode,
      name: existing.name || existing.produkt || '',
      brand: existing.brand || existing.marke || '',
      category: normalizeMhdCategory(existing.kategorie || existing.category || ''),
      existingProduct: existing,
      source: 'bestand',
    };
  }

  const productMaster = readLocalMaster(PRODUCT_MASTER_STORAGE_KEY);
  if (productMaster[scannedCode]) {
    return { ...productMaster[scannedCode], barcode: scannedCode, source: 'lokale-stammdaten' };
  }

  return null;
}

function buildCategoryOptions(selectedCategory) {
  const normalized = normalizeMhdCategory(selectedCategory || '📦 Trockenware');
  return RECEIVING_CATEGORIES.map((category) => {
    const selected = normalizeMhdCategory(category.value) === normalized ? ' selected' : '';
    return `<option value="${escapeHtml(category.value)}"${selected}>${escapeHtml(category.label)}</option>`;
  }).join('');
}

function onScanSuccess(decodedText) {
  if (!scannerRunning) return;

  const scannedCode = cleanScannedBarcode(decodedText);
  if (!scannedCode) return;
  if (scannedCode === '40999999') {
    console.warn('[CharcuLogic Scanner] Alter Test-Barcode wurde ignoriert.');
    renderReceivingStatus({ status: 'Test-Barcode ignoriert' });
    return;
  }

  scannerRunning = false;

  resetScanState({ keepLearnOverlay: false });
  currentBarcode = scannedCode;
  activeScan = {
    barcode: scannedCode,
    scannedAt: Date.now(),
    handled: false
  };

  closeScanner({ preserveScanState: true });
  handleScannedEan(scannedCode);
}

async function postNewArticleToAppsScript(article) {
  if (!appsScriptWebAppUrl) return;

  const payload = {
    action: 'save',
    barcode: article.ean,
    scanBarcode: article.scanBarcode || article.ean,
    manualName: article.name,
    name: article.name,
    produkt: article.name,
    marke: article.brand,
    menge: article.qty,
    mhd: article.mhdDate,
    kategorie: article.kategorie,
    vpeBarcode: article.vpeBarcode || '',
    vpeInhalt: article.vpeInhalt || '',
    tenantId: currentTenantId
  };

  await fetch(appsScriptWebAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
}

async function handleScannedEan(ean) {
  const scannedCode = cleanScannedBarcode(ean);
  if (!scannedCode) return;

  if (!activeScan || activeScan.barcode !== scannedCode) {
    resetScanState({ keepLearnOverlay: false });
    currentBarcode = scannedCode;
    activeScan = {
      barcode: scannedCode,
      scannedAt: Date.now(),
      handled: false
    };
  }

  const existing = null;
  selectedProduct = lookupScannedProduct(scannedCode);
  renderReceivingStatus({
    lastScan: scannedCode,
    status: selectedProduct?.name ? 'Produkt erkannt' : 'Unbekanntes Produkt'
  });

  if (existing) {
    selectedProduct = existing;
    const newQty = existing.soldOut ? 1 : (existing.qty ?? 0) + 1;
    const updates = { qty: newQty, soldOut: false };

    if (!firebaseReady || !db) {
      console.error('[CharcuLogic Firebase] handleScannedEan(): Keine Cloud-Verbindung – Scan nicht gespeichert.');
      resetScanState({ keepLearnOverlay: false });
      return;
    }

    try {
      await mhdDocRef(existing.id).update(updates);
      activeScan.handled = true;
      playClickSound(1400, 0.06, 0.18);
      showHUD("➕ Bestand erhöht", `${existing.name} – Menge: ${newQty}`);
    } catch (err) {
      console.error('[CharcuLogic Firebase] handleScannedEan() Update fehlgeschlagen:', err);
    }
    resetScanState({ keepLearnOverlay: false });
    return;
  }

  showLearnModeDialog(scannedCode);
}

function showLegacyLearnModeDialog(ean) {
  if (learnModeOverlay) learnModeOverlay.remove();

  learnModeOverlay = document.createElement('div');
  learnModeOverlay.className = 'learn-mode-overlay';
  learnModeOverlay.innerHTML = `
    <div class="learn-mode-card" role="dialog" aria-modal="true" aria-labelledby="learn-mode-title">
      <div class="learn-mode-title" id="learn-mode-title">📦 Neuer Artikel erkannt!</div>
      <p class="learn-mode-desc">Der Barcode <strong>${ean}</strong> ist unbekannt. Bitte einmalig benennen:</p>
      <label class="learn-mode-label">
        Produktname
        <input type="text" id="learn-product-name" class="input-text-touch" placeholder="z.B. Gallo-Rizo-Patties">
      </label>
      <label class="learn-mode-label">
        Marke / Erzeuger
        <input type="text" id="learn-product-brand" class="input-text-touch" placeholder="z.B. StevesHof">
      </label>
      <div class="learn-mode-actions">
        <button type="button" class="btn btn-learn-submit" id="btn-learn-save">Artikel lernen &amp; einbuchen</button>
      </div>
    </div>
  `;

  document.querySelector('.app-container').appendChild(learnModeOverlay);

  const descEl = learnModeOverlay.querySelector('.learn-mode-desc');
  if (descEl) {
    descEl.innerHTML = `Barcode <strong>${escapeHtml(currentBarcode)}</strong>${isKnownVpe ? ` - VPE-Inhalt: ${defaultQty} Stück` : ''}`;
  }

  const inputName = document.getElementById('learn-product-name');
  const inputBrand = document.getElementById('learn-product-brand');
  const btnLearnSave = document.getElementById('btn-learn-save');

  setTimeout(() => inputName?.focus(), 100);

  btnLearnSave?.addEventListener('click', async () => {
    const name = inputName?.value.trim();
    const brand = inputBrand?.value.trim() || 'StevesHof';

    if (!name) {
      inputName?.focus();
      showHUD("⚠️ Name fehlt", "Bitte einen Produktnamen eingeben.", "⚠️");
      return;
    }

    if (!firebaseReady || !db) {
      console.error('[CharcuLogic Firebase] Lernmodus: Keine Cloud-Verbindung – Artikel nicht gespeichert.');
      showHUD("⚠️ Offline", "Firebase nicht konfiguriert – Artikel konnte nicht gespeichert werden.", "⚠️");
      return;
    }

    const newProduct = {
      ean,
      name,
      brand,
      mhdText: 'Neu eingelernt – MHD prüfen',
      date: new Date().toLocaleDateString('de-DE'),
      status: 'ok',
      qty: 1,
      soldOut: false,
      tenantId: currentTenantId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection(mhdCollectionPath()).add(newProduct);
      learnModeOverlay?.remove();
      learnModeOverlay = null;
      playClickSound(1300, 0.08, 0.2);
      showHUD("✅ Artikel gelernt", `${name} wurde in Firestore verbucht.`);
    } catch (err) {
      console.error('[CharcuLogic Firebase] Lernmodus add() fehlgeschlagen:', err);
      showHUD("⚠️ Fehler", "Artikel konnte nicht in der Cloud gespeichert werden.", "⚠️");
    }
  });
}

function showLearnModeDialog(ean) {
  if (learnModeOverlay) learnModeOverlay.remove();

  currentBarcode = cleanScannedBarcode(ean);
  activeScan = {
    barcode: currentBarcode,
    scannedAt: Date.now(),
    handled: false
  };

  const today = new Date().toISOString().slice(0, 10);
  const productInfo = selectedProduct || null;
  const isKnown = Boolean(productInfo?.name);
  const isKnownVpe = Boolean(productInfo?.isVpe);
  const defaultQty = Math.max(1, Number(productInfo?.packageSize || 1));
  const defaultCategory = productInfo?.category || productInfo?.kategorie || '📦 Trockenware';

  learnModeOverlay = document.createElement('div');
  learnModeOverlay.className = 'learn-mode-overlay';
  learnModeOverlay.innerHTML = `
    <div class="learn-mode-card" role="dialog" aria-modal="true" aria-labelledby="learn-mode-title">
      <div class="learn-mode-title" id="learn-mode-title">${isKnownVpe ? 'VPE erkannt' : isKnown ? 'Produkt erkannt' : 'Unbekanntes Produkt'}</div>
      <p class="learn-mode-desc">Der Barcode <strong>${escapeHtml(currentBarcode)}</strong> ist unbekannt. Bitte vollständig erfassen:</p>
      <label class="learn-mode-label">
        Produktname
        <input type="text" id="learn-product-name" class="input-text-touch" placeholder="z.B. Schwarzkümmel">
      </label>
      <label class="learn-mode-label">
        Hersteller / Marke
        <input type="text" id="learn-product-brand" class="input-text-touch" placeholder="z.B. StevesHof">
      </label>
      <label class="learn-mode-label">
        Menge / Bestand
        <input type="number" id="learn-product-qty" class="input-text-touch" min="0" step="1" value="1">
      </label>
      <label class="learn-mode-label">
        MHD-Datum
        <input type="date" id="learn-product-mhd" class="input-text-touch" value="${today}">
      </label>
      <label class="learn-mode-label">
        Kategorie
        <select id="learn-product-category" class="input-text-touch">
          <option value="🥛MoPro">Frische &amp; MoPro</option>
          <option value="🥗 Kühlware">Kühlware</option>
          <option value="📦 Trockenware">Trockenware</option>
        </select>
      </label>
      <div class="learn-mode-actions">
        <button type="button" class="btn btn-learn-submit" id="btn-learn-save">Artikel speichern</button>
        <button type="button" class="btn" id="btn-learn-cancel" style="width:100%;min-height:52px;margin-top:8px;background:#E5E5EA;color:#1C1C1E;">Schließen</button>
      </div>
    </div>
  `;

  document.querySelector('.app-container').appendChild(learnModeOverlay);

  const inputName = document.getElementById('learn-product-name');
  const inputBrand = document.getElementById('learn-product-brand');
  const inputQty = document.getElementById('learn-product-qty');
  const inputMhd = document.getElementById('learn-product-mhd');
  const inputCategory = document.getElementById('learn-product-category');
  const btnLearnSave = document.getElementById('btn-learn-save');
  const btnLearnCancel = document.getElementById('btn-learn-cancel');

  if (btnLearnSave) btnLearnSave.textContent = 'Wareneingang speichern';
  if (inputName) inputName.value = productInfo?.name || '';
  if (inputBrand) inputBrand.value = productInfo?.brand || '';
  if (inputQty) {
    inputQty.min = '1';
    inputQty.step = '0.1';
    inputQty.value = String(defaultQty);
  }
  if (inputCategory) inputCategory.innerHTML = buildCategoryOptions(defaultCategory);

  const actionsEl = learnModeOverlay.querySelector('.learn-mode-actions');
  const vpeLabel = document.createElement('label');
  vpeLabel.className = 'learn-mode-label learn-vpe-row';
  vpeLabel.innerHTML = `
    <span>
      <input type="checkbox" id="learn-product-is-vpe" ${isKnownVpe ? 'checked' : ''}>
      Dieser Barcode ist eine VPE
    </span>
    <input type="number" id="learn-product-vpe-size" class="input-text-touch" min="2" step="0.1" value="${isKnownVpe ? defaultQty : 6}">
  `;
  actionsEl?.before(vpeLabel);

  const inputIsVpe = document.getElementById('learn-product-is-vpe');
  const inputVpeSize = document.getElementById('learn-product-vpe-size');

  setTimeout(() => inputName?.focus(), 100);

  inputIsVpe?.addEventListener('change', () => {
    const size = Math.max(2, parseInt(inputVpeSize?.value || '6', 10) || 6);
    if (inputIsVpe.checked && inputQty) inputQty.value = String(size);
  });

  inputVpeSize?.addEventListener('input', () => {
    if (!inputIsVpe?.checked || !inputQty) return;
    const size = Math.max(2, parseInt(inputVpeSize.value || '6', 10) || 6);
    inputQty.value = String(size);
  });

  btnLearnCancel?.addEventListener('click', () => {
    resetScanState({ keepLearnOverlay: false });
    playClickSound(700, 0.04, 0.12);
  });

  btnLearnSave?.addEventListener('click', async () => {
    const name = inputName?.value.trim();
    const brand = inputBrand?.value.trim() || '';
    const qty = Math.max(1, parseFloat(String(inputQty?.value || '1').replace(',', '.')) || 1);
    const mhdDate = inputMhd?.value || today;
    const kategorie = normalizeMhdCategory(inputCategory?.value || '📦 Trockenware');
    const barcodeForSave = currentBarcode || cleanScannedBarcode(ean);
    const isVpe = Boolean(inputIsVpe?.checked);
    const vpeSize = Math.max(2, parseFloat(String(inputVpeSize?.value || '6').replace(',', '.')) || 6);
    const inventoryBarcode = cleanScannedBarcode(productInfo?.einzelBarcode) || barcodeForSave;

    if (!name) {
      inputName?.focus();
      showHUD("Name fehlt", "Bitte einen Produktnamen eingeben.", "!");
      return;
    }

    if (!barcodeForSave) {
      showHUD("Barcode fehlt", "Bitte den Artikel erneut scannen.", "!");
      resetScanState({ keepLearnOverlay: false });
      return;
    }

    const mhdTime = new Date(`${mhdDate}T00:00:00`);
    const todayTime = new Date();
    todayTime.setHours(0, 0, 0, 0);
    const tage = Number.isNaN(mhdTime.getTime())
      ? null
      : Math.ceil((mhdTime.getTime() - todayTime.getTime()) / 86400000);

    const existingQty = Number(productInfo?.existingProduct?.qty ?? productInfo?.existingProduct?.menge ?? 0);
    const totalQty = existingQty + qty;
    const newProduct = {
      id: inventoryBarcode,
      ean: inventoryBarcode,
      barcode: inventoryBarcode,
      scanBarcode: barcodeForSave,
      produkt: name,
      name,
      marke: brand,
      brand,
      mhd: mhdDate,
      mhdDate,
      mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Neu eingelernt - MHD prüfen',
      date: mhdDate ? new Date(`${mhdDate}T00:00:00`).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE'),
      tage,
      status: 'aktiv',
      qty: totalQty,
      menge: totalQty,
      eingangMenge: qty,
      kategorie,
      soldOut: false,
      vpeBarcode: isVpe ? barcodeForSave : '',
      vpeInhalt: isVpe ? vpeSize : '',
      tenantId: currentTenantId,
      createdAt: firebaseReady && typeof firebase !== 'undefined' && firebase.firestore
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString()
    };

    try {
      await postNewArticleToAppsScript({ ...newProduct, qty });
      if (firebaseReady && db) {
        await db.collection(mhdCollectionPath()).doc(inventoryBarcode).set(newProduct, { merge: true });
      }
      saveProductMaster(newProduct);
      if (isVpe) {
        saveVpeMaster({
          barcode: barcodeForSave,
          name,
          brand,
          category: kategorie,
          packageSize: vpeSize,
        });
      }
      activeScan = activeScan ? { ...activeScan, handled: true } : null;
      playClickSound(1300, 0.08, 0.2);
      showHUD("Wareneingang gespeichert", `${qty} Stück ${name} wurden erfasst.`);
      renderReceivingStatus({ lastScan: barcodeForSave, status: 'Gespeichert' });
      resetScanState({ keepLearnOverlay: false });
    } catch (err) {
      console.error('[CharcuLogic Firebase] Lernmodus speichern fehlgeschlagen:', err);
      showHUD("Fehler", "Artikel konnte nicht gespeichert werden.", "!");
      resetScanState({ keepLearnOverlay: false });
    }
  });
}

if (btnOpenScanner) {
  btnOpenScanner.addEventListener('click', () => openScanner());
}

if (btnReceivingScan) {
  btnReceivingScan.addEventListener('click', () => openScanner());
}

if (btnCloseScanner) {
  btnCloseScanner.addEventListener('click', () => closeScanner());
}

updateScannerButtonVisibility();

// --- SCREEN 2: WURSTKÜCHE LOGIC ---
function setRecipeDetailText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function populateRecipeDetailView(recipe) {
  if (!recipe) return;

  setRecipeDetailText('detail-recipe-title', recipe.name);
  setRecipeDetailText('detail-recipe-warning', recipe.hinweis);
  setRecipeDetailText('recipe-phase-a-text', recipe.anweisung_A);
  setRecipeDetailText('recipe-phase-b-text', recipe.anweisung_B);
  setRecipeDetailText('recipe-phase-c-text', recipe.anweisung_C);
  setRecipeDetailText('recipe-phase-d-text', recipe.anweisung_D);
  setRecipeDetailText('recipe-meister-tipp-text', recipe.tipp);
  setRecipeDetailText('recipe-haltbarkeit-text', recipe.haltbar);

  const tippRow = document.getElementById('recipe-meister-tipp');
  if (tippRow) tippRow.hidden = !recipe.tipp;

  const haltbarRow = document.getElementById('recipe-haltbarkeit');
  if (haltbarRow) haltbarRow.hidden = !recipe.haltbar;
}

function recipeCategoryOf(recipe) {
  return recipe?.kat || recipe?.Kategorie || 'Ohne Kategorie';
}

function recipeSearchText(recipe) {
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map((ing) => ingredientNameOf(ing)).join(' ')
    : '';
  return `${recipe?.name || ''} ${recipe?.id || ''} ${recipeCategoryOf(recipe)} ${ingredients}`.toLowerCase();
}

function renderRecipeCategoryFilters(recipes) {
  const filter = document.getElementById('recipe-category-filter');
  if (!filter) return;

  const categories = Array.from(new Set(recipes.map(recipeCategoryOf))).sort((a, b) => a.localeCompare(b, 'de'));
  const buttons = [
    { id: 'all', label: `Alle (${recipes.length})` },
    ...categories.map((category) => ({
      id: category,
      label: `${category} (${recipes.filter((recipe) => recipeCategoryOf(recipe) === category).length})`,
    })),
  ];

  filter.innerHTML = buttons.map((button) => `
    <button type="button" class="recipe-category-chip ${AppState.recipeCategoryFilter === button.id ? 'active-category' : ''}" data-category="${button.id}">
      ${button.label}
    </button>
  `).join('');
}

function filteredRecipesForKitchen(recipes) {
  const query = AppState.recipeSearchQuery.trim().toLowerCase();
  const category = AppState.recipeCategoryFilter;
  return recipes.filter((recipe) => {
    const categoryMatches = category === 'all' || recipeCategoryOf(recipe) === category;
    const queryMatches = !query || recipeSearchText(recipe).includes(query);
    return categoryMatches && queryMatches;
  });
}

function initRecipeSearchAndFilters() {
  const searchInput = document.getElementById('recipe-search-input');
  const categoryFilter = document.getElementById('recipe-category-filter');

  if (searchInput && searchInput.dataset.eventsBound !== '1') {
    searchInput.dataset.eventsBound = '1';
    searchInput.addEventListener('input', (event) => {
      AppState.recipeSearchQuery = event.target.value || '';
      renderRecipes();
    });
  }

  if (categoryFilter && categoryFilter.dataset.eventsBound !== '1') {
    categoryFilter.dataset.eventsBound = '1';
    categoryFilter.addEventListener('click', (event) => {
      const button = event.target.closest('.recipe-category-chip');
      if (!button) return;
      AppState.recipeCategoryFilter = button.dataset.category || 'all';
      renderRecipes();
    });
  }
}

function renderRecipes() {
  const container = document.getElementById('recipe-list-container');
  if (!container) return;

  const recipes = recipesForKitchenList();
  const searchInput = document.getElementById('recipe-search-input');
  if (searchInput && searchInput.value !== AppState.recipeSearchQuery) {
    searchInput.value = AppState.recipeSearchQuery;
  }
  renderRecipeCategoryFilters(recipes);
  const visibleRecipes = filteredRecipesForKitchen(recipes);

  if (!recipes.length) {
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        ${firebaseReady ? 'Keine Rezepte in der Cloud. Seed l?uft?' : 'Firebase nicht konfiguriert - Rezepte k?nnen nicht geladen werden.'}
      </div>`;
    return;
  }

  if (!visibleRecipes.length) {
    container.innerHTML = `
      <div class="recipe-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        Keine Rezepte f?r diese Suche/Kategorie gefunden.
      </div>`;
    return;
  }

  container.innerHTML = visibleRecipes.map(recipe => `
    <div class="recipe-card ${recipeIdsMatch(AppState.selectedRecipeId, recipe.id) ? 'active-recipe' : ''}" onclick="openRecipeDetail('${String(recipe.id).replace(/'/g, "\\'")}')">
      <div class="recipe-meta-group">
        <span class="recipe-title">${recipe.name}</span>
        <span class="recipe-subinfo">${recipeCategoryOf(recipe)} - ${Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0} Zutaten${recipe.kaliber ? ' - ' + recipe.kaliber : ''}</span>
      </div>
      <div class="recipe-arrow">&gt;</div>
    </div>
  `).join('');
}
function resolveActiveRecipeForDetail(recipeId) {
  const resolvedId = String(recipeId);
  let recipe = getRecipeWithLocalFallback(resolvedId);
  if (!recipe) return null;

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    const seedRecipe = bratwurstRecipes.find((entry) => recipeIdsMatch(entry.id, resolvedId));
    if (seedRecipe?.ingredients?.length) {
      recipe = { ...recipe, ingredients: [...seedRecipe.ingredients] };
    }
  }

  return ensureRecipeIngredients(recipe, resolvedId);
}

function closeRecipeDetailPanel() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel) return;
  panel.classList.remove('active');
  panel.style.display = '';
}

function initRecipeDetailPanelEvents() {
  const panel = document.getElementById('recipe-detail-panel');
  if (!panel || panel.dataset.eventsBound === '1') return;
  panel.dataset.eventsBound = '1';

  panel.addEventListener('click', (event) => {
    if (event.target.closest('#btn-recipe-back')) {
      playClickSound(700, 0.05, 0.15);
      closeRecipeDetailPanel();
    }
  });
}

window.openRecipeDetail = function(recipeId) {
  initRecipeDetailPanelEvents();

  AppState.selectedRecipeId = String(recipeId);

  const recipe = resolveActiveRecipeForDetail(AppState.selectedRecipeId);
  if (recipe) {
    AppState.activeRecipeDetail = recipe;
    populateRecipeDetailView(recipe);
    playClickSound(1000, 0.06, 0.15);
  }

  const panel = document.getElementById('recipe-detail-panel');
  if (panel) {
    panel.classList.add('active');
    panel.style.display = 'flex';
  }

  calculateIngredients();
};

initRecipeDetailPanelEvents();

// Zutaten-Berechnung
const inputProdTarget = document.getElementById('production-target');
const btnProdMinus = document.getElementById('btn-prod-minus');
const btnProdPlus = document.getElementById('btn-prod-plus');

function roundToButcherPrecision(gramm) {
  if (!Number.isFinite(gramm)) return 0;
  if (gramm >= 1000) return Math.round(gramm / 50) * 50;
  if (gramm >= 100) return Math.round(gramm / 5) * 5;
  return Math.round(gramm);
}

function formatButcherAmount(gramm) {
  if (!Number.isFinite(gramm)) return '0 g';
  if (gramm >= 1000) {
    const kg = gramm / 1000;
    return Number(kg.toFixed(2)).toString().replace('.', ',') + ' kg';
  }
  return Math.round(gramm).toString() + ' g';
}

function ingredientNameOf(ing) {
  return ing?.name
    || ing?.Name
    || ing?.zutat
    || ing?.Zutat
    || ing?.produkt
    || ing?.Produkt
    || ing?.Producto
    || ing?.ingredient
    || ing?.Ingredient
    || ing?.label
    || ing?.Label
    || 'Unbekannte Zutat';
}

function ingredientPctOf(ing) {
  const raw = ing?.pct
    ?? ing?.Pct
    ?? ing?.Prozent
    ?? ing?.prozent
    ?? ing?.percent
    ?? ing?.Percent
    ?? ing?.Prozentwert
    ?? ing?.anteil
    ?? ing?.Anteil
    ?? ing?.['Anteil %']
    ?? ing?.['Anteil%'];
  if (raw === undefined || raw === null || raw === '') return NaN;
  const normalized = String(raw).replace('%', '').replace(',', '.').trim();
  const pct = parseFloat(normalized);
  return Number.isFinite(pct) ? pct : NaN;
}

function renderableIngredientCount(recipe) {
  const rows = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return rows.filter((ing) => ingredientNameOf(ing) && Number.isFinite(ingredientPctOf(ing))).length;
}

function validateBratwurstMasterlist() {
  const invalidRecipes = bratwurstRecipes
    .map((recipe) => ({
      id: recipe?.id,
      name: recipe?.name,
      ingredientCount: Array.isArray(recipe?.ingredients) ? recipe.ingredients.length : 0,
      renderableCount: renderableIngredientCount(recipe),
    }))
    .filter((recipe) => !recipe.id || !recipe.name || recipe.ingredientCount === 0 || recipe.renderableCount !== recipe.ingredientCount);

  if (invalidRecipes.length) {
    console.error('[CharcuLogic Wurstküche] MASTERLISTE UNVOLLSTÄNDIG:', invalidRecipes);
    return false;
  }

  console.info(`[CharcuLogic Wurstküche] Masterliste vollständig validiert: ${bratwurstRecipes.length} Rezepte mit Zutaten-Arrays.`);
  return true;
}

function validateCloudRecipesAgainstMasterlist(cloudRecipes = AppState.recipes) {
  const missing = [];
  const incomplete = [];
  const cloudCount = Array.isArray(cloudRecipes) ? cloudRecipes.length : 0;

  bratwurstRecipes.forEach((localRecipe) => {
    const cloudRecipe = cloudRecipes.find((entry) =>
      recipeIdsMatch(entry.id, localRecipe.id) || recipeIdsMatch(entry.docId, localRecipe.id) || recipeIdsMatch(entry.firestoreId, localRecipe.id)
    );
    const localCount = renderableIngredientCount(localRecipe);
    const cloudRenderable = renderableIngredientCount(cloudRecipe);

    if (!cloudRecipe) {
      missing.push(localRecipe.id);
    } else if (cloudRenderable < localCount) {
      incomplete.push({
        id: localRecipe.id,
        cloud: cloudRenderable,
        master: localCount,
      });
    }
  });

  const audit = {
    masterCount: bratwurstRecipes.length,
    cloudCount,
    missing,
    incomplete,
    ok: missing.length === 0 && incomplete.length === 0 && cloudCount >= bratwurstRecipes.length,
  };
  AppState.recipeCloudAudit = audit;
  renderRecipeCloudAudit();
  return audit;
}

function renderRecipeCloudAudit() {
  const masterEl = document.getElementById('audit-master-count');
  const cloudEl = document.getElementById('audit-cloud-count');
  const statusEl = document.getElementById('audit-cloud-status');
  const detailEl = document.getElementById('audit-cloud-detail');
  if (!masterEl || !cloudEl || !statusEl || !detailEl) return;

  const audit = AppState.recipeCloudAudit;
  if (!audit) {
    masterEl.textContent = String(bratwurstRecipes.length);
    cloudEl.textContent = '-';
    statusEl.textContent = 'Warte auf Daten';
    detailEl.textContent = 'Die Rezeptdaten werden automatisch geprüft, sobald Firestore antwortet.';
    return;
  }

  masterEl.textContent = String(audit.masterCount);
  cloudEl.textContent = String(audit.cloudCount);
  statusEl.textContent = audit.ok ? 'Vollständig' : 'Prüfen';
  statusEl.style.color = audit.ok ? '#1B5E20' : '#B71C1C';

  if (audit.ok) {
    detailEl.textContent = 'Alle Master-Rezepte sind in der Cloud vorhanden und besitzen vollständige Zutatenlisten.';
    return;
  }

  const missingText = audit.missing.length ? `Fehlt: ${audit.missing.slice(0, 4).join(', ')}${audit.missing.length > 4 ? ' ...' : ''}.` : '';
  const incompleteText = audit.incomplete.length ? `Unvollständig: ${audit.incomplete.map((item) => `${item.id} (${item.cloud}/${item.master})`).slice(0, 3).join(', ')}${audit.incomplete.length > 3 ? ' ...' : ''}.` : '';
  detailEl.textContent = `${missingText} ${incompleteText}`.trim() || 'Cloud-Bestand weicht von der Masterliste ab.';
}

function updateRecipeDataSourceBadge(source) {
  const badge = document.getElementById('recipe-data-source-badge');
  if (!badge) return;

  const isCloud = source === 'cloud';
  badge.textContent = isCloud ? '🟢 Live-Cloud' : '🟡 Lokaler Speicher (Sicherheitsgurt)';
  badge.style.background = isCloud ? '#E8F5E9' : '#FFF8E1';
  badge.style.color = isCloud ? '#1B5E20' : '#8A5A00';
  badge.style.border = isCloud ? '1px solid #A5D6A7' : '1px solid #FFE082';
}

function calculateIngredients() {
  const listContainer = document.getElementById('recipe-ingredients-list');
  if (!listContainer) {
    console.error('Kritisch: #recipe-ingredients-list fehlt im statischen HTML.');
    return;
  }

  if (!AppState.selectedRecipeId) {
    console.error('[CharcuLogic Wurstkueche] calculateIngredients(): Keine selectedRecipeId gesetzt.');
    return;
  }

  const cloudRecipe = AppState.recipes.find(r => recipeIdsMatch(r.id, AppState.selectedRecipeId));
  const localRecipe = bratwurstRecipes.find(r => recipeIdsMatch(r.id, AppState.selectedRecipeId));
  const cloudRenderableCount = renderableIngredientCount(cloudRecipe);
  const localRenderableCount = renderableIngredientCount(localRecipe);
  let activeRecipe = cloudRecipe;
  let dataSource = 'cloud';

  // SKELETT-FALLE KORREKTUR:
  // Wenn Cloud fehlt oder weniger renderbare Zutaten als die Masterliste hat -> lokale Vollversion nutzen.
  if (!activeRecipe || cloudRenderableCount === 0 || localRenderableCount > cloudRenderableCount) {
    console.log(
      'Cloud-Liste ist unvollstaendig oder feldtechnisch nicht renderbar. Nutze lokalen Masterlisten-Zutaten-Fallback fuer ID:',
      AppState.selectedRecipeId,
      { cloudRenderableCount, localRenderableCount }
    );
    activeRecipe = localRecipe;
    dataSource = 'local';
  }

  const ingredients = Array.isArray(activeRecipe?.ingredients) ? activeRecipe.ingredients : [];
  AppState.activeRecipeDetail = activeRecipe || AppState.activeRecipeDetail;
  AppState.activeRecipeDataSource = dataSource;
  updateRecipeDataSourceBadge(dataSource);

  listContainer.innerHTML = '';

  if (!ingredients.length) {
    listContainer.innerHTML = "<div style='color:red; padding:15px; font-weight:bold;'>&#9888;&#65039; Keine Zutaten in den Daten gefunden!</div>";
    return;
  }

  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  let targetKg = parseFloat(rawInput);
  if (!Number.isFinite(targetKg) || targetKg <= 0) {
    targetKg = AppState.productionTargetKg || 10;
  }
  AppState.productionTargetKg = targetKg;

  console.log(`Starte Zutaten-Div-Render mit ${ingredients.length} Zutaten.`);

  ingredients.forEach((ing) => {
    try {
      const zutatName = ingredientNameOf(ing);
      const zutatPct = ingredientPctOf(ing);
      if (!Number.isFinite(zutatPct)) return;

      const amountG = (targetKg * 1000) * (zutatPct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      const amountStr = formatButcherAmount(roundedG);
      const pctText = `${zutatPct.toFixed(2).replace('.', ',')}%`;
      const rowHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 2px solid #eee; background: #fff; font-size: 18px;">
          <div style="font-weight: bold; flex: 2; color: #333;">${zutatName}</div>
          <div style="flex: 1; text-align: center; color: #666;">${pctText}</div>
          <div style="flex: 1; text-align: right; font-weight: 900; color: #2E7D32; font-size: 20px;">${amountStr}</div>
        </div>
      `;

      listContainer.insertAdjacentHTML('beforeend', rowHTML);
    } catch (e) {
      console.error('Fehler bei Zutat:', ing, e);
    }
  });
}

function currentProductionTargetKg() {
  const inputEl = document.getElementById('production-target');
  const rawInput = (inputEl?.value ?? '').toString().replace(',', '.');
  const targetKg = parseFloat(rawInput);
  return Number.isFinite(targetKg) && targetKg > 0 ? targetKg : AppState.productionTargetKg || 10;
}

function scaledIngredientsForRecipe(recipe, targetKg) {
  const ingredients = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  return ingredients
    .map((ing) => {
      const pct = ingredientPctOf(ing);
      if (!Number.isFinite(pct)) return null;
      const amountG = (targetKg * 1000) * (pct / 100);
      const roundedG = roundToButcherPrecision(amountG);
      return {
        name: ingredientNameOf(ing),
        pct,
        amountG: roundedG,
        amountText: formatButcherAmount(roundedG),
        typ: ing.typ || ing.Typ || '',
        allergen: Boolean(ing.allergen || ing.Allergen),
        hinweis: ing.hinweis || ing.Hinweis || '',
      };
    })
    .filter(Boolean);
}

function generateRecipeBatchNumber(recipeId) {
  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const cleanId = String(recipeId || 'REZEPT').replace(/[^A-Za-z0-9]+/g, '').slice(0, 8).toUpperCase() || 'REZEPT';
  const suffix = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  return `CH-${dateStr}-${cleanId}-${suffix}`;
}

function buildLabelBasis(recipe, scaledIngredients, targetKg) {
  const allergene = Array.isArray(recipe?.allergene)
    ? recipe.allergene.filter(Boolean)
    : scaledIngredients.filter((ing) => ing.allergen).map((ing) => ing.name);
  const sortedIngredients = [...scaledIngredients].sort((a, b) => (b.amountG || 0) - (a.amountG || 0));

  return {
    status: 'vorbereitet',
    druckSchnittstelle: 'Ausbaustufe 2',
    etikettenAnzahl: null,
    produktname: recipe?.name || '',
    nettoFuellmengeKg: targetKg,
    zutatenlisteVorbereitet: sortedIngredients.map((ing) => ing.name).join(', '),
    quidBasis: sortedIngredients.map((ing) => ({
      name: ing.name,
      pct: ing.pct,
      amountG: ing.amountG,
    })),
    allergene,
    preisBasis: {
      status: 'offen',
      ziel: 'Preis je Etikett/Packung in Ausbaustufe 2 berechnen',
    },
    barcodeBasis: {
      status: 'offen',
      ziel: 'Barcode-Drucker und Etikettenanzahl in Ausbaustufe 2 anbinden',
    },
  };
}

async function documentRecipeBatch() {
  if (!AppState.selectedRecipeId) {
    showHUD("⚠️ Kein Rezept", "Bitte zuerst ein Rezept öffnen.", "⚠️");
    return;
  }

  const recipe = AppState.activeRecipeDetail || resolveActiveRecipeForDetail(AppState.selectedRecipeId);
  if (!recipe) {
    showHUD("⚠️ Rezept fehlt", "Die Charge konnte keinem Rezept zugeordnet werden.", "⚠️");
    return;
  }

  const maker = document.getElementById('recipe-batch-maker')?.value.trim() || '';
  if (!maker) {
    showHUD("⚠️ Macher fehlt", "Bitte eintragen, wer die Charge hergestellt hat.", "⚠️");
    return;
  }

  if (!firebaseReady || !db) {
    showHUD("⚠️ Offline", "Firebase nicht konfiguriert – Charge nicht gespeichert.", "⚠️");
    return;
  }

  const targetKg = currentProductionTargetKg();
  const scaledIngredients = scaledIngredientsForRecipe(recipe, targetKg);
  const labelBasis = buildLabelBasis(recipe, scaledIngredients, targetKg);
  const phRaw = document.getElementById('recipe-batch-ph')?.value;
  const tempRaw = document.getElementById('recipe-batch-core-temp')?.value;
  const phValue = phRaw ? parseFloat(String(phRaw).replace(',', '.')) : null;
  const coreTempValue = tempRaw ? parseFloat(String(tempRaw).replace(',', '.')) : null;
  const batchNumber = generateRecipeBatchNumber(recipe.id);

  const batchEntry = {
    chargenNummer: batchNumber,
    rezeptId: recipe.id,
    rezeptName: recipe.name,
    kategorie: recipe.kat || '',
    produktionsmengeKg: targetKg,
    macher: maker,
    phWert: Number.isFinite(phValue) ? phValue : null,
    kerntemperatur: Number.isFinite(coreTempValue) ? coreTempValue : null,
    abweichungen: document.getElementById('recipe-batch-deviations')?.value.trim() || '',
    datenquelle: AppState.activeRecipeDataSource,
    zutatenBerechnet: scaledIngredients,
    etikettBasis: labelBasis,
    tenantId: currentTenantId,
    zeitstempel: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
        const collectionPath = productionBatchesCollectionPath();
        if (!collectionPath) {
            showHUD("Mandant fehlt", "Die Charge konnte keinem Betrieb zugeordnet werden.");
            return;
        }

        await db.collection(collectionPath).doc(batchNumber).set(batchEntry);
    showHUD("Charge dokumentiert", `${batchNumber} wurde gespeichert.`);
    AppState.productionBatches = [{ ...batchEntry, id: batchNumber, zeitstempel: new Date() }, ...AppState.productionBatches]
      .filter((batch, index, self) => self.findIndex((entry) => entry.id === batch.id) === index)
      .slice(0, 50);
    renderProductionBatches();
    const deviations = document.getElementById('recipe-batch-deviations');
    if (deviations) deviations.value = '';
  } catch (error) {
    console.error('[CharcuLogic Firebase] Charge speichern fehlgeschlagen:', error);
    showHUD("⚠️ Fehler", "Charge konnte nicht gespeichert werden.", "⚠️");
  }
}

if (inputProdTarget) {
  inputProdTarget.addEventListener('input', (e) => {
    let val = parseFloat(String(e.target.value).replace(',', '.'));
    if (isNaN(val) || val <= 0) val = 0.5;
    AppState.productionTargetKg = val;
    calculateIngredients();
  });
}

if (btnProdMinus) {
  btnProdMinus.addEventListener('click', () => {
    AppState.productionTargetKg = Math.max(0.5, AppState.productionTargetKg - 0.5);
    inputProdTarget.value = AppState.productionTargetKg.toFixed(1);
    playClickSound(1100, 0.03, 0.12);
    inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

if (btnProdPlus) {
  btnProdPlus.addEventListener('click', () => {
    AppState.productionTargetKg = Math.min(500, AppState.productionTargetKg + 0.5);
    inputProdTarget.value = AppState.productionTargetKg.toFixed(1);
    playClickSound(1400, 0.03, 0.12);
    inputProdTarget.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const btnDocumentRecipeBatch = document.getElementById('btn-document-recipe-batch');
if (btnDocumentRecipeBatch) {
  btnDocumentRecipeBatch.addEventListener('click', async () => {
    playClickSound(1150, 0.08, 0.18);
    await documentRecipeBatch();
  });
}

// --- SCREEN 3: HACCP-PROTOKOLL LOGIC ---
const sliderPh = document.getElementById('haccp-ph');
const badgePh = document.getElementById('ph-badge');
const sliderTemp = document.getElementById('haccp-temp');
const badgeTemp = document.getElementById('temp-badge');

const alertBox = document.getElementById('haccp-alert-box');
const alertTitle = document.getElementById('haccp-alert-title');
const alertDesc = document.getElementById('haccp-alert-desc');

function updateHACCPAlerts() {
  const ph = parseFloat(sliderPh.value);
  const temp = parseFloat(sliderTemp.value);
  
  badgePh.textContent = ph.toFixed(2).replace('.', ',');
  badgeTemp.textContent = `${temp.toFixed(1).replace('.', ',')} °C`;
  
  let hasAlert = false;
  let title = "";
  let desc = "";
  let isDanger = false;
  
  // pH Warnschwellen (PSE < 5.30, DFD > 6.20)
  if (ph < 5.30) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (PSE-Fleisch)";
    desc = "PSE-Gefahr! Der pH-Wert ist kritisch sauer. Fleisch verliert extrem viel Saft, wässrige Konsistenz. Ungeeignet für Brühwurst!";
    isDanger = true;
  } else if (ph > 6.20) {
    hasAlert = true;
    title = "🚨 pH-Wert Warnung (DFD-Fleisch)";
    desc = "DFD-Gefahr! Fleisch ist klebrig, dunkel und besitzt verkürzte Haltbarkeit. Erhöhtes Risiko für Keimbildung!";
    isDanger = true;
  } else if (temp > 7.0 && temp < 72.0) {
    // Wenn über Kühltemperatur (7°C) aber noch nicht gekocht (>72°C) - "Gefahrenzone"
    hasAlert = true;
    title = "⚠️ Temperatur Warnung (Warmbereich)";
    desc = "Der Temperaturbereich liegt in der mikrobiellen Vermehrungszone. Kerntemperatur muss zügig gekühlt (<7°C) oder durchgegart (>72°C) werden!";
  }
  
  if (hasAlert) {
    alertBox.classList.add('active');
    alertBox.style.borderColor = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertBox.style.backgroundColor = isDanger ? 'rgba(244, 67, 54, 0.08)' : 'rgba(239, 108, 0, 0.08)';
    alertTitle.textContent = title;
    alertTitle.style.color = isDanger ? 'var(--secondary-color)' : 'var(--warning-color)';
    alertDesc.textContent = desc;
  } else {
    alertBox.classList.remove('active');
  }
}

if (sliderPh) {
  sliderPh.addEventListener('input', () => {
    // Micro-Haptik beim Schieben
    playClickSound(1000 + (parseFloat(sliderPh.value) * 100), 0.015, 0.05);
    updateHACCPAlerts();
  });
}

if (sliderTemp) {
  sliderTemp.addEventListener('input', () => {
    playClickSound(800 + (parseFloat(sliderTemp.value) * 4), 0.015, 0.05);
    updateHACCPAlerts();
  });
}

// Chargen-Generierung
const btnBatchGen = document.getElementById('btn-batch-generate');
const inputBatch = document.getElementById('haccp-batch');

if (btnBatchGen && inputBatch) {
  btnBatchGen.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomChar = chars.charAt(Math.floor(Math.random() * chars.length));
    const now = new Date();
    const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    inputBatch.value = `CH-${dateStr}-${randomChar}`;
    
    playClickSound(1300, 0.04, 0.15);
    showHUD("⚡ Generiert", `Kombination: ${inputBatch.value}`);
  });
}

// HACCP Eintragen
const btnSubmitHaccp = document.getElementById('btn-submit-haccp');
if (btnSubmitHaccp) {
  btnSubmitHaccp.addEventListener('click', async () => {
    playClickSound(1100, 0.12, 0.25);

    if (!firebaseReady || !db) {
      console.error('[CharcuLogic Firebase] HACCP: Firebase nicht initialisiert – Protokoll nicht gespeichert.');
      showHUD("⚠️ Offline", "Firebase nicht konfiguriert – HACCP-Protokoll nicht gespeichert.", "⚠️");
      return;
    }

    const ph = parseFloat(sliderPh.value);
    const temperatur = parseFloat(sliderTemp.value);
    const chargenNummer = inputBatch.value.trim();

    const haccpEntry = {
      ph,
      temperatur,
      chargenNummer,
      zeitstempel: firebase.firestore.FieldValue.serverTimestamp(),
      tenantId: currentTenantId
    };

    try {
      await db.collection(haccpCollectionPath()).add(haccpEntry);
      showHUD("📝 HACCP erfasst", `Charge ${chargenNummer} in Firestore dokumentiert.`);
    } catch (err) {
      console.error('[CharcuLogic Firebase] HACCP Speichern fehlgeschlagen:', err);
      showHUD("⚠️ Fehler", "HACCP-Protokoll konnte nicht gespeichert werden.", "⚠️");
    }
  });
}

// --- HUD POPUP LOGIC ---
const hudOverlay = document.getElementById('hud-overlay');
const hudIcon = document.getElementById('hud-icon');
const hudTitle = document.getElementById('hud-title');
const hudDesc = document.getElementById('hud-desc');
let hudTimeout = null;

function showHUD(title, desc, icon = "✔️") {
  if (hudTimeout) clearTimeout(hudTimeout);
  
  hudIcon.textContent = icon;
  hudTitle.textContent = title;
  hudDesc.textContent = desc;
  
  hudOverlay.classList.add('active');
  
  hudTimeout = setTimeout(() => {
    hudOverlay.classList.remove('active');
  }, 2200);
}

// --- DESKTOP PREVIEW INTERACTIONS (NASSE HÄNDE) ---
const btnSimulateWet = document.getElementById('btn-simulate-wet');
if (btnSimulateWet) {
  btnSimulateWet.addEventListener('click', () => {
    AppState.wetHandsMode = !AppState.wetHandsMode;
    
    playClickSound(AppState.wetHandsMode ? 1600 : 500, 0.08, 0.15);
    
    if (AppState.wetHandsMode) {
      document.body.classList.add('wet-hands');
      // Vergrößere Abstände und füge optische Nassfinger-Indikatoren hinzu
      btnSimulateWet.style.backgroundColor = 'var(--primary-color)';
      btnSimulateWet.textContent = "💧 Nasse Hände AKTIV (Touch-Targets +25%!)";
      
      // Passe Styles dynamisch via JS an
      document.documentElement.style.setProperty('--touch-target-size', '82px');
      document.documentElement.style.setProperty('--icon-button-size', '82px');
    } else {
      document.body.classList.remove('wet-hands');
      btnSimulateWet.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      btnSimulateWet.textContent = "💧 Nasse Hände simulieren (Vergrößert Touch-Targets)";
      
      document.documentElement.style.setProperty('--touch-target-size', '64px');
      document.documentElement.style.setProperty('--icon-button-size', '64px');
    }
  });
}

// Initialer Render & Firebase-Start
initMhdSubnavAndSearch();
initRecipeSearchAndFilters();
initBatchArchiveSearch();
renderRecipeCloudAudit();
loadVpeMasterFromCsv();

if (initFirebase()) {
  loadMhdFromCloud();
  importMhdBestandToCloud();
  importBratwurstRecipesToCloud().then(() => loadRecipesFromCloud());
  loadProductionBatchesFromCloud();
} else {
  console.warn('[CharcuLogic Firebase] App startet ohne Cloud-Sync. MHD-Liste bleibt leer bis firebaseConfig gültig ist.');
  renderMhdList();
  renderRecipes();
  renderRecipeCloudAudit();
  renderProductionBatches();
}
updateHACCPAlerts();
