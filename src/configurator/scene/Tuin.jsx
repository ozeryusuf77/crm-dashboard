// Erf rondom de veranda: een houten schutting (beide zijkanten en achter) op betonplaten,
// borders met donkere grond, een kinderkopjespad langs de linkerschutting, gevallen bladeren en
// de echte GLB-rekwisieten (struiken, bomen, potplanten, bistroset, bankje, plantenbakken) die
// lazy en per kwaliteitsniveau laden via scene/modellen.js.
//
// Alle maten in meters, uit L.erf (layout.js): erfX = halve erfbreedte (schutting op x = ±erfX),
// tuinD = diepte van het erf vanaf de gevel (achterschutting op z = tuinD), terrasW/terrasD.
// Indeling, gezien vanuit de tuin naar de gevel (ref1): links de schutting met daarlangs
// kinderkopjes (1,4 m breed naast het terras; achter het terras een border van 0,7 m langs de
// schutting met een smaller pad van 0,75 m ernaast), rechts een border van 0,7 m langs de
// schutting, achter een border van 0,7 m. Het gazon (Gazon.jsx, y = −0,01) ligt onder alles.
import * as THREE from 'three'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFotoTexturen, FotoMateriaal } from './fotoTexturen.js'
import { hout, kinderkopjes, canvasTex, rng } from './textures.js'
import { natShader, natKeyFn } from './regenNat.js'
import { MOBIEL, REKWISIETEN } from './kwaliteit.js'
import { Model, modelUrl, ruimOp } from './modellen.js'
import { meubelIndeling } from './Meubels.jsx'
import { Foutgrens } from './Foutgrens.jsx'

// ── Maten ──────────────────────────────────────────────────────────────────────
const PANEEL_B = 1.8, PANEEL_H = 1.8, PANEEL_D = 0.02
const PAAL = 0.09, PAAL_H = 2.06, PAAL_ONDER = -0.02   // 2 cm in de grond, kopt 4 cm boven het paneel uit
const BETON_H = 0.26, BETON_D = 0.035, BETON_ONDER = -0.06   // betonplaat 6 cm ingegraven
const PANEEL_ONDER = BETON_ONDER + BETON_H               // 0,20: paneel staat op de betonplaat
const SCHUTTING_VAN_GEVEL = 0.1                          // zijschuttingen beginnen 10 cm voor de gevel
const HOUT_HERHALING = 1.2     // 1 herhaling van de hout-fotoset (Poly Haven "Oak Wood Planks")
const HOUT = '#9c8a6c'         // verweerd grijsbruin (hardhout na een paar seizoenen) over de eiken foto
const BETON = '#9a9893'
const GROND = '#3b2e24'
const BORDER_B = 0.7
const PAD_B = 1.4, PAD_SMAL = 0.75, PAD_Y = 0.005, PAD_VAN_SCHUTTING = 0.05
const KEIEN = 0.72             // 1 herhaling van kinderkopjes() = 6 keien van 12 cm
const BLAD_Y = 0.006           // bladeren op het gazon (gazon −0,01; grondstrook van het terras ≤ 0,004)
const BLAD_KLEUREN = ['#d9a441', '#c87d2a', '#a65f1f', '#e3c15a']

// ── Indeling van het erf ───────────────────────────────────────────────────────
// Geeft de rechthoeken (in meters) van terras, pad en borders, zodat bladeren, rekwisieten en
// andere onderdelen dezelfde grenzen gebruiken.
export function erfIndeling(L) {
  const { erfX, tuinD, terrasW, terrasD } = L.erf
  // Zelfde terrasligging als Terras.jsx: x gecentreerd, z van 0 (gevel) tot D + 0,3;
  // bij een vrijstaande veranda 15 cm achter de achterstaanders beginnend.
  const terrasZ = terrasD / 2 - (L.vrijstaand ? 0.15 : 0)
  const terras = { x0: -terrasW / 2, x1: terrasW / 2, z0: terrasZ - terrasD / 2, z1: terrasZ + terrasD / 2 }
  const zBegin = L.vrijstaand ? SCHUTTING_VAN_GEVEL : 0
  const padX0 = -erfX + PAD_VAN_SCHUTTING
  return {
    erfX, tuinD, terras,
    // Kinderkopjes: 1,4 m breed naast het terras (tot aan de terrasrand), daarachter 0,75 m
    // breed tussen de linkerborder en het gazon, tot aan de achterschutting.
    pad: { x0: padX0, x1: padX0 + PAD_B, x0Smal: padX0 + PAD_B - PAD_SMAL, zKnik: terras.z1, z0: zBegin, z1: tuinD },
    // Borders [x0, x1, z0, z1]: links achter het brede pad, rechts vanaf de gevelborder van de
    // woning (0,6 m), achter tussen het pad en de rechterborder.
    borders: [
      [-erfX, -erfX + BORDER_B, terras.z1, tuinD],
      [erfX - BORDER_B, erfX, L.vrijstaand ? zBegin : 0.6, tuinD],
      [padX0 + PAD_B, erfX - BORDER_B, tuinD - BORDER_B, tuinD],
    ],
  }
}

// ── Schutting ──────────────────────────────────────────────────────────────────
// Posities van panelen en palen langs de lijn a → b (xz). Zoveel hele panelen als passen; het
// laatste paneel wordt op maat gemaakt (zoals een hovenier het sluitpaneel afkort). Een
// sluitpaneel smaller dan 0,45 m wordt vermeden door alle panelen gelijkmatig te rekken.
function hekInstanties(a, b, { paalBegin = true, paalEind = true } = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1]
  const lengte = Math.hypot(dx, dz)
  const hoek = Math.atan2(-dz, dx)          // rotatie om y waarmee de lokale x-as langs a → b valt
  const ux = dx / lengte, uz = dz / lengte
  const extra = (paalBegin ? 1 : 0) + (paalEind ? 1 : 0) - 1   // palen = panelen + extra
  let n = Math.max(1, Math.ceil((lengte - extra * PAAL) / (PANEEL_B + PAAL) - 1e-6))
  let lengtes = Array(n).fill(PANEEL_B)
  lengtes[n - 1] = lengte - (n + extra) * PAAL - (n - 1) * PANEEL_B
  if (n > 1 && lengtes[n - 1] < 0.45) {
    n--
    lengtes = Array(n).fill((lengte - (n + extra) * PAAL) / n)
  }
  const punt = s => [a[0] + ux * s, a[1] + uz * s]
  const panelen = [], palen = []
  if (paalBegin) palen.push(punt(PAAL / 2))
  let s0 = paalBegin ? PAAL : 0
  for (let k = 0; k < n; k++) {
    panelen.push({ xz: punt(s0 + lengtes[k] / 2), schaal: lengtes[k] / PANEEL_B })
    if (k < n - 1 || paalEind) palen.push(punt(s0 + lengtes[k] + PAAL / 2))
    s0 += lengtes[k] + PAAL
  }
  return { hoek, panelen, palen }
}

// Eén zijde van de schutting: drie InstancedMesh (panelen, palen, betonplaten).
function Hekzijde({ a, b, paalBegin = true, paalEind = true, fotoPaneel, fotoPaal, terugval }) {
  const panelen = useRef(), palen = useRef(), beton = useRef()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hek = useMemo(() => hekInstanties(a, b, { paalBegin, paalEind }), [a[0], a[1], b[0], b[1], paalBegin, paalEind])

  useLayoutEffect(() => {
    const M = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3()
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hek.hoek)
    hek.panelen.forEach(({ xz, schaal }, i) => {
      s.set(schaal, 1, 1)
      p.set(xz[0], PANEEL_ONDER + PANEEL_H / 2, xz[1])
      panelen.current.setMatrixAt(i, M.compose(p, q, s))
      p.set(xz[0], BETON_ONDER + BETON_H / 2, xz[1])
      beton.current.setMatrixAt(i, M.compose(p, q, s))
    })
    s.set(1, 1, 1)
    hek.palen.forEach((xz, i) => {
      p.set(xz[0], PAAL_ONDER + PAAL_H / 2, xz[1])
      palen.current.setMatrixAt(i, M.compose(p, q, s))
    })
    for (const m of [panelen, palen, beton]) {
      m.current.instanceMatrix.needsUpdate = true
      m.current.computeBoundingSphere()
    }
  }, [hek])

  // De eiken-fotoset is een gelakte vloer (gladde ruwheidskaart); een schutting is mat en
  // verweerd, dus zonder ruwheidskaart en met een vaste hoge ruwheid — anders spiegelt de
  // zon als een wit vlak op de panelen.
  return (
    <group>
      <instancedMesh ref={panelen} args={[undefined, undefined, hek.panelen.length]} castShadow receiveShadow>
        <boxGeometry args={[PANEEL_B, PANEEL_H, PANEEL_D]} />
        <FotoMateriaal foto={fotoPaneel && { ...fotoPaneel, roughnessMap: null }} terugval={{ map: terugval.paneel, roughness: 0.95 }}
          color={HOUT} roughness={0.95} envMapIntensity={0.3} ao={0.7} nat="droog" />
      </instancedMesh>
      <instancedMesh ref={palen} args={[undefined, undefined, hek.palen.length]} castShadow receiveShadow>
        <boxGeometry args={[PAAL, PAAL_H, PAAL]} />
        <FotoMateriaal foto={fotoPaal && { ...fotoPaal, roughnessMap: null }} terugval={{ map: terugval.paal, roughness: 0.95 }}
          color={HOUT} roughness={0.95} envMapIntensity={0.3} ao={0.7} nat="droog" />
      </instancedMesh>
      <instancedMesh ref={beton} args={[undefined, undefined, hek.panelen.length]} castShadow receiveShadow>
        <boxGeometry args={[PANEEL_B, BETON_H, BETON_D]} />
        <meshStandardMaterial color={BETON} roughness={0.95} onBeforeCompile={natShader(false)} customProgramCacheKey={natKeyFn(false)} />
      </instancedMesh>
    </group>
  )
}

// Groep die alleen zichtbaar is zolang de camera aan de goede kant staat: een schutting (of de
// boom erachter) mag de standpunten 'links', 'rechts' en 'voor' niet blokkeren.
function Zijde({ zichtbaar, children }) {
  const groep = useRef()
  useFrame(({ camera }) => {
    if (groep.current) groep.current.visible = zichtbaar(camera.position)
  })
  return <group ref={groep}>{children}</group>
}

function Schutting({ L, zijden }) {
  const { erfX, tuinD } = L.erf
  const zBegin = SCHUTTING_VAN_GEVEL
  // Hout-fotoset: de planken lopen in de foto langs u, dus horizontaal over de panelen
  // (1,2 m per herhaling) en met een kwartslag gedraaid verticaal over de palen.
  const fotoPaneel = useFotoTexturen('hout', [PANEEL_B / HOUT_HERHALING, PANEEL_H / HOUT_HERHALING])
  const fotoPaal = useFotoTexturen('hout', [PAAL / HOUT_HERHALING, PAAL_H / HOUT_HERHALING], [0, 0], Math.PI / 2)
  const terugval = useMemo(() => {
    const paneel = hout()
    paneel.repeat.set(PANEEL_B / HOUT_HERHALING, PANEEL_H / HOUT_HERHALING)
    const paal = hout()
    paal.center.set(0.5, 0.5)
    paal.rotation = Math.PI / 2
    paal.repeat.set(PAAL / HOUT_HERHALING, PAAL_H / HOUT_HERHALING)
    return { paneel, paal }
  }, [])
  useEffect(() => () => { terugval.paneel.dispose(); terugval.paal.dispose() }, [terugval])

  const gedeeld = { fotoPaneel, fotoPaal, terugval }
  return (
    <group>
      <Zijde zichtbaar={zijden.links}>
        <Hekzijde a={[-erfX, zBegin]} b={[-erfX, tuinD]} {...gedeeld} />
      </Zijde>
      <Zijde zichtbaar={zijden.rechts}>
        <Hekzijde a={[erfX, zBegin]} b={[erfX, tuinD]} {...gedeeld} />
      </Zijde>
      <Zijde zichtbaar={zijden.achter}>
        {/* Tussen de binnenvlakken van de twee hoekpalen, zonder eigen eindpalen. */}
        <Hekzijde a={[-erfX + PAAL / 2, tuinD]} b={[erfX - PAAL / 2, tuinD]} paalBegin={false} paalEind={false} {...gedeeld} />
      </Zijde>
    </group>
  )
}

// ── Borders en pad ─────────────────────────────────────────────────────────────
function Borders({ indeling }) {
  return indeling.borders.map(([x0, x1, z0, z1], i) => (
    <mesh key={i} position={[(x0 + x1) / 2, -0.004, (z0 + z1) / 2]} receiveShadow>
      <boxGeometry args={[x1 - x0, 0.02, z1 - z0]} />
      <meshStandardMaterial color={GROND} roughness={1} onBeforeCompile={natShader(false)} customProgramCacheKey={natKeyFn(false)} />
    </mesh>
  ))
}

// Kinderkopjespad als één L-vormige ShapeGeometry (uv in meters, dus één vaste herhaling van
// 0,72 m); op desktop met plassen bij regen.
function Pad({ indeling, hoog }) {
  const { pad } = indeling
  const geom = useMemo(() => {
    // De vorm ligt in het lokale xy-vlak en wordt −90° om x gedraaid: lokale y → wereld −z.
    const P = (x, z) => [x, -z]
    const s = new THREE.Shape()
    s.moveTo(...P(pad.x0, pad.z0))
    s.lineTo(...P(pad.x1, pad.z0))
    s.lineTo(...P(pad.x1, pad.z1))
    s.lineTo(...P(pad.x0Smal, pad.z1))
    s.lineTo(...P(pad.x0Smal, pad.zKnik))
    s.lineTo(...P(pad.x0, pad.zKnik))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [pad.x0, pad.x1, pad.x0Smal, pad.z0, pad.z1, pad.zKnik])
  useEffect(() => () => geom.dispose(), [geom])

  const keien = useMemo(() => {
    const k = kinderkopjes()
    k.map.repeat.set(1 / KEIEN, 1 / KEIEN)
    k.normalMap.repeat.set(1 / KEIEN, 1 / KEIEN)
    return k
  }, [])
  useEffect(() => () => { keien.map.dispose(); keien.normalMap.dispose() }, [keien])

  const plassen = !!hoog
  return (
    <mesh geometry={geom} rotation={[-Math.PI / 2, 0, 0]} position={[0, PAD_Y, 0]} receiveShadow>
      {/* key: andere shadervariant (plassen) vraagt een nieuw materiaal. */}
      <meshStandardMaterial key={`pad-${plassen ? 1 : 0}`} map={keien.map} normalMap={keien.normalMap} normalScale={[0.9, 0.9]} roughness={0.8}
        onBeforeCompile={natShader(plassen)} customProgramCacheKey={natKeyFn(plassen)} />
    </mesh>
  )
}

// ── Gevallen bladeren ──────────────────────────────────────────────────────────
// Alphamasker 32 × 32 met één bladvorm (punt naar boven), voor alphaTest 0.5.
function bladMasker() {
  return canvasTex(32, 32, (g, w, h) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(16, 1)
    g.bezierCurveTo(30, 8, 29, 25, 16, 31)
    g.bezierCurveTo(3, 25, 2, 8, 16, 1)
    g.closePath()
    g.fill()
  }, { srgb: false })
}

function Bladeren({ L, indeling, aantal }) {
  const mesh = useRef()
  const masker = useMemo(() => bladMasker(), [])
  const geom = useMemo(() => new THREE.PlaneGeometry(0.06, 0.09), [])
  useEffect(() => () => { masker.dispose(); geom.dispose() }, [masker, geom])

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const r = rng(67)
    const { erfX, tuinD, terras } = indeling
    // Vrij gazon: niet op het pad (links), niet in de borders (rechts/achter), niet tegen de gevel.
    const xMin = -erfX + PAD_VAN_SCHUTTING + PAD_B + 0.15, xMax = erfX - BORDER_B - 0.1
    const zMin = L.vrijstaand ? -2.5 : 0.7, zMax = tuinD - BORDER_B - 0.1
    const opTerras = (x, z) => x > terras.x0 - 0.15 && x < terras.x1 + 0.15 && z > terras.z0 - 0.15 && z < terras.z1 + 0.15
    const M = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion()
    const plat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
    const draai = new THREE.Quaternion(), as = new THREE.Vector3(0, 1, 0), kleur = new THREE.Color()
    const opTerrasN = aantal >= 60 ? 7 : 4
    let n = 0
    const zet = (x, y, z) => {
      p.set(x, y, z)
      draai.setFromAxisAngle(as, r() * Math.PI * 2)
      q.copy(draai).multiply(plat)
      const schaal = 0.7 + r() * 0.6
      s.set(schaal, schaal, schaal)
      m.setMatrixAt(n, M.compose(p, q, s))
      kleur.set(BLAD_KLEUREN[(r() * BLAD_KLEUREN.length) | 0]).multiplyScalar(0.85 + r() * 0.25)
      m.setColorAt(n, kleur)
      n++
    }
    for (let pogingen = 0; n < aantal - opTerrasN && pogingen < aantal * 8; pogingen++) {
      const x = xMin + r() * (xMax - xMin), z = zMin + r() * (zMax - zMin)
      if (opTerras(x, z)) continue
      zet(x, BLAD_Y, z)
    }
    // Een paar op het terras zelf (door de wind onder de veranda gewaaid).
    for (let k = 0; k < opTerrasN; k++) {
      zet(terras.x0 + 0.2 + r() * (terras.x1 - terras.x0 - 0.4), L.vloerY + 0.004, terras.z0 + 0.3 + r() * (terras.z1 - terras.z0 - 0.6))
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [aantal, indeling, L.vloerY, L.vrijstaand])

  return (
    <instancedMesh ref={mesh} args={[geom, undefined, aantal]} receiveShadow>
      <meshStandardMaterial roughness={1} side={THREE.DoubleSide} alphaMap={masker} alphaTest={0.5}
        onBeforeCompile={natShader(false)} customProgramCacheKey={natKeyFn(false)} />
    </instancedMesh>
  )
}

// ── Rekwisieten (GLB-modellen) ─────────────────────────────────────────────────
// Elk model in een eigen Suspense binnen een Foutgrens: een mislukte lading verbergt alleen dat model.
function Rekwisiet({ id, zijde, ...props }) {
  return (
    <Foutgrens naam={`Rekwisiet ${props.naam}`}>
      <Suspense fallback={null}>
        <Model {...props} />
      </Suspense>
    </Foutgrens>
  )
}

// Plaatsing van alle rekwisieten voor dit niveau. `nabij` is de set voor modellen dicht bij de
// veranda; modellen ver weg (bomen achter de schutting, struiken achterin) nemen altijd de
// laag-set — op 8–15 m zijn 512 px-texturen niet van 1024 px te onderscheiden, en zo blijft de
// desktop onder 300k driehoeken en 9 MB. Bomen horen bij de schuttingzijde waarachter ze staan
// (zelfde zichtbaarheidsregel), anders staan ze vanaf de zijstandpunten vóór de camera.
function plaatsing(L, indeling, niveau, meubels, nabij) {
  const { erfX, tuinD } = indeling
  const { W, D, vloerY } = L
  const r = rng(5)
  const items = []
  const voeg = (naam, position, { s = 1, yaw = r() * Math.PI * 2, set = nabij, schaduw = niveau.schaduwPlanten, zijde = null } = {}) =>
    items.push({ id: `${naam}-${items.length}`, naam, set, position, rotation: [0, yaw, 0], scale: s, schaduw, zijde })

  // Struiken in de borders, op volgorde van zichtbaarheid vanaf de fotostand (mobiel: de eerste drie).
  const struiken = [
    ['struik_groot', [erfX - 0.55, 0, 1.2], { s: 0.95 }],                   // rechts naast het terras, achter de staanderlijn (vrij van het afvoerstandpunt)
    ['struik_klein', [-erfX + 0.55, 0, D + 2.6], { s: 1.05 }],               // links in de border, onder de verhoogde afvoercamera (niet op de zichtlijn)
    ['struik_groot', [-1.8, 0, tuinD - 0.6], { s: 1.0, set: 'laag' }],       // achterborder links van het bankje
    ['struik_klein', [erfX - 0.5, 0, D + 5.0], { s: 0.85, set: 'laag' }],    // rechts, voorbij de bistroset
    ['struik_groot', [-erfX + 0.5, 0, D + 3.2], { s: 0.9, set: 'laag' }],    // links, midden
    ['struik_klein', [2.7, 0, tuinD - 0.6], { s: 1.0, set: 'laag' }],        // achterborder rechts van het bankje
    ['struik_klein', [-erfX + 0.6, 0, D + 5.6], { s: 0.8, set: 'laag' }],    // links, achter
  ]
  for (const [naam, pos, opties] of struiken.slice(0, niveau.struiken)) voeg(naam, pos, opties)

  // Bomen achter de schuttingen (stamvoet op de oorsprong, kroon hangt naar +z).
  const bomen = [
    ['boom_loofboom', [-erfX - 2.8, 0, D + 2.0], { s: 1.35, yaw: 0.6, zijde: 'links' }],
    ['boom_loofboom', [erfX + 2.4, 0, D + 5.5], { s: 1.1, yaw: 2.4, zijde: 'rechts' }],
    ['boom_loofboom', [-0.8, 0, tuinD + 3.2], { s: 1.45, yaw: 4.1, zijde: 'achter' }],
  ]
  for (const [naam, pos, opties] of bomen.slice(0, niveau.bomen)) voeg(naam, pos, { ...opties, set: 'laag' })

  // Potplanten op het terras (bij de meubels), in de achterhoeken bij de gevel: zo staan ze nooit
  // vóór de staandervoet of de uitloop in het (verhoogde) afvoerstandpunt, dat schuin van voren
  // op een voorstaander kijkt. De hoge plant links achter het kleed en de linker bijzettafel
  // (positie uit de meubelindeling, minstens 0,4 m van de gevel); de terracottapot rechts achter.
  if (meubels) {
    const ind = meubelIndeling(L)
    const tafelZ = ind.bijzettafels[0] ? ind.bijzettafels[0].z - ind.bijzettafels[0].maat / 2 : Infinity
    const zHoog = Math.max(0.4, Math.min(ind.kleed.z - ind.kleed.d / 2, tafelZ) - 0.35)
    const potten = {
      potplant_hoog: [[-W / 2 + 0.55, vloerY, zHoog], { yaw: 0.4 }],
      potplant_terracotta: [[W / 2 - 0.6, vloerY, 0.75], { s: 1.25, yaw: 2.6 }],
    }
    for (const naam of niveau.potten) if (potten[naam]) voeg(naam, ...potten[naam])
  }

  // Tuinmeubilair: altijd met schaduw (weinig driehoeken).
  if (niveau.bistro) voeg('tuinset_bistro', [erfX - 1.5, 0, D + 3.2], { yaw: -0.5, schaduw: true })
  if (niveau.bank) voeg('tuinbank_hout', [1.2, 0, tuinD - 0.6], { yaw: Math.PI, schaduw: true })
  // Plantenbakken in de rechter border, vanaf 2 m voorbij de voorstaanders: de verhoogde
  // afvoercamera staat op ±3,4 m vóór de staander en kijkt 29° omlaag, zodat de bakken onder
  // de onderrand van het beeld blijven in plaats van vóór de staandervoet te staan.
  for (let i = 0; i < niveau.plantenbakken; i++) {
    const z = D + 2.0 + i * 1.1
    voeg('plantenbak_hout', [erfX - 0.45, 0, z], { yaw: Math.PI / 2, schaduw: true })
    voeg('struik_laag', [erfX - 0.45, 0.35, z], { s: 0.9, set: 'laag' })
  }
  return items
}

function Rekwisieten({ L, indeling, niveau, meubels, hoog, zijden }) {
  const nabij = hoog ? REKWISIETEN.set : 'laag'
  const items = useMemo(() => plaatsing(L, indeling, niveau, meubels, nabij), [L, indeling, niveau, meubels, nabij])

  // Opruimen: modellen die na een niveau- of meubelwissel niet meer in gebruik zijn, en alles bij
  // unmount. Het verschil wordt bepaald zodat een model dat in beide niveaus voorkomt blijft staan.
  const inGebruik = useRef(new Set())
  useEffect(() => {
    const nu = new Set(items.map(i => modelUrl(i.naam, i.set)))
    const weg = [...inGebruik.current].filter(u => !nu.has(u))
    if (weg.length) ruimOp(weg)
    inGebruik.current = nu
  }, [items])
  useEffect(() => () => {
    ruimOp([...inGebruik.current])
    inGebruik.current = new Set()
  }, [])

  return (
    <group>
      {items.filter(i => !i.zijde).map(i => <Rekwisiet key={i.id} {...i} />)}
      {['links', 'rechts', 'achter'].map(zijde => (
        <Zijde key={zijde} zichtbaar={zijden[zijde]}>
          {items.filter(i => i.zijde === zijde).map(i => <Rekwisiet key={i.id} {...i} />)}
        </Zijde>
      ))}
    </group>
  )
}

// Zonder `hoog` (mobiel, of desktop na een PerformanceMonitor-terugval) de kleine set.
function verlaag(n) {
  return {
    ...n, set: 'laag',
    bomen: Math.min(n.bomen, 1), struiken: Math.min(n.struiken, 3), potten: n.potten.slice(-1),
    bistro: false, plantenbakken: Math.min(n.plantenbakken, 1), schaduwPlanten: false,
    bladeren: Math.min(n.bladeren, 40),
  }
}

// ── Erf ────────────────────────────────────────────────────────────────────────
export function Erf({ L, hoog = !MOBIEL, meubels = true, laadRekwisieten = true }) {
  const indeling = useMemo(() => erfIndeling(L), [L])
  const niveau = useMemo(() => (hoog ? REKWISIETEN : verlaag(REKWISIETEN)), [hoog])
  const { erfX, tuinD } = indeling
  const zijden = useMemo(() => ({
    links: p => p.x > -erfX + 0.2,
    rechts: p => p.x < erfX - 0.2,
    achter: p => p.z < tuinD - 0.2,
  }), [erfX, tuinD])

  return (
    <group>
      <Schutting L={L} zijden={zijden} />
      <Borders indeling={indeling} />
      <Pad indeling={indeling} hoog={hoog} />
      <Bladeren L={L} indeling={indeling} aantal={niveau.bladeren} />
      {laadRekwisieten && <Rekwisieten L={L} indeling={indeling} niveau={niveau} meubels={meubels} hoog={hoog} zijden={zijden} />}
    </group>
  )
}

export default Erf
