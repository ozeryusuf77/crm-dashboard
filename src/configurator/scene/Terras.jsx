// Terrasvloer onder en rond de veranda: een houten vlonder (ref1) of lichte keramische
// tegels (ref2), precies de verandamaat + 15 cm rondom (L.erf). Rondom een strook kale
// grond als overgang naar het gazon. Op de mobiele tier (zonder nabewerking/AO) legt een
// eenmalig gebakken contactschaduw de meubels en potten op de vloer.
// Alle maten in meters; de bovenkant van de vloer ligt op L.vloerY (layout.js VLOER_Y).
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js'
import { useFotoTexturen, FotoMateriaal } from './fotoTexturen.js'
import { hout, tegels } from './textures.js'
import { MOBIEL } from './kwaliteit.js'

// Echte maat van één herhaling van de fotosets (zie assets/BRONNEN.md en vlonder/LICENTIE.txt).
const VLONDER_HERHALING = 1.8   // 12 planken van 15 cm
const TEGEL_HERHALING = 1.8     // 3 × 3 tegels van 60 cm
const PLANK_DIKTE = 0.028
const RANDPLANK = 0.14          // kantplank (kaderplank) langs beide zijkanten van de vlonder
const OPSLUITBAND = 0.08
const GRASRAND = 0.04           // smalle strook grond rond het terras (breder leest als 'grondgoot')
const GROND = '#5b5a4a'

// In de vlonder-fotoset lopen de planken langs u (horizontaal in de afbeelding); de voegen
// liggen om de 171 px. De kantplank gebruikt de plank tussen rij 173 en 344 (v ≈ 0,874).
const KANTPLANK_V = 0.874
const VOEG_V = 0.998            // voeg op de rand van de afbeelding

const mod1 = x => ((x % 1) + 1) % 1
// Verschuiving zodat de uv-waarde `doel` (in herhalingen) precies op textuurcoördinaat `bij`
// valt. useFotoTexturen zet center (0.5, 0.5): uv' = herhaling·uv + 0.5·(1 − herhaling) + offset.
const uitlijn = (herhaling, bij, doel = 0) => mod1(doel - herhaling * bij - 0.5 * (1 - herhaling))

// Terrasmaten uit de layout: x gecentreerd, z van z0 (gevel, of 15 cm achter een vrijstaande
// veranda) tot z1 (15 cm voor de voorstaanders).
export function terrasMaten(L) {
  const { terrasW, terrasD } = L.erf
  const terrasZ = terrasD / 2 - (L.vrijstaand ? 0.15 : 0)
  return { terrasW, terrasD, terrasZ, z0: terrasZ - terrasD / 2, z1: terrasZ + terrasD / 2 }
}

// ── Vlonder ────────────────────────────────────────────────────────────────────
function Vlonder({ L, m }) {
  const { terrasW, terrasD, terrasZ } = m
  const veldW = terrasW - 2 * RANDPLANK
  const yPlank = L.vloerY - PLANK_DIKTE / 2

  // Procedurele terugval zolang de foto's laden (nerf langs x, zoals de planken).
  const houtTex = useMemo(() => { const t = hout(); t.repeat.set(veldW / 0.5, terrasD / 0.5); return t }, [veldW, terrasD])
  const houtRandTex = useMemo(() => {
    const t = hout(); t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(terrasD / 0.5, RANDPLANK / 0.5); return t
  }, [terrasD])
  useEffect(() => () => { houtTex.dispose(); houtRandTex.dispose() }, [houtTex, houtRandTex])

  // Veld: planken evenwijdig aan de gevel (langs x), een voeg precies op de voorrand.
  const sx = veldW / VLONDER_HERHALING, sy = terrasD / VLONDER_HERHALING
  const veld = useFotoTexturen('vlonder', [sx, sy], [0, uitlijn(sy, 0, VOEG_V)])
  // Kantplanken langs z: uv 90° gedraaid (herhaling dus [z, x]) en één hele plank breed.
  const rx = terrasD / VLONDER_HERHALING, ry = RANDPLANK / VLONDER_HERHALING
  const rand = useFotoTexturen('vlonder', [rx, ry], [0, KANTPLANK_V - 0.5], Math.PI / 2)

  // Lichte, warme tint over de (geblondeerde) foto: blanke hardhouten vlonder zoals ref1.
  const plank = (foto, map) => (
    <FotoMateriaal foto={foto} terugval={{ map, roughness: 0.7 }} roughness={0.7} color="#d8c39d" nat="droog" />
  )

  return (
    <group>
      <mesh position={[0, yPlank, terrasZ]} receiveShadow>
        <boxGeometry args={[veldW, PLANK_DIKTE, terrasD]} />
        {plank(veld, houtTex)}
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (terrasW / 2 - RANDPLANK / 2), yPlank, terrasZ]} receiveShadow>
          <boxGeometry args={[RANDPLANK, PLANK_DIKTE, terrasD]} />
          {plank(rand, houtRandTex)}
        </mesh>
      ))}
      {/* Onderregels (liggers) onder de planken */}
      {[-terrasW / 2 + 0.1, 0, terrasW / 2 - 0.1].map((x, i) => (
        <mesh key={i} position={[x, L.vloerY - PLANK_DIKTE - 0.015, terrasZ]}>
          <boxGeometry args={[0.045, 0.03, terrasD]} />
          <meshStandardMaterial color="#5a4634" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// ── Tegels ─────────────────────────────────────────────────────────────────────
function Tegels({ L, m, hoog }) {
  const { terrasW, terrasD, terrasZ, z0, z1 } = m
  const tegelTex = useMemo(() => tegels(), [])
  useEffect(() => {
    tegelTex.map.repeat.set(terrasW / 1.2, terrasD / 1.2)
    tegelTex.normalMap.repeat.copy(tegelTex.map.repeat)
  }, [tegelTex, terrasW, terrasD])
  useEffect(() => () => { tegelTex.map.dispose(); tegelTex.normalMap.dispose() }, [tegelTex])

  // Hele tegel aan de gevel (v = 1) en aan de linkerzijde (u = 0).
  const sx = terrasW / TEGEL_HERHALING, sy = terrasD / TEGEL_HERHALING
  const foto = useFotoTexturen('terras', [sx, sy], [uitlijn(sx, 0), uitlijn(sy, 1)])

  // Opsluitband rondom (aan de gevelzijde alleen bij een vrijstaande veranda).
  const zijL = terrasD + OPSLUITBAND * (L.vrijstaand ? 2 : 1)
  const zijZ = (z0 - (L.vrijstaand ? OPSLUITBAND : 0) + z1 + OPSLUITBAND) / 2
  const banden = [
    [0, z1 + OPSLUITBAND / 2, terrasW, OPSLUITBAND],
    [-terrasW / 2 - OPSLUITBAND / 2, zijZ, OPSLUITBAND, zijL],
    [terrasW / 2 + OPSLUITBAND / 2, zijZ, OPSLUITBAND, zijL],
    ...(L.vrijstaand ? [[0, z0 - OPSLUITBAND / 2, terrasW, OPSLUITBAND]] : []),
  ]

  return (
    <group>
      <mesh position={[0, L.vloerY - 0.01, terrasZ]} receiveShadow>
        <boxGeometry args={[terrasW, 0.02, terrasD]} />
        <FotoMateriaal foto={foto} terugval={{ map: tegelTex.map, normalMap: tegelTex.normalMap, normalScale: [0.7, 0.7], roughness: 0.85 }}
          ao={0.7} roughness={0.8} nat={hoog ? 'plassen' : 'droog'} />
      </mesh>
      {banden.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.015, z]} receiveShadow castShadow>
          <boxGeometry args={[w, 0.05, d]} />
          <meshStandardMaterial color="#6f6c66" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// ── Grasrand: strook kale grond tussen terras en gazon ─────────────────────────
function Grasrand({ L, m, rand }) {
  const { terrasW, z0, z1 } = m
  const buiten = terrasW / 2 + rand
  const achter = L.vrijstaand ? z0 - rand - GRASRAND : z0
  const voor = z1 + rand + GRASRAND
  const stroken = [
    [0, z1 + rand + GRASRAND / 2, 2 * buiten, GRASRAND],
    [-buiten - GRASRAND / 2, (achter + voor) / 2, GRASRAND, voor - achter],
    [buiten + GRASRAND / 2, (achter + voor) / 2, GRASRAND, voor - achter],
    ...(L.vrijstaand ? [[0, z0 - rand - GRASRAND / 2, 2 * buiten, GRASRAND]] : []),
  ]
  return stroken.map(([x, z, w, d], i) => (
    <mesh key={i} position={[x, 0.002, z]} receiveShadow>
      <boxGeometry args={[w, 0.004, d]} />
      <meshStandardMaterial color={GROND} roughness={1} />
    </mesh>
  ))
}

// ── Contactschaduw (mobiele tier) ──────────────────────────────────────────────
// Een orthografische camera kijkt vanaf het terrasvlak omhoog (tot `ver` meter), rendert de
// scène één keer als dieptebeeld, blurt dat twee keer en legt het als donkere vlek op de
// vloer: bank, tafel en potten 'staan' dan op het terras. Zelfde techniek als drei's
// ContactShadows, maar: de rendertargets blijven bij maatwijziging bestaan (geen lek bij
// elke slider-stap), de blur heeft een eigen camera (drei's blurvlak ligt op wereld-y 0 en
// valt achter een camera boven de vloer), het dieptemateriaal is dubbelzijdig (zie onder)
// en er wordt opnieuw gebakken na het laden van de lazy rekwisieten.
function Contactschaduw({ breedte, diepte, position, sleutel, ver = 1.4, blur = 2.4, opacity = 0.45, resolutie = 512, kleur = '#101418' }) {
  const gl = useThree(s => s.gl)
  const scene = useThree(s => s.scene)
  const groep = useRef()
  const cam = useRef()
  const teDoen = useRef(1)

  const r = useMemo(() => {
    const maak = () => {
      const t = new THREE.WebGLRenderTarget(resolutie, resolutie)
      t.texture.generateMipmaps = false
      return t
    }
    const doel = maak(), tussen = maak()
    // DoubleSide: van onderaf gezien ligt de onderkant van bank, tafel en pot áchter het
    // vlak (ze staan op de vloer); hun bovenvlak is dan het enige vlak in beeld.
    const diepteMat = new THREE.MeshDepthMaterial({ depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    diepteMat.onBeforeCompile = shader => {
      shader.uniforms.uKleur = { value: new THREE.Color(kleur) }
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uKleur;\nvoid main() {')
        // Dekking neemt af met de afstand tot het vlak; de kern blijft het donkerst.
        .replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( uKleur * fragCoordZ * 2.0, 1.0 - fragCoordZ );')
    }
    diepteMat.customProgramCacheKey = () => 'contactschaduw'
    const blurH = new THREE.ShaderMaterial({ ...HorizontalBlurShader, uniforms: THREE.UniformsUtils.clone(HorizontalBlurShader.uniforms) })
    const blurV = new THREE.ShaderMaterial({ ...VerticalBlurShader, uniforms: THREE.UniformsUtils.clone(VerticalBlurShader.uniforms) })
    blurH.depthTest = blurV.depthTest = false
    const blurVlak = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurH)
    const blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2)
    blurCam.position.z = 1
    blurCam.updateMatrixWorld()
    return { doel, tussen, diepteMat, blurH, blurV, blurVlak, blurCam }
  }, [resolutie, kleur])
  useEffect(() => () => {
    r.doel.dispose(); r.tussen.dispose(); r.diepteMat.dispose(); r.blurH.dispose(); r.blurV.dispose(); r.blurVlak.geometry.dispose()
  }, [r])

  // Opnieuw bakken bij andere maten/vloer en (voor de lazy geladen rekwisieten) kort na de start.
  useEffect(() => { teDoen.current = 1 }, [sleutel, breedte, diepte, r])
  useEffect(() => {
    const ids = [2500, 7000].map(ms => setTimeout(() => { teDoen.current = 1 }, ms))
    return () => ids.forEach(clearTimeout)
  }, [])

  const blurPas = sterkte => {
    r.blurVlak.material = r.blurH
    r.blurH.uniforms.tDiffuse.value = r.doel.texture
    r.blurH.uniforms.h.value = sterkte / 256
    gl.setRenderTarget(r.tussen)
    gl.render(r.blurVlak, r.blurCam)
    r.blurVlak.material = r.blurV
    r.blurV.uniforms.tDiffuse.value = r.tussen.texture
    r.blurV.uniforms.v.value = sterkte / 256
    gl.setRenderTarget(r.doel)
    gl.render(r.blurVlak, r.blurCam)
  }

  useFrame(() => {
    if (teDoen.current <= 0 || !cam.current || !groep.current) return
    teDoen.current--
    const achtergrond = scene.background
    const override = scene.overrideMaterial
    groep.current.visible = false
    scene.background = null
    scene.overrideMaterial = r.diepteMat
    gl.setRenderTarget(r.doel)
    gl.render(scene, cam.current)
    blurPas(blur)
    blurPas(blur * 0.4)
    gl.setRenderTarget(null)
    groep.current.visible = true
    scene.overrideMaterial = override
    scene.background = achtergrond
  })

  return (
    <group ref={groep} position={position}>
      {/* Camera kijkt omhoog (+y): rechts = +x, boven = +z; het vlak spiegelt mee via de negatieve schaal. */}
      <orthographicCamera ref={cam} args={[-breedte / 2, breedte / 2, diepte / 2, -diepte / 2, 0, ver]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[breedte, -diepte, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={r.doel.texture} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Terras({ L, hoog = !MOBIEL }) {
  const m = terrasMaten(L)
  const vlonder = L.vloer === 'vlonder'
  return (
    <group>
      {vlonder ? <Vlonder L={L} m={m} /> : <Tegels L={L} m={m} hoog={hoog} />}
      <Grasrand L={L} m={m} rand={vlonder ? 0 : OPSLUITBAND} />
      {!hoog && (
        <Contactschaduw breedte={m.terrasW} diepte={m.terrasD} position={[0, L.vloerY + 0.012, m.terrasZ]}
          sleutel={`${L.W}-${L.D}-${L.vrijstaand}-${L.vloer}`} />
      )}
    </group>
  )
}

export default Terras
