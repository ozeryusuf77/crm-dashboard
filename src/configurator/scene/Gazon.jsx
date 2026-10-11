// Gazon: een grote grascirkel tot in de nevel met de gras-fotoset, grootschalige
// tintvariatie (geen 'behang'), nat bij regen (donkerder, zonder plassen) en — op desktop —
// een 3D-grasrand van gekruiste sprietkaartjes langs het terras en de gevelborder.
// Alle maten in meters; het gazon ligt op y = −0,01 onder terras, pad en borders.
import * as THREE from 'three'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFotoTexturen, FotoMateriaal } from './fotoTexturen.js'
import { gras, canvasTex, rng } from './textures.js'
import { natShader, natKey, natKeyFn } from './regenNat.js'
import { MOBIEL, REKWISIETEN } from './kwaliteit.js'
import { terrasMaten } from './Terras.jsx'

const GRAS_R = 200              // straal van de grascirkel
const GRAS_HERHALING = 1.6      // m per herhaling van de gras-fotoset
const MACRO = 37                // macro-tint: de foto zelf, 37 × grover gesampled (≈ 59 m per herhaling)
const RUIS_M = 23               // m per herhaling van de ruis-vlekken (alleen desktop)

// ── Macro-variatie in de shader ────────────────────────────────────────────────
// Na het gewone kleursample vermenigvuldigt een tweede, sterk uitgezoomd sample van dezelfde
// foto de kleur (lichtere en donkerdere plekken van tientallen meters). textureLod op een
// vaste mip (≈ 55 px) maakt de variatie onafhankelijk van de kijkafstand; de constanten
// 0,115/0,075 rekken het g-kanaal van die mip (lineair 0,12–0,18) uit naar 0–1.
// Op desktop komt daar een ruis-canvas overheen (vlekken van ±23 m in wereldcoördinaten).
const MACRO_GLSL = /* glsl */`
#ifdef USE_MAP
  float gazonLod = log2(float(textureSize(map, 0).x) / 55.0);
  float gazonMacro = clamp((textureLod(map, vMapUv / ${MACRO.toFixed(1)}, gazonLod).g - 0.115) / 0.075, 0.0, 1.0);
  diffuseColor.rgb *= mix(0.80, 1.18, gazonMacro);
#endif`
const RUIS_FRAG_GLSL = /* glsl */`
  diffuseColor.rgb *= mix(1.0, 0.90, texture2D(uRuis, vWereld.xz / ${RUIS_M.toFixed(1)}).r);`

function maakGazonShader(ruisTex) {
  const fn = shader => {
    // Eerst de natte look (declareert ook varying vWereld), dan de macro-tint.
    natShader(false)(shader)
    let macro = MACRO_GLSL
    if (ruisTex) {
      shader.uniforms.uRuis = { value: ruisTex }
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uRuis;')
      macro += RUIS_FRAG_GLSL
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>' + macro)
  }
  const sleutel = `gazon-${natKey(false)}${ruisTex ? '-macro2' : '-macro1'}`
  return { fn, sleutel: () => sleutel }
}

// Naadloze value-noise (twee octaven) als 256 px canvas voor de ruis-vlekken.
function ruisCanvas() {
  const n = 256
  const r = rng(41)
  const rooster = (cellen) => Array.from({ length: cellen * cellen }, () => r())
  const octaaf = (cellen, waarden, x, y) => {
    const fx = (x / n) * cellen, fy = (y / n) * cellen
    const ix = Math.floor(fx), iy = Math.floor(fy)
    const tx = fx - ix, ty = fy - iy
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const w = (i, j) => waarden[((j + cellen) % cellen) * cellen + ((i + cellen) % cellen)]
    const a = w(ix, iy) + (w(ix + 1, iy) - w(ix, iy)) * sx
    const b = w(ix, iy + 1) + (w(ix + 1, iy + 1) - w(ix, iy + 1)) * sx
    return a + (b - a) * sy
  }
  const o1 = rooster(4), o2 = rooster(9)
  const t = canvasTex(n, n, (g, w, h) => {
    const img = g.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = 0.65 * octaaf(4, o1, x, y) + 0.35 * octaaf(9, o2, x, y)
        // Contrast: alleen de donkerste helft van de ruis telt als vlek.
        const k = Math.max(0, Math.min(1, (v - 0.35) / 0.4)) * 255
        const i = (y * w + x) * 4
        img.data[i] = img.data[i + 1] = img.data[i + 2] = k
        img.data[i + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
  }, { srgb: false })
  t.anisotropy = 1
  return t
}

function Grasvlakte({ L, hoog }) {
  const grasTex = useMemo(() => {
    const t = gras()
    const herhaling = (GRAS_R * 2) / 1.2
    t.map.repeat.set(herhaling, herhaling)
    t.normalMap.repeat.set(herhaling, herhaling)
    return t
  }, [])
  useEffect(() => () => { grasTex.map.dispose(); grasTex.normalMap.dispose() }, [grasTex])
  const ruisTex = useMemo(() => (hoog ? ruisCanvas() : null), [hoog])
  useEffect(() => () => ruisTex?.dispose(), [ruisTex])
  const shader = useMemo(() => maakGazonShader(ruisTex), [ruisTex])

  const foto = useFotoTexturen('gras', [(GRAS_R * 2) / GRAS_HERHALING, (GRAS_R * 2) / GRAS_HERHALING])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[GRAS_R, 96]} />
      {/* key: een andere shadervariant vraagt een nieuw materiaal (onBeforeCompile achteraf werkt niet). */}
      <FotoMateriaal key={shader.sleutel()} foto={foto}
        terugval={{ map: grasTex.map, normalMap: grasTex.normalMap, normalScale: [0.6, 0.6], roughness: 1 }}
        color="#e4ead0" envMapIntensity={0.45} ao={0.6} normalScale={[0.9, 0.9]}
        onBeforeCompile={shader.fn} customProgramCacheKey={shader.sleutel} />
    </mesh>
  )
}

// ── 3D-grasrand ────────────────────────────────────────────────────────────────
// Alphamasker 64 × 96 met zeven dunne sprieten (wit op zwart), voor alphaTest 0.5.
function sprietMasker() {
  return canvasTex(64, 96, (g, w, h) => {
    const r = rng(17)
    g.fillStyle = '#000000'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    for (let k = 0; k < 7; k++) {
      const x0 = 14 + k * 6 + (r() - 0.5) * 4
      const lean = (r() - 0.5) * 36
      const top = 3 + r() * 22
      const bocht = (r() - 0.5) * 10
      const breed = 2.6 + r() * 1.4
      // Spriet als gebogen, taps toelopende veelhoek: rand links omhoog, rand rechts terug.
      const links = [], rechts = []
      for (let s = 0; s <= 8; s++) {
        const t = s / 8
        const x = x0 + lean * t * t + bocht * t * (1 - t) * 4
        const y = h - 2 - (h - 2 - top) * t
        const b = (breed * (1 - t) + 0.6) / 2
        links.push([x - b, y]); rechts.push([x + b, y])
      }
      g.beginPath()
      links.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      rechts.reverse().forEach(([x, y]) => g.lineTo(x, y))
      g.closePath()
      g.fill()
    }
  }, { srgb: false })
}

// Twee gekruiste kaartjes (b × h, voet op y = 0) met normalen omhoog, zodat de sprieten de
// belichting van de grond aannemen in plaats van per vlak licht/donker te zijn.
function gekruisteKaartjes(b, h) {
  const a = new THREE.PlaneGeometry(b, h).translate(0, h / 2, 0)
  const c = a.clone().rotateY(Math.PI / 2)
  const g = mergeGeometries([a, c])
  a.dispose(); c.dispose()
  const nrm = g.attributes.normal
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0)
  return g
}

function Grasrand({ L, aantal }) {
  const { terrasW, terrasD, terrasZ, z0, z1 } = terrasMaten(L)
  const { erfX, tuinD } = L.erf
  const masker = useMemo(() => sprietMasker(), [])
  const geom = useMemo(() => gekruisteKaartjes(0.12, 0.18), [])
  useEffect(() => () => { masker.dispose(); geom.dispose() }, [masker, geom])
  const mesh = useRef()

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const r = rng(53)
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
    const kleur = new THREE.Color()
    const as = new THREE.Vector3(0, 1, 0)
    const rand = L.vloer === 'tegels' ? 0.08 : 0
    const bx = terrasW / 2 + rand, bz1 = z1 + rand, bz0 = z0 - (L.vrijstaand ? rand : 0)
    // Vrij gazon: niet op het kinderkopjespad (links, 1,4 m langs de schutting), niet in de
    // borders (0,7 m langs de schuttingen) en bij een aanbouw niet in de woning (z < 0).
    const xMin = -erfX + 1.6, xMax = erfX - 0.8, zMin = L.vrijstaand ? -1.5 : 0.02, zMax = tuinD - 0.8
    const opTerras = (x, z) => Math.abs(x) < bx && z > bz0 && z < bz1
    const vrij = (x, z) => x > xMin && x < xMax && z > zMin && z < zMax && !opTerras(x, z)
    // Afstand tot de terrasrand: dichtbij dichter bezet (macht 2,2), tot 1,2 m.
    const kandidaat = () => {
      const d = 0.02 + 1.18 * Math.pow(r(), 2.6)
      if (!L.vrijstaand && r() < 0.22) {
        // Langs de gevelborder (0,6 m diep) naast het terras.
        const kant = r() < 0.5 ? -1 : 1
        return [kant * (bx + 0.1 + r() * Math.max(0.1, (kant < 0 ? -xMin : xMax) - bx - 0.2)), r() * 0.6, 0.3]
      }
      const omtrek = 2 * (bz1 - bz0) + 2 * bx + (L.vrijstaand ? 2 * bx : 0)
      let t = r() * omtrek
      if (t < bz1 - bz0) return [-bx - d, bz0 + t, d]
      t -= bz1 - bz0
      if (t < bz1 - bz0) return [bx + d, bz0 + t, d]
      t -= bz1 - bz0
      if (t < 2 * bx) return [-bx + t, bz1 + d, d]
      t -= 2 * bx
      return [-bx + t, bz0 - d, d]
    }
    let n = 0
    for (let pogingen = 0; n < aantal && pogingen < aantal * 6; pogingen++) {
      const [x, z, d] = kandidaat()
      if (!vrij(x, z)) continue
      // Pollen van 5–15 cm; dicht bij de rand iets hoger (het gras dat de maaier mist).
      const schaal = (0.4 + r() * 0.45) * (d < 0.25 ? 1.1 : 0.85)
      p.set(x, 0, z)
      q.setFromAxisAngle(as, r() * Math.PI)
      s.set(schaal, schaal * (0.85 + r() * 0.3), schaal)
      m.setMatrixAt(n, M.compose(p, q, s))
      // Lichte variatie: iets geler of iets donkerder groen per pol.
      kleur.setRGB(0.6 + r() * 0.35, 0.62 + r() * 0.3, 0.55 + r() * 0.3)
      m.setColorAt(n, kleur)
      n++
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [aantal, terrasW, terrasD, terrasZ, z0, z1, erfX, tuinD, L.vrijstaand, L.vloer])

  return (
    <instancedMesh ref={mesh} args={[geom, undefined, aantal]} receiveShadow>
      <meshStandardMaterial color="#55762a" roughness={1} envMapIntensity={0.45} side={THREE.DoubleSide} alphaMap={masker} alphaTest={0.5}
        onBeforeCompile={natShader(false)} customProgramCacheKey={natKeyFn(false)} />
    </instancedMesh>
  )
}

export function Gazon({ L, hoog = !MOBIEL }) {
  const aantal = hoog ? REKWISIETEN.grasrand : 0
  return (
    <group>
      <Grasvlakte L={L} hoog={hoog} />
      {aantal > 0 && <Grasrand L={L} aantal={aantal} />}
    </group>
  )
}

export default Gazon
