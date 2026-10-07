// ─────────────────────────────────────────────────────────────────────────────
// Veranda configurator — alle keuzes, kleuren en (indicatieve) prijzen.
// Pas hier labels, maten en prijzen aan; de 3D-scène en het offerte-overzicht
// lezen alles uit dit bestand.
// ─────────────────────────────────────────────────────────────────────────────

// Prijzen zijn incl. BTW en INDICATIEF. Vervang ze door je eigen prijslijst
// of zet TOON_PRIJZEN op false om alleen "prijs op aanvraag" te tonen.
export const TOON_PRIJZEN = true

export const STAPPEN = [
  { id: 'model',     label: 'Model' },
  { id: 'maten',     label: 'Afmetingen' },
  { id: 'kleur',     label: 'Kleur' },
  { id: 'dak',       label: 'Dakbedekking' },
  { id: 'wanden',    label: 'Wanden' },
  { id: 'zonwering', label: 'Zonwering' },
  { id: 'extra',     label: 'Verlichting & extra' },
  { id: 'offerte',   label: 'Offerte' },
]

// ─── Modellen ────────────────────────────────────────────────────────────────
// Vier verandalijnen. Maten in cm (UI) en meters (profielen). De grenzen volgen
// gangbare specificaties van NL aluminium veranda's (o.a. 600 cm uit één stuk
// bij een goot-veranda, 700 cm bij een kubistisch model, koppelstukken vanaf
// 800 cm bij het overstekmodel). Breder dan `maxDeel` = levering in delen.
export const MODELLEN = [
  {
    id: 'klassiek', label: 'Classic', sub: 'Halfronde goot · hellend dak',
    tekst: 'Tijdloze aanbouwveranda met zichtbaar aflopend dak en een sierlijke halfronde goot.',
    dakvorm: 'hellend', goot: 'rond', helling: 7.5, overstek: 0,
    gootB: 0.2, gootH: 0.2, staander: [0.136, 0.13], ligger: [0.055, 0.122],
    maxDeel: 600, overspanning: { poly: 600, glas: 500 },
    breedte: [300, 1200], diepte: { poly: [250, 700], glas: [250, 400] }, hoogte: [210, 280, 230],
    afvoer: 'zichtbaar', prijsFactor: 1,
  },
  {
    id: 'linea', label: 'Linea', sub: 'Rechte goot · hellend dak',
    tekst: 'Strakke, moderne variant met een rechte goot; zelfde maatvoering als de Classic.',
    dakvorm: 'hellend', goot: 'recht', helling: 7.5, overstek: 0,
    gootB: 0.2, gootH: 0.2, staander: [0.136, 0.13], ligger: [0.055, 0.122],
    maxDeel: 600, overspanning: { poly: 600, glas: 500 },
    breedte: [300, 1200], diepte: { poly: [250, 700], glas: [250, 400] }, hoogte: [210, 280, 230],
    afvoer: 'zichtbaar', prijsFactor: 1.04,
  },
  {
    id: 'kubus', label: 'Cubic', sub: 'Plat ogend dak · robuuste staanders',
    tekst: 'Kubistische veranda zonder zichtbare dakhelling: het dak valt weg achter een strakke omkasting.',
    dakvorm: 'plat', goot: 'kubus', helling: 2.5, overstek: 0,
    gootB: 0.203, gootH: 0.3, staander: [0.2, 0.2], ligger: [0.055, 0.122],
    maxDeel: 700, overspanning: { poly: 700, glas: 600 },
    breedte: [300, 1400], diepte: { poly: [250, 700], glas: [250, 450] }, hoogte: [220, 300, 250],
    afvoer: 'staander', prijsFactor: 1.35,
  },
  {
    id: 'kubus-xl', label: 'Cubic XL', sub: 'Plat dak · 1 m overstek',
    tekst: 'Kubistisch model met een extra meter overstek voorbij de staanders, zodat schuifwanden droog blijven.',
    dakvorm: 'plat', goot: 'kubus', helling: 2.5, overstek: 1,
    gootB: 0.203, gootH: 0.3, staander: [0.155, 0.19], ligger: [0.055, 0.122],
    maxDeel: 790, overspanning: { poly: 700, glas: 600 },
    breedte: [300, 1400], diepte: { poly: [300, 700], glas: [300, 450] }, hoogte: [220, 300, 250],
    afvoer: 'staander', prijsFactor: 1.55,
  },
]

export const BEVESTIGINGEN = [
  { id: 'gevel',      label: 'Tegen de gevel', sub: 'Aanbouw met muurprofiel aan de woning' },
  { id: 'vrijstaand', label: 'Vrijstaand',     sub: 'Losse overkapping met staanders rondom', prijsFactor: 1.18 },
]

// Stapgrootte van de maten (cm). Maatwerk: per 10 cm.
export const MAAT_STAP = { breedte: 10, diepte: 10, hoogte: 5 }
export const MAAT_LABELS = {
  breedte: 'Breedte',
  diepte: 'Diepte (uitval)',
  hoogte: 'Doorloophoogte (onderkant goot)',
}

// Overspanning wordt kleiner bij grote diepte (cm minder per cm diepte boven 400).
export const OVERSPANNING_DIEPTE_FACTOR = 0.5
// Breedte van een dakplaat (m); liggers staan op ±1 m hart-op-hart.
export const PLAAT_BREEDTE = 0.98

// Glazen schuifwand: paneel max 103 cm, 20 mm overlap, 2 t/m 7 sporen
// (3-spoor tot 305 cm, 4 tot 405, 5 tot 505, 6 tot 605, 7 tot 705 cm).
export const SCHUIFWAND = { paneelMax: 1.03, overlap: 0.02, minSporen: 2, maxSporen: 7 }

export const KLEUREN = [
  { id: 'ral7016', label: 'Antraciet', ral: 'RAL 7016', hex: '#383e42' },
  { id: 'ral9005', label: 'Zwart',     ral: 'RAL 9005', hex: '#161718' },
  { id: 'ral9001', label: 'Crème wit', ral: 'RAL 9001', hex: '#e6dccb' },
  { id: 'ral9016', label: 'Verkeerswit', ral: 'RAL 9016', hex: '#f1f0ea' },
  { id: 'ral9007', label: 'Grijs aluminium', ral: 'RAL 9007', hex: '#8a8985', prijsFactor: 1.03 },
]

// prijsM2 = prijs per m² dakoppervlak (incl. frame, goot, staanders).
export const DAKKEN = [
  { id: 'poly-helder', soort: 'poly', groep: 'Polycarbonaat 16 mm', label: 'Helder',                prijsM2: 135, mat: 'polyHelder' },
  { id: 'poly-opaal',  soort: 'poly', groep: 'Polycarbonaat 16 mm', label: 'Opaal',                 prijsM2: 135, mat: 'polyOpaal' },
  { id: 'poly-ir',     soort: 'poly', groep: 'Polycarbonaat 16 mm', label: 'Opaal IR warmtewerend', prijsM2: 155, mat: 'polyIr' },
  { id: 'glas-helder', soort: 'glas', groep: 'Gelaagd glas 8,76 mm', label: 'Helder glas',          prijsM2: 185, mat: 'glasHelder' },
  { id: 'glas-mat',    soort: 'glas', groep: 'Gelaagd glas 8,76 mm', label: 'Mat glas (melkglas)',  prijsM2: 205, mat: 'glasMat' },
  { id: 'glas-getint', soort: 'glas', groep: 'Gelaagd glas 8,76 mm', label: 'Getint zonwerend glas', prijsM2: 225, mat: 'glasGetint' },
]

// Wandtypes. prijsM = prijs per strekkende meter wand.
export const WAND_TYPES = [
  { id: 'open',       label: 'Open',                  sub: 'Geen wand',                         prijsM: 0 },
  { id: 'schuifwand', label: 'Glazen schuifwand',     sub: '10 mm gehard glas, 2–7 sporen',     prijsM: 295, bedienbaar: true },
  { id: 'schuifpui',  label: 'Aluminium schuifpui',   sub: 'Geïsoleerd, HR++ dubbel glas',      prijsM: 720, bedienbaar: true },
  { id: 'vastglas',   label: 'Vaste glazen wand',     sub: '10 mm gehard glas in profiel',       prijsM: 230 },
  { id: 'dicht',      label: 'Dichte aluminium wand', sub: 'Rabatprofiel in framekleur',        prijsM: 265 },
]

export const GLAS_SOORTEN = [
  { id: 'helder', label: 'Helder' },
  { id: 'getint', label: 'Getint grijs', prijsFactor: 1.12 },
  { id: 'mat',    label: 'Matglas',      prijsFactor: 1.15 },
]

export const OPEN_RICHTINGEN = [
  { id: 'links',  label: 'Naar links' },
  { id: 'rechts', label: 'Naar rechts' },
  { id: 'midden', label: 'Vanuit midden' },
]

// Spie = driehoek boven de zijwand, onder het schuine dak. prijsM = per meter diepte.
export const SPIE_TYPES = [
  { id: 'geen', label: 'Geen spie', prijsM: 0 },
  { id: 'glas', label: 'Glazen spie', prijsM: 125 },
  { id: 'poly', label: 'Polycarbonaat spie', prijsM: 85 },
  { id: 'alu',  label: 'Aluminium spie', prijsM: 110 },
]

export const DOEK_KLEUREN = [
  { id: 'antraciet', label: 'Antraciet', hex: '#3a3d40' },
  { id: 'grijs',     label: 'Grijs',     hex: '#8c8f91' },
  { id: 'zand',      label: 'Zand',      hex: '#cdbb98' },
  { id: 'wit',       label: 'Wit',       hex: '#ecebe6' },
  { id: 'zwart',     label: 'Zwart',     hex: '#1d1e20' },
]

export const ZONWERING = {
  onderdak: { label: 'Onderdak zonwering', sub: 'Doek onder het dak, elektrisch', prijsM2: 95 },
  bovendak: { label: 'Bovendak zonwering', sub: 'Doek boven het dak, houdt warmte buiten', prijsM2: 165 },
  screen:   { label: 'Verticaal screen (ritsscreen)', sub: 'Elektrisch, windvast met rits', prijsM: 340 },
}

export const SPOTS_OPTIES = [0, 6, 8, 10, 12]

export const EXTRA_PRIJZEN = {
  spot: 45,          // per LED-spot
  dimmer: 85,        // dimmer + afstandsbediening
  ledStrip: 29,      // per meter LED-strip in de goot
  heater: 349,       // per infrarood heater
  montageBasis: 395, // voorrijden + montage
  montageM2: 18,     // per m² overkapping
  koppelset: 295,    // per koppeling (koppelstuk goot + muurprofiel, koppelstaander)
  staander: 165,     // per extra staander boven 2 per staanderlijn
}

export const ZIJDES = [
  { id: 'voor',   label: 'Voorzijde' },
  { id: 'links',  label: 'Linkerzijde' },
  { id: 'rechts', label: 'Rechterzijde' },
  { id: 'achter', label: 'Achterzijde', alleenVrijstaand: true },
]

export const STANDAARD_CONFIG = {
  model: 'klassiek',
  bevestiging: 'gevel',
  breedte: 500,
  diepte: 350,
  hoogte: 230,
  kleur: 'ral7016',
  dak: 'poly-opaal',
  // Per zijde een standaardwand; per vak overschrijfbaar met sleutel "voor#1" etc.
  wanden: {
    voor:   { type: 'open', glas: 'helder', richting: 'links' },
    links:  { type: 'open', glas: 'helder', richting: 'links' },
    rechts: { type: 'open', glas: 'helder', richting: 'rechts' },
    achter: { type: 'open', glas: 'helder', richting: 'links' },
  },
  spie: { links: 'geen', rechts: 'geen' },
  zonwering: {
    onderdak: false,
    bovendak: false,
    screens: { voor: false, links: false, rechts: false, achter: false },
    doek: 'antraciet',
  },
  extra: { spots: 0, dimmer: false, ledStrip: false, heater: 0, montage: true },
}

export const vind = (lijst, id) => lijst.find(o => o.id === id) || lijst[0]

// Toegestane maten (cm) voor een model met de gekozen dakbedekking.
export function maatGrenzen(cfg) {
  const m = vind(MODELLEN, cfg.model)
  const soort = vind(DAKKEN, cfg.dak).soort
  return {
    breedte: { min: m.breedte[0], max: m.breedte[1], stap: MAAT_STAP.breedte },
    diepte: { min: m.diepte[soort][0], max: m.diepte[soort][1], stap: MAAT_STAP.diepte },
    hoogte: { min: m.hoogte[0], max: m.hoogte[1], stap: MAAT_STAP.hoogte },
  }
}

// Houdt breedte/diepte/hoogte binnen de grenzen van model + dak.
export function begrensMaten(cfg) {
  const g = maatGrenzen(cfg)
  const clamp = (v, { min, max, stap }) => {
    const x = Number(v)
    if (!Number.isFinite(x)) return min
    return Math.min(max, Math.max(min, Math.round(x / stap) * stap))
  }
  return { ...cfg, breedte: clamp(cfg.breedte, g.breedte), diepte: clamp(cfg.diepte, g.diepte), hoogte: clamp(cfg.hoogte, g.hoogte) }
}
