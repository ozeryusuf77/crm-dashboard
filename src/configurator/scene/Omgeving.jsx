// Omgeving rond de veranda: lucht, licht, tuin, terras, woning en meubels.
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Sky, Html } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { baksteen, tegels, gras } from './textures.js'

// Reflecties voor glas en aluminium zonder externe HDR-bestanden.
function Reflecties() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => { scene.environment = null; env.dispose(); pmrem.dispose() }
  }, [gl, scene])
  return null
}

export function Licht({ nacht }) {
  const scene = useThree(s => s.scene)
  useEffect(() => { scene.environmentIntensity = nacht ? 0.06 : 1 }, [scene, nacht])
  return (
    <>
      <Reflecties />
      {nacht ? (
        <>
          <color attach="background" args={['#0d1626']} />
          <fog attach="fog" args={['#0d1626', 25, 70]} />
          <hemisphereLight args={['#2b3d63', '#0b0d10', 0.25]} />
          <directionalLight position={[-8, 12, 10]} intensity={0.18} color="#9fb4e0" />
        </>
      ) : (
        <>
          <Sky distance={4500} sunPosition={[6, 4, 9]} turbidity={6} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.85} />
          <fog attach="fog" args={['#cfdbe6', 40, 110]} />
          <hemisphereLight args={['#dbe9ff', '#5b6b3c', 0.9]} />
          <directionalLight
            position={[8, 13, 11]} intensity={2.6} color="#fff4e2" castShadow
            shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
            shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14}
            shadow-camera-near={1} shadow-camera-far={50}
          />
        </>
      )}
    </>
  )
}

function Boom({ position, schaal = 1 }) {
  return (
    <group position={position} scale={schaal}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 2.2, 8]} />
        <meshStandardMaterial color="#5b4330" roughness={1} />
      </mesh>
      <mesh position={[0, 3, 0]} castShadow>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#3f6b2c" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.5, 3.7, 0.3]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#4a7a33" roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Woning({ L, nacht }) {
  const steen = useMemo(() => baksteen(), [])
  const breedte = Math.max(L.W + 5, 10)
  const hoogte = Math.max(L.yDakAchter + 3.2, 6)
  const diep = 9
  useEffect(() => { steen.repeat.set(breedte / 1.1, hoogte / 1.1) }, [steen, breedte, hoogte])
  useEffect(() => () => steen.dispose(), [steen])
  const raamKleur = nacht ? '#ffcf86' : '#2d3a42'
  const raamEmissie = nacht ? 0.9 : 0

  // Schuifpui in de woning achter de veranda + raam op de verdieping.
  const pui = Math.min(L.W - 1, 3.6)
  return (
    <group>
      <mesh position={[0, hoogte / 2, -diep / 2]} castShadow receiveShadow>
        <boxGeometry args={[breedte, hoogte, diep]} />
        <meshStandardMaterial map={steen} roughness={0.95} />
      </mesh>
      <mesh position={[0, hoogte + 0.1, -diep / 2]} castShadow>
        <boxGeometry args={[breedte + 0.3, 0.2, diep + 0.3]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.6} />
      </mesh>
      {/* Pui in de gevel */}
      <mesh position={[0, 1.15, 0.005]}>
        <boxGeometry args={[pui + 0.12, 2.42, 0.02]} />
        <meshStandardMaterial color="#2b2e31" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, 0.018]}>
        <boxGeometry args={[pui, 2.3, 0.01]} />
        <meshStandardMaterial color={raamKleur} emissive={raamKleur} emissiveIntensity={raamEmissie} roughness={0.1} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.15, 0.025]}>
        <boxGeometry args={[0.06, 2.3, 0.01]} />
        <meshStandardMaterial color="#2b2e31" />
      </mesh>
      {[-1, 1].map(s => (
        <group key={s} position={[s * Math.min(breedte / 2 - 1.4, pui / 2 + 1.6), hoogte - 1.6, 0.01]}>
          <mesh><boxGeometry args={[1.5, 1.3, 0.02]} /><meshStandardMaterial color="#2b2e31" /></mesh>
          <mesh position={[0, 0, 0.012]}><boxGeometry args={[1.38, 1.18, 0.01]} />
            <meshStandardMaterial color={raamKleur} emissive={raamKleur} emissiveIntensity={raamEmissie * 0.6} roughness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Loungeset onder de veranda — geeft schaal en sfeer, ook in het binnenaanzicht.
function Meubels({ L }) {
  const z = L.D * 0.52
  const bank = '#d9d4ca', hout = '#8a6a4a', poot = '#2b2b2b'
  const breed = Math.min(2.4, L.W * 0.45)
  return (
    <group position={[-L.W * 0.08, 0, z]}>
      <group position={[0, 0, -0.55]}>
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow><boxGeometry args={[breed, 0.3, 0.85]} /><meshStandardMaterial color={poot} roughness={0.7} /></mesh>
        <mesh position={[0, 0.42, 0.04]} castShadow><boxGeometry args={[breed - 0.1, 0.14, 0.78]} /><meshStandardMaterial color={bank} roughness={1} /></mesh>
        <mesh position={[0, 0.62, -0.36]} castShadow><boxGeometry args={[breed, 0.42, 0.14]} /><meshStandardMaterial color={bank} roughness={1} /></mesh>
      </group>
      <mesh position={[0, 0.2, 0.45]} castShadow receiveShadow><boxGeometry args={[1.0, 0.06, 0.6]} /><meshStandardMaterial color={hout} roughness={0.8} /></mesh>
      {[[-0.45, 0.2], [0.45, 0.2], [-0.45, 0.7], [0.45, 0.7]].map(([x, zz], i) => (
        <mesh key={i} position={[x, 0.09, zz]} castShadow><boxGeometry args={[0.05, 0.18, 0.05]} /><meshStandardMaterial color={poot} /></mesh>
      ))}
      <mesh position={[0, 0.005, 0.1]} receiveShadow><boxGeometry args={[breed + 0.6, 0.01, 2.0]} /><meshStandardMaterial color="#b9ae9c" roughness={1} /></mesh>
      <group position={[0.15, 0.23, 0.42]}>
        <mesh castShadow><cylinderGeometry args={[0.06, 0.05, 0.14, 16]} /><meshStandardMaterial color="#e8e2d6" /></mesh>
        <mesh position={[0, 0.16, 0]} castShadow><icosahedronGeometry args={[0.13, 1]} /><meshStandardMaterial color="#4e7d3a" flatShading /></mesh>
      </group>
    </group>
  )
}

export function Omgeving({ L, nacht, meubels }) {
  const grasTex = useMemo(() => { const t = gras(); t.repeat.set(30, 30); return t }, [])
  const tegelTex = useMemo(() => tegels(), [])
  const terrasW = L.W + 1.2, terrasD = L.D + 1.4
  useEffect(() => { tegelTex.repeat.set(terrasW / 1.2, terrasD / 1.2) }, [tegelTex, terrasW, terrasD])
  useEffect(() => () => { grasTex.dispose(); tegelTex.dispose() }, [grasTex, tegelTex])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[80, 48]} />
        <meshStandardMaterial map={grasTex} roughness={1} />
      </mesh>
      <mesh position={[0, 0.0, terrasD / 2 - (L.vrijstaand ? 0.7 : 0)]} receiveShadow>
        <boxGeometry args={[terrasW, 0.02, terrasD]} />
        <meshStandardMaterial map={tegelTex} roughness={0.9} />
      </mesh>
      {!L.vrijstaand && <Woning L={L} nacht={nacht} />}
      {meubels && <Meubels L={L} />}
      <Boom position={[-L.W / 2 - 4.5, 0, L.D + 6]} schaal={1.1} />
      <Boom position={[L.W / 2 + 5.5, 0, L.D + 9]} schaal={0.9} />
      <Boom position={[-2, 0, L.D + 15]} schaal={1.3} />
      {/* Haag aan het einde van de tuin */}
      <mesh position={[0, 0.7, L.D + 18]} castShadow receiveShadow>
        <boxGeometry args={[40, 1.4, 0.8]} />
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
