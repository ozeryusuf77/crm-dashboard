// Leidt alle 3D-maten (in meters) af uit de configuratie.
// Assenstelsel: x = breedte (midden = 0), y = omhoog, z = diepte
// (z = 0 bij de gevel, +z richting tuin).
import { MODELLEN, DAKKEN, PLAAT_BREEDTE, OVERSPANNING_DIEPTE_FACTOR, SCHUIFWAND, vind } from './options.js'

export const MUURPROFIEL_D = 0.08  // diepte muurprofiel
const ZIJBALK = 0.06               // zijbalk onder de spie (hellend dak)

export function maakLayout(cfg) {
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
  }
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

// Aantal vleugels in een schuifpui: 2 tot 3,2 m, daarboven 4 (middendeel schuift).
export function aantalPuiVleugels(breedte) {
  return breedte > 3.2 ? 4 : 2
}

// Een ritsscreen is max 5,5 m breed; een breder vak krijgt meerdere screens naast elkaar.
export const SCREEN_MAX = 5.5
export function screensPerVak(breedte) {
  return Math.max(1, Math.ceil(breedte / SCREEN_MAX - 1e-9))
}
