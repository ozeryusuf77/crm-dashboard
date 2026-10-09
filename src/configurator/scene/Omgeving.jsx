// Omgeving rond de veranda: lucht, licht, tuin, terras, woning en meubels.
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Sky, Html, RoundedBox } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { baksteen, tegels, gras, hout } from './textures.js'
import { useFotoTexturen, laadAfbeelding } from './fotoTexturen.js'
import { MOBIEL } from './kwaliteit.js'

// Snelle reflecties zonder bestanden, als terugval terwijl de foto-lucht laadt.
function RoomOmgeving({ nacht }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = nacht ? 0.06 : 1
    return () => { if (scene.environment === env) scene.environment = null; env.dispose(); pmrem.dispose() }
  }, [gl, scene, nacht])
  return null
}

// Echte lucht (CC0, Poly Haven, zie assets/BRONNEN.md): een foto als achtergrond en een
// kleinere versie met grond eronder voor belichting en reflecties. Beide laden als <img>,
// dus ook onder een strenge CSP. De zon (dag) en maan (nacht) in de foto zijn gedraaid naar
// de kant van het directionele licht, zodat schaduwen en lucht kloppen.
const LUCHT = import.meta.glob('../assets/lucht/*.jpg', { eager: true, query: '?url', import: 'default' })
const ZON = [8, 13, 11]
const MAAN = [-8, 12, 10]
// u-coördinaat van zon/maan in de equirect-foto's (gemeten in de HDRI's), omgerekend naar
// de y-rotatie waarmee die richting op het licht valt (three: azimut = atan2(z, x)).
const draai = (u, licht) => (u - 0.5) * 2 * Math.PI - Math.atan2(licht[2], licht[0])
const DAGDELEN = {
  dag: { achtergrond: MOBIEL ? 'dag_2k' : 'dag', rotatie: draai(0.5951, ZON), omgeving: 1.9, mist: '#9ca1b2' },
  nacht: { achtergrond: 'nacht', rotatie: draai(0.5991, MAAN), omgeving: 3, mist: '#08131d' },
}

function useFotoLucht(dagdeel) {
  const gl = useThree(s => s.gl)
  const [lucht, setLucht] = useState({})
  const gemaakt = useRef([])
  useEffect(() => {
    if (lucht[dagdeel]) return
    let actief = true
    const url = naam => LUCHT[`../assets/lucht/${naam}.jpg`]
    Promise.all([laadAfbeelding(url(DAGDELEN[dagdeel].achtergrond), true), laadAfbeelding(url(`${dagdeel}_omgeving`), true)])
      .then(([foto, omgeving]) => {
        if (!actief) return
        const achtergrond = foto.clone()
        achtergrond.mapping = THREE.EquirectangularReflectionMapping
        const bron = omgeving.clone()
        bron.mapping = THREE.EquirectangularReflectionMapping
        const pmrem = new THREE.PMREMGenerator(gl)
        const env = pmrem.fromEquirectangular(bron).texture
        pmrem.dispose()
        bron.dispose()
        gemaakt.current.push(achtergrond, env)
        setLucht(l => ({ ...l, [dagdeel]: { achtergrond, env } }))
      })
      .catch(err => console.warn('Foto-lucht laden mislukt, terugval op studio-omgeving', err))
    return () => { actief = false }
  }, [dagdeel, lucht, gl])
  useEffect(() => () => gemaakt.current.forEach(t => t.dispose()), [])
  return lucht[dagdeel]
}

export function Licht({ nacht, L, hoog }) {
  const half = Math.max(L.W, L.D) / 2 + 7
  const dagdeel = nacht ? 'nacht' : 'dag'
  const d = DAGDELEN[dagdeel]
  const lucht = useFotoLucht(dagdeel)
  const scene = useThree(s => s.scene)
  useEffect(() => {
    if (!lucht) return
    scene.backgroundRotation.set(0, d.rotatie, 0)
    scene.environmentRotation.set(0, d.rotatie, 0)
    scene.environmentIntensity = d.omgeving
  }, [lucht, scene, d])

  return (
    <>
      {lucht ? (
        <>
          <primitive key={`lucht-${dagdeel}`} object={lucht.achtergrond} attach="background" />
          <primitive key={`omgeving-${dagdeel}`} object={lucht.env} attach="environment" />
        </>
      ) : (
        <>
          <RoomOmgeving nacht={nacht} />
          {nacht && <color attach="background" args={['#0d1626']} />}
        </>
      )}
      {/* Sky (terugval zolang de foto laadt) blijft gemount: geen nieuw shaderobject per wissel. */}
      <Sky visible={!nacht && !lucht} distance={4500} sunPosition={ZON} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      {nacht ? (
        <>
          <fog attach="fog" args={[d.mist, 25, 70]} />
          <hemisphereLight args={['#2b3d63', '#0b0d10', 0.2]} />
          <directionalLight position={MAAN} intensity={0.15} color="#9fb4e0" />
        </>
      ) : (
        <>
          <fog attach="fog" args={[d.mist, 40, 170]} />
          <hemisphereLight args={['#dbe9ff', '#5b6b3c', 0.45]} />
          <directionalLight
            // Nieuwe key bij kwaliteitswissel: three maakt de shadowmap alleen opnieuw aan voor een nieuw licht.
            key={hoog ? 'zon-hoog' : 'zon-laag'}
            position={ZON} intensity={2.4} color="#fff1dc" castShadow
            shadow-mapSize={hoog ? [2048, 2048] : [1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02}
            shadow-camera-left={-half} shadow-camera-right={half} shadow-camera-top={half} shadow-camera-bottom={-half}
            shadow-camera-near={1} shadow-camera-far={60}
          />
        </>
      )}
    </>
  )
}

// Bladerkruin: icosaëder met deterministisch verschoven hoekpunten voor een organische vorm.
function useKruin(straal, seed) {
  const geom = useMemo(() => {
    // Hoekpunten samenvoegen, anders krijgt elk vlak een eigen normaal (hoekig).
    const g = mergeVertices(new THREE.IcosahedronGeometry(straal, 3).deleteAttribute('normal').deleteAttribute('uv'))
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.3) * Math.sin(v.z * 3.3 + seed * 0.7)
      v.multiplyScalar(1 + n * 0.14)
      p.setXYZ(i, v.x, v.y * 0.88, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [straal, seed])
  useEffect(() => () => geom.dispose(), [geom])
  return geom
}

function Boom({ position, schaal = 1, seed = 1 }) {
  const k1 = useKruin(1.5, seed)
  const k2 = useKruin(1.05, seed + 2)
  const k3 = useKruin(0.9, seed + 5)
  return (
    <group position={position} scale={schaal}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.2, 2.4, 10]} />
        <meshStandardMaterial color="#5a4632" roughness={1} />
      </mesh>
      <mesh geometry={k1} position={[0, 3.1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3d6a2b" roughness={0.95} />
      </mesh>
      <mesh geometry={k2} position={[0.7, 3.7, 0.3]} castShadow receiveShadow>
        <meshStandardMaterial color="#4b7a33" roughness={0.95} />
      </mesh>
      <mesh geometry={k3} position={[-0.6, 3.5, -0.4]} castShadow receiveShadow>
        <meshStandardMaterial color="#456f30" roughness={0.95} />
      </mesh>
    </group>
  )
}

function Struik({ position, schaal = 1, seed = 1, kleur = '#47702f' }) {
  const g = useKruin(0.5, seed)
  return (
    <mesh geometry={g} position={position} scale={[schaal, schaal * 0.8, schaal]} castShadow receiveShadow>
      <meshStandardMaterial color={kleur} roughness={0.95} />
    </mesh>
  )
}

function Plantenbak({ position }) {
  const blad = useKruin(0.28, 4)
  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.4, 24]} />
        <meshStandardMaterial color="#3b3d40" roughness={0.6} />
      </mesh>
      <mesh geometry={blad} position={[0, 0.55, 0]} scale={[0.75, 1, 0.75]} castShadow>
        <meshStandardMaterial color="#4f8238" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Materiaal met echte foto-textuur zodra die geladen is, anders de procedurele terugval.
// De key forceert een nieuw materiaal (en shader) als de set binnenkomt.
function FotoMateriaal({ foto, terugval, ao = 0.8, ...props }) {
  return foto
    ? <meshStandardMaterial key="foto" {...props} {...foto} roughness={1} aoMapIntensity={ao} />
    : <meshStandardMaterial key="terugval" {...props} {...terugval} />
}

const WIT = '#ecebe6'

function Woning({ L, nacht }) {
  const steen = useMemo(() => baksteen(), [])
  const breedte = Math.max(L.W + 5, 10)
  const goot = Math.max(L.yDakAchter + 2.9, 5.8)
  const diep = 9
  // Zadeldak met de nok evenwijdig aan de achtergevel en 40 cm overstek bij de goten.
  const nokH = 3.4
  const overstek = 0.4
  const run = diep / 2 + overstek
  const helling = Math.atan2(nokH, run)
  const dakL = Math.hypot(run, nokH) + 0.06
  const dakB = breedte + 0.3
  const dikte = 0.05

  // Herhalingen in meters: baksteen 1,4 m, dakpannen 2,4 × 1,8 m per herhaling.
  const gevel = useFotoTexturen('baksteen', [breedte / 1.4, goot / 1.4])
  const zijgevel = useFotoTexturen('baksteen', [diep / 1.4, goot / 1.4])
  // uv van ExtrudeGeometry is al in meters; verschoven zodat de lagen doorlopen vanaf de muur.
  const topgevel = useFotoTexturen('baksteen', [1 / 1.4, 1 / 1.4], [0, (goot / 1.4) % 1])
  const pannen = useFotoTexturen('dakpannen', [dakB / 2.4, dakL / 1.8])
  useEffect(() => {
    steen.map.repeat.set(breedte / 0.88, goot / 0.9)
    steen.normalMap.repeat.copy(steen.map.repeat)
  }, [steen, breedte, goot])
  useEffect(() => () => { steen.map.dispose(); steen.normalMap.dispose() }, [steen])
  const steenTerugval = { map: steen.map, normalMap: steen.normalMap, normalScale: [0.8, 0.8], roughness: 0.92 }

  // Topgevels: de muur loopt door tot onder de dakvlakken (vijfhoek), zodat er onder de
  // overstek geen kier tussen muur en dak zit.
  const top = useMemo(() => {
    const bovenRand = nokH * (overstek / run) - 0.01
    const s = new THREE.Shape()
    s.moveTo(-diep / 2, 0)
    s.lineTo(diep / 2, 0)
    s.lineTo(diep / 2, bovenRand)
    s.lineTo(0, nokH - 0.01)
    s.lineTo(-diep / 2, bovenRand)
    s.lineTo(-diep / 2, 0)
    const g = new THREE.ExtrudeGeometry(s, { depth: breedte, bevelEnabled: false })
    g.translate(0, 0, -breedte / 2)
    return g
  }, [diep, nokH, overstek, run, breedte])
  useEffect(() => () => top.dispose(), [top])

  const raamKleur = nacht ? '#ffcf86' : '#26323a'
  const raamEmissie = nacht ? 0.9 : 0
  const pui = Math.min(L.W - 1, 3.6)
  const kozijn = '#2b2e31'

  // Eén dakvlak (in het assenstelsel met de nok boven de oorsprong); het achterste is gespiegeld.
  const n = [Math.cos(helling), Math.sin(helling)]
  const dakvlak = r => (
    <group key={r} rotation={[0, r, 0]}>
      <group position={[0, nokH / 2 + n[0] * dikte / 2, run / 2 + n[1] * dikte / 2]} rotation={[helling, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[dakB, dikte, dakL]} />
          <meshStandardMaterial attach="material-0" color="#5b3a2d" roughness={0.9} />
          <meshStandardMaterial attach="material-1" color="#5b3a2d" roughness={0.9} />
          <FotoMateriaal attach="material-2" foto={pannen} terugval={{ color: '#7a4434', roughness: 0.8 }} ao={0.9} />
          <meshStandardMaterial attach="material-3" color={WIT} roughness={0.8} />
          <meshStandardMaterial attach="material-4" color="#5b3a2d" roughness={0.9} />
          <meshStandardMaterial attach="material-5" color="#5b3a2d" roughness={0.9} />
        </mesh>
        {/* Witte windveren langs de topgevels */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * (dakB / 2 + 0.015), -0.07, 0]} castShadow>
            <boxGeometry args={[0.03, 0.22, dakL]} />
            <meshStandardMaterial color={WIT} roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* Boeiboord met goot langs de onderkant van het dakvlak */}
      <mesh position={[0, -0.07, run + 0.03]} castShadow>
        <boxGeometry args={[dakB, 0.22, 0.04]} />
        <meshStandardMaterial color={WIT} roughness={0.6} />
      </mesh>
    </group>
  )

  return (
    <group>
      <mesh position={[0, goot / 2, -diep / 2]} castShadow receiveShadow>
        <boxGeometry args={[breedte, goot, diep]} />
        {/* Volgorde boxGeometry: +x, -x, +y, -y, +z (achtergevel naar de veranda), -z */}
        <FotoMateriaal attach="material-0" foto={zijgevel} terugval={steenTerugval} />
        <FotoMateriaal attach="material-1" foto={zijgevel} terugval={steenTerugval} />
        <meshStandardMaterial attach="material-2" color="#6d6a66" roughness={1} />
        <meshStandardMaterial attach="material-3" color="#6d6a66" roughness={1} />
        <FotoMateriaal attach="material-4" foto={gevel} terugval={steenTerugval} />
        <FotoMateriaal attach="material-5" foto={gevel} terugval={steenTerugval} />
      </mesh>
      {/* Plint (trasraam) */}
      <mesh position={[0, 0.25, 0.01]} receiveShadow>
        <boxGeometry args={[breedte + 0.02, 0.5, 0.02]} />
        <meshStandardMaterial color="#4a3f39" roughness={0.9} />
      </mesh>
      <group position={[0, goot, -diep / 2]}>
        <mesh rotation={[0, Math.PI / 2, 0]} geometry={top} castShadow receiveShadow>
          <FotoMateriaal attach="material-0" foto={topgevel} terugval={steenTerugval} />
          <meshStandardMaterial attach="material-1" color={WIT} roughness={0.8} />
        </mesh>
        {[0, Math.PI].map(dakvlak)}
        {/* Nokvorst */}
        <mesh position={[0, nokH + dikte * 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, dakB, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#7d4636" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Schuifpui in de achtergevel */}
      <mesh position={[0, 1.2, 0.01]}>
        <boxGeometry args={[pui + 0.14, 2.42, 0.06]} />
        <meshStandardMaterial color={kozijn} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.2, 0.045]}>
        <boxGeometry args={[pui, 2.28, 0.01]} />
        <meshStandardMaterial color={raamKleur} emissive={raamKleur} emissiveIntensity={raamEmissie} roughness={0.05} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 0.055]}>
        <boxGeometry args={[0.07, 2.28, 0.02]} />
        <meshStandardMaterial color={kozijn} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.01, 0.1]} receiveShadow>
        <boxGeometry args={[pui + 0.3, 0.02, 0.2]} />
        <meshStandardMaterial color="#9a958d" roughness={0.8} />
      </mesh>

      {/* Ramen op de verdieping met lekdorpel */}
      {[-1, 1].map(s => (
        <group key={s} position={[s * Math.min(breedte / 2 - 1.4, pui / 2 + 1.6), goot - 1.7, 0.01]}>
          <mesh><boxGeometry args={[1.5, 1.35, 0.06]} /><meshStandardMaterial color={kozijn} roughness={0.5} metalness={0.3} /></mesh>
          <mesh position={[0, 0, 0.035]}><boxGeometry args={[1.38, 1.22, 0.01]} />
            <meshStandardMaterial color={raamKleur} emissive={raamKleur} emissiveIntensity={raamEmissie * 0.6} roughness={0.05} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.045]}><boxGeometry args={[0.05, 1.22, 0.02]} /><meshStandardMaterial color={kozijn} /></mesh>
          <mesh position={[0, -0.72, 0.06]} castShadow><boxGeometry args={[1.62, 0.05, 0.14]} /><meshStandardMaterial color="#c9c6bf" roughness={0.6} /></mesh>
        </group>
      ))}
    </group>
  )
}

// Loungeset onder de veranda — geeft schaal en sfeer, ook in het binnenaanzicht.
function Meubels({ L }) {
  const houtTex = useMemo(() => { const t = hout(); t.repeat.set(1, 1); return t }, [])
  useEffect(() => () => houtTex.dispose(), [houtTex])
  // Eikenhouten planken, 1,2 m per herhaling (uv van RoundedBox is in meters).
  const eiken = useFotoTexturen('hout', [1 / 1.2, 1 / 1.2])
  const z = L.D * 0.52
  const frame = '#2f2f31', kussen = '#d8d2c6', accent = '#7e8c74'
  const breed = Math.min(2.4, L.W * 0.45)
  return (
    <group position={[-L.W * 0.08, 0, z]}>
      {/* Bank: frame + zitkussens + rugkussens */}
      <group position={[0, 0, -0.55]}>
        <RoundedBox args={[breed, 0.3, 0.88]} radius={0.03} smoothness={3} position={[0, 0.2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={frame} roughness={0.55} metalness={0.2} />
        </RoundedBox>
        {[-1, 1].map(s => (
          <RoundedBox key={s} args={[breed / 2 - 0.06, 0.15, 0.78]} radius={0.06} smoothness={4}
            position={[(s * breed) / 4, 0.42, 0.03]} castShadow receiveShadow>
            <meshStandardMaterial color={kussen} roughness={1} />
          </RoundedBox>
        ))}
        {[-1, 1].map(s => (
          <RoundedBox key={`r${s}`} args={[breed / 2 - 0.08, 0.42, 0.16]} radius={0.07} smoothness={4}
            position={[(s * breed) / 4, 0.68, -0.33]} rotation={[-0.12, 0, 0]} castShadow>
            <meshStandardMaterial color={kussen} roughness={1} />
          </RoundedBox>
        ))}
        <RoundedBox args={[0.42, 0.36, 0.12]} radius={0.05} smoothness={4} position={[-breed / 2 + 0.35, 0.62, -0.18]} rotation={[-0.25, 0.3, 0]} castShadow>
          <meshStandardMaterial color={accent} roughness={1} />
        </RoundedBox>
      </group>
      {/* Salontafel */}
      <RoundedBox args={[1.0, 0.05, 0.6]} radius={0.01} smoothness={2} position={[0, 0.36, 0.45]} castShadow receiveShadow>
        <FotoMateriaal foto={eiken} terugval={{ map: houtTex, roughness: 0.7 }} ao={0.5} />
      </RoundedBox>
      {[[-0.44, 0.2], [0.44, 0.2], [-0.44, 0.7], [0.44, 0.7]].map(([x, zz], i) => (
        <mesh key={i} position={[x, 0.17, zz]} castShadow><boxGeometry args={[0.04, 0.34, 0.04]} /><meshStandardMaterial color={frame} metalness={0.4} roughness={0.5} /></mesh>
      ))}
      {/* Buitenkleed */}
      <mesh position={[0, 0.006, 0.1]} receiveShadow><boxGeometry args={[breed + 0.6, 0.01, 2.0]} /><meshStandardMaterial color="#b6ab98" roughness={1} /></mesh>
      <group position={[0.18, 0.39, 0.42]}>
        <mesh castShadow><cylinderGeometry args={[0.07, 0.055, 0.16, 20]} /><meshStandardMaterial color="#ece6da" roughness={0.4} /></mesh>
        <Struik position={[0, 0.16, 0]} schaal={0.28} seed={9} kleur="#4e7d3a" />
      </group>
    </group>
  )
}

export function Omgeving({ L, nacht, meubels }) {
  const grasTex = useMemo(() => {
    const t = gras()
    t.map.repeat.set(90, 90)
    t.normalMap.repeat.set(90, 90)
    return t
  }, [])
  const tegelTex = useMemo(() => tegels(), [])
  const terrasW = L.W + 1.2, terrasD = L.D + 1.4
  const terrasZ = terrasD / 2 - (L.vrijstaand ? 0.7 : 0)
  useEffect(() => {
    tegelTex.map.repeat.set(terrasW / 1.2, terrasD / 1.2)
    tegelTex.normalMap.repeat.copy(tegelTex.map.repeat)
  }, [tegelTex, terrasW, terrasD])
  useEffect(() => () => {
    grasTex.map.dispose(); grasTex.normalMap.dispose(); tegelTex.map.dispose(); tegelTex.normalMap.dispose()
  }, [grasTex, tegelTex])

  // Echte foto-texturen: gras 1,6 m en natuursteentegels (60 × 60 cm) 1,8 m per herhaling.
  // De grasvlakte loopt door tot in de nevel, zodat de horizon op de lucht aansluit.
  const GRAS_R = 200
  const grasFoto = useFotoTexturen('gras', [(GRAS_R * 2) / 1.6, (GRAS_R * 2) / 1.6])
  // Tegels beginnen met een hele tegel aan de gevel- en linkerzijde.
  const tegelFoto = useFotoTexturen('terras', [terrasW / 1.8, terrasD / 1.8], [0, (1 - (terrasD / 1.8) % 1) % 1])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[GRAS_R, 96]} />
        <FotoMateriaal foto={grasFoto} terugval={{ map: grasTex.map, normalMap: grasTex.normalMap, normalScale: [0.6, 0.6], roughness: 1 }} ao={0.6} />
      </mesh>
      <mesh position={[0, 0.0, terrasZ]} receiveShadow>
        <boxGeometry args={[terrasW, 0.02, terrasD]} />
        <FotoMateriaal foto={tegelFoto} terugval={{ map: tegelTex.map, normalMap: tegelTex.normalMap, normalScale: [0.7, 0.7], roughness: 0.85 }} ao={0.7} />
      </mesh>
      {/* Opsluitband rond het terras */}
      {[
        [0, terrasZ + terrasD / 2 + 0.04, terrasW + 0.16, 0.08],
        [-terrasW / 2 - 0.04, terrasZ, 0.08, terrasD],
        [terrasW / 2 + 0.04, terrasZ, 0.08, terrasD],
        ...(L.vrijstaand ? [[0, terrasZ - terrasD / 2 - 0.04, terrasW + 0.16, 0.08]] : []),
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.015, z]} receiveShadow castShadow>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#6f6c66" roughness={0.9} />
        </mesh>
      ))}

      {!L.vrijstaand && <Woning L={L} nacht={nacht} />}
      {meubels && <Meubels L={L} />}
      {meubels && <Plantenbak position={[L.W / 2 - 0.45, 0, L.D + 0.35]} />}
      {meubels && <Plantenbak position={[-L.W / 2 + 0.45, 0, L.D + 0.35]} />}

      {/* Border met struiken langs de gevel naast de veranda */}
      {!L.vrijstaand && [-1, 1].map(s => (
        <group key={s}>
          <Struik position={[s * (L.W / 2 + 1.3), 0.35, 0.6]} schaal={1.2} seed={s + 3} />
          <Struik position={[s * (L.W / 2 + 2.3), 0.3, 0.5]} schaal={0.9} seed={s + 6} kleur="#557d36" />
        </group>
      ))}
      <Boom position={[-L.W / 2 - 4.5, 0, L.D + 6]} schaal={1.1} seed={1} />
      <Boom position={[L.W / 2 + 5.5, 0, L.D + 9]} schaal={0.9} seed={4} />
      <Boom position={[-2, 0, L.D + 15]} schaal={1.3} seed={7} />
      {/* Haag aan het einde van de tuin */}
      <mesh position={[0, 0.8, L.D + 18]} castShadow receiveShadow>
        <boxGeometry args={[40, 1.6, 0.9]} />
        <meshStandardMaterial color="#365b28" roughness={1} />
      </mesh>
    </group>
  )
}

export function Maatvoering({ L, cfg }) {
  const stijl = 'vc-maat'
  return (
    <group>
      <Html position={[0, 0.05, L.D + 0.55]} center className={stijl}>{cfg.breedte} cm</Html>
      <Html position={[L.W / 2 + 0.5, 0.05, L.D / 2]} center className={stijl}>{cfg.diepte} cm</Html>
      <Html position={[L.xStaanders[L.xStaanders.length - 1] + 0.35, L.Hf / 2, L.zVoorStaander + 0.2]} center className={stijl}>{cfg.hoogte} cm</Html>
    </group>
  )
}
