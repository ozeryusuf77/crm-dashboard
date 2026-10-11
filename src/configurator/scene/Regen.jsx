// Regenmodus: laat zien dat het regent en dat het water van het dak via de goot door
// de gekozen hoekstaander naar de uitloop stroomt. Lazy geladen vanuit Scene.jsx
// (`lazy(() => import('./Regen.jsx'))`) en gemount zolang `aan` of nog aan het uitfaden.
//
//   <Regen L cfg aan nacht hoog bediening onKlaar />
//
// Onderdelen (alle castShadow uit, eigen materialen/geometrie met dispose bij unmount):
//   RegenRegie  één useFrame die de gedeelde uniforms REGEN (regenUniforms.js) schrijft;
//               de 'vertelling' loopt op één timer: regen + natheid → dakwater (0,6 s) →
//               gootwater (1,8 s) → waterkolom vult (2,6–4,2 s) → spetters/plas (3,9–4,0 s).
//   Regenval    instanced strepen in een doos rond de camera, droog onder het dak.
//   Dakwater    glinsterende stroompjes over de dakplaten richting goot.
//   Gootwater   waterband in de (open) goot die naar de afvoerstaander stroomt (Classic/Linea).
//   Waterloop   per afvoer: waterkolom langs a.pad (TubeGeometry), spetters, rimpelringen en plas.
//   Druppels    druppels van de gootlip (alleen desktop, ook bij !hoog).
//   Spatjes     kletterende spatjes op het terras rond de veranda (alleen desktop).
// Render-volgorde: dakwater 3, regenval/spetters/druppels/spatjes 4, straal/plas/ringen 5.
// `hoog` verlaagt alleen aantallen/uniforms (instanceCount, zichtbaarheid), nooit hermounten.
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { REGEN } from './regenUniforms.js'
import { MOBIEL } from './kwaliteit.js'
import { rng } from './textures.js'
import { stroomMasker, stroomNormal, straalStructuur, rimpelNormal, bandMasker, plasMasker } from './regenTexturen.js'
import {
  REGENVAL_VERT, REGENVAL_FRAG, DRUPPEL_VERT, STRAAL_VERT, STRAAL_FRAG,
  SPETTER_VERT, SPETTER_FRAG, RING_VERT, RING_FRAG,
} from './regenShaders.js'

const DT_MAX = 0.1
const klem = (dt) => Math.min(dt, DT_MAX)
const damp = (u, doel, snelheid, dt) => { u.value = THREE.MathUtils.damp(u.value, doel, snelheid, dt) }

// Regenkleur (dag/nacht), gedeeld door regenval en druppels; Regenval werkt hem per frame bij.
const KLEUR_DAG = new THREE.Color('#b8c3cd')
const KLEUR_NACHT = new THREE.Color('#4a545e')
const KLEUR_REGEN = { value: KLEUR_DAG.clone() }

// Instanced quad (4 hoekpunten, 2 driehoeken); de instantiedata komt per onderdeel.
function instantieQuad(n) {
  const basis = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.setIndex(basis.index)
  g.setAttribute('position', basis.attributes.position)
  g.setAttribute('uv', basis.attributes.uv)
  g.instanceCount = n
  return g
}

// ShaderMaterial-basis voor alle deeltjes: transparant, zonder dieptebuffer-schrijven,
// zonder mist (eigen afstandsfade), beide zijden (billboards).
const deeltjesMateriaal = (vertexShader, fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader, fragmentShader, uniforms,
  transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
  blending: THREE.NormalBlending, fog: false,
})

// Alle regen-uniforms terug naar nul (bij onKlaar en bij unmount), zodat de scène droog achterblijft.
function zetDroog() {
  for (const k of ['uRegen', 'uNat', 'uDakwater', 'uGoot', 'uVul', 'uSpetters', 'uPlas']) REGEN[k].value = 0
}

// ─── Regie ───────────────────────────────────────────────────────────────────
function RegenRegie({ aan, onKlaar }) {
  const t = useRef(0)
  const vorige = useRef(aan)
  const gemeld = useRef(false)
  useEffect(() => () => zetDroog(), [])

  useFrame((_, dtRaw) => {
    const dt = klem(dtRaw)
    if (vorige.current !== aan) {
      vorige.current = aan
      t.current = 0
      gemeld.current = false
    }
    t.current += dt
    REGEN.uTijd.value += dt
    const T = t.current

    if (aan) {
      damp(REGEN.uRegen, 1, 1.8, dt)
      damp(REGEN.uNat, 1, 1.4, dt)
      damp(REGEN.uDakwater, T > 0.6 ? 1 : 0, 1.2, dt)
      damp(REGEN.uGoot, T > 1.8 ? 1 : 0, 1.0, dt)
      // Vulfront lineair van 2,6 tot 4,2 s; een nog gevulde kolom (snel uit/aan) zakt niet terug.
      REGEN.uVul.value = Math.max(REGEN.uVul.value, THREE.MathUtils.clamp((T - 2.6) / 1.6, 0, 1))
      damp(REGEN.uSpetters, T > 3.9 ? 1 : 0, 2.5, dt)
      damp(REGEN.uPlas, T > 4.0 ? 1 : 0, 0.5, dt)
    } else {
      damp(REGEN.uRegen, 0, 2.5, dt)
      damp(REGEN.uNat, 0, 2.5, dt)
      damp(REGEN.uDakwater, 0, 2.5, dt)
      damp(REGEN.uGoot, 0, 2.5, dt)
      damp(REGEN.uSpetters, 0, 2.5, dt)
      damp(REGEN.uPlas, 0, 0.6, dt)
      // De kolom dooft mee met het gootwater (straal-shader); daarna pas het vulfront leegmaken.
      if (REGEN.uGoot.value < 0.02) REGEN.uVul.value = 0
      if (!gemeld.current && REGEN.uRegen.value < 0.01 && REGEN.uPlas.value < 0.01) {
        gemeld.current = true
        zetDroog()
        onKlaar?.()
      }
    }
  })
  return null
}

// ─── Regenval ────────────────────────────────────────────────────────────────
// Doos rond de camera: desktop 11000 fijne strepen (4 mm) in 22 × 11 × 22 m, mobiel/laag 3000
// (6 mm) in 14 × 8 × 14 m. Dichtbij faden ze uit (geen 'kometen'), op afstand vormen ze een sluier.
const REGENVAL_HOOG = { n: 11000, straal: 11, hoogte: 11, breedte: 0.004 }
const REGENVAL_LAAG = { n: 3000, straal: 7, hoogte: 8, breedte: 0.006 }
const REGENVAL_MAX = MOBIEL ? REGENVAL_LAAG : REGENVAL_HOOG

function Regenval({ L, nacht, hoog }) {
  const geom = useMemo(() => {
    const { n, straal, hoogte } = REGENVAL_MAX
    const g = instantieQuad(n)
    const r = rng(101)
    const offset = new Float32Array(n * 3)
    const eig = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      offset[i * 3] = r() * 2 * straal
      offset[i * 3 + 1] = r() * hoogte
      offset[i * 3 + 2] = r() * 2 * straal
      eig[i * 2] = 7 + r() * 3          // valsnelheid 7–10 m/s
      eig[i * 2 + 1] = 0.12 + r() * 0.14 // streeplengte 0,12–0,26 m (bewegingsonscherpte bij ±1/60 s)
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3))
    g.setAttribute('aEig', new THREE.InstancedBufferAttribute(eig, 2))
    return g
  }, [])
  const mat = useMemo(() => deeltjesMateriaal(REGENVAL_VERT, REGENVAL_FRAG, {
    uTijd: REGEN.uTijd, uRegen: REGEN.uRegen, uWind: REGEN.uWind, uKleur: KLEUR_REGEN,
    uStraal: { value: REGENVAL_MAX.straal }, uHoogte: { value: REGENVAL_MAX.hoogte },
    uBodem: { value: -0.5 }, uBreedte: { value: REGENVAL_MAX.breedte },
    uDak: { value: new THREE.Vector4() }, uDakY: { value: new THREE.Vector2() },
    uHuis: { value: new THREE.Vector4(0, 0, 1, 0) }, uHuisY: { value: 0 },
  }), [])
  useEffect(() => () => { geom.dispose(); mat.dispose() }, [geom, mat])

  // Dakvoetafdruk: tussen de staanderlijnen van gevel (iets erachter) tot de voorrand; bij een
  // kubus is alles onder de rand van de omkasting droog, anders alles onder het hellende dakvlak.
  // Bij een aanbouw is ook het volume van de hoofdwoning droog (achter de gevel, tot de goot van
  // het woningdak), zodat er door de pui geen regen in de kamer valt.
  useEffect(() => {
    const zMin = L.vrijstaand ? 0 : -0.1
    mat.uniforms.uDak.value.set(-L.W / 2, L.W / 2, zMin, L.D)
    if (L.kubus) mat.uniforms.uDakY.value.set(L.yRand, 0)
    else mat.uniforms.uDakY.value.set(L.dakY(zMin) + 0.02, Math.tan(L.helling))
    const hoofd = L.erf?.hoofd ?? Math.max(L.W + 3.2, 6.6)
    if (L.vrijstaand) mat.uniforms.uHuis.value.set(0, 0, 1, 0)   // lege doos (zMin > zMax)
    else mat.uniforms.uHuis.value.set(-hoofd / 2, hoofd / 2, -9.5, 0)
    mat.uniforms.uHuisY.value = Math.max(L.yDakAchter + 2.9, 5.8) + 0.3
  }, [L, mat])

  // Kwaliteitswissel: alleen aantal en doosmaat (uniforms), geen nieuwe geometrie of shader.
  useEffect(() => {
    const k = hoog && !MOBIEL ? REGENVAL_HOOG : REGENVAL_LAAG
    geom.instanceCount = k.n
    mat.uniforms.uStraal.value = k.straal
    mat.uniforms.uHoogte.value = k.hoogte
    mat.uniforms.uBreedte.value = k.breedte
  }, [hoog, geom, mat])

  const nachtMix = useRef(nacht ? 1 : 0)
  useFrame((_, dtRaw) => {
    nachtMix.current = THREE.MathUtils.damp(nachtMix.current, nacht ? 1 : 0, 2, klem(dtRaw))
    KLEUR_REGEN.value.lerpColors(KLEUR_DAG, KLEUR_NACHT, nachtMix.current)
  })
  return <mesh name="regen-val" geometry={geom} material={mat} frustumCulled={false} renderOrder={4} />
}

// ─── Dakwater ────────────────────────────────────────────────────────────────
// Eén plaat over alle dakplaten, 3 mm boven de plaatbovenkant in dezelfde gekantelde groep
// als de dakplaten (Veranda.jsx: plaatbovenkant = dakY(zMid) + 0,004), tot de binnenrand
// van goot/omkasting. normalMap (lenzen) en alphaMap (stroompjes) scrollen onafhankelijk
// richting goot; op mobiel scrolt alleen het masker.
function Dakwater({ L, bediening }) {
  const lengteLigger = L.lengteDak / Math.cos(L.helling)
  const lengteWater = lengteLigger - L.gootB / 2 / Math.cos(L.helling)
  const breedte = L.W - 2 * L.lB
  const zMid = (L.zAchter + L.zGoot) / 2

  const { geom, mat, normal, masker } = useMemo(() => {
    const normal = stroomNormal().clone()
    normal.repeat.set(L.W / 0.6, lengteWater / 0.6)
    const masker = stroomMasker().clone()
    masker.repeat.set(L.W / 0.45, lengteWater / 0.9)
    const s = MOBIEL ? 0.6 : 0.9
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transparent: true, opacity: 0, roughness: 0.05, metalness: 0, ior: 1.33,
      envMapIntensity: 1.6, normalMap: normal, normalScale: new THREE.Vector2(s, s), alphaMap: masker,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.FrontSide,
    })
    const geom = new THREE.PlaneGeometry(breedte, lengteWater)
    return { geom, mat, normal, masker }
  }, [L.W, lengteWater, breedte])
  useEffect(() => () => { geom.dispose(); mat.dispose(); normal.dispose(); masker.dispose() }, [geom, mat, normal, masker])

  const ref = useRef()
  const verborgen = (bediening?.bovendak ?? 0) > 0.5   // uitgerold bovendakdoek ligt óp het dak
  useFrame((_, dtRaw) => {
    const dt = klem(dtRaw)
    // Stroomrichting: v neemt af richting goot (+z), dus een stijgende offset beweegt het patroon naar de goot.
    if (!MOBIEL) normal.offset.y = (normal.offset.y + dt * (0.55 / 0.6)) % 1
    masker.offset.y = (masker.offset.y + dt * (0.28 / 0.9)) % 1
    mat.opacity = 0.55 * REGEN.uDakwater.value
    if (ref.current) ref.current.visible = mat.opacity > 0.01 && !verborgen
  })

  return (
    <group position={[0, L.dakY(zMid) + 0.007, zMid]} rotation={[L.helling, 0, 0]}>
      <mesh name="regen-dakwater" ref={ref} geometry={geom} material={mat} rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, -(lengteLigger - lengteWater) / 2]} renderOrder={3} visible={false} />
    </group>
  )
}

// ─── Gootwater ───────────────────────────────────────────────────────────────
// Waterband in de voorgoot (alleen goot-modellen; het dak loopt altijd naar de voorgoot af,
// ook vrijstaand). Eén band die naar de afvoerstaander stroomt, of bij twee afvoeren twee
// halve banden die vanaf het midden naar buiten stromen. Zichtbaar zodra de goot een open
// U-kanaal is (Veranda.jsx).
function Gootwater({ L }) {
  const nAfvoer = L.afvoeren?.length ?? 0
  const s0 = L.afvoeren?.[0]?.s ?? 1
  const banden = useMemo(() => {
    // Hoog genoeg in de goot om vanaf het (hogere) afvoerstandpunt zichtbaar te zijn.
    const y = L.goot === 'rond' ? L.Hf + L.gootH * 0.45 : L.Hf + 0.06
    const z = L.D - L.gootB / 2 - 0.01
    const diep = L.gootB - 0.07
    const lijst = nAfvoer === 2
      ? [-1, 1].map(s => ({ s, x: s * L.W / 4, breedte: L.W / 2 - 0.015 }))
      : [{ s: s0, x: 0, breedte: L.W - 0.03 }]
    return lijst.map(b => {
      const normal = stroomNormal().clone()
      normal.repeat.set(b.breedte / 0.4, 1)
      const mat = new THREE.MeshPhysicalMaterial({
        color: '#ffffff', transparent: true, opacity: 0, roughness: 0.05, metalness: 0, ior: 1.33,
        envMapIntensity: 1.6, normalMap: normal, normalScale: new THREE.Vector2(1.0, 1.0), alphaMap: bandMasker(),
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      })
      return { ...b, y, z, diep, normal, mat }
    })
  }, [L.W, L.D, L.Hf, L.goot, L.gootB, L.gootH, nAfvoer, s0])
  useEffect(() => () => banden.forEach(b => { b.mat.dispose(); b.normal.dispose() }), [banden])

  const refs = useRef([])
  useFrame((_, dtRaw) => {
    const dt = klem(dtRaw)
    const op = 0.85 * REGEN.uGoot.value
    banden.forEach((b, i) => {
      // u loopt mee met +x: een dalende offset beweegt het patroon naar +x (rechter staander).
      b.normal.offset.x = (((b.normal.offset.x - dt * (0.25 / 0.4) * b.s) % 1) + 1) % 1
      b.mat.opacity = op
      if (refs.current[i]) refs.current[i].visible = op > 0.01
    })
  })

  return (
    <group>
      {banden.map((b, i) => (
        <mesh key={i} name="regen-gootwater" ref={el => { refs.current[i] = el }} material={b.mat} position={[b.x, b.y, b.z]} renderOrder={3} visible={false}>
          <boxGeometry args={[b.breedte, 0.01, b.diep]} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Waterkolom en uitstroom per afvoer ──────────────────────────────────────
// Buis langs a.pad (gootuitloop → staander → bocht → gat → mond → grond) met straal
// 0,42 × buismaat (past in de PVC-buis), na de mond taps naar 0,3 × buismaat.
function bouwKolom(a) {
  const segmenten = MOBIEL ? 48 : 64
  const radiaal = MOBIEL ? 8 : 10
  const punten = a.pad.map(p => new THREE.Vector3(p[0], p[1], p[2]))
  const curve = new THREE.CatmullRomCurve3(punten, false, 'centripetal')
  const geom = new THREE.TubeGeometry(curve, segmenten, a.buis * 0.42, radiaal, false)
  const lengtes = curve.getLengths()          // cumulatief op t = k / 200
  const lengte = lengtes[lengtes.length - 1]
  let uMond = 1
  const iMond = a.mond ? a.pad.findIndex(p => p[0] === a.mond[0] && p[1] === a.mond[1] && p[2] === a.mond[2]) : -1
  if (iMond > 0) {
    // Booglengte-parameter van de mond (lineair tussen twee tabelwaarden).
    const t = (iMond / (punten.length - 1)) * (lengtes.length - 1)
    const k = Math.min(Math.floor(t), lengtes.length - 2)
    uMond = (lengtes[k] + (lengtes[k + 1] - lengtes[k]) * (t - k)) / lengte
    const pos = geom.attributes.position
    const P = new THREE.Vector3()
    for (let i = 0; i <= segmenten; i++) {
      const u = i / segmenten
      if (u <= uMond) continue
      const f = THREE.MathUtils.lerp(1, 0.3 / 0.42, (u - uMond) / (1 - uMond))
      curve.getPointAt(u, P)
      for (let j = 0; j <= radiaal; j++) {
        const n = i * (radiaal + 1) + j
        pos.setXYZ(n, P.x + (pos.getX(n) - P.x) * f, P.y + (pos.getY(n) - P.y) * f, P.z + (pos.getZ(n) - P.z) * f)
      }
    }
    pos.needsUpdate = true
    geom.computeBoundingSphere()
  }
  return { geom, lengte, uMond }
}

// Middelpunt van plas en rimpelringen: het inslagpunt, maar 22 cm binnen de terrasrand gehouden,
// zodat de plas niet over de opsluitband/grasrand ligt. De spetters blijven op het echte
// inslagpunt a.grond (fysiek: de mond van de uitloop). terrasZ zoals in Terras.jsx/Spatjes.
function klemOpTerras(L, grond) {
  const { terrasW, terrasD } = L.erf
  const terrasZ = terrasD / 2 - (L.vrijstaand ? 0.15 : 0)
  const M = 0.22
  return [
    THREE.MathUtils.clamp(grond[0], -(terrasW / 2 - M), terrasW / 2 - M),
    grond[1],
    THREE.MathUtils.clamp(grond[2], terrasZ - terrasD / 2 + M, terrasZ + terrasD / 2 - M),
  ]
}

function Waterloop({ a, L, hoog }) {
  const sleutel = `${a.buis}|${a.pad.map(p => p.map(v => v.toFixed(4)).join(',')).join(';')}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { geom, lengte, uMond } = useMemo(() => bouwKolom(a), [sleutel])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STRAAL_VERT, fragmentShader: STRAAL_FRAG,
    uniforms: {
      uTijd: REGEN.uTijd, uVul: REGEN.uVul, uGoot: REGEN.uGoot,
      uKleur: { value: new THREE.Color('#b4c9d6') }, uStroom: { value: straalStructuur() },
      uHerhaal: { value: 1 }, uSnelheid: { value: 1 }, uMond: { value: 1 },
    },
    transparent: true, depthWrite: false, side: THREE.FrontSide, fog: false,
  }), [])
  useEffect(() => {
    mat.uniforms.uHerhaal.value = lengte / 0.08
    mat.uniforms.uSnelheid.value = 2.6 / lengte
    mat.uniforms.uMond.value = uMond
  }, [mat, lengte, uMond])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])

  const uitstroom = a.richting !== 'onder' && !!a.grond
  const plek = useMemo(() => (a.grond ? klemOpTerras(L, a.grond) : null), [L, a])
  return (
    <group>
      <mesh name="regen-kolom" geometry={geom} material={mat} renderOrder={5} userData={{ uMond, lengte }} />
      {uitstroom && <Spetters a={a} hoog={hoog} />}
      {uitstroom && <Ringen plek={plek} />}
      {uitstroom && <Plas a={a} L={L} plek={plek} />}
    </group>
  )
}

// Spetters: parabolen vanuit het inslagpunt, desktop 220 (laag/mobiel 60).
const SPETTERS_MAX = MOBIEL ? 60 : 220
function Spetters({ a, hoog }) {
  const geom = useMemo(() => {
    const g = instantieQuad(SPETTERS_MAX)
    const r = rng(131)
    const seed = new Float32Array(SPETTERS_MAX * 4)
    for (let i = 0; i < SPETTERS_MAX; i++) {
      seed[i * 4] = r() * Math.PI * 2     // hoek
      seed[i * 4 + 1] = 0.3 + r() * 0.8   // snelheid xz (m/s)
      seed[i * 4 + 2] = 1.0 + r() * 1.6   // snelheid omhoog (m/s)
      seed[i * 4 + 3] = r()               // fase
    }
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4))
    return g
  }, [])
  const mat = useMemo(() => deeltjesMateriaal(SPETTER_VERT, SPETTER_FRAG, {
    uTijd: REGEN.uTijd, uAan: REGEN.uSpetters,
    uOorsprong: { value: new THREE.Vector3() }, uGrond: { value: 0 },
  }), [])
  useEffect(() => () => { geom.dispose(); mat.dispose() }, [geom, mat])
  useEffect(() => {
    mat.uniforms.uOorsprong.value.set(a.grond[0], a.grond[1] + 0.004, a.grond[2])
    mat.uniforms.uGrond.value = a.grond[1] + 0.001
  }, [a, mat])
  useEffect(() => { geom.instanceCount = hoog ? SPETTERS_MAX : Math.min(SPETTERS_MAX, 60) }, [hoog, geom])
  return <mesh name="regen-spetters" geometry={geom} material={mat} frustumCulled={false} renderOrder={4} />
}

// Vlakke ringen/spatjes op de grond: gedeelde geometrie-opbouw voor Ringen en Spatjes.
function ringGeometrie(posities) {
  const n = posities.length
  const g = instantieQuad(n)
  const pos = new Float32Array(n * 3)
  const fase = new Float32Array(n)
  posities.forEach(([x, y, z, f], i) => { pos.set([x, y, z], i * 3); fase[i] = f })
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
  g.setAttribute('aFase', new THREE.InstancedBufferAttribute(fase, 1))
  return g
}
const ringMateriaal = (aan, tempo, schaal, sterkte) => {
  const m = deeltjesMateriaal(RING_VERT, RING_FRAG, {
    uTijd: REGEN.uTijd, uAan: aan, uTempo: { value: tempo }, uSchaal: { value: schaal }, uSterkte: { value: sterkte },
  })
  m.polygonOffset = true
  m.polygonOffsetFactor = -4
  return m
}

// Rimpelringen rond het inslagpunt (4, mobiel 2), 0,6 m, uitdijend; middelpunt `plek` (op het terras geklemd).
function Ringen({ plek }) {
  const n = MOBIEL ? 2 : 4
  const [gx, gy, gz] = plek
  const geom = useMemo(() => ringGeometrie(Array.from({ length: n }, (_, i) => [gx, gy + 0.005, gz, i / n])), [gx, gy, gz, n])
  const mat = useMemo(() => ringMateriaal(REGEN.uSpetters, 1.1, 0.6, 0.7), [])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh name="regen-ringen" geometry={geom} material={mat} frustumCulled={false} renderOrder={5} />
}

// Plas op het terras: ovaal (lang in de uitstroomrichting), donker-glanzend met rimpels, in de
// tint van de vloer (nat hout / natte tegel); groeit met uPlas en dooft als laatste uit.
// Middelpunt `plek` (op het terras geklemd), richting uit a.n.
function Plas({ a, L, plek }) {
  const { mat, normal } = useMemo(() => {
    const normal = rimpelNormal().clone()
    normal.repeat.set(3, 3)
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#1b2a33', transparent: true, opacity: 0, roughness: 0.04, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6,
      normalMap: normal, normalScale: new THREE.Vector2(0.5, 0.5), alphaMap: plasMasker(),
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    })
    return { mat, normal }
  }, [])
  useEffect(() => () => { mat.dispose(); normal.dispose() }, [mat, normal])
  useEffect(() => { mat.color.set(L.vloer === 'vlonder' ? '#2a2016' : '#1b2a33') }, [mat, L.vloer])

  const ref = useRef()
  useFrame((_, dtRaw) => {
    const p = REGEN.uPlas.value
    mat.opacity = 0.75 * p
    if (ref.current) {
      const s = 0.3 + 0.7 * p
      ref.current.scale.set(s, s, s)
      ref.current.visible = p > 0.01
    }
    if (!MOBIEL) normal.offset.x = (normal.offset.x + klem(dtRaw) * 0.05) % 1
  })

  // Lokaal +z = uitstroomrichting n; de cirkel ligt plat (lokale y → −z) en is 1,25 × 0,85 gerekt.
  return (
    <group ref={ref} position={[plek[0], plek[1] + 0.003, plek[2]]} rotation={[0, Math.atan2(a.n[0], a.n[1]), 0]} visible={false}>
      <mesh name="regen-plas" rotation={[-Math.PI / 2, 0, 0]} scale={[0.85, 1.25, 1]} material={mat} renderOrder={5}>
        <circleGeometry args={[0.24, 32]} />
      </mesh>
    </group>
  )
}

// ─── Desktop-extra's ─────────────────────────────────────────────────────────
// Druppels van de buitenlip van goot/omkasting (en bij vrijstaand ook achter); bij een
// voorscreen vallen ze vóór het screen. Op desktop altijd zichtbaar (`hoog` verlaagt alleen het
// aantal): vanaf ooghoogte is het druppen van de gootlip hét dak→goot-signaal.
const DRUPPELS_N = 260
function Druppels({ L, cfg, hoog }) {
  const geom = useMemo(() => {
    const g = instantieQuad(DRUPPELS_N)
    const r = rng(151)
    const x = new Float32Array(DRUPPELS_N)
    const fase = new Float32Array(DRUPPELS_N)
    for (let i = 0; i < DRUPPELS_N; i++) { x[i] = -L.W / 2 + r() * L.W; fase[i] = r() }
    g.setAttribute('aX', new THREE.InstancedBufferAttribute(x, 1))
    g.setAttribute('aFase', new THREE.InstancedBufferAttribute(fase, 1))
    return g
  }, [L.W])
  // Randen waar het druppelt: voorrand (bij een voorscreen vóór het screen) en vrijstaand ook de
  // achterrand. Alleen nieuwe materialen als een maat echt verandert (niet bij elke cfg-wissel).
  const voorScreen = !!cfg?.zonwering?.screens?.voor && !L.overstek
  const zVoor = voorScreen ? L.zVoorStaander + L.sD / 2 + 0.10 : L.kubus ? L.D : L.D + 0.02
  const yVoor = L.kubus ? L.Hf + L.gootH : L.Hf + L.gootH - 0.01   // gootlip resp. bovenrand omkasting
  const yAchter = L.kubus ? L.Hf : L.achterBalkOnder
  const mats = useMemo(() => {
    const randen = [{ y0: yVoor, z: zVoor }]
    if (L.vrijstaand) randen.push({ y0: yAchter, z: L.kubus ? 0 : -0.012 })
    return randen.map(r => deeltjesMateriaal(DRUPPEL_VERT, REGENVAL_FRAG, {
      uTijd: REGEN.uTijd, uRegen: REGEN.uRegen, uKleur: KLEUR_REGEN,
      uY0: { value: r.y0 }, uZ: { value: r.z }, uBodem: { value: L.vloerY },
    }))
  }, [yVoor, zVoor, L.vrijstaand, yAchter, L.kubus, L.vloerY])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mats.forEach(m => m.dispose()), [mats])
  useEffect(() => { geom.instanceCount = hoog ? DRUPPELS_N : 120 }, [hoog, geom])
  return (
    <group>
      {mats.map((m, i) => <mesh key={i} name="regen-druppels" geometry={geom} material={m} frustumCulled={false} renderOrder={4} />)}
    </group>
  )
}

// Spatjes op het terras en de grond rond de veranda (buiten de dakvoetafdruk), 8 cm, snel.
const SPATJES_N = 220
function Spatjes({ L, hoog }) {
  const geom = useMemo(() => {
    const r = rng(173)
    const terrasZ = L.erf.terrasD / 2 - (L.vrijstaand ? 0.15 : 0)
    const xMax = L.W / 2 + 2.2
    const zMin = L.vrijstaand ? -2.2 : 0.12
    const zMax = L.D + 2.6
    const posities = []
    let pogingen = 0
    while (posities.length < SPATJES_N && pogingen++ < SPATJES_N * 20) {
      const x = (r() * 2 - 1) * xMax
      const z = zMin + r() * (zMax - zMin)
      const onderDak = Math.abs(x) < L.W / 2 + 0.03 && z < L.D + 0.03 && z > (L.vrijstaand ? -0.03 : zMin - 1)
      if (onderDak) continue
      const opTerras = Math.abs(x) <= L.erf.terrasW / 2 && Math.abs(z - terrasZ) <= L.erf.terrasD / 2
      posities.push([x, opTerras ? L.vloerY + 0.004 : 0.006, z, r()])
    }
    return ringGeometrie(posities)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L.W, L.D, L.vrijstaand, L.vloerY, L.erf.terrasW, L.erf.terrasD])
  const mat = useMemo(() => ringMateriaal(REGEN.uRegen, 2.5, 0.08, 0.35), [])
  useEffect(() => () => geom.dispose(), [geom])
  useEffect(() => () => mat.dispose(), [mat])
  return <mesh name="regen-spatjes" geometry={geom} material={mat} frustumCulled={false} renderOrder={4} visible={hoog} />
}

// ─── Samenstelling ───────────────────────────────────────────────────────────
export default function Regen({ L, cfg, aan = true, nacht = false, hoog = !MOBIEL, bediening, onKlaar }) {
  const afvoeren = L.afvoeren || []
  return (
    <group name="regen">
      <RegenRegie aan={aan} onKlaar={onKlaar} />
      <Regenval L={L} nacht={nacht} hoog={hoog} />
      <Dakwater L={L} bediening={bediening} />
      {!L.kubus && <Gootwater L={L} />}
      {afvoeren.map(a => <Waterloop key={a.kant} a={a} L={L} hoog={hoog} />)}
      {!MOBIEL && <Druppels L={L} cfg={cfg} hoog={hoog} />}
      {!MOBIEL && <Spatjes L={L} hoog={hoog} />}
    </group>
  )
}
