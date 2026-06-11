const CUT_SPECIES = {
  all: 'Alle',
  beef: 'Rind',
  pork: 'Schwein',
  lamb: 'Lamm',
};

const CUT_GLOSSARY = [
  {
    id: 'beef-ribeye',
    species: 'beef',
    name: 'Entrecote / Ribeye',
    region: 'Ruecken, vorderer bis mittlerer Rippenbereich',
    aliases: ['Hochrippe', 'Rostbraten', 'Rib Eye', 'Cube Roll'],
    muscles: ['M. longissimus thoracis', 'M. spinalis dorsi'],
    human: 'Rueckenstrecker entlang der Brustwirbelsaeule; der Fettdeckel entspricht grob dem seitlichen oberen Ruecken.',
    use: 'Kurzbraten, Steak, Roastbeef-artige Zuschnitte. Stark marmorierte Stuecke bleiben saftig.',
    note: 'Regional werden Entrecote, Hochrippe und Rostbraten nicht immer deckungsgleich genutzt.',
  },
  {
    id: 'beef-striploin',
    species: 'beef',
    name: 'Roastbeef / Striploin',
    region: 'Ruecken, Lendenbereich hinter der Hochrippe',
    aliases: ['Beiried', 'Rumpsteak', 'Strip Loin', 'Sirloin Strip'],
    muscles: ['M. longissimus lumborum'],
    human: 'Langer Rueckenstrecker im unteren Ruecken, neben der Lendenwirbelsaeule.',
    use: 'Steaks, Roastbeef am Stueck, kalter Aufschnitt.',
    note: 'Nicht mit Filet verwechseln: Filet liegt innen unter der Wirbelsaeule, Roastbeef aussen.',
  },
  {
    id: 'beef-tenderloin',
    species: 'beef',
    name: 'Filet',
    region: 'Innere Lende unter der Wirbelsaeule',
    aliases: ['Lungenbraten', 'Tenderloin', 'Psoas'],
    muscles: ['M. psoas major', 'M. iliacus'],
    human: 'Hueftbeuger tief im Becken und unteren Ruecken.',
    use: 'Kurzbraten, Medaillons, Tournedos, Chateaubriand.',
    note: 'Sehr zart, aber mager; zu langes Garen macht es trocken.',
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
    name: 'Semerrolle',
    region: 'Keule, hinterer Unterschalenbereich',
    aliases: ['Rolle', 'Eye of Round', 'Weisses Scherzel'],
    muscles: ['M. semitendinosus'],
    human: 'Einer der ischiokruralen Muskeln an der Rueckseite des Oberschenkels.',
    use: 'Schmorbraten, Sauerbraten, Poekeln, duenn aufgeschnitten.',
    note: 'Sehr mager und faserig; braucht Feuchtigkeit oder sehr praezise Garung.',
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
    use: 'Kurz grillen, quer zur Faser schneiden, Marinaden.',
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
    use: 'Sehr heiss kurzbraten, Fajitas, Steaks mit kraeftigem Geschmack.',
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
    use: 'Kurzbraten nach sauberem Entfernen der Mittelsehne.',
    note: 'Fachlich nicht dasselbe wie Skirt Steak, auch wenn es in Listen oft zusammenrutscht.',
  },
  {
    id: 'beef-brisket',
    species: 'beef',
    name: 'Brust / Brisket',
    region: 'Vorderviertel, Brustbein und vordere Rippen',
    aliases: ['Brustkern', 'Brustspitz', 'Flat', 'Point'],
    muscles: ['M. pectoralis profundus', 'M. pectoralis superficialis'],
    human: 'Brustmuskulatur, grob grosser und kleiner Brustmuskel.',
    use: 'Sieden, Poekeln, Pastrami, Low-and-slow BBQ.',
    note: 'Flat und Point sind unterschiedliche Teilstuecke mit sehr verschiedener Fettstruktur.',
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
    use: 'Koteletts, Schnitzel aus dem Ruecken, Kasseler, Braten.',
    note: 'Schweinelachs ist der ausgeloeste magere Ruecken, Karree meist mit Knochen.',
  },
  {
    id: 'pork-tenderloin',
    species: 'pork',
    name: 'Schweinefilet',
    region: 'Innere Lende unter der Wirbelsaeule',
    aliases: ['Lungenbraten', 'Tenderloin'],
    muscles: ['M. psoas major'],
    human: 'Hueftbeuger tief im Becken und unteren Ruecken.',
    use: 'Medaillons, Kurzbraten, Filet im Speckmantel.',
    note: 'Mager und schnell gar; nicht mit Schweinelachs verwechseln.',
  },
  {
    id: 'pork-ham-topside',
    species: 'pork',
    name: 'Oberschale',
    region: 'Schinken, innere Keulenseite',
    aliases: ['Topside', 'Schnitzelschale'],
    muscles: ['M. semimembranosus', 'Adduktorengruppe'],
    human: 'Innere und hintere Oberschenkelmuskulatur.',
    use: 'Schnitzel, Braten, Kochschinken, magere Wursteinlage.',
    note: 'Sehr mager; bei Braten vor Austrocknung schuetzen.',
  },
  {
    id: 'pork-ham-knuckle',
    species: 'pork',
    name: 'Nuss / Kugel',
    region: 'Schinken, vorderer Keulenbereich',
    aliases: ['Kugel', 'Knuckle', 'Schinkennuss'],
    muscles: ['M. rectus femoris', 'M. vastus lateralis', 'M. vastus medialis'],
    human: 'Vordere Oberschenkelmuskulatur, also Quadrizeps.',
    use: 'Schnitzel, Braten, Kochschinken, feine Wuerfel.',
    note: 'Kompakter Zuschnitt mit mehreren Muskelanteilen und sauberer Form.',
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
    use: 'Schmorbraten, Pulled Pork, Gulasch, Wurstfleisch.',
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
    id: 'lamb-leg',
    species: 'lamb',
    name: 'Keule',
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
    use: 'Karree, Koteletts, Lammruecken rosa gebraten.',
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
];

const cutState = {
  initialized: false,
  species: 'all',
  query: '',
};

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
    cut.aliases.join(' '),
    cut.muscles.join(' '),
    cut.human,
    cut.use,
    cut.note,
    CUT_SPECIES[cut.species],
  ].join(' '));
  return haystack.includes(query);
}

function renderAliasList(aliases) {
  return aliases.map((alias) => `<span class="cut-alias">${alias}</span>`).join('');
}

function renderCutCard(cut) {
  return `
    <article class="cut-card" data-cut-id="${cut.id}">
      <div class="cut-card-head">
        <div>
          <div class="cut-species">${CUT_SPECIES[cut.species]}</div>
          <h2 class="cut-title">${cut.name}</h2>
        </div>
        <span class="cut-region-pill">${cut.region}</span>
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
  if (count) count.textContent = `${matches.length} Cuts`;
  if (empty) empty.hidden = matches.length > 0;
}

function bindSpeciesChips() {
  document.querySelectorAll('[data-cut-species]').forEach((button) => {
    button.addEventListener('click', () => {
      cutState.species = button.getAttribute('data-cut-species') || 'all';
      document.querySelectorAll('[data-cut-species]').forEach((chip) => {
        const active = chip.getAttribute('data-cut-species') === cutState.species;
        chip.classList.toggle('active-category', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      renderCutGlossary();
    });
  });
}

function bindSearch() {
  const input = document.getElementById('cut-glossary-search');
  const clear = document.getElementById('cut-glossary-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    cutState.query = input.value || '';
    if (clear) clear.hidden = !cutState.query;
    renderCutGlossary();
  });

  clear?.addEventListener('click', () => {
    input.value = '';
    cutState.query = '';
    clear.hidden = true;
    input.focus();
    renderCutGlossary();
  });
}

export function initCutGlossaryModule() {
  if (cutState.initialized) return;
  cutState.initialized = true;
  bindSpeciesChips();
  bindSearch();
  renderCutGlossary();
}

export function activateCutGlossaryTab() {
  renderCutGlossary();
}

export { CUT_GLOSSARY };
