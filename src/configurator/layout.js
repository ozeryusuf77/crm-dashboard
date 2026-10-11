// Leidt alle 3D-maten (in meters) af uit de configuratie.
// Assenstelsel: x = breedte (midden = 0), y = omhoog (0 = terrasreferentie), z = diepte
// (z = 0 bij de gevel, +z richting tuin).
import {
  MODELLEN, DAKKEN, PLAAT_BREEDTE, OVERSPANNING_DIEPTE_FACTOR, SCHUIFWAND, SCHUIFPUI,
  AFVOER, AFVOER_RICHTINGEN, AFVOER_UITLOPEN, STANDAARD_CONFIG, begrensMaten, vind,
} from './options.js'

export const MUURPROFIEL_D = 0.08  // diepte muurprofiel
const ZIJBALK = 0.06               // zijbalk onder de spie (hellend dak)

// Bovenkant van de terrasvloer boven de terrasreferentie (y = 0): tegels liggen
// 1 cm hoog, een vlonder 3 cm. Staanders, wanden en screens beginnen op L.vloerY.
export const VLOER_Y = { tegels: 0.01, vlonder: 0.03 }

const kiesVloer = (...kandidaten) => kandidaten.find(v => VLOER_Y[v] != null) || 'vlonder'

// `vloer` leest standaard cfg.vloer; het optie-argument is alleen een override.
export function maakLayout(cfg, { vloer } = {}) {
  const M = vind(MODELLEN, cfg.model)
  const soort = vind(DAKKEN, cfg.dak).soort
  const W = cfg.breedte / 100
  const D = cfg.diepte / 100
  const Hf = cfg.hoogte / 100
  const vrijstaand = cfg.bevestiging === 'vrijstaand'
  const kubus = M.dakvorm === 'plat'
  const [sB, sD] = M.staander
  const [lB, lH] = M.ligger
  const { gootB, gootH, overstek } = M
  const vloerKeuze = kiesVloer(vloer, cfg.vloer)
  const vloerY = VLOER_Y[vloerKeuze]

  // Goot/omkasting voor loopt van z = D - gootB tot D; liggers eindigen op de hartlijn.
  const zGoot = D - gootB / 2
  const zVoorStaander = overstek ? D - overstek : zGoot
  const zAchter = vrijstaand ? gootB / 2 : MUURPROFIEL_D
  const lengteDak = zGoot - zAchter

  // Dakvlak (bovenkant liggers), aflopend naar de goot.
  let helling, yDakAchter, yRand = null
  if (kubus) {
    // Plat ogend: het dak ligt binnen de omkasting; de helling mag nooit onder de rand uitkomen.
    yRand = Hf + gootH
    const maxVal = gootH - 0.035 - lH - 0.01
    helling = Math.min((M.helling * Math.PI) / 180, Math.atan(maxVal / lengteDak))
    yDakAchter = yRand - 0.035
  } else {
    helling = (M.helling * Math.PI) / 180
    yDakAchter = Hf + gootH - 0.02 + lengteDak * Math.tan(helling)
  }
  const dakY = z => yDakAchter - (z - zAchter) * Math.tan(helling)
  const yDakVoor = dakY(zGoot)

  // ── Delen en koppelingen ───────────────────────────────────────────────────
  // Breder dan het maximum uit één stuk → gelijke delen, gekoppeld in goot en
  // muurprofiel, met altijd een staander onder elke koppeling.
  const maxDeel = M.maxDeel / 100
  const nDelen = Math.max(1, Math.ceil(W / maxDeel - 1e-9))
  const deelB = W / nDelen
  const delen = Array.from({ length: nDelen }, (_, i) => {
    const x0 = -W / 2 + i * deelB
    return { x0, x1: x0 + deelB, breedte: deelB, midden: x0 + deelB / 2 }
  })
  const koppelingen = delen.slice(1).map(d => d.x0)

  // ── Staanders ───────────────────────────────────────────────────────────────
  const overspanning = (M.overspanning[soort] - Math.max(0, cfg.diepte - 400) * OVERSPANNING_DIEPTE_FACTOR) / 100
  const xStaanders = []
  delen.forEach((d, i) => {
    const a = i === 0 ? -W / 2 + sB / 2 : d.x0
    const b = i === nDelen - 1 ? W / 2 - sB / 2 : d.x1
    const n = Math.max(1, Math.ceil((b - a) / overspanning - 1e-9))
    for (let k = 0; k <= n; k++) {
      const x = a + (k * (b - a)) / n
      if (!xStaanders.some(p => Math.abs(p - x) < 1e-6)) xStaanders.push(x)
    }
  })
  const vakken = []
  for (let i = 0; i < xStaanders.length - 1; i++) {
    const x0 = xStaanders[i] + sB / 2
    const x1 = xStaanders[i + 1] - sB / 2
    vakken.push({ x0, x1, breedte: x1 - x0, midden: (x0 + x1) / 2 })
  }

  // ── Liggers en dakplaten (per deel; op een koppeling een dubbele ligger) ───
  const liggers = []
  const platen = []
  delen.forEach((d, i) => {
    const a = i === 0 ? -W / 2 + lB / 2 : d.x0 + lB / 2 + 0.002
    const b = i === nDelen - 1 ? W / 2 - lB / 2 : d.x1 - lB / 2 - 0.002
    // Zoveel platen dat geen plaat breder wordt dan PLAAT_BREEDTE (plaat = h.o.h. − ligger + 12 mm opleg).
    const n = Math.max(1, Math.ceil((b - a) / (PLAAT_BREEDTE + lB - 0.012) - 1e-9))
    for (let k = 0; k <= n; k++) {
      const x = a + (k * (b - a)) / n
      liggers.push({ x, koppel: (k === 0 && i > 0) || (k === n && i < nDelen - 1) })
      if (k < n) {
        const p0 = x + lB / 2, p1 = a + ((k + 1) * (b - a)) / n - lB / 2
        platen.push({ x: (p0 + p1) / 2, b: p1 - p0 + 0.012 })
      }
    }
  })
  const xLiggers = liggers.map(l => l.x)

  // ── Wanden ─────────────────────────────────────────────────────────────────
  const achterBalkOnder = kubus ? Hf : yDakAchter - gootH + 0.02
  const wandH = {
    voor: Hf,
    zij: kubus ? Hf : Hf - ZIJBALK,
    achter: achterBalkOnder,
  }
  const zijX = W / 2 - sB / 2
  const zijZ0 = vrijstaand ? zAchter + sD / 2 : MUURPROFIEL_D + 0.01
  const zijZ1 = zVoorStaander - sD / 2

  // ── Erf (woning, schutting, gazon, terras) ─────────────────────────────────
  // hoofd = breedte van de hoofdwoning, erfX = halve erfbreedte (schutting op ±erfX),
  // tuinD = diepte van het erf vanaf de gevel, terras = verandamaat + 15 cm rondom.
  const hoofd = Math.max(W + 3.2, 6.6)
  const erf = {
    hoofd,
    erfX: vrijstaand ? W / 2 + 3 : hoofd / 2,
    tuinD: D + 8,
    terrasW: W + 0.3,
    terrasD: D + 0.3,
  }

  // ── Hemelwaterafvoer door de voorste hoekstaander(s) ───────────────────────
  const afvoer = normaliseerAfvoer(cfg.afvoer)
  const afvoeren = berekenAfvoeren(afvoer, { M, W, Hf, kubus, overstek, sB, sD, zGoot, zVoorStaander, vloerY })

  return {
    M, model: M.id, soort, W, D, Hf, vrijstaand, kubus, overstek,
    sB, sD, lB, lH, gootB, gootH, goot: M.goot, helling,
    zGoot, zVoorStaander, zAchter, lengteDak, dakY, yDakVoor, yDakAchter, yRand,
    delen, koppelingen, deelB, maxDeel, overspanning,
    xStaanders, vakken, liggers, xLiggers, platen,
    achterBalkOnder, wandH, zijBalk: ZIJBALK,
    zij: { x: zijX, z0: zijZ0, z1: zijZ1, lengte: zijZ1 - zijZ0 },
    spieMogelijk: !kubus,
    oppervlak: W * D,
    vloer: vloerKeuze, vloerY,
    erf,
    afvoer, afvoeren,
  }
}

// ─── Hemelwaterafvoer ────────────────────────────────────────────────────────
const RICHTING_IDS = AFVOER_RICHTINGEN.map(r => r.id)
const UITLOOP_IDS = AFVOER_UITLOPEN.map(u => u.id)
const KANTEN = [
  { kant: 'links', s: -1 },
  { kant: 'rechts', s: 1 },
]
export const AFVOER_KANT_TEKST = { links: 'linker', rechts: 'rechter' }

// Een staanderwaarde uit een (oude of foute) configuratie naar een geldige richting of null.
// Onbekende tekst of `true` → buitenwaarts (de bedoeling was "wél een afvoer"); leeg → null.
function geldigeRichting(v, kant) {
  if (v == null || v === false || v === '') return null
  if (typeof v === 'string' && RICHTING_IDS.includes(v)) return v
  return kant
}

// Geeft altijd een compleet afvoer-object terug, ook voor oude deellinks zonder
// afvoer-veld. Dwingt géén regels af (dat doet begrensAfvoer).
export function normaliseerAfvoer(afvoer) {
  const std = STANDAARD_CONFIG.afvoer
  const a = afvoer && typeof afvoer === 'object' ? afvoer : {}
  const veld = (k, waarde) => (a[k] === undefined ? std[k] : waarde(a[k]))
  return {
    links: veld('links', v => geldigeRichting(v, 'links')),
    rechts: veld('rechts', v => geldigeRichting(v, 'rechts')),
    uitloop: veld('uitloop', v => (UITLOOP_IDS.includes(v) ? v : std.uitloop)),
    bladvanger: veld('bladvanger', v => v === true || v === 'true' || v === 1),
  }
}

// Alle maten van één afvoer in de buitenste voorstaander aan kant `kant`.
// top = gootuitloop, gat = uitloopgat in het staandervlak, mond = einde van bocht/kapje,
// grond = inslagpunt op het terras, pad = hartlijn van het water van top tot grond.
function maakAfvoer({ kant, s }, richting, afvoer, { M, W, Hf, kubus, overstek, sB, sD, zGoot, zVoorStaander, vloerY }) {
  const R = vind(AFVOER_RICHTINGEN, richting)
  const [nx, nz] = R.n
  const x = s * (W / 2 - sB / 2)
  const z = zVoorStaander
  const { buis, gootBodem } = M.afvoer
  const r = buis                                  // bochtstraal (hartlijn)
  const vlak = nx ? sB / 2 : sD / 2               // hart staander → vlak met het gat
  const yGat = vloerY + AFVOER.uitloopH
  const top = [x, Hf + gootBodem + (kubus ? 0 : 0.005), zGoot]

  // Verticale buis: bij goot-modellen begint de buis onder het verloopstuk (Hf − 0,08),
  // bij Cubic direct onder de omkasting; bij Cubic XL eerst 1 m horizontaal in de zijomkasting.
  const pad = [top]
  if (overstek) pad.push([x, Hf + 0.05, zGoot - 0.03], [x, Hf + 0.035, z])
  pad.push([x, Hf - (kubus ? 0.02 : 0.08), z])

  const basis = { kant, s, x, z, richting, n: [nx, nz], vlak, buis, uitloop: afvoer.uitloop, bladvanger: afvoer.bladvanger, top }

  if (richting === 'onder') {
    // Door de voetplaat omlaag en onder het maaiveld richting gevel/regenpijp/riool.
    pad.push([x, vloerY, z], [x, -AFVOER.grondbuis, z], [x, -AFVOER.grondbuis, z - 0.6])
    return { ...basis, gat: null, mond: null, grond: null, pad }
  }

  const gat = [x + nx * vlak, yGat, z + nz * vlak]
  let mond, uitsteekBuis
  if (afvoer.uitloop === 'kapje') {
    // Kapje 0,08 × 0,06 × 0,06 met open onderkant; het water verlaat het kapje op 4 cm uit het vlak.
    const u = AFVOER.kapje[2] - 0.02
    mond = [x + nx * (vlak + u), yGat - AFVOER.kapje[1] / 2 - 0.004, z + nz * (vlak + u)]
    uitsteekBuis = u - 0.01
  } else {
    // PVC-bocht: recht stuk (stub), kwartbocht met straal r, kort been omlaag.
    const u = vlak + AFVOER.stub + r
    mond = [x + nx * u, yGat - r - AFVOER.been, z + nz * u]
    uitsteekBuis = AFVOER.stub
  }
  const grond = [mond[0], vloerY, mond[2]]
  pad.push(
    [x, yGat + r, z],                               // begin binnenbocht
    [x + nx * r, yGat, z + nz * r],                 // einde binnenbocht, horizontaal naar het gat
    gat,
    [gat[0] + nx * uitsteekBuis, yGat, gat[2] + nz * uitsteekBuis],
    mond,
    grond,
  )
  return { ...basis, gat, mond, grond, pad }
}

// L.afvoeren: 0–2 items, alleen voor de twee buitenste voorstaanders met een richting.
function berekenAfvoeren(afvoer, maten) {
  return KANTEN.filter(k => afvoer[k.kant]).map(k => maakAfvoer(k, afvoer[k.kant], afvoer, maten))
}

// Aantal verplichte afvoeren: één Ø 50-uitloop verwerkt ca. 35 m², Ø 60 ca. 55 m² dak.
export function afvoerMinimum(L) {
  return L.oppervlak > L.M.afvoer.m2 ? 2 : 1
}

// Advies: bij een veranda in delen in beide hoekstaanders (niet afgedwongen).
export function afvoerAdvies(L) {
  return L.delen.length > 1 ? 2 : afvoerMinimum(L)
}

const wandType = (cfg, key) => (cfg.wanden ? wandVoor(cfg, key)?.type : null) || 'open'

// Welke uitlooprichtingen mogelijk zijn voor de staander aan `kant` ('links'|'rechts'):
// buitenwaarts en ondergronds altijd; binnenwaarts alleen bij een open voorwand van het
// buitenste vak (anders staat de onderrail in de weg); naar voren niet onder een voorscreen;
// naar achteren alleen bij een open zijwand (de onderrail eindigt tegen het achtervlak).
export function afvoerOpties(cfg, L, kant) {
  const binnenwaarts = kant === 'links' ? 'rechts' : 'links'
  const vakKey = kant === 'links' ? 'voor#0' : `voor#${Math.max(0, L.vakken.length - 1)}`
  const voorwandDicht = wandType(cfg, vakKey) !== 'open'
  const zijwandDicht = wandType(cfg, kant) !== 'open'
  const voorScreen = !!cfg.zonwering?.screens?.voor
  return AFVOER_RICHTINGEN.map(r => {
    let reden = null, hint = null
    if (r.id === binnenwaarts && voorwandDicht) reden = 'hier staat de voorwand (onderrail)'
    else if (r.id === 'voor' && voorScreen) reden = 'hier hangt het screen'
    else if (r.id === 'achter' && zijwandDicht) reden = 'hier staat de zijwand'
    if (!reden && r.id === 'achter') hint = 'Het water komt onder de veranda uit; combineer met een putje of kies Ondergronds.'
    if (!reden && r.id === 'voor' && L.overstek) hint = 'De uitloop komt onder het overstek uit.'
    return { ...r, mogelijk: !reden, disabled: !!reden, reden, hint }
  })
}

// Maakt cfg.afvoer geldig: vult ontbrekende velden aan, dwingt het minimum af en zet een
// onmogelijke richting om naar buitenwaarts. Geeft Nederlandse meldingen voor elke correctie.
// Draait bij elke zet() (na herverdeelVakWanden) en in leesUrlConfig; crasht niet op een lege cfg.
export function begrensAfvoer(cfg) {
  const meldingen = []
  const afvoer = normaliseerAfvoer(cfg?.afvoer)
  // Veilige kopie voor de layout: ontbrekende velden uit de standaardconfig, maten binnen de grenzen.
  const basis = begrensMaten({
    ...STANDAARD_CONFIG, ...cfg,
    wanden: { ...STANDAARD_CONFIG.wanden, ...cfg?.wanden },
    zonwering: { ...STANDAARD_CONFIG.zonwering, ...cfg?.zonwering, screens: { ...STANDAARD_CONFIG.zonwering.screens, ...cfg?.zonwering?.screens } },
    afvoer,
  })
  const L = maakLayout(basis)
  const m2 = L.oppervlak.toFixed(1).replace('.', ',')

  if (!afvoer.links && !afvoer.rechts) {
    afvoer.rechts = 'rechts'
    meldingen.push('Minimaal één afvoer: hemelwaterafvoer ingesteld in de rechter hoekstaander.')
  }
  if (afvoerMinimum(L) === 2) {
    for (const { kant } of KANTEN) {
      if (afvoer[kant]) continue
      afvoer[kant] = kant
      meldingen.push(`Afvoer toegevoegd in de ${AFVOER_KANT_TEKST[kant]} hoekstaander: bij ${m2} m² dak zijn twee afvoeren nodig (max. ${L.M.afvoer.m2} m² per afvoer).`)
    }
  }
  for (const { kant } of KANTEN) {
    const richting = afvoer[kant]
    if (!richting) continue
    const optie = afvoerOpties(basis, L, kant).find(o => o.id === richting)
    if (optie.mogelijk) continue
    afvoer[kant] = kant
    const label = vind(AFVOER_RICHTINGEN, kant).label.toLowerCase()
    meldingen.push(`Uitloop ${AFVOER_KANT_TEKST[kant]} staander aangepast naar '${label}': ${optie.reden}.`)
  }
  return { cfg: { ...cfg, afvoer }, meldingen }
}

// Alle wand-slots (plekken waar een wand kan komen) voor deze layout.
export function wandSlots(layout) {
  const slots = []
  layout.vakken.forEach((v, i) => slots.push({ key: `voor#${i}`, zijde: 'voor', vak: i, lengte: v.breedte }))
  slots.push({ key: 'links', zijde: 'links', vak: 0, lengte: layout.zij.lengte })
  slots.push({ key: 'rechts', zijde: 'rechts', vak: 0, lengte: layout.zij.lengte })
  if (layout.vrijstaand) {
    layout.vakken.forEach((v, i) => slots.push({ key: `achter#${i}`, zijde: 'achter', vak: i, lengte: v.breedte }))
  }
  return slots
}

// Wand-instelling voor een slot: per-vak overschrijving, anders de zijde-standaard.
export function wandVoor(cfg, slotKey) {
  const zijde = slotKey.split('#')[0]
  return cfg.wanden[slotKey] || cfg.wanden[zijde]
}

// Aantal glaspanelen (= sporen) van een glazen schuifwand: panelen van max 103 cm
// met 20 mm overlap; 3-spoor tot 305 cm, 4 tot 405 … 7-spoor tot ±705 cm.
export function aantalSchuifPanelen(breedte) {
  const { paneelMax, overlap, minSporen, maxSporen } = SCHUIFWAND
  const n = Math.ceil((breedte - overlap) / (paneelMax - overlap) - 1e-9)
  return Math.min(maxSporen, Math.max(minSporen, n))
}

// Breedte van één vleugel van een n-delige schuifpui (kozijn eraf, vleugels overlappen elkaar).
export function puiVleugelBreedte(breedte, n) {
  const { kozijn, overlap } = SCHUIFPUI
  return (breedte - 2 * kozijn + (n - 1) * overlap) / n
}

// Kan een pui van deze breedte n-delig? Vleugels moeten tussen vleugelMin en vleugelMax blijven.
export function puiDelenOptie(breedte, n) {
  const b = puiVleugelBreedte(breedte, n)
  const cm = Math.round(b * 100)
  if (b < SCHUIFPUI.vleugelMin) return { mogelijk: false, vleugel: b, reden: `vleugels van ${cm} cm zijn te smal (minimaal ${Math.round(SCHUIFPUI.vleugelMin * 100)} cm)` }
  if (b > SCHUIFPUI.vleugelMax) return { mogelijk: false, vleugel: b, reden: `vleugels van ${cm} cm zijn te breed (maximaal ${Math.round(SCHUIFPUI.vleugelMax * 100)} cm)` }
  return { mogelijk: true, vleugel: b }
}

// Standaardaantal delen: 2 tot 3,2 m, daarboven 4 (de middelste vleugels schuiven). Kan dat niet
// binnen de vleugelmaten, dan het kleinste aantal dat wél kan; kan niets, dan 2 (smal) of 4 (breed).
export function autoPuiDelen(breedte) {
  const voorkeur = breedte > SCHUIFPUI.autoGrens ? 4 : 2
  if (puiDelenOptie(breedte, voorkeur).mogelijk) return voorkeur
  return [2, 3, 4].find(n => puiDelenOptie(breedte, n).mogelijk) || voorkeur
}

// Aantal vleugels van een schuifpui: de gekozen `delen` (2, 3 of 4) als die bij deze breedte kan,
// anders de automatische keuze. Alles wat de pui tekent, prijst of beschrijft gebruikt deze functie.
export function aantalPuiVleugels(breedte, delen = 'auto') {
  const n = Number(delen)
  if ([2, 3, 4].includes(n) && puiDelenOptie(breedte, n).mogelijk) return n
  return autoPuiDelen(breedte)
}

// Een ritsscreen is max 5,5 m breed; een breder vak krijgt meerdere screens naast elkaar.
export const SCREEN_MAX = 5.5
export function screensPerVak(breedte) {
  return Math.max(1, Math.ceil(breedte / SCREEN_MAX - 1e-9))
}
