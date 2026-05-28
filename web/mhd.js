// MHD-, Bestands- und Wareneingangs-Modul

const EMPLOYEE_PINS = {
  "1122": "Stephie",
  "2233": "Finn",
  "3344": "Nicole",
  "4455": "Bettina",
  "5566": "Heiko",
  "6677": "Paddy",
};

const MEISTER_OVERRIDE_PINS = {
  "7788": "Meister",
};

const HACCP_TEMP_LIMIT_C = 7.0;

const RECEIVING_FORM_IDS = [
  'we-supplier',
  'we-category',
  'we-category-quick',
  'we-temperature',
  'we-ean',
  'we-product-manual',
  'we-qty',
  'we-mhd',
];

let currentDeliveryItemBarcode = '';
let currentDeliveryItemProduct = '';

const DELIVERY_DRAFT_DB_NAME = 'charculogic-delivery-draft';
const DELIVERY_DRAFT_STORE = 'drafts';
const DELIVERY_DRAFT_KEY = 'active';

let currentDeliveryItems = [];
let currentDeliveryPhotos = [];
let activeEditingDraftId = null;
let pendingDeliveryDrafts = [];
let deliveryDraftsUnsubscribe = null;

const DELIVERY_STATUS_DRAFT = 'DRAFT_PENDING';
const DELIVERY_STATUS_COMPLETED = 'COMPLETED';
const EIGENPRODUKTION_SUPPLIER = 'Eigene Produktion';
const DEFAULT_FINALIZE_LABEL = '💾 Gesamte Lieferung abschließen';
const DRAFT_FINALIZE_LABEL = '💾 Lieferung final abschließen';

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


const mhdState = {
  db: null,
  tenantId: '',
  appsScriptWebAppUrl: '',
  products: [],
  currentSubTab: 'mopro',
  freshFilter: 'all',
  searchQuery: '',
  urgencyFilter: 'alarm',
  unsubscribe: null,
  writeOrQueueFirestore: async () => { throw new Error('MHD Sync-Engine ist nicht initialisiert.'); },
  addPendingSync: () => {},
  playFeedbackSound: () => {},
  playClickSound: () => {},
  showHUD: () => {},
  verifyAdminAction: (callback) => callback(),
  getFirebase: () => null,
  isFirebaseReady: () => false,
  openScanner: () => {},
  closeScanner: () => {},
  onFormSaved: () => {},
  restoreDraftFields: () => 0,
  initialized: false,
};

function getFirebase() { return mhdState.getFirebase?.() || null; }
function isFirebaseReady() { return Boolean(mhdState.isFirebaseReady?.() || (mhdState.db && getFirebase())); }
function requireMhdTenantId() {
  const tenantId = String(mhdState.tenantId || '').trim();
  if (!tenantId) { console.error('[CharcuLogic Firebase] MHD-Modul ohne Mandanten-ID initialisiert.'); return null; }
  return tenantId;
}
function mhdCollectionPath() { const tenantId = requireMhdTenantId(); return tenantId ? `tenants/${tenantId}/mhd_liste` : null; }
function mhdDocRef(docId) { return mhdState.db.doc(`${mhdCollectionPath()}/${docId}`); }

function serverTimestampFallback() {
  const firebaseInstance = getFirebase();
  return firebaseInstance?.firestore?.FieldValue?.serverTimestamp
    ? firebaseInstance.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}

const MHD_TROCKEN_CATEGORY = '📦 Trockenware';
const MHD_RENDER_LIMIT = 50;
const MHD_FRESH_FILTERS = {
  all: null,
  frische: '🍎 Frische',
  mopro: '🥛MoPro',
  kuehlware: '🥗 Kühlware',
  tk: '🧊 TK',
};
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
  '🧊 TK': { pruefen: 14, rabatt30: 7, rabatt50: 3, tonne: -1 },
  '📦 Trockenware': { pruefen: 30, rabatt30: 2, rabatt50: 1, tonne: -1 },
};

const MHD_ACTION_STYLES = {
  tonne: { label: '🗑️ ABSCHREIBEN / TONNE', color: '#F44336', bg: 'rgba(244, 67, 54, 0.14)' },
  rabatt50: { label: '🔥 50% RABATT', color: '#EF6C00', bg: 'rgba(239, 108, 0, 0.14)' },
  rabatt30: { label: '🏷️ 30% RABATT', color: '#F57F17', bg: 'rgba(245, 127, 23, 0.14)' },
  pruefen: { label: '👀 PRÜFEN', color: '#1565C0', bg: 'rgba(21, 101, 192, 0.14)' },
  ok: { label: '✅ OK (Regal)', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.14)' },
};


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showUtilityDialog(title, bodyHtml) {
  if (learnModeOverlay) learnModeOverlay.remove();
  learnModeOverlay = document.createElement('div');
  learnModeOverlay.className = 'learn-mode-overlay';
  learnModeOverlay.innerHTML = `
    <div class="learn-mode-card" role="dialog" aria-modal="true">
      <div class="learn-mode-title">${escapeHtml(title)}</div>
      ${bodyHtml}
      <div class="learn-mode-actions">
        <button type="button" class="btn" id="utility-dialog-close" style="width:100%;min-height:52px;margin-top:8px;background:#E5E5EA;color:#1C1C1E;">Schließen</button>
      </div>
    </div>
  `;
  document.querySelector('.app-container')?.appendChild(learnModeOverlay);
  document.getElementById('utility-dialog-close')?.addEventListener('click', () => {
    resetScanState({ keepLearnOverlay: false });
  });
}


const RECEIVING_CATEGORIES = [
  { value: '📦 Trockenware', label: '📦 Trockenware' },
  { value: '🍎 Frische', label: '🍎 Frische' },
  { value: '🥛MoPro', label: '🥛 MoPro' },
  { value: '❄️Kühlware', label: '❄️ Kühlware' },
  { value: '🧊 TK', label: '🧊 TK' },
];
const VPE_MASTER_STORAGE_KEY = 'charculogic.vpeMaster.v1';
const PRODUCT_MASTER_STORAGE_KEY = 'charculogic.productMaster.v1';
const ACTIVE_EMPLOYEE_STORAGE_KEY = 'charculogic_active_employee';
const VPE_MASTER_CSV_URL = 'vpe-master.csv';

let learnModeOverlay = null;
let currentBarcode = '';
let activeScan = null;
let selectedProduct = null;
let lastScanInputSource = 'camera';
let csvVpeMaster = {};

function setScannerStatus(message) {
  const scannerStatusText = document.getElementById('scanner-status-text');
  if (scannerStatusText) scannerStatusText.textContent = message;
}

function renderReceivingStatus({ status } = {}) {
  const vpeCountEl = document.getElementById('receiving-vpe-count');
  const countEl = document.getElementById('receiving-item-count');
  const statusEl = document.getElementById('receiving-status');
  if (vpeCountEl) {
    const localVpe = readLocalMaster(VPE_MASTER_STORAGE_KEY);
    const total = Object.keys(localVpe).length + Object.keys(csvVpeMaster).length;
    vpeCountEl.textContent = total > 0 ? String(total) : '-';
  }
  if (countEl) countEl.textContent = String(currentDeliveryItems.length);
  if (statusEl && status) statusEl.textContent = status;
}

function cleanScannedBarcode(rawCode) {
  return String(rawCode || '').trim().replace(/[^0-9]/g, '');
}

function getActiveEmployee() {
  try {
    return String(localStorage.getItem(ACTIVE_EMPLOYEE_STORAGE_KEY) || '').trim();
  } catch (err) {
    console.warn('[CharcuLogic MHD] Aktive Mitarbeiter-Session konnte nicht gelesen werden:', err);
    return '';
  }
}

function setActiveEmployee(employeeName) {
  const cleanName = String(employeeName || '').trim();
  if (!cleanName) return;
  try {
    localStorage.setItem(ACTIVE_EMPLOYEE_STORAGE_KEY, cleanName);
  } catch (err) {
    console.warn('[CharcuLogic MHD] Aktive Mitarbeiter-Session konnte nicht gespeichert werden:', err);
  }
  window.dispatchEvent(new CustomEvent('charculogic:active-employee-changed', {
    detail: { employeeName: cleanName },
  }));
}

function requestEmployeePinForScan(barcode) {
  return new Promise((resolve) => {
    document.getElementById('pin-auth-overlay')?.remove();

    let enteredPin = '';
    const overlay = document.createElement('div');
    overlay.id = 'pin-auth-overlay';
    overlay.innerHTML = `
      <div class="pin-auth-card" role="dialog" aria-modal="true" aria-labelledby="pin-auth-title">
        <div class="pin-auth-title" id="pin-auth-title">Mitarbeiter-PIN</div>
        <div class="pin-auth-scan">PIN eingeben fuer Scan: <strong>${escapeHtml(barcode)}</strong></div>
        <div class="pin-auth-dots" id="employee-pin-dots">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="pin-auth-keypad">
          ${['1','2','3','4','5','6','7','8','9','C','0','X'].map((key) =>
            `<button type="button" class="pin-auth-key" data-pin-key="${key}">${key}</button>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const dots = Array.from(overlay.querySelectorAll('#employee-pin-dots span'));
    const close = (employeeName = null) => {
      overlay.remove();
      resolve(employeeName);
    };
    const updateDots = () => {
      dots.forEach((dot, index) => dot.classList.toggle('filled', index < enteredPin.length));
    };
    const failPin = () => {
      window.showToast?.("Falsche PIN! Bitte erneut versuchen.", "error");
      enteredPin = '';
      updateDots();
      overlay.querySelector('.pin-auth-card')?.classList.add('pin-shake');
      setTimeout(() => overlay.querySelector('.pin-auth-card')?.classList.remove('pin-shake'), 260);
    };

    overlay.addEventListener('click', (event) => {
      const key = event.target.closest('[data-pin-key]')?.dataset.pinKey;
      if (!key) return;
      if (key === 'X') {
        close(null);
        return;
      }
      if (key === 'C') {
        enteredPin = '';
        updateDots();
        return;
      }
      if (!/^\d$/.test(key) || enteredPin.length >= 4) return;
      enteredPin += key;
      updateDots();
      if (enteredPin.length === 4) {
        const employeeName = EMPLOYEE_PINS[enteredPin];
        if (!employeeName) {
          failPin();
          return;
        }
        setActiveEmployee(employeeName);
        window.showToast?.(`Erfasst durch ${employeeName}`, "success");
        close(employeeName);
      }
    });

    updateDots();
  });
}

function resetScanState({ keepLearnOverlay = false } = {}) {
  currentBarcode = '';
  activeScan = null;
  selectedProduct = null;
  lastScanInputSource = 'camera';

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

function decodeCp850Byte(byte) {
  const cp850 = {
    0x81: '\u00fc',
    0x84: '\u00e4',
    0x8e: '\u00c4',
    0x94: '\u00f6',
    0x99: '\u00d6',
    0x9a: '\u00dc',
    0xe1: '\u00df',
  };
  if (byte < 128) return String.fromCharCode(byte);
  return cp850[byte] || String.fromCharCode(byte);
}

function repairLegacyGermanText(text) {
  return String(text || '')
    .replace(/\u0081/g, '\u00fc')
    .replace(/\u0084/g, '\u00e4')
    .replace(/\u008e/g, '\u00c4')
    .replace(/\u0094/g, '\u00f6')
    .replace(/\u0099/g, '\u00d6')
    .replace(/\u009a/g, '\u00dc')
    .replace(/\u00c2(?=[\u00fc\u00e4\u00f6\u00dc\u00d6\u00c4\u00df])/g, '');
}

function decodeVpeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  if (/[\u0081\u0084\u008e\u0094\u0099\u009a]/.test(utf8Text)) {
    return repairLegacyGermanText(utf8Text);
  }
  if (!/\uFFFD/.test(utf8Text)) return utf8Text;
  return Array.from(bytes, decodeCp850Byte).join('');
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
      name: repairLegacyGermanText(row[indexes.name]).trim(),
      brand: repairLegacyGermanText(row[indexes.brand]).trim(),
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
    csvVpeMaster = mapVpeCsv(decodeVpeCsvBuffer(await response.arrayBuffer()));
    console.info(`[CharcuLogic Scanner] ${Object.keys(csvVpeMaster).length} VPE-Barcodes lokal geladen.`);
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

// --- MHD-ANOMALIE-WÄCHTER ---
function getHistoricShelfLifeDays(barcode) {
  const clean = cleanScannedBarcode(barcode);
  if (!clean) return null;

  const historic = (mhdState.products || []).filter((p) => {
    const pBarcode = cleanScannedBarcode(p.ean || p.barcode || '');
    return pBarcode === clean && p.wareneingangAt && (p.mhd || p.mhdDate);
  });

  if (!historic.length) return null;

  const shelfDays = historic.map((p) => {
    const eingangDate = new Date(p.wareneingangAt);
    const mhdStr = p.mhd || p.mhdDate;
    const mhdDate = new Date(`${mhdStr}T00:00:00`);
    if (Number.isNaN(eingangDate.getTime()) || Number.isNaN(mhdDate.getTime())) return null;
    return Math.ceil((mhdDate.getTime() - eingangDate.getTime()) / 86400000);
  }).filter((d) => d != null && d > 0);

  if (!shelfDays.length) return null;
  return Math.max(...shelfDays);
}

function checkMhdAnomaly(barcode, mhdDateStr, kategorie) {
  const todayTime = new Date();
  todayTime.setHours(0, 0, 0, 0);
  const mhdTime = new Date(`${mhdDateStr}T00:00:00`);
  if (Number.isNaN(mhdTime.getTime())) return null;

  const restTage = Math.ceil((mhdTime.getTime() - todayTime.getTime()) / 86400000);

  const isFresh = /frische|mopro|kühlware|kuehlware/i.test(kategorie || '');
  if (isFresh && restTage < 4) {
    return {
      restTage,
      reason: `Nur ${restTage} Resttage bei Frische-/Kühlware – extrem kurz!`,
    };
  }

  const historicDays = getHistoricShelfLifeDays(barcode);
  if (historicDays && restTage < historicDays * 0.6) {
    return {
      restTage,
      historicDays,
      reason: `Nur ${restTage} Resttage statt üblicher ~${historicDays} Tage (${Math.round(restTage / historicDays * 100)}%).`,
    };
  }

  return null;
}

function showMhdAnomalyWarning(anomaly) {
  return new Promise((resolve) => {
    mhdState.playFeedbackSound('alarm');
    const overlay = document.createElement('div');
    overlay.className = 'learn-mode-overlay';
    overlay.innerHTML = `
      <div class="learn-mode-card mhd-anomaly-card" role="alertdialog" aria-modal="true">
        <div class="mhd-anomaly-icon">⚠️</div>
        <div class="learn-mode-title" style="color:var(--warning-color);">Ungewöhnlich kurzes MHD!</div>
        <p class="learn-mode-desc">${escapeHtml(anomaly.reason)}</p>
        <p class="learn-mode-desc" style="font-weight:800;color:var(--text-dark);">Bitte prüfen: Ist das MHD korrekt abgelesen?</p>
        <div class="learn-mode-actions" style="display:flex;flex-direction:column;gap:10px;">
          <button type="button" class="btn btn-learn-submit" id="btn-anomaly-save" style="background:var(--warning-color);">Trotzdem speichern</button>
          <button type="button" class="btn btn-learn-submit" id="btn-anomaly-correct" style="background:var(--primary-color);">Korrigieren</button>
        </div>
      </div>
    `;
    document.querySelector('.app-container')?.appendChild(overlay);

    const cleanup = (result) => { overlay.remove(); resolve(result); };
    document.getElementById('btn-anomaly-save')?.addEventListener('click', () => cleanup('save'));
    document.getElementById('btn-anomaly-correct')?.addEventListener('click', () => cleanup('correct'));
  });
}

function createReceivingPostenId(barcode, mhdDate) {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return [
    cleanScannedBarcode(barcode) || 'posten',
    String(mhdDate || 'ohne-mhd').replace(/[^0-9]/g, ''),
    Date.now().toString(36),
    randomPart,
  ].filter(Boolean).join('_');
}

function lookupScannedProduct(scannedCode) {
  const vpeMaster = readLocalMaster(VPE_MASTER_STORAGE_KEY);
  if (vpeMaster[scannedCode]) {
    const existingProduct = mhdState.products.find(p => cleanScannedBarcode(p.ean || p.barcode || p.id) === scannedCode);
    return { ...vpeMaster[scannedCode], barcode: scannedCode, existingProduct, isVpe: true, source: 'vpe-stammdaten' };
  }

  if (csvVpeMaster[scannedCode]) {
    const csvVpe = csvVpeMaster[scannedCode];
    const existingProduct = mhdState.products.find((product) => {
      const productBarcode = cleanScannedBarcode(product.ean || product.barcode || product.id);
      return productBarcode === cleanScannedBarcode(csvVpe.einzelBarcode) || productBarcode === scannedCode;
    });
    return { ...csvVpe, existingProduct };
  }

  const csvProduct = Object.values(csvVpeMaster).find((entry) =>
    cleanScannedBarcode(entry.einzelBarcode) === scannedCode
  );
  if (csvProduct) {
    const existingProduct = mhdState.products.find((product) => {
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

  const existing = mhdState.products.find(p => cleanScannedBarcode(p.ean || p.barcode || p.id) === scannedCode);
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

function isReceivingPageActive() {
  return document.getElementById('page-receiving')?.classList.contains('active');
}

function updateDeliveryItemProductUi() {
  const resolved = document.getElementById('we-product-resolved');
  const resolvedName = document.getElementById('we-product-resolved-name');
  const manualWrap = document.getElementById('we-product-manual-wrap');
  const hasName = Boolean(currentDeliveryItemProduct);
  resolved?.classList.toggle('hidden', !hasName);
  if (resolvedName) resolvedName.textContent = currentDeliveryItemProduct;
  manualWrap?.classList.toggle('hidden', hasName || !currentDeliveryItemBarcode);
}

function applyBarcodeToDeliveryItemDraft(barcode) {
  const code = cleanScannedBarcode(barcode);
  if (!code) {
    mhdState.showHUD('Barcode fehlt', 'Bitte EAN eingeben oder scannen.', '!');
    document.getElementById('we-ean')?.focus();
    return false;
  }

  const eanEl = document.getElementById('we-ean');
  if (eanEl) eanEl.value = code;
  currentDeliveryItemBarcode = code;

  const info = lookupScannedProduct(code);
  if (info?.name) {
    currentDeliveryItemProduct = String(info.name).trim();
    if (info.category) {
      const mappedCategory = mapMhdCategoryToHeadCategory(info.category);
      const categorySelect = document.getElementById('we-category-quick');
      if (mappedCategory && categorySelect) {
        const hasOption = Array.from(categorySelect.options || []).some((option) => option.value === mappedCategory);
        if (hasOption) {
          categorySelect.value = mappedCategory;
          updateReceivingQtyFieldUi();
        }
      }
    }
    const manualInput = document.getElementById('we-product-manual');
    if (manualInput) manualInput.value = '';
    renderReceivingStatus({ lastScan: code, status: 'Produkt erkannt' });
    mhdState.playClickSound(1200, 0.04, 0.12);
  } else {
    currentDeliveryItemProduct = '';
    renderReceivingStatus({ lastScan: code, status: 'EAN unbekannt – Name ergänzen' });
    mhdState.showHUD('Unbekannte EAN', 'Bitte den Produktnamen eintragen.', '!');
    document.getElementById('we-product-manual')?.focus();
  }

  updateDeliveryItemProductUi();
  setReceivingMode('schnell');
  return true;
}

async function processDeliveryItemBarcode(decodedText, source = 'camera') {
  const scannedCode = cleanScannedBarcode(decodedText);
  if (!scannedCode) return;
  if (scannedCode === '40999999') {
    renderReceivingStatus({ status: 'Test-Barcode ignoriert' });
    return;
  }
  mhdState.closeScanner?.({ preserveScanState: true });
  applyBarcodeToDeliveryItemDraft(scannedCode);
  document.getElementById('we-qty')?.focus();
}

async function processScannedBarcode(decodedText, source = 'camera') {
  const scannedCode = cleanScannedBarcode(decodedText);
  if (!scannedCode) return;
  if (scannedCode === '40999999') {
    console.warn('[CharcuLogic Scanner] Alter Test-Barcode wurde ignoriert.');
    renderReceivingStatus({ status: 'Test-Barcode ignoriert' });
    return;
  }

  if (isReceivingPageActive()) {
    await processDeliveryItemBarcode(scannedCode, source);
    return;
  }

  resetScanState({ keepLearnOverlay: false });
  lastScanInputSource = source;
  currentBarcode = scannedCode;
  mhdState.closeScanner({ preserveScanState: true });
  let employeeName = getActiveEmployee();
  if (employeeName) {
    window.showToast?.(`Erfasst durch ${employeeName}`, "success");
  } else {
    employeeName = await requestEmployeePinForScan(scannedCode);
  }
  if (!employeeName) {
    renderReceivingStatus({ lastScan: scannedCode, status: 'Scan abgebrochen' });
    resetScanState({ keepLearnOverlay: false });
    return;
  }
  activeScan = {
    barcode: scannedCode,
    scannedAt: Date.now(),
    scannedBy: employeeName,
    source,
    handled: false
  };

  handleScannedEan(scannedCode);
}

async function postNewArticleToAppsScript(article) {
  if (!mhdState.appsScriptWebAppUrl) return;

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
    scannedBy: article.scannedBy || '',
    tenantId: mhdState.tenantId
  };
  const body = JSON.stringify(payload);

  if (!navigator.onLine) {
    mhdState.addPendingSync({ _syncType: 'appsScript', data: payload });
    return;
  }

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      mhdState.appsScriptWebAppUrl,
      new Blob([body], { type: 'text/plain;charset=utf-8' })
    );
    if (sent) return;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 2500)
    : null;

  try {
    await fetch(mhdState.appsScriptWebAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body,
      signal: controller?.signal,
    });
  } catch (err) {
    mhdState.addPendingSync({ _syncType: 'appsScript', data: payload });
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function handleScannedEan(ean) {
  const scannedCode = cleanScannedBarcode(ean);
  if (!scannedCode) return;

  if (!activeScan || activeScan.barcode !== scannedCode) {
    const scannedBy = activeScan?.scannedBy || '';
    resetScanState({ keepLearnOverlay: false });
    currentBarcode = scannedCode;
    activeScan = {
      barcode: scannedCode,
      scannedAt: Date.now(),
      scannedBy,
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
    const updates = { qty: newQty, soldOut: false, scannedBy: activeScan?.scannedBy || '' };

    try {
      await mhdState.writeOrQueueFirestore({
        collectionPath: mhdCollectionPath(),
        docId: existing.id,
        op: 'update',
        onlineData: updates,
        queueData: updates,
        offlineMessage: 'Bestandsaenderung wird nachtraeglich synchronisiert.',
      });
      activeScan.handled = true;
      mhdState.playFeedbackSound('success');
      mhdState.showHUD("➕ Bestand erhöht", `${existing.name} – Menge: ${newQty}`);
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
      mhdState.showHUD("⚠️ Name fehlt", "Bitte einen Produktnamen eingeben.", "⚠️");
      return;
    }

    const learnDocId = `learn_${cleanScannedBarcode(ean)}_${Date.now().toString(36)}`;
    const newProduct = {
      ean,
      name,
      brand,
      mhdText: 'Neu eingelernt – MHD prüfen',
      date: new Date().toLocaleDateString('de-DE'),
      status: 'ok',
      qty: 1,
      soldOut: false,
      scannedBy: activeScan?.scannedBy || '',
      tenantId: mhdState.tenantId,
    };

    try {
      await mhdState.writeOrQueueFirestore({
        collectionPath: mhdCollectionPath(),
        docId: learnDocId,
        op: 'set',
        onlineData: { ...newProduct, createdAt: serverTimestampFallback() },
        queueData: { ...newProduct, createdAt: new Date().toISOString() },
        offlineMessage: 'Neuer Artikel wird nachträglich synchronisiert.',
      });
      learnModeOverlay?.remove();
      learnModeOverlay = null;
      mhdState.onFormSaved(['manual-barcode-input']);
      mhdState.playClickSound(1300, 0.08, 0.2);
      mhdState.showHUD("✅ Artikel gelernt", `${name} wurde in Firestore verbucht.`);
    } catch (err) {
      console.error('[CharcuLogic Firebase] Lernmodus speichern fehlgeschlagen:', err);
      mhdState.showHUD("⚠️ Fehler", "Artikel konnte nicht gespeichert werden.", "⚠️");
    }
  });
}

function showLearnModeDialog(ean) {
  if (learnModeOverlay) learnModeOverlay.remove();

  const scannedBy = activeScan?.scannedBy || '';
  currentBarcode = cleanScannedBarcode(ean);
  activeScan = {
    barcode: currentBarcode,
    scannedAt: Date.now(),
    scannedBy,
    source: lastScanInputSource,
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
        LOT / Chargen-Nr.
        <input type="text" id="learn-product-lot" class="gastro-input" placeholder="LOT / Chargen-Nr. (Pflichtfeld)" autocomplete="off" required>
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
  mhdState.playFeedbackSound(isKnown ? 'success' : 'unknown');

  const inputName = document.getElementById('learn-product-name');
  const inputBrand = document.getElementById('learn-product-brand');
  const inputQty = document.getElementById('learn-product-qty');
  const inputMhd = document.getElementById('learn-product-mhd');
  const inputLot = document.getElementById('learn-product-lot');
  const inputCategory = document.getElementById('learn-product-category');
  const btnLearnSave = document.getElementById('btn-learn-save');
  const btnLearnCancel = document.getElementById('btn-learn-cancel');

  if (btnLearnSave) btnLearnSave.textContent = 'Wareneingang speichern';
  if (inputName) inputName.value = productInfo?.name || document.getElementById('we-product-manual')?.value.trim() || '';
  if (inputBrand) inputBrand.value = productInfo?.brand || document.getElementById('we-supplier')?.value.trim() || '';
  if (inputMhd && document.getElementById('we-mhd')?.value) inputMhd.value = document.getElementById('we-mhd').value;
  if (inputQty && document.getElementById('we-qty')?.value) {
    inputQty.value = String(Math.max(1, parseFloat(document.getElementById('we-qty').value) || 1));
  }
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
  const updateLotGate = () => {
    if (!btnLearnSave) return;
    const hasLot = Boolean(inputLot?.value.trim());
    btnLearnSave.disabled = !hasLot;
    btnLearnSave.setAttribute('aria-disabled', hasLot ? 'false' : 'true');
  };

  setTimeout(() => inputName?.focus(), 100);
  updateLotGate();
  inputLot?.addEventListener('input', updateLotGate);

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
    mhdState.playClickSound(700, 0.04, 0.12);
  });

  btnLearnSave?.addEventListener('click', async () => {
    const name = inputName?.value.trim();
    const brand = inputBrand?.value.trim() || '';
    const qty = Math.max(1, parseFloat(String(inputQty?.value || '1').replace(',', '.')) || 1);
    const mhdDate = inputMhd?.value || today;
    const lot = inputLot?.value.trim() || '';
    const kategorie = normalizeMhdCategory(inputCategory?.value || '📦 Trockenware');
    const barcodeForSave = currentBarcode || cleanScannedBarcode(ean);
    const isVpe = Boolean(inputIsVpe?.checked);
    const vpeSize = Math.max(2, parseFloat(String(inputVpeSize?.value || '6').replace(',', '.')) || 6);
    const inventoryBarcode = cleanScannedBarcode(productInfo?.einzelBarcode) || barcodeForSave;

    if (!name) {
      inputName?.focus();
      mhdState.showHUD("Name fehlt", "Bitte einen Produktnamen eingeben.", "!");
      return;
    }

    if (!lot) {
      inputLot?.focus();
      updateLotGate();
      mhdState.showHUD("LOT fehlt", "Bitte die Chargennummer eintragen.", "!");
      return;
    }

    if (!barcodeForSave) {
      mhdState.showHUD("Barcode fehlt", "Bitte den Artikel erneut scannen.", "!");
      resetScanState({ keepLearnOverlay: false });
      return;
    }

    const mhdTime = new Date(`${mhdDate}T00:00:00`);
    const todayTime = new Date();
    todayTime.setHours(0, 0, 0, 0);
    const tage = Number.isNaN(mhdTime.getTime())
      ? null
      : Math.ceil((mhdTime.getTime() - todayTime.getTime()) / 86400000);

    const anomaly = checkMhdAnomaly(inventoryBarcode, mhdDate, kategorie);
    if (anomaly) {
      const decision = await showMhdAnomalyWarning(anomaly);
      if (decision === 'correct') return;
    }

    const postenId = createReceivingPostenId(inventoryBarcode, mhdDate);
    const newProduct = {
      id: postenId,
      postenId,
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
      mhdTimestamp: Number.isNaN(mhdTime.getTime()) ? null : mhdTime,
      date: mhdDate ? new Date(`${mhdDate}T00:00:00`).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE'),
      tage,
      resttage: tage,
      status: 'aktiv',
      qty,
      menge: qty,
      eingangMenge: qty,
      lot,
      chargenNummer: lot,
      kategorie,
      soldOut: false,
      vpeBarcode: isVpe ? barcodeForSave : '',
      vpeInhalt: isVpe ? vpeSize : '',
      source: 'wareneingang-app',
      postentyp: 'wareneingang',
      wareneingangAt: new Date().toISOString(),
      scannedBy: activeScan?.scannedBy || '',
      tenantId: mhdState.tenantId,
      updatedAt: serverTimestampFallback(),
      createdAt: serverTimestampFallback()
    };
    const queuedProduct = {
      ...newProduct,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      if (btnLearnSave) {
        btnLearnSave.disabled = true;
        btnLearnSave.textContent = 'Speichere...';
      }
      const saveJobs = [
        postNewArticleToAppsScript({ ...newProduct, qty }),
        mhdState.writeOrQueueFirestore({
          collectionPath: mhdCollectionPath(),
          docId: postenId,
          op: 'set',
          onlineData: newProduct,
          queueData: queuedProduct,
          offlineMessage: "Wareneingang wird nachträglich synchronisiert.",
        }),
      ];
      const saveResults = await Promise.allSettled(saveJobs);
      const failedSave = saveResults.find((result) => result.status === 'rejected');
      if (failedSave) {
        console.warn('[CharcuLogic Firebase] Mindestens ein Speicherziel hat nicht geantwortet:', failedSave.reason);
      }
      const firestoreResult = saveResults[1]?.status === 'fulfilled' ? saveResults[1].value : null;
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
      mhdState.onFormSaved(['manual-barcode-input']);
      mhdState.playClickSound(1300, 0.08, 0.2);
      if (lastScanInputSource === 'manual') {
        mhdState.showHUD("Lokal gesichert (Manuelle Eingabe)", `${qty} Stueck ${name} wurden erfasst.`);
        renderReceivingStatus({ lastScan: barcodeForSave, status: firestoreResult === 'queued' ? 'Lokal gesichert' : 'Gespeichert' });
      } else {
        mhdState.showHUD("Wareneingang gespeichert", `${qty} Stueck ${name} wurden erfasst.`);
        renderReceivingStatus({ lastScan: barcodeForSave, status: 'Gespeichert' });
      }
      resetScanState({ keepLearnOverlay: false });
    } catch (err) {
      console.error('[CharcuLogic Firebase] Lernmodus speichern fehlgeschlagen:', err);
      mhdState.showHUD("Fehler", "Artikel konnte nicht gespeichert werden.", "!");
      resetScanState({ keepLearnOverlay: false });
    } finally {
      if (btnLearnSave) {
        btnLearnSave.disabled = false;
        btnLearnSave.textContent = 'Wareneingang speichern';
      }
    }
  });
}


function normalizeMhdCategory(kategorie) {
  const kat = (kategorie || '').trim();
  if (!kat) return '🥛MoPro';
  if (kat === '❄️Kühlware') return '🥗 Kühlware';
  if (kat === '❄️ Kühlware') return '🥗 Kühlware';
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
  const upperLimit = category === MHD_TROCKEN_CATEGORY ? 15 : (MHD_RABATT_MATRIX[category]?.pruefen ?? 3);
  return days >= 1 && days <= upperLimit;
}

function matchesMhdUrgencyFilter(prod) {
  const checkedToday = prod.lastMhdCheckDate === new Date().toISOString().slice(0, 10);
  if (mhdState.urgencyFilter === 'done') return Boolean(prod.soldOut || checkedToday);
  if (prod.soldOut) return false;
  if (checkedToday && mhdState.urgencyFilter !== 'all') return false;

  const days = getMhdResttage(prod);
  if (mhdState.urgencyFilter === 'alarm') return days <= 0;
  if (mhdState.urgencyFilter === 'action') return isMhdActionWindow(prod);
  return true;
}

function filterMhdProducts(products) {
  const query = mhdState.searchQuery.trim();
  return products.filter((prod) => {
    const category = getProductCategory(prod);
    const matchesTab = mhdState.currentSubTab === 'mopro'
      ? category !== MHD_TROCKEN_CATEGORY
      : category === MHD_TROCKEN_CATEGORY;
    if (!matchesTab) return false;
    const freshCategory = MHD_FRESH_FILTERS[mhdState.freshFilter];
    if (mhdState.currentSubTab === 'mopro' && freshCategory && category !== freshCategory) return false;
    if (!matchesMhdUrgencyFilter(prod)) return false;
    if (!query) return true;
    const name = (prod.name || prod.produkt || '').toLowerCase();
    const brand = (prod.brand || prod.marke || '').toLowerCase();
    return name.includes(query) || brand.includes(query);
  });
}

function productPostenCount(prod) {
  const barcode = cleanScannedBarcode(prod.ean || prod.barcode || prod.scanBarcode);
  if (!barcode) return 1;
  return mhdState.products.filter((entry) =>
    !entry.soldOut && cleanScannedBarcode(entry.ean || entry.barcode || entry.scanBarcode) === barcode
  ).length;
}

function openPostenHistory(prodId) {
  const prod = mhdState.products.find((entry) => entry.id === prodId);
  if (!prod) return;
  const barcode = cleanScannedBarcode(prod.ean || prod.barcode || prod.scanBarcode);
  const posten = mhdState.products
    .filter((entry) => cleanScannedBarcode(entry.ean || entry.barcode || entry.scanBarcode) === barcode)
    .sort((a, b) => getMhdResttage(a) - getMhdResttage(b));

  showUtilityDialog('Posten-Historie', `
    <p class="learn-mode-desc">${escapeHtml(prod.name || prod.produkt || 'Produkt')} · Barcode ${escapeHtml(barcode)}</p>
    <div class="utility-list">
      ${posten.map((entry) => `
        <div class="utility-row">
          <div class="utility-row-title">${escapeHtml(entry.name || entry.produkt || 'Posten')}</div>
          <div class="utility-row-meta">
            MHD: ${escapeHtml(entry.mhd || entry.mhdDate || entry.date || '-')} · Resttage: ${escapeHtml(entry.tage ?? entry.resttage ?? '-')} · Menge: ${escapeHtml(entry.qty ?? entry.menge ?? '-')}
          </div>
          <div class="utility-row-meta">${entry.soldOut ? 'Erledigt / abverkauft' : 'Aktiv'}</div>
        </div>
      `).join('')}
    </div>
  `);
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
  const subtabSelect = document.getElementById('mhd-subtab-select');
  const freshFilterField = document.getElementById('mhd-fresh-filter-field');
  const freshFilterSelect = document.getElementById('mhd-fresh-filter-select');
  const urgencySelect = document.getElementById('mhd-urgency-select');
  const searchToggle = document.getElementById('mhd-search-toggle');
  const searchPanel = document.getElementById('mhd-search-panel');
  const searchInput = document.getElementById('mhd-search-input');
  const searchClear = document.getElementById('mhd-search-clear');
  const searchToggleLabel = searchToggle?.querySelector('.mhd-search-toggle-label');

  const updateSearchToggleLabel = () => {
    if (!searchToggleLabel) return;
    const query = mhdState.searchQuery.trim();
    if (!searchPanel?.hidden) {
      searchToggleLabel.textContent = '▲ Suche schließen';
      return;
    }
    if (query) {
      const preview = query.length > 22 ? `${query.slice(0, 22)}…` : query;
      searchToggleLabel.textContent = `🔍 Suche: ${preview}`;
      return;
    }
    searchToggleLabel.textContent = '🔍 Artikel suchen';
  };

  const setMhdSearchExpanded = (expanded) => {
    if (!searchPanel || !searchToggle) return;
    searchPanel.hidden = !expanded;
    searchToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    updateSearchToggleLabel();
    if (expanded) {
      requestAnimationFrame(() => searchInput?.focus());
    }
  };

  const clearMhdSearch = () => {
    mhdState.searchQuery = '';
    if (searchInput) searchInput.value = '';
    updateSearchToggleLabel();
    renderMhdList();
  };

  const syncFilterControlsFromState = () => {
    if (subtabSelect) subtabSelect.value = mhdState.currentSubTab;
    freshFilterField?.classList.toggle('hidden', mhdState.currentSubTab !== 'mopro');
    if (freshFilterSelect) freshFilterSelect.value = mhdState.freshFilter;
    if (urgencySelect) urgencySelect.value = mhdState.urgencyFilter;
  };

  subtabSelect?.addEventListener('change', () => {
    mhdState.currentSubTab = subtabSelect.value === 'trocken' ? 'trocken' : 'mopro';
    freshFilterField?.classList.toggle('hidden', mhdState.currentSubTab !== 'mopro');
    if (mhdState.currentSubTab !== 'mopro') {
      mhdState.freshFilter = 'all';
      if (freshFilterSelect) freshFilterSelect.value = 'all';
    }
    mhdState.playClickSound(900, 0.04, 0.12);
    renderMhdList();
  });

  freshFilterSelect?.addEventListener('change', () => {
    mhdState.freshFilter = freshFilterSelect.value || 'all';
    mhdState.playClickSound(940, 0.04, 0.12);
    renderMhdList();
  });

  urgencySelect?.addEventListener('change', () => {
    mhdState.urgencyFilter = urgencySelect.value || 'all';
    mhdState.playClickSound(980, 0.04, 0.12);
    renderMhdList();
  });

  searchToggle?.addEventListener('click', () => {
    setMhdSearchExpanded(Boolean(searchPanel?.hidden));
  });

  searchClear?.addEventListener('click', () => {
    clearMhdSearch();
    searchInput?.focus();
  });

  searchInput?.addEventListener('input', (event) => {
    mhdState.searchQuery = event.target.value.toLowerCase();
    updateSearchToggleLabel();
    renderMhdList();
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMhdSearchExpanded(false);
  });

  syncFilterControlsFromState();
  updateSearchToggleLabel();
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
  if (!isFirebaseReady() || !mhdState.db) {
    console.error('[CharcuLogic Firebase] loadMhdFromCloud(): Firebase ist nicht initialisiert.');
    return;
  }

  if (mhdState.unsubscribe) {
    mhdState.unsubscribe();
    mhdState.unsubscribe = null;
  }

  mhdState.unsubscribe = mhdState.db.collection(mhdCollectionPath()).onSnapshot(
    (snapshot) => {
      mhdState.products = snapshot.docs.map(mapMhdDoc);
      renderMhdList();
    },
    (err) => {
      console.error('[CharcuLogic Firebase] MHD Live-Sync Fehler:', err);
    }
  );
}

async function isMhdCollectionEmpty() {
  const snap = await mhdState.db.collection(mhdCollectionPath()).limit(1).get();
  return snap.empty;
}

async function importMhdBestandToCloud() {
  if (!isFirebaseReady() || !mhdState.db) {
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
        mhdState.db.collection(mhdCollectionPath()).doc(item.id).set(item)
      )
    );
    console.info(`[CharcuLogic Firebase] ${mhdBestandSeed.length} MHD-Artikel in Firestore geseedet.`);
  } catch (err) {
    console.error('[CharcuLogic Firebase] MHD-Seed fehlgeschlagen:', err);
  }
}


function renderMhdList() {
  const container = document.getElementById('mhd-items-container');
  if (!container) return;

  if (!mhdState.products.length) {
    container.innerHTML = `
      <div class="mhd-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        ${isFirebaseReady() ? 'Keine MHD-Artikel in der Cloud. Scanne einen Barcode zum Einlernen.' : 'Firebase nicht konfiguriert – MHD-Daten können nicht geladen werden.'}
      </div>`;
    return;
  }

  const sortedProducts = sortMhdProductsByResttage(mhdState.products);
  const visibleProducts = filterMhdProducts(sortedProducts);
  const renderedProducts = visibleProducts.slice(0, MHD_RENDER_LIMIT);

  if (!visibleProducts.length) {
    const activeFilterLabel = MHD_URGENCY_FILTERS[mhdState.urgencyFilter] || MHD_URGENCY_FILTERS.all;
    container.innerHTML = `
      <div class="mhd-empty-hint" style="text-align:center;padding:32px 16px;color:#666;">
        Keine Artikel in dieser Kategorie${mhdState.searchQuery ? ' für deine Suche' : ''} im Filter ${activeFilterLabel}.
      </div>`;
    return;
  }

  const limitHint = visibleProducts.length > MHD_RENDER_LIMIT
    ? `<div class="mhd-render-limit-hint">Zeige die dringendsten ${MHD_RENDER_LIMIT} von ${visibleProducts.length} Treffern. Nutze die Suche zum Eingrenzen.</div>`
    : '';

  container.innerHTML = limitHint + renderedProducts.map((prod) => {
    const action = computeMhdAction(prod);
    const postenCount = productPostenCount(prod);
    return `
    <div class="mhd-card status-${prod.status || 'ok'} ${prod.soldOut ? 'sold-out' : ''}" id="mhd-card-${prod.id}">
      <div class="mhd-action-badge" style="color:${action.color};background:${action.bg};border:2px solid ${action.color};box-shadow:0 0 14px ${action.bg};font-weight:800;font-size:13px;text-align:center;padding:10px 12px;border-radius:10px;margin-bottom:4px;letter-spacing:0.3px;">
        ${action.label}
      </div>
      <div class="mhd-card-header">
        <div class="mhd-product-info">
          <span class="mhd-product-name">${prod.name}</span>
          <span class="mhd-product-meta">${prod.brand ? prod.brand + ' · ' : ''}${prod.mhdText || ''}${postenCount > 1 ? ` · ${postenCount} aktive Posten` : ''}</span>
        </div>
        <div class="mhd-badge" style="color:${action.color};background:${action.bg};">${prod.tage ?? '–'} Tage</div>
      </div>
      <div class="mhd-controls-row">
        <div class="qty-stepper">
          <button class="btn-stepper" data-mhd-command="adjust" data-mhd-id="${prod.id}" data-mhd-change="-1">−</button>
          <div class="qty-value-container">
            <span id="qty-val-${prod.id}">${prod.qty ?? 0}</span>
          </div>
          <button class="btn-stepper" data-mhd-command="adjust" data-mhd-id="${prod.id}" data-mhd-change="1">+</button>
        </div>
        <button class="btn btn-soldout" data-mhd-command="soldout" data-mhd-id="${prod.id}" title="Ausverkauft">
          🗑️ Ausverkauft
        </button>
      </div>
      <div class="mhd-action-row">
        <button class="btn-mhd-action" data-mhd-command="action" data-mhd-id="${prod.id}" data-mhd-action-status="rausgenommen">↩️ Raus</button>
        <button class="btn-mhd-action btn-mhd-action--primary" data-mhd-command="action" data-mhd-id="${prod.id}" data-mhd-action-status="geprueft">✓ OK</button>
        <button class="btn-mhd-action" data-mhd-command="action" data-mhd-id="${prod.id}" data-mhd-action-status="kueche">🥣 Küche</button>
      </div>
    </div>
  `;
  }).join('');

  initMhdSwipeGestures();
}

// --- MHD-KARTEN SWIPE-GESTEN ---
function initMhdSwipeGestures() {
  const container = document.getElementById('mhd-items-container');
  if (!container) return;
  if (container.dataset.swipeBound === '1') return;
  container.dataset.swipeBound = '1';

  let activeCard = null;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isTracking = false;
  const THRESHOLD = 100;

  container.addEventListener('touchstart', (e) => {
    const card = e.target.closest('.mhd-card');
    if (!card || card.classList.contains('sold-out')) return;

    activeCard = card;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    currentX = 0;
    isTracking = false;
    card.style.transition = 'none';
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!activeCard) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (!isTracking && Math.abs(dy) > Math.abs(dx)) {
      activeCard = null;
      return;
    }
    isTracking = true;
    e.preventDefault();

    currentX = dx;
    const clamped = Math.max(-200, Math.min(200, dx));
    activeCard.style.transform = `translateX(${clamped}px)`;

    let bg = activeCard.querySelector('.swipe-action-bg');
    if (!bg) {
      bg = document.createElement('div');
      bg.className = 'swipe-action-bg';
      activeCard.style.position = 'relative';
      activeCard.insertBefore(bg, activeCard.firstChild);
    }

    if (clamped < -30) {
      bg.textContent = 'Ausverkauft';
      bg.className = 'swipe-action-bg swipe-bg--left';
      bg.style.opacity = Math.min(1, Math.abs(clamped) / THRESHOLD);
    } else if (clamped > 30) {
      bg.textContent = 'Reduziert';
      bg.className = 'swipe-action-bg swipe-bg--right';
      bg.style.opacity = Math.min(1, clamped / THRESHOLD);
    } else {
      bg.style.opacity = 0;
    }
  }, { passive: false });

  container.addEventListener('touchend', () => {
    if (!activeCard) return;
    const card = activeCard;
    const id = card.id?.replace('mhd-card-', '');
    activeCard = null;

    if (currentX < -THRESHOLD && id) {
      card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      card.style.transform = 'translateX(-110%)';
      card.style.opacity = '0';
      mhdState.playFeedbackSound('success');
      setTimeout(() => {
        setSoldOut(id);
      }, 280);
    } else if (currentX > THRESHOLD && id) {
      card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      card.style.transform = 'translateX(110%)';
      card.style.opacity = '0';
      mhdState.playFeedbackSound('success');
      setTimeout(() => {
        markMhdAction(id, 'reduziert');
      }, 280);
    } else {
      card.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      card.style.transform = 'translateX(0)';
      setTimeout(() => {
        const bg = card.querySelector('.swipe-action-bg');
        if (bg) bg.remove();
        card.style.transition = '';
        card.style.transform = '';
      }, 260);
    }
  }, { passive: true });
}

async function adjustQty(id, change) {
  const prod = mhdState.products.find(p => p.id === id);
  if (!prod || prod.soldOut) return;

  const newQty = Math.max(0, (prod.qty ?? 0) + change);
  mhdState.playClickSound(change > 0 ? 1400 : 1100, 0.03, 0.12);

  try {
    await mhdState.writeOrQueueFirestore({
      collectionPath: mhdCollectionPath(),
      docId: id,
      onlineData: { qty: newQty },
      queueData: { qty: newQty },
      offlineMessage: "Mengenänderung wird nachträglich synchronisiert.",
    });
  } catch (err) {
    console.error('[CharcuLogic Firebase] adjustQty() Update fehlgeschlagen:', err);
    mhdState.showHUD("Fehler", "Menge konnte nicht gespeichert werden.", "!");
  }
};

async function setSoldOut(id) {
  const prod = mhdState.products.find(p => p.id === id);
  if (!prod) return;

  const newSoldOut = !prod.soldOut;
  const updates = {
    soldOut: newSoldOut,
    qty: newSoldOut ? 0 : (prod.qty ?? 0),
  };
  mhdState.playClickSound(400, 0.08, 0.2);

  try {
    await mhdState.writeOrQueueFirestore({
      collectionPath: mhdCollectionPath(),
      docId: id,
      onlineData: updates,
      queueData: updates,
      offlineMessage: "Ausverkauft-Status wird nachträglich synchronisiert.",
    });
  } catch (err) {
    console.error('[CharcuLogic Firebase] setSoldOut() Update fehlgeschlagen:', err);
    mhdState.showHUD("Fehler", "Status konnte nicht gespeichert werden.", "!");
  }
};

async function markMhdAction(id, actionStatus) {
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const updates = {
    mhdActionStatus: actionStatus,
    lastMhdCheckDate: today,
    lastMhdCheckAt: serverTimestampFallback(),
  };
  const queuedUpdates = {
    mhdActionStatus: actionStatus,
    lastMhdCheckDate: today,
    lastMhdCheckAt: nowIso,
  };
  if (actionStatus === 'rausgenommen') {
    updates.soldOut = true;
    updates.qty = 0;
    queuedUpdates.soldOut = true;
    queuedUpdates.qty = 0;
  }
  if (actionStatus === 'reduziert') {
    updates.rabattiert = true;
    updates.rabattiertAt = serverTimestampFallback();
    queuedUpdates.rabattiert = true;
    queuedUpdates.rabattiertAt = nowIso;
  }
  if (actionStatus === 'kueche') {
    updates.kuecheAngefragt = true;
    updates.kuecheAngefragtAt = serverTimestampFallback();
    queuedUpdates.kuecheAngefragt = true;
    queuedUpdates.kuecheAngefragtAt = nowIso;
  }
  try {
    await mhdState.writeOrQueueFirestore({
      collectionPath: mhdCollectionPath(),
      docId: id,
      onlineData: updates,
      queueData: queuedUpdates,
      offlineMessage: "MHD-Aktion wird nachträglich synchronisiert.",
    });
    const successMessage = actionStatus === 'reduziert'
      ? 'Posten als reduziert markiert.'
      : actionStatus === 'rausgenommen'
        ? 'Posten als rausgenommen markiert.'
        : actionStatus === 'kueche'
          ? (navigator.onLine
            ? 'Erfolgreich an die Küche übergeben! (Live-Sync)'
            : 'Offline gespeichert (Warte auf Netz)')
          : 'Posten als geprüft markiert.';
    mhdState.showHUD("Morgencheck erledigt", successMessage);
  } catch (err) {
    console.error('[CharcuLogic Firebase] MHD-Aktion speichern fehlgeschlagen:', err);
    mhdState.showHUD("Fehler", "MHD-Aktion konnte nicht gespeichert werden.", "!");
  }
};

async function deleteMhdPosten(id) {
  try {
    await mhdState.writeOrQueueFirestore({
      collectionPath: mhdCollectionPath(),
      docId: id,
      op: 'delete',
      onlineData: {},
      queueData: {},
      offlineMessage: "Löschung wird nachträglich synchronisiert.",
    });
    mhdState.showHUD("Gelöscht", "Der Posten wurde entfernt oder zur Löschung vorgemerkt.");
    resetScanState({ keepLearnOverlay: false });
  } catch (err) {
    console.error('[CharcuLogic Firebase] Posten löschen fehlgeschlagen:', err);
    mhdState.showHUD("Fehler", "Posten konnte nicht gelöscht werden.", "!");
  }
};

function showRecentReceipts() {
  const receipts = mhdState.products
    .filter((entry) => entry.source === 'wareneingang-app' || entry.postentyp === 'wareneingang')
    .sort((a, b) => String(b.wareneingangAt || b.createdAt || '').localeCompare(String(a.wareneingangAt || a.createdAt || '')))
    .slice(0, 12);
  showUtilityDialog('Letzte Eingänge', `
    <p class="learn-mode-desc">Zum Korrigieren oder Löschen von Test- und Fehleinträgen.</p>
    <div class="utility-list">
      ${receipts.length ? receipts.map((entry) => `
        <div class="utility-row">
          <div class="utility-row-title">${escapeHtml(entry.name || entry.produkt || 'Posten')}</div>
          <div class="utility-row-meta">Barcode: ${escapeHtml(entry.ean || entry.barcode || '-')} · MHD: ${escapeHtml(entry.mhd || entry.mhdDate || '-')} · Menge: ${escapeHtml(entry.qty ?? entry.menge ?? '-')}</div>
          <div class="utility-row-actions">
            <button class="btn-danger-small" data-mhd-utility-command="delete" data-mhd-id="${entry.id}">Löschen</button>
            <button class="btn-danger-small" data-mhd-utility-command="history" data-mhd-id="${entry.id}">Posten ansehen</button>
          </div>
        </div>
      `).join('') : '<div class="utility-row"><div class="utility-row-title">Keine Wareneingänge gefunden</div></div>'}
    </div>
  `);
}

function showMasterData() {
  const productMaster = readLocalMaster(PRODUCT_MASTER_STORAGE_KEY);
  const vpeMaster = readLocalMaster(VPE_MASTER_STORAGE_KEY);
  const samples = Object.values(productMaster).slice(0, 8);
  showUtilityDialog('Stammdaten', `
    <p class="learn-mode-desc">Lokale gelernte Stammdaten auf diesem Gerät plus geladene VPE-CSV.</p>
    <div class="utility-list">
      <div class="utility-row">
        <div class="utility-row-title">Übersicht</div>
        <div class="utility-row-meta">Gelernte Produkte: ${Object.keys(productMaster).length} · Gelernte VPEs: ${Object.keys(vpeMaster).length} · VPE-CSV: ${Object.keys(csvVpeMaster).length}</div>
      </div>
      ${samples.map((entry) => `
        <div class="utility-row">
          <div class="utility-row-title">${escapeHtml(entry.name || 'Produkt')}</div>
          <div class="utility-row-meta">Barcode: ${escapeHtml(entry.barcode || '-')} · ${escapeHtml(entry.brand || '')}</div>
        </div>
      `).join('')}
    </div>
  `);
}

document.getElementById('btn-recent-receipts')?.addEventListener('click', showRecentReceipts);
document.getElementById('btn-master-data')?.addEventListener('click', showMasterData);

// "Änderungen speichern" Button
const btnSaveMhd = document.getElementById('btn-save-mhd');
if (btnSaveMhd) {
  btnSaveMhd.addEventListener('click', () => {
    mhdState.playClickSound(900, 0.1, 0.2);
    if (isFirebaseReady()) {
      mhdState.showHUD("☁️ Cloud-Sync aktiv", "MHD-Bestände werden live in Firestore gespeichert.");
    } else {
      mhdState.showHUD("⚠️ Offline", "Firebase nicht konfiguriert – keine Cloud-Synchronisation.", "⚠️");
    }
  });
}



function bindMhdCardActions() {
  const container = document.getElementById('mhd-items-container');
  if (!container || container.dataset.mhdActionBound === '1') return;
  container.dataset.mhdActionBound = '1';
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mhd-command]');
    if (!button) return;
    const id = button.dataset.mhdId;
    const command = button.dataset.mhdCommand;
    if (command === 'adjust') adjustQty(id, Number(button.dataset.mhdChange || 0));
    if (command === 'soldout') setSoldOut(id);
    if (command === 'action') markMhdAction(id, button.dataset.mhdActionStatus);
  });
}
function bindUtilityDialogActions() {
  if (document.documentElement.dataset.mhdUtilityBound === '1') return;
  document.documentElement.dataset.mhdUtilityBound = '1';
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mhd-utility-command]');
    if (!button) return;
    const id = button.dataset.mhdId;
    if (button.dataset.mhdUtilityCommand === 'delete') deleteMhdPosten(id);
    if (button.dataset.mhdUtilityCommand === 'history') openPostenHistory(id);
  });
}

function isCameraBlockedForPwa() {
  return window.isCameraAvailable === false
    || typeof navigator === 'undefined'
    || !navigator.mediaDevices
    || typeof navigator.mediaDevices.getUserMedia !== 'function';
}

function ensureManualBarcodeFallback() {
  const scanButton = document.getElementById('btn-receiving-scan') || document.getElementById('btn-open-scanner');
  if (!scanButton || document.getElementById('mhd-manual-barcode-fallback')) return;

  const panel = document.createElement('div');
  panel.id = 'mhd-manual-barcode-fallback';
  panel.className = 'manual-barcode-fallback';
  panel.innerHTML = `
    <div class="manual-barcode-title">Manuelle Barcode-Eingabe</div>
    <div class="manual-barcode-row">
      <input type="text" id="manual-barcode-input" class="manual-barcode-input" placeholder="Barcode-Nummer eingeben..." inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      <button type="button" id="btn-manual-barcode-fallback-submit" class="btn btn-primary manual-barcode-submit">OK</button>
    </div>
  `;
  scanButton.insertAdjacentElement('afterend', panel);
  updateManualBarcodeFallback();
}

function updateManualBarcodeFallback() {
  const panel = document.getElementById('mhd-manual-barcode-fallback');
  if (!panel) return;
  panel.style.display = isCameraBlockedForPwa() ? 'block' : 'none';
}

function submitManualBarcodeFrom(inputEl) {
  const code = cleanScannedBarcode(inputEl?.value);
  if (!code) {
    setScannerStatus('Kein Barcode eingegeben.');
    inputEl?.focus();
    return;
  }
  renderReceivingStatus({ lastScan: code, status: 'Manuelle Eingabe' });
  processScannedBarcode(code, 'manual');
}

function mapWarenKategorieToMhdKategorie(warenKategorie) {
  const normalized = String(warenKategorie || '').trim().toLowerCase();
  switch (normalized) {
    case 'frische':
      return '🍎 Frische';
    case 'mopro':
      return '🥛MoPro';
    case 'kühlware':
    case 'kuehlware':
    case 'fremdfleisch':
    case 'geflügel zukauf':
    case 'gefluegel zukauf':
    case 'wurst zukauf':
      return '🥗 Kühlware';
    case 'tk':
      return '🧊 TK';
    case 'frischfleisch':
    case 'geflügel':
    case 'gefluegel':
      return '🥗 Kühlware';
    case 'brühwurst':
    case 'bruehwurst':
    case 'kochwurst':
      return '🥛MoPro';
    case 'trockenware':
    case 'gewürze':
    case 'gewuerze':
    case 'gewürze metzgerei':
    case 'gewuerze metzgerei':
      return '📦 Trockenware';
    default:
      return '📦 Trockenware';
  }
}

function mapMhdCategoryToHeadCategory(mhdCategory = '') {
  const normalized = normalizeMhdCategory(mhdCategory).toLowerCase();
  if (normalized.includes('trocken')) return 'Trockenware';
  if (normalized.includes('mopro')) return 'MoPro';
  if (normalized.includes('frische')) return 'Frische';
  if (normalized.includes('kühl') || normalized.includes('kuehl')) return 'Kühlware';
  if (normalized.includes('tk')) return 'TK';
  return 'Trockenware';
}

function deliveryCollectionPath() {
  const tenantId = requireMhdTenantId();
  return tenantId ? `tenants/${tenantId}/wareneingang_lieferungen` : null;
}

function createDeliveryId() {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `lieferung_${Date.now().toString(36)}_${randomPart}`;
}

function readDeliveryHeadValues() {
  const supplier = document.getElementById('we-supplier')?.value.trim() || '';
  const warenKategorie = document.getElementById('we-category-quick')?.value || 'Trockenware';
  const warenKategorieMetzgerei = document.getElementById('we-category')?.value || 'Fremdfleisch';
  const tempRaw = String(document.getElementById('we-temperature')?.value ?? '').trim();
  const temperatur = tempRaw === '' ? null : parseFloat(tempRaw.replace(',', '.'));
  return { supplier, warenKategorie, warenKategorieMetzgerei, temperatur };
}

function getReceivingQtyUnitFromCategory(warenKategorie = '') {
  const normalized = String(warenKategorie).trim().toLowerCase();
  if (
    normalized.includes('trocken')
    || normalized.includes('mopro')
    || normalized.includes('frische')
    || normalized.includes('kühl')
    || normalized.includes('kuehl')
    || normalized.includes('tk')
    || normalized.includes('gewürze')
    || normalized.includes('gewuerze')
    || normalized.includes('wurst zukauf')
  ) {
    return 'Stk';
  }
  return 'kg';
}

function updateReceivingQtyFieldUi() {
  const qtyInput = document.getElementById('we-qty');
  const qtyLabel = document.getElementById('we-qty-label');
  const categoryQuickSelect = document.getElementById('we-category-quick');
  const category = categoryQuickSelect?.value || 'Trockenware';
  const unit = getReceivingQtyUnitFromCategory(category);
  if (!qtyInput) return;

  if (qtyLabel) qtyLabel.textContent = `Menge (${unit})`;
  if (unit === 'Stk') {
    qtyInput.placeholder = 'Menge in Stk';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.inputMode = 'numeric';
    const current = parseFloat(String(qtyInput.value || '').replace(',', '.'));
    qtyInput.value = Number.isFinite(current) && current > 0 ? String(Math.max(1, Math.round(current))) : '1';
    return;
  }

  qtyInput.placeholder = 'Menge in kg';
  qtyInput.min = '0.1';
  qtyInput.step = '0.1';
  qtyInput.inputMode = 'decimal';
  if (!qtyInput.value || Number.parseFloat(String(qtyInput.value).replace(',', '.')) <= 0) {
    qtyInput.value = '1';
  }
}

function normalizeDeliveryHeadForFinalize(head) {
  if (head?.supplier) return head;
  const scannedBy = getActiveEmployee() || '';
  const fallbackSupplier = scannedBy ? `Direkterfassung (${scannedBy})` : 'Direkterfassung (ohne Lieferant)';
  return {
    ...head,
    supplier: fallbackSupplier,
  };
}

function readDeliveryItemDraftValues() {
  const barcode = cleanScannedBarcode(document.getElementById('we-ean')?.value || currentDeliveryItemBarcode);
  const manualName = document.getElementById('we-product-manual')?.value.trim() || '';
  const product = currentDeliveryItemProduct || manualName;
  const category = document.getElementById('we-category-quick')?.value || 'Trockenware';
  const qtyUnit = getReceivingQtyUnitFromCategory(category);
  const qtyRaw = parseFloat(String(document.getElementById('we-qty')?.value || '').replace(',', '.'));
  const qtyValue = qtyUnit === 'Stk' ? Math.round(qtyRaw) : qtyRaw;
  const mhdDate = document.getElementById('we-mhd')?.value || '';
  return { product, barcode, qtyValue, qtyUnit, mhdDate };
}

function openDeliveryDraftDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DELIVERY_DRAFT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DELIVERY_DRAFT_STORE)) {
        db.createObjectStore(DELIVERY_DRAFT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistDeliveryDraftToIndexedDB() {
  try {
    const db = await openDeliveryDraftDb();
    if (!db) return;
    const head = readDeliveryHeadValues();
    const payload = {
      head,
      items: currentDeliveryItems,
      photos: currentDeliveryPhotos,
      savedAt: new Date().toISOString(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DELIVERY_DRAFT_STORE, 'readwrite');
      tx.objectStore(DELIVERY_DRAFT_STORE).put(payload, DELIVERY_DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[CharcuLogic MHD] Lieferungs-Entwurf konnte nicht in IndexedDB gespeichert werden:', err);
  }
}

async function loadDeliveryDraftFromIndexedDB() {
  try {
    const db = await openDeliveryDraftDb();
    if (!db) return;
    const payload = await new Promise((resolve, reject) => {
      const tx = db.transaction(DELIVERY_DRAFT_STORE, 'readonly');
      const req = tx.objectStore(DELIVERY_DRAFT_STORE).get(DELIVERY_DRAFT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!payload) return;
    if (Array.isArray(payload.items)) currentDeliveryItems = payload.items;
    if (Array.isArray(payload.photos)) currentDeliveryPhotos = payload.photos;
    if (payload.head) {
      const supplierEl = document.getElementById('we-supplier');
      const categoryEl = document.getElementById('we-category');
      const categoryQuickEl = document.getElementById('we-category-quick');
      const tempEl = document.getElementById('we-temperature');
      if (supplierEl && payload.head.supplier) supplierEl.value = payload.head.supplier;
      if (categoryEl && payload.head.warenKategorieMetzgerei) categoryEl.value = payload.head.warenKategorieMetzgerei;
      if (categoryQuickEl && payload.head.warenKategorie) categoryQuickEl.value = payload.head.warenKategorie;
      if (tempEl && payload.head.temperatur != null && !Number.isNaN(payload.head.temperatur)) {
        tempEl.value = String(payload.head.temperatur);
      }
    }
    renderDeliveryPhotoPreviews();
    renderDeliveryItemsTable();
    updateReceivingSaveButtonState();
  } catch (err) {
    console.warn('[CharcuLogic MHD] Lieferungs-Entwurf konnte nicht aus IndexedDB geladen werden:', err);
  }
}

async function clearDeliveryDraftFromIndexedDB() {
  try {
    const db = await openDeliveryDraftDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DELIVERY_DRAFT_STORE, 'readwrite');
      tx.objectStore(DELIVERY_DRAFT_STORE).delete(DELIVERY_DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[CharcuLogic MHD] Lieferungs-Entwurf konnte nicht aus IndexedDB gelöscht werden:', err);
  }
}

async function compressImageFileToDataUrl(file, maxWidth = 1200, quality = 0.72) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / (img.width || maxWidth));
      const width = Math.max(1, Math.round((img.width || maxWidth) * scale));
      const height = Math.max(1, Math.round((img.height || maxWidth) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function renderDeliveryPhotoPreviews() {
  const container = document.getElementById('we-photo-previews');
  if (!container) return;
  if (!currentDeliveryPhotos.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = currentDeliveryPhotos.map((photo) => `
    <div class="we-photo-thumb" data-photo-id="${escapeHtml(photo.id)}">
      <img src="${photo.dataUrl}" alt="Lieferschein">
      <button type="button" class="we-photo-thumb-remove" data-photo-remove="${escapeHtml(photo.id)}" aria-label="Foto entfernen">×</button>
    </div>
  `).join('');
}

function renderDeliveryItemsTable() {
  const table = document.getElementById('we-current-items-table');
  const countEl = document.getElementById('receiving-item-count');
  if (countEl) countEl.textContent = String(currentDeliveryItems.length);
  if (!table) return;
  if (!currentDeliveryItems.length) {
    table.innerHTML = '<div class="we-items-table-empty">Noch keine Posten in dieser Lieferung.</div>';
    return;
  }
  table.innerHTML = currentDeliveryItems.map((item) => `
    <div class="we-item-row" data-item-id="${escapeHtml(item.id)}">
      <div class="we-item-row-main">
        <div class="we-item-row-name">${escapeHtml(item.product)}</div>
        <div class="we-item-row-meta">${item.qtyValue ?? item.qtyKg} ${(item.qtyUnit || 'kg')} · MHD ${escapeHtml(formatMhdLabel(item.mhdDate))}${item.barcode ? ` · EAN ${escapeHtml(item.barcode)}` : ''}</div>
      </div>
      <button type="button" class="we-item-row-remove" data-item-remove="${escapeHtml(item.id)}" aria-label="Posten entfernen">×</button>
    </div>
  `).join('');
}

function formatMhdLabel(mhdDate) {
  if (!mhdDate) return '–';
  const parsed = new Date(`${mhdDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? mhdDate : parsed.toLocaleDateString('de-DE');
}

function clearDeliveryItemFields() {
  currentDeliveryItemBarcode = '';
  currentDeliveryItemProduct = '';
  const eanEl = document.getElementById('we-ean');
  const manualEl = document.getElementById('we-product-manual');
  const qtyEl = document.getElementById('we-qty');
  const mhdEl = document.getElementById('we-mhd');
  if (eanEl) eanEl.value = '';
  if (manualEl) manualEl.value = '';
  if (qtyEl) qtyEl.value = '1';
  if (mhdEl) mhdEl.value = new Date().toISOString().slice(0, 10);
  updateDeliveryItemProductUi();
}

function addDeliveryItem() {
  const { product, barcode, qtyValue, qtyUnit, mhdDate } = readDeliveryItemDraftValues();
  if (!barcode) {
    mhdState.showHUD('EAN fehlt', 'Bitte Barcode scannen oder EAN eintippen.', '!');
    document.getElementById('we-ean')?.focus();
    return;
  }
  if (!product) {
    mhdState.showHUD('Produkt fehlt', 'EAN unbekannt – bitte Produktname eintragen.', '!');
    document.getElementById('we-product-manual')?.focus();
    return;
  }
  if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
    mhdState.showHUD('Menge ungültig', `Bitte eine Menge in ${qtyUnit} größer 0 eingeben.`, '!');
    document.getElementById('we-qty')?.focus();
    return;
  }
  if (!mhdDate) {
    mhdState.showHUD('MHD fehlt', 'Bitte ein MHD-Datum wählen.', '!');
    document.getElementById('we-mhd')?.focus();
    return;
  }

  const itemId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  currentDeliveryItems.push({
    id: itemId,
    product,
    barcode,
    qtyValue: qtyUnit === 'Stk' ? Math.max(1, Math.round(qtyValue)) : Math.round(qtyValue * 100) / 100,
    qtyUnit,
    // Legacy-Feld fuer bestehende Auswertungen weiter mitschreiben.
    qtyKg: qtyUnit === 'Stk' ? Math.max(1, Math.round(qtyValue)) : Math.round(qtyValue * 100) / 100,
    mhdDate,
  });

  clearDeliveryItemFields();
  renderDeliveryItemsTable();
  updateReceivingSaveButtonState();
  persistDeliveryDraftToIndexedDB();
  mhdState.playClickSound(1200, 0.05, 0.12);
  window.showToast?.('Posten zur Lieferung hinzugefügt.', 'success');
}

function removeDeliveryItem(itemId) {
  currentDeliveryItems = currentDeliveryItems.filter((item) => item.id !== itemId);
  renderDeliveryItemsTable();
  updateReceivingSaveButtonState();
  persistDeliveryDraftToIndexedDB();
}

function removeDeliveryPhoto(photoId) {
  currentDeliveryPhotos = currentDeliveryPhotos.filter((photo) => photo.id !== photoId);
  renderDeliveryPhotoPreviews();
  updateReceivingSaveButtonState();
  persistDeliveryDraftToIndexedDB();
}

async function handleDeliveryPhotoSelection(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  for (const file of files) {
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      const photoId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      currentDeliveryPhotos.push({
        id: photoId,
        name: file.name || 'lieferschein.jpg',
        dataUrl,
      });
    } catch (err) {
      console.warn('[CharcuLogic MHD] Lieferschein-Foto konnte nicht verarbeitet werden:', err);
    }
  }

  renderDeliveryPhotoPreviews();
  updateReceivingSaveButtonState();
  persistDeliveryDraftToIndexedDB();
  window.showToast?.(`${files.length} Lieferschein-Foto(s) hinzugefügt.`, 'success');
}

function buildMhdRecordFromDeliveryItem(item, head, deliveryId, recordStatus, meisterOverrideReason) {
  const erfassungsDatum = new Date().toISOString();
  const mhdKategorie = mapWarenKategorieToMhdKategorie(head.warenKategorie);
  const barcode = cleanScannedBarcode(item.barcode)
    || `delivery_${deliveryId}_${item.id}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 48);
  const mhdTime = new Date(`${item.mhdDate}T00:00:00`);
  const todayTime = new Date();
  todayTime.setHours(0, 0, 0, 0);
  const tage = Number.isNaN(mhdTime.getTime())
    ? null
    : Math.ceil((mhdTime.getTime() - todayTime.getTime()) / 86400000);
  const qtyUnit = item.qtyUnit || getReceivingQtyUnitFromCategory(head.warenKategorie);
  const qtyValueRaw = Number(item.qtyValue ?? item.qtyKg ?? 0);
  const qtyValue = qtyUnit === 'Stk'
    ? Math.max(1, Math.round(qtyValueRaw))
    : Math.round(qtyValueRaw * 100) / 100;
  const qtyInt = qtyUnit === 'Stk' ? qtyValue : Math.max(1, Math.round(qtyValue));
  const postenId = createReceivingPostenId(barcode, item.mhdDate);

  const record = {
    id: postenId,
    postenId,
    ean: barcode,
    barcode,
    scanBarcode: barcode,
    produkt: item.product,
    name: item.product,
    marke: head.supplier,
    brand: head.supplier,
    lieferant: head.supplier,
    mhd: item.mhdDate,
    mhdDate: item.mhdDate,
    mhdText: Number.isFinite(tage) ? `${tage} Resttage` : 'Wareneingang',
    mhdTimestamp: Number.isNaN(mhdTime.getTime()) ? null : mhdTime,
    date: mhdDateToDisplay(item.mhdDate),
    tage,
    resttage: tage,
    status: recordStatus,
    qty: qtyInt,
    menge: qtyValue,
    eingangMenge: qtyValue,
    mengeEinheit: qtyUnit,
    einheit: qtyUnit,
    warenKategorie: head.warenKategorie,
    kategorie: mhdKategorie,
    lieferungId: deliveryId,
    soldOut: false,
    source: 'wareneingang-app',
    postentyp: 'wareneingang',
    wareneingangAt: erfassungsDatum,
    erfassungsDatum,
    scannedBy: getActiveEmployee() || '',
    tenantId: mhdState.tenantId,
    updatedAt: serverTimestampFallback(),
    createdAt: serverTimestampFallback(),
  };

  if (head.temperatur != null && !Number.isNaN(head.temperatur)) {
    record.temperatur = head.temperatur;
  }
  if (meisterOverrideReason) {
    record.meisterOverrideReason = meisterOverrideReason;
  }
  return record;
}

function mapDeliveryDraftDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
  };
}

function formatDraftTimestamp(iso) {
  if (!iso) return '–';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString('de-DE');
}

function clearActiveDraftEditing() {
  activeEditingDraftId = null;
  const banner = document.getElementById('we-editing-draft-banner');
  const saveBtn = document.getElementById('we-save-delivery-btn');
  if (banner) {
    banner.textContent = '';
    banner.classList.add('hidden');
  }
  if (saveBtn) saveBtn.textContent = DEFAULT_FINALIZE_LABEL;
}

function updateDraftEditingBanner() {
  const banner = document.getElementById('we-editing-draft-banner');
  if (!banner) return;
  if (!activeEditingDraftId) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  const draft = pendingDeliveryDrafts.find((entry) => entry.id === activeEditingDraftId);
  banner.textContent = draft
    ? `Büro-Modus: Entwurf von ${draft.lieferant} wird nachbearbeitet.`
    : 'Büro-Modus: Entwurf wird nachbearbeitet.';
  banner.classList.remove('hidden');
}

async function applyDeliveryTemperatureGuard(head) {
  const tempRelevantCategory = String(head.warenKategorieMetzgerei || head.warenKategorie || '').toLowerCase();
  const isDryGoods = tempRelevantCategory.includes('trocken')
    || tempRelevantCategory.includes('gewürze')
    || tempRelevantCategory.includes('gewuerze');
  if (!isDryGoods && (head.temperatur === null || Number.isNaN(head.temperatur))) {
    mhdState.showHUD('Temperatur fehlt', 'Bei dieser Waren-Kategorie ist die Temperatur Pflicht.', '!');
    document.getElementById('we-temperature')?.focus();
    return null;
  }

  let mhdItemStatus = 'aktiv';
  let meisterOverrideReason = '';

  if (!isDryGoods && head.temperatur > HACCP_TEMP_LIMIT_C) {
    const override = await showMeisterOverrideModal(head.temperatur);
    if (!override.approved) return null;
    mhdItemStatus = 'APPROVED_WITH_OVERRIDE';
    meisterOverrideReason = override.reason;
  }

  return { mhdItemStatus, meisterOverrideReason };
}

function buildDeliveryBundlePayload(head, {
  deliveryId,
  erfassungsDatum,
  status,
  meisterOverrideReason = '',
  includeItems = true,
}) {
  const bundle = {
    id: deliveryId,
    lieferant: head.supplier,
    warenKategorie: head.warenKategorie,
    temperatur: head.temperatur,
    erfassungsDatum,
    status,
    fotos: currentDeliveryPhotos.map((photo) => photo.dataUrl),
    items: includeItems
      ? currentDeliveryItems.map((item) => ({
        id: item.id,
        product: item.product,
        qtyValue: item.qtyValue ?? item.qtyKg,
        qtyUnit: item.qtyUnit || getReceivingQtyUnitFromCategory(head.warenKategorie),
        qtyKg: item.qtyKg,
        mhdDate: item.mhdDate,
      }))
      : [],
    itemCount: includeItems ? currentDeliveryItems.length : 0,
    source: 'wareneingang-lieferung',
    scannedBy: getActiveEmployee() || '',
    tenantId: mhdState.tenantId,
    updatedAt: serverTimestampFallback(),
    createdAt: serverTimestampFallback(),
  };

  if (meisterOverrideReason) {
    bundle.meisterOverrideReason = meisterOverrideReason;
  }
  if (head.temperatur === null || Number.isNaN(head.temperatur)) {
    delete bundle.temperatur;
  }
  return bundle;
}

function renderOpenDraftsSection() {
  const list = document.getElementById('open-drafts-list');
  if (!list) return;

  if (!pendingDeliveryDrafts.length) {
    list.innerHTML = '<div class="open-drafts-empty">Keine offenen Entwürfe – alles nachgetragen.</div>';
    return;
  }

  list.innerHTML = pendingDeliveryDrafts.map((draft) => {
    const photoCount = Array.isArray(draft.fotos) ? draft.fotos.length : 0;
    return `
      <button type="button" class="open-draft-card" data-draft-id="${escapeHtml(draft.id)}">
        <div class="open-draft-card-title">${escapeHtml(draft.lieferant || 'Unbekannter Lieferant')}</div>
        <div class="open-draft-card-meta">
          ${escapeHtml(draft.warenKategorie || '–')} · ${photoCount} Foto(s) · ${formatDraftTimestamp(draft.erfassungsDatum)}
        </div>
      </button>
    `;
  }).join('');
}

function subscribeToPendingDeliveryDrafts() {
  if (!mhdState.db || !deliveryCollectionPath()) return;
  if (deliveryDraftsUnsubscribe) {
    deliveryDraftsUnsubscribe();
    deliveryDraftsUnsubscribe = null;
  }

  deliveryDraftsUnsubscribe = mhdState.db
    .collection(deliveryCollectionPath())
    .where('status', '==', DELIVERY_STATUS_DRAFT)
    .onSnapshot(
      (snapshot) => {
        pendingDeliveryDrafts = snapshot.docs
          .map(mapDeliveryDraftDoc)
          .sort((a, b) => String(b.erfassungsDatum || '').localeCompare(String(a.erfassungsDatum || '')));
        renderOpenDraftsSection();
        updateDraftEditingBanner();
      },
      (err) => {
        console.error('[CharcuLogic MHD] Offene Lieferungs-Entwürfe konnten nicht geladen werden:', err);
      }
    );
}

function loadDraftPhotosFromBundle(fotos = []) {
  currentDeliveryPhotos = (Array.isArray(fotos) ? fotos : []).map((dataUrl, index) => ({
    id: `draft_photo_${index}_${Date.now().toString(36)}`,
    name: `lieferschein-${index + 1}.jpg`,
    dataUrl,
  }));
  renderDeliveryPhotoPreviews();
}

function openDraftForEditing(draft) {
  if (!draft?.id) return;

  activeEditingDraftId = draft.id;
  currentDeliveryItems = [];

  const supplierEl = document.getElementById('we-supplier');
  const categoryEl = document.getElementById('we-category');
  const categoryQuickEl = document.getElementById('we-category-quick');
  const tempEl = document.getElementById('we-temperature');
  if (supplierEl) supplierEl.value = draft.lieferant || '';
  if (categoryEl) categoryEl.value = draft.warenKategorieMetzgerei || 'Fremdfleisch';
  if (categoryQuickEl) categoryQuickEl.value = draft.warenKategorie || 'Trockenware';
  if (tempEl && draft.temperatur != null && !Number.isNaN(draft.temperatur)) {
    tempEl.value = String(draft.temperatur);
  } else if (tempEl) {
    tempEl.value = '';
  }

  loadDraftPhotosFromBundle(draft.fotos);
  renderDeliveryItemsTable();
  updateReceivingSaveButtonState();
  updateDraftEditingBanner();

  const saveBtn = document.getElementById('we-save-delivery-btn');
  if (saveBtn) saveBtn.textContent = DRAFT_FINALIZE_LABEL;

  setReceivingMode('schnell');
  document.getElementById('page-receiving')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelector('.receiving-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.showToast?.('Entwurf geladen – Posten jetzt anhand der Fotos erfassen.', 'success');
}

async function saveDeliveryDraft() {
  const head = readDeliveryHeadValues();
  const draftBtn = document.getElementById('we-save-draft-btn');

  if (activeEditingDraftId) {
    window.showToast?.('Entwurf wird bereits bearbeitet. Bitte zuerst abschließen oder abbrechen.', 'warning');
    return;
  }

  if (!head.supplier) {
    setReceivingMode('metzgerei');
    mhdState.showHUD('Lieferant fehlt', 'Bitte den Lieferanten unter Metzgerei erfassen.', '!');
    document.getElementById('we-supplier')?.focus();
    return;
  }
  if (!currentDeliveryPhotos.length) {
    setReceivingMode('metzgerei');
    mhdState.showHUD('Foto fehlt', 'Mindestens ein Lieferschein-Foto ist für den Entwurf Pflicht.', '!');
    document.getElementById('we-photo-btn')?.focus();
    return;
  }

  const tempGuard = await applyDeliveryTemperatureGuard(head);
  if (!tempGuard) return;

  const erfassungsDatum = new Date().toISOString();
  const deliveryId = createDeliveryId();
  const deliveryBundle = buildDeliveryBundlePayload(head, {
    deliveryId,
    erfassungsDatum,
    status: DELIVERY_STATUS_DRAFT,
    meisterOverrideReason: tempGuard.meisterOverrideReason,
    includeItems: false,
  });

  const queuedBundle = {
    ...deliveryBundle,
    createdAt: erfassungsDatum,
    updatedAt: erfassungsDatum,
  };

  try {
    if (draftBtn) {
      draftBtn.disabled = true;
      draftBtn.textContent = 'Speichere Entwurf...';
    }

    await mhdState.writeOrQueueFirestore({
      collectionPath: deliveryCollectionPath(),
      docId: deliveryId,
      op: 'set',
      onlineData: deliveryBundle,
      queueData: queuedBundle,
      offlineMessage: 'Lieferungs-Entwurf wird nachträglich synchronisiert.',
    });

    mhdState.playClickSound(1100, 0.06, 0.14);
    resetReceivingForm();
    renderReceivingStatus({ status: 'Entwurf für Büro gesichert' });
    window.showToast?.('Entwurf erfolgreich für das Büro gesichert!', 'success');
  } catch (err) {
    console.error('[CharcuLogic MHD] Lieferungs-Entwurf speichern fehlgeschlagen:', err);
    mhdState.showHUD('Fehler', 'Entwurf konnte nicht gespeichert werden.', '!');
    window.showToast?.('Entwurf konnte nicht gespeichert werden.', 'error');
  } finally {
    if (draftBtn) {
      draftBtn.textContent = '📝 Als offenen Entwurf speichern';
      updateReceivingSaveButtonState();
    }
  }
}

function resetReceivingForm() {
  const today = new Date().toISOString().slice(0, 10);
  currentDeliveryItems = [];
  currentDeliveryPhotos = [];
  clearActiveDraftEditing();

  const defaults = {
    'we-ean': '',
    'we-product-manual': '',
    'we-qty': '1',
    'we-mhd': today,
    'we-supplier': '',
    'we-category': 'Fremdfleisch',
    'we-category-quick': 'Trockenware',
    'we-temperature': '',
  };
  Object.entries(defaults).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  const photoInput = document.getElementById('we-photo-input');
  if (photoInput) photoInput.value = '';

  clearDeliveryItemFields();
  renderDeliveryPhotoPreviews();
  renderDeliveryItemsTable();
  updateReceivingSaveButtonState();
  clearDeliveryDraftFromIndexedDB();
  mhdState.onFormSaved?.(RECEIVING_FORM_IDS);
}

function showMeisterOverrideModal(temperature) {
  return new Promise((resolve) => {
    const modal = document.getElementById('meister-override-modal');
    const desc = document.getElementById('meister-override-desc');
    const reasonInput = document.getElementById('meister-override-reason');
    const dotsContainer = document.getElementById('meister-override-pin-dots');
    const numpad = document.getElementById('meister-override-numpad');
    if (!modal) {
      resolve({ approved: false });
      return;
    }

    let enteredPin = '';
    const dots = dotsContainer ? Array.from(dotsContainer.querySelectorAll('.pin-dot')) : [];
    const updateDots = () => {
      dots.forEach((dot, index) => dot.classList.toggle('filled', index < enteredPin.length));
    };

    if (desc) {
      desc.textContent = `Gemessene Temperatur: ${temperature} °C liegt über ${HACCP_TEMP_LIMIT_C} °C. Meister-Freigabe mit PIN und Begründung erforderlich.`;
    }
    if (reasonInput) reasonInput.value = '';

    const close = (result) => {
      numpad?.removeEventListener('click', onNumpadClick);
      modal.classList.remove('is-open');
      modal.hidden = true;
      enteredPin = '';
      updateDots();
      resolve(result);
    };

    const onNumpadClick = (event) => {
      const key = event.target.closest('[data-meister-pin]')?.dataset.meisterPin;
      if (!key) return;
      if (key === 'cancel') {
        close({ approved: false });
        return;
      }
      if (key === 'delete') {
        enteredPin = enteredPin.slice(0, -1);
        updateDots();
        return;
      }
      if (!/^\d$/.test(key) || enteredPin.length >= 4) return;
      enteredPin += key;
      updateDots();
      if (enteredPin.length !== 4) return;

      const meisterName = MEISTER_OVERRIDE_PINS[enteredPin];
      if (!meisterName) {
        window.showToast?.('Falsche Meister-PIN. Bitte erneut versuchen.', 'error');
        enteredPin = '';
        updateDots();
        dotsContainer?.classList.add('shake');
        setTimeout(() => dotsContainer?.classList.remove('shake'), 260);
        return;
      }

      const reason = reasonInput?.value.trim() || '';
      if (!reason) {
        window.showToast?.('Bitte eine Begründung für die Freigabe eingeben.', 'warning');
        reasonInput?.focus();
        enteredPin = '';
        updateDots();
        return;
      }

      close({ approved: true, reason, meisterName });
    };

    modal.hidden = false;
    modal.classList.add('is-open');
    updateDots();
    reasonInput?.focus();
    numpad?.addEventListener('click', onNumpadClick);
  });
}

async function finalizeDelivery() {
  const rawHead = readDeliveryHeadValues();
  const saveBtn = document.getElementById('we-save-delivery-btn');
  const isDraftCompletion = Boolean(activeEditingDraftId);

  if (!currentDeliveryItems.length) {
    setReceivingMode('schnell');
    mhdState.showHUD('Keine Posten', 'Bitte mindestens einen Waren-Posten unter Schnellerfassung hinzufügen.', '!');
    return;
  }
  const head = normalizeDeliveryHeadForFinalize(rawHead);
  if (!rawHead.supplier) {
    window.showToast?.('Lieferant fehlte - Lieferung wurde als Direkterfassung gespeichert.', 'warning');
  }

  const tempGuard = await applyDeliveryTemperatureGuard(head);
  if (!tempGuard) return;

  const { mhdItemStatus, meisterOverrideReason } = tempGuard;
  const existingDraft = isDraftCompletion
    ? pendingDeliveryDrafts.find((entry) => entry.id === activeEditingDraftId)
    : null;
  const erfassungsDatum = existingDraft?.erfassungsDatum || new Date().toISOString();
  const completedAt = new Date().toISOString();
  const deliveryId = isDraftCompletion ? activeEditingDraftId : createDeliveryId();

  const deliveryBundle = buildDeliveryBundlePayload(head, {
    deliveryId,
    erfassungsDatum,
    status: DELIVERY_STATUS_COMPLETED,
    meisterOverrideReason,
    includeItems: true,
  });
  deliveryBundle.completedAt = completedAt;
  deliveryBundle.createdAt = existingDraft?.createdAt || serverTimestampFallback();

  const queuedBundle = {
    ...deliveryBundle,
    createdAt: existingDraft?.createdAt || erfassungsDatum,
    updatedAt: completedAt,
  };

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = isDraftCompletion ? 'Schließe Lieferung ab...' : 'Speichere Lieferung...';
    }

    await mhdState.writeOrQueueFirestore({
      collectionPath: deliveryCollectionPath(),
      docId: deliveryId,
      op: 'set',
      onlineData: deliveryBundle,
      queueData: queuedBundle,
      offlineMessage: 'Lieferung wird nachträglich synchronisiert.',
    });

    const mhdWrites = currentDeliveryItems.map(async (item) => {
      const record = buildMhdRecordFromDeliveryItem(item, head, deliveryId, mhdItemStatus, meisterOverrideReason);
      const queuedRecord = {
        ...record,
        updatedAt: completedAt,
        createdAt: completedAt,
      };
      await mhdState.writeOrQueueFirestore({
        collectionPath: mhdCollectionPath(),
        docId: record.id,
        op: 'set',
        onlineData: record,
        queueData: queuedRecord,
        offlineMessage: 'MHD-Posten wird nachträglich synchronisiert.',
      });
      saveProductMaster(record);
    });

    await Promise.allSettled(mhdWrites);

    mhdState.playClickSound(1300, 0.08, 0.2);
    resetReceivingForm();
    renderReceivingStatus({ status: `Lieferung mit ${deliveryBundle.itemCount} Posten gebucht` });
    window.showToast?.('Gesamte Lieferung erfolgreich gebucht!', 'success');
  } catch (err) {
    console.error('[CharcuLogic MHD] Lieferung abschließen fehlgeschlagen:', err);
    mhdState.showHUD('Fehler', 'Lieferung konnte nicht gespeichert werden.', '!');
    window.showToast?.('Speichern fehlgeschlagen. Bitte erneut versuchen.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.textContent = activeEditingDraftId ? DRAFT_FINALIZE_LABEL : DEFAULT_FINALIZE_LABEL;
      updateReceivingSaveButtonState();
    }
  }
}

async function saveManualReceiving() {
  return finalizeDelivery();
}

function mhdDateToDisplay(mhdDate) {
  if (!mhdDate) return new Date().toLocaleDateString('de-DE');
  const parsed = new Date(`${mhdDate}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toLocaleDateString('de-DE') : parsed.toLocaleDateString('de-DE');
}

function ensureReceivingFormDefaults() {
  const mhdInput = document.getElementById('we-mhd');
  if (mhdInput && !mhdInput.value) {
    mhdInput.value = new Date().toISOString().slice(0, 10);
  }
}

function updateReceivingSaveButtonState() {
  const supplierInput = document.getElementById('we-supplier');
  const saveBtn = document.getElementById('we-save-delivery-btn');
  const draftBtn = document.getElementById('we-save-draft-btn');
  const countEl = document.getElementById('receiving-item-count');
  if (countEl) countEl.textContent = String(currentDeliveryItems.length);
  updateReceivingQtyFieldUi();

  const hasSupplier = Boolean(supplierInput?.value?.trim());
  const hasItems = currentDeliveryItems.length > 0;
  const hasPhotos = currentDeliveryPhotos.length > 0;

  if (saveBtn) {
    const canFinalize = hasItems;
    saveBtn.disabled = !canFinalize;
    saveBtn.setAttribute('aria-disabled', canFinalize ? 'false' : 'true');
    if (activeEditingDraftId) {
      saveBtn.textContent = DRAFT_FINALIZE_LABEL;
    } else if (saveBtn.textContent !== 'Speichere Lieferung...' && saveBtn.textContent !== 'Schließe Lieferung ab...') {
      saveBtn.textContent = DEFAULT_FINALIZE_LABEL;
    }
  }

  if (draftBtn) {
    const canDraft = hasSupplier && hasPhotos && !activeEditingDraftId;
    draftBtn.disabled = !canDraft;
    draftBtn.setAttribute('aria-disabled', canDraft ? 'false' : 'true');
  }
}

function setReceivingMode(mode) {
  const normalized = mode === 'metzgerei' ? 'metzgerei' : 'schnell';
  const panels = {
    schnell: document.getElementById('receiving-panel-schnell'),
    metzgerei: document.getElementById('receiving-panel-metzgerei'),
  };
  Object.entries(panels).forEach(([key, panel]) => {
    if (!panel) return;
    const visible = key === normalized;
    panel.classList.toggle('hidden', !visible);
    panel.hidden = !visible;
  });
  document.querySelectorAll('.receiving-mode-tab').forEach((tab) => {
    const active = tab.dataset.receivingMode === normalized;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function bindReceivingModeSwitch() {
  const switcher = document.querySelector('.receiving-mode-switch');
  if (!switcher || switcher.dataset.mhdBound === '1') return;
  switcher.dataset.mhdBound = '1';
  switcher.addEventListener('click', (event) => {
    const tab = event.target.closest('.receiving-mode-tab');
    if (!tab?.dataset.receivingMode) return;
    setReceivingMode(tab.dataset.receivingMode);
    mhdState.playClickSound(900, 0.04, 0.12);
  });
  setReceivingMode('schnell');
}

function bindReceivingControls() {
  ensureManualBarcodeFallback();
  ensureReceivingFormDefaults();
  bindReceivingModeSwitch();
  const btnEanApply = document.getElementById('we-ean-apply');
  const eanInput = document.getElementById('we-ean');
  if (btnEanApply && btnEanApply.dataset.mhdBound !== '1') {
    btnEanApply.dataset.mhdBound = '1';
    btnEanApply.addEventListener('click', () => applyBarcodeToDeliveryItemDraft(eanInput?.value || ''));
  }
  if (eanInput && eanInput.dataset.mhdBound !== '1') {
    eanInput.dataset.mhdBound = '1';
    eanInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyBarcodeToDeliveryItemDraft(eanInput.value);
      }
    });
  }
  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const btnReceivingScan = document.getElementById('btn-receiving-scan');
  const categoryQuickSelect = document.getElementById('we-category-quick');
  const btnSaveDelivery = document.getElementById('we-save-delivery-btn');
  const btnSaveDraft = document.getElementById('we-save-draft-btn');
  const btnEigenproduktion = document.getElementById('we-eigenproduktion-btn');
  const openDraftsList = document.getElementById('open-drafts-list');
  const btnAddItem = document.getElementById('we-add-item-btn');
  const btnPhoto = document.getElementById('we-photo-btn');
  const photoInput = document.getElementById('we-photo-input');
  const photoPreviews = document.getElementById('we-photo-previews');
  const itemsTable = document.getElementById('we-current-items-table');
  const btnCloseScanner = document.getElementById('close-scanner-btn');
  const btnManualBarcode = document.getElementById('btn-manual-barcode');
  const btnManualBarcodeSubmit = document.getElementById('btn-manual-barcode-submit');
  const manualBarcodeInput = document.getElementById('scanner-manual-barcode-input');
  const fallbackManualBarcodeInput = document.getElementById('manual-barcode-input');
  const btnFallbackManualBarcodeSubmit = document.getElementById('btn-manual-barcode-fallback-submit');
  const scannerManualEntry = document.getElementById('scanner-manual-entry');
  const openScannerOrFallback = async () => {
    updateManualBarcodeFallback();
    if (isCameraBlockedForPwa()) {
      setScannerStatus('Kamera nicht verfuegbar. Barcode manuell eintippen.');
      fallbackManualBarcodeInput?.focus();
      return;
    }
    try {
      await mhdState.openScanner();
    } catch (err) {
      window.isCameraAvailable = false;
      console.warn('[CharcuLogic Scanner] Kamera-Start im MHD-Modul abgefangen:', err);
      updateManualBarcodeFallback();
      fallbackManualBarcodeInput?.focus();
    }
  };
  updateReceivingSaveButtonState();
  if (categoryQuickSelect && categoryQuickSelect.dataset.mhdBound !== '1') {
    categoryQuickSelect.dataset.mhdBound = '1';
    categoryQuickSelect.value = categoryQuickSelect.value || 'Trockenware';
    categoryQuickSelect.addEventListener('change', updateReceivingSaveButtonState);
  }
  RECEIVING_FORM_IDS.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (!field || field.dataset.mhdBound === '1') return;
    field.dataset.mhdBound = '1';
    field.addEventListener('input', updateReceivingSaveButtonState);
    field.addEventListener('change', updateReceivingSaveButtonState);
  });
  if (btnOpenScanner && btnOpenScanner.dataset.mhdBound !== '1') { btnOpenScanner.dataset.mhdBound = '1'; btnOpenScanner.addEventListener('click', openScannerOrFallback); }
  if (btnReceivingScan && btnReceivingScan.dataset.mhdBound !== '1') { btnReceivingScan.dataset.mhdBound = '1'; btnReceivingScan.addEventListener('click', openScannerOrFallback); }
  if (btnAddItem && btnAddItem.dataset.mhdBound !== '1') {
    btnAddItem.dataset.mhdBound = '1';
    btnAddItem.addEventListener('click', () => addDeliveryItem());
  }
  if (btnPhoto && photoInput && btnPhoto.dataset.mhdBound !== '1') {
    btnPhoto.dataset.mhdBound = '1';
    btnPhoto.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      handleDeliveryPhotoSelection(photoInput.files);
      photoInput.value = '';
    });
  }
  if (photoPreviews && photoPreviews.dataset.mhdBound !== '1') {
    photoPreviews.dataset.mhdBound = '1';
    photoPreviews.addEventListener('click', (event) => {
      const photoId = event.target.closest('[data-photo-remove]')?.dataset.photoRemove;
      if (photoId) removeDeliveryPhoto(photoId);
    });
  }
  if (itemsTable && itemsTable.dataset.mhdBound !== '1') {
    itemsTable.dataset.mhdBound = '1';
    itemsTable.addEventListener('click', (event) => {
      const itemId = event.target.closest('[data-item-remove]')?.dataset.itemRemove;
      if (itemId) removeDeliveryItem(itemId);
    });
  }
  if (btnSaveDelivery && btnSaveDelivery.dataset.mhdBound !== '1') {
    btnSaveDelivery.dataset.mhdBound = '1';
    btnSaveDelivery.addEventListener('click', () => finalizeDelivery());
  }
  if (btnSaveDraft && btnSaveDraft.dataset.mhdBound !== '1') {
    btnSaveDraft.dataset.mhdBound = '1';
    btnSaveDraft.addEventListener('click', () => saveDeliveryDraft());
  }
  if (btnEigenproduktion && btnEigenproduktion.dataset.mhdBound !== '1') {
    btnEigenproduktion.dataset.mhdBound = '1';
    btnEigenproduktion.addEventListener('click', () => {
      const supplierEl = document.getElementById('we-supplier');
      if (supplierEl) supplierEl.value = EIGENPRODUKTION_SUPPLIER;
      updateReceivingSaveButtonState();
      window.showToast?.('Lieferant: Eigene Produktion', 'success');
    });
  }
  if (openDraftsList && openDraftsList.dataset.mhdBound !== '1') {
    openDraftsList.dataset.mhdBound = '1';
    openDraftsList.addEventListener('click', (event) => {
      const draftId = event.target.closest('[data-draft-id]')?.dataset.draftId;
      if (!draftId) return;
      const draft = pendingDeliveryDrafts.find((entry) => entry.id === draftId);
      if (draft) openDraftForEditing(draft);
    });
  }
  if (btnCloseScanner && btnCloseScanner.dataset.mhdBound !== '1') { btnCloseScanner.dataset.mhdBound = '1'; btnCloseScanner.addEventListener('click', () => mhdState.closeScanner()); }
  if (btnManualBarcode && btnManualBarcode.dataset.mhdBound !== '1') {
    btnManualBarcode.dataset.mhdBound = '1';
    btnManualBarcode.addEventListener('click', () => {
      scannerManualEntry?.classList.add('is-open');
      btnManualBarcode.classList.add('hidden');
      setScannerStatus('Barcode eingeben und OK tippen.');
      manualBarcodeInput?.focus();
    });
  }
  const submitManualBarcode = () => submitManualBarcodeFrom(manualBarcodeInput);
  const submitFallbackManualBarcode = () => submitManualBarcodeFrom(fallbackManualBarcodeInput);
  if (btnManualBarcodeSubmit && btnManualBarcodeSubmit.dataset.mhdBound !== '1') { btnManualBarcodeSubmit.dataset.mhdBound = '1'; btnManualBarcodeSubmit.addEventListener('click', submitManualBarcode); }
  if (btnFallbackManualBarcodeSubmit && btnFallbackManualBarcodeSubmit.dataset.mhdBound !== '1') { btnFallbackManualBarcodeSubmit.dataset.mhdBound = '1'; btnFallbackManualBarcodeSubmit.addEventListener('click', submitFallbackManualBarcode); }
  if (manualBarcodeInput && manualBarcodeInput.dataset.mhdBound !== '1') {
    manualBarcodeInput.dataset.mhdBound = '1';
    manualBarcodeInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submitManualBarcode(); } });
  }
  if (fallbackManualBarcodeInput && fallbackManualBarcodeInput.dataset.mhdBound !== '1') {
    fallbackManualBarcodeInput.dataset.mhdBound = '1';
    fallbackManualBarcodeInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submitFallbackManualBarcode(); } });
  }
}
function bindMhdToolbar() {
  const receipts = document.getElementById('btn-recent-receipts');
  if (receipts && receipts.dataset.mhdBound !== '1') { receipts.dataset.mhdBound = '1'; receipts.addEventListener('click', showRecentReceipts); }
  const master = document.getElementById('btn-master-data');
  if (master && master.dataset.mhdBound !== '1') { master.dataset.mhdBound = '1'; master.addEventListener('click', showMasterData); }
  const btnSaveMhd = document.getElementById('btn-save-mhd');
  if (btnSaveMhd && btnSaveMhd.dataset.mhdBound !== '1') {
    btnSaveMhd.dataset.mhdBound = '1';
    btnSaveMhd.addEventListener('click', () => {
      mhdState.playClickSound(900, 0.1, 0.2);
      if (isFirebaseReady()) mhdState.showHUD('Cloud-Sync aktiv', 'MHD-Best?nde werden live in Firestore gespeichert.');
      else mhdState.showHUD('Offline', 'Firebase nicht konfiguriert - keine Cloud-Synchronisation.', '!');
    });
  }
}
export function initMhdModule(databaseInstance, syncEngineAPI = {}, soundAPI = {}, uiCallbacks = {}) {
  mhdState.db = databaseInstance || mhdState.db;
  mhdState.tenantId = uiCallbacks.tenantId || mhdState.tenantId;
  mhdState.appsScriptWebAppUrl = uiCallbacks.appsScriptWebAppUrl || mhdState.appsScriptWebAppUrl;
  mhdState.writeOrQueueFirestore = syncEngineAPI.writeOrQueueFirestore || syncEngineAPI.writeFirestoreDocOrQueue || syncEngineAPI.writeOrQueue || mhdState.writeOrQueueFirestore;
  mhdState.addPendingSync = syncEngineAPI.addPendingSync || mhdState.addPendingSync;
  mhdState.playFeedbackSound = soundAPI.playFeedbackSound || soundAPI.playClickSound || mhdState.playFeedbackSound;
  mhdState.playClickSound = soundAPI.playClickSound || soundAPI.playFeedbackSound || mhdState.playClickSound;
  mhdState.showHUD = uiCallbacks.showHUD || mhdState.showHUD;
  mhdState.verifyAdminAction = uiCallbacks.verifyAdminAction || mhdState.verifyAdminAction;
  mhdState.getFirebase = uiCallbacks.getFirebase || mhdState.getFirebase;
  mhdState.isFirebaseReady = uiCallbacks.isFirebaseReady || mhdState.isFirebaseReady;
  mhdState.openScanner = uiCallbacks.scannerAPI?.openScanner || mhdState.openScanner;
  mhdState.closeScanner = uiCallbacks.scannerAPI?.closeScanner || mhdState.closeScanner;
  mhdState.onFormSaved = typeof uiCallbacks.onFormSaved === 'function' ? uiCallbacks.onFormSaved : mhdState.onFormSaved;
  mhdState.restoreDraftFields = typeof uiCallbacks.restoreDraftFields === 'function' ? uiCallbacks.restoreDraftFields : mhdState.restoreDraftFields;
  if (!mhdState.initialized) {
    initMhdSubnavAndSearch(); bindMhdCardActions(); bindUtilityDialogActions(); bindReceivingControls(); bindMhdToolbar(); loadVpeMasterFromCsv(); mhdState.initialized = true;
  }
  subscribeToPendingDeliveryDrafts();
  renderReceivingStatus(); renderMhdList();
  restoreMhdDraftFields();
}
function restoreMhdDraftFields() {
  const fields = ['manual-barcode-input', ...RECEIVING_FORM_IDS];
  const container = document.getElementById('mhd-items-container');
  if (container) {
    container.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.id) fields.push(el.id);
    });
  }
  mhdState.restoreDraftFields(fields);
}
export function activateMhdTab() { renderMhdList(); restoreMhdDraftFields(); }
export function activateReceivingTab() {
  ensureReceivingFormDefaults();
  subscribeToPendingDeliveryDrafts();
  updateManualBarcodeFallback();
  updateReceivingSaveButtonState();
  renderReceivingStatus();
  if (!activeEditingDraftId) {
    loadDeliveryDraftFromIndexedDB();
  }
  restoreMhdDraftFields();
}
export function handleMhdBarcodeScan(decodedText) { processScannedBarcode(decodedText, 'camera'); }
export function handleMhdScannerStatus({ status } = {}) { updateManualBarcodeFallback(); if (status) renderReceivingStatus({ status }); }
export function resetMhdScanState(options) { resetScanState(options); }
export function getMhdProducts() { return [...mhdState.products]; }
export {
  checkMhdAnomaly,
  finalizeDelivery,
  importMhdBestandToCloud,
  loadMhdFromCloud,
  renderMhdList,
  saveDeliveryDraft,
  saveManualReceiving,
  saveProductMaster,
  showMhdAnomalyWarning,
};
