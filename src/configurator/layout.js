// Leidt alle 3D-maten (in meters) af uit de configuratie.
// Assenstelsel: x = breedte (midden = 0), y = omhoog, z = diepte
// (z = 0 bij de gevel, +z richting tuin).
import { MAX_OVERSPANNING, PLAAT_BREEDTE, DAKHELLING } from './options.js'

export const STAANDER = 0.11       // doorsnede staander
export const LIGGER_B = 0.06       // breedte dakligger
export const LIGGER_H = 0.11       // hoogte dakligger
export const MUURPROFIEL_D = 0.08  // diepte muurprofiel

export function maakLayout(cfg) {
  const W = cfg.breedte / 100
  const D = cfg.diepte / 100
  const Hf = cfg.hoogte / 100
  const vrijstaand = cfg.model === 'vrijstaand'
  const strak = cfg.goot === 'strak'

  const gootH = strak ? 0.24 : 0.2
  const gootD = strak ? 0.13 : 0.15
  const helling = (DAKHELLING * Math.PI) / 180

  // Dakvlak: bovenkant liggers loopt van achter (hoog) naar voor (laag).
  const zVoorStaander = D - gootD / 2
  const zAchter = vrijstaand ? gootD / 2 : MUURPROFIEL_D
  const yDakVoor = Hf + gootH - 0.02
  const lengteDak = zVoorStaander - zAchter
  const stijging = lengteDak * Math.tan(helling)
  const yDakAchter = yDakVoor + stijging
  const dakY = z => yDakVoor + (zVoorStaander - z) * Math.tan(helling)

  // Staanders en vakken langs de voorzijde.
  const nStaanders = Math.max(2, Math.ceil(W / MAX_OVERSPANNING) + 1)
  const xStaanders = []
  for (let i = 0; i < nStaanders; i++) {
    xStaanders.push(-W / 2 + STAANDER / 2 + (i * (W - STAANDER)) / (nStaanders - 1))
  }
  const vakken = []
  for (let i = 0; i < nStaanders - 1; i++) {
    const x0 = xStaanders[i] + STAANDER / 2
    const x1 = xStaanders[i + 1] - STAANDER / 2
    vakken.push({ x0, x1, breedte: x1 - x0, midden: (x0 + x1) / 2 })
  }

  // Liggers (dakprofielen).
  const nLiggers = Math.max(2, Math.round((W - LIGGER_B) / PLAAT_BREEDTE) + 1)
  const xLiggers = []
  for (let i = 0; i < nLiggers; i++) {
    xLiggers.push(-W / 2 + LIGGER_B / 2 + (i * (W - LIGGER_B)) / (nLiggers - 1))
  }

  // Achterbalk (alleen vrijstaand) rust op achterstaanders.
  const achterBalkOnder = yDakAchter - gootH + 0.02
  const zijX = W / 2 - STAANDER / 2
  const zijZ0 = vrijstaand ? zAchter + STAANDER / 2 : MUURPROFIEL_D + 0.01
  const zijZ1 = zVoorStaander - STAANDER / 2

  return {
    W, D, Hf, vrijstaand, strak, gootH, gootD, helling,
    zVoorStaander, zAchter, yDakVoor, yDakAchter, lengteDak, dakY,
    xStaanders, vakken, xLiggers,
    achterBalkOnder,
    zij: { x: zijX, z0: zijZ0, z1: zijZ1, lengte: zijZ1 - zijZ0 },
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

// Aantal glaspanelen in een glazen schuifwand (max ~1 m per paneel).
export function aantalSchuifPanelen(breedte) {
  return Math.min(6, Math.max(3, Math.ceil(breedte / 0.98)))
}

// Aantal vleugels in een schuifpui: 2 tot 3 m, daarboven 4 (middendeel schuift).
export function aantalPuiVleugels(breedte) {
  return breedte > 3.2 ? 4 : 2
}
