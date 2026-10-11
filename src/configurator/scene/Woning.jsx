// Woning achter de veranda (alleen bij een aanbouw): de hoofdwoning met twee schuifpuien
// en drie grote ramen in een gevel met échte openingen, een zichtbaar interieur (overdag
// donker, 's avonds verlicht), twee buurpanden onder één doorlopend zadeldak en de
// hemelwaterafvoer van de woning zelf. Breedte uit L.erf; alle maten in meters.
//
// Assen: x = breedte (0 = midden van de veranda), y = omhoog, z = diepte; het gevelvlak
// van de hoofdwoning ligt op z = 0, de woning strekt zich uit naar −z.
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { baksteen, hout } from './textures.js'
import { useFotoTexturen, FotoMateriaal } from './fotoTexturen.js'
import { useMat } from './materials.js'

// LTC-tabellen voor rectAreaLight (het licht uit de pui op het terras). Idempotent en op
// moduleniveau, zodat het niet van de importvolgorde of van Licht.jsx afhangt.
if (!THREE.UniformsLib.LTC_FLOAT_1) RectAreaLightUniformsLib.init()

const WIT = '#ecebe6'          // boeiboord, windveren, dakonderkant
const KOZIJN = '#34393c'       // RAL 7016, dezelfde tint als het standaardframe
const KOZIJN_WIT = '#f1f0ea'   // witte kozijnen van het rechter buurpand
const PLINT = '#6a6460'
const DORPEL = '#d9d6cf'
const LATEI = '#4a4a4a'
const ZINK = '#6b6e70'         // goot en regenpijp
const WAND = '#d8d2c8'         // kamerwanden
const PLAFOND = '#f4f2ee'
const LAMP = '#ffd9a8'         // warme kamerverlichting 's avonds

const DIEP = 9                 // diepte van de panden
const BUUR_B = 5.4             // breedte van een buurpand
const TERUG_LINKS = 0.25       // het linker buurpand ligt zoveel terug
const GEVEL_D = 0.3            // dikte van de gevelplaat = diepte van de dagkanten
const STEEN = 1.4              // 1 herhaling van de baksteenfoto (Poly Haven "Red Brick")
const PUI_H = 2.3
const RAAM_B = 1.6, RAAM_H = 1.4
const KAMER_D = 3.5, KAMER_H = 2.6
const KOZIJN_B = 0.06, KOZIJN_D = 0.07
const NOK_H = 3.4, OVERSTEK = 0.4, DAK_DIKTE = 0.05

// Interieurmaterialen: overdag gedempt, zodat de kamers achter het glas donker lezen (de
// 'camera' staat op de buitenwereld belicht, zoals in ref1), 's avonds ongedempt zodat de
// lampen de kamer vullen. Alleen het belichte deel wordt gedempt, emissie niet. Eén
// gedeelde uniform voor alle interieurmaterialen; Panden zet hem synchroon per render.
const DEMP_DAG = 0.22
const INTERIEUR_DEMP = { value: DEMP_DAG }
const dempShader = shader => {
  shader.uniforms.uDemp = INTERIEUR_DEMP
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uDemp;')
    .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
      'vec3 outgoingLight = ( totalDiffuse + totalSpecular ) * uDemp + totalEmissiveRadiance;')
}
const dempKey = () => 'interieur-demp'
const DEMP = { onBeforeCompile: dempShader, customProgramCacheKey: dempKey }

function useGeometrie(maak, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(maak, deps)
  useEffect(() => () => g.dispose(), [g])
  return g
}

// Gevelvlak met echte openingen: een geëxtrudeerde plaat (dikte GEVEL_D) met gaten voor
// puien en ramen. De uv van de kappen is in meters (shape-coördinaten = wereld-x/y), zodat
// de baksteen naadloos over aangrenzende panden doorloopt en de dagkanten mee-getextureerd
// zijn. Openingen: [xMidden, yOnder, breedte, hoogte].
// Materiaalgroepen: 0 = buitenkant, 1 = dagkanten, 2 = binnenkant (zichtbaar vanuit het
// 'achter'-standpunt, waar de camera in de woning staat).
function gevelGeometrie(x0, x1, hoogte, openingen) {
  // De plaat begint 5 cm onder het maaiveld (onzichtbaar onder terras en gazon), zodat de
  // pui-openingen op y = 0 de contour niet raken (anders ontaarde driehoeken).
  const s = new THREE.Shape()
  s.moveTo(x0, -0.05); s.lineTo(x1, -0.05); s.lineTo(x1, hoogte); s.lineTo(x0, hoogte); s.lineTo(x0, -0.05)
  for (const [x, y, b, h] of openingen) {
    const p = new THREE.Path()
    p.moveTo(x - b / 2, y); p.lineTo(x + b / 2, y); p.lineTo(x + b / 2, y + h); p.lineTo(x - b / 2, y + h); p.lineTo(x - b / 2, y)
    s.holes.push(p)
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: GEVEL_D, bevelEnabled: false })
  g.translate(0, 0, -GEVEL_D) // buitenkant op z = 0, de plaat loopt naar −z
  // ExtrudeGeometry zet beide kappen in één groep (eerst de achterkant op z = 0, dan de
  // voorkant op z = depth); gesplitst zodat de binnenkant een eigen materiaal krijgt.
  const [kap, zij] = g.groups
  const half = kap.count / 2
  g.clearGroups()
  g.addGroup(kap.start + half, half, 0)
  g.addGroup(zij.start, zij.count, 1)
  g.addGroup(kap.start, half, 2)
  return g
}

// Kozijn als één geëxtrudeerd raamwerk (buitenmaat b × h, profiel `dikte`, diepte `diepte`),
// gecentreerd op de oorsprong.
function kozijnGeometrie(b, h, dikte, diepte) {
  const s = new THREE.Shape()
  s.moveTo(-b / 2, -h / 2); s.lineTo(b / 2, -h / 2); s.lineTo(b / 2, h / 2); s.lineTo(-b / 2, h / 2); s.lineTo(-b / 2, -h / 2)
  const bi = b / 2 - dikte, hi = h / 2 - dikte
  const p = new THREE.Path()
  p.moveTo(-bi, -hi); p.lineTo(bi, -hi); p.lineTo(bi, hi); p.lineTo(-bi, hi); p.lineTo(-bi, -hi)
  s.holes.push(p)
  const g = new THREE.ExtrudeGeometry(s, { depth: diepte, bevelEnabled: false })
  g.translate(0, 0, -diepte / 2)
  return g
}

// Dakwig boven een pand: de muur loopt als vijfhoek door tot 1 cm onder de dakvlakken,
// zodat er onder de overstek geen kier zit. Breedte [xVan, xTot]; zVoor = gevelvlak van
// het pand (0, of −TERUG_LINKS bij het terugliggende buurpand). De nok ligt op z = −DIEP/2.
// Na rotatie [0, π/2, 0]: shape-x → wereld −z (t.o.v. de nok), extrusie → wereld x.
function wigGeometrie(xVan, xTot, zVoor, run) {
  const dakOnder = sx => NOK_H * (1 - Math.abs(sx) / run) - 0.01
  const sVoor = -zVoor - DIEP / 2, sAchter = DIEP / 2
  const s = new THREE.Shape()
  s.moveTo(sVoor, 0)
  s.lineTo(sAchter, 0)
  s.lineTo(sAchter, dakOnder(sAchter))
  s.lineTo(0, NOK_H - 0.01)
  s.lineTo(sVoor, dakOnder(sVoor))
  s.lineTo(sVoor, 0)
  const g = new THREE.ExtrudeGeometry(s, { depth: xTot - xVan, bevelEnabled: false })
  g.translate(0, 0, xVan)
  return g
}

// Interieurbox achter een opening: BackSide zodat je van buiten de binnenkant van de
// wanden, het plafond en de vloer ziet. Het voorvlak is onzichtbaar, zodat het
// 'achter'-standpunt (camera in de woning) door de pui naar buiten kijkt. Overdag donker
// (lage envMapIntensity), 's avonds warm verlicht via `emissie`.
// `eenvoudig`: één materiaal voor alle vlakken (één draw call), voor de kleine kamers achter ramen.
function Kamerbox({ position, args, wand = WAND, plafond = PLAFOND, vloerKleur = '#a89b86', vloerFoto = null, vloerTerugval = null, envMap = 0.3, emissie = 0, eenvoudig = false }) {
  const basis = { side: THREE.BackSide, roughness: 0.9, envMapIntensity: envMap, emissive: LAMP, ...DEMP }
  if (eenvoudig) {
    return (
      <mesh position={position} renderOrder={1} receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial {...basis} color={wand} emissiveIntensity={emissie} />
      </mesh>
    )
  }
  return (
    <mesh position={position} renderOrder={1} receiveShadow>
      <boxGeometry args={args} />
      {[0, 1, 5].map(i => <meshStandardMaterial key={i} attach={`material-${i}`} {...basis} color={wand} emissiveIntensity={emissie} />)}
      <meshStandardMaterial attach="material-2" {...basis} color={plafond} emissiveIntensity={emissie * 1.3} />
      {vloerTerugval
        ? <FotoMateriaal attach="material-3" foto={vloerFoto} terugval={vloerTerugval} ao={0.5} roughness={0.7}
            envMapIntensity={envMap} side={THREE.BackSide} emissive={LAMP} emissiveIntensity={emissie * 0.6} {...DEMP} />
        : <meshStandardMaterial attach="material-3" {...basis} color={vloerKleur} emissiveIntensity={emissie * 0.6} />}
      <meshStandardMaterial attach="material-4" visible={false} />
    </mesh>
  )
}

// Raam in een opening b × h met het midden op [x, y] in het gevelvlak z: kozijn (één
// profiel), tussenstijl, dubbel glas met fresnel (mat.dubbelGlas), lekdorpel en latei;
// daarachter een kamerbox van 1 m diep die 5 cm ruimer is dan de opening (geen
// samenvallende vlakken met de dagkanten).
function Raam({ x, y, z = 0, b, h, kozijn = KOZIJN, stijl = true, dorpel = true, latei = true, glas, kamer }) {
  // Kozijn en tussenstijl samengevoegd tot één geometrie (één draw call per raam).
  const kg = useGeometrie(() => {
    const k = kozijnGeometrie(b, h, KOZIJN_B, KOZIJN_D)
    if (!stijl) return k
    const st = new THREE.BoxGeometry(KOZIJN_B, h - 2 * KOZIJN_B, KOZIJN_D).toNonIndexed()
    const g = mergeGeometries([k, st], false)
    k.dispose(); st.dispose()
    return g
  }, [b, h, stijl])
  const kleur = { color: kozijn, roughness: 0.5, metalness: 0.2 }
  return (
    <group position={[x, y, z]}>
      <mesh geometry={kg} position={[0, 0, -KOZIJN_D / 2]} castShadow><meshStandardMaterial {...kleur} /></mesh>
      <mesh position={[0, 0, -KOZIJN_D / 2]} renderOrder={3} material={glas}><boxGeometry args={[b - 2 * KOZIJN_B, h - 2 * KOZIJN_B, 0.01]} /></mesh>
      {dorpel && (
        <mesh position={[0, -h / 2 - 0.03, 0.08]} castShadow><boxGeometry args={[b + 0.12, 0.06, 0.16]} /><meshStandardMaterial color={DORPEL} roughness={0.6} /></mesh>
      )}
      {latei && (
        <mesh position={[0, h / 2 + 0.05, 0.02]} castShadow><boxGeometry args={[b + 0.12, 0.10, 0.04]} /><meshStandardMaterial color={LATEI} roughness={0.7} metalness={0.3} /></mesh>
      )}
      <Kamerbox position={[0, 0, -0.05 - 0.5]} args={[b + 0.1, h + 0.1, 1.0]} eenvoudig {...kamer} />
    </group>
  )
}

// Schuifpui van b × PUI_H met de onderkant op y = 0: kozijn 0,06 × 0,07 in de opening en
// twee vleugels met eigen profiel in twee sporen (vast + schuivend), elkaar 6 cm overlappend
// als middenstijl. Glas = dubbel glas met fresnel, zodat je het interieur erachter ziet.
function Pui({ x, b, glas }) {
  const kg = useGeometrie(() => kozijnGeometrie(b, PUI_H, KOZIJN_B, KOZIJN_D), [b])
  const bv = (b - 2 * KOZIJN_B) / 2 + 0.03, hv = PUI_H - 2 * KOZIJN_B
  const vg = useGeometrie(() => kozijnGeometrie(bv, hv, 0.045, 0.03), [bv, hv])
  const kleur = { color: KOZIJN, roughness: 0.5, metalness: 0.2 }
  return (
    <group position={[x, PUI_H / 2, 0]}>
      <mesh geometry={kg} position={[0, 0, -KOZIJN_D / 2]} castShadow><meshStandardMaterial {...kleur} /></mesh>
      {/* Linker vleugel in het buitenspoor, rechter in het binnenspoor */}
      {[[-1, -0.02], [1, -0.05]].map(([s, z]) => (
        <group key={s} position={[s * (b / 2 - KOZIJN_B - bv / 2), 0, z]}>
          <mesh geometry={vg}><meshStandardMaterial {...kleur} /></mesh>
          <mesh renderOrder={3} material={glas}><boxGeometry args={[bv - 0.09, hv - 0.09, 0.012]} /></mesh>
        </group>
      ))}
    </group>
  )
}

// Woonkamer achter een pui: kamerbox met houten vloer, loungebank met rugkussens,
// vloerkleed, bijzettafel en een hanglamp; 's avonds één pointLight per kamer.
function Kamer({ x, b, nacht, vloerFoto, vloerTerugval }) {
  const z0 = -0.05
  const zBank = z0 - 1.2 - 0.4
  return (
    <group position={[x, 0, 0]}>
      <Kamerbox position={[0, KAMER_H / 2 - 0.01, z0 - KAMER_D / 2]} args={[b + 0.4, KAMER_H + 0.01, KAMER_D]}
        vloerFoto={vloerFoto} vloerTerugval={vloerTerugval} emissie={nacht ? 0.15 : 0} />
      <mesh position={[0, 0.002, zBank + 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[2.6, 1.9]} />
        <meshStandardMaterial color="#8d8679" roughness={1} envMapIntensity={0.3} {...DEMP} />
      </mesh>
      <RoundedBox args={[1.8, 0.45, 0.8]} radius={0.04} smoothness={3} position={[0, 0.225, zBank]} castShadow receiveShadow>
        <meshStandardMaterial color="#5a5f66" roughness={0.85} envMapIntensity={0.3} {...DEMP} />
      </RoundedBox>
      <RoundedBox args={[1.8, 0.4, 0.18]} radius={0.05} smoothness={3} position={[0, 0.65, zBank - 0.31]} castShadow>
        <meshStandardMaterial color="#5a5f66" roughness={0.85} envMapIntensity={0.3} {...DEMP} />
      </RoundedBox>
      {[-0.45, 0.45].map(dx => (
        <RoundedBox key={dx} args={[0.5, 0.42, 0.12]} radius={0.05} smoothness={3} position={[dx, 0.68, zBank - 0.2]} rotation={[-0.15, 0, 0]} castShadow>
          <meshStandardMaterial color="#cfc6b4" roughness={1} envMapIntensity={0.3} {...DEMP} />
        </RoundedBox>
      ))}
      <group position={[b / 2 + 0.75, 0, zBank]}>
        <mesh position={[0, 0.44, 0]} castShadow><cylinderGeometry args={[0.25, 0.25, 0.025, 24]} /><meshStandardMaterial color="#3a3a3c" roughness={0.5} metalness={0.3} {...DEMP} /></mesh>
        <mesh position={[0, 0.215, 0]}><cylinderGeometry args={[0.025, 0.04, 0.43, 12]} /><meshStandardMaterial color="#3a3a3c" roughness={0.5} metalness={0.3} {...DEMP} /></mesh>
      </group>
      {/* Hanglamp boven de zithoek; 's avonds de lichtbron van de kamer */}
      <mesh position={[0, 2.25, zBank + 0.2]}>
        <sphereGeometry args={[0.13, 20, 14]} />
        <meshStandardMaterial color="#efe9dc" roughness={0.6} emissive="#ffe3b8" emissiveIntensity={nacht ? 4 : 0} envMapIntensity={0.3} {...DEMP} />
      </mesh>
      <mesh position={[0, 2.5, zBank + 0.2]}><cylinderGeometry args={[0.006, 0.006, 0.3, 6]} /><meshStandardMaterial color="#2a2a2c" {...DEMP} /></mesh>
      {nacht && <pointLight color="#ffd9a0" intensity={2.5} distance={7} decay={2} position={[0, 2.4, zBank + 0.2]} />}
    </group>
  )
}

// Rechte buis tussen twee punten (regenpijp, zwanenhals).
function Buis({ van, naar, r = 0.04, kleur = ZINK }) {
  const { midden, q, l } = useMemo(() => {
    const a = new THREE.Vector3(...van), b = new THREE.Vector3(...naar)
    const richting = b.clone().sub(a)
    return {
      l: richting.length(),
      midden: a.clone().add(b).multiplyScalar(0.5),
      q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richting.normalize()),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...van, ...naar])
  return (
    <mesh position={midden} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, l, 12]} />
      <meshStandardMaterial color={kleur} roughness={0.55} metalness={0.3} />
    </mesh>
  )
}

// Hemelwaterafvoer van de woning: regenpijp Ø 0,08 tegen de gevel met zwanenhals vanaf de
// goot en een beugel om de 2 m.
function Regenpijp({ x, goot, zGoot }) {
  const yTop = goot - 0.55
  const beugels = useMemo(() => {
    const ys = []
    for (let y = 0.5; y < yTop - 0.3; y += 2) ys.push(y)
    return ys
  }, [yTop])
  return (
    <group>
      <Buis van={[x, 0.3, 0.06]} naar={[x, yTop, 0.06]} />
      <Buis van={[x, yTop - 0.02, 0.06]} naar={[x, goot - 0.16, zGoot]} />
      <Buis van={[x, goot - 0.17, zGoot]} naar={[x, goot - 0.06, zGoot]} />
      {beugels.map(y => (
        <mesh key={y} position={[x, y, 0.045]} castShadow>
          <boxGeometry args={[0.12, 0.03, 0.09]} />
          <meshStandardMaterial color={ZINK} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// Plintsegmenten (trasraam) langs de voet van een gevel, met uitsparingen voor openingen
// die tot de grond lopen. segmenten = [[x0, x1], ...].
function Plint({ segmenten, z }) {
  return segmenten.filter(([x0, x1]) => x1 - x0 > 0.01).map(([x0, x1]) => (
    <mesh key={`${x0}-${x1}`} position={[(x0 + x1) / 2, 0.25, z + 0.01]} receiveShadow>
      <boxGeometry args={[x1 - x0, 0.5, 0.02]} />
      <meshStandardMaterial color={PLINT} roughness={0.95} />
    </mesh>
  ))
}

function Panden({ L, nacht, hoog }) {
  const mat = useMat()
  // Terugval als de component buiten MetMaterialen wordt gebruikt.
  const terugvalGlas = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#cde0dc', roughness: 0.03, transparent: true, opacity: 0.2, depthWrite: false }), [])
  useEffect(() => () => terugvalGlas.dispose(), [terugvalGlas])
  const glas = mat?.dubbelGlas ?? terugvalGlas
  // Synchroon vóór de render (geen effect): 's avonds vullen de lampen de kamers.
  INTERIEUR_DEMP.value = nacht ? 1 : DEMP_DAG

  const hoofd = L.erf.hoofd
  const erfX = L.erf.erfX
  const goot = Math.max(L.yDakAchter + 2.9, 5.8)
  // Zadeldak met de nok evenwijdig aan de achtergevel en 40 cm overstek bij de goten.
  const run = DIEP / 2 + OVERSTEK
  const helling = Math.atan2(NOK_H, run)
  const dakL = Math.hypot(run, NOK_H) + 0.06
  const dakB = hoofd + 2 * BUUR_B + 0.3
  const zGoot = OVERSTEK + 0.03 + 0.02 + 0.06 // hart van de goot vóór het boeiboord

  // Puien: twee sets over de verandabreedte met een penant van 0,6 m ertussen.
  const b = Math.min(2.4, (L.W - 0.6) / 2 - 0.1)
  const xPui = b / 2 + 0.3
  // Verdieping: drie ramen, onderkant 2,6 m onder de goot.
  const xRaam = Math.min(hoofd / 2 - 1.3, 2.6)
  const yRaam = goot - 2.6 + RAAM_H / 2
  const xLinks = -erfX - BUUR_B / 2, xRechts = erfX + BUUR_B / 2
  const yRaamBeneden = 0.95 + 1.2 / 2

  // Foto-texturen (baksteen 1,4 m, dakpannen 2,4 × 1,8 m, eiken 1,2 m per herhaling).
  const gevel = useFotoTexturen('baksteen', [1 / STEEN, 1 / STEEN])
  const zijgevel = useFotoTexturen('baksteen', [DIEP / STEEN, goot / STEEN])
  // uv van de dakwig begint op goothoogte: verschoven zodat de lagen doorlopen.
  const topgevel = useFotoTexturen('baksteen', [1 / STEEN, 1 / STEEN], [0, (goot / STEEN) % 1])
  const pannen = useFotoTexturen('dakpannen', [dakB / 2.4, dakL / 1.8])
  const vloerHout = useFotoTexturen('hout', [(b + 0.4) / 1.2, KAMER_D / 1.2])
  // Wit geschilderd metselwerk: alleen het reliëf van de baksteen.
  const witReliëf = useMemo(() => gevel && { normalMap: gevel.normalMap }, [gevel])
  const witReliëfZij = useMemo(() => zijgevel && { normalMap: zijgevel.normalMap }, [zijgevel])

  // Procedurele terugval zolang de foto's laden: één set in meters (geëxtrudeerde vlakken)
  // en een kloon voor de boxvlakken van de zijgevels.
  const steen = useMemo(() => {
    const s = baksteen()
    s.map.repeat.set(1 / 0.88, 1 / 0.9)
    s.normalMap.repeat.copy(s.map.repeat)
    const zijMap = s.map.clone(), zijNormal = s.normalMap.clone()
    zijMap.repeat.set(DIEP / 0.88, goot / 0.9)
    zijNormal.repeat.copy(zijMap.repeat)
    return { ...s, zijMap, zijNormal }
  }, [goot])
  useEffect(() => () => { steen.map.dispose(); steen.normalMap.dispose(); steen.zijMap.dispose(); steen.zijNormal.dispose() }, [steen])
  const steenTerugval = { map: steen.map, normalMap: steen.normalMap, normalScale: [0.7, 0.7], roughness: 0.92 }
  const steenTerugvalZij = { map: steen.zijMap, normalMap: steen.zijNormal, normalScale: [0.7, 0.7], roughness: 0.92 }
  const houtTex = useMemo(() => { const t = hout(); t.repeat.set((b + 0.4) / 1.2, KAMER_D / 1.2); return t }, [b])
  useEffect(() => () => houtTex.dispose(), [houtTex])

  // Gevelplaten met openingen en de dakwiggen.
  const gevelHoofd = useGeometrie(() => gevelGeometrie(-hoofd / 2, hoofd / 2, goot, [
    [-xPui, 0, b, PUI_H], [xPui, 0, b, PUI_H],
    ...[-xRaam, 0, xRaam].map(x => [x, goot - 2.6, RAAM_B, RAAM_H]),
  ]), [hoofd, goot, xPui, b, xRaam])
  const buurOpeningen = xc => [[xc - 1.35, goot - 2.6, RAAM_B, RAAM_H], [xc + 1.35, goot - 2.6, RAAM_B, RAAM_H], [xc, 0.95, 1.4, 1.2]]
  const gevelLinks = useGeometrie(() => gevelGeometrie(-erfX - BUUR_B, -erfX, goot, buurOpeningen(xLinks)), [erfX, goot, xLinks])
  const gevelRechts = useGeometrie(() => gevelGeometrie(erfX, erfX + BUUR_B, goot, buurOpeningen(xRechts)), [erfX, goot, xRechts])
  const wigLinks = useGeometrie(() => wigGeometrie(-erfX - BUUR_B, -erfX, -TERUG_LINKS, run), [erfX, run])
  const wigRechts = useGeometrie(() => wigGeometrie(-erfX, erfX + BUUR_B, 0, run), [erfX, run])

  // Metselwerk-materialen: buitenkant (uv in meters), dagkanten en de binnenkant (stuc).
  const baksteenGevel = attach => <FotoMateriaal attach={attach} foto={gevel} terugval={steenTerugval} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
  const stuc = attach => <meshStandardMaterial attach={attach} color={WAND} roughness={0.9} envMapIntensity={0.3} {...DEMP} />
  const witMetselwerk = (reliëf, attach) => (
    <FotoMateriaal attach={attach} foto={reliëf} terugval={{}} color="#e8e4dc" roughness={0.95} normalScale={[0.5, 0.5]} nat="droog" />
  )
  const romp = { color: '#6d6a66', roughness: 1 }

  // Eén dakvlak in het assenstelsel met de nok boven de oorsprong; het achterste is gespiegeld.
  const n = [Math.cos(helling), Math.sin(helling)]
  const dakvlak = r => (
    <group key={r} rotation={[0, r, 0]}>
      <group position={[0, NOK_H / 2 + n[0] * DAK_DIKTE / 2, run / 2 + n[1] * DAK_DIKTE / 2]} rotation={[helling, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[dakB, DAK_DIKTE, dakL]} />
          <meshStandardMaterial attach="material-0" color="#5b3a2d" roughness={0.9} />
          <meshStandardMaterial attach="material-1" color="#5b3a2d" roughness={0.9} />
          <FotoMateriaal attach="material-2" foto={pannen} terugval={{ color: '#7a4434', roughness: 0.8 }} ao={0.9} nat="droog" />
          <meshStandardMaterial attach="material-3" color={WIT} roughness={0.8} />
          <meshStandardMaterial attach="material-4" color="#5b3a2d" roughness={0.9} />
          <meshStandardMaterial attach="material-5" color="#5b3a2d" roughness={0.9} />
        </mesh>
        {/* Witte windveren langs de topgevels aan de uiteinden */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * (dakB / 2 + 0.015), -0.07, 0]} castShadow>
            <boxGeometry args={[0.03, 0.22, dakL]} />
            <meshStandardMaterial color={WIT} roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* Boeiboord langs de onderkant van het dakvlak */}
      <mesh position={[0, -0.07, run + 0.03]} castShadow>
        <boxGeometry args={[dakB, 0.22, 0.04]} />
        <meshStandardMaterial color={WIT} roughness={0.6} />
      </mesh>
      {/* Zinken bakgoot aan de tuinzijde (halve buis, open naar boven) */}
      {r === 0 && (
        <mesh position={[0, -0.02, run + 0.11]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, dakB - 0.4, 14, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color={ZINK} roughness={0.5} metalness={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )

  const kamerLicht = { wand: '#e6e3dc', plafond: '#f1efe9', vloerKleur: '#a89b86', envMap: 0.3, emissie: nacht ? 1.0 : 0 }
  const kamerDonker = verlicht => ({ wand: '#2e3133', plafond: '#3a3c3e', vloerKleur: '#2a2c2e', envMap: 0.2, emissie: nacht && verlicht ? 0.9 : 0 })

  // Ramen van een buurpand: twee op de verdieping en één beneden; `verlicht` = welk raam
  // 's avonds licht toont.
  const buurRamen = (xc, z, kozijn, verlicht) => (
    <>
      <Raam x={xc - 1.35} y={yRaam} z={z} b={RAAM_B} h={RAAM_H} kozijn={kozijn} glas={glas} kamer={kamerDonker(verlicht === 0)} />
      <Raam x={xc + 1.35} y={yRaam} z={z} b={RAAM_B} h={RAAM_H} kozijn={kozijn} glas={glas} kamer={kamerDonker(verlicht === 1)} />
      <Raam x={xc} y={yRaamBeneden} z={z} b={1.4} h={1.2} kozijn={kozijn} glas={glas} kamer={kamerDonker(verlicht === 2)} />
    </>
  )

  return (
    <group>
      {/* ── Hoofdwoning ─────────────────────────────────────────────────────── */}
      <mesh geometry={gevelHoofd} castShadow receiveShadow>
        {baksteenGevel('material-0')}
        {baksteenGevel('material-1')}
        {stuc('material-2')}
      </mesh>
      {/* Romp achter de gevelplaat; het voorvlak is onzichtbaar (daar zitten de kamers). */}
      <mesh position={[0, goot / 2, -GEVEL_D - (DIEP - GEVEL_D) / 2]} castShadow receiveShadow>
        <boxGeometry args={[hoofd, goot, DIEP - GEVEL_D]} />
        <FotoMateriaal attach="material-0" foto={zijgevel} terugval={steenTerugvalZij} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
        <FotoMateriaal attach="material-1" foto={zijgevel} terugval={steenTerugvalZij} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
        <meshStandardMaterial attach="material-2" {...romp} />
        <meshStandardMaterial attach="material-3" {...romp} />
        <meshStandardMaterial attach="material-4" visible={false} />
        <meshStandardMaterial attach="material-5" color="#8c6b5a" roughness={1} />
      </mesh>
      <Plint z={0} segmenten={[[-hoofd / 2, -xPui - b / 2], [-0.3, 0.3], [xPui + b / 2, hoofd / 2]]} />

      {[-1, 1].map(s => (
        <group key={s}>
          <Pui x={s * xPui} b={b} glas={glas} />
          <Kamer x={s * xPui} b={b} nacht={nacht} vloerFoto={vloerHout} vloerTerugval={{ map: houtTex, roughness: 0.7 }} />
        </group>
      ))}
      {/* Licht uit de pui op het terras ('s avonds, alleen desktop). */}
      {hoog && nacht && <rectAreaLight args={['#ffd9a0', 2, 2 * b + 0.6, PUI_H - 0.02]} position={[0, PUI_H / 2 + 0.05, 0.08]} rotation={[0, Math.PI, 0]} />}

      {[-xRaam, 0, xRaam].map(x => (
        <Raam key={x} x={x} y={yRaam} b={RAAM_B} h={RAAM_H} glas={glas} kamer={kamerLicht} />
      ))}
      <Regenpijp x={hoofd / 2 - 0.35} goot={goot} zGoot={zGoot} />

      {/* ── Linker buurpand: wit geschilderd metselwerk, 25 cm terugliggend ──── */}
      <group position={[0, 0, -TERUG_LINKS]}>
        <mesh geometry={gevelLinks} castShadow receiveShadow>
          {witMetselwerk(witReliëf, 'material-0')}
          {witMetselwerk(witReliëf, 'material-1')}
          {stuc('material-2')}
        </mesh>
        <mesh position={[xLinks, goot / 2, -GEVEL_D - (DIEP - TERUG_LINKS - GEVEL_D) / 2]} castShadow receiveShadow>
          <boxGeometry args={[BUUR_B, goot, DIEP - TERUG_LINKS - GEVEL_D]} />
          {witMetselwerk(witReliëfZij, 'material-0')}
          {witMetselwerk(witReliëfZij, 'material-1')}
          <meshStandardMaterial attach="material-2" {...romp} />
          <meshStandardMaterial attach="material-3" {...romp} />
          <meshStandardMaterial attach="material-4" visible={false} />
          <meshStandardMaterial attach="material-5" color="#d9d5cc" roughness={1} />
        </mesh>
        <Plint z={0} segmenten={[[-erfX - BUUR_B, -erfX]]} />
        {buurRamen(xLinks, 0, KOZIJN, 2)}
      </group>

      {/* ── Rechter buurpand: baksteen in hetzelfde vlak, witte kozijnen ───── */}
      <mesh geometry={gevelRechts} castShadow receiveShadow>
        {baksteenGevel('material-0')}
        {baksteenGevel('material-1')}
        {stuc('material-2')}
      </mesh>
      <mesh position={[xRechts, goot / 2, -GEVEL_D - (DIEP - GEVEL_D) / 2]} castShadow receiveShadow>
        <boxGeometry args={[BUUR_B, goot, DIEP - GEVEL_D]} />
        <FotoMateriaal attach="material-0" foto={zijgevel} terugval={steenTerugvalZij} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
        <meshStandardMaterial attach="material-1" color="#8c6b5a" roughness={1} />
        <meshStandardMaterial attach="material-2" {...romp} />
        <meshStandardMaterial attach="material-3" {...romp} />
        <meshStandardMaterial attach="material-4" visible={false} />
        <meshStandardMaterial attach="material-5" color="#8c6b5a" roughness={1} />
      </mesh>
      <Plint z={0} segmenten={[[erfX, erfX + BUUR_B]]} />
      {buurRamen(xRechts, 0, KOZIJN_WIT, 0)}

      {/* ── Eén doorlopend zadeldak over de drie panden ─────────────────────── */}
      <group position={[0, goot, -DIEP / 2]}>
        <mesh rotation={[0, Math.PI / 2, 0]} geometry={wigLinks} castShadow receiveShadow>
          {witMetselwerk(witReliëf, 'material-0')}
          {witMetselwerk(witReliëf, 'material-1')}
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} geometry={wigRechts} castShadow receiveShadow>
          <FotoMateriaal attach="material-0" foto={topgevel} terugval={steenTerugval} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
          <FotoMateriaal attach="material-1" foto={gevel} terugval={steenTerugval} normalScale={[0.7, 0.7]} ao={0.6} nat="droog" />
        </mesh>
        {[0, Math.PI].map(dakvlak)}
        {/* Nokvorst */}
        <mesh position={[0, NOK_H + DAK_DIKTE * 0.6, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, dakB, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#7d4636" roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* Schoorsteen op de nok boven elke woningscheiding */}
        {[-erfX, erfX].map(x => (
          <mesh key={x} position={[x, NOK_H + 0.3, 0]} castShadow>
            <boxGeometry args={[0.5, 1.2, 0.5]} />
            <meshStandardMaterial color="#5b3a2d" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Woning({ L, nacht = false, hoog = true }) {
  return L.vrijstaand ? null : <Panden L={L} nacht={nacht} hoog={hoog} />
}

export default Woning
