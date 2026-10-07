import {
  MODELLEN, GOOT_STIJLEN, KLEUREN, DAKKEN, WAND_TYPES, GLAS_SOORTEN, SPIE_TYPES,
  DOEK_KLEUREN, ZONWERING, EXTRA_PRIJZEN, OPEN_RICHTINGEN, vind,
} from './options.js'
import { maakLayout, wandSlots, wandVoor, aantalSchuifPanelen, aantalPuiVleugels } from './layout.js'

const ZIJDE_LABEL = { voor: 'Voorzijde', links: 'Linkerzijde', rechts: 'Rechterzijde', achter: 'Achterzijde' }

export const euro = n =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// Geeft regels { label, detail, prijs } en het totaal terug.
export function berekenOfferte(cfg) {
  const L = maakLayout(cfg)
  const regels = []
  const model = vind(MODELLEN, cfg.model)
  const goot = vind(GOOT_STIJLEN, cfg.goot)
  const kleur = vind(KLEUREN, cfg.kleur)
  const dak = vind(DAKKEN, cfg.dak)

  const m2 = L.oppervlak
  const basis = m2 * dak.prijsM2 * (model.prijsFactor || 1) * (kleur.prijsFactor || 1)
  regels.push({
    label: `Veranda ${model.label.toLowerCase()}`,
    detail: `${cfg.breedte} × ${cfg.diepte} cm · ${L.xStaanders.length * (L.vrijstaand ? 2 : 1)} staanders · ${kleur.label} (${kleur.ral})`,
    prijs: basis,
  })
  regels.push({ label: 'Dakbedekking', detail: `${dak.groep} · ${dak.label}`, prijs: 0 })
  if (goot.prijs) regels.push({ label: 'Goot', detail: goot.label, prijs: goot.prijs })

  // Wanden: groepeer per zijde.
  const slots = wandSlots(L)
  for (const slot of slots) {
    const w = wandVoor(cfg, slot.key)
    if (!w || w.type === 'open') continue
    const type = vind(WAND_TYPES, w.type)
    const glas = vind(GLAS_SOORTEN, w.glas)
    const factor = w.type === 'dicht' ? 1 : (glas.prijsFactor || 1)
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

  for (const zijde of ['links', 'rechts']) {
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
    const aantal = zijde === 'voor' || zijde === 'achter' ? L.vakken.length : 1
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
