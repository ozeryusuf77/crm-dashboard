import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene from './scene/Scene.jsx'
import { Foutgrens } from './scene/Foutgrens.jsx'
import Zijdekiezer, { WAND_KLEUR } from './Zijdekiezer.jsx'
import {
  STAPPEN, MODELLEN, BEVESTIGINGEN, MAAT_LABELS, KLEUREN, DAKKEN, WAND_TYPES, GLAS_SOORTEN,
  OPEN_RICHTINGEN, SPIE_TYPES, DOEK_KLEUREN, ZONWERING, SPOTS_OPTIES, ZIJDES,
  STANDAARD_CONFIG, TOON_PRIJZEN, vind, maatGrenzen, begrensMaten,
} from './options.js'
import { maakLayout, wandSlots, wandVoor, aantalSchuifPanelen, aantalPuiVleugels } from './layout.js'
import { berekenOfferte, euro, koppelTekst } from './pricing.js'
import './configurator.css'

const BEDIENING_START = { open: {}, screens: {}, onderdak: 0, bovendak: 0, heater: 0 }

// ─── Configuratie in de URL (deelbare link) ──────────────────────────────────
function leesUrlConfig() {
  try {
    const c = new URLSearchParams(window.location.search).get('c')
    if (!c) return null
    const json = JSON.parse(decodeURIComponent(escape(atob(c))))
    // Oude links: model was 'gevel'/'vrijstaand' en de goot een losse keuze.
    if (json.model === 'gevel' || json.model === 'vrijstaand') {
      json.bevestiging = json.model
      json.model = json.goot === 'strak' ? 'linea' : 'klassiek'
    }
    if (!MODELLEN.some(m => m.id === json.model)) delete json.model
    if (!BEVESTIGINGEN.some(b => b.id === json.bevestiging)) delete json.bevestiging
    delete json.goot
    const getal = (k, std) => (Number.isFinite(Number(json[k])) ? Number(json[k]) : std)
    return begrensMaten({
      ...STANDAARD_CONFIG, ...json,
      breedte: getal('breedte', STANDAARD_CONFIG.breedte),
      diepte: getal('diepte', STANDAARD_CONFIG.diepte),
      hoogte: getal('hoogte', STANDAARD_CONFIG.hoogte),
      wanden: { ...STANDAARD_CONFIG.wanden, ...json.wanden },
      spie: { ...STANDAARD_CONFIG.spie, ...json.spie },
      zonwering: { ...STANDAARD_CONFIG.zonwering, ...json.zonwering, screens: { ...STANDAARD_CONFIG.zonwering.screens, ...json.zonwering?.screens } },
      extra: { ...STANDAARD_CONFIG.extra, ...json.extra },
    })
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

// Per-vak wanden (sleutels "voor#1") hangen aan een vaknummer. Verandert de
// vakindeling, dan krijgt elk nieuw vak de instelling van het oude vak dat op
// dezelfde relatieve plek lag; vervallen sleutels worden opgeruimd.
function herverdeelVakWanden(oud, nieuw) {
  if (!Object.keys(nieuw.wanden).some(k => k.includes('#'))) return nieuw.wanden
  const A = maakLayout(oud), B = maakLayout(nieuw)
  const zelfde = A.vakken.length === B.vakken.length &&
    A.vakken.every((v, i) => Math.abs(v.midden / A.W - B.vakken[i].midden / B.W) < 1e-3)
  if (zelfde) return nieuw.wanden
  const wanden = Object.fromEntries(Object.entries(nieuw.wanden).filter(([k]) => !k.includes('#')))
  for (const z of ['voor', 'achter']) {
    B.vakken.forEach((v, j) => {
      const rel = v.midden / B.W
      const i = A.vakken.reduce((best, o, k) =>
        Math.abs(o.midden / A.W - rel) < Math.abs(A.vakken[best].midden / A.W - rel) ? k : best, 0)
      if (nieuw.wanden[`${z}#${i}`]) wanden[`${z}#${j}`] = nieuw.wanden[`${z}#${i}`]
    })
  }
  return wanden
}

// Zijaanzicht-icoon per model.
function ModelSilhouet({ m }) {
  const kleur = 'currentColor'
  const plat = m.dakvorm === 'plat'
  const post = plat ? 7 : 5
  const xPost = m.overstek ? 66 : 80
  return (
    <svg viewBox="0 0 96 56" className="vc-model-svg" aria-hidden>
      <rect x="2" y="4" width="6" height="50" fill="#c9b8a8" />
      {plat ? (
        <>
          <rect x="8" y="12" width="82" height={9} rx="1.5" fill={kleur} />
          <rect x={xPost - post / 2} y="21" width={post} height="33" fill={kleur} />
        </>
      ) : (
        <>
          <path d="M8 10 L84 20" stroke={kleur} strokeWidth="3.5" />
          {m.goot === 'rond'
            ? <path d="M80 18 h8 q4 0 3 5 q-1 5 -6 5 h-5 z" fill={kleur} />
            : <rect x="79" y="17" width="10" height="10" rx="1" fill={kleur} />}
          <rect x={xPost - post / 2} y="27" width={post} height="27" fill={kleur} />
        </>
      )}
      <line x1="0" y1="54.5" x2="96" y2="54.5" stroke="#b9c2ca" strokeWidth="1" />
    </svg>
  )
}

// Bovenaanzicht van de voorzijde: delen, koppelingen en staanders.
function KoppelSchema({ L }) {
  const B = 300, x = v => 10 + ((v + L.W / 2) / L.W) * (B - 20)
  return (
    <svg viewBox={`0 0 ${B} 56`} className="vc-koppelschema" role="img"
      aria-label={`${L.delen.length} ${L.delen.length === 1 ? 'deel' : 'delen'}, ${L.xStaanders.length} staanders aan de voorzijde`}>
      {L.delen.map((d, i) => (
        <g key={i}>
          <rect x={x(d.x0) + 1} y="14" width={x(d.x1) - x(d.x0) - 2} height="14" rx="3"
            fill={i % 2 ? '#d4ecf3' : '#e6f4f8'} stroke="#8fc6d6" />
          <text x={(x(d.x0) + x(d.x1)) / 2} y="11" textAnchor="middle" className="vc-ks-tekst">
            {L.delen.length > 1 ? `Deel ${i + 1} · ` : ''}{Math.round(d.breedte * 100)} cm
          </text>
        </g>
      ))}
      {L.koppelingen.map((k, i) => (
        <g key={`k${i}`}>
          <line x1={x(k)} y1="10" x2={x(k)} y2="32" stroke="#0a2342" strokeWidth="2" strokeDasharray="3 2" />
          <text x={x(k)} y="52" textAnchor="middle" className="vc-ks-tekst sterk">koppeling</text>
        </g>
      ))}
      {L.xStaanders.map((p, i) => <rect key={`s${i}`} x={x(p) - 3.5} y="30" width="7" height="7" fill="#333a40" />)}
    </svg>
  )
}

// Factor van model, plaatsing en kleur op de m²-prijs (zoals in pricing.js).
function prijsFactorFrame(cfg) {
  return vind(MODELLEN, cfg.model).prijsFactor * (vind(BEVESTIGINGEN, cfg.bevestiging).prijsFactor || 1) * (vind(KLEUREN, cfg.kleur).prijsFactor || 1)
}

// Indicatieprijs van een model bij 400 × 300 cm met de huidige keuzes.
function vanafPrijs(cfg, model) {
  return berekenOfferte(begrensMaten({
    ...STANDAARD_CONFIG, model, bevestiging: cfg.bevestiging, kleur: cfg.kleur, dak: cfg.dak, breedte: 400, diepte: 300,
    extra: { ...STANDAARD_CONFIG.extra, montage: false },
  })).totaal
}

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
    const t = setTimeout(() => {
      // In een afgeschermd iframe (inbedding) mag de URL soms niet wijzigen; dan alleen overslaan.
      try {
        const p = new URLSearchParams(window.location.search)
        p.set('c', naarUrl(cfg))
        window.history.replaceState(window.history.state, '', `?${p}${window.location.hash}`)
      } catch { /* deellink blijft via de knop beschikbaar */ }
    }, 300)
    return () => clearTimeout(t)
  }, [cfg])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Zijde/vak-keuze geldig houden als het model of het aantal vakken verandert.
  useEffect(() => {
    if (zijde === 'achter' && !L.vrijstaand) { setZijde('voor'); setVak('alle') }
    if (vak !== 'alle' && (vak >= L.vakken.length || L.vakken.length <= 1)) setVak('alle')
  }, [L.vrijstaand, L.vakken.length, zijde, vak])

  // Camera opnieuw kaderen als de veranda groter/kleiner wordt (niet bij de eerste render).
  const eersteMaat = useRef(true)
  useEffect(() => {
    if (eersteMaat.current) { eersteMaat.current = false; return }
    const t = setTimeout(() => setView(v => ({ naam: v.naam })), 400)
    return () => clearTimeout(t)
  }, [cfg.breedte, cfg.diepte, cfg.hoogte, cfg.model, cfg.bevestiging])

  // Elke wijziging blijft binnen de maatgrenzen van model + dak; bij aanpassing een melding.
  const [melding, setMelding] = useState(null)
  const zet = useCallback(patch => setCfg(c => {
    const voorstel = { ...c, ...(typeof patch === 'function' ? patch(c) : patch) }
    const n = begrensMaten(voorstel)
    n.wanden = herverdeelVakWanden(c, n)
    const gewijzigd = ['breedte', 'diepte', 'hoogte'].filter(k => n[k] !== voorstel[k] && voorstel[k] === c[k])
    if (gewijzigd.length) {
      const m = vind(MODELLEN, n.model), d = vind(DAKKEN, n.dak)
      setMelding(gewijzigd.map(k => `${MAAT_LABELS[k]} aangepast naar ${n[k]} cm (grens voor ${m.label} met ${d.soort === 'glas' ? 'glazen' : 'polycarbonaat'} dak)`).join(' · '))
    }
    return n
  }), [])
  useEffect(() => {
    if (!melding) return
    const t = setTimeout(() => setMelding(null), 6000)
    return () => clearTimeout(t)
  }, [melding])
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
  const slotWanden = geselecteerdeSlots.map(s => wandVoor(cfg, s.key))
  const actieveWand = zijdeHeeftVakken && vak !== 'alle'
    ? wandVoor(cfg, `${zijde}#${vak}`)
    : (slotWanden.length && slotWanden.every(w => w?.type === slotWanden[0]?.type) && slotWanden[0]) || cfg.wanden[zijde]

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
          {/* Een fout in de 3D-weergave (bv. geen WebGL) laat de rest van de configurator werken. */}
          <Foutgrens naam="3D-weergave" fallback={(
            <div className="vc-laden">De 3D-weergave kan op dit apparaat niet worden geladen. Je kunt je veranda wel samenstellen en een offerte aanvragen.</div>
          )}>
            <Suspense fallback={<div className="vc-laden">3D-model laden…</div>}>
              <Scene cfg={cfg} L={L} view={view} bediening={bediening} zetBediening={setBediening}
                nacht={nacht} toonMaten={toonMaten} meubels={meubels} />
            </Suspense>
          </Foutgrens>

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
            {melding && <div className="vc-melding" role="status">{melding}</div>}

            {huidige === 'model' && (
              <>
                <div className="vc-groep-titel">Kies je veranda</div>
                <div className="vc-modellen">
                  {MODELLEN.map(m => (
                    <button key={m.id} type="button" className={`vc-model${cfg.model === m.id ? ' actief' : ''}`}
                      onClick={() => { zet({ model: m.id }); kijk('buiten') }}>
                      <ModelSilhouet m={m} />
                      <span className="vc-model-naam">{m.label}</span>
                      <span className="vc-model-sub">{m.sub}</span>
                      {TOON_PRIJZEN && <span className="vc-model-prijs">4 × 3 m: {euro(vanafPrijs(cfg, m.id))}</span>}
                    </button>
                  ))}
                </div>
                <div className="vc-info">
                  <strong>{vind(MODELLEN, cfg.model).label}:</strong> {vind(MODELLEN, cfg.model).tekst}
                  <ul className="vc-spec">
                    <li>Uit één stuk tot {vind(MODELLEN, cfg.model).maxDeel} cm breed, daarboven in delen gekoppeld</li>
                    <li>Diepte tot {vind(MODELLEN, cfg.model).diepte.poly[1]} cm (polycarbonaat) / {vind(MODELLEN, cfg.model).diepte.glas[1]} cm (glas)</li>
                    <li>Staanders {Math.round(vind(MODELLEN, cfg.model).staander[0] * 1000)} × {Math.round(vind(MODELLEN, cfg.model).staander[1] * 1000)} mm{vind(MODELLEN, cfg.model).afvoer === 'staander' ? ', afvoer verborgen in de staander' : ''}</li>
                  </ul>
                </div>
                <div className="vc-groep-titel">Plaatsing</div>
                <div className="vc-kaarten">
                  {BEVESTIGINGEN.map(b => (
                    <Kaart key={b.id} actief={cfg.bevestiging === b.id} titel={b.label} sub={b.sub}
                      extra={TOON_PRIJZEN && b.prijsFactor ? `+${Math.round((b.prijsFactor - 1) * 100)}%` : null}
                      onClick={() => { zet({ bevestiging: b.id }); kijk('buiten') }} />
                  ))}
                </div>
              </>
            )}

            {huidige === 'maten' && (() => {
              const g = maatGrenzen(cfg)
              const m = vind(MODELLEN, cfg.model)
              return (
                <>
                  {['breedte', 'diepte', 'hoogte'].map(k => (
                    <Schuif key={k} label={MAAT_LABELS[k]} waarde={cfg[k]} min={g[k].min} max={g[k].max} stap={g[k].stap}
                      onChange={v => zet({ [k]: v })} />
                  ))}
                  <KoppelSchema L={L} />
                  {L.delen.length > 1 ? (
                    <div className="vc-koppel">
                      <strong>Deze veranda wordt in {L.delen.length} delen geleverd</strong>
                      <p>De {m.label} is uit één stuk maximaal {m.maxDeel} cm breed. Bij {cfg.breedte} cm bestaat de voorzijde uit {L.delen.length} × {Math.round(L.deelB * 100)} cm. Verbinding: {koppelTekst(L)}.</p>
                    </div>
                  ) : (
                    <div className="vc-info">Uit één stuk tot {m.maxDeel} cm. Breder wordt de veranda automatisch in 2 delen gekoppeld.</div>
                  )}
                  <div className="vc-info">
                    {L.xStaanders.length * (L.vrijstaand ? 2 : 1)} staanders · {L.vakken.length} {L.vakken.length === 1 ? 'vak' : 'vakken'} ({L.vakken.map(v => Math.round(v.breedte * 100)).join(' / ')} cm) · {L.liggers.length} liggers · {L.oppervlak.toFixed(1).replace('.', ',')} m²
                    <br />Max {Math.round(L.overspanning * 100)} cm tussen staanders bij {L.soort === 'glas' ? 'een glazen' : 'een polycarbonaat'} dak van {cfg.diepte} cm diep.
                  </div>
                </>
              )
            })()}

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
                    <div className="vc-groep-titel">
                      {groep} <span className="vc-groep-noot">tot {vind(MODELLEN, cfg.model).diepte[DAKKEN.find(d => d.groep === groep).soort][1]} cm diep</span>
                    </div>
                    <div className="vc-kaarten">
                      {DAKKEN.filter(d => d.groep === groep).map(d => (
                        <Kaart key={d.id} actief={cfg.dak === d.id} titel={d.label}
                          extra={TOON_PRIJZEN ? `${euro(d.prijsM2 * prijsFactorFrame(cfg))}/m²` : null}
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
                        extra={TOON_PRIJZEN && t.prijsM ? `± ${euro(lengte * t.prijsM * ((t.id === 'schuifwand' || t.id === 'vastglas') ? (vind(GLAS_SOORTEN, actieveWand?.glas).prijsFactor || 1) : 1))}` : null}
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

                {(zijde === 'links' || zijde === 'rechts') && (L.spieMogelijk ? (
                  <>
                    <div className="vc-groep-titel">Spie (driehoek boven de zijwand)</div>
                    <Chips opties={SPIE_TYPES} waarde={cfg.spie[zijde]} onChange={v => zet(c => ({ spie: { ...c.spie, [zijde]: v } }))} />
                  </>
                ) : (
                  <div className="vc-info">Bij de {vind(MODELLEN, cfg.model).label} is geen spie nodig: het dak ligt vlak achter de omkasting, dus de zijwand sluit direct aan.</div>
                ))}
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

                {(cfg.zonwering.onderdak || cfg.zonwering.bovendak || screenZijdes.length > 0) && (
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
