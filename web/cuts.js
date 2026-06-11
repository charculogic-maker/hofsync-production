const CUT_SPECIES = {
  all: 'Alle',
  beef: 'Rind',
  pork: 'Schwein',
  lamb: 'Lamm',
  poultry: 'Geflügel',
  offal: 'Innereien',
  general: 'Allgemein',
};

const CUT_GLOSSARY = [
  {
    id: 'beef-neck',
    species: 'beef',
    name: 'Rinderhals / Nacken',
    region: 'Hals, vorderer Nacken bis Schulteransatz',
    aliases: ['Zungenstueck', 'Kamm', 'Neck', 'Collar'],
    muscles: ['M. longissimus cervicis', 'M. splenius', 'M. semispinalis capitis'],
    human: 'Nacken- und oberer Halsbereich hinter dem Kopf, grob zwischen Wirbelsaeule und seitlichem Nacken.',
    use: 'Gulasch, Schmoren, Suppenfleisch, Burger-Patties.',
    note: 'Zungenstueck und Kamm werden regional unterschiedlich zugeordnet; faserig, aber aromatisch.',
  },
  {
    id: 'beef-chuck-roll',
    species: 'beef',
    name: 'Fehlrippe',
    region: 'Vorderer Ruecken, Schulter- und Nackenbereich',
    aliases: ['Chuck Roll', 'Schulterruecken', 'Bug'],
    muscles: ['M. longissimus thoracis (vorderer Anteil)', 'M. trapezius', 'M. rhomboideus'],
    human: 'Oberer Ruecken und Schulterblattbereich, etwa zwischen Schulter und Nacken.',
    use: 'Gulasch, Schmoren, Schmorbraten, Hack und duenne Scheiben.',
    note: 'Im Hofladen ein klassischer Schmor- und Gulaschklassiker mit guter Bindegewebsstruktur.',
  },
  {
    id: 'beef-ribeye',
    species: 'beef',
    name: 'Entrecote / Ribeye',
    region: 'Ruecken, vorderer bis mittlerer Rippenbereich',
    aliases: ['Hochrippe', 'Rostbraten', 'Rib Eye', 'Cube Roll'],
    muscles: ['M. longissimus thoracis', 'M. spinalis dorsi'],
    human: 'Rueckenstrecker entlang der Brustwirbelsaeule; der Fettdeckel entspricht grob dem seitlichen oberen Ruecken.',
    use: 'Kurzbraten, Grillen, Steak, Roastbeef-artige Zuschnitte.',
    note: 'Regional werden Entrecote, Hochrippe und Rostbraten nicht immer deckungsgleich genutzt.',
  },
  {
    id: 'beef-denver',
    species: 'beef',
    name: 'Denver Cut',
    region: 'Schulter- und Nackenkern unter dem Schulterblatt',
    aliases: ['Denver Steak', 'Denver Cut Steak'],
    muscles: ['M. serratus ventralis', 'M. infraspinatus (angrenzend)'],
    human: 'Tiefer Schulterbereich unter dem Schulterblatt, etwa seitlich am oberen Brustkorb.',
    use: 'Kurzbraten, Grillen, intensiv marmoriertes Steak bei hoher Hitze.',
    note: 'Relativ neuer US-Zuschnitt aus dem Chuck; im Hofladen selten, aber sehr geschmacksintensiv.',
  },
  {
    id: 'beef-striploin',
    species: 'beef',
    name: 'Roastbeef / Striploin',
    region: 'Ruecken, Lendenbereich hinter der Hochrippe',
    aliases: ['Beiried', 'Rumpsteak', 'Strip Loin', 'Sirloin Strip'],
    muscles: ['M. longissimus lumborum'],
    human: 'Langer Rueckenstrecker im unteren Ruecken, neben der Lendenwirbelsaeule.',
    use: 'Kurzbraten, Grillen, Steaks, Roastbeef am Stueck, kalter Aufschnitt.',
    note: 'Wenig Sehnen, bindegewebsarm und saftig; nicht mit Filet verwechseln.',
  },
  {
    id: 'beef-tenderloin',
    species: 'beef',
    name: 'Filet',
    region: 'Innere Lende unter der Wirbelsaeule',
    aliases: ['Lungenbraten', 'Tenderloin', 'Psoas'],
    muscles: ['M. psoas major', 'M. iliacus'],
    human: 'Hueftbeuger tief im Becken und unteren Ruecken.',
    use: 'Kurzbraten, Grillen, Medaillons, Tournedos, Chateaubriand.',
    note: 'Wenig Sehnen, bindegewebsarm und sehr zart; nicht zu lange garen.',
  },
  {
    id: 'beef-top-sirloin-cap',
    species: 'beef',
    name: 'Tafelspitz',
    region: 'Hinterviertel, spitz zulaufender Deckel der Huefte',
    aliases: ['Picanha', 'Hueftdeckel', 'Culotte Cap'],
    muscles: ['M. biceps femoris, caput vertebrale'],
    human: 'Teil der hinteren Oberschenkelmuskulatur, etwa am aeusseren hinteren Oberschenkel.',
    use: 'Sieden, Schmoren, Picanha vom Grill mit Fettdeckel.',
    note: 'In Oesterreich klassisch Siedefleisch; als Picanha wird der Fettdeckel bewusst erhalten.',
  },
  {
    id: 'beef-tri-tip',
    species: 'beef',
    name: 'Buergermeisterstueck',
    region: 'Hinterviertel, unterer Hueftbereich ueber der Kugel',
    aliases: ['Pastorenstueck', 'Tri Tip', 'Pfaffenstueck'],
    muscles: ['M. tensor fasciae latae'],
    human: 'Kleiner Muskel seitlich an der Huefte, der in den Tractus iliotibialis einstrahlt.',
    use: 'Kurzbraten, Grillen, Schmoren bei groesseren Stuecken.',
    note: 'Der Zuschnitt ist dreieckig und wird je nach Region der Huefte oder Keule zugerechnet.',
  },
  {
    id: 'beef-eye-round',
    species: 'beef',
    name: 'Semerrolle / Unterschale (Rolle)',
    region: 'Keule, hinterer Unterschalenbereich',
    aliases: ['Rolle', 'Schwanzstueck', 'Eye of Round', 'Weisses Scherzel'],
    muscles: ['M. semitendinosus'],
    human: 'Einer der ischiokruralen Muskeln an der Rueckseite des Oberschenkels.',
    use: 'Schmoren, Schmorbraten, Sauerbraten, Poekeln, duenn aufgeschnitten.',
    note: 'Sehr mager und faserig; braucht Feuchtigkeit oder sehr praezise Garung.',
  },
  {
    id: 'beef-sirloin-blume',
    species: 'beef',
    name: 'Rinderhüfte / Blume (Sirloin)',
    region: 'Keule/Hüfte',
    aliases: ['Hüfte', 'Blume', 'Sirloin', 'Hüftsteak'],
    muscles: ['Hüftmuskulatur, je nach Zuschnitt mit mehreren Teilstücken'],
    human: 'Seitlicher Hüft- und oberer Oberschenkelbereich.',
    use: 'Kurzbraten, Grillen, Steaks, Rouladen, Hüftbraten.',
    note: 'Im Hofladen ein vielseitiger Klassiker; als Braten sauber gegen die Faser schneiden.',
  },
  {
    id: 'beef-shin-slice',
    species: 'beef',
    name: 'Beinscheibe',
    region: 'Hesse/Bein',
    aliases: ['Hesse', 'Rinderhesse', 'Osso Buco', 'Shin'],
    muscles: ['Unterschenkelmuskulatur mit Knochen, Mark und Sehnen'],
    human: 'Unterschenkelbereich rund um Schienbein und Wadenmuskulatur.',
    use: 'Schmoren, Suppenfleisch, Osso Buco.',
    note: 'Braucht Zeit und Feuchtigkeit; das Bindegewebe gibt Suppen und Schmorgerichten Kraft.',
  },
  {
    id: 'beef-round-topside',
    species: 'beef',
    name: 'Oberschale',
    region: 'Keule, Innenseite',
    aliases: ['Rouladenfleisch', 'Topside', 'Innere Keule', 'Silberseite'],
    muscles: ['M. semimembranosus', 'M. adductor'],
    human: 'Innere Oberschenkelmuskulatur an der Rueckseite des Schenkels.',
    use: 'Rinderrouladen, Schnitzel, Tatar, Schmoren, Kurzbraten.',
    note: 'Wenig Sehnen, bindegewebsarm; Top-Basis fuer Rinderrouladen, fuer Kurzbraten duenn schneiden.',
  },
  {
    id: 'beef-round-bottomside',
    species: 'beef',
    name: 'Unterschale',
    region: 'Keule, Aeussenseite',
    aliases: ['Aeussere Keule', 'Bottom Round', 'Silverside'],
    muscles: ['M. biceps femoris', 'M. semitendinosus (angrenzend)'],
    human: 'Aeussere und hintere Oberschenkelmuskulatur.',
    use: 'Schmoren, Schmorbraten, Rouladen, Roastbeef-Ersatz, duenn aufgeschnitten.',
    note: 'Mager und faserig; nicht mit Semerrolle verwechseln, auch wenn beide zur Keule gehoeren.',
  },
  {
    id: 'beef-round-knuckle',
    species: 'beef',
    name: 'Nuss / Kugel',
    region: 'Keule, Vorderseite',
    aliases: ['Kugel', 'Knuckle', 'Round Tip', 'Hueftkugel'],
    muscles: ['M. rectus femoris', 'M. vastus lateralis', 'M. vastus medialis'],
    human: 'Vordere Oberschenkelmuskulatur, also der Quadrizeps am Oberschenkel.',
    use: 'Kurzbraten, Fonduefleisch, Minutensteaks, magerer Braten, duenne Scheiben.',
    note: 'Wenig Sehnen, mager und kompakt; bei Braten vor Austrocknung schuetzen.',
  },
  {
    id: 'beef-chuck-tender',
    species: 'beef',
    name: 'Falsches Filet',
    region: 'Schulter, Bugbereich',
    aliases: ['Schulterfilet', 'Chuck Tender'],
    muscles: ['M. supraspinatus'],
    human: 'Schulterblattmuskel oberhalb der Schulterblattgraete.',
    use: 'Schmoren, Sieden, Gulasch; nur sauber pariert fuer Kurzbraten geeignet.',
    note: 'Heisst so wegen der Form, nicht wegen der Zartheit des echten Filets.',
  },
  {
    id: 'beef-flank',
    species: 'beef',
    name: 'Flank Steak',
    region: 'Bauchlappen, unterer seitlicher Bauch',
    aliases: ['Bavette de Flanchet', 'Duenner Lappen', 'Flanke'],
    muscles: ['M. rectus abdominis'],
    human: 'Gerader Bauchmuskel, also die sichtbare Bauchmuskelplatte.',
    use: 'Kurzbraten, Grillen, quer zur Faser schneiden, Marinaden.',
    note: 'Die Faser ist lang und deutlich; falsche Schnittfuehrung macht es zaeh.',
  },
  {
    id: 'beef-skirt',
    species: 'beef',
    name: 'Saumfleisch / Skirt Steak',
    region: 'Zwerchfell- und Bauchinnenbereich',
    aliases: ['Kronfleisch', 'Skirt', 'Duenner Saum'],
    muscles: ['Zwerchfellanteile, v. a. M. diaphragma'],
    human: 'Zwerchfell, der Atemmuskel zwischen Brust- und Bauchraum.',
    use: 'Kurzbraten, Grillen, Fajitas, Steaks mit kraeftigem Geschmack.',
    note: 'Kronfleisch, Saumfleisch und Nierenzapfen werden regional oft uneinheitlich benannt.',
  },
  {
    id: 'beef-hanger',
    species: 'beef',
    name: 'Nierenzapfen / Onglet',
    region: 'Innen am Zwerchfell nahe Niere und Lende',
    aliases: ['Hanger Steak', 'Herzzapfen', 'Onglet'],
    muscles: ['M. crura diaphragmatis'],
    human: 'Innere Schenkel des Zwerchfells an der Lendenwirbelsaeule.',
    use: 'Kurzbraten, Grillen nach sauberem Entfernen der Mittelsehne.',
    note: 'Fachlich nicht dasselbe wie Skirt Steak, auch wenn es in Listen oft zusammenrutscht.',
  },
  {
    id: 'beef-bavette-aloyau',
    species: 'beef',
    name: 'Bavette d\'Aloyau',
    region: 'Huefte, grosse Duennung am Hinterviertel',
    aliases: ['Flap Steak', 'Bavette', 'Bottom Sirloin Flap'],
    muscles: ['M. obliquus abdominis internus', 'M. transversus abdominis (Hueftbereich)'],
    human: 'Tiefe Bauchmuskulatur an der Huefte, grob seitlich am unteren Ruecken und Becken.',
    use: 'Kurzbraten, Grillen, grobfaserig aber extrem saftig, quer zur Faser schneiden.',
    note: 'Nicht mit Flank Steak verwechseln: Bavette d\'Aloyau sitzt am Hueftende, Flank am Bauch.',
  },
  {
    id: 'beef-brisket',
    species: 'beef',
    name: 'Brust / Brisket',
    region: 'Vorderviertel, Brustbein und vordere Rippen',
    aliases: ['Brustkern', 'Brustspitz', 'Flat', 'Point'],
    muscles: ['M. pectoralis profundus', 'M. pectoralis superficialis'],
    human: 'Brustmuskulatur, grob grosser und kleiner Brustmuskel.',
    use: 'Schmoren, Sieden, Poekeln, Pastrami, Low-and-slow BBQ.',
    note: 'Flat und Point sind unterschiedliche Teilstuecke mit sehr verschiedener Fettstruktur.',
  },
  {
    id: 'beef-short-ribs',
    species: 'beef',
    name: 'Querrippe / Spannrippe',
    region: 'Brust und Rippen, quer geschnitten',
    aliases: ['Short Ribs', 'Leiterstueck', 'Flankenrippe', 'Jacobs Ladder'],
    muscles: ['M. serratus ventralis', 'Interkostalmuskulatur', 'M. longissimus dorsi (Rippe)'],
    human: 'Rippenabschnitte quer durch Brust und Bauch, mit Fleisch zwischen und auf den Knochen.',
    use: 'Gulasch, Schmoren, kraeftige Suppen, BBQ Ribs.',
    note: 'Leiterstueck ist die quer geschnittene Variante; braucht Zeit und Feuchtigkeit fuer zarte Textur.',
  },
  {
    id: 'beef-flat-iron',
    species: 'beef',
    name: 'Schaufelstueck / Flat Iron',
    region: 'Schulter und Bug, oberes Schulterblatt',
    aliases: ['Top Blade Steak', 'Butler Steak', 'Flat Iron Steak'],
    muscles: ['M. infraspinatus'],
    human: 'Muskel unter dem Schulterblatt, etwa im Bereich der hinteren Schulter.',
    use: 'Zartes Steak nach Entfernung der Mittelsehne, Kurzbraten und Grillen.',
    note: 'Die durchgehende Sehne muss fachgerecht entfernt werden; danach sehr zart und marmoriert.',
  },
  {
    id: 'beef-blade-shoulder',
    species: 'beef',
    name: 'Schildstueck / Blattschulter',
    region: 'Schulter, Schulterblattbereich',
    aliases: ['Blattschulter', 'Blade', 'Shoulder Clod'],
    muscles: ['M. trapezius', 'M. infraspinatus', 'M. teres major', 'M. subscapularis'],
    human: 'Schulterguertel und Schulterblattmuskulatur, grob der gesamte Schulterbereich.',
    use: 'Gulasch, Schmoren, Schmorbraten, Sieden, Hack.',
    note: 'Faserig und kollagenreich; fuer Kurzbraten nur einzelne Muskeln sauber ausloesen.',
  },
  {
    id: 'pork-neck',
    species: 'pork',
    name: 'Nacken / Kamm',
    region: 'Vorderer Ruecken und Hals',
    aliases: ['Schweinekamm', 'Karreekamm', 'Coppa'],
    muscles: ['M. trapezius', 'M. splenius', 'M. longissimus-Anteile'],
    human: 'Nacken- und oberer Rueckenbereich zwischen Schulter und Hals.',
    use: 'Steaks, Braten, Pulled Pork, Wurstfleisch mit guter Saftigkeit.',
    note: 'Kamm ist meist der fleischigere, gut marmorierte Nackenbereich.',
  },
  {
    id: 'pork-loin',
    species: 'pork',
    name: 'Ruecken / Karree',
    region: 'Ruecken entlang der Wirbelsaeule',
    aliases: ['Lachs', 'Karbonade', 'Kotelettstrang', 'Loin'],
    muscles: ['M. longissimus thoracis et lumborum'],
    human: 'Langer Rueckenstrecker entlang Brust- und Lendenwirbelsaeule.',
    use: 'Kurzbraten, Grillen, Koteletts, Schnitzel aus dem Ruecken, Kasseler, Braten.',
    note: 'Schweinelachs ist der ausgeloeste magere Ruecken, Karree meist mit Knochen.',
  },
  {
    id: 'pork-bone-in-chop',
    species: 'pork',
    name: 'Kotelett (mit Knochen)',
    region: 'Rücken',
    aliases: ['Kotelett', 'Karbonade', 'Stielkotelett', 'Bone-in Chop'],
    muscles: ['M. longissimus thoracis et lumborum mit Rippen- oder Wirbelknochen'],
    human: 'Rückenstrecker entlang der Wirbelsäule.',
    use: 'Kurzbraten, Grillen.',
    note: 'Der Knochen schützt beim Braten etwas vor dem Austrocknen; nicht zu lange garen.',
  },
  {
    id: 'pork-tenderloin',
    species: 'pork',
    name: 'Schweinefilet',
    region: 'Innere Lende unter der Wirbelsaeule',
    aliases: ['Lungenbraten', 'Tenderloin'],
    muscles: ['M. psoas major'],
    human: 'Hueftbeuger tief im Becken und unteren Ruecken.',
    use: 'Kurzbraten, Grillen, Medaillons, Filet im Speckmantel.',
    note: 'Wenig Sehnen, bindegewebsarm und mager; nicht mit Schweinelachs verwechseln.',
  },
  {
    id: 'pork-ham-topside',
    species: 'pork',
    name: 'Oberschale',
    region: 'Schinken, innere Keulenseite',
    aliases: ['Topside', 'Schnitzelschale'],
    muscles: ['M. semimembranosus', 'Adduktorengruppe'],
    human: 'Innere und hintere Oberschenkelmuskulatur.',
    use: 'Kurzbraten, Schnitzel, Braten, Kochschinken, magere Wursteinlage.',
    note: 'Wenig Sehnen, mager; bei Braten vor Austrocknung schuetzen.',
  },
  {
    id: 'pork-ham-schnitzel-bottomside',
    species: 'pork',
    name: 'Unterschale / Schnitzelfleisch',
    region: 'Schinken/Keule',
    aliases: ['Unterschale', 'Schnitzelfleisch', 'Schinkenschnitzel', 'Silverside'],
    muscles: ['Hintere Keulenmuskulatur, je nach Zerlegung mit mehreren Teilstücken'],
    human: 'Hinterer Oberschenkelbereich.',
    use: 'Schnitzel.',
    note: 'Mager und gleichmäßig; für Schnitzel dünn schneiden und nicht zu lange braten.',
  },
  {
    id: 'pork-ham-knuckle',
    species: 'pork',
    name: 'Nuss / Kugel',
    region: 'Schinken, vorderer Keulenbereich',
    aliases: ['Kugel', 'Knuckle', 'Schinkennuss'],
    muscles: ['M. rectus femoris', 'M. vastus lateralis', 'M. vastus medialis'],
    human: 'Vordere Oberschenkelmuskulatur, also Quadrizeps.',
    use: 'Kurzbraten, Schnitzel, Braten, Kochschinken, feine Wuerfel.',
    note: 'Wenig Sehnen, mager und kompakt; sauberer Zuschnitt mit gleichmaessiger Form.',
  },
  {
    id: 'pork-belly',
    species: 'pork',
    name: 'Bauch',
    region: 'Unterer Rumpf zwischen Brust und Keule',
    aliases: ['Wammerl', 'Bacon', 'Pork Belly'],
    muscles: ['Bauchwandmuskulatur mit Fett- und Bindegewebe'],
    human: 'Bauchwand zwischen Rippenbogen und Becken.',
    use: 'Speck, Bacon, Bauchscheiben, Braten, Wurstbraet.',
    note: 'Fleisch-Fett-Verhaeltnis schwankt stark; fuer Speck ist Schichtung entscheidend.',
  },
  {
    id: 'pork-shoulder',
    species: 'pork',
    name: 'Schulter / Bug',
    region: 'Vorderviertel, Schulterblatt und Oberarm',
    aliases: ['Schaefle', 'Boston Butt', 'Picnic Shoulder'],
    muscles: ['Schulterblatt- und Oberarmmuskulatur'],
    human: 'Schulterguertel und Oberarmbereich.',
    use: 'Gulasch, Schmoren, Schmorbraten, Pulled Pork, Wurstfleisch.',
    note: 'Boston Butt meint im US-Schnitt eher den oberen Schulter-/Nackenanteil.',
  },
  {
    id: 'pork-cheek',
    species: 'pork',
    name: 'Baeckchen',
    region: 'Kopf, Kaumuskulatur',
    aliases: ['Schweinebaeckchen', 'Cheeks', 'Backerl'],
    muscles: ['M. masseter'],
    human: 'Kaumuskel an der Wange.',
    use: 'Schmoren, Ragout, sehr saftige kleine Portionen.',
    note: 'Klein, kollagenreich und nach langsamem Garen sehr zart.',
  },
  {
    id: 'pork-spareribs',
    species: 'pork',
    name: 'Spareribs',
    region: 'Rippen, unterer Brust- und Bauchbereich',
    aliases: ['Schaelrippchen', 'Spare Ribs', 'BBQ Ribs'],
    muscles: ['Interkostalmuskulatur', 'M. serratus ventralis', 'Bauchwandanteile'],
    human: 'Rippenabschnitte am unteren Brustkorb mit Fleisch zwischen den Knochen.',
    use: 'Schmoren, BBQ Slow and Low, marinieren und langsam garen.',
    note: 'Brauchen niedrige Temperatur und Zeit; Kollagen macht sie erst zart und saftig.',
  },
  {
    id: 'pork-hip',
    species: 'pork',
    name: 'Huefte / Schinkenspeck',
    region: 'Keule, Oberseite',
    aliases: ['Schinkenspeck', 'Hueft', 'Leg Tip'],
    muscles: ['M. gluteus medius', 'M. biceps femoris (oberer Anteil)'],
    human: 'Oberer hinterer Oberschenkel und Hueftbereich.',
    use: 'Gulasch, mageres Geschnetzeltes, Wuerfel und Hack.',
    note: 'Magerer Keulenzuschnitt; gut fuer schnelle Pfannengerichte und Eintoepfe.',
  },
  {
    id: 'pork-hock',
    species: 'pork',
    name: 'Schweinshaxe / Eisbein',
    region: 'Unterschenkel, Vorder- oder Hinterlauf',
    aliases: ['Eisbein', 'Stelze', 'Hock', 'Knuckle'],
    muscles: ['Unterschenkelmuskulatur mit Sehnen und Haut'],
    human: 'Unterschenkel mit Knochen, Sehnen und Kraustenfett.',
    use: 'Schmoren, gepoekelt und gekocht (Eisbein) oder kross gebacken (Haxe).',
    note: 'Klassischer Hofladen-Braten; beim Backen zuerst langsam garen, dann hohe Hitze fuer Kruste.',
  },
  {
    id: 'pork-trotter',
    species: 'pork',
    name: 'Spitzbein / Pfoten',
    region: 'Fuss, unterer Lauf',
    aliases: ['Pfoten', 'Trotters', 'Fuesse'],
    muscles: ['Fussmuskulatur, Sehnen und Haut'],
    human: 'Fussgelenk und unterer Fussbereich mit Sehnen und Haut.',
    use: 'Suelze, traditionelle Eintoepfe, Fonds und Gelatine.',
    note: 'Kollagenreich; liefert Bindung fuer Suelze und kraeftige Bruelen.',
  },
  {
    id: 'pork-cushion',
    species: 'pork',
    name: 'Kachelfleisch',
    region: 'Beckenknochen, hinterer Hueftbereich',
    aliases: ['Deckelchen', 'Schnippelfleisch', 'Cushion Meat'],
    muscles: ['M. gluteus medius', 'M. gluteus superficialis'],
    human: 'Muskel ueber dem Beckenknochen, kaum belastet und daher sehr zart.',
    use: 'Kurzbraten, Grillen, Pfanne, kurz und heiss braten.',
    note: 'Extrem saftig durch geringe Belastung; im Hofladen oft unterschaetzt.',
  },
  {
    id: 'pork-secreto',
    species: 'pork',
    name: 'Secreto',
    region: 'Versteckt hinter der Schulter, Nackenansatz',
    aliases: ['Geheimes Steak', 'Secreto Iberico'],
    muscles: ['M. splenius', 'M. longissimus cervicis (Schulteransatz)'],
    human: 'Tiefer Nacken-Schulter-Uebergang, ein kaum beanspruchter Muskel.',
    use: 'Kurzbraten, Grillen bei hoher Hitze, starke Marmorierung ausnutzen.',
    note: 'Iberico-Klassiker; auch bei deutschem Schwein ein sehr aromatisches Teilstueck.',
  },
  {
    id: 'pork-pluma',
    species: 'pork',
    name: 'Pluma',
    region: 'Hinterer Ruecken, Fleischkappe der Lende',
    aliases: ['Federstueck', 'Pluma Iberico'],
    muscles: ['M. longissimus lumborum (kappenartiger Anteil)', 'M. iliocostalis'],
    human: 'Duenne Fleischkappe am unteren Ruecken, unterhalb des Rueckenstreckers.',
    use: 'Grillen, flach und sehr zart, kurz rosa garen.',
    note: 'Klein und empfindlich; nicht uebergaeren, sonst trocken.',
  },
  {
    id: 'pork-presa',
    species: 'pork',
    name: 'Presa',
    region: 'Nackenkern, hinter dem Kopf',
    aliases: ['Schulterkern', 'Presa Iberico', 'Coppa-Kern'],
    muscles: ['M. splenius', 'M. semispinalis capitis', 'M. longissimus cervicis'],
    human: 'Nackenmuskulatur hinter dem Kopf, ein sehr beanspruchungsarmer Kern.',
    use: 'Kurzbraten, Grillen, rosa gebraten, Iberico-Steak.',
    note: 'Stark marmoriert und aromatisch; einer der edelsten Schweinezuschnitte.',
  },
  {
    id: 'lamb-neck',
    species: 'lamb',
    name: 'Lammhals / Nacken',
    region: 'Hals, vorderer Nacken',
    aliases: ['Lammnacken', 'Collar', 'Scrag End'],
    muscles: ['M. longissimus cervicis', 'M. splenius', 'M. semispinalis capitis'],
    human: 'Nacken- und oberer Halsbereich hinter dem Kopf.',
    use: 'Gulasch, Schmoren, Eintoepfe, geschmorte Halsscheiben, Ragout.',
    note: 'Faserig und kollagenreich; braucht langsame Garung fuer Zartheit.',
  },
  {
    id: 'lamb-leg',
    species: 'lamb',
    name: 'Lammkeule',
    region: 'Hinterlauf, Oberschenkel',
    aliases: ['Gigot', 'Leg of Lamb', 'Schlegel'],
    muscles: ['Oberschale', 'Unterschale', 'Nuss', 'Huefte'],
    human: 'Oberschenkel und Hueftbereich.',
    use: 'Braten, Schmoren, ausgeloeste Steaks, Hack und Spiesse.',
    note: 'Keule ist ein Sammelzuschnitt; einzelne Muskeln unterscheiden sich deutlich.',
  },
  {
    id: 'lamb-rack',
    species: 'lamb',
    name: 'Ruecken / Carre',
    region: 'Rippen- und Lendenruecken',
    aliases: ['Lammkarree', 'Rack of Lamb', 'Lachs'],
    muscles: ['M. longissimus thoracis et lumborum'],
    human: 'Rueckenstrecker entlang der Wirbelsaeule.',
    use: 'Kurzbraten, Grillen, Karree, Koteletts, Lammruecken rosa gebraten.',
    note: 'Lammfilet liegt innen; Lammruecken oder Lachs liegt aussen am Ruecken.',
  },
  {
    id: 'lamb-shoulder',
    species: 'lamb',
    name: 'Schulter',
    region: 'Vorderlauf mit Schulterblatt',
    aliases: ['Bug', 'Shoulder'],
    muscles: ['Schulterblatt- und Oberarmmuskulatur'],
    human: 'Schulterguertel und Oberarmbereich.',
    use: 'Schmoren, Rollbraten, Ragout, langsam gegart.',
    note: 'Mehr Bindegewebe als Ruecken oder Keule; dadurch aromatisch und saftig beim Schmoren.',
  },
  {
    id: 'lamb-shank',
    species: 'lamb',
    name: 'Haxe',
    region: 'Unterer Vorder- oder Hinterlauf',
    aliases: ['Stelze', 'Shank', 'Lammhaxe'],
    muscles: ['Unterschenkelmuskulatur mit Sehnen'],
    human: 'Unterarm bzw. Unterschenkel, je nach Vorder- oder Hinterhaxe.',
    use: 'Schmoren, Fonds, langsam gegarte Portionen.',
    note: 'Kollagenreich; braucht Zeit, wird dann aber sehr saftig.',
  },
  {
    id: 'lamb-breast',
    species: 'lamb',
    name: 'Lammdünnung / Brust',
    region: 'Bauch, Brustbereich',
    aliases: ['Lammbrust', 'Breast', 'Flank'],
    muscles: ['M. rectus abdominis', 'Bauchwandmuskulatur mit Fett'],
    human: 'Bauchwand zwischen Rippenbogen und Becken.',
    use: 'Schmoren, Rollbraten, Suppenfleisch, Hackfleisch-Basis.',
    note: 'Fettreich und kollagenhaltig; als Rollbraten mit Fuellung besonders saftig.',
  },
  {
    id: 'poultry-breast',
    species: 'poultry',
    name: 'Haehnchenbrust / Filet',
    region: 'Brust, vorderer Rumpf',
    aliases: ['Brustfilet', 'Chicken Breast', 'Weisses Fleisch'],
    muscles: ['M. pectoralis major'],
    human: 'Grosse Brustmuskulatur an der Vorderseite des Brustkorbs.',
    use: 'Kurzbraten, Geschnetzeltes, Grillen, Sieden.',
    note: 'Sehr mager; nicht uebergaeren, sonst trocken. Innenfilet separat verwerten.',
  },
  {
    id: 'poultry-supreme',
    species: 'poultry',
    name: 'Supreme',
    region: 'Brust mit Haut und erstem Fluegelglied',
    aliases: ['Supreme de Volaille', 'Brust mit Fluegelansatz'],
    muscles: ['M. pectoralis major', 'M. pectoralis minor (teilweise)', 'Fluegelmuskulatur'],
    human: 'Brustmuskel mit angeschlossenem Oberarm und Haut – bleibt durch den Knochen saftiger.',
    use: 'Pfanne und Ofen, Haut knusprig, Fleisch rosa.',
    note: 'Der Knochen haelt Feuchtigkeit; klassische Gastronomie-Zubereitung.',
  },
  {
    id: 'poultry-tender',
    species: 'poultry',
    name: 'Innenfilet',
    region: 'Unter der Brust, am Brustbein',
    aliases: ['Tender', 'Filet', 'Chicken Tender'],
    muscles: ['M. pectoralis minor'],
    human: 'Kleinerer Brustmuskel direkt am Brustbein, unter dem grossen Brustmuskel.',
    use: 'Chicken Nuggets, Minutenstreifen, kurz und heiss braten.',
    note: 'Zarter als Brustfilet, aber kleiner; schnell gar und empfindlich.',
  },
  {
    id: 'poultry-leg-whole',
    species: 'poultry',
    name: 'Gefluegelkeule / Ganz',
    region: 'Hinterbein, Oberschenkel und Unterschenkel',
    aliases: ['Schlaegel', 'Keule', 'Leg Quarter', 'Hinterviertel'],
    muscles: ['M. iliotibialis lateralis', 'M. gastrocnemius', 'M. flexor digitorum'],
    human: 'Oberschenkel und Unterschenkel mit Knochen – das dunklere, saftigere Gefluegelfleisch.',
    use: 'Schmoren, Grillen, im Ganzen knusprig braten, confieren.',
    note: 'Dunkles Fleisch vertraegt laengere Garung besser als Brust; Haut fuer Kruste lassen.',
  },
  {
    id: 'poultry-thigh',
    species: 'poultry',
    name: 'Oberkeule',
    region: 'Oberer Teil des Beins, Oberschenkel',
    aliases: ['Pollo Fino', 'Thigh', 'Oberschenkel (entbeint)'],
    muscles: ['M. iliotibialis lateralis', 'M. ambiens', 'M. iliofemoralis'],
    human: 'Oberschenkelmuskulatur – das saftigste Gefluegelfleisch.',
    use: 'Grillen, Schmoren, Pfanne, Curry und Eintoepfe.',
    note: 'Entbeint als Pollo Fino bekannt; verzeiht laengere Garzeit und bleibt saftig.',
  },
  {
    id: 'poultry-drumstick',
    species: 'poultry',
    name: 'Unterkeule',
    region: 'Unterer Teil des Beins, Unterschenkel',
    aliases: ['Drumstick', 'Staebchen', 'Unterschenkel'],
    muscles: ['M. gastrocnemius', 'M. flexor digitorum superficialis'],
    human: 'Unterschenkel mit Knochen – der klassische Drumstick.',
    use: 'Fingerfood, BBQ, frittieren, marinieren.',
    note: 'Knochen gibt Geschmack; ideal fuer Grill und Ofen mit Marinade.',
  },
  {
    id: 'poultry-wing',
    species: 'poultry',
    name: 'Haehnchenfluegel',
    region: 'Fluegel, Arme',
    aliases: ['Chicken Wings', 'Fluegel', 'Wingettes'],
    muscles: ['M. biceps brachii', 'M. triceps brachii', 'Fluegelmuskulatur'],
    human: 'Armmuskulatur am Fluegel – kleine Portionen mit Haut und Knochen.',
    use: 'Frittieren, BBQ marinieren, heiss und knusprig.',
    note: 'Fluegelspitzen oft separat; Wingettes und Drumettes sind die Hauptportionen.',
  },
  {
    id: 'poultry-carcass',
    species: 'poultry',
    name: 'Karkasse / Suppenhuhn',
    region: 'Skelett, Reste und aeltere Tiere',
    aliases: ['Suppenhuhn', 'Huhn zum Auskochen', 'Carcass', 'Gerippe'],
    muscles: ['Restmuskulatur, Sehnen und Knochen'],
    human: 'Das Skelett mit Restfleisch – nicht zum Braten, sondern fuer Bruhe.',
    use: 'Auskochen fuer Huehnerbruehe und Fonds.',
    note: 'Aeltere Huehner liefern kraeftigere Bruhe; nicht mit jungen Grillhuhnern verwechseln.',
  },
  {
    id: 'poultry-definition-haehnchen',
    kind: 'definition',
    species: 'poultry',
    name: 'Hähnchen vs. Huhn vs. Hahn (Warenkunde)',
    region: 'Begriffserklärung',
    aliases: ['Hühnchen', 'Gockel'],
    muscles: [],
    human: '',
    use: 'Hähnchen: Junges Tier (beiderlei Geschlechts), ca. 5-6 Wochen alt, extrem zartes Fleisch zum Grillen/Braten. Hahn: Ausgewachsenes, männliches Tier, sehr festes und aromatisches Fleisch, perfekt zum Schmoren (z.B. Coq au Vin).',
    note: '',
  },
  {
    id: 'poultry-definition-broiler',
    kind: 'definition',
    species: 'poultry',
    name: 'Broiler (Warenkunde)',
    region: 'Begriffserklärung',
    aliases: ['Brathähnchen', 'Brathuhn'],
    muscles: [],
    human: '',
    use: "Herleitung vom englischen 'to broil' (grillen). In der DDR ab 1961 der offizielle Handelsbegriff für ein schlachtreifes Masthähnchen. Wenn ein Kunde danach fragt, meint er ein klassisches, knuspriges Brathähnchen.",
    note: '',
  },
  {
    id: 'poultry-definition-suppenhuhn',
    kind: 'definition',
    species: 'poultry',
    name: 'Suppenhuhn (Warenkunde)',
    region: 'Begriffserklärung',
    aliases: [],
    muscles: [],
    human: '',
    use: 'Eine ältere, weibliche Legehenne (ca. 12-15 Monate alt). Das Fleisch ist deutlich zäher als beim Hähnchen, hat aber einen enormen Fett- und Proteingehalt. Unverzichtbar für kräftige, echte Hühnerbrühen und Fonds.',
    note: '',
  },
  {
    id: 'poultry-definition-edelgefluegel',
    kind: 'definition',
    species: 'poultry',
    name: 'Poularde, Stubenküken & Kapaun',
    region: 'Edel-Geflügel Definitionen',
    aliases: [],
    muscles: [],
    human: '',
    use: 'Poularde: Junge, fleischige Henne vor dem ersten Ei (über 1,5 kg, sehr saftig). Stubenküken: Sehr junges Huhn (unter 28 Tage, ca. 400g, extrem zart). Kapaun: Kastrierter, gemästeter Hahn. Wächst langsam, extrem feines, marmoriertes Fettgewebe – der saftigste Festtagsbraten.',
    note: '',
  },
  {
    id: 'beef-definition-reifung',
    kind: 'definition',
    species: 'beef',
    name: 'Dry Aging & Wet Aging (Galloway-Reifung)',
    region: 'Begriffserklärung',
    aliases: ['Abhängen', 'Dry Aging', 'Wet Aging', 'Reifung', 'Galloway', 'Trockenreifung', 'Nassreifung', 'Dry Aged'],
    muscles: [],
    human: '',
    use: 'Nach der Schlachtung hängen wir Galloway-Stücke kontrolliert ab (Abhängen): Enzyme lockern das Bindegewebe, das Fleisch wird zarter und aromatischer. Dry Aging (Trockenreifung): 2–6 Wochen bei 0–2 °C und ca. 80–85 % Luftfeuchte – Feuchtigkeit entweicht, Geschmack konzentriert sich, typische Dry-Aged-Note. Wet Aging (Nassreifung/Vakuum): Im Vakuum bei 0–2 °C – zarter, saftiger, milder. Galloway mit feinem Fettanteil profitiert besonders von Dry Aging für Steaks und Braten; für Patties und schnelle Küche oft Wet Aging. Kundenfrage „Abgehangen?“: Ja – Qualität entsteht durch kontrollierte Reifung, nicht durch bloßes Lagern.',
    note: '',
  },
  {
    id: 'allgemein-definition-hackfleisch-farbe',
    kind: 'definition',
    species: 'general',
    name: 'Graues Hackfleisch im Inneren (Qualität)',
    region: 'Qualitäts-Hinweis',
    aliases: ['grau', 'graue Farbe', 'Hackfleisch grau', 'Metmyoglobin', 'Oxy-Myoglobin', 'Wolfhack grau'],
    muscles: [],
    human: '',
    use: 'Grau oder bräunlich im Inneren von frisch gewolkenem Hackfleisch ist kein Verderb, sondern normal: An der Oberfläche oxidiert Myoglobin zu hellem Rot (Oxy-Myoglobin), im Kern fehlt Sauerstoff – Metmyoglobin wirkt grau-braun. Nach kurzer Luftexposition färbt sich auch die Mitte oft wieder rötlicher. Entscheidend sind frischer Geruch, Kühlkette und kein säuerlicher oder fauliger Geruch. Dem Kunden erklären: Die graue Farbe im Inneren sagt nichts über Frische aus – riechen, ansehen, kühl halten.',
    note: '',
  },
  {
    id: 'allgemein-definition-wurst-kategorien',
    kind: 'definition',
    species: 'general',
    name: 'Rohwurst, Brühwurst & Kochwurst',
    region: 'Wurstküchen-Wissen',
    aliases: ['Salami', 'Rohwurst', 'Brühwurst', 'Kochwurst', 'Rohpökelware', 'Lyoner', 'Mortadella', 'Mettwurst', 'Leberwurst'],
    muscles: [],
    human: '',
    use: 'Rohwurst (z. B. Salami, Mettwurst, Landjäger): Roh gewolken, gesalzen und gepöckelt, oft mit Starterkulturen – reift wochenlang, wird nicht roh gegessen, sondern durch Reifung essfertig. Brühwurst (z. B. Lyoner, Mortadella, Bierwurst): Brät wird erwärmt und abgefüllt, dann heiß durchgezogen (Kerntemperatur über 72 °C) – nach Kühlung essfertig. Kochwurst (z. B. Leberwurst, Sulz, Blutwurst): Einlage oder Brät wird gekocht, teils fein gewolken – streichfähig oder in Scheiben. Merksatz fürs Team: Roh = reifen lassen · Brüh = heiß abgefüllt · Koch = durchgegart im Kessel.',
    note: '',
  },
  {
    id: 'allgemein-definition-fleischfehler',
    kind: 'definition',
    species: 'pork',
    name: 'PSE- & DFD-Fleisch (Qualitätskontrolle)',
    region: 'Qualitätskontrolle',
    aliases: ['pH-Wert', 'PSE', 'DFD', 'Pale Soft Exudative', 'Dark Firm Dry', 'Fleischfehler', 'Qualitätskontrolle', 'Brühwurst'],
    muscles: [],
    human: '',
    use: 'PSE (Pale, Soft, Exudative): Stress vor der Schlachtung → schneller pH-Abfall. Fleisch blass, weich, wässrig (extremer Saftverlust). Kritischer pH-Grenzwert in unserer HACCP-Prüfung: unter 5,30. Ungeeignet für Brühwurst und Premium-Grillware. DFD (Dark, Firm, Dry): langsamer pH-Abfall → pH bleibt hoch, Fleisch dunkelrot, fest, klebrig, verkürzte Haltbarkeit. Kritischer Grenzwert: über 6,20. Idealer Normalbereich (Schwein): ca. 5,40–6,00. Bei Verdacht: Charge dokumentieren, nicht für Premium-Verkauf oder Rohwurst verwerten, Meister informieren.',
    note: '',
  },
  {
    id: 'beef-definition-gelbes-fett',
    kind: 'definition',
    species: 'beef',
    name: '💡 Gelbe Fettfarbe beim Weiderind',
    region: 'Qualitäts-Hinweis',
    aliases: ['Fettfarbe', 'gelbliches Fett', 'Weidehaltung', 'Beta-Carotin', 'Galloway', 'Weiderind'],
    muscles: [],
    human: '',
    use: 'Kein Zeichen von Alter! Bei Rindern aus reiner Weide- und Grasfütterung (wie unseren Galloways) lagert sich natürliches Beta-Carotin aus dem frischen Gras im Fettgewebe ein. Dies färbt das Fett gesund gelblich. Im Gegensatz zu schneeweißem Getreide-Mastfett ist gelbliches Fett ein biologischer Beweis für artgerechte Freilandhaltung und enthält deutlich mehr gesunde Omega-3-Fettsäuren.',
    note: '',
  },
  {
    id: 'allgemein-definition-saftverlust',
    kind: 'definition',
    species: 'general',
    name: '💡 Warum verliert Fleisch Wasser in der Pfanne?',
    region: 'Warenkunde',
    aliases: ['Wasser in der Pfanne', 'Fleisch schrumpft', 'Saftverlust', 'trockenes Fleisch', 'Industriefleisch'],
    muscles: [],
    human: '',
    use: 'Das hängt von der Mastgeschwindigkeit und der Abkühlung nach der Schlachtung ab. Schnell gemästetes Industriefleisch hat schwammiges Zellgewebe. Wird es nach dem Schlachten mit Wasser besprüht, saugt sich die Faser voll – das Wasser tritt beim Braten sofort aus. Unser handwerkliches Fleisch reift langsam, verliert überschüssiges Wasser schon im Kühlraum und behält in der Pfanne seine stabile Zellstruktur.',
    note: '',
  },
  {
    id: 'allgemein-definition-kein-nps',
    kind: 'definition',
    species: 'general',
    name: '💡 Warum ist unsere Wurst nicht knallrot? (Verzicht auf NPS)',
    region: 'Wurstküchen-Wissen',
    aliases: ['Nitritpökelsalz', 'NPS', 'grau', 'Verfärbung', 'ehrliche Wurst', 'ohne Chemie', 'Speisesalz', 'Umrötung'],
    muscles: [],
    human: '',
    use: "Reines Muskelfleisch wird beim Erhitzen von Natur aus graubraun. Die Fleischindustrie nutzt Nitritpökelsalz (NPS), um Fleisch künstlich rosa zu färben ('Umrötung'). Auf dem StevesHof verzichten wir komplett auf NPS und salzen traditionell mit reinem Speisesalz. Unsere Brüh- und Kochwürste (wie Fleischwurst oder Leberwurst) haben deshalb eine natürliche, handwerkliche Grau-Beige-Färbung. Ein Beweis für puren Geschmack ohne chemische Farbstoffe!",
    note: '',
  },
  {
    id: 'allgemein-definition-kein-phosphat',
    kind: 'definition',
    species: 'general',
    name: '💡 Wurstbindung ohne künstliche Phosphate',
    region: 'Handwerkskunde',
    aliases: ['Phosphat', 'Warmfleisch', 'Bindung', 'Kutterhilfsmittel', 'Zusatzstoffe', 'ohne Chemie', 'ATP'],
    muscles: [],
    human: '',
    use: "In der Industrie sorgen künstliche Phosphate dafür, dass das Fleisch beim Kuttern Wasser bindet. Wir verzichten vollständig auf diesen Zusatzstoff! Stattdessen nutzen wir echtes Handwerk: Durch die schlachtfrische Verarbeitung ('Warmfleisch') nutzen wir das noch zelleigene, natürliche ATP des Fleisches für die perfekte Bindung. Das ist extrem aufwendig, sorgt aber für eine Spitzenqualität komplett ohne Chemie.",
    note: '',
  },
  {
    id: 'general-definition-bio-technologie',
    kind: 'definition',
    species: 'general',
    name: '💡 Bio-Fleisch in der Verarbeitung',
    region: 'Rohstoffkunde',
    aliases: ['Bio', 'Fettstruktur', 'pH-Wert', 'Weich', 'Bio-Fleisch', 'Speck'],
    muscles: [],
    human: '',
    use: 'Bio-Fleisch ist der Formel-1-Wagen unter den Rohstoffen: Maximales Geschmackspotenzial, verzeiht aber keine Fehler. Da Bio-Tiere sich mehr bewegen, ist ihr Fett weicher (mehr ungesättigte Fettsäuren) und schmiert schneller. Bio-Speck muss zwingend auf mind. -5°C angefrostet werden, um einen Fettfilm zu verhindern, der die Trocknung blockiert. Ziel-pH-Wert für Wurst: 5,5 bis 5,8.',
    note: '',
  },
  {
    id: 'general-definition-warmfleisch',
    kind: 'definition',
    species: 'general',
    name: '💡 Das Warmfleisch-Prinzip',
    region: 'Handwerkskunde',
    aliases: ['Warmfleisch', 'ATP', 'Phosphat-Ersatz', 'Ohne Chemie', 'schlachtfrisch'],
    muscles: [],
    human: '',
    use: 'Die absolute Königsdisziplin, die wir am StevesHof nutzen! Direkt nach der Schlachtung (Zeitfenster 2-4 Stunden) ist das körpereigene Phosphat (ATP) im Muskel voll aktiv. Das Fleisch hat eine enorme, natürliche Wasserbindungskapazität. Wer warmes Fleisch schlachtfrisch verarbeitet, benötigt keinerlei zugesetzte, künstliche Phosphate für eine perfekte, saftige Brühwurst.',
    note: '',
  },
  {
    id: 'general-definition-nitrat-nitrit',
    kind: 'definition',
    species: 'general',
    name: '💡 Nitrat vs. Nitrit & US-Warnung',
    region: 'Pökeltechnologie',
    aliases: ['Salpeter', 'NPS', 'Pink Curing Salt', 'USA', 'Umrötung', 'Nitrit', 'Nitrat'],
    muscles: [],
    human: '',
    use: "Nitrat (Salpeter) wirkt nicht direkt, sondern muss erst von Bakterien langsam zu Nitrit abgebaut werden – ideal als Langzeit-Depot für Schinken (>6 Monate Reifung). Nitritpökelsalz (NPS) wirkt sofort. ACHTUNG bei US-Rezepten: 'Pink Curing Salt #1' enthält 6,25% Nitrit und ist damit ca. 12-mal stärker als deutsches NPS (0,5%). Niemals 1:1 tauschen!",
    note: '',
  },
  {
    id: 'general-definition-trockenrand',
    kind: 'definition',
    species: 'general',
    name: '💡 Der Trockenrand (Case Hardening)',
    region: 'Reifetechnologie',
    aliases: ['Trockenrand', 'Versiegelung', 'Faulen', 'Kapillaren', 'Case Hardening'],
    muscles: [],
    human: '',
    use: 'Fleisch kann pro Tag physikalisch nur max. 1% seines Eigengewichts an Feuchtigkeit abgeben. Wenn die Luft im Reiferaum zu trocken oder zu warm ist, trocknet die Oberfläche rasant ab. Es entsteht ein harter Trockenrand, der die Wursthülle wie Plastik versiegelt. Das Wasser im Inneren ist gefangen, kann nicht entweichen und die Wurst verfault von innen heraus.',
    note: '',
  },
  {
    id: 'general-definition-garverfahren',
    kind: 'definition',
    species: 'general',
    name: '💡 Warum wir Brühwurst niemals kochen',
    region: 'Brühwurst-Technologie',
    aliases: ['Brühen', 'Kochen', 'Platzen', 'Wassertemperatur', 'Brühwurst', 'Wiener'],
    muscles: [],
    human: '',
    use: 'Brühwurst (Wiener, Fleischkäse, Lyoner) wird niemals gekocht! Ab 75°C gart das Muskeleiweiß über, verliert seine Bindung, wird trocken und die Hülle platzt durch den Innendruck auf. Der handwerkliche Standard: Konstant brühen bei 75°C bis 78°C. Faustregel: 1 Minute Brühzeit pro Millimeter Kaliber (Durchmesser), danach sofort im Eiswasser abschrecken.',
    note: '',
  },
  {
    id: 'general-definition-messer-schliff',
    kind: 'definition',
    species: 'general',
    name: '💡 Schärfe & Schliff im Wolf',
    region: 'Werkzeugkunde',
    aliases: ['Messer', 'Stumpf', 'Reibungshitze', 'Wolfsatz', 'Lochscheibe', 'Wolf'],
    muscles: [],
    human: '',
    use: 'Ein stumpfes Messer zertrümmert Zellen, statt sie zu schneiden. Durch den extremen Druck tritt Zellwasser und Fett vorzeitig aus, was die Eiweißbindung ruiniert. Zudem erzeugt Stumpfheit massive Reibungshitze: Steigt das Brät über 12°C, kollabiert die Emulsion. Messer und Lochscheibe müssen immer als fest eingeschliffenes Paar montiert und vorab auf Planheit geprüft werden.',
    note: '',
  },
  {
    id: 'general-definition-speck-qualitaet',
    kind: 'definition',
    species: 'pork',
    name: '💡 Speck-Qualität für Salami',
    region: 'Rohstoffkunde',
    aliases: ['Rückenspeck', 'Kernspeck', 'Schmieren', 'Mosaik', 'Flomen', 'Salami'],
    muscles: [],
    human: '',
    use: 'Rohwurst benötigt zwingend harten, kernigen Rückenspeck. Dieser hat einen hohen Schmelzpunkt und bleibt beim Wolfen stabil. Weiche Fette (Bauch, Flomen) schmieren bereits bei 10-12°C und legen einen isolierenden Ölfilm um die Fleischpartikel, der die Trocknung blockiert. Nur harter Speck garantiert das perfekte, scharf abgegrenzte Salami-Mosaik im Schnittbild.',
    note: '',
  },
  {
    id: 'general-definition-edelschimmel',
    kind: 'definition',
    species: 'general',
    name: '💡 Edelschimmel vs. Wildschimmel',
    region: 'Veredelung',
    aliases: ['Schimmel', 'Penicillium', 'Schutzschicht', 'Salami-Belag', 'Wildschimmel'],
    muscles: [],
    human: '',
    use: 'Der weiße Belag auf der Salami (Penicillium nalgiovense) ist eine biologische Schutzschicht. Er besiedelt die Oberfläche lückenlos und entzieht giftigem Wildschimmel (grün, schwarz, puschelig) oder Fäulnisbakterien die Lebensgrundlage. Zudem baut er sanft Milchsäure ab, reift das Fett enzymatisch zu einem nussigen Aroma und schützt es vor Licht und Ranzigkeit.',
    note: '',
  },
  {
    id: 'general-definition-reifeklima',
    kind: 'definition',
    species: 'general',
    name: '💡 Das perfekte Reifeklima',
    region: 'Reifetechnologie',
    aliases: ['Luftgeschwindigkeit', 'Weinkühlschrank', 'Feuchte', 'Klimaschrank', 'Reiferaum'],
    muscles: [],
    human: '',
    use: "Salami benötigt eine exakte Luftbewegung von 0,1 bis 0,5 m/s. Stehende Luft provoziert Wildschimmel; zu schnelle Luft erzeugt einen Trockenrand. Da eine frische Salami in den ersten Tagen massiv Wasser abgibt, steigen einfache Weinkühlschränke ohne aktives Entfeuchtungs- und Umluftsystem sofort aus – die Wurst 'erstickt' und schmiert ab.",
    note: '',
  },
  {
    id: 'general-definition-gewuerz-qualitaet',
    kind: 'definition',
    species: 'general',
    name: '💡 Gewürz-Qualität & Keimbelastung',
    region: 'Gewürzkunde',
    aliases: ['Pfeffer', 'Paprika', 'Keime', 'Ätherische Öle', 'Feinwaage', 'Gewürze'],
    muscles: [],
    human: '',
    use: 'Naturbelassene, unentkeimte Billig-Gewürze schleppen massive Lasten an Bakterien und Schimmelpilzsporen ein, die in der Salami eure Starterkulturen überwältigen können. Vorgemahlenes Fertigpulver verliert zudem minütlich seine ätherischen Öle und schmeckt oft nur staubig-bitter. Ganze Saaten immer frisch mahlen und auf 0,1g genau abwiegen.',
    note: '',
  },
  {
    id: 'general-definition-schuettung-eis',
    kind: 'definition',
    species: 'general',
    name: '💡 Schüttung & Eis im Kutter',
    region: 'Brühwurst-Technologie',
    aliases: ['Eis', 'Wasserzugabe', 'Emulsion', 'Lyoner', 'Fleischkäse', 'Kutter'],
    muscles: [],
    human: '',
    use: "Die Zugabe von 15-25% feingecrushtem Eis oder Schnee ist keine Panscherei, sondern physikalische Pflicht. Fleischeiweiß (Aktomyosin) kann Fetttröpfchen nur dauerhaft umschließen, wenn es in Wasser gelöst und 'aufgeschlossen' wird. Zudem kühlt das Eis das Brät bei den rasanten Klingen-Umdrehungen aktiv vor dem Erreichen der kritischen 12°C-Grenze.",
    note: '',
  },
  {
    id: 'general-definition-daerme-huellen',
    kind: 'definition',
    species: 'general',
    name: '💡 Naturdarm vs. Kunstdarm',
    region: 'Verpackung & Hüllen',
    aliases: ['Saitling', 'Kunstdarm', 'Faserdarm', 'Plastikdarm', 'Rauch', 'Naturdarm'],
    muscles: [],
    human: '',
    use: 'Bratwurst und Wiener brauchen den knackigen, essbaren und atmungsaktiven Naturdarm (Saitling). Salami nutzt oft Faserdärme auf Zellulosebasis, da sie synchron mit der Wurst mitschrumpfen. Kunststoffdärme (Polymer) sind zwar genial für Lyoner im Ring, da absolut wasserdicht, lassen aber keinen Rauch durch. Wer räuchert, braucht Natur oder Faser.',
    note: '',
  },
  {
    id: 'general-definition-hygiene-haccp',
    kind: 'definition',
    species: 'general',
    name: '💡 Hygiene: Sauber vs. Rein',
    region: 'Mikrobiologie',
    aliases: ['HACCP', 'Keumbrücke', 'Holzbrett', 'Desinfektion', 'Lappen', 'Hygiene'],
    muscles: [],
    human: '',
    use: "Beim Kochen reicht 'sauber', da Hitze alles abtötet. Der Charcutier reift Fleisch über Tage im Wohlfühlklima für Keime – hier zählt nur 'mikrobiologisch rein'. Holzbretter und -griffe sind wegen poröser Bakterienherde im Profi-Handwerk verboten. Vor dem Start ist eine alkoholische Flächendesinfektion Pflicht. Niemals Keumbrücken bauen!",
    note: '',
  },
  {
    id: 'general-definition-temperatur-praezision',
    kind: 'definition',
    species: 'general',
    name: '💡 Das 0°C-Dogma & Schmieren',
    region: 'Kältetechnologie',
    aliases: ['Anfrosten', 'Schmieren', 'Reibung', 'Gefrierpunkt', 'Thermometer', 'Wolfen'],
    muscles: [],
    human: '',
    use: "Fleisch und Speck müssen vor dem Wolfen leicht angefroren sein (ca. -2°C). Dies verleiht ihnen mechanische Stabilität. Die Messer schneiden das Gewebe sauber durch, anstatt es matschig zu quetschen. Quetschen führt zum gefürchteten 'Schmieren' – geschmolzenes Fett umhüllt die Fleischfaser, blockiert die Eiweißbindung und die Wurst verliert ihr Fett beim Brühen.",
    note: '',
  },
  {
    id: 'general-definition-raucharoma',
    kind: 'definition',
    species: 'general',
    name: '💡 Naturrauch vs. Flüssigrauch',
    region: 'Veredelung',
    aliases: ['Liquid Smoke', 'Flüssigrauch', 'Buchenspan', 'Teer', 'PAK', 'Räuchern'],
    muscles: [],
    human: '',
    use: 'Klassischer Naturrauch liefert die traditionelle Farbentwicklung, birgt bei falscher, zu heißer Führung aber das Risiko von Teerstoffen und krebserregenden PAKs auf der Wurst. Flüssigrauch (Liquid Smoke) ist kondensierter Naturrauch, aus dem diese Schadstoffe im Labor mechanisch herausgefiltert wurden – technologisch absolut sauber, präzise und krebssicher.',
    note: '',
  },
  {
    id: 'general-definition-zucker-fermentation',
    kind: 'definition',
    species: 'general',
    name: '💡 Zucker als Salami-Treibstoff',
    region: 'Fermentation',
    aliases: ['Dextrose', 'Lactose', 'Traubenzucker', 'Säuerung', 'pH-Sturz', 'Salami'],
    muscles: [],
    human: '',
    use: 'Zucker (2-5g/kg Dextrose oder Lactose) in der Salami ist kein Süßungsmittel für den Menschen, sondern das Futter für die Starterkulturen. Die Milchsäurebakterien fressen den Zucker und wandeln ihn in Milchsäure um. Dieser kontrollierte pH-Wert-Sturz (Säuerung) zieht das Eiweiß stabil zusammen und macht das Fleisch für Fäulnisbakterien unbewohnbar.',
    note: '',
  },
  {
    id: 'general-definition-salzmenge',
    kind: 'definition',
    species: 'general',
    name: '💡 Die Salzgrenze im Handwerk',
    region: 'Salztechnologie',
    aliases: ['Salzmenge', 'Versalzen', 'Haltbarkeit', 'Feinwaage', 'Salz'],
    muscles: [],
    human: '',
    use: 'Der handwerkliche Standard liegt präzise zwischen 18g und 22g pro Kilo. Zu viel Salz (>25g) macht die Wurst ungenießbar, da sich das Salz durch den Wasserverlust bei der Reifung noch massiv konzentriert. Zudem lähmt ein Salzüberschuss die schützenden Starterkulturen, wodurch salztolerante Fäulniskeime das Rennen um das Fleisch gewinnen können.',
    note: '',
  },
  {
    id: 'general-definition-starterkulturen',
    kind: 'definition',
    species: 'general',
    name: '💡 Starterkulturen: Die Leibwächter',
    region: 'Mikrobiologie',
    aliases: ['Bakterien', 'Milchsäure', 'Hausflora', 'Lotto', 'Botulismus', 'Starterkulturen'],
    muscles: [],
    human: '',
    use: "Konzentrierte, natürliche Milchsäurebakterien und Mikrokokken. Da moderne Wurstküchen glücklicherweise zu sauber sind, fehlt die historische, schützende 'Hausflora' an den Wänden. Wer ohne Starter arbeitet, spielt Bakterien-Lotto. Sie sorgen für einen schnellen, sicheren pH-Wert-Sturz und blockieren gefährliche Erreger wie Clostridium botulinum.",
    note: '',
  },
  {
    id: 'general-definition-poekelsalz-grillen',
    kind: 'definition',
    species: 'general',
    name: '💡 Pökelsalz & Grillen (Euer Vorteil!)',
    region: 'Toxikologie',
    aliases: ['Grillverbot', 'Nitrosamine', 'Bratwurst', 'Grau', 'Ohne NPS', 'Grillen'],
    muscles: [],
    human: '',
    use: 'Wird Nitritpökelsalz (NPS) über 130°C erhitzt (Pfanne/Grill), reagiert das Nitrit mit Fleisch-Aminen zu stark krebserregenden Nitrosaminen! Da wir am StevesHof konsequent mit reinem Speise-/Meersalz arbeiten, besteht bei uns null Risiko. Dass unsere Bratwurst auf dem Grill natürlich grau-braun wird, ist das ehrlichste biologische Gütesiegel für deine Gesundheit!',
    note: '',
  },
  {
    id: 'general-definition-phosphat-check',
    kind: 'definition',
    species: 'general',
    name: '💡 Der Phosphat-Check',
    region: 'Bindungstechnologie',
    aliases: ['Phosphat', 'Kutterhilfsmittel', 'Totenstarre', 'ATP', 'Chemie', 'ohne Chemie'],
    muscles: [],
    human: '',
    use: 'Die Industrie nutzt künstliche Phosphate (Kutterhilfsmittel), um die verhakten Muskelfasern nach der Totenstarre künstlich wieder aufzulösen, damit das Fleisch Wasser bindet. Wir am StevesHof verzichten vollständig auf diese Chemie! Durch unsere ultraschnelle Warmfleisch-Verarbeitung nutzen wir das noch zelleigene, natürliche ATP für die perfekte Bindung.',
    note: '',
  },
  {
    id: 'general-definition-sellerie-extrakt',
    kind: 'definition',
    species: 'general',
    name: '💡 Der Sellerie-Extrakt-Schwindel',
    region: 'Etikettenschwindel',
    aliases: ['Selleriepulver', 'Clean Label', 'Marketing', 'Allergen', 'Sellerie', 'Nitrat'],
    muscles: [],
    human: '',
    use: "Ein Trick der Industrie, um 'ohne Zusatz von NPS' auf die Packung zu drucken. Konzentriertes Selleriepulver ist extrem reich an natürlichem Nitrat, das im Fleisch von Bakterien exakt zu demselben Nitrit umgewandelt wird. Es bietet keinerlei gesundheitlichen Vorteil, führt wegen Ernteschwankungen zu Dosierungs-Blindflug und schleppt Sellerie als starkes Allergen ein.",
    note: '',
  },
  {
    id: 'general-definition-roemer-mythos',
    kind: 'definition',
    species: 'general',
    name: '💡 Salami & Der Römer-Mythos',
    region: 'Handwerksgeschichte',
    aliases: ['Römer', 'Historie', 'Salpeter', 'Verunreinigung', 'Wurstvergiftung', 'Salami'],
    muscles: [],
    human: '',
    use: "Die alten Römer haben Salami nicht ohne Nitrit hergestellt, sondern schlicht unkontrolliert! Ihr Meersalz war massiv mit Salpeter (Nitrat) verunreinigt, was unbemerkt zur Umrötung und Konservierung führte. Wer damals 'reines' Salz ohne Salpeter erwischte, erlitt oft den totalen Produktverlust durch die tödliche Wurstvergiftung (Botulismus).",
    note: '',
  },
  {
    id: 'offal-tongue',
    species: 'offal',
    name: 'Rinderzunge / Schweinezunge',
    region: 'Kopf, Mundhoehle',
    aliases: ['Zunge', 'Beef Tongue', 'Schweinezunge', 'Lengua'],
    muscles: ['M. genioglossus', 'M. hyoglossus', 'Zungenmuskulatur'],
    human: 'Die Zunge – ein sehr feines, muskuloeses Organ im Mund.',
    use: 'Gekocht, gepoekelt in Scheiben, Sulz und Wursteinlage.',
    note: 'Nach dem Schaelen sehr zart; vorher mehrstündig sieden oder poekeln.',
  },
  {
    id: 'offal-liver',
    species: 'offal',
    name: 'Rinderleber / Schweineleber / Gefluegelleber',
    region: 'Bauchraum, unter dem Zwerchfell',
    aliases: ['Leber', 'Liver', 'Foie (Gans/Ente)', 'Gefluegelleber'],
    muscles: ['Lebergewebe (organisch, kein Skelettmuskel)'],
    human: 'Die Leber – zentrales Stoffwechselorgan, kein Muskel, aber festes Gewebe.',
    use: 'Leber Berliner Art, Pastete, Kurzbraten in duennen Scheiben.',
    note: 'Nie durchgaeren; Gefluegelleber besonders zart. Schweineleber vorher entwaessern.',
  },
  {
    id: 'offal-heart',
    species: 'offal',
    name: 'Herz (Rind / Schwein / Gefluegel)',
    region: 'Brustraum, zwischen den Lungen',
    aliases: ['Herz', 'Heart', 'Coeur'],
    muscles: ['Myokard – Herzmuskulatur'],
    human: 'Der Herzmuskel – fester, magerer Muskel mit charakteristischer Faser.',
    use: 'Ragout, in Scheiben kurzgebraten, Gulasch, Wurst.',
    note: 'Mager und fest; Sehnen und Fettkappen vor Zubereitung entfernen.',
  },
  {
    id: 'offal-kidney',
    species: 'offal',
    name: 'Rindernieren / Schweinenieren',
    region: 'Lendenbereich, an der Wirbelsaeule',
    aliases: ['Nieren', 'Kidneys', 'Saure Nierchen'],
    muscles: ['Nierengewebe (organisch)'],
    human: 'Die Niere – paariges Organ im unteren Rueckenbereich.',
    use: 'Saure Nierchen, kurzgebraten, in Sahnesauce.',
    note: 'Muessen vorab gewaessert und entwaessert werden; weisse Kernstruktur entfernen.',
  },
  {
    id: 'offal-oxtail',
    species: 'offal',
    name: 'Ochsenschwanz',
    region: 'Wirbelsaeulen-Ende, Schwanz',
    aliases: ['Oxtail', 'Schwanz', 'Queue de Boeuf'],
    muscles: ['Schwanzmuskulatur mit Wirbelknochen und Sehnen'],
    human: 'Der Schwanz – Wirbel mit umgebendem Fleisch und reichlich Kollagen.',
    use: 'Ochsenschwanzsuppe, Schmoren fuer tiefe Saucen-Aromen.',
    note: 'Kollagenreich; braucht Stunden, liefert dann unvergleichlich kraeftige Saucen.',
  },
  {
    id: 'offal-marrow-bone',
    species: 'offal',
    name: 'Markknochen',
    region: 'Rinder-Roehrenknochen, Mittelschaft',
    aliases: ['Markbein', 'Knochenmark', 'Femur', 'Tibia'],
    muscles: ['Kein Muskel – Knochenmark im Markraum'],
    human: 'Roehrenknochen mit Markhoehle – etwa Oberschenkel- oder Schienbeinknochen.',
    use: 'Ausbacken fuer Knochenmark, Suppen-Fundament, Fonds.',
    note: 'Mark im Ofen oder in Bruhe ausloesen; liefert Tiefe fuer Suppen und Saucen.',
  },
  {
    id: 'offal-tripe',
    species: 'offal',
    name: 'Kutteln / Pansen',
    region: 'Vormagen des Rinds',
    aliases: ['Pansen', 'Flecke', 'Tripe', 'Rinderkutteln'],
    muscles: ['Vormagenepithel (organisch, kein Muskel)'],
    human: 'Der erste Magen – kein Muskel, sondern die Magenwand des Wiederkaeuers.',
    use: 'Kuttelsuppe, Flecke sauer, traditionelle Eintoepfe.',
    note: 'Gründlich reinigen und vorschriftsmäßig blanchieren; lange Kochzeit noetig.',
  },
];

const cutState = {
  initialized: false,
  species: 'all',
  query: '',
};

function getSearchInput() {
  return document.getElementById('cut-glossary-search');
}

function getSearchClearButton() {
  return document.getElementById('cut-glossary-clear');
}

function syncSearchUi() {
  const input = getSearchInput();
  const clear = getSearchClearButton();
  if (input) input.value = cutState.query;
  if (clear) clear.hidden = !cutState.query;
  document.querySelectorAll('.cut-quick-chip').forEach((chip) => {
    const quickQuery = chip.getAttribute('data-cut-quick') || '';
    const active = Boolean(cutState.query) && normalize(cutState.query) === normalize(quickQuery);
    chip.classList.toggle('active-category', active);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyCutSearch(query) {
  cutState.query = query || '';
  syncSearchUi();
  renderCutGlossary();
}

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function matchesCut(cut) {
  const speciesMatch = cutState.species === 'all' || cut.species === cutState.species;
  if (!speciesMatch) return false;

  const query = normalize(cutState.query);
  if (!query) return true;

  const haystack = normalize([
    cut.name,
    cut.region,
    (cut.aliases || []).join(' '),
    (cut.muscles || []).join(' '),
    cut.human,
    cut.use,
    cut.note,
    CUT_SPECIES[cut.species],
  ].join(' '));
  return haystack.includes(query);
}

function isCutDefinition(cut) {
  return cut.kind === 'definition' || String(cut.id || '').includes('-definition-');
}

function renderAliasList(aliases) {
  return (aliases || []).map((alias) => `<span class="cut-alias">${alias}</span>`).join('');
}

function getDefinitionBadgeLabel(cut) {
  const speciesLabel = CUT_SPECIES[cut.species] || 'Allgemein';
  const region = cut.region || '';
  const regionBadges = [
    [/Qualit/i, 'Qualität'],
    [/Rohstoff/i, 'Rohstoff'],
    [/Handwerksgeschichte/i, 'Geschichte'],
    [/Handwerk/i, 'Handwerk'],
    [/Pökel/i, 'Pökel'],
    [/Reife/i, 'Reifung'],
    [/Brühwurst/i, 'Brühwurst'],
    [/Werkzeug/i, 'Werkzeug'],
    [/Veredelung/i, 'Veredelung'],
    [/Gewürz/i, 'Gewürze'],
    [/Verpackung|Hüllen/i, 'Hüllen'],
    [/Mikrobiologie/i, 'Mikro'],
    [/Fermentation/i, 'Fermentation'],
    [/Kält/i, 'Kälte'],
    [/Salz/i, 'Salz'],
    [/Toxikologie/i, 'Toxikologie'],
    [/Bindung/i, 'Bindung'],
    [/Etikett/i, 'Etikett'],
    [/Wurst/i, 'Wurstküche'],
    [/Kontrolle/i, 'QC'],
    [/Warenkunde/i, 'Warenkunde'],
  ];
  for (const [pattern, suffix] of regionBadges) {
    if (pattern.test(region)) return `${speciesLabel} · ${suffix}`;
  }
  return `${speciesLabel} · Campus`;
}

function formatDefinitionTitle(name) {
  return String(name || '').replace(/^💡\s*/, '');
}

function renderCutCard(cut) {
  if (isCutDefinition(cut)) {
    const aliasRow = (cut.aliases || []).length
      ? `<div class="cut-alias-row" aria-label="Weitere Bezeichnungen">${renderAliasList(cut.aliases)}</div>`
      : '';
    return `
    <article class="cut-card cut-card--definition" data-cut-id="${cut.id}">
      <div class="cut-card-head">
        <div class="cut-species cut-species--definition">${getDefinitionBadgeLabel(cut)}</div>
        <h2 class="cut-title cut-title--definition">${formatDefinitionTitle(cut.name)}</h2>
        <p class="cut-region-pill cut-region-pill--definition">${cut.region}</p>
      </div>
      ${aliasRow}
      <p class="cut-definition-body">${cut.use}</p>
    </article>
  `;
  }

  return `
    <article class="cut-card" data-cut-id="${cut.id}">
      <div class="cut-card-head">
        <div class="cut-species">${CUT_SPECIES[cut.species]}</div>
        <h2 class="cut-title">${cut.name}</h2>
        <p class="cut-region-pill">${cut.region}</p>
      </div>
      <div class="cut-alias-row" aria-label="Weitere Bezeichnungen">
        ${renderAliasList(cut.aliases)}
      </div>
      <dl class="cut-facts">
        <div>
          <dt>Fachlich</dt>
          <dd>${cut.muscles.join(', ')}</dd>
        </div>
        <div>
          <dt>Beim Menschen</dt>
          <dd>${cut.human}</dd>
        </div>
        <div>
          <dt>In der Praxis</dt>
          <dd>${cut.use}</dd>
        </div>
      </dl>
      <p class="cut-note">${cut.note}</p>
    </article>
  `;
}

function renderCutGlossary() {
  const list = document.getElementById('cut-glossary-list');
  const count = document.getElementById('cut-glossary-count');
  const empty = document.getElementById('cut-glossary-empty');
  if (!list) return;

  const matches = CUT_GLOSSARY.filter(matchesCut);
  list.innerHTML = matches.map(renderCutCard).join('');
  if (count) count.textContent = `${matches.length} Zuschnitte`;
  if (empty) empty.hidden = matches.length > 0;
  syncSearchUi();
}

function bindSpeciesChips() {
  document.querySelectorAll('[data-cut-species]').forEach((button) => {
    button.addEventListener('click', () => {
      cutState.species = button.getAttribute('data-cut-species') || 'all';
      document.querySelectorAll('.cut-species-chip').forEach((chip) => {
        const active = chip.getAttribute('data-cut-species') === cutState.species;
        chip.classList.toggle('active-category', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderCutGlossary();
    });
  });
}

function bindSearch() {
  const input = getSearchInput();
  const clear = getSearchClearButton();
  if (!input) return;

  input.addEventListener('input', () => {
    cutState.query = input.value || '';
    renderCutGlossary();
  });

  clear?.addEventListener('click', () => {
    applyCutSearch('');
    input.focus();
  });
}

function bindQuickFilters() {
  document.querySelectorAll('.cut-quick-chip').forEach((button) => {
    button.addEventListener('click', () => {
      const query = button.getAttribute('data-cut-quick') || '';
      applyCutSearch(query);
      getSearchInput()?.focus();
    });
  });
}

export function initCutGlossaryModule() {
  if (cutState.initialized) return;
  cutState.initialized = true;
  bindSpeciesChips();
  bindSearch();
  bindQuickFilters();
  renderCutGlossary();
}

export function activateCutGlossaryTab() {
  if (!cutState.initialized) {
    initCutGlossaryModule();
    return;
  }
  renderCutGlossary();
}

export { CUT_GLOSSARY };
