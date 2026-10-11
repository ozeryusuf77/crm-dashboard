// Meubels onder de veranda (zoals ref1): een teakhouten loungebank met spijlen en crème
// kussens, twee bijzettafels met stalen buisframe en houten blad, een salontafel, een
// buitenkleed en een rotan hangstoel aan een ligger. Schaal- en sfeerdragers in elk
// standpunt; de hele set kost acht draw calls (hout, staal, kussens, kleed en vier voor
// de hangstoel). Alle maten in meters; de set staat op L.vloerY en past zich aan de
// breedte en diepte aan (geen clipping met staanders, wandrails of de hangstoel).
//
// Assen: x = breedte (0 = midden), y = omhoog (0 = vloer van de set), z = diepte (+z = tuin).
import * as THREE from 'three'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { hout, rotan, rng } from './textures.js'
import { useFotoTexturen, FotoMateriaal } from './fotoTexturen.js'
import { MOBIEL, REKWISIETEN } from './kwaliteit.js'

// Kleuren
const HOUT_KLEUR = '#d9b98a'       // tint over de eikenfoto: blank geolied teak
const KUSSEN = '#ece6d8'           // crème buitenstof
const SIERKUSSENS = ['#d8c7a4', '#a9b49a']
const KLEED = '#b6ab98'
const STAAL = '#2a2b2d'            // gepoedercoat stalen buisframe van de bijzettafels
const KETTING = '#9a9a9a'          // verzinkte ketting en ringen van de hangstoel
const ROTAN = '#c9a66b'
const ROTAN_DICHT = '#b89a62'

// Bank (breedte volgt uit L.W), y-maten zijn hartlijnen boven de vloer
const BANK_MAX = 2.2
const BANK_D = 0.80
const POOT = 0.06                  // hoekstijlen, armleuningen, rugbalk en zitbodem zijn 6 cm dik
const ZIT_Y = 0.36                 // hart zitbodem
const ARM_Y = 0.56                 // hart armleuning
const RUG_Y = 0.70                 // hart rugbalk
const SPIJL_H = 0.45, SPIJL_B = 0.03, SPIJL_STAP = 0.10

// Bijzettafels: buisframe (hart-op-hart) met een iets groter houten blad
const TAFEL = 0.45, TAFEL_KLEIN = 0.40
const BLAD_OVER = 0.02, BLAD_D = 0.03
const BUIS = 0.02
const TAFEL_KIER = 0.06            // kier tussen armleuning en bijzettafel

// Salontafel en kleed
const SALON = [1.0, 0.05, 0.6]
const SALON_POOT = 0.04, SALON_H = 0.34
const KLEED_D = 2.0, KLEED_DIKTE = 0.012

// Hangstoel: eivormige rotan kuip (bol r 0,5, verticaal 1,15× gerekt) aan een ketting
const KUIP_R = 0.5, KUIP_REK = 1.15, KUIP_Y = 0.95
const KETTING_ONDER = 1.50          // ketting loopt van de ligger tot hier (bovenring van de kuip)
const SCHAKEL_R = 0.011, SCHAKEL_D = 0.0025, SCHAKEL_STAP = 0.016
const BOVENRING_R = 0.10, BOVENRING_D = 0.012
const HANG_WANDVRIJ = 0.6           // minimale afstand ligger → zijwand
const HANG_MIN_D = 3

// Vrije ruimte tussen de set en de binnenkant van staanders/wandrails en voorwand
const MARGE = 0.15

const klem = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// ── Indeling ──────────────────────────────────────────────────────────────────
// Bepaalt alle posities (wereld-x/z, y vanaf de vloer) uit de layout. Voorkeur: de set iets
// links van het midden (x = −0,08·W) met de bank 0,55 m achter het setmidden (z = 0,52·D),
// de hangstoel aan de ligger het dichtst bij W/2 − 1,1. Past het niet, dan in deze volgorde:
// set opschuiven, de rechter bijzettafel genest naast de linker, en pas dan geen hangstoel.
export function meubelIndeling(L) {
  const breed = Math.min(BANK_MAX, L.W * 0.45)
  const vrij = L.W / 2 - L.sB - MARGE                 // halve vrije breedte binnen de staanders
  const tafelB = TAFEL + BLAD_OVER + TAFEL_KIER        // bijzettafel naast de armleuning
  const wens = -L.W * 0.08

  // Diepte: bankrug vrij van muurprofiel/achtergoot, kleedvoorrand vrij van de voorwand.
  const zMin = L.zAchter + 0.05 + 0.55 + BANK_D / 2
  const zMax = L.zVoorStaander - MARGE - (0.1 + KLEED_D / 2)
  const cz = Math.max(zMin, Math.min(L.D * 0.52, zMax))
  const zBank = cz - 0.55
  const kleedZ0 = cz + 0.1 - KLEED_D / 2
  const kleedD = klem(L.zVoorStaander - MARGE - kleedZ0, 1.2, KLEED_D)
  const kleedZ = kleedZ0 + kleedD / 2

  // Hangstoel-kandidaat: alleen bij voldoende diepte en een ligger vrij van de zijwand.
  let hang = null
  if (L.D >= HANG_MIN_D && L.xLiggers.length) {
    const doel = L.W / 2 - 1.1
    const x = L.xLiggers.reduce((a, b) => (Math.abs(b - doel) < Math.abs(a - doel) ? b : a))
    if (L.zij.x - x >= HANG_WANDVRIJ) {
      const z = L.D * 0.5
      hang = { x, z, kettingTop: L.dakY(z) - L.lH - L.vloerY, links: x - KUIP_R - 0.1 }
    }
  }

  // Breedte: [tafels links+rechts, tafels genest links] × [met, zonder hangstoel].
  let cx = wens, rechtsTafel = true, hangstoel = null, tafels = true
  const pogingen = [[true, true], [false, true], [true, false], [false, false]]
  let gevonden = false
  for (const [rechts, metHang] of pogingen) {
    const lo = -vrij + breed / 2 + tafelB
    const hi = Math.min(vrij, metHang && hang ? hang.links : Infinity) - breed / 2 - (rechts ? tafelB : 0)
    if (lo > hi) continue
    cx = klem(wens, lo, hi)
    rechtsTafel = rechts
    hangstoel = metHang ? hang : null
    gevonden = true
    break
  }
  if (!gevonden) {
    // Smaller dan 3 m komt niet voor (maatgrenzen), maar dan: alleen de bank, gecentreerd.
    tafels = false
    cx = klem(wens, -vrij + breed / 2, vrij - breed / 2)
  }

  // Bijzettafels: naast de armleuningen, iets naar voren; genest = de tweede (lagere) ervoor.
  const xTafel = breed / 2 + TAFEL_KIER + TAFEL / 2 + BLAD_OVER / 2
  const zTafel = zBank + 0.08
  const bijzettafels = []
  if (tafels) {
    bijzettafels.push({ x: cx - xTafel, z: zTafel, maat: TAFEL })
    if (rechtsTafel) bijzettafels.push({ x: cx + xTafel, z: zTafel, maat: TAFEL })
    else bijzettafels.push({ x: cx - xTafel - 0.03, z: zTafel + TAFEL / 2 + 0.03 + TAFEL_KLEIN / 2, maat: TAFEL_KLEIN })
  }

  return {
    cx, cz, breed, zBank,
    bijzettafels,
    salontafel: { x: cx, z: cz + 0.45 },
    kleed: { x: cx, z: kleedZ, b: breed + 0.6, d: kleedD },
    hangstoel,
  }
}

// ── Geometrie-helpers ─────────────────────────────────────────────────────────
// Doos (non-indexed, zodat alles samengevoegd kan worden) met de uv in meters: u loopt langs
// de lengteas `as` (0 = x, 1 = y, 2 = z) van het onderdeel, zodat de houtnerf met de lengte
// meeloopt; `verschuif` geeft elk deel een eigen stuk van de foto.
function houtDoos(w, h, d, [x, y, z], as, verschuif = [0, 0]) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed()
  g.translate(x, y, z)
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const nrm = [n.getX(i), n.getY(i), n.getZ(i)]
    const normaalAs = nrm.findIndex(v => Math.abs(v) > 0.5)
    const inVlak = [0, 1, 2].filter(a => a !== normaalAs)
    const uAs = inVlak.includes(as) ? as : inVlak[0]
    const vAs = inVlak.find(a => a !== uAs)
    const pos = [p.getX(i), p.getY(i), p.getZ(i)]
    uv.setXY(i, pos[uAs] + verschuif[0], pos[vAs] + verschuif[1])
  }
  return g
}

function doos(w, h, d, [x, y, z]) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed()
  g.translate(x, y, z)
  return g
}

// Afgeronde doos met vaste kleur als vertexkleur, zodat alle kussens één mesh vormen.
function kussen(w, h, d, straal, [x, y, z], [rx, ry, rz], kleur, segmenten) {
  const g = new RoundedBoxGeometry(w, h, d, segmenten, straal)
  g.rotateX(rx)
  g.rotateY(ry)
  g.rotateZ(rz)
  g.translate(x, y, z)
  const c = new THREE.Color(kleur)
  const n = g.attributes.position.count
  const kleuren = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) kleuren.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(kleuren, 3))
  return g
}

function voegSamen(delen) {
  if (!delen.length) return null
  const g = mergeGeometries(delen, false)
  delen.forEach(d => d.dispose())
  return g
}

// ── Loungeset: bank, bijzettafels, salontafel ─────────────────────────────────
// Geeft { hout, staal, kussens } als samengevoegde geometrieën (één draw call elk).
function bouwSet(ind, segmenten) {
  const { cx, breed, zBank, bijzettafels, salontafel } = ind
  const r = rng(31)
  const houtDelen = [], staalDelen = [], kussenDelen = []
  const H = (w, h, d, x, y, z, as) => houtDelen.push(houtDoos(w, h, d, [x, y, z], as, [r() * 3, r() * 3]))

  // Bank: hoekstijlen (voor tot onder de armleuning, achter tot op de rugbalk),
  // armleuningen met onderregel en spijlen, rugbalk met rugspijlen, zitbodem.
  const px = breed / 2 - POOT / 2, pz = BANK_D / 2 - POOT / 2
  const binnen = breed - 2 * POOT
  for (const sx of [-1, 1]) {
    const x = cx + sx * px
    const hVoor = ARM_Y - POOT / 2, hAchter = RUG_Y + POOT / 2
    H(POOT, hVoor, POOT, x, hVoor / 2, zBank + pz, 1)
    H(POOT, hAchter, POOT, x, hAchter / 2, zBank - pz, 1)
    H(POOT, POOT, BANK_D, x, ARM_Y, zBank, 2)                       // armleuning
    H(POOT, 0.04, BANK_D - 2 * POOT, x, 0.06, zBank, 2)               // onderregel (y 0,04–0,08)
    for (let k = -3; k <= 3; k++) H(SPIJL_B, SPIJL_H, SPIJL_B, x, 0.08 + SPIJL_H / 2, zBank + k * SPIJL_STAP, 1)
  }
  H(breed, POOT, POOT, cx, RUG_Y, zBank - pz, 0)                      // rugbalk
  const nRug = Math.max(2, Math.round(binnen / 0.25))
  const rugH = RUG_Y - POOT / 2 - (ZIT_Y + POOT / 2)
  for (let k = 0; k < nRug; k++) {
    const x = cx - binnen / 2 + (binnen * (k + 0.5)) / nRug
    H(SPIJL_B, rugH, 0.02, x, ZIT_Y + POOT / 2 + rugH / 2, zBank - pz, 1)
  }
  H(binnen, POOT, BANK_D - POOT, cx, ZIT_Y, zBank, 0)                 // zitbodem

  // Kussens: twee zitkussens, twee rugkussens (licht achterover) en twee sierkussens.
  const kussenB = (binnen - 0.04) / 2
  const zitY = ZIT_Y + POOT / 2 + 0.07 + 0.004
  for (const s of [-1, 1]) {
    kussenDelen.push(kussen(kussenB, 0.14, 0.72, 0.05, [cx + s * (kussenB / 2 + 0.02), zitY, zBank], [0, 0, 0], KUSSEN, segmenten))
    kussenDelen.push(kussen(kussenB - 0.02, 0.45, 0.16, 0.06, [cx + s * (kussenB / 2 + 0.02), 0.72, zBank - 0.25], [-0.15, 0, 0], KUSSEN, segmenten))
  }
  kussenDelen.push(kussen(0.45, 0.45, 0.12, 0.04, [cx - breed / 2 + 0.36, 0.66, zBank - 0.17], [-0.22, 0.35, 0.04], SIERKUSSENS[0], segmenten))
  kussenDelen.push(kussen(0.45, 0.45, 0.12, 0.04, [cx + breed / 2 - 0.38, 0.65, zBank - 0.16], [-0.2, -0.4, -0.03], SIERKUSSENS[1], segmenten))

  // Bijzettafels: vier buispoten, bovenrechthoek van buis, houten blad op het frame.
  for (const t of bijzettafels) {
    const h = t.maat, hb = t.maat / 2 - BUIS / 2
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) staalDelen.push(doos(BUIS, h, BUIS, [t.x + sx * hb, h / 2, t.z + sz * hb]))
    for (const s of [-1, 1]) {
      staalDelen.push(doos(t.maat, BUIS, BUIS, [t.x, h - BUIS / 2, t.z + s * hb]))
      staalDelen.push(doos(BUIS, BUIS, t.maat - 2 * BUIS, [t.x + s * hb, h - BUIS / 2, t.z]))
    }
    H(t.maat + BLAD_OVER, BLAD_D, t.maat + BLAD_OVER, t.x, h - 0.01 + BLAD_D / 2, t.z, 0)
  }

  // Salontafel: houten blad op vier stalen poten.
  const [sb, sh, sd] = SALON
  H(sb, sh, sd, salontafel.x, SALON_H + sh / 2, salontafel.z, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    staalDelen.push(doos(SALON_POOT, SALON_H, SALON_POOT, [salontafel.x + sx * (sb / 2 - 0.06), SALON_H / 2, salontafel.z + sz * (sd / 2 - 0.05)]))
  }

  return { hout: voegSamen(houtDelen), staal: voegSamen(staalDelen), kussens: voegSamen(kussenDelen) }
}

// ── Hangstoel ─────────────────────────────────────────────────────────────────
// Kuip: dichte kap, romp met opening naar +z (de tuin) en dichte kom; uv per deel
// doorgeschoven zodat het vlechtwerk (repeat 12 × 8) over de hele kuip doorloopt.
function bouwKuip(fijn) {
  const delen = [
    [0, 0.22, 0, 2],            // kap
    [0.22, 0.6, 0.775, 1.45],   // romp, open tussen 0,225π en 0,775π = gecentreerd op +z
    [0.6, 1, 0, 2],             // kom
  ].map(([t0, t1, p0, pl]) => {
    const g = new THREE.SphereGeometry(KUIP_R, Math.max(8, Math.round((fijn ? 32 : 20) * pl / 2)), Math.max(3, Math.round((fijn ? 24 : 16) * (t1 - t0))),
      p0 * Math.PI, pl * Math.PI, t0 * Math.PI, (t1 - t0) * Math.PI)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p0 / 2 + uv.getX(i) * pl / 2, t0 + (1 - uv.getY(i)) * (t1 - t0))
    return g
  })
  const g = voegSamen(delen)
  g.scale(1, KUIP_REK, 1)
  g.translate(0, KUIP_Y, 0)
  return g
}

// Oogbout in de ligger, bovenring van de kuip en de haak ertussen (één geometrie).
function bouwRingen(kettingTop, fijn) {
  const seg = fijn ? 24 : 12
  const bovenringY = KUIP_Y + KUIP_REK * Math.sqrt(KUIP_R ** 2 - BOVENRING_R ** 2)
  const bovenring = new THREE.TorusGeometry(BOVENRING_R, BOVENRING_D, 8, seg * 2).rotateX(Math.PI / 2).translate(0, bovenringY, 0)
  const oog = new THREE.TorusGeometry(0.02, 0.004, 6, seg).translate(0, kettingTop - 0.028, 0)
  const schacht = new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8).translate(0, kettingTop + 0.01, 0)
  const haak = new THREE.TorusGeometry(0.02, 0.003, 6, seg).rotateY(Math.PI / 2).translate(0, bovenringY + BOVENRING_D + 0.012, 0)
  return { geom: voegSamen([bovenring, oog, schacht, haak]), kettingOnder: bovenringY + BOVENRING_D + 0.02 }
}

function Hangstoel({ h, fijn, segmenten, hoog }) {
  const { x, z, kettingTop } = h
  const vlecht = useMemo(() => { const t = rotan(); t.repeat.set(12, 8); return t }, [])
  const kuip = useMemo(() => bouwKuip(fijn), [fijn])
  const kussens = useMemo(() => voegSamen([
    kussen(0.60, 0.10, 0.52, 0.05, [0, 0.60, 0.02], [0, 0, 0], KUSSEN, segmenten),
    kussen(0.64, 0.40, 0.11, 0.05, [0, 0.88, -0.27], [-0.4, 0, 0], KUSSEN, segmenten),
  ]), [segmenten])
  const ringen = useMemo(() => bouwRingen(kettingTop, fijn), [kettingTop, fijn])
  const schakel = useMemo(() => new THREE.TorusGeometry(SCHAKEL_R, SCHAKEL_D, 6, fijn ? 14 : 10), [fijn])
  const metaal = useMemo(() => new THREE.MeshStandardMaterial({ color: KETTING, metalness: 1, roughness: 0.35 }), [])
  useEffect(() => () => vlecht.dispose(), [vlecht])
  useEffect(() => () => kuip.dispose(), [kuip])
  useEffect(() => () => kussens.dispose(), [kussens])
  useEffect(() => () => ringen.geom.dispose(), [ringen])
  useEffect(() => () => { schakel.dispose(); metaal.dispose() }, [schakel, metaal])

  // Ketting: schakels om en om 90° gedraaid, van de oogbout tot de haak op de bovenring.
  const kettingBoven = kettingTop - 0.045
  const nSchakels = Math.max(1, Math.round((kettingBoven - ringen.kettingOnder) / SCHAKEL_STAP))
  const ketting = useRef()
  useLayoutEffect(() => {
    const m = ketting.current
    if (!m) return
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1)
    const as = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < nSchakels; i++) {
      p.set(0, kettingBoven - i * SCHAKEL_STAP, 0)
      q.setFromAxisAngle(as, i % 2 ? Math.PI / 2 : 0)
      m.setMatrixAt(i, M.compose(p, q, s))
    }
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [nSchakels, kettingBoven])

  return (
    <group position={[x, 0, z]}>
      <mesh geometry={kuip} castShadow receiveShadow>
        {REKWISIETEN.hangstoelRotan
          ? <meshStandardMaterial color={ROTAN} roughness={0.85} side={THREE.DoubleSide} alphaMap={vlecht} alphaTest={0.5} />
          : <meshStandardMaterial color={ROTAN_DICHT} roughness={0.85} side={THREE.DoubleSide} />}
      </mesh>
      <mesh geometry={kussens} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {/* Ringen en schakels werpen alleen op de hoge tier schaduw (klein, veel instanties). */}
      <mesh geometry={ringen.geom} material={metaal} castShadow={hoog} />
      <instancedMesh key={nSchakels} ref={ketting} args={[schakel, metaal, nSchakels]} castShadow={hoog} />
    </group>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
// De geometriedetaillering hangt aan MOBIEL (vast), zodat een kwaliteitswissel tijdens de
// sessie geen geometrie opnieuw bouwt; `hoog` schakelt alleen kleine schaduwwerpers uit.
export function Meubels({ L, hoog = !MOBIEL }) {
  const fijn = !MOBIEL
  const segmenten = fijn ? 3 : 2
  const ind = useMemo(() => meubelIndeling(L), [L])
  const geoms = useMemo(() => bouwSet(ind, segmenten), [ind, segmenten])
  useEffect(() => () => { geoms.hout?.dispose(); geoms.staal?.dispose(); geoms.kussens?.dispose() }, [geoms])

  // Eikenhout: foto-set met 1,2 m per herhaling (uv van de houtdelen is in meters),
  // getint naar blank teak; procedurele nerf als terugval zolang de foto's laden.
  const eiken = useFotoTexturen('hout', [1 / 1.2, 1 / 1.2])
  const houtTex = useMemo(() => hout(), [])
  useEffect(() => () => houtTex.dispose(), [houtTex])

  return (
    <group position={[0, L.vloerY, 0]}>
      <mesh geometry={geoms.hout} castShadow receiveShadow>
        <FotoMateriaal foto={eiken} terugval={{ map: houtTex, roughness: 0.75 }} color={HOUT_KLEUR} roughness={0.85} ao={0.6} nat="droog" />
      </mesh>
      {geoms.staal && (
        <mesh geometry={geoms.staal} castShadow receiveShadow>
          <meshStandardMaterial color={STAAL} metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      <mesh geometry={geoms.kussens} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh position={[ind.kleed.x, KLEED_DIKTE / 2, ind.kleed.z]} receiveShadow>
        <boxGeometry args={[ind.kleed.b, KLEED_DIKTE, ind.kleed.d]} />
        <meshStandardMaterial color={KLEED} roughness={1} />
      </mesh>
      {ind.hangstoel && <Hangstoel h={ind.hangstoel} fijn={fijn} segmenten={segmenten} hoog={hoog} />}
    </group>
  )
}

export default Meubels
