// Het aluminium frame per model: staanders (met voet, kap, hover/klik en cutaway voor
// de hemelwaterafvoer), open goot of kubistische omkasting, muurprofiel, liggers met
// afdekkap en EPDM-rubbers, dakplaten (met dither-schaduw), spieën en koppelingen, plus
// de verlichting/heater die aan het frame hangen. De afvoer zelf (uitloopgat, bocht of
// kapje, gootgat, binnenbuis) komt uit Afvoer.jsx; het water uit Regen.jsx.
import * as THREE from 'three'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useMat } from './materials.js'
import { Balk, profielGeom } from './profiel.js'
import { klikbaar } from './anim.js'
import { natHook } from './regenNat.js'
import { MOBIEL } from './kwaliteit.js'
import { AfvoerInStaander } from './Afvoer.jsx'
import { MUURPROFIEL_D } from '../layout.js'

function Box({ args, position, rotation, mat, schaduw = true }) {
  return (
    <mesh position={position} rotation={rotation} material={mat} castShadow={schaduw} receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  )
}

// ─── Goot ────────────────────────────────────────────────────────────────────
// Buitencontour van de goot als open pad: van de bovenrand aan de dakzijde (0, H) via de
// bodem naar de bovenrand aan de tuinzijde, in (u = diepte vanaf de dakzijde, v = hoogte).
function tekenGootWand(p, vorm, B, H) {
  p.moveTo(0, H)
  if (vorm === 'rond') {
    // Halfronde sierlijke goot met kraal aan de bovenzijde.
    p.lineTo(0, H * 0.12)
    p.quadraticCurveTo(0, 0, B * 0.22, 0)
    p.bezierCurveTo(B * 0.78, -0.004, B * 1.02, H * 0.2, B, H * 0.56)
    p.quadraticCurveTo(B * 0.99, H * 0.64, B * 0.95, H * 0.68)
    p.quadraticCurveTo(B * 1.03, H * 0.82, B * 0.96, H * 0.93)
    p.lineTo(B * 0.96, H)
  } else {
    // Rechte goot met afgeronde onderkant en een smalle sierrand bovenop.
    const r = 0.012
    p.lineTo(0, r)
    p.quadraticCurveTo(0, 0, r, 0)
    p.lineTo(B - r, 0)
    p.quadraticCurveTo(B, 0, B, r)
    p.lineTo(B, H - 0.018)
    p.lineTo(B + 0.006, H - 0.012)
    p.lineTo(B + 0.006, H)
  }
  return p
}

// Massieve doorsnede: voor de sierkappen (kopschotten) en de koppelstukken.
function gootVormDicht(vorm, B, H) {
  const s = tekenGootWand(new THREE.Shape(), vorm, B, H)
  s.closePath()
  return s
}

// Zwaartepunt van een gesloten veelhoek (schoenveterformule).
function zwaartepunt(P, terugval) {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length]
    const k = p.x * q.y - q.x * p.y
    a += k
    cx += (p.x + q.x) * k
    cy += (p.y + q.y) * k
  }
  a *= 0.5
  return Math.abs(a) < 1e-9 ? terugval : new THREE.Vector2(cx / (6 * a), cy / (6 * a))
}

// Open U-kanaal met 3 mm wand: buitencontour heen, 3 mm naar binnen en de om het
// zwaartepunt geschaalde binnencontour terug, zodat gootbodem, gootgat en gootwater
// van bovenaf zichtbaar zijn. Eindigt in (0,003, H) → (0, H).
function gootVormOpen(vorm, B, H) {
  const wand = 0.003
  const buiten = tekenGootWand(new THREE.Path(), vorm, B, H).getPoints(24)
  const c = zwaartepunt(buiten, new THREE.Vector2(B / 2, H / 2))
  const fx = 1 - (2 * wand) / B
  const fy = 1 - (2 * wand) / H
  const binnen = buiten.map(p => new THREE.Vector2(c.x + (p.x - c.x) * fx, c.y + (p.y - c.y) * fy)).reverse()
  binnen[0].y = H
  binnen[binnen.length - 1].y = H
  const s = tekenGootWand(new THREE.Shape(), vorm, B, H)
  binnen.forEach(p => s.lineTo(p.x, p.y))
  return s
}

// Goot per deel (open kanaal, met koppelstuk op elke koppeling) en sierkappen op de einden.
// achter = vrijstaande achterzijde (profiel gespiegeld, buitenkant op z = 0).
function Goot({ L, y, achter = false }) {
  const mat = useMat()
  const B = L.gootB, H = L.gootH
  const vormen = useMemo(() => ({ open: gootVormOpen(L.goot, B, H), dicht: gootVormDicht(L.goot, B, H) }), [L.goot, B, H])
  // Sierkap: 10 mm dik met 4 mm omlopende afronding; gecentreerd op profiel én dikte.
  const kop = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(vormen.dicht, {
      depth: 0.010, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 12,
    })
    g.translate(-B / 2, -H / 2, -0.005)
    return g
  }, [vormen, B, H])
  // Koppelstuk/voeg: massieve schijf van 5 mm, via scale naar de gewenste breedte.
  const koppelKop = useMemo(
    () => new THREE.ExtrudeGeometry(vormen.dicht, { depth: 0.005, bevelEnabled: false, curveSegments: 12 }).translate(-B / 2, -H / 2, -0.0025),
    [vormen, B, H],
  )
  const delen = useMemo(() => L.delen.map(d => ({
    d, g: new THREE.ExtrudeGeometry(vormen.open, { depth: d.breedte - 0.004, bevelEnabled: false, curveSegments: 16 }),
  })), [vormen, L.delen])
  useEffect(() => () => { kop.dispose(); koppelKop.dispose() }, [kop, koppelKop])
  useEffect(() => () => delen.forEach(({ g }) => g.dispose()), [delen])

  // Lokale x (profieldiepte u) → wereld ±z, extrusie → wereld x. u = 0 ligt aan de dakzijde.
  const z = achter ? B : L.D - B
  const zHart = achter ? B / 2 : L.D - B / 2
  const yHart = y + H / 2
  const rot = [0, achter ? Math.PI / 2 : -Math.PI / 2, 0]
  return (
    <group>
      {delen.map(({ d, g }, i) => (
        <mesh key={i} geometry={g} material={mat.frame} castShadow receiveShadow rotation={rot}
          position={achter ? [d.x0 + 0.002, y, z] : [d.x1 - 0.002, y, z]} />
      ))}
      {/* Sierkappen: 5 % groter dan het profiel, 10 mm over het gooteinde en 6 mm erbuiten */}
      {[-1, 1].map(s => (
        <mesh key={s} geometry={kop} material={mat.frame} rotation={rot} scale={[1.05, 1.05, 1]} castShadow receiveShadow
          position={[s * (L.W / 2 - 0.002), yHart, zHart]} />
      ))}
      {/* Koppelstukken: 40 mm brede band (2 mm rondom) met een rubber voeg aan weerszijden */}
      {L.koppelingen.map((x, i) => (
        <group key={`k${i}`} position={[x, yHart, zHart]} rotation={rot}>
          <mesh geometry={koppelKop} material={mat.koppel} scale={[(B + 0.004) / B, (H + 0.004) / H, 8]} castShadow receiveShadow />
          {[-1, 1].map(s => (
            <mesh key={s} geometry={koppelKop} material={mat.rubber} position={[0, 0, s * 0.02075]}
              scale={[(B + 0.002) / B, (H + 0.002) / H, 0.3]} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ─── Kubistische omkasting en muurprofiel ────────────────────────────────────
// Rechthoekige balk per deel met koppelstuk (en rubber voegen) op de koppeling.
// `inkorten` kort de buitenste delen aan de uiteinden in (draagbalk tussen de zijomkastingen).
function KubusBalk({ L, z, y0, h, diep, inkorten = 0 }) {
  const mat = useMat()
  const delen = useMemo(() => (inkorten ? L.delen.map((d, i) => {
    const x0 = i === 0 ? d.x0 + inkorten : d.x0
    const x1 = i === L.delen.length - 1 ? d.x1 - inkorten : d.x1
    return { x0, x1, breedte: x1 - x0, midden: (x0 + x1) / 2 }
  }) : L.delen), [L.delen, inkorten])
  return (
    <group>
      {delen.map((d, i) => (
        <Balk key={i} as="x" b={diep} h={h} lengte={d.breedte - 0.004} r={0.010}
          position={[d.midden, y0 + h / 2, z]} mat={mat.frame} />
      ))}
      {L.koppelingen.map((x, i) => (
        <group key={`k${i}`} position={[x, y0 + h / 2, z]}>
          <Box args={[0.03, h + 0.004, diep + 0.004]} mat={mat.koppel} />
          {[-1, 1].map(s => (
            <Box key={s} args={[0.0015, h + 0.002, diep + 0.002]} position={[s * 0.01575, 0, 0]} mat={mat.rubber} schaduw={false} />
          ))}
        </group>
      ))}
    </group>
  )
}

// Muurprofiel tegen de gevel, per deel, met loodslabbe erboven en keilboutkappen om de 0,5 m.
function Muurprofiel({ L, yBoven, h }) {
  const mat = useMat()
  const kapGeom = useMemo(() => new THREE.CylinderGeometry(0.009, 0.009, 0.004, 12).rotateX(Math.PI / 2), [])
  useEffect(() => () => kapGeom.dispose(), [kapGeom])
  // Posities van de kappen: om de 0,5 m vanaf 25 cm uit de hoek, niet onder een koppelstuk.
  const kappen = useMemo(() => {
    const xs = []
    for (let x = -L.W / 2 + 0.25; x <= L.W / 2 - 0.25 + 1e-6; x += 0.5) {
      if (!L.koppelingen.some(k => Math.abs(k - x) < 0.06)) xs.push(x)
    }
    return xs
  }, [L.W, L.koppelingen])
  const ref = useRef()
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    kappen.forEach((x, i) => {
      o.position.set(x, yBoven - h / 2, MUURPROFIEL_D + 0.002)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [kappen, yBoven, h])
  return (
    <group>
      {L.delen.map((d, i) => (
        <Balk key={i} as="x" b={MUURPROFIEL_D} h={h} lengte={d.breedte - 0.004} r={0.005}
          position={[d.midden, yBoven - h / 2, MUURPROFIEL_D / 2]} mat={mat.frame} />
      ))}
      {L.koppelingen.map((x, i) => (
        <group key={`k${i}`} position={[x, yBoven - h / 2, MUURPROFIEL_D / 2]}>
          <Box args={[0.03, h + 0.004, MUURPROFIEL_D + 0.004]} mat={mat.koppel} />
          {[-1, 1].map(s => (
            <Box key={s} args={[0.0015, h + 0.002, MUURPROFIEL_D + 0.002]} position={[s * 0.01575, 0, 0]} mat={mat.rubber} schaduw={false} />
          ))}
        </group>
      ))}
      <Box args={[L.W + 0.02, 0.12, 0.006]} position={[0, yBoven + 0.055, 0.004]} rotation={[0.08, 0, 0]} mat={mat.lood} schaduw={false} />
      {kappen.length > 0 && (
        <instancedMesh key={kappen.length} ref={ref} args={[kapGeom, mat.frame, kappen.length]} receiveShadow />
      )}
    </group>
  )
}

// ─── Spie ────────────────────────────────────────────────────────────────────
// Driehoekige spie boven de zijwand, onder de schuine ligger (alleen hellend dak).
function Spie({ L, kant, type }) {
  const mat = useMat()
  const geom = useMemo(() => {
    // Niet in een open gootkanaal steken: 4 mm vóór de dakzijdige gootwand afkappen
    // (voorgoot altijd, achtergoot bij vrijstaand).
    const z0 = L.vrijstaand ? Math.max(L.zij.z0, L.gootB + 0.004) : L.zij.z0
    const z1 = Math.min(L.zij.z1, L.D - L.gootB - 0.004)
    const onder = L.Hf + 0.005
    const s = new THREE.Shape()
    s.moveTo(z0, onder)
    s.lineTo(z1, onder)
    s.lineTo(z1, L.dakY(z1) - L.lH - 0.005)
    s.lineTo(z0, L.dakY(z0) - L.lH - 0.005)
    s.lineTo(z0, onder)
    // 8 mm dik, zodat de spie van binnen én buiten zichtbaar is (ook met FrontSide-materialen).
    return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }).translate(0, 0, -0.004)
  }, [L])
  useEffect(() => () => geom.dispose(), [geom])
  const m = type === 'glas' ? mat.glasHelder : type === 'poly' ? mat.polySpie : mat.frame
  const x = kant * L.zij.x
  const zm = (L.zij.z0 + L.zij.z1) / 2
  const hm = L.dakY(zm) - L.lH - L.Hf
  return (
    <group>
      <mesh geometry={geom} material={m} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow={type === 'alu'} renderOrder={3} />
      <Balk as="y" b={0.04} h={0.04} lengte={hm} position={[x, L.Hf + hm / 2, zm]} mat={mat.frame} />
    </group>
  )
}

// ─── Staander ────────────────────────────────────────────────────────────────
// Hulpvectoren voor het clipvlak van de opengesneden afvoerstaander (geen allocatie per frame).
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3()

// Staander van de vloer (L.vloerY) tot `hoogte`, met voet (voetkap bij Cubic, voetplaat met
// rvs dopmoeren bij Classic/Linea) en bij de goot-modellen een staanderkap onder de goot.
// `kant` ('links'|'rechts') maakt een buitenste voorstaander aanklikbaar (hover-markering);
// `afvoer` markeert de staander met de hemelwaterafvoer. Bij `doorkijk` wordt die staander
// opengesneden (cutaway) met het clipvlak `vlak` (gedeeld met AfvoerInStaander, zodat buis en
// staander op dezelfde plek open liggen): de camerakant tot 12 mm vóór het hart valt weg, de
// binnenwand wordt donker getekend en de PVC-buis Ø 50/60 met de waterkolom blijft zichtbaar.
function Staander({ L, x, z, hoogte, afvoer = false, doorkijk = false, vlak = null, kant = null, onKlikStaander }) {
  const mat = useMat()
  const lengte = hoogte - L.vloerY
  const klik = !!(kant && onKlikStaander)
  const [hover, setHover] = useState(false)
  const zichtbaar = afvoer && doorkijk && !!vlak

  // Hover-markering: eigen kloon van het framemateriaal met lichte emissie in de framekleur.
  const hoverMat = useMemo(() => (klik ? natHook(mat.frame.clone()) : null), [klik, mat.frame])
  useEffect(() => () => hoverMat?.dispose(), [hoverMat])
  if (hoverMat) {
    hoverMat.color.copy(mat.frame.color)
    hoverMat.emissive.copy(mat.frame.color).multiplyScalar(0.15)
    hoverMat.metalness = mat.frame.metalness
  }
  useEffect(() => () => { if (hover) document.body.style.cursor = '' }, [hover])

  // Cutaway: gesneden kloon van het framemateriaal (schaduw mee gesneden) en een donkere
  // binnenwand (BackSide) op hetzelfde profiel, beide met hetzelfde clipvlak.
  const snede = useMemo(() => (zichtbaar
    ? Object.assign(natHook(mat.frame.clone()), { clippingPlanes: [vlak], clipShadows: true })
    : null), [zichtbaar, mat.frame, vlak])
  const binnenwand = useMemo(() => (zichtbaar
    ? new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.9, side: THREE.BackSide, clippingPlanes: [vlak] })
    : null), [zichtbaar, vlak])
  useEffect(() => () => { snede?.dispose(); binnenwand?.dispose() }, [snede, binnenwand])
  if (snede) {
    snede.color.copy(mat.frame.color)
    snede.emissive.copy(mat.frame.color).multiplyScalar(hover ? 0.15 : 0)
    snede.metalness = mat.frame.metalness
  }
  // Clipvlak per frame op de camera richten: normaal van de camera af, 12 mm vóór het hart.
  useFrame(({ camera }) => {
    if (!zichtbaar) return
    _v.set(camera.position.x - x, 0, camera.position.z - z)
    if (_v.lengthSq() < 1e-8) _v.set(0, 0, 1)
    _v.normalize()
    _p.set(x, 0, z).addScaledVector(_v, 0.012)
    vlak.setFromNormalAndCoplanarPoint(_n.copy(_v).negate(), _p)
  })

  let handlers = {}
  if (klik) {
    const k = klikbaar(() => onKlikStaander(kant))
    handlers = {
      ...k,
      onPointerOver: e => { k.onPointerOver(e); setHover(true) },
      onPointerOut: () => { k.onPointerOut(); setHover(false) },
    }
  }

  const geom = profielGeom(L.sB, L.sD, 0.006)
  const m = zichtbaar ? snede : hover && hoverMat ? hoverMat : mat.frame
  const yVoet = L.vloerY
  return (
    <group position={[x, 0, z]} {...handlers}>
      <group position={[0, yVoet + lengte / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, lengte]}>
        <mesh geometry={geom} material={m} castShadow receiveShadow />
        {zichtbaar && <mesh geometry={geom} material={binnenwand} />}
      </group>
      {L.kubus ? (
        // Voetkap over de inwendige stelvoet.
        <Balk as="y" b={L.sB + 0.012} h={L.sD + 0.012} lengte={0.03} r={0.004} position={[0, yVoet + 0.015, 0]} mat={mat.frame} />
      ) : (
        <>
          {/* Voetplaat met vier rvs dopmoeren over de ankerbouten */}
          <Balk as="y" b={L.sB + 0.05} h={L.sD + 0.05} lengte={0.01} r={0.006} position={[0, yVoet + 0.005, 0]} mat={mat.frame} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => (
            <mesh key={i} position={[a * (L.sB / 2 + 0.016), yVoet + 0.016, b * (L.sD / 2 + 0.016)]} material={mat.rvs} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.012, 12]} />
            </mesh>
          ))}
          {/* Staanderkap (gootverbinder) onder de goot */}
          <Balk as="y" b={L.sB + 0.008} h={L.sD + 0.008} lengte={0.05} r={0.008} position={[0, hoogte - 0.025, 0]} mat={mat.frame} />
        </>
      )}
    </group>
  )
}

// ─── Verlichting ─────────────────────────────────────────────────────────────
function spotPosities(L, n) {
  if (!n) return []
  const rijen = n >= 8 && L.D >= 3 ? 2 : 1
  const perRij = Math.ceil(n / rijen)
  const kandidaten = L.liggers.filter((l, i) => !(l.koppel && L.liggers[i - 1]?.koppel)).map(l => l.x)
  const binnen = kandidaten.slice(1, -1)
  const bron = perRij <= binnen.length ? binnen : kandidaten
  const res = []
  for (let r = 0; r < rijen; r++) {
    const z = L.zAchter + (L.lengteDak * (r + 1)) / (rijen + 1)
    for (let i = 0; i < perRij && res.length < n; i++) {
      const doel = -L.W / 2 + (L.W * (i + 0.5)) / perRij
      const x = perRij <= bron.length
        ? bron.reduce((a, b) => (Math.abs(b - doel) < Math.abs(a - doel) ? b : a))
        : doel
      res.push([x, L.dakY(z) - L.lH - 0.004, z])
    }
  }
  return res
}

// ─── Veranda ─────────────────────────────────────────────────────────────────
// doorkijk: afvoerstaander(s) opengesneden (cutaway) met zichtbare binnenbuis (regenmodus /
// afvoerkeuze); vereist renderer.localClippingEnabled (Scene.jsx).
// onKlikStaander(kant): klik op een buitenste voorstaander ('links'|'rechts').
// afvoerLabels: uitleglabels langs de waterloop (alleen samen met doorkijk; standpunt 'afvoer').
export default function Veranda({ cfg, L, nacht, heaterAan, doorkijk = false, onKlikStaander, afvoerLabels = false }) {
  const mat = useMat()
  const { W, Hf } = L
  const afvoeren = L.afvoeren || []
  // Liggers en platen lopen van zAchter tot de goothartlijn (zGoot). Bij de goot-modellen is
  // de goot een open kanaal: daar eindigen ze 2 cm voorbij de dakzijdige gootwand (druiprand),
  // zodat gootbodem en gootgat vrij blijven — vóór altijd, achter alleen vrijstaand (achtergoot).
  // In een omkasting (Cubic) lopen ze door tot in de balk.
  const cosH = Math.cos(L.helling)
  const lengteVol = L.lengteDak / cosH
  const inGoot = (L.gootB / 2 - 0.02) / cosH        // van goothart tot 2 cm voorbij de gootwand
  const inkortVoor = L.kubus ? 0 : inGoot
  const inkortAchter = !L.kubus && L.vrijstaand ? inGoot : 0
  // Lokale z langs de helling: 0 = zMid (hart van zAchter..zGoot), +z = richting voorgoot.
  const zAchterL = -lengteVol / 2 + inkortAchter
  const zVoorL = lengteVol / 2 - inkortVoor
  const lengteLigger = zVoorL - zAchterL
  const zLigger = (zAchterL + zVoorL) / 2
  // Afdekprofiel stopt bij de binnenkant van de goot/voorbalk.
  const zVoorAfdek = lengteVol / 2 - L.gootB / 2 / cosH
  const lengteAfdek = zVoorAfdek - zAchterL
  const zAfdek = (zAchterL + zVoorAfdek) / 2
  const zMid = (L.zAchter + L.zGoot) / 2
  const dikte = L.soort === 'poly' ? 0.016 : 0.009

  const zijBalk = kant => {
    if (L.kubus) return false
    const w = cfg.wanden[kant]
    return cfg.spie[kant] !== 'geen' || (w && w.type !== 'open') || cfg.zonwering.screens[kant]
  }

  const spots = useMemo(() => spotPosities(L, cfg.extra.spots), [L, cfg.extra.spots])
  // Max 8 echte lichtbronnen voor prestaties; extra spots zijn alleen gloeiend.
  const lichtSpots = spots.filter((_, i) => spots.length <= 8 || i % Math.ceil(spots.length / 8) === 0)

  const ledRef = useRef(0)
  useFrame((_, dt) => {
    ledRef.current = THREE.MathUtils.damp(ledRef.current, nacht ? 1 : 0, 4, dt)
    mat.led.emissiveIntensity = ledRef.current * 6
    mat.heater.emissiveIntensity = THREE.MathUtils.damp(mat.heater.emissiveIntensity, heaterAan ? 2.2 : 0, 3, dt)
  })

  const heaterPos = []
  for (let i = 0; i < cfg.extra.heater; i++) {
    const x = cfg.extra.heater === 1 ? 0 : (i === 0 ? -1 : 1) * W / 4
    heaterPos.push([x, L.yDakAchter - 0.32, L.vrijstaand ? L.zAchter + 0.12 : 0.1])
  }

  const hVoor = Hf
  const hAchter = L.achterBalkOnder
  // Dakschaduw: ondoorzichtig dak (opaal/IR/mat) werpt gewoon volle schaduw; helder glas/poly
  // werpt via het fijne dither-dieptemateriaal een lichte schaduw die PCSS uitsmeert.
  // Op mobiel (PCF, geen PCSS) alleen de ondoorzichtige daktypes.
  const dakSchaduw = MOBIEL ? { castShadow: mat.dakSchaduw }
    : mat.dakSchaduw ? { castShadow: true }
      : { castShadow: true, customDepthMaterial: mat.dakDiepte }
  const afvoerBij = x => afvoeren.find(a => Math.abs(a.x - x) < 1e-6)
  const nStaanders = L.xStaanders.length
  // Eén stabiel clipvlak per afvoer (gedeeld door Staander en AfvoerInStaander); de Staander
  // richt het elk frame op de camera. Alleen opnieuw aanmaken als de set afvoeren wisselt.
  const afvoerKanten = afvoeren.map(a => a.kant).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vlakken = useMemo(() => Object.fromEntries(afvoeren.map(a => [a.kant, new THREE.Plane()])), [afvoerKanten])

  return (
    <group>
      {/* Staanders voor (bij Cubic XL op de draagbalklijn, 1 m achter de voorrand); de twee
          buitenste zijn aanklikbaar en kunnen de afvoer dragen. */}
      {L.xStaanders.map((x, i) => {
        const a = afvoerBij(x)
        return (
          <Staander key={`sv${i}`} L={L} x={x} z={L.zVoorStaander} hoogte={hVoor}
            kant={i === 0 ? 'links' : i === nStaanders - 1 ? 'rechts' : null}
            afvoer={!!a} doorkijk={doorkijk} vlak={a ? vlakken[a.kant] : null} onKlikStaander={onKlikStaander} />
        )
      })}

      {/* Voorzijde: goot of omkasting */}
      {L.kubus
        ? <KubusBalk L={L} z={L.D - L.gootB / 2} y0={Hf} h={L.gootH} diep={L.gootB} />
        : <Goot L={L} y={Hf} />}
      {L.overstek > 0 && (
        // Draagbalk op de staanders tussen de zijomkastingen; de liggers rusten erop en
        // kragen 1 m uit tot de voorbalk. Bovenkant net onder de dakplaten.
        <KubusBalk L={L} z={L.zVoorStaander} y0={Hf} h={L.dakY(L.zVoorStaander) - Hf - 0.02} diep={L.sD + 0.02} inkorten={L.gootB + 0.0005} />
      )}

      {/* Achterzijde: muurprofiel of (vrijstaand) achterstaanders + goot/omkasting */}
      {L.vrijstaand ? (
        <>
          {L.xStaanders.map((x, i) => <Staander key={`sa${i}`} L={L} x={x} z={L.zAchter} hoogte={hAchter} />)}
          {L.kubus
            ? <KubusBalk L={L} z={L.gootB / 2} y0={Hf} h={L.gootH} diep={L.gootB} />
            : <Goot L={L} y={hAchter} achter />}
        </>
      ) : L.kubus
        ? <Muurprofiel L={L} yBoven={L.yRand} h={0.22} />
        : <Muurprofiel L={L} yBoven={L.yDakAchter + 0.025} h={0.17} />}

      {/* Kubistische zijomkasting: hetzelfde profiel als de voorbalk, flush met de staander,
          over de volle diepte (bij Cubic XL dus ook langs het overstek, met de afvoerbuis erin). */}
      {L.kubus && (() => {
        // Tussen muurprofiel/achterbalk en voorbalk, zodat vlakken niet samenvallen.
        const z0 = L.vrijstaand ? L.gootB : MUURPROFIEL_D
        const z1 = L.D - L.gootB
        return [-1, 1].map(s => (
          <group key={`zo${s}`} position={[s * (W / 2 - L.gootB / 2), Hf + L.gootH / 2, 0]}>
            <Balk as="z" b={L.gootB} h={L.gootH} lengte={z1 - z0} r={0.010} position={[0, 0, (z0 + z1) / 2]} mat={mat.frame} />
            {/* Hoekkappen over de kopse naad met de voorbalk (en vrijstaand de achterbalk) */}
            <Box args={[L.gootB + 0.004, L.gootH + 0.004, 0.012]} position={[0, 0, z1]} mat={mat.frame} />
            {L.vrijstaand && <Box args={[L.gootB + 0.004, L.gootH + 0.004, 0.012]} position={[0, 0, z0]} mat={mat.frame} />}
          </group>
        ))
      })()}

      {/* Liggers (dubbel op een koppeling) met EPDM-onderrubber en brede afdekkap */}
      {L.liggers.map((l, i) => (
        // Draaipunt op de bovenkant van de ligger in het midden, zodat de helling klopt.
        <group key={`l${i}`} position={[l.x, L.dakY(zMid), zMid]} rotation={[L.helling, 0, 0]}>
          <Balk as="z" b={L.lB} h={L.lH} lengte={lengteLigger} r={0.004} position={[0, -L.lH / 2, zLigger]} mat={mat.frame} />
          <Box args={[L.lB + 0.006, 0.003, lengteLigger]} position={[0, 0.0015, zLigger]} mat={mat.rubber} schaduw={false} />
          <Balk as="z" b={L.lB + 0.02} h={0.014} r={0.005} lengte={lengteAfdek}
            position={[0, 0.011, zAfdek]} mat={mat.frame} schaduw={false} />
        </group>
      ))}

      {/* Dakplaten */}
      {L.platen.map((p, i) => (
        // Bovenkant van de plaat 4 mm boven de liggerbovenkant (dakY); Regen.jsx rekent daarmee.
        <group key={`p${i}`} position={[p.x, L.dakY(zMid), zMid]} rotation={[L.helling, 0, 0]}>
          <mesh material={mat.dak} position={[0, -dikte / 2 + 0.004, zLigger]} renderOrder={2} {...dakSchaduw}>
            <boxGeometry args={[p.b, dikte, lengteLigger]} />
          </mesh>
        </group>
      ))}
      {/* Afsluitprofiel aan de gootzijde van de dakplaten */}
      {!L.kubus && (
        <Box args={[W - 0.02, 0.022, 0.03]} position={[0, L.dakY(L.D - L.gootB - 0.015) + 0.006, L.D - L.gootB - 0.015]} rotation={[L.helling, 0, 0]} mat={mat.frame} schaduw={false} />
      )}

      {/* Zijbalken (dragen spie / zijwand / screen) en spieën */}
      {[['links', -1], ['rechts', 1]].map(([kant, s]) => zijBalk(kant) && (
        <Balk key={kant} as="z" b={L.zijBalk} h={L.zijBalk} lengte={L.zij.lengte}
          position={[s * L.zij.x, Hf - L.zijBalk / 2, (L.zij.z0 + L.zij.z1) / 2]} mat={mat.frame} />
      ))}
      {L.spieMogelijk && [['links', -1], ['rechts', 1]].map(([kant, s]) => cfg.spie[kant] !== 'geen' && (
        <Spie key={`spie-${kant}`} L={L} kant={s} type={cfg.spie[kant]} />
      ))}

      {/* Hemelwaterafvoer door de gekozen hoekstaander(s): gat, bocht/kapje, gootgat, binnenbuis */}
      {afvoeren.map(a => (
        <AfvoerInStaander key={a.kant} L={L} a={a} doorkijk={doorkijk} labels={doorkijk && afvoerLabels}
          doorkijkVlak={doorkijk ? vlakken[a.kant] : null} />
      ))}

      {/* LED-spots */}
      {spots.map((p, i) => (
        <mesh key={`spot${i}`} position={p} rotation={[L.helling, 0, 0]} material={mat.led}>
          <cylinderGeometry args={[0.03, 0.03, 0.01, 20]} />
        </mesh>
      ))}
      {nacht && lichtSpots.map((p, i) => (
        <pointLight key={`pl${i}`} position={[p[0], p[1] - 0.1, p[2]]} intensity={(2.2 * 1.4 * spots.length) / lichtSpots.length}
          distance={6} decay={2} color="#ffd9a0" />
      ))}

      {/* LED-groef in de onderzijde van de voorbalk (Cubic), met daarin de LED-strip;
          bij de goot-modellen hangt de strip aan de binnenzijde van de goot. */}
      {L.kubus && (
        <Box args={[W - 0.06, 0.002, 0.022]} position={[0, Hf - 0.001, L.D - L.gootB / 2]} mat={mat.rubber} schaduw={false} />
      )}
      {cfg.extra.ledStrip && (
        <>
          {L.kubus ? (
            <mesh position={[0, Hf - 0.0015, L.D - L.gootB / 2]} material={mat.led}>
              <boxGeometry args={[W - 0.2, 0.003, 0.012]} />
            </mesh>
          ) : (
            <mesh position={[0, Hf + 0.01, L.D - L.gootB - 0.004]} material={mat.led}>
              <boxGeometry args={[W - 0.2, 0.012, 0.008]} />
            </mesh>
          )}
          {nacht && [-1, 0, 1].map(k => (
            <pointLight key={k} position={[(k * W) / 3, Hf - 0.15, L.D - L.gootB - 0.1]} intensity={1.2 * 1.4} distance={4} decay={2} color="#ffd9a0" />
          ))}
        </>
      )}

      {/* Infrarood heaters */}
      {heaterPos.map((p, i) => (
        <group key={`h${i}`} position={p}>
          <mesh material={mat.frame} castShadow><boxGeometry args={[0.9, 0.11, 0.09]} /></mesh>
          <mesh position={[0, -0.03, 0.047]} material={mat.heater}><boxGeometry args={[0.78, 0.04, 0.005]} /></mesh>
          {heaterAan && <pointLight position={[0, -0.2, 0.3]} intensity={1.6} distance={3} color="#ff7a3c" />}
        </group>
      ))}
    </group>
  )
}
