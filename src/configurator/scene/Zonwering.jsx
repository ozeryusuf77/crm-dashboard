// Zonwering: verticale ritsscreens, onderdak- en bovendakzonwering, allemaal
// met animerend doek (0 = opgerold, 1 = volledig uitgerold).
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useMat } from './materials.js'
import { useAnim, klikbaar } from './anim.js'
import { MUURPROFIEL_D } from '../layout.js'

// Box waarvan de bovenkant (y) of achterkant (z) op de oorsprong ligt — handig om te schalen.
function useAnkerBox(w, h, d, as) {
  return useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, d)
    if (as === 'y') g.translate(0, -h / 2, 0)
    if (as === 'z') g.translate(0, 0, d / 2)
    return g
  }, [w, h, d, as])
}

// ─── Verticaal ritsscreen ─────────────────────────────────────────────────────
// Lokaal: screen loopt van x = -lengte/2..lengte/2, cassette bovenaan op y = hoogte.
export function Ritsscreen({ lengte, hoogte, neer, onToggle, position, rotation }) {
  const mat = useMat()
  const cas = 0.11
  const val = hoogte - cas
  const doekGeom = useAnkerBox(lengte - 0.06, 1, 0.004, 'y')
  const doekRef = useRef()
  const lijstRef = useRef()

  useAnim(neer, t => {
    const s = Math.max(0.001, t * val)
    if (doekRef.current) {
      doekRef.current.scale.y = s
      doekRef.current.visible = t > 0.002
    }
    if (lijstRef.current) lijstRef.current.position.y = hoogte - cas - s
  }, 1.8)

  return (
    <group position={position} rotation={rotation} {...klikbaar(onToggle)}>
      <mesh material={mat.frame} position={[0, hoogte - cas / 2, 0]} castShadow>
        <boxGeometry args={[lengte, cas, cas]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} material={mat.frame} position={[s * (lengte / 2 - 0.02), (hoogte - cas) / 2, 0]} castShadow>
          <boxGeometry args={[0.04, hoogte - cas, 0.05]} />
        </mesh>
      ))}
      <mesh ref={doekRef} geometry={doekGeom} material={mat.doek} position={[0, hoogte - cas, 0]} castShadow renderOrder={4} />
      <mesh ref={lijstRef} material={mat.frame} position={[0, hoogte - cas, 0]} castShadow>
        <boxGeometry args={[lengte - 0.08, 0.04, 0.045]} />
      </mesh>
    </group>
  )
}

// ─── Onderdak zonwering ──────────────────────────────────────────────────────
// Doek loopt onder de liggers van de gevel naar de goot.
export function OnderdakZonwering({ L, uit, onToggle }) {
  const mat = useMat()
  const breedte = L.W - 0.16
  const lengte = L.lengteDak / Math.cos(L.helling) - 0.2
  const doekGeom = useAnkerBox(breedte, 0.004, 1, 'z')
  const doekRef = useRef()
  const lijstRef = useRef()
  const z0 = L.zAchter + 0.12
  const y0 = L.dakY(z0) - L.lH - 0.06

  useAnim(uit, t => {
    const s = Math.max(0.001, t * lengte)
    if (doekRef.current) {
      doekRef.current.scale.z = s
      doekRef.current.visible = t > 0.002
    }
    if (lijstRef.current) lijstRef.current.position.z = s
  }, 1.6)

  return (
    <group {...klikbaar(onToggle)}>
      <mesh material={mat.frame} position={[0, y0, z0 - 0.04]} castShadow>
        <boxGeometry args={[L.W - 0.1, 0.09, 0.1]} />
      </mesh>
      <group position={[0, y0, z0]} rotation={[L.helling, 0, 0]}>
        <mesh ref={doekRef} geometry={doekGeom} material={mat.doek} renderOrder={4} castShadow />
        <mesh ref={lijstRef} material={mat.frame}>
          <boxGeometry args={[breedte, 0.025, 0.04]} />
        </mesh>
      </group>
    </group>
  )
}

// ─── Bovendak zonwering ───────────────────────────────────────────────────────
// Cassette op het dak bij de gevel, doek over geleiders tot voorbij de goot.
export function BovendakZonwering({ L, uit, onToggle }) {
  const mat = useMat()
  const hoog = 0.17
  const uitval = 0.35
  const lengte = (L.lengteDak + uitval) / Math.cos(L.helling)
  const z0 = L.vrijstaand ? L.zAchter : MUURPROFIEL_D + 0.08
  const y0 = L.dakY(z0) + hoog
  const breedte = L.W - 0.12
  const doekGeom = useAnkerBox(breedte, 0.004, 1, 'z')
  const doekRef = useRef()
  const lijstRef = useRef()

  const nGeleiders = Math.max(2, Math.ceil(L.W / 3.5) + 1)
  const xGeleiders = Array.from({ length: nGeleiders }, (_, i) => -L.W / 2 + 0.04 + (i * (L.W - 0.08)) / (nGeleiders - 1))

  useAnim(uit, t => {
    const s = Math.max(0.001, t * (lengte - 0.05))
    if (doekRef.current) {
      doekRef.current.scale.z = s
      doekRef.current.visible = t > 0.002
    }
    if (lijstRef.current) lijstRef.current.position.z = s
  }, 1.6)

  return (
    <group {...klikbaar(onToggle)}>
      <mesh material={mat.frame} position={[0, y0 + 0.02, z0 - 0.02]} castShadow>
        <boxGeometry args={[L.W, 0.14, 0.17]} />
      </mesh>
      <group position={[0, y0, z0]} rotation={[L.helling, 0, 0]}>
        {xGeleiders.map((x, i) => (
          <mesh key={i} material={mat.frame} position={[x, -0.02, lengte / 2]} castShadow>
            <boxGeometry args={[0.05, 0.06, lengte]} />
          </mesh>
        ))}
        <mesh ref={doekRef} geometry={doekGeom} material={mat.doekDicht} castShadow receiveShadow />
        <mesh ref={lijstRef} material={mat.frame} castShadow>
          <boxGeometry args={[breedte + 0.08, 0.05, 0.07]} />
        </mesh>
      </group>
      {/* Steunen tussen dak en geleiders, bij gevel en goot */}
      {xGeleiders.map((x, i) => [L.zAchter + 0.6, L.zVoorStaander].map((z, j) => (
        <mesh key={`${i}-${j}`} material={mat.frame} position={[x, L.dakY(z) + hoog / 2 - 0.02, z]} castShadow>
          <boxGeometry args={[0.04, hoog, 0.04]} />
        </mesh>
      )))}
    </group>
  )
}
