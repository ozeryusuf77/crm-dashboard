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

export const MODELLEN = [
  { id: 'gevel',      label: 'Tegen de gevel',  sub: 'Aanbouw met muurprofiel aan de woning' },
  { id: 'vrijstaand', label: 'Vrijstaand',      sub: 'Losse overkapping met staanders rondom', prijsFactor: 1.18 },
]

export const GOOT_STIJLEN = [
  { id: 'klassiek', label: 'Klassiek', sub: 'Sierlijke ronde goot' },
  { id: 'strak',    label: 'Strak / kubistisch', sub: 'Rechte hoekige goot', prijs: 195 },
]

export const MATEN = {
  breedte: { min: 300, max: 1200, stap: 50,  standaard: 500, label: 'Breedte' },
  diepte:  { min: 250, max: 500,  stap: 50,  standaard: 350, label: 'Diepte (uitval)' },
  hoogte:  { min: 210, max: 270,  stap: 10,  standaard: 230, label: 'Doorloophoogte (onderkant goot)' },
}

// Maximale overspanning tussen twee staanders (m) — bepaalt aantal staanders/vakken.
export const MAX_OVERSPANNING = 5
// Breedte van een dakplaat / tussenruimte tussen liggers (m).
export const PLAAT_BREEDTE = 0.98
// Dakhelling in graden.
export const DAKHELLING = 8

export const KLEUREN = [
  { id: 'ral7016', label: 'Antraciet', ral: 'RAL 7016', hex: '#383e42' },
  { id: 'ral9005', label: 'Zwart',     ral: 'RAL 9005', hex: '#161718' },
  { id: 'ral9001', label: 'Crème wit', ral: 'RAL 9001', hex: '#e6dccb' },
  { id: 'ral9016', label: 'Verkeerswit', ral: 'RAL 9016', hex: '#f1f0ea' },
  { id: 'ral9007', label: 'Grijs aluminium', ral: 'RAL 9007', hex: '#8a8985', prijsFactor: 1.03 },
]

// prijsM2 = prijs per m² dakoppervlak (incl. frame, goot, staanders).
export const DAKKEN = [
  { id: 'poly-helder', groep: 'Polycarbonaat 16 mm', label: 'Helder',             prijsM2: 135, mat: 'polyHelder' },
  { id: 'poly-opaal',  groep: 'Polycarbonaat 16 mm', label: 'Opaal',              prijsM2: 135, mat: 'polyOpaal' },
  { id: 'poly-ir',     groep: 'Polycarbonaat 16 mm', label: 'Opaal IR warmtewerend', prijsM2: 155, mat: 'polyIr' },
  { id: 'glas-helder', groep: 'Gelaagd glas 8,76 mm', label: 'Helder glas',       prijsM2: 185, mat: 'glasHelder' },
  { id: 'glas-mat',    groep: 'Gelaagd glas 8,76 mm', label: 'Mat glas (melkglas)', prijsM2: 205, mat: 'glasMat' },
  { id: 'glas-getint', groep: 'Gelaagd glas 8,76 mm', label: 'Getint zonwerend glas', prijsM2: 225, mat: 'glasGetint' },
]

// Wandtypes. prijsM = prijs per strekkende meter wand.
export const WAND_TYPES = [
  { id: 'open',       label: 'Open',                  sub: 'Geen wand',                         prijsM: 0 },
  { id: 'schuifwand', label: 'Glazen schuifwand',     sub: '10 mm gehard glas, 3–6 rails',      prijsM: 295, bedienbaar: true },
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
}

export const ZIJDES = [
  { id: 'voor',   label: 'Voorzijde' },
  { id: 'links',  label: 'Linkerzijde' },
  { id: 'rechts', label: 'Rechterzijde' },
  { id: 'achter', label: 'Achterzijde', alleenVrijstaand: true },
]

export const STANDAARD_CONFIG = {
  model: 'gevel',
  goot: 'klassiek',
  breedte: MATEN.breedte.standaard,
  diepte: MATEN.diepte.standaard,
  hoogte: MATEN.hoogte.standaard,
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
