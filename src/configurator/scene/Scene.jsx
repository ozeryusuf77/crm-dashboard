import * as THREE from 'three'
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, SoftShadows, PerformanceMonitor } from '@react-three/drei'
import { MaterialenProvider, useMaterialen } from './materials.js'
import Veranda from './Veranda.jsx'
import { Wand } from './Wanden.jsx'
import { Ritsscreen, OnderdakZonwering, BovendakZonwering } from './Zonwering.jsx'
import { Licht, Omgeving, Maatvoering } from './Omgeving.jsx'
import { wandSlots, wandVoor, screensPerVak } from '../layout.js'

const Effecten = lazy(() => import('./Effecten.jsx'))

// Kwaliteitsniveau vóór het aanmaken van de Canvas bepalen (antialias kan daarna niet meer wisselen).
// Met ?kwaliteit=laag of ?kwaliteit=hoog in de URL is het niveau te forceren.
const GEFORCEERD = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('kwaliteit') : null
const MOBIEL = GEFORCEERD ? GEFORCEERD === 'laag' : typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4
)

// Camerastandpunten. "binnen" = op ooghoogte onder de veranda, rondkijken door te slepen.
export function cameraStandpunt(naam, L) {
  const r = Math.max(L.W, L.D * 1.6) * 0.9 + 4.5
  const midden = new THREE.Vector3(0, 1.3, L.D * 0.45)
  switch (naam) {
    case 'voor':   return { pos: new THREE.Vector3(0, 1.7, L.D + r * 1.05), doel: new THREE.Vector3(0, 1.35, L.D * 0.4) }
    case 'links':
    case 'rechts': {
      // Zijaanzicht: afstand op basis van de diepte, gericht op het dichtstbijzijnde uiteinde.
      const s = naam === 'links' ? -1 : 1
      const rz = Math.max(L.D * 1.6, 4) * 0.9 + 4
      const doel = new THREE.Vector3(s * Math.max(0, L.W / 2 - 1.8), 1.3, L.D * 0.45)
      return { pos: new THREE.Vector3(s * (L.W / 2 + rz * 0.85), 1.9, L.D * 0.75 + 1.5), doel }
    }
    case 'achter': return { pos: new THREE.Vector3(r * 0.35, 2.2, -r * 0.75), doel: midden }
    case 'boven':  return { pos: new THREE.Vector3(0.001, r * 1.6, L.D / 2 + 1.2), doel: new THREE.Vector3(0, 0, L.D / 2) }
    case 'binnen': {
      // In de hoek bij de gevel, schuin over de loungeset naar de tuin kijkend.
      const pos = new THREE.Vector3(L.W / 2 - 0.6, 1.6, L.zAchter + 0.45)
      const blik = new THREE.Vector3(-L.W * 0.2, 1.05, L.D + 1).sub(pos).setLength(0.1)
      return { pos, doel: pos.clone().add(blik), binnen: true }
    }
    default:       return { pos: new THREE.Vector3(r * 0.6, 2.3 + r * 0.14, L.D + r * 0.85), doel: midden }
  }
}

function CameraRig({ view, L, controls }) {
  const { camera } = useThree()
  const doel = useRef(null)
  const binnen = view.naam === 'binnen'

  useEffect(() => {
    doel.current = cameraStandpunt(view.naam, L)
    // Bij de eerste weergave direct op de plek zetten.
    if (view.direct) {
      camera.position.copy(doel.current.pos)
      controls.current?.target.copy(doel.current.doel)
    }
    // Opnieuw richten bij ander standpunt of (binnen) gewijzigde maten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, binnen ? L.W : 0, binnen ? L.D : 0, binnen ? L.vrijstaand : 0])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => { doel.current = null }
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, dt) => {
    const fov = binnen ? 62 : 40
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
    if (camera.position.distanceTo(d.pos) < 0.005 && c.target.distanceTo(d.doel) < 0.005) doel.current = null
  })
  return null
}

function Inhoud({ cfg, L, bediening, zetBediening, nacht, toonMaten, meubels, binnen }) {
  const slots = useMemo(() => wandSlots(L), [L])
  const toggleWand = key => zetBediening(b => ({ ...b, open: { ...b.open, [key]: (b.open[key] ?? 0) > 0.5 ? 0 : 1 } }))
  const toggleScreen = zijde => zetBediening(b => ({ ...b, screens: { ...b.screens, [zijde]: (b.screens[zijde] ?? 0) > 0.5 ? 0 : 1 } }))
  const toggle = naam => zetBediening(b => ({ ...b, [naam]: b[naam] > 0.5 ? 0 : 1 }))

  const plaatsing = slot => {
    if (slot.zijde === 'voor') {
      const v = L.vakken[slot.vak]
      return { position: [v.midden, 0, L.zVoorStaander], rotation: [0, 0, 0], hoogte: L.wandH.voor }
    }
    if (slot.zijde === 'achter') {
      const v = L.vakken[slot.vak]
      return { position: [v.midden, 0, L.zAchter], rotation: [0, Math.PI, 0], hoogte: L.wandH.achter }
    }
    const s = slot.zijde === 'links' ? -1 : 1
    return { position: [s * L.zij.x, 0, (L.zij.z0 + L.zij.z1) / 2], rotation: [0, s * Math.PI / 2, 0], hoogte: L.wandH.zij }
  }

  const sc = cfg.zonwering.screens
  const voorOffset = L.sD / 2 + 0.085
  const zijOffset = L.sB / 2 + 0.085
  // Screens per vak; een vak breder dan 5,5 m krijgt meerdere screens naast elkaar.
  const vakScreens = (zijde, z, rot, hoogte) => L.vakken.flatMap((v, i) => {
    const n = screensPerVak(v.breedte + L.sB)
    const b = (v.breedte + L.sB) / n
    return Array.from({ length: n }, (_, k) => (
      <Ritsscreen key={`s${zijde}${i}-${k}`} lengte={b} hoogte={hoogte} neer={bediening.screens[zijde] ?? 0}
        position={[v.x0 - L.sB / 2 + b * (k + 0.5), 0, z]} rotation={rot} onToggle={() => toggleScreen(zijde)} />
    ))
  })

  return (
    <>
      <Veranda cfg={cfg} L={L} nacht={nacht} heaterAan={bediening.heater > 0.5} />
      {slots.map(slot => {
        const p = plaatsing(slot)
        return (
          <Wand key={`${slot.key}-${wandVoor(cfg, slot.key)?.type}`} w={wandVoor(cfg, slot.key)} lengte={slot.lengte} hoogte={p.hoogte}
            position={p.position} rotation={p.rotation} open={bediening.open[slot.key] ?? 0}
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
          <Ritsscreen key={`s-${zijde}-${k}`} lengte={b} hoogte={L.Hf} neer={bediening.screens[zijde] ?? 0}
            position={[s * (L.zij.x + zijOffset), 0, L.zij.z0 + b * (k + 0.5)]} rotation={[0, s * Math.PI / 2, 0]}
            onToggle={() => toggleScreen(zijde)} />
        ))
      })}

      {cfg.zonwering.onderdak && <OnderdakZonwering L={L} uit={bediening.onderdak} onToggle={() => toggle('onderdak')} />}
      {cfg.zonwering.bovendak && <BovendakZonwering L={L} uit={bediening.bovendak} onToggle={() => toggle('bovendak')} />}

      <Omgeving L={L} nacht={nacht} meubels={meubels} />
      {toonMaten && !binnen && <Maatvoering L={L} cfg={cfg} />}
    </>
  )
}

function MetMaterialen({ cfg, children }) {
  const mat = useMaterialen(cfg)
  return <MaterialenProvider value={mat}>{children}</MaterialenProvider>
}

export default function Scene({ cfg, L, view, bediening, zetBediening, nacht, toonMaten, meubels }) {
  const controls = useRef()
  const binnen = view.naam === 'binnen'
  const [hoog, setHoog] = useState(!MOBIEL)
  // Alleen het eerste standpunt; daarna verplaatst CameraRig de camera vloeiend.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const start = useMemo(() => cameraStandpunt(view.naam, L), [])
  return (
    <Canvas
      shadows dpr={hoog ? [1, 1.5] : [1, 1.25]}
      camera={{ fov: 40, near: 0.03, far: 400, position: start.pos.toArray() }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping }}
      onPointerMissed={() => { document.body.style.cursor = '' }}
    >
      <PerformanceMonitor onDecline={() => setHoog(false)} flipflops={2} />
      {hoog && <SoftShadows size={18} samples={10} focus={0.4} />}
      <Licht nacht={nacht} L={L} hoog={hoog} />
      <MetMaterialen cfg={cfg}>
        <Inhoud cfg={cfg} L={L} bediening={bediening} zetBediening={zetBediening} nacht={nacht} toonMaten={toonMaten} meubels={meubels} binnen={binnen} />
      </MetMaterialen>
      <OrbitControls
        ref={controls} makeDefault target={start.doel.toArray()}
        enableDamping dampingFactor={0.08}
        enablePan={!binnen} enableZoom={!binnen}
        rotateSpeed={binnen ? -0.32 : 0.6}
        minDistance={binnen ? 0.05 : 2} maxDistance={binnen ? 0.2 : 45}
        minPolarAngle={binnen ? 0.25 * Math.PI : 0.05}
        maxPolarAngle={binnen ? 0.78 * Math.PI : Math.PI / 2 - 0.03}
        // Bij een aanbouw niet achter/in de woning kunnen draaien.
        minAzimuthAngle={binnen || L.vrijstaand ? -Infinity : -0.47 * Math.PI}
        maxAzimuthAngle={binnen || L.vrijstaand ? Infinity : 0.47 * Math.PI}
      />
      <CameraRig view={view} L={L} controls={controls} />
      {hoog && <Suspense fallback={null}><Effecten nacht={nacht} /></Suspense>}
    </Canvas>
  )
}
