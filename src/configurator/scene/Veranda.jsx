// Het aluminium frame: staanders, goot, muurprofiel, liggers, dakplaten, spieën,
// en de verlichting/heater die aan het frame hangen.
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMat } from './materials.js'
import { STAANDER, LIGGER_B, LIGGER_H, MUURPROFIEL_D } from '../layout.js'

function Box({ args, position, rotation, mat, schaduw = true }) {
  return (
    <mesh position={position} rotation={rotation} material={mat} castShadow={schaduw} receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  )
}

// Goot met klassiek (gebogen) of strak profiel, geëxtrudeerd over de breedte.
// z = buitenkant van de goot (voor: z = D, achter: z = 0).
function Goot({ L, z, y, breedte, achter = false }) {
  const mat = useMat()
  const geom = useMemo(() => {
    const d = L.gootD, h = L.gootH
    const s = new THREE.Shape()
    if (L.strak) {
      s.moveTo(0, 0); s.lineTo(d, 0); s.lineTo(d, h); s.lineTo(0, h); s.lineTo(0, 0)
    } else {
      s.moveTo(0, 0)
      s.lineTo(d * 0.55, 0)
      s.quadraticCurveTo(d * 1.08, h * 0.05, d, h * 0.42)
      s.quadraticCurveTo(d * 0.88, h * 0.62, d * 0.97, h * 0.8)
      s.lineTo(d * 0.97, h)
      s.lineTo(0, h)
      s.lineTo(0, 0)
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: breedte, bevelEnabled: false, curveSegments: 16 })
    return g
  }, [L.gootD, L.gootH, L.strak, breedte])

  // Lokale x (profieldiepte) → wereld z, extrusie → wereld -x.
  return (
    <mesh
      geometry={geom} material={mat.frame} castShadow receiveShadow
      position={achter ? [-breedte / 2, y, z + L.gootD] : [breedte / 2, y, z - L.gootD]}
      rotation={[0, achter ? Math.PI / 2 : -Math.PI / 2, 0]}
    />
  )
}

// Driehoekige spie boven de zijwand, onder de schuine ligger.
function Spie({ L, kant, type }) {
  const mat = useMat()
  const geom = useMemo(() => {
    const z0 = L.zij.z0, z1 = L.zij.z1
    const onder = L.Hf + 0.005
    const s = new THREE.Shape()
    s.moveTo(z0, onder)
    s.lineTo(z1, onder)
    s.lineTo(z1, L.dakY(z1) - LIGGER_H - 0.005)
    s.lineTo(z0, L.dakY(z0) - LIGGER_H - 0.005)
    s.lineTo(z0, onder)
    return new THREE.ShapeGeometry(s)
  }, [L])
  const m = type === 'glas' ? mat.glasHelder : type === 'poly' ? mat.polySpie : mat.frame
  const x = kant * L.zij.x
  return (
    <group>
      <mesh geometry={geom} material={m} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow={type === 'alu'} />
      {/* Verticale tussenstijl halverwege voor stevigheid */}
      <Box args={[0.04, L.dakY((L.zij.z0 + L.zij.z1) / 2) - LIGGER_H - L.Hf, 0.04]}
        position={[x, (L.Hf + L.dakY((L.zij.z0 + L.zij.z1) / 2) - LIGGER_H) / 2, (L.zij.z0 + L.zij.z1) / 2]} mat={mat.frame} />
    </group>
  )
}

function spotPosities(L, n) {
  if (!n) return []
  const rijen = n >= 8 && L.D >= 3 ? 2 : 1
  const perRij = Math.ceil(n / rijen)
  const binnen = L.xLiggers.slice(1, -1)
  const bron = perRij <= binnen.length ? binnen : L.xLiggers
  const res = []
  for (let r = 0; r < rijen; r++) {
    const z = L.zAchter + (L.lengteDak * (r + 1)) / (rijen + 1)
    for (let i = 0; i < perRij && res.length < n; i++) {
      const doel = -L.W / 2 + (L.W * (i + 0.5)) / perRij
      const x = perRij <= bron.length
        ? bron.reduce((a, b) => (Math.abs(b - doel) < Math.abs(a - doel) ? b : a))
        : doel
      res.push([x, L.dakY(z) - LIGGER_H - 0.004, z])
    }
  }
  return res
}

export default function Veranda({ cfg, L, nacht, heaterAan }) {
  const mat = useMat()
  const { W, Hf } = L
  const lengteLigger = L.lengteDak / Math.cos(L.helling)
  const zMid = (L.zAchter + L.zVoorStaander) / 2

  // Dakplaten tussen de liggers.
  const platen = []
  for (let i = 0; i < L.xLiggers.length - 1; i++) {
    const a = L.xLiggers[i] + LIGGER_B / 2, b = L.xLiggers[i + 1] - LIGGER_B / 2
    platen.push({ x: (a + b) / 2, b: b - a + 0.012 })
  }
  const dikte = cfg.dak.startsWith('poly') ? 0.016 : 0.009

  const zijBalk = kant => {
    const w = cfg.wanden[kant]
    return cfg.spie[kant] !== 'geen' || (w && w.type !== 'open') || cfg.zonwering.screens[kant]
  }

  const spots = useMemo(() => spotPosities(L, cfg.extra.spots), [L, cfg.extra.spots])
  // Max 8 echte lichtbronnen voor prestaties; extra spots zijn alleen gloeiend.
  const lichtSpots = spots.filter((_, i) => spots.length <= 8 || i % Math.ceil(spots.length / 8) === 0)

  const ledRef = useRef(0)
  useFrame((_, dt) => {
    ledRef.current = THREE.MathUtils.damp(ledRef.current, nacht ? 1 : 0, 4, dt)
    mat.led.emissiveIntensity = ledRef.current * 6
    mat.heater.emissiveIntensity = THREE.MathUtils.damp(mat.heater.emissiveIntensity, heaterAan ? 2.2 : 0, 3, dt)
  })

  const heaterPos = []
  for (let i = 0; i < cfg.extra.heater; i++) {
    const x = cfg.extra.heater === 1 ? 0 : (i === 0 ? -1 : 1) * W / 4
    heaterPos.push([x, L.yDakAchter - 0.32, L.vrijstaand ? L.zAchter + 0.12 : 0.1])
  }

  return (
    <group>
      {/* Staanders voor */}
      {L.xStaanders.map((x, i) => (
        <group key={`sv${i}`}>
          <Box args={[STAANDER, Hf, STAANDER]} position={[x, Hf / 2, L.zVoorStaander]} mat={mat.frame} />
          <Box args={[0.18, 0.012, 0.18]} position={[x, 0.006, L.zVoorStaander]} mat={mat.frame} />
        </group>
      ))}

      {/* Goot voor */}
      <Goot L={L} z={L.D} y={Hf} breedte={W} />

      {L.vrijstaand ? (
        <>
          {L.xStaanders.map((x, i) => (
            <group key={`sa${i}`}>
              <Box args={[STAANDER, L.achterBalkOnder, STAANDER]} position={[x, L.achterBalkOnder / 2, L.zAchter]} mat={mat.frame} />
              <Box args={[0.18, 0.012, 0.18]} position={[x, 0.006, L.zAchter]} mat={mat.frame} />
            </group>
          ))}
          <Goot L={L} z={0} y={L.achterBalkOnder} breedte={W} achter />
        </>
      ) : (
        // Muurprofiel tegen de gevel
        <Box args={[W, 0.17, MUURPROFIEL_D]} position={[0, L.yDakAchter - 0.06, MUURPROFIEL_D / 2]} mat={mat.frame} />
      )}

      {/* Liggers */}
      {L.xLiggers.map((x, i) => (
        <Box key={`l${i}`} args={[LIGGER_B, LIGGER_H, lengteLigger]}
          position={[x, L.dakY(zMid) - LIGGER_H / 2, zMid]} rotation={[L.helling, 0, 0]} mat={mat.frame} />
      ))}

      {/* Dakplaten */}
      {platen.map((p, i) => (
        <mesh key={`p${i}`} material={mat.dak} position={[p.x, L.dakY(zMid) - dikte / 2 + 0.004, zMid]}
          rotation={[L.helling, 0, 0]} renderOrder={2}>
          <boxGeometry args={[p.b, dikte, lengteLigger]} />
        </mesh>
      ))}
      {/* Afdekprofielen op de liggers */}
      {L.xLiggers.map((x, i) => (
        <Box key={`a${i}`} args={[LIGGER_B * 0.8, 0.012, lengteLigger]}
          position={[x, L.dakY(zMid) + 0.01, zMid]} rotation={[L.helling, 0, 0]} mat={mat.frame} schaduw={false} />
      ))}

      {/* Zijbalken (dragen spie / zijwand / screen) */}
      {[['links', -1], ['rechts', 1]].map(([kant, s]) => zijBalk(kant) && (
        <Box key={kant} args={[0.06, 0.06, L.zij.lengte]} position={[s * L.zij.x, Hf - 0.03, (L.zij.z0 + L.zij.z1) / 2]} mat={mat.frame} />
      ))}
      {[['links', -1], ['rechts', 1]].map(([kant, s]) => cfg.spie[kant] !== 'geen' && (
        <Spie key={`spie-${kant}`} L={L} kant={s} type={cfg.spie[kant]} />
      ))}

      {/* LED-spots */}
      {spots.map((p, i) => (
        <mesh key={`spot${i}`} position={p} rotation={[L.helling, 0, 0]} material={mat.led}>
          <cylinderGeometry args={[0.03, 0.03, 0.01, 20]} />
        </mesh>
      ))}
      {nacht && lichtSpots.map((p, i) => (
        <pointLight key={`pl${i}`} position={[p[0], p[1] - 0.1, p[2]]} intensity={(2.2 * spots.length) / lichtSpots.length}
          distance={6} decay={1.6} color="#ffd9a0" />
      ))}

      {/* LED-strip in de goot */}
      {cfg.extra.ledStrip && (
        <>
          <mesh position={[0, Hf + 0.01, L.D - L.gootD - 0.004]} material={mat.led}>
            <boxGeometry args={[W - 0.2, 0.012, 0.008]} />
          </mesh>
          {nacht && [-1, 0, 1].map(k => (
            <pointLight key={k} position={[(k * W) / 3, Hf - 0.15, L.D - L.gootD - 0.1]} intensity={1.2} distance={4} decay={1.6} color="#ffd9a0" />
          ))}
        </>
      )}

      {/* Infrarood heaters */}
      {heaterPos.map((p, i) => (
        <group key={`h${i}`} position={p}>
          <mesh material={mat.frame} castShadow><boxGeometry args={[0.9, 0.11, 0.09]} /></mesh>
          <mesh position={[0, -0.03, 0.047]} material={mat.heater}><boxGeometry args={[0.78, 0.04, 0.005]} /></mesh>
          {heaterAan && <pointLight position={[0, -0.2, 0.3]} intensity={1.6} distance={3} color="#ff7a3c" />}
        </group>
      ))}
    </group>
  )
}
