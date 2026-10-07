// Omgeving rond de veranda: lucht, licht, tuin, terras, woning en meubels.
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Sky, Html, RoundedBox } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { baksteen, tegels, gras, hout } from './textures.js'

// Snelle reflecties zonder bestanden, als terugval terwijl de HDRI laadt.
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

// Echte buitenomgeving (HDRI) voor belichting en reflecties; gebundeld via npm,
// per dagdeel een eigen lazy chunk. De achtergrond blijft de Sky-shader.
const HDRI_DAG = {
  park: () => import('@pmndrs/assets/hdri/park.exr'),
  city: () => import('@pmndrs/assets/hdri/city.exr'),
  sunset: () => import('@pmndrs/assets/hdri/sunset.exr'),
  dawn: () => import('@pmndrs/assets/hdri/dawn.exr'),
  apartment: () => import('@pmndrs/assets/hdri/apartment.exr'),
}
const TEST_HDRI = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('hdri') : null
const HDRI = {
  dag: HDRI_DAG[TEST_HDRI] || HDRI_DAG.city,
  nacht: () => import('@pmndrs/assets/hdri/night.exr'),
}

// Decodeert de gebundelde EXR (data-URI) zelf, zonder fetch(): een strenge
// Content-Security-Policy (inbedding, artifact-viewer) blokkeert fetch van data:-URI's.
function exrUitDataUri(uri) {
  const bin = atob(uri.slice(uri.indexOf(',') + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const d = new EXRLoader().setDataType(THREE.HalfFloatType).parse(bytes.buffer)
  const t = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type)
  t.colorSpace = THREE.LinearSRGBColorSpace
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.flipY = false
  t.mapping = THREE.EquirectangularReflectionMapping
  t.needsUpdate = true
  return t
}

function HdriOmgeving({ nacht }) {
  const { gl, scene } = useThree()
  const sleutel = nacht ? 'nacht' : 'dag'
  const [omgevingen, setOmgevingen] = useState({})
  const geladen = useRef({})

  useEffect(() => {
    if (omgevingen[sleutel]) return
    let actief = true
    HDRI[sleutel]()
      .then(m => {
        if (!actief) return
        const bron = exrUitDataUri(m.default)
        const pmrem = new THREE.PMREMGenerator(gl)
        const env = pmrem.fromEquirectangular(bron).texture
        bron.dispose()
        pmrem.dispose()
        geladen.current[sleutel] = env
        setOmgevingen(o => ({ ...o, [sleutel]: env }))
      })
      .catch(err => console.warn('HDRI laden mislukt, terugval op studio-omgeving', err))
    return () => { actief = false }
  }, [sleutel, omgevingen, gl])

  const env = omgevingen[sleutel]
  useEffect(() => {
    if (!env) return
    scene.environment = env
    scene.environmentIntensity = nacht ? 0.18 : 0.9
    return () => { if (scene.environment === env) scene.environment = null }
  }, [env, scene, nacht])
  useEffect(() => () => Object.values(geladen.current).forEach(t => t.dispose()), [])

  return env ? null : <RoomOmgeving nacht={nacht} />
}

export function Licht({ nacht, L, hoog }) {
  const half = Math.max(L.W, L.D) / 2 + 7
  return (
    <>
      <HdriOmgeving nacht={nacht} />
      {/* Sky blijft gemount (geen nieuw shaderobject per dag/nacht-wissel). */}
      <Sky visible={!nacht} distance={4500} sunPosition={[6, 4, 9]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      {nacht ? (
        <>
          <color attach="background" args={['#0d1626']} />
          <fog attach="fog" args={['#0d1626', 25, 70]} />
          <hemisphereLight args={['#2b3d63', '#0b0d10', 0.2]} />
          <directionalLight position={[-8, 12, 10]} intensity={0.15} color="#9fb4e0" />
        </>
      ) : (
        <>
          <fog attach="fog" args={['#cfdbe6', 45, 120]} />
          <hemisphereLight args={['#dbe9ff', '#5b6b3c', 0.45]} />
          <directionalLight
            // Nieuwe key bij kwaliteitswissel: three maakt de shadowmap alleen opnieuw aan voor een nieuw licht.
            key={hoog ? 'zon-hoog' : 'zon-laag'}
            position={[8, 13, 11]} intensity={2.4} color="#fff1dc" castShadow
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

function Woning({ L, nacht }) {
  const steen = useMemo(() => baksteen(), [])
  const breedte = Math.max(L.W + 5, 10)
  const goot = Math.max(L.yDakAchter + 2.9, 5.8)
  const diep = 9
  const nok = goot + 3.4
  useEffect(() => {
    steen.map.repeat.set(breedte / 0.88, goot / 0.9)
    steen.normalMap.repeat.copy(steen.map.repeat)
  }, [steen, breedte, goot])
  useEffect(() => () => { steen.map.dispose(); steen.normalMap.dispose() }, [steen])

  // Zadeldak met de nok evenwijdig aan de achtergevel.
  const dak = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-diep / 2 - 0.4, 0)
    s.lineTo(diep / 2 + 0.4, 0)
    s.lineTo(0, nok - goot)
    s.lineTo(-diep / 2 - 0.4, 0)
    const g = new THREE.ExtrudeGeometry(s, { depth: breedte + 0.3, bevelEnabled: false })
    g.translate(0, 0, -(breedte + 0.3) / 2)
    return g
  }, [diep, nok, goot, breedte])
  useEffect(() => () => dak.dispose(), [dak])

  const raamKleur = nacht ? '#ffcf86' : '#26323a'
  const raamEmissie = nacht ? 0.9 : 0
  const pui = Math.min(L.W - 1, 3.6)
  const kozijn = '#2b2e31'

  return (
    <group>
      <mesh position={[0, goot / 2, -diep / 2]} castShadow receiveShadow>
        <boxGeometry args={[breedte, goot, diep]} />
        <meshStandardMaterial map={steen.map} normalMap={steen.normalMap} normalScale={[0.8, 0.8]} roughness={0.92} />
      </mesh>
      {/* Plint (trasraam) en dakgoot */}
      <mesh position={[0, 0.25, 0.01]} receiveShadow>
        <boxGeometry args={[breedte + 0.02, 0.5, 0.02]} />
        <meshStandardMaterial color="#4a3f39" roughness={0.9} />
      </mesh>
      <mesh position={[0, goot, -diep / 2]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow geometry={dak}>
        <meshStandardMaterial color="#2f3236" roughness={0.75} />
      </mesh>
      <mesh position={[0, goot - 0.05, 0.25]} castShadow>
        <boxGeometry args={[breedte + 0.3, 0.18, 0.16]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.6} />
      </mesh>

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
        <meshStandardMaterial map={houtTex} roughness={0.7} />
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
    t.map.repeat.set(36, 36)
    t.normalMap.repeat.set(36, 36)
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

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial map={grasTex.map} normalMap={grasTex.normalMap} normalScale={[0.6, 0.6]} roughness={1} />
      </mesh>
      <mesh position={[0, 0.0, terrasZ]} receiveShadow>
        <boxGeometry args={[terrasW, 0.02, terrasD]} />
        <meshStandardMaterial map={tegelTex.map} normalMap={tegelTex.normalMap} normalScale={[0.7, 0.7]} roughness={0.85} />
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
