import {
  MODELLEN, BEVESTIGINGEN, KLEUREN, DAKKEN, WAND_TYPES, GLAS_SOORTEN, SPIE_TYPES,
  DOEK_KLEUREN, ZONWERING, EXTRA_PRIJZEN, OPEN_RICHTINGEN, vind,
} from './options.js'
import { maakLayout, wandSlots, wandVoor, aantalSchuifPanelen, aantalPuiVleugels, screensPerVak } from './layout.js'

const ZIJDE_LABEL = { voor: 'Voorzijde', links: 'Linkerzijde', rechts: 'Rechterzijde', achter: 'Achterzijde' }

// Hoe de delen verbonden worden, afhankelijk van de plaatsing.
export function koppelTekst(L) {
  const balk = L.kubus ? 'voorbalk' : 'goot'
  return L.vrijstaand
    ? `koppelstuk in ${balk} voor en achter, staander voor en achter op elke koppeling`
    : `koppelstuk in ${balk} en muurprofiel, staander onder elke koppeling`
}

export const euro = n =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// Geeft regels { label, detail, prijs } en het totaal terug.
export function berekenOfferte(cfg) {
  const L = maakLayout(cfg)
  const regels = []
  const model = vind(MODELLEN, cfg.model)
  const bevestiging = vind(BEVESTIGINGEN, cfg.bevestiging)
  const kleur = vind(KLEUREN, cfg.kleur)
  const dak = vind(DAKKEN, cfg.dak)

  const m2 = L.oppervlak
  const lijnen = L.vrijstaand ? 2 : 1
  const nStaanders = L.xStaanders.length * lijnen
  const basis = m2 * dak.prijsM2 * model.prijsFactor * (bevestiging.prijsFactor || 1) * (kleur.prijsFactor || 1)
  regels.push({
    label: `Veranda ${model.label} — ${bevestiging.label.toLowerCase()}`,
    detail: `${cfg.breedte} × ${cfg.diepte} cm · doorloophoogte ${cfg.hoogte} cm · ${kleur.label} (${kleur.ral})`,
    prijs: basis,
  })
  regels.push({ label: 'Dakbedekking', detail: `${dak.groep} · ${dak.label}`, prijs: 0 })
  if (L.koppelingen.length) {
    regels.push({
      label: `Uitvoering in ${L.delen.length} delen`,
      detail: `${L.delen.length} × ${Math.round(L.deelB * 100)} cm (max ${model.maxDeel} cm uit één stuk) · ${koppelTekst(L)}`,
      prijs: L.koppelingen.length * EXTRA_PRIJZEN.koppelset,
    })
  }
  const extraStaanders = nStaanders - 2 * lijnen - L.koppelingen.length * lijnen
  regels.push({
    label: 'Staanders',
    detail: `${nStaanders} staanders (${Math.round(model.staander[0] * 1000)} × ${Math.round(model.staander[1] * 1000)} mm), max ${Math.round(L.overspanning * 100)} cm overspanning`,
    prijs: Math.max(0, extraStaanders) * EXTRA_PRIJZEN.staander,
  })

  // Wanden: groepeer per zijde.
  const slots = wandSlots(L)
  for (const slot of slots) {
    const w = wandVoor(cfg, slot.key)
    if (!w || w.type === 'open') continue
    const type = vind(WAND_TYPES, w.type)
    const glas = vind(GLAS_SOORTEN, w.glas)
    const factor = w.type === 'schuifwand' || w.type === 'vastglas' ? (glas.prijsFactor || 1) : 1
    const vakTekst = slot.zijde === 'voor' || slot.zijde === 'achter'
      ? (L.vakken.length > 1 ? ` vak ${slot.vak + 1}` : '') : ''
    let detail = `${Math.round(slot.lengte * 100)} cm`
    if (w.type === 'schuifwand') detail += ` · ${aantalSchuifPanelen(slot.lengte)} panelen · ${glas.label.toLowerCase()} · ${vind(OPEN_RICHTINGEN, w.richting).label.toLowerCase()}`
    if (w.type === 'schuifpui') detail += ` · ${aantalPuiVleugels(slot.lengte)} vleugels`
    if (w.type === 'vastglas') detail += ` · ${glas.label.toLowerCase()}`
    regels.push({
      label: `${type.label} — ${ZIJDE_LABEL[slot.zijde]}${vakTekst}`,
      detail,
      prijs: Math.max(1, slot.lengte) * type.prijsM * factor,
    })
  }

  for (const zijde of L.spieMogelijk ? ['links', 'rechts'] : []) {
    const spie = vind(SPIE_TYPES, cfg.spie[zijde])
    if (spie.id === 'geen') continue
    regels.push({ label: `${spie.label} — ${ZIJDE_LABEL[zijde]}`, detail: `${cfg.diepte} cm diep`, prijs: L.D * spie.prijsM })
  }

  const doek = vind(DOEK_KLEUREN, cfg.zonwering.doek)
  if (cfg.zonwering.onderdak) regels.push({ label: ZONWERING.onderdak.label, detail: `Doek ${doek.label.toLowerCase()}`, prijs: m2 * ZONWERING.onderdak.prijsM2 })
  if (cfg.zonwering.bovendak) regels.push({ label: ZONWERING.bovendak.label, detail: `Doek ${doek.label.toLowerCase()}`, prijs: m2 * ZONWERING.bovendak.prijsM2 })
  for (const zijde of ['voor', 'links', 'rechts', 'achter']) {
    if (!cfg.zonwering.screens[zijde]) continue
    if (zijde === 'achter' && !L.vrijstaand) continue
    const lengte = zijde === 'voor' || zijde === 'achter' ? L.W : L.zij.lengte
    const aantal = zijde === 'voor' || zijde === 'achter'
      ? L.vakken.reduce((n, v) => n + screensPerVak(v.breedte + L.sB), 0)
      : screensPerVak(L.zij.lengte)
    regels.push({
      label: `Screens — ${ZIJDE_LABEL[zijde]}`,
      detail: `${aantal}× ritsscreen · doek ${doek.label.toLowerCase()}`,
      prijs: lengte * ZONWERING.screen.prijsM,
    })
  }

  const ex = cfg.extra
  if (ex.spots) regels.push({ label: 'LED inbouwspots', detail: `${ex.spots} spots warm wit`, prijs: ex.spots * EXTRA_PRIJZEN.spot })
  if (ex.dimmer) regels.push({ label: 'Dimmer + afstandsbediening', detail: '', prijs: EXTRA_PRIJZEN.dimmer })
  if (ex.ledStrip) regels.push({ label: 'LED-strip in goot', detail: `${cfg.breedte} cm`, prijs: L.W * EXTRA_PRIJZEN.ledStrip })
  if (ex.heater) regels.push({ label: 'Infrarood heater', detail: `${ex.heater}× 2000 W`, prijs: ex.heater * EXTRA_PRIJZEN.heater })
  if (ex.montage) regels.push({ label: 'Montage', detail: 'Inmeten, levering en montage', prijs: EXTRA_PRIJZEN.montageBasis + m2 * EXTRA_PRIJZEN.montageM2 })

  const totaal = regels.reduce((s, r) => s + r.prijs, 0)
  return { regels, totaal: Math.round(totaal / 5) * 5 }
}
