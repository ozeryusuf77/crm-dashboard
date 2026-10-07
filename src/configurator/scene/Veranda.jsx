// Het aluminium frame per model: staanders, goot of kubistische omkasting,
// muurprofiel, liggers, dakplaten, spieën, koppelingen en hemelwaterafvoer,
// plus de verlichting/heater die aan het frame hangen.
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMat } from './materials.js'
import { Balk } from './profiel.js'
import { MUURPROFIEL_D } from '../layout.js'

function Box({ args, position, rotation, mat, schaduw = true }) {
  return (
    <mesh position={position} rotation={rotation} material={mat} castShadow={schaduw} receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  )
}

// Doorsnede van de goot in (u = diepte vanaf de dakzijde, v = hoogte).
function gootVorm(vorm, B, H) {
  const s = new THREE.Shape()
  if (vorm === 'rond') {
    // Halfronde sierlijke goot met kraal aan de bovenzijde.
    s.moveTo(0, H * 0.12)
    s.quadraticCurveTo(0, 0, B * 0.22, 0)
    s.bezierCurveTo(B * 0.78, -0.004, B * 1.02, H * 0.2, B, H * 0.56)
    s.quadraticCurveTo(B * 0.99, H * 0.64, B * 0.95, H * 0.68)
    s.quadraticCurveTo(B * 1.03, H * 0.82, B * 0.96, H * 0.93)
    s.lineTo(B * 0.96, H)
    s.lineTo(0, H)
    s.lineTo(0, H * 0.12)
  } else {
    // Rechte goot met afgeronde onderkant en een smalle sierrand bovenop.
    const r = 0.012
    s.moveTo(0, r)
    s.quadraticCurveTo(0, 0, r, 0)
    s.lineTo(B - r, 0)
    s.quadraticCurveTo(B, 0, B, r)
    s.lineTo(B, H - 0.018)
    s.lineTo(B + 0.006, H - 0.012)
    s.lineTo(B + 0.006, H)
    s.lineTo(0, H)
    s.lineTo(0, r)
  }
  return s
}

// Goot per deel (met naad + koppelstuk op elke koppeling) en kopschotten.
// achter = vrijstaande achterzijde (profiel gespiegeld, buitenkant op z = 0).
function Goot({ L, y, achter = false }) {
  const mat = useMat()
  const vorm = useMemo(() => gootVorm(L.goot, L.gootB, L.gootH), [L.goot, L.gootB, L.gootH])
  const kop = useMemo(() => new THREE.ExtrudeGeometry(vorm, { depth: 0.005, bevelEnabled: false, curveSegments: 12 }), [vorm])
  const delen = useMemo(() => L.delen.map(d => {
    const g = new THREE.ExtrudeGeometry(vorm, { depth: d.breedte - 0.004, bevelEnabled: false, curveSegments: 16 })
    return { d, g }
  }), [vorm, L.delen])

  // Lokale x (profieldiepte) → wereld ±z, extrusie → wereld x.
  const z = achter ? L.gootB : L.D - L.gootB
  const rot = [0, achter ? Math.PI / 2 : -Math.PI / 2, 0]
  return (
    <group>
      {delen.map(({ d, g }, i) => (
        <mesh key={i} geometry={g} material={mat.frame} castShadow receiveShadow rotation={rot}
          position={achter ? [d.x0 + 0.002, y, z] : [d.x1 - 0.002, y, z]} />
      ))}
      {/* Kopschotten aan beide uiteinden */}
      {[-1, 1].map(s => (
        <mesh key={s} geometry={kop} material={mat.frame} rotation={rot} scale={[1.02, 1.02, 1]}
          position={achter ? [s < 0 ? -L.W / 2 - 0.005 : L.W / 2, y - 0.002, z] : [s < 0 ? -L.W / 2 : L.W / 2 + 0.005, y - 0.002, z]} />
      ))}
      {/* Koppelstukken: iets grotere band over de naad */}
      {L.koppelingen.map((x, i) => (
        <mesh key={`k${i}`} geometry={kop} material={mat.koppel} rotation={rot} scale={[1.03, 1.03, 8]}
          position={achter ? [x - 0.02, y - 0.003, z] : [x + 0.02, y - 0.003, z]} />
      ))}
    </group>
  )
}

// Kubistische omkasting: rechthoekige balk per deel met naad op de koppeling.
function KubusBalk({ L, z, y0, h, diep }) {
  const mat = useMat()
  return (
    <group>
      {L.delen.map((d, i) => (
        <Balk key={i} as="x" b={diep} h={h} lengte={d.breedte - 0.004} r={0.006}
          position={[d.midden, y0 + h / 2, z]} mat={mat.frame} />
      ))}
      {L.koppelingen.map((x, i) => (
        <Box key={`k${i}`} args={[0.03, h + 0.004, diep + 0.004]} position={[x, y0 + h / 2, z]} mat={mat.koppel} />
      ))}
    </group>
  )
}

// Muurprofiel tegen de gevel, per deel, met loodslabbe erboven.
function Muurprofiel({ L, yBoven, h }) {
  const mat = useMat()
  return (
    <group>
      {L.delen.map((d, i) => (
        <Balk key={i} as="x" b={MUURPROFIEL_D} h={h} lengte={d.breedte - 0.004} r={0.005}
          position={[d.midden, yBoven - h / 2, MUURPROFIEL_D / 2]} mat={mat.frame} />
      ))}
      <Box args={[L.W + 0.02, 0.12, 0.006]} position={[0, yBoven + 0.055, 0.004]} rotation={[0.08, 0, 0]} mat={mat.lood} schaduw={false} />
    </group>
  )
}

// Driehoekige spie boven de zijwand, onder de schuine ligger (alleen hellend dak).
function Spie({ L, kant, type }) {
  const mat = useMat()
  const geom = useMemo(() => {
    const z0 = L.zij.z0, z1 = L.zij.z1
    const onder = L.Hf + 0.005
    const s = new THREE.Shape()
    s.moveTo(z0, onder)
    s.lineTo(z1, onder)
    s.lineTo(z1, L.dakY(z1) - L.lH - 0.005)
    s.lineTo(z0, L.dakY(z0) - L.lH - 0.005)
    s.lineTo(z0, onder)
    return new THREE.ShapeGeometry(s)
  }, [L])
  const m = type === 'glas' ? mat.glasHelder : type === 'poly' ? mat.polySpie : mat.frame
  const x = kant * L.zij.x
  const zm = (L.zij.z0 + L.zij.z1) / 2
  const hm = L.dakY(zm) - L.lH - L.Hf
  return (
    <group>
      <mesh geometry={geom} material={m} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow={type === 'alu'} renderOrder={3} />
      <Balk as="y" b={0.04} h={0.04} lengte={hm} position={[x, L.Hf + hm / 2, zm]} mat={mat.frame} />
    </group>
  )
}

function Staander({ L, x, z, hoogte }) {
  const mat = useMat()
  return (
    <group>
      <Balk as="y" b={L.sB} h={L.sD} lengte={hoogte} r={0.006} position={[x, hoogte / 2, z]} mat={mat.frame} />
      {/* Voetplaat met afdekkapjes over de ankerbouten */}
      <Box args={[L.sB + 0.07, 0.012, L.sD + 0.07]} position={[x, 0.006, z]} mat={mat.frame} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
        <mesh key={i} position={[x + a * (L.sB / 2 + 0.022), 0.017, z + b * (L.sD / 2 + 0.022)]} material={mat.frame}>
          <cylinderGeometry args={[0.009, 0.009, 0.012, 12]} />
        </mesh>
      ))}
    </group>
  )
}

// Zichtbare hemelwaterafvoer (Classic/Linea) langs de hoekstaander, met bocht naar de goot.
function Afvoer({ L, kant }) {
  const mat = useMat()
  const x = kant * (L.W / 2 + 0.05)
  const z = L.D - L.gootB * 0.45
  const lengte = L.Hf - 0.12
  return (
    <group>
      <mesh position={[x, 0.06 + lengte / 2, z]} material={mat.frame} castShadow>
        <cylinderGeometry args={[0.04, 0.04, lengte, 20]} />
      </mesh>
      <mesh position={[x - kant * 0.03, L.Hf - 0.03, z]} rotation={[0, 0, kant * 0.7]} material={mat.frame} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.16, 16]} />
      </mesh>
      <mesh position={[x + kant * 0.03, 0.05, z]} rotation={[0, 0, -kant * 0.9]} material={mat.frame} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.12, 16]} />
      </mesh>
    </group>
  )
}

function spotPosities(L, n) {
  if (!n) return []
  const rijen = n >= 8 && L.D >= 3 ? 2 : 1
  const perRij = Math.ceil(n / rijen)
  const kandidaten = L.liggers.filter((l, i) => !(l.koppel && L.liggers[i - 1]?.koppel)).map(l => l.x)
  const binnen = kandidaten.slice(1, -1)
  const bron = perRij <= binnen.length ? binnen : kandidaten
  const res = []
  for (let r = 0; r < rijen; r++) {
    const z = L.zAchter + (L.lengteDak * (r + 1)) / (rijen + 1)
    for (let i = 0; i < perRij && res.length < n; i++) {
      const doel = -L.W / 2 + (L.W * (i + 0.5)) / perRij
      const x = perRij <= bron.length
        ? bron.reduce((a, b) => (Math.abs(b - doel) < Math.abs(a - doel) ? b : a))
        : doel
      res.push([x, L.dakY(z) - L.lH - 0.004, z])
    }
  }
  return res
}

export default function Veranda({ cfg, L, nacht, heaterAan }) {
  const mat = useMat()
  const { W, Hf } = L
  const lengteLigger = L.lengteDak / Math.cos(L.helling)
  const zMid = (L.zAchter + L.zGoot) / 2
  const dikte = L.soort === 'poly' ? 0.016 : 0.009

  const zijBalk = kant => {
    if (L.kubus) return false
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

  const hVoor = Hf
  const hAchter = L.achterBalkOnder

  return (
    <group>
      {/* Staanders voor (bij Cubic XL op de draagbalklijn, 1 m achter de voorrand) */}
      {L.xStaanders.map((x, i) => <Staander key={`sv${i}`} L={L} x={x} z={L.zVoorStaander} hoogte={hVoor} />)}

      {/* Voorzijde: goot of omkasting */}
      {L.kubus
        ? <KubusBalk L={L} z={L.D - L.gootB / 2} y0={Hf} h={L.gootH} diep={L.gootB} />
        : <Goot L={L} y={Hf} />}
      {L.overstek > 0 && (
        // Draagbalk op de staanders; de liggers kragen 1 m uit tot de voorbalk.
        <KubusBalk L={L} z={L.zVoorStaander} y0={Hf} h={L.gootH - 0.06} diep={L.sD + 0.02} />
      )}

      {/* Achterzijde: muurprofiel of (vrijstaand) achterstaanders + goot/omkasting */}
      {L.vrijstaand ? (
        <>
          {L.xStaanders.map((x, i) => <Staander key={`sa${i}`} L={L} x={x} z={L.zAchter} hoogte={hAchter} />)}
          {L.kubus
            ? <KubusBalk L={L} z={L.gootB / 2} y0={Hf} h={L.gootH} diep={L.gootB} />
            : <Goot L={L} y={hAchter} achter />}
        </>
      ) : L.kubus
        ? <Muurprofiel L={L} yBoven={L.yRand} h={0.22} />
        : <Muurprofiel L={L} yBoven={L.yDakAchter + 0.025} h={0.17} />}

      {/* Kubistische zijomkasting over de volle diepte */}
      {L.kubus && (() => {
        // Tussen muurprofiel/achterbalk en voorbalk, zodat vlakken niet samenvallen.
        const z0 = L.vrijstaand ? L.gootB : MUURPROFIEL_D
        const z1 = L.D - L.gootB
        return [-1, 1].map(s => (
          <Balk key={`zo${s}`} as="z" b={0.09} h={L.gootH} lengte={z1 - z0} r={0.006}
            position={[s * (W / 2 - 0.045), Hf + L.gootH / 2, (z0 + z1) / 2]} mat={mat.frame} />
        ))
      })()}

      {/* Liggers (dubbel op een koppeling) met afdekprofiel */}
      {L.liggers.map((l, i) => (
        // Draaipunt op de bovenkant van de ligger in het midden, zodat de helling klopt.
        <group key={`l${i}`} position={[l.x, L.dakY(zMid), zMid]} rotation={[L.helling, 0, 0]}>
          <Balk as="z" b={L.lB} h={L.lH} lengte={lengteLigger} r={0.004} position={[0, -L.lH / 2, 0]} mat={mat.frame} />
          <Box args={[L.lB * 0.85, 0.012, lengteLigger]} position={[0, 0.011, 0]} mat={mat.frame} schaduw={false} />
        </group>
      ))}

      {/* Dakplaten */}
      {L.platen.map((p, i) => (
        <mesh key={`p${i}`} material={mat.dak} position={[p.x, L.dakY(zMid) - dikte / 2 + 0.004, zMid]}
          rotation={[L.helling, 0, 0]} renderOrder={2} castShadow={mat.dakSchaduw} receiveShadow>
          <boxGeometry args={[p.b, dikte, lengteLigger]} />
        </mesh>
      ))}
      {/* Afsluitprofiel aan de gootzijde van de dakplaten */}
      {!L.kubus && (
        <Box args={[W - 0.02, 0.022, 0.03]} position={[0, L.yDakVoor + 0.006, L.zGoot - 0.03]} rotation={[L.helling, 0, 0]} mat={mat.frame} schaduw={false} />
      )}

      {/* Zijbalken (dragen spie / zijwand / screen) en spieën */}
      {[['links', -1], ['rechts', 1]].map(([kant, s]) => zijBalk(kant) && (
        <Balk key={kant} as="z" b={L.zijBalk} h={L.zijBalk} lengte={L.zij.lengte}
          position={[s * L.zij.x, Hf - L.zijBalk / 2, (L.zij.z0 + L.zij.z1) / 2]} mat={mat.frame} />
      ))}
      {L.spieMogelijk && [['links', -1], ['rechts', 1]].map(([kant, s]) => cfg.spie[kant] !== 'geen' && (
        <Spie key={`spie-${kant}`} L={L} kant={s} type={cfg.spie[kant]} />
      ))}

      {/* Hemelwaterafvoer: zichtbaar bij de goot-modellen, bij Cubic via de staander */}
      {L.M.afvoer === 'zichtbaar' && <Afvoer L={L} kant={-1} />}
      {L.M.afvoer === 'zichtbaar' && L.delen.length > 1 && <Afvoer L={L} kant={1} />}

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

      {/* LED-strip onder de goot/voorbalk */}
      {cfg.extra.ledStrip && (
        <>
          <mesh position={[0, Hf + 0.01, L.D - L.gootB - 0.004]} material={mat.led}>
            <boxGeometry args={[W - 0.2, 0.012, 0.008]} />
          </mesh>
          {nacht && [-1, 0, 1].map(k => (
            <pointLight key={k} position={[(k * W) / 3, Hf - 0.15, L.D - L.gootB - 0.1]} intensity={1.2} distance={4} decay={1.6} color="#ffd9a0" />
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
