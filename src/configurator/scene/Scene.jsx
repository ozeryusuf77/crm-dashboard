// Scène van de configurator: Canvas, belichting, camera-regie, kwaliteitstier en de
// samenstelling van veranda, wanden, zonwering, omgeving, maatvoering en regen.
//
//   <Scene cfg L view bediening zetBediening nacht toonMaten meubels
//          regen toonWaterloop afvoerFocus onKlikStaander />
//
// Assen: x = breedte (0 = midden), y = omhoog (0 = terrasreferentie), z = diepte (0 = gevel,
// +z = tuin); alle maten in meters. De vloerhoogte (vlonder/tegels) komt uit L.vloerY:
// wanden, screens en staanders staan dáárop, niet op y = 0.
import * as THREE from 'three'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, SoftShadows, PerformanceMonitor } from '@react-three/drei'
import { MaterialenProvider, useMaterialen } from './materials.js'
import Veranda from './Veranda.jsx'
import { Wand } from './Wanden.jsx'
import { Ritsscreen, OnderdakZonwering, BovendakZonwering } from './Zonwering.jsx'
import { Licht } from './Licht.jsx'
import { Omgeving, Maatvoering } from './Omgeving.jsx'
import { cameraStandpunt, FOV } from './standpunten.js'
import { wandSlots, wandVoor, screensPerVak } from '../layout.js'
import { Foutgrens } from './Foutgrens.jsx'
import { GEFORCEERD, MOBIEL } from './kwaliteit.js'

// Los geladen: de nabewerking (postprocessing, alleen desktop) en de regenmodus met zijn
// shaders komen pas over de lijn als ze nodig zijn.
const Effecten = lazy(() => import('./Effecten.jsx'))
const Regen = lazy(() => import('./Regen.jsx'))

// Na zoveel echte tierwissels (hoog ↔ laag) blijft de kwaliteit laag staan.
const TIER_MAX_WISSELS = 3

// ─── Camera ──────────────────────────────────────────────────────────────────
// Standpunten die van de beeldverhouding afhangen: de hele veranda moet in beeld passen.
const ASPECT_STANDPUNTEN = new Set(['buiten', 'voor'])

// Sleutel van de afvoerstaander(s): het standpunt 'afvoer' richt zich op die staander en
// moet mee als hij van plek of uitlooprichting verandert (niet bij elke andere cfg-wissel).
const afvoerSleutel = L => (L.afvoeren || []).map(a => `${a.kant}:${a.x.toFixed(3)}:${a.z.toFixed(3)}:${a.richting}`).join('|')

// Glijdt de camera naar het gekozen standpunt en dempt de beeldhoek; na aankomst of zodra
// de klant zelf sleept neemt OrbitControls het over.
function CameraRig({ view, L, controls }) {
  const { camera } = useThree()
  const aspect = useThree(s => s.viewport.aspect)
  const doel = useRef(null)                    // standpunt onderweg (null = aangekomen of gesleept)
  const fovDoel = useRef(FOV[view.naam] ?? 40) // beeldhoek van het laatste standpunt (blijft na aankomst)
  const gesleept = useRef(false)               // de klant heeft zelf gedraaid sinds het laatste standpunt
  const binnen = view.naam === 'binnen'

  const richt = () => {
    const d = cameraStandpunt(view.naam, L, { aspect, kant: view.kant })
    doel.current = d
    fovDoel.current = d.fov ?? FOV[view.naam] ?? 40
    return d
  }

  useEffect(() => {
    const d = richt()
    gesleept.current = false
    // Bij de eerste weergave direct op de plek zetten.
    if (view.direct) {
      camera.position.copy(d.pos)
      controls.current?.target.copy(d.doel)
      camera.fov = fovDoel.current
      camera.updateProjectionMatrix()
    }
    // Opnieuw richten bij een ander standpunt, (binnen) gewijzigde maten of (afvoer) een
    // verplaatste afvoerstaander.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, binnen ? L.W : 0, binnen ? L.D : 0, binnen ? L.vrijstaand : 0, view.naam === 'afvoer' ? afvoerSleutel(L) : ''])

  // Andere beeldverhouding (paneel open/dicht, telefoon gedraaid): fotostand en voorkant
  // opnieuw kaderen, tenzij de klant de camera intussen zelf heeft verplaatst.
  useEffect(() => {
    if (!ASPECT_STANDPUNTEN.has(view.naam) || gesleept.current) return
    richt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => { doel.current = null; gesleept.current = true }
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, dt) => {
    const fov = fovDoel.current
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = THREE.MathUtils.damp(camera.fov, fov, 4, dt)
      camera.updateProjectionMatrix()
    }
    const d = doel.current
    const c = controls.current
    if (!d || !c) return
    const k = 1 - Math.exp(-dt * 3.2)
    camera.position.lerp(d.pos, k)
    c.target.lerp(d.doel, k)
    c.update()
    // Aangekomen? De tolerantie groeit met de afstand: de polaire begrenzing van de besturing
    // laat een standpunt op exact ooghoogte (pitch 0) een fractie boven het doel rusten.
    const tol = 0.01 + 0.004 * camera.position.distanceTo(c.target)
    if (camera.position.distanceTo(d.pos) < tol && c.target.distanceTo(d.doel) < tol) doel.current = null
  })
  return null
}

// Rekwisieten (GLB-modellen van de tuin) pas laden ná het eerste beeld, zodra de browser
// even niets te doen heeft (requestIdleCallback, uiterlijk na 1,2 s; zonder rIC na 0,6 s).
function Rekwisietenlader({ onLaad }) {
  const gepland = useRef(false)
  const opruimen = useRef(null)
  useFrame(() => {
    if (gepland.current) return
    gepland.current = true
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(onLaad, { timeout: 1200 })
      opruimen.current = () => window.cancelIdleCallback(id)
    } else {
      const t = setTimeout(onLaad, 600)
      opruimen.current = () => clearTimeout(t)
    }
  })
  useEffect(() => () => opruimen.current?.(), [])
  return null
}

// ─── Inhoud (binnen de materialen-context) ───────────────────────────────────
function Inhoud({ cfg, L, view, bediening, zetBediening, nacht, toonMaten, meubels, hoog, laadRekwisieten, regen, regenGemount, onRegenKlaar, doorkijk, onKlikStaander }) {
  const binnen = view.naam === 'binnen'
  const slots = useMemo(() => wandSlots(L), [L])
  const toggleWand = key => zetBediening(b => ({ ...b, open: { ...b.open, [key]: (b.open[key] ?? 0) > 0.5 ? 0 : 1 } }))
  const toggleScreen = zijde => zetBediening(b => ({ ...b, screens: { ...b.screens, [zijde]: (b.screens[zijde] ?? 0) > 0.5 ? 0 : 1 } }))
  const toggle = naam => zetBediening(b => ({ ...b, [naam]: b[naam] > 0.5 ? 0 : 1 }))

  // Wanden staan op de vloer (L.vloerY) en zijn daardoor L.vloerY lager dan de balk erboven.
  const plaatsing = slot => {
    if (slot.zijde === 'voor') {
      const v = L.vakken[slot.vak]
      return { position: [v.midden, L.vloerY, L.zVoorStaander], rotation: [0, 0, 0], hoogte: L.wandH.voor - L.vloerY }
    }
    if (slot.zijde === 'achter') {
      const v = L.vakken[slot.vak]
      return { position: [v.midden, L.vloerY, L.zAchter], rotation: [0, Math.PI, 0], hoogte: L.wandH.achter - L.vloerY }
    }
    const s = slot.zijde === 'links' ? -1 : 1
    return { position: [s * L.zij.x, L.vloerY, (L.zij.z0 + L.zij.z1) / 2], rotation: [0, s * Math.PI / 2, 0], hoogte: L.wandH.zij - L.vloerY }
  }

  const sc = cfg.zonwering.screens
  const voorOffset = L.sD / 2 + 0.085
  const zijOffset = L.sB / 2 + 0.085
  // Screens per vak, vanaf de vloer; een vak breder dan 5,5 m krijgt meerdere screens naast elkaar.
  const vakScreens = (zijde, z, rot, hoogte) => L.vakken.flatMap((v, i) => {
    const n = screensPerVak(v.breedte + L.sB)
    const b = (v.breedte + L.sB) / n
    return Array.from({ length: n }, (_, k) => (
      <Ritsscreen key={`s${zijde}${i}-${k}`} lengte={b} hoogte={hoogte - L.vloerY} neer={bediening.screens[zijde] ?? 0}
        position={[v.x0 - L.sB / 2 + b * (k + 0.5), L.vloerY, z]} rotation={rot} onToggle={() => toggleScreen(zijde)} />
    ))
  })

  return (
    <>
      <Veranda cfg={cfg} L={L} nacht={nacht} heaterAan={bediening.heater > 0.5}
        doorkijk={doorkijk} onKlikStaander={onKlikStaander} afvoerLabels={view.naam === 'afvoer'} />
      {slots.map(slot => {
        const p = plaatsing(slot)
        return (
          <Wand key={`${slot.key}-${wandVoor(cfg, slot.key)?.type}`} w={wandVoor(cfg, slot.key)} lengte={slot.lengte} hoogte={p.hoogte}
            position={p.position} rotation={p.rotation} open={bediening.open[slot.key] ?? 0} kubus={L.kubus}
            onToggle={() => toggleWand(slot.key)} />
        )
      })}

      {sc.voor && vakScreens('voor', L.zVoorStaander + voorOffset, [0, 0, 0], L.wandH.voor)}
      {L.vrijstaand && sc.achter && vakScreens('achter', L.zAchter - voorOffset, [0, Math.PI, 0], L.wandH.achter)}
      {[['links', -1], ['rechts', 1]].flatMap(([zijde, s]) => {
        if (!sc[zijde]) return []
        const n = screensPerVak(L.zij.lengte)
        const b = L.zij.lengte / n
        return Array.from({ length: n }, (_, k) => (
          <Ritsscreen key={`s-${zijde}-${k}`} lengte={b} hoogte={L.Hf - L.vloerY} neer={bediening.screens[zijde] ?? 0}
            position={[s * (L.zij.x + zijOffset), L.vloerY, L.zij.z0 + b * (k + 0.5)]} rotation={[0, s * Math.PI / 2, 0]}
            onToggle={() => toggleScreen(zijde)} />
        ))
      })}

      {cfg.zonwering.onderdak && <OnderdakZonwering L={L} uit={bediening.onderdak} onToggle={() => toggle('onderdak')} />}
      {cfg.zonwering.bovendak && <BovendakZonwering L={L} uit={bediening.bovendak} onToggle={() => toggle('bovendak')} />}

      <Omgeving L={L} cfg={cfg} nacht={nacht} meubels={meubels} hoog={hoog} laadRekwisieten={laadRekwisieten} />
      {/* Maten niet in het binnen- en afvoerstandpunt en niet tijdens de regen (labels zouden de waterloop afdekken). */}
      {toonMaten && !binnen && view.naam !== 'afvoer' && !regen && <Maatvoering L={L} cfg={cfg} />}

      {/* Regen blijft gemount tot alles is uitgefaded (onKlaar), zodat uitzetten vloeiend verloopt. */}
      {regenGemount && (
        <Foutgrens naam="Regen">
          <Suspense fallback={null}>
            <Regen L={L} cfg={cfg} aan={regen} nacht={nacht} hoog={hoog} bediening={bediening} onKlaar={onRegenKlaar} />
          </Suspense>
        </Foutgrens>
      )}
    </>
  )
}

function MetMaterialen({ cfg, children }) {
  const mat = useMaterialen(cfg)
  return <MaterialenProvider value={mat}>{children}</MaterialenProvider>
}

// ─── Scène ───────────────────────────────────────────────────────────────────
export default function Scene({ cfg, L, view, bediening, zetBediening, nacht, toonMaten, meubels, regen = false, toonWaterloop = true, afvoerFocus = false, onKlikStaander }) {
  const controls = useRef()
  const binnen = view.naam === 'binnen'
  const afvoerZicht = view.naam === 'afvoer'
  // Kwaliteitstier: desktop begint hoog. De PerformanceMonitor verlaagt (en herstelt) alleen
  // nabewerking, regen-aantallen en de rekwisietenset — nooit iets dat shaders hercompileert.
  const [hoog, setHoog] = useState(!MOBIEL)
  // Eigen wisselteller: drei telt élke 'incline'-meting als flip (ook als de tier al hoog is),
  // waardoor een vlotte pc met `flipflops` na enkele seconden onterecht zou terugvallen. Hier
  // telt alleen een echte wissel; na de derde wissel blijft de tier laag (geen gejojo).
  const tier = useRef({ hoog: !MOBIEL, wissels: 0, vast: false })
  const wisselTier = naarHoog => {
    const t = tier.current
    if (t.vast || t.hoog === naarHoog) return
    t.wissels += 1
    if (t.wissels >= TIER_MAX_WISSELS) { t.vast = true; naarHoog = false }
    t.hoog = naarHoog
    setHoog(naarHoog)
  }
  // Doorkijk (opengesneden afvoerstaander): tijdens de regen bepaalt de 'Waterloop'-chip het,
  // zonder regen alleen in het afvoerstandpunt zolang de klant de afvoer kiest. Eerder hield
  // afvoerFocus alles aan, waardoor de chip nooit werkte en de opengesneden staander ook in
  // Foto/Voorkant bleef staan.
  const doorkijk = regen ? toonWaterloop : (afvoerFocus && afvoerZicht)
  // Regen blijft gemount zolang hij aan is óf nog uitfadet; Regen meldt via onKlaar dat alles droog is.
  const [regenZichtbaar, setRegenZichtbaar] = useState(regen)
  useEffect(() => { if (regen) setRegenZichtbaar(true) }, [regen])
  const regenGemount = regen || regenZichtbaar
  // 'Windsensor': zodra het regent rollen bovendak- en onderdakzonwering automatisch in.
  useEffect(() => { if (regen) zetBediening(b => ({ ...b, bovendak: 0, onderdak: 0 })) }, [regen, zetBediening])
  // Rekwisieten van de tuin pas na het eerste beeld laden (zie Rekwisietenlader).
  const [laadRekwisieten, setLaadRekwisieten] = useState(false)
  // Alleen het eerste standpunt; daarna verplaatst CameraRig de camera vloeiend (en met de echte beeldverhouding).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => cameraStandpunt(view.naam, L, { kant: view.kant }), [])

  return (
    <Canvas
      shadows="soft" dpr={hoog ? [1, 1.5] : [1, 1.25]}
      camera={{ fov: start.fov ?? FOV.buiten, near: 0.03, far: 400, position: start.pos.toArray() }}
      // localClippingEnabled: de opengesneden afvoerstaander en -buis (Veranda/Afvoer) snijden
      // met een clipvlak per materiaal. De exposure geldt ook voor de ToneMapping-pass van de
      // nabewerking (three zet toneMappingExposure in elk programma met die uniform).
      gl={{ antialias: true, powerPreference: 'high-performance', localClippingEnabled: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1.15 }}
      onPointerMissed={() => { document.body.style.cursor = '' }}
    >
      {/* Geen monitor bij een geforceerde tier (?kwaliteit=hoog|laag) en niet op mobiel (daar is
          niets te verlagen); verder herstelt `hoog` na een dip en valt hij na 3 wissels vast terug. */}
      {!MOBIEL && GEFORCEERD !== 'hoog' && (
        <PerformanceMonitor ms={250} iterations={8} threshold={0.75}
          onDecline={() => wisselTier(false)} onIncline={() => wisselTier(true)} />
      )}
      {/* PCSS vast gemount op desktop: (un)mounten hercompileert álle shaders, dus nooit aan `hoog` koppelen.
          size 10: zacht maar nog getekend (ref1), size 24 smeerde de schaduw van liggers en meubels weg. */}
      {!MOBIEL && <SoftShadows size={10} samples={16} focus={0} />}
      <Licht nacht={nacht} L={L} hoog={hoog} />
      <MetMaterialen cfg={cfg}>
        <Inhoud cfg={cfg} L={L} view={view} bediening={bediening} zetBediening={zetBediening} nacht={nacht}
          toonMaten={toonMaten} meubels={meubels} hoog={hoog} laadRekwisieten={laadRekwisieten}
          regen={regen} regenGemount={regenGemount} onRegenKlaar={() => setRegenZichtbaar(false)}
          doorkijk={doorkijk} onKlikStaander={onKlikStaander} />
      </MetMaterialen>
      <Rekwisietenlader onLaad={() => setLaadRekwisieten(true)} />
      <OrbitControls
        ref={controls} makeDefault target={start.doel.toArray()}
        enableDamping dampingFactor={0.08}
        enablePan={!binnen} enableZoom={!binnen}
        rotateSpeed={binnen ? -0.32 : 0.6}
        minDistance={binnen ? 0.05 : 2.5} maxDistance={binnen ? 0.2 : 45}
        minPolarAngle={binnen ? 0.25 * Math.PI : 0.05}
        // Niet onder de horizon; de marge is zo klein dat de fotostand (pitch 0) bereikbaar blijft.
        maxPolarAngle={binnen ? 0.78 * Math.PI : Math.PI / 2 - 0.002}
        // Bij een aanbouw niet achter/in de woning kunnen draaien; het afvoerstandpunt (bij
        // uitloop 'achter' aan de achterkant van de staander) is vrij.
        minAzimuthAngle={binnen || afvoerZicht || L.vrijstaand ? -Infinity : -0.47 * Math.PI}
        maxAzimuthAngle={binnen || afvoerZicht || L.vrijstaand ? Infinity : 0.47 * Math.PI}
      />
      <CameraRig view={view} L={L} controls={controls} />
      {hoog && (
        <Foutgrens naam="Nabewerking">
          <Suspense fallback={null}><Effecten nacht={nacht} /></Suspense>
        </Foutgrens>
      )}
    </Canvas>
  )
}
