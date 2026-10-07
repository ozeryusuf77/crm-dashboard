import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene from './scene/Scene.jsx'
import Zijdekiezer, { WAND_KLEUR } from './Zijdekiezer.jsx'
import {
  STAPPEN, MODELLEN, GOOT_STIJLEN, MATEN, KLEUREN, DAKKEN, WAND_TYPES, GLAS_SOORTEN,
  OPEN_RICHTINGEN, SPIE_TYPES, DOEK_KLEUREN, ZONWERING, SPOTS_OPTIES, ZIJDES,
  STANDAARD_CONFIG, TOON_PRIJZEN, vind,
} from './options.js'
import { maakLayout, wandSlots, wandVoor, aantalSchuifPanelen, aantalPuiVleugels } from './layout.js'
import { berekenOfferte, euro } from './pricing.js'
import './configurator.css'

const BEDIENING_START = { open: {}, screens: {}, onderdak: 0, bovendak: 0, heater: 0 }

// ─── Configuratie in de URL (deelbare link) ──────────────────────────────────
function leesUrlConfig() {
  try {
    const c = new URLSearchParams(window.location.search).get('c')
    if (!c) return null
    const json = JSON.parse(decodeURIComponent(escape(atob(c))))
    const maat = k => {
      const v = Number(json[k])
      return Number.isFinite(v) ? Math.min(MATEN[k].max, Math.max(MATEN[k].min, v)) : MATEN[k].standaard
    }
    return {
      ...STANDAARD_CONFIG, ...json,
      breedte: maat('breedte'), diepte: maat('diepte'), hoogte: maat('hoogte'),
      wanden: { ...STANDAARD_CONFIG.wanden, ...json.wanden },
      spie: { ...STANDAARD_CONFIG.spie, ...json.spie },
      zonwering: { ...STANDAARD_CONFIG.zonwering, ...json.zonwering, screens: { ...STANDAARD_CONFIG.zonwering.screens, ...json.zonwering?.screens } },
      extra: { ...STANDAARD_CONFIG.extra, ...json.extra },
    }
  } catch {
    return null
  }
}
const naarUrl = cfg => btoa(unescape(encodeURIComponent(JSON.stringify(cfg))))
const deelLink = cfg => `${window.location.origin}${window.location.pathname}?c=${naarUrl(cfg)}`

// ─── Kleine UI-bouwstenen ─────────────────────────────────────────────────────
function Kaart({ actief, onClick, titel, sub, extra, kleur }) {
  return (
    <button type="button" className={`vc-kaart${actief ? ' actief' : ''}`} onClick={onClick}>
      {kleur && <span className="vc-kaart-kleur" style={{ background: kleur }} />}
      <span className="vc-kaart-tekst">
        <span className="vc-kaart-titel">{titel}</span>
        {sub && <span className="vc-kaart-sub">{sub}</span>}
      </span>
      {extra && <span className="vc-kaart-extra">{extra}</span>}
    </button>
  )
}

function Chips({ opties, waarde, onChange }) {
  return (
    <div className="vc-chips">
      {opties.map(o => (
        <button key={o.id} type="button" className={`vc-chip${waarde === o.id ? ' actief' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Schakelaar({ aan, onChange, label, sub }) {
  return (
    <label className="vc-schakel">
      <span>
        <span className="vc-schakel-label">{label}</span>
        {sub && <span className="vc-schakel-sub">{sub}</span>}
      </span>
      <input type="checkbox" checked={aan} onChange={e => onChange(e.target.checked)} />
      <span className="vc-schakel-knop" aria-hidden />
    </label>
  )
}

function Schuif({ label, waarde, min, max, stap, eenheid = 'cm', onChange }) {
  // Lokale tekst zodat tussenwaarden tijdens het typen (bv. "5" op weg naar "500") het model niet verstoren.
  const [tekst, setTekst] = useState(String(waarde))
  useEffect(() => setTekst(String(waarde)), [waarde])
  const begrens = v => Math.min(max, Math.max(min, Math.round(v / stap) * stap))
  return (
    <div className="vc-schuif">
      <div className="vc-schuif-kop">
        <span>{label}</span>
        <span className="vc-schuif-invoer">
          <input type="number" min={min} max={max} step={stap} value={tekst} aria-label={`${label} in ${eenheid}`}
            onChange={e => {
              setTekst(e.target.value)
              const v = Number(e.target.value)
              if (v >= min && v <= max) onChange(v)
            }}
            onBlur={() => { const v = begrens(Number(tekst) || waarde); setTekst(String(v)); onChange(v) }} />
          {eenheid}
        </span>
      </div>
      <input type="range" min={min} max={max} step={stap} value={waarde} aria-label={label}
        onChange={e => onChange(Number(e.target.value))} />
      <div className="vc-schuif-grens"><span>{min} {eenheid}</span><span>{max} {eenheid}</span></div>
    </div>
  )
}

function Bedieningsknop({ label, waarde, onZet, aanTekst = 'Open', uitTekst = 'Dicht' }) {
  return (
    <div className="vc-bed">
      <div className="vc-bed-kop">
        <span>{label}</span>
        <button type="button" className="vc-bed-knop" onClick={() => onZet(waarde > 0.5 ? 0 : 1)}>
          {waarde > 0.5 ? uitTekst : aanTekst}
        </button>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={waarde} onChange={e => onZet(Number(e.target.value))} aria-label={`${label} stand`} />
    </div>
  )
}

const ICONEN = {
  buiten: <path d="M3 11l9-7 9 7v9H3z M9 20v-6h6v6" />,
  voor: <path d="M4 6h16v12H4z M4 10h16" />,
  links: <path d="M14 5l-7 7 7 7" />,
  rechts: <path d="M10 5l7 7-7 7" />,
  boven: <path d="M12 3v18 M3 12h18 M7 7l10 10 M17 7L7 17" />,
  binnen: <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z" />,
}
const STANDPUNTEN = [
  { id: 'buiten', label: 'Buiten' },
  { id: 'voor', label: 'Voorkant' },
  { id: 'links', label: 'Links' },
  { id: 'rechts', label: 'Rechts' },
  { id: 'boven', label: 'Boven' },
  { id: 'binnen', label: 'Binnen' },
]

// ─── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function VerandaConfigurator() {
  const [cfg, setCfg] = useState(() => leesUrlConfig() || STANDAARD_CONFIG)
  const [stap, setStap] = useState(0)
  const [view, setView] = useState({ naam: 'buiten', direct: true })
  const [bediening, setBediening] = useState(BEDIENING_START)
  const [nacht, setNacht] = useState(false)
  const [toonMaten, setToonMaten] = useState(true)
  const [meubels, setMeubels] = useState(true)
  const [zijde, setZijde] = useState('voor')
  const [vak, setVak] = useState('alle')

  const L = useMemo(() => maakLayout(cfg), [cfg])
  const offerte = useMemo(() => berekenOfferte(cfg), [cfg])
  const timers = useRef([])

  useEffect(() => {
    const t = setTimeout(() => window.history.replaceState(null, '', `?c=${naarUrl(cfg)}`), 300)
    return () => clearTimeout(t)
  }, [cfg])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Zijde/vak-keuze geldig houden als het model of het aantal vakken verandert.
  useEffect(() => {
    if (zijde === 'achter' && !L.vrijstaand) { setZijde('voor'); setVak('alle') }
    if (vak !== 'alle' && vak >= L.vakken.length) setVak('alle')
  }, [L.vrijstaand, L.vakken.length, zijde, vak])

  // Camera opnieuw kaderen als de veranda groter/kleiner wordt (niet bij de eerste render).
  const eersteMaat = useRef(true)
  useEffect(() => {
    if (eersteMaat.current) { eersteMaat.current = false; return }
    const t = setTimeout(() => setView(v => ({ naam: v.naam })), 400)
    return () => clearTimeout(t)
  }, [cfg.breedte, cfg.diepte, cfg.hoogte, cfg.model])

  const zet = useCallback(patch => setCfg(c => ({ ...c, ...(typeof patch === 'function' ? patch(c) : patch) })), [])
  const kijk = naam => setView({ naam })

  // Speel na een keuze kort de beweging af: eerst dicht/opgerold, daarna open/uitgerold.
  const demo = (pad, van, naar, vertraging = 650) => {
    setBediening(b => pad(b, van))
    timers.current.push(setTimeout(() => setBediening(b => pad(b, naar)), vertraging))
  }
  const wandPad = keys => (b, v) => ({ ...b, open: { ...b.open, ...Object.fromEntries(keys.map(k => [k, v])) } })
  const screenPad = z => (b, v) => ({ ...b, screens: { ...b.screens, [z]: v } })
  const veldPad = naam => (b, v) => ({ ...b, [naam]: v })

  // Slots die bij de huidige zijde/vak-keuze horen.
  const slots = useMemo(() => wandSlots(L), [L])
  const zijdeHeeftVakken = zijde === 'voor' || zijde === 'achter'
  const geselecteerdeSlots = slots.filter(s => s.zijde === zijde && (!zijdeHeeftVakken || vak === 'alle' || s.vak === vak))
  const actieveWand = zijdeHeeftVakken && vak !== 'alle' ? wandVoor(cfg, `${zijde}#${vak}`) : cfg.wanden[zijde]

  const zetWand = patch => {
    const nieuw = { ...actieveWand, ...patch }
    setCfg(c => {
      const wanden = { ...c.wanden }
      if (zijdeHeeftVakken && vak !== 'alle') {
        wanden[`${zijde}#${vak}`] = nieuw
      } else {
        wanden[zijde] = nieuw
        // "Alle vakken": per-vak afwijkingen voor deze zijde opheffen.
        Object.keys(wanden).forEach(k => { if (k.startsWith(`${zijde}#`)) delete wanden[k] })
      }
      return { ...c, wanden }
    })
    const type = vind(WAND_TYPES, nieuw.type)
    if (type.bedienbaar && (patch.type || patch.richting)) demo(wandPad(geselecteerdeSlots.map(s => s.key)), 0, 1, 900)
  }

  const kiesZijde = (z, v = 'alle') => {
    setZijde(z)
    setVak(v)
    if (view.naam !== 'binnen') kijk(z === 'voor' ? 'voor' : z === 'achter' ? 'achter' : z)
  }

  // Bedienbare onderdelen in de huidige configuratie.
  const bedienbareWanden = slots.filter(s => vind(WAND_TYPES, wandVoor(cfg, s.key)?.type).bedienbaar)
  const screenZijdes = Object.entries(cfg.zonwering.screens).filter(([z, aan]) => aan && (z !== 'achter' || L.vrijstaand)).map(([z]) => z)
  const huidige = STAPPEN[stap].id

  return (
    <div className="vc">
      <header className="vc-kop">
        <div className="vc-merk">
          <span className="vc-logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9l10-5 10 5M4 9v11M20 9v11M4 14h16" /></svg>
          </span>
          <div>
            <div className="vc-merk-titel">Veranda configurator</div>
            <div className="vc-merk-sub">Stel je veranda samen in 3D</div>
          </div>
        </div>
        <nav className="vc-stappen" aria-label="Stappen">
          {STAPPEN.map((s, i) => (
            <button key={s.id} type="button" className={`vc-stap${i === stap ? ' actief' : ''}${i < stap ? ' klaar' : ''}`} onClick={() => setStap(i)}>
              <span className="vc-stap-nr">{i + 1}</span>{s.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="vc-lijf">
        <section className="vc-podium">
          <Suspense fallback={<div className="vc-laden">3D-model laden…</div>}>
            <Scene cfg={cfg} L={L} view={view} bediening={bediening} zetBediening={setBediening}
              nacht={nacht} toonMaten={toonMaten} meubels={meubels} />
          </Suspense>

          <div className="vc-standpunten" role="toolbar" aria-label="Camerastandpunt">
            {STANDPUNTEN.map(s => (
              <button key={s.id} type="button" className={`vc-standpunt${view.naam === s.id ? ' actief' : ''}`} onClick={() => kijk(s.id)} title={s.label}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONEN[s.id]}</svg>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="vc-weergave">
            <button type="button" className={`vc-pil${nacht ? ' actief' : ''}`} onClick={() => setNacht(n => !n)}>{nacht ? '☾ Avond' : '☀ Dag'}</button>
            <button type="button" className={`vc-pil${toonMaten ? ' actief' : ''}`} onClick={() => setToonMaten(m => !m)}>Maten</button>
            <button type="button" className={`vc-pil${meubels ? ' actief' : ''}`} onClick={() => setMeubels(m => !m)}>Meubels</button>
          </div>

          {(bedienbareWanden.length > 0 || screenZijdes.length > 0 || cfg.zonwering.onderdak || cfg.zonwering.bovendak || cfg.extra.heater > 0) && (
            <div className="vc-dock">
              <div className="vc-dock-titel">Bediening</div>
              <div className="vc-dock-knoppen">
                {bedienbareWanden.length > 0 && (() => {
                  const open = bedienbareWanden.some(s => (bediening.open[s.key] ?? 0) > 0.5)
                  return <button type="button" className="vc-pil" onClick={() => setBediening(b => wandPad(bedienbareWanden.map(s => s.key))(b, open ? 0 : 1))}>{open ? 'Wanden sluiten' : 'Wanden openen'}</button>
                })()}
                {screenZijdes.length > 0 && (() => {
                  const neer = screenZijdes.some(z => (bediening.screens[z] ?? 0) > 0.5)
                  return <button type="button" className="vc-pil" onClick={() => setBediening(b => ({ ...b, screens: { ...b.screens, ...Object.fromEntries(screenZijdes.map(z => [z, neer ? 0 : 1])) } }))}>{neer ? 'Screens omhoog' : 'Screens omlaag'}</button>
                })()}
                {(cfg.zonwering.onderdak || cfg.zonwering.bovendak) && (() => {
                  const uit = (cfg.zonwering.onderdak && bediening.onderdak > 0.5) || (cfg.zonwering.bovendak && bediening.bovendak > 0.5)
                  return <button type="button" className="vc-pil" onClick={() => setBediening(b => ({ ...b, onderdak: uit ? 0 : 1, bovendak: uit ? 0 : 1 }))}>{uit ? 'Zonwering in' : 'Zonwering uit'}</button>
                })()}
                {cfg.extra.heater > 0 && (
                  <button type="button" className={`vc-pil${bediening.heater ? ' actief' : ''}`} onClick={() => setBediening(b => ({ ...b, heater: b.heater ? 0 : 1 }))}>Heater {bediening.heater ? 'uit' : 'aan'}</button>
                )}
              </div>
              <div className="vc-dock-hint">Tip: klik in het 3D-model op een schuifwand, pui of screen om hem te bedienen.</div>
            </div>
          )}
          {view.naam === 'binnen' && <div className="vc-binnen-hint">Sleep om rond te kijken · klik op glas om te openen</div>}
        </section>

        <aside className="vc-paneel">
          <div className="vc-paneel-inhoud">
            <h2 className="vc-paneel-titel"><span>{stap + 1}.</span> {STAPPEN[stap].label}</h2>

            {huidige === 'model' && (
              <>
                <div className="vc-groep-titel">Type veranda</div>
                <div className="vc-kaarten">
                  {MODELLEN.map(m => (
                    <Kaart key={m.id} actief={cfg.model === m.id} titel={m.label} sub={m.sub}
                      onClick={() => { zet({ model: m.id }); kijk('buiten') }} />
                  ))}
                </div>
                <div className="vc-groep-titel">Gootprofiel</div>
                <div className="vc-kaarten">
                  {GOOT_STIJLEN.map(g => (
                    <Kaart key={g.id} actief={cfg.goot === g.id} titel={g.label} sub={g.sub}
                      extra={TOON_PRIJZEN && g.prijs ? `+ ${euro(g.prijs)}` : null} onClick={() => zet({ goot: g.id })} />
                  ))}
                </div>
              </>
            )}

            {huidige === 'maten' && (
              <>
                {Object.entries(MATEN).map(([k, m]) => (
                  <Schuif key={k} label={m.label} waarde={cfg[k]} min={m.min} max={m.max} stap={m.stap}
                    onChange={v => zet({ [k]: v })} />
                ))}
                <div className="vc-info">
                  {L.xStaanders.length * (L.vrijstaand ? 2 : 1)} staanders · {L.vakken.length} {L.vakken.length === 1 ? 'vak' : 'vakken'} van {Math.round(L.vakken[0].breedte * 100)} cm · {L.xLiggers.length} liggers · {(L.oppervlak).toFixed(1).replace('.', ',')} m²
                </div>
              </>
            )}

            {huidige === 'kleur' && (
              <>
                <div className="vc-groep-titel">Kleur aluminium (poedercoating)</div>
                <div className="vc-kaarten">
                  {KLEUREN.map(k => (
                    <Kaart key={k.id} actief={cfg.kleur === k.id} titel={k.label} sub={k.ral} kleur={k.hex}
                      extra={TOON_PRIJZEN && k.prijsFactor ? `+${Math.round((k.prijsFactor - 1) * 100)}%` : null}
                      onClick={() => zet({ kleur: k.id })} />
                  ))}
                </div>
              </>
            )}

            {huidige === 'dak' && (
              <>
                {[...new Set(DAKKEN.map(d => d.groep))].map(groep => (
                  <div key={groep}>
                    <div className="vc-groep-titel">{groep}</div>
                    <div className="vc-kaarten">
                      {DAKKEN.filter(d => d.groep === groep).map(d => (
                        <Kaart key={d.id} actief={cfg.dak === d.id} titel={d.label}
                          extra={TOON_PRIJZEN ? `${euro(d.prijsM2)}/m²` : null}
                          kleur={{ polyHelder: '#dcebf3', polyOpaal: '#f3f2ec', polyIr: '#eadccf', glasHelder: '#cfe7f0', glasMat: '#eef1f1', glasGetint: '#5d6a70' }[d.mat]}
                          onClick={() => zet({ dak: d.id })} />
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" className="vc-link" onClick={() => kijk('binnen')}>Bekijk het dak van binnenuit →</button>
              </>
            )}

            {huidige === 'wanden' && (
              <>
                <p className="vc-uitleg">Klik op een zijde in de plattegrond (gezien vanuit de tuin) en kies de vulling. Combineer gerust: bv. een schuifpui voor en glazen schuifwanden met spie aan de zijkanten.</p>
                <Zijdekiezer cfg={cfg} L={L} zijde={zijde} vak={vak} onKies={kiesZijde} />
                <div className="vc-legenda">
                  {WAND_TYPES.map(t => <span key={t.id}><i style={{ background: WAND_KLEUR[t.id] }} />{t.label}</span>)}
                </div>
                <div className="vc-chips vc-zijdes">
                  {ZIJDES.filter(z => !z.alleenVrijstaand || L.vrijstaand).map(z => (
                    <button key={z.id} type="button" className={`vc-chip${zijde === z.id ? ' actief' : ''}`} onClick={() => kiesZijde(z.id)}>{z.label}</button>
                  ))}
                </div>
                {zijdeHeeftVakken && L.vakken.length > 1 && (
                  <div className="vc-chips">
                    <button type="button" className={`vc-chip klein${vak === 'alle' ? ' actief' : ''}`} onClick={() => setVak('alle')}>Alle vakken</button>
                    {L.vakken.map((_, i) => (
                      <button key={i} type="button" className={`vc-chip klein${vak === i ? ' actief' : ''}`} onClick={() => setVak(i)}>Vak {i + 1}</button>
                    ))}
                  </div>
                )}

                <div className="vc-kaarten">
                  {WAND_TYPES.map(t => {
                    const lengte = geselecteerdeSlots.reduce((s, x) => s + Math.max(1, x.lengte), 0)
                    return (
                      <Kaart key={t.id} actief={actieveWand?.type === t.id} titel={t.label} sub={t.sub} kleur={WAND_KLEUR[t.id]}
                        extra={TOON_PRIJZEN && t.prijsM ? `± ${euro(lengte * t.prijsM)}` : null}
                        onClick={() => zetWand({ type: t.id })} />
                    )
                  })}
                </div>

                {actieveWand && (actieveWand.type === 'schuifwand' || actieveWand.type === 'vastglas') && (
                  <>
                    <div className="vc-groep-titel">Glassoort</div>
                    <Chips opties={GLAS_SOORTEN} waarde={actieveWand.glas} onChange={glas => zetWand({ glas })} />
                  </>
                )}
                {actieveWand?.type === 'schuifwand' && (
                  <>
                    <div className="vc-groep-titel">Openingsrichting</div>
                    <Chips opties={OPEN_RICHTINGEN} waarde={actieveWand.richting} onChange={richting => zetWand({ richting })} />
                    <div className="vc-info">{geselecteerdeSlots.map(s => `${aantalSchuifPanelen(s.lengte)} panelen`).filter((v, i, a) => a.indexOf(v) === i).join(' / ')} · 10 mm gehard veiligheidsglas · onder- en bovenrail in framekleur</div>
                  </>
                )}
                {actieveWand?.type === 'schuifpui' && (
                  <>
                    {geselecteerdeSlots.every(s => aantalPuiVleugels(s.lengte) === 2) ? (
                      <>
                        <div className="vc-groep-titel">Schuivende vleugel</div>
                        <Chips opties={OPEN_RICHTINGEN.filter(o => o.id !== 'midden')} waarde={actieveWand.richting === 'rechts' ? 'rechts' : 'links'} onChange={richting => zetWand({ richting })} />
                      </>
                    ) : (
                      <div className="vc-info">4-delige pui: de twee middelste vleugels schuiven naar buiten weg.</div>
                    )}
                  </>
                )}

                {geselecteerdeSlots.some(s => vind(WAND_TYPES, wandVoor(cfg, s.key)?.type).bedienbaar) && (
                  <Bedieningsknop label="Openstand"
                    waarde={geselecteerdeSlots.reduce((m, s) => Math.max(m, bediening.open[s.key] ?? 0), 0)}
                    onZet={v => setBediening(b => wandPad(geselecteerdeSlots.map(s => s.key))(b, v))} />
                )}

                {(zijde === 'links' || zijde === 'rechts') && (
                  <>
                    <div className="vc-groep-titel">Spie (driehoek boven de zijwand)</div>
                    <Chips opties={SPIE_TYPES} waarde={cfg.spie[zijde]} onChange={v => zet(c => ({ spie: { ...c.spie, [zijde]: v } }))} />
                  </>
                )}
              </>
            )}

            {huidige === 'zonwering' && (
              <>
                <Schakelaar label={ZONWERING.onderdak.label} sub={ZONWERING.onderdak.sub} aan={cfg.zonwering.onderdak}
                  onChange={v => { zet(c => ({ zonwering: { ...c.zonwering, onderdak: v } })); if (v) { demo(veldPad('onderdak'), 0, 1); kijk('binnen') } }} />
                {cfg.zonwering.onderdak && <Bedieningsknop label="Onderdak doek" waarde={bediening.onderdak} aanTekst="Uitrollen" uitTekst="Oprollen" onZet={v => setBediening(b => ({ ...b, onderdak: v }))} />}

                <Schakelaar label={ZONWERING.bovendak.label} sub={ZONWERING.bovendak.sub} aan={cfg.zonwering.bovendak}
                  onChange={v => { zet(c => ({ zonwering: { ...c.zonwering, bovendak: v } })); if (v) { demo(veldPad('bovendak'), 0, 1); kijk('buiten') } }} />
                {cfg.zonwering.bovendak && <Bedieningsknop label="Bovendak doek" waarde={bediening.bovendak} aanTekst="Uitrollen" uitTekst="Oprollen" onZet={v => setBediening(b => ({ ...b, bovendak: v }))} />}

                <div className="vc-groep-titel">{ZONWERING.screen.label}</div>
                <p className="vc-uitleg">{ZONWERING.screen.sub}. Te combineren met schuifwanden: het screen hangt aan de buitenkant.</p>
                {ZIJDES.filter(z => !z.alleenVrijstaand || L.vrijstaand).map(z => (
                  <div key={z.id}>
                    <Schakelaar label={`Screen ${z.label.toLowerCase()}`} aan={!!cfg.zonwering.screens[z.id]}
                      onChange={v => {
                        zet(c => ({ zonwering: { ...c.zonwering, screens: { ...c.zonwering.screens, [z.id]: v } } }))
                        if (v) { demo(screenPad(z.id), 0, 1); if (view.naam !== 'binnen') kijk(z.id === 'achter' ? 'buiten' : z.id) }
                      }} />
                    {cfg.zonwering.screens[z.id] && (
                      <Bedieningsknop label={`Screen ${z.label.toLowerCase()}`} waarde={bediening.screens[z.id] ?? 0} aanTekst="Omlaag" uitTekst="Omhoog"
                        onZet={v => setBediening(b => screenPad(z.id)(b, v))} />
                    )}
                  </div>
                ))}

                {(cfg.zonwering.onderdak || cfg.zonwering.bovendak || Object.values(cfg.zonwering.screens).some(Boolean)) && (
                  <>
                    <div className="vc-groep-titel">Doekkleur</div>
                    <div className="vc-swatches">
                      {DOEK_KLEUREN.map(d => (
                        <button key={d.id} type="button" className={`vc-swatch${cfg.zonwering.doek === d.id ? ' actief' : ''}`}
                          onClick={() => zet(c => ({ zonwering: { ...c.zonwering, doek: d.id } }))} title={d.label}>
                          <i style={{ background: d.hex }} /><span>{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {huidige === 'extra' && (
              <>
                <div className="vc-groep-titel">LED inbouwspots (warm wit)</div>
                <Chips opties={SPOTS_OPTIES.map(n => ({ id: n, label: n ? `${n} spots` : 'Geen' }))} waarde={cfg.extra.spots}
                  onChange={n => { zet(c => ({ extra: { ...c.extra, spots: n } })); if (n && !nacht) setNacht(true) }} />
                <Schakelaar label="Dimmer + afstandsbediening" aan={cfg.extra.dimmer} onChange={v => zet(c => ({ extra: { ...c.extra, dimmer: v } }))} />
                <Schakelaar label="LED-strip in de goot" sub="Sfeerverlichting langs de voorzijde" aan={cfg.extra.ledStrip}
                  onChange={v => { zet(c => ({ extra: { ...c.extra, ledStrip: v } })); if (v && !nacht) setNacht(true) }} />
                <div className="vc-groep-titel">Infrarood heater</div>
                <Chips opties={[0, 1, 2].map(n => ({ id: n, label: n ? `${n}×` : 'Geen' }))} waarde={cfg.extra.heater}
                  onChange={n => { zet(c => ({ extra: { ...c.extra, heater: n } })); if (n) demo(veldPad('heater'), 0, 1, 400) }} />
                <div className="vc-groep-titel">Montage</div>
                <Schakelaar label="Inmeten, levering en montage" sub="Door ons eigen montageteam" aan={cfg.extra.montage} onChange={v => zet(c => ({ extra: { ...c.extra, montage: v } }))} />
                <button type="button" className="vc-link" onClick={() => setNacht(n => !n)}>{nacht ? 'Terug naar daglicht' : 'Bekijk de verlichting in de avond →'}</button>
              </>
            )}

            {huidige === 'offerte' && <OfferteStap cfg={cfg} offerte={offerte} />}
          </div>

          <div className="vc-voet">
            <div className="vc-prijs">
              <span>{TOON_PRIJZEN ? 'Indicatie incl. BTW' : 'Jouw configuratie'}</span>
              <strong>{TOON_PRIJZEN ? euro(offerte.totaal) : `${cfg.breedte} × ${cfg.diepte} cm`}</strong>
            </div>
            <div className="vc-nav">
              <button type="button" className="vc-knop secundair" disabled={stap === 0} onClick={() => setStap(s => Math.max(0, s - 1))}>Vorige</button>
              {stap < STAPPEN.length - 1
                ? <button type="button" className="vc-knop" onClick={() => setStap(s => s + 1)}>Volgende</button>
                : <button type="button" className="vc-knop" onClick={() => document.getElementById('vc-naam')?.focus()}>Aanvragen</button>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Offerte-overzicht en aanvraagformulier ──────────────────────────────────
function OfferteStap({ cfg, offerte }) {
  const [form, setForm] = useState({ naam: '', email: '', telefoon: '', postcode: '', opmerking: '' })
  const [status, setStatus] = useState('idle')
  const [gekopieerd, setGekopieerd] = useState(false)
  const veld = k => ({ value: form[k], onChange: e => setForm(f => ({ ...f, [k]: e.target.value })) })

  const verstuur = async e => {
    e.preventDefault()
    setStatus('bezig')
    try {
      const res = await fetch('/api/offerte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, configuratie: cfg, regels: offerte.regels, totaal: offerte.totaal, link: deelLink(cfg) }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('klaar')
    } catch (err) {
      console.error('Offerte versturen mislukt:', err)
      setStatus('fout')
    }
  }

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(deelLink(cfg))
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2000)
    } catch { /* klembord niet beschikbaar */ }
  }

  return (
    <>
      <div className="vc-overzicht">
        {offerte.regels.map((r, i) => (
          <div key={i} className="vc-regel">
            <div>
              <div className="vc-regel-label">{r.label}</div>
              {r.detail && <div className="vc-regel-detail">{r.detail}</div>}
            </div>
            {TOON_PRIJZEN && <div className="vc-regel-prijs">{r.prijs ? euro(r.prijs) : 'incl.'}</div>}
          </div>
        ))}
        {TOON_PRIJZEN && (
          <div className="vc-regel totaal">
            <div className="vc-regel-label">Totaal indicatie incl. BTW</div>
            <div className="vc-regel-prijs">{euro(offerte.totaal)}</div>
          </div>
        )}
      </div>
      <button type="button" className="vc-link" onClick={kopieer}>{gekopieerd ? 'Link gekopieerd ✓' : 'Kopieer link naar deze configuratie'}</button>

      {status === 'klaar' ? (
        <div className="vc-succes">
          <strong>Bedankt voor je aanvraag!</strong>
          <p>We hebben je configuratie ontvangen en nemen binnen 1 werkdag contact met je op voor een vrijblijvende offerte op maat.</p>
        </div>
      ) : (
        <form className="vc-form" onSubmit={verstuur}>
          <div className="vc-groep-titel">Vrijblijvende offerte aanvragen</div>
          <input id="vc-naam" required placeholder="Naam *" autoComplete="name" {...veld('naam')} />
          <input required type="email" placeholder="E-mailadres *" autoComplete="email" {...veld('email')} />
          <div className="vc-form-rij">
            <input type="tel" placeholder="Telefoon" autoComplete="tel" {...veld('telefoon')} />
            <input placeholder="Postcode" autoComplete="postal-code" {...veld('postcode')} />
          </div>
          <textarea rows={3} placeholder="Opmerkingen (bv. ondergrond, gewenste plaatsingsdatum)" {...veld('opmerking')} />
          {status === 'fout' && <div className="vc-fout">Versturen lukte niet. Probeer het opnieuw of neem telefonisch contact op.</div>}
          <button type="submit" className="vc-knop breed" disabled={status === 'bezig'}>{status === 'bezig' ? 'Versturen…' : 'Offerte aanvragen'}</button>
        </form>
      )}
    </>
  )
}
