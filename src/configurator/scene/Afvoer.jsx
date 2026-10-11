// Hemelwaterafvoer dóór een voorste hoekstaander: alles wat zichtbaar is behalve het
// water (Regen.jsx) en de staander zelf (Veranda.jsx). Per item `a` uit L.afvoeren, in
// wereldcoördinaten (de y-waarden in `a` bevatten al L.vloerY):
//  - onderaan het uitloopgat met rubber doorvoerring en een PVC-bocht of aluminium
//    kapje in framekleur, in de door de klant gekozen richting (a.n);
//  - bovenaan (goot-modellen) het gat in de gootbodem en optioneel de bladvanger;
//  - in de doorkijk (prop `doorkijk`) de PVC-binnenbuis met trechter en, bij richting
//    'onder', het gestippelde ondergrondse spoor naar de regenpijp of het riool;
//  - met `labels` drie uitleglabels langs de waterloop (gootuitloop → staander → uitloop).
// Geen state per frame; eigen geometrie in useMemo met dispose in de cleanup.
import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { useMat } from './materials.js'
import { MOBIEL } from './kwaliteit.js'
import { AFVOER, AFVOER_RICHTINGEN, vind } from '../options.js'

// Donker 'gat'-materiaal, één instantie voor alle afvoeren. Met polygonOffset waar de
// schijf vlak op een ander oppervlak ligt (staandervlak, gootbodem); zonder voor de
// binnenschijf in de mond van de bocht.
const DONKER = new THREE.MeshStandardMaterial({
  color: '#0b0c0d', roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
})
const DONKER_VRIJ = new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 1 })
const SPOOR_KLEUR = '#2f7fd8'
const LABEL = 'vc-maat'

// Rotatie om y waarmee lokaal +z op de normaal n = [nx, nz] van het staandervlak valt.
const richtingRotatie = ([nx, nz]) => [0, Math.atan2(nx, nz), 0]
// Schijf (cylinder, as = y) met de as langs n: z-vlakken [π/2,0,0], x-vlakken [0,0,π/2].
const schijfRotatie = ([nx]) => (nx ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0])
const naarVector = ([x, y, z]) => new THREE.Vector3(x, y, z)

// ─── Hartlijn en buisgeometrie ───────────────────────────────────────────────

// Polylijn met afgeronde hoeken: rechte stukken blijven twee punten, elke hoek wordt een
// cirkelboog (7,5° per stap). De raaklengte is beperkt tot de helft van de aangrenzende
// stukken; wordt de straal daardoor kleiner dan `minStraal` (de buis zou zichzelf
// snijden), dan blijft de hoek scherp: de ring op het hoekpunt vormt dan een verstek.
export function afgerondeHartlijn(punten, straal, minStraal = 0) {
  const P = punten.filter((p, i) => i === 0 || p.distanceTo(punten[i - 1]) > 1e-6)
  if (P.length < 3) return P.map(p => p.clone())
  const uit = [P[0].clone()]
  const d1 = new THREE.Vector3(), d2 = new THREE.Vector3(), n1 = new THREE.Vector3()
  for (let i = 1; i < P.length - 1; i++) {
    const p = P[i]
    const l1 = d1.subVectors(p, P[i - 1]).length(); d1.divideScalar(l1)
    const l2 = d2.subVectors(P[i + 1], p).length(); d2.divideScalar(l2)
    const hoek = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1))
    const tanHalf = Math.tan(hoek / 2)
    const rb = Math.min(straal, (0.5 * l1) / tanHalf, (0.5 * l2) / tanHalf)
    if (hoek < 0.01 || rb < minStraal) { uit.push(p.clone()); continue }
    const t = rb * tanHalf
    const A = p.clone().addScaledVector(d1, -t)
    n1.copy(d2).addScaledVector(d1, -d1.dot(d2)).normalize()   // binnenwaartse normaal
    const C = A.clone().addScaledVector(n1, rb)
    const stappen = Math.max(4, Math.ceil(hoek / (Math.PI / 24)))
    for (let k = 0; k <= stappen; k++) {
      const s = (hoek * k) / stappen
      uit.push(C.clone().addScaledVector(n1, -rb * Math.cos(s)).addScaledVector(d1, rb * Math.sin(s)))
    }
  }
  uit.push(P[P.length - 1].clone())
  return uit
}

// Knipt het begin van een (van boven naar beneden lopende) polylijn af op y = yMax.
function knipBoven(punten, yMax) {
  const i = punten.findIndex(p => p.y <= yMax)
  if (i <= 0) return punten
  const a = punten[i - 1], b = punten[i]
  return [a.clone().lerp(b, (a.y - yMax) / (a.y - b.y)), ...punten.slice(i)]
}

// Hartlijnpunten (Vector3) van de buis in de staander voor afvoer `a`: a.pad tot aan het
// uitloopgat (bij 'onder' tot de vloer). De kwartbocht onderin (van (x, yGat + r, z) naar
// (x + nx·r, yGat, z + nz·r)) wordt als echte cirkelboog met straal r = buis bemonsterd;
// bovenliggende hoeken (Cubic XL) worden afgerond. Met `yStart` begint de buis onder de
// trechter. Ook bruikbaar voor de waterkolom (Regen.jsx), zodat water en buis samenvallen.
export function afvoerHartlijn(a, { yStart = null } = {}) {
  const n = new THREE.Vector3(a.n[0], 0, a.n[1])
  const pad = a.pad.map(naarVector)
  const r = a.buis
  let boven
  const onder = []
  if (a.gat) {
    const yGat = a.gat[1]
    const iBocht = pad.findIndex(p => Math.abs(p.y - (yGat + r)) < 1e-6 && Math.abs(p.x - a.x) < 1e-6 && Math.abs(p.z - a.z) < 1e-6)
    boven = iBocht > 0 ? pad.slice(0, iBocht + 1) : [pad[0], new THREE.Vector3(a.x, yGat + r, a.z)]
    const C = new THREE.Vector3(a.x + a.n[0] * r, yGat + r, a.z + a.n[1] * r)
    const stappen = 12
    for (let k = 1; k <= stappen; k++) {
      const s = (Math.PI / 2) * (k / stappen)
      onder.push(C.clone().addScaledVector(n, -r * Math.cos(s)).add(new THREE.Vector3(0, -r * Math.sin(s), 0)))
    }
    // Eindigt net binnen het vlak: bij de bocht begint daar de stub (geen samenvallende
    // cilinders), bij het kapje sluit de montageflens het gat af.
    const terug = Math.min(a.uitloop === 'kapje' ? 0.002 : 0.012, Math.max(0, a.vlak - r - 0.001))
    onder.push(naarVector(a.gat).addScaledVector(n, -terug))
  } else {
    boven = pad.slice(0, pad.length - 2)   // t/m (x, vloerY, z); daaronder het ondergrondse spoor
  }
  if (yStart != null) boven = knipBoven(boven, yStart)
  return [...afgerondeHartlijn(boven, r, a.buis * 0.6), ...onder]
}

// Buisgeometrie (open uiteinden) langs bemonsterde hartlijnpunten, met parallel
// getransporteerde frames zodat de ringen in de bochten niet verdraaien. Zelfde
// vertex-/indexconventie als THREE.TubeGeometry, maar met de ringen precies op de
// meegegeven punten (dicht in bochten, ijl op rechte stukken).
export function buisGeometrie(punten, straal, radiaal = 12) {
  const n = punten.length
  const g = new THREE.BufferGeometry()
  if (n < 2) return g
  const ringen = radiaal + 1
  const posities = new Float32Array(n * ringen * 3)
  const normalen = new Float32Array(n * ringen * 3)
  const uvs = new Float32Array(n * ringen * 2)
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3()
  const vorigeT = new THREE.Vector3(), as = new THREE.Vector3(), q = new THREE.Quaternion()
  const lengtes = [0]
  for (let i = 1; i < n; i++) lengtes.push(lengtes[i - 1] + punten[i].distanceTo(punten[i - 1]))
  const totaal = lengtes[n - 1] || 1
  let k = 0
  for (let i = 0; i < n; i++) {
    const p = punten[i]
    T.subVectors(punten[Math.min(n - 1, i + 1)], punten[Math.max(0, i - 1)]).normalize()
    if (i === 0) {
      N.crossVectors(Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), T)
    } else {
      // Minimale rotatie van de vorige naar de nieuwe tangent (parallel transport).
      const s = as.crossVectors(vorigeT, T).length()
      if (s > 1e-8) N.applyQuaternion(q.setFromAxisAngle(as.divideScalar(s), Math.acos(THREE.MathUtils.clamp(vorigeT.dot(T), -1, 1))))
    }
    N.addScaledVector(T, -T.dot(N)).normalize()
    B.crossVectors(T, N).normalize()
    vorigeT.copy(T)
    for (let j = 0; j < ringen; j++) {
      const hoek = (j / radiaal) * Math.PI * 2
      const c = -Math.cos(hoek), s = Math.sin(hoek)
      const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z
      normalen[k * 3] = nx; normalen[k * 3 + 1] = ny; normalen[k * 3 + 2] = nz
      posities[k * 3] = p.x + straal * nx; posities[k * 3 + 1] = p.y + straal * ny; posities[k * 3 + 2] = p.z + straal * nz
      uvs[k * 2] = lengtes[i] / totaal; uvs[k * 2 + 1] = j / radiaal
      k++
    }
  }
  const indices = []
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < ringen; j++) {
      const a = ringen * (i - 1) + (j - 1), b = ringen * i + (j - 1), c = ringen * i + j, d = ringen * (i - 1) + j
      indices.push(a, b, d, b, c, d)
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(posities, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(normalen, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeBoundingSphere()
  return g
}

// Stabiele sleutel voor useMemo: `a` is bij elke layout een nieuw object, de maten niet.
const hartlijnSleutel = a => `${a.buis}|${a.uitloop}|${a.vlak}|${a.pad.map(p => p.map(v => v.toFixed(4)).join(',')).join(';')}`

// ─── Onderdelen ─────────────────────────────────────────────────────────────

// Uitloopgat in het staandervlak: rubber doorvoerring 0,5 mm buiten het vlak, met daarin
// de donkere gatschijf die er 0,5 mm bovenuit steekt (leest op 1–3 m als gat met kraag).
function Uitloopgat({ a, mat }) {
  const [nx, nz] = a.n
  const [gx, gy, gz] = a.gat
  const rot = schijfRotatie(a.n)
  const dik = 0.004
  const op = afstand => [gx + nx * (afstand + dik / 2), gy, gz + nz * (afstand + dik / 2)]
  return (
    <group>
      <mesh name="afvoer-doorvoerring" position={op(0.0005)} rotation={rot} material={mat.rubber}>
        <cylinderGeometry args={[(a.buis + 0.014) / 2, (a.buis + 0.014) / 2, dik, 24]} />
      </mesh>
      <mesh name="afvoer-gat" position={op(0.001)} rotation={rot} material={DONKER}>
        <cylinderGeometry args={[(a.buis + 0.006) / 2, (a.buis + 0.006) / 2, dik, 24]} />
      </mesh>
    </group>
  )
}

// PVC-bocht 87° in framekleur: recht stuk (stub) door het gat, kwart-torus met
// hartlijnstraal r = buis, kort been omlaag met open mond en donkere binnenschijf.
// Lokaal: +z = uitlooprichting, y = wereld-y (de group staat op y = 0).
function Bocht({ a, mat }) {
  const r = a.buis
  const y = a.gat[1]
  const z0 = a.vlak - 0.01, z1 = a.vlak + AFVOER.stub
  const yMond = y - r - AFVOER.been
  return (
    <group name="afvoer-uitloop" position={[a.x, 0, a.z]} rotation={richtingRotatie(a.n)}>
      <mesh name="afvoer-stub" position={[0, y, (z0 + z1) / 2]} rotation={[Math.PI / 2, 0, 0]} material={mat.frame} castShadow receiveShadow>
        <cylinderGeometry args={[r / 2, r / 2, z1 - z0, 20]} />
      </mesh>
      {/* Torus in het lokale yz-vlak: boog van +y (einde stub) naar +z (bovenkant been) om [0, y − r, z1]. */}
      <mesh name="afvoer-bocht" position={[0, y - r, z1]} rotation={[Math.PI / 2, Math.PI / 2, 0]} material={mat.frame} castShadow receiveShadow>
        <torusGeometry args={[r, r / 2, 10, 12, Math.PI / 2]} />
      </mesh>
      <mesh name="afvoer-been" position={[0, yMond + AFVOER.been / 2, z1 + r]} material={mat.frame} castShadow receiveShadow>
        <cylinderGeometry args={[r / 2, r / 2, AFVOER.been, 20, 1, true]} />
      </mesh>
      <mesh name="afvoer-mond" position={[0, yMond + 0.0015, z1 + r]} material={DONKER_VRIJ}>
        <cylinderGeometry args={[(r - 0.006) / 2, (r - 0.006) / 2, 0.002, 20]} />
      </mesh>
    </group>
  )
}

// Aluminium uitloopkapje in framekleur: montageflens tegen het staandervlak (sluit het
// gat af), 2 mm plaatwerk (bovenkant, zijkanten, voorkant) en een open onderkant waarin
// een donkere plaat de opening toont. Het water verlaat het kapje op a.mond.
function Kapje({ a, mat }) {
  const [kB, kH, kU] = AFVOER.kapje
  const yGat = a.gat[1]
  const y = yGat - 0.005
  const v = a.vlak
  const w = 0.002
  const zPlaat = v + (kU + 0.003) / 2
  const lPlaat = kU - 0.003
  return (
    <group name="afvoer-uitloop" position={[a.x, 0, a.z]} rotation={richtingRotatie(a.n)}>
      <mesh name="afvoer-kapje-flens" position={[0, y, v + 0.0025]} material={mat.frame} castShadow receiveShadow>
        <boxGeometry args={[kB + 0.01, kH + 0.02, 0.004]} />
      </mesh>
      <mesh name="afvoer-kapje-boven" position={[0, y + kH / 2 - w / 2, zPlaat]} material={mat.frame} castShadow receiveShadow>
        <boxGeometry args={[kB, w, lPlaat]} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} name="afvoer-kapje-zij" position={[s * (kB / 2 - w / 2), y, zPlaat]} material={mat.frame} castShadow receiveShadow>
          <boxGeometry args={[w, kH, lPlaat]} />
        </mesh>
      ))}
      <mesh name="afvoer-kapje-voor" position={[0, y, v + kU - w / 2]} material={mat.frame} castShadow receiveShadow>
        <boxGeometry args={[kB, kH, w]} />
      </mesh>
      <mesh name="afvoer-kapje-opening" position={[0, yGat - 0.034 + w / 2, v + 0.03]} material={DONKER_VRIJ}>
        <boxGeometry args={[kB - 0.01, w, kU - 0.01]} />
      </mesh>
    </group>
  )
}

// Bladzeef op de gootuitloop: halve bol als draadwerk in rvs.
function Bladvanger({ positie, mat }) {
  const draad = useMemo(() => Object.assign(mat.rvs.clone(), { wireframe: true }), [mat.rvs])
  useEffect(() => () => draad.dispose(), [draad])
  return (
    <mesh name="afvoer-bladvanger" position={positie} material={draad}>
      <sphereGeometry args={[AFVOER.bladvanger, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  )
}

// Gootuitloop (alleen goot-modellen; bij Cubic zit alles in de omkasting): donker gat in
// de gootbodem, zichtbaar vanuit 'boven'. De U-goot heeft een 3 mm wand; bij de ronde goot
// ligt de binnenbodem in het midden ±6 mm boven Hf, bij de rechte goot 3 mm.
function Gootuitloop({ L, a, mat }) {
  const yGat = L.Hf + (L.goot === 'rond' ? 0.008 : 0.005)
  return (
    <group>
      <mesh name="afvoer-gootgat" position={[a.x, yGat, a.top[2]]} material={DONKER}>
        <cylinderGeometry args={[AFVOER.tapeind / 2, AFVOER.tapeind / 2, 0.003, 24]} />
      </mesh>
      {a.bladvanger && <Bladvanger positie={[a.x, yGat + 0.0015, a.top[2]]} mat={mat} />}
    </group>
  )
}

// Doorkijk: de PVC-buis in de staander (van onder de trechter tot net binnen het gat) en de
// trechter net onder Hf. Bij Cubic XL komt de buis horizontaal uit de zijomkasting: geen trechter.
function Binnenbuis({ L, a, mat }) {
  const yTrechter = L.Hf - 0.035
  const sleutel = hartlijnSleutel(a)
  const geom = useMemo(
    () => buisGeometrie(afvoerHartlijn(a, { yStart: L.overstek ? null : yTrechter - 0.03 }), a.buis / 2, MOBIEL ? 8 : 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sleutel, L.Hf, L.overstek],
  )
  useEffect(() => () => geom.dispose(), [geom])
  return (
    <group>
      <mesh name="afvoer-binnenbuis" geometry={geom} material={mat.pvc} renderOrder={5.5} />
      {!L.overstek && (
        <mesh name="afvoer-trechter" position={[a.x, yTrechter, a.z]} material={mat.pvc} renderOrder={5.5}>
          <cylinderGeometry args={[a.buis * 0.9, a.buis / 2 + 0.0005, 0.06, 16, 1, true]} />
        </mesh>
      )}
    </group>
  )
}

// Richting 'onder': gestippeld spoor door de voetplaat omlaag en richting de gevel, met label.
function OndergrondsSpoor({ a }) {
  const sleutel = hartlijnSleutel(a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const punten = useMemo(() => a.pad.slice(-3).map(p => [...p]), [sleutel])
  const eind = punten[punten.length - 1]
  return (
    <group>
      <Line points={punten} color={SPOOR_KLEUR} lineWidth={2} dashed dashSize={0.06} gapSize={0.04}
        depthTest={false} transparent opacity={0.9} renderOrder={10} />
      <Html position={[eind[0], eind[1], eind[2] - 0.05]} center className={LABEL}>naar regenpijp / riool</Html>
    </group>
  )
}

// Uitleglabels langs de waterloop: gootuitloop, halverwege de staander, bij de uitloop.
function Uitleg({ a }) {
  const [nx, nz] = a.n
  const onder = a.richting === 'onder'
  const yOnder = onder ? a.pad[a.pad.length - 3][1] : a.gat[1]
  const richting = onder ? 'ondergronds' : vind(AFVOER_RICHTINGEN, a.richting).label.toLowerCase()
  const uitloop = onder ? [a.x, yOnder + 0.06, a.z] : [a.mond[0] + nx * 0.08, a.mond[1] + 0.05, a.mond[2] + nz * 0.08]
  return (
    <group>
      <Html position={[a.top[0], a.top[1] + 0.06, a.top[2]]} center className={LABEL}>gootuitloop</Html>
      <Html position={[a.x + a.s * 0.32, (a.top[1] + yOnder) / 2, a.z]} center className={LABEL}>
        afvoer in de staander Ø {Math.round(a.buis * 1000)} mm
      </Html>
      <Html position={uitloop} center className={LABEL}>uitloop {richting}</Html>
    </group>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AfvoerInStaander({ L, a, doorkijk = false, labels = false }) {
  const mat = useMat()
  if (!a || !mat) return null
  const onder = a.richting === 'onder'
  return (
    <group name={`afvoer-${a.kant}`}>
      {!onder && a.uitloop !== 'kapje' && <Uitloopgat a={a} mat={mat} />}
      {!onder && (a.uitloop === 'kapje' ? <Kapje a={a} mat={mat} /> : <Bocht a={a} mat={mat} />)}
      {!L.kubus && <Gootuitloop L={L} a={a} mat={mat} />}
      {doorkijk && <Binnenbuis L={L} a={a} mat={mat} />}
      {doorkijk && onder && <OndergrondsSpoor a={a} />}
      {labels && <Uitleg a={a} />}
    </group>
  )
}
