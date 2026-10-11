// Belichting van de scène: fotolucht (achtergrond + omgevingsreflecties met een gebakken
// HDR-zon), zon of maan met schaduw, hemisfeerlicht, mist en een automatische
// 'bewolkt'-overgang zodra het regent (leest REGEN.uNat per frame, schrijft nooit).
//
//   <Licht nacht L hoog />
//
// Assen: x = breedte, y = omhoog, z = diepte (0 = gevel, +z = tuin); maten in meters.
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { laadAfbeelding } from './fotoTexturen.js'
import { MOBIEL } from './kwaliteit.js'
import { REGEN } from './regenUniforms.js'

// LTC-tabellen voor rectAreaLight (Woning.jsx: licht uit de pui op het terras). Eenmalig en
// idempotent; Woning.jsx doet hetzelfde, zodat het niet van de importvolgorde afhangt.
if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init()

// Richting van zon en maan (positie t.o.v. het schaduwdoel; alleen de richting telt).
// Zon van links-vóór, 41° hoog: staanders krijgen een lichte voorkant en een donkere
// rechterzijde, de schaduw van een 2,3 m hoge staander valt ±2,6 m naar rechts-achter.
export const ZON = [-9, 10, 7]
export const MAAN = [-8, 12, 10]

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
// u-coördinaat van zon/maan in de equirect-foto's (gemeten in de HDRI's), omgerekend naar
// de y-rotatie waarmee die richting op het licht valt (three: azimut = atan2(z, x)).
const draai = (u, licht) => (u - 0.5) * 2 * Math.PI - Math.atan2(licht[2], licht[0])
// zonUv: plek van zon/maan in *_omgeving.jpg, gemeten vanaf de bovenrand van de afbeelding;
// de v wordt bij het bakken omgezet naar de GL-oriëntatie (v = 0 is de onderrand).
export const DAGDELEN = {
  dag: { achtergrond: MOBIEL ? 'dag_2k' : 'dag', rotatie: draai(0.5951, ZON), omgeving: 1.0, mist: '#9ca1b2', achtergrondSterkte: 1, zonUv: [0.5957, 0.2148], zonSterkte: 18 },
  nacht: { achtergrond: 'nacht', rotatie: draai(0.5991, MAAN), omgeving: 4, mist: '#0a1522', achtergrondSterkte: 1.5, zonUv: [0.5983, 0.4033], zonSterkte: 3 },
}

// HDR-zon in de omgevingsfoto bakken: de JPG is op 1,0 afgekapt, waardoor aluminium en glas
// geen zonglans krijgen. Een fullscreen-shader kopieert de foto naar een half-float
// rendertarget en telt op de plek van de zon (maan) een felle schijf op; PMREM maakt daar
// de reflectie-lobes van. Puur shaders op een <img>-textuur, dus CSP-veilig.
const BAK_VERTEX = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`
const BAK_FRAGMENT = /* glsl */`
uniform sampler2D bron;
uniform vec2 zonUv;
uniform float sterkte;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(bron, vUv).rgb;
  // Afstand in radialen op de bol: breedtegraad-correctie op de u-as.
  vec2 d = (vUv - zonUv) * vec2(6.2832 * cos((0.5 - zonUv.y) * 3.1416), 3.1416);
  float r = length(d);
  c += vec3(1.0, 0.97, 0.9) * sterkte * smoothstep(0.03, 0.0, r);
  gl_FragColor = vec4(c, 1.0);
}`

function bakHdrLucht(gl, bron, [u, vBoven], sterkte) {
  const rt = new THREE.WebGLRenderTarget(MOBIEL ? 512 : 1024, MOBIEL ? 256 : 512, {
    type: THREE.HalfFloatType, colorSpace: THREE.NoColorSpace,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
  })
  const materiaal = new THREE.ShaderMaterial({
    vertexShader: BAK_VERTEX, fragmentShader: BAK_FRAGMENT,
    uniforms: { bron: { value: bron }, zonUv: { value: new THREE.Vector2(u, 1 - vBoven) }, sterkte: { value: sterkte } },
    depthTest: false, depthWrite: false,
  })
  const vlak = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), materiaal)
  vlak.frustumCulled = false
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const vorigDoel = gl.getRenderTarget()
  const vorigXr = gl.xr.enabled
  gl.xr.enabled = false
  gl.setRenderTarget(rt)
  gl.render(vlak, camera)
  gl.setRenderTarget(vorigDoel)
  gl.xr.enabled = vorigXr
  vlak.geometry.dispose()
  materiaal.dispose()
  rt.texture.mapping = THREE.EquirectangularReflectionMapping
  return rt
}

function useFotoLucht(dagdeel) {
  const gl = useThree(s => s.gl)
  const [lucht, setLucht] = useState({})
  const gemaakt = useRef([])
  useEffect(() => {
    if (lucht[dagdeel]) return
    let actief = true
    const d = DAGDELEN[dagdeel]
    const url = naam => LUCHT[`../assets/lucht/${naam}.jpg`]
    Promise.all([laadAfbeelding(url(d.achtergrond), true), laadAfbeelding(url(`${dagdeel}_omgeving`), true)])
      .then(([foto, omgeving]) => {
        if (!actief) return
        const achtergrond = foto.clone()
        achtergrond.mapping = THREE.EquirectangularReflectionMapping
        const bron = omgeving.clone()
        const hdr = bakHdrLucht(gl, bron, d.zonUv, d.zonSterkte)
        const pmrem = new THREE.PMREMGenerator(gl)
        const env = pmrem.fromEquirectangular(hdr.texture).texture
        pmrem.dispose()
        hdr.dispose()
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

// Bewolking bij regen: eindwaarden van de overgang (nat = 1). Vooraf aangemaakte kleuren,
// zodat de useFrame niets alloceert.
const HELDER = {
  zon: new THREE.Color('#fff4e4'), hemel: new THREE.Color('#cfe0ff'), grond: new THREE.Color('#5a5f45'), mist: new THREE.Color(DAGDELEN.dag.mist),
}
const BEWOLKT = {
  zon: new THREE.Color('#d6dee6'), hemel: new THREE.Color('#9fabb8'), grond: new THREE.Color('#3a4236'), mist: new THREE.Color('#8a9099'),
}
const DAG = { zon: 3.0, zonBewolkt: 0.6, hemisfeer: 0.3, hemisfeerBewolkt: 0.75, mistVan: [60, 170], mistTot: [18, 85] }
const NACHT = { maan: 0.5, maanBewolkt: 0.25, hemisfeer: 0.35, mistVan: [30, 90], mistTot: [14, 40] }
const lerp = THREE.MathUtils.lerp

export function Licht({ nacht, L, hoog }) {
  const dagdeel = nacht ? 'nacht' : 'dag'
  const d = DAGDELEN[dagdeel]
  const lucht = useFotoLucht(dagdeel)
  const scene = useThree(s => s.scene)
  useEffect(() => {
    if (!lucht) return
    scene.backgroundRotation.set(0, d.rotatie, 0)
    scene.environmentRotation.set(0, d.rotatie, 0)
    scene.environmentIntensity = d.omgeving
    scene.backgroundIntensity = d.achtergrondSterkte
  }, [lucht, scene, d])

  // Schaduwcamera rond terras en tuin (niet rond de gevelvoet): het licht kijkt naar het
  // midden van de tuin en staat op ZON/MAAN dáárvandaan, zodat de richting exact ZON is.
  const doel = useMemo(() => new THREE.Object3D(), [])
  const zDoel = L.erf.tuinD / 2
  const half = Math.max(L.W / 2 + 6, zDoel + 4)
  const groteKaart = hoog && L.W > 8
  const schaduw = {
    castShadow: true,
    'shadow-mapSize': groteKaart ? [4096, 4096] : [2048, 2048],
    'shadow-bias': -0.0004, 'shadow-normalBias': 0.03,
    'shadow-camera-left': -half, 'shadow-camera-right': half, 'shadow-camera-top': half, 'shadow-camera-bottom': -half,
    'shadow-camera-near': 1, 'shadow-camera-far': 80,
  }
  const zonRef = useRef(null)
  // three werkt de projectie van de schaduwcamera alleen bij als de shadowmap wordt aangemaakt;
  // bij gewijzigde maten (half) moet dat expliciet, anders blijft het oude kader staan.
  useEffect(() => { zonRef.current?.shadow.camera.updateProjectionMatrix() }, [half, nacht, groteKaart])

  // Bewolking: één useFrame die alleen schrijft zolang het nat is (of net weer droog werd).
  const hemelRef = useRef(null)
  const mistRef = useRef(null)
  const vorigeNat = useRef(0)
  useFrame(() => {
    const nat = REGEN.uNat.value > 0.001 ? Math.min(REGEN.uNat.value, 1) : 0
    if (nat === 0 && vorigeNat.current === 0) return
    vorigeNat.current = nat
    const zon = zonRef.current, hemel = hemelRef.current, mist = mistRef.current
    if (nacht) {
      if (zon) zon.intensity = lerp(NACHT.maan, NACHT.maanBewolkt, nat)
      if (mist) { mist.near = lerp(NACHT.mistVan[0], NACHT.mistTot[0], nat); mist.far = lerp(NACHT.mistVan[1], NACHT.mistTot[1], nat) }
    } else {
      if (zon) { zon.intensity = lerp(DAG.zon, DAG.zonBewolkt, nat); zon.color.lerpColors(HELDER.zon, BEWOLKT.zon, nat) }
      if (hemel) {
        hemel.intensity = lerp(DAG.hemisfeer, DAG.hemisfeerBewolkt, nat)
        hemel.color.lerpColors(HELDER.hemel, BEWOLKT.hemel, nat)
        hemel.groundColor.lerpColors(HELDER.grond, BEWOLKT.grond, nat)
      }
      if (mist) { mist.near = lerp(DAG.mistVan[0], DAG.mistTot[0], nat); mist.far = lerp(DAG.mistVan[1], DAG.mistTot[1], nat); mist.color.lerpColors(HELDER.mist, BEWOLKT.mist, nat) }
    }
    // Alleen bij de fotolucht: de studio-terugval heeft zijn eigen intensiteit.
    if (lucht) {
      scene.environmentIntensity = d.omgeving * lerp(1, 0.5, nat)
      scene.backgroundIntensity = d.achtergrondSterkte * lerp(1, 0.5, nat)
    }
  })

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
      <primitive object={doel} position={[0, 0, zDoel]} />
      {nacht ? (
        <>
          <fog key="mist-nacht" ref={mistRef} attach="fog" args={[d.mist, NACHT.mistVan[0], NACHT.mistVan[1]]} />
          <hemisphereLight key="hemel-nacht" ref={hemelRef} args={['#34507f', '#0c0f12', NACHT.hemisfeer]} />
          <directionalLight
            key={`maan-${groteKaart}`} ref={zonRef}
            position={[MAAN[0], MAAN[1], MAAN[2] + zDoel]} target={doel} intensity={NACHT.maan} color="#9fb4e0"
            {...schaduw}
          />
        </>
      ) : (
        <>
          <fog key="mist-dag" ref={mistRef} attach="fog" args={[d.mist, DAG.mistVan[0], DAG.mistVan[1]]} />
          <hemisphereLight key="hemel-dag" ref={hemelRef} args={['#cfe0ff', '#5a5f45', DAG.hemisfeer]} />
          <directionalLight
            // Nieuwe key bij een andere kaartgrootte: three maakt de shadowmap alleen opnieuw aan voor een nieuw licht.
            key={`zon-${groteKaart}`} ref={zonRef}
            position={[ZON[0], ZON[1], ZON[2] + zDoel]} target={doel} intensity={DAG.zon} color="#fff4e4"
            {...schaduw}
          />
        </>
      )}
    </>
  )
}
