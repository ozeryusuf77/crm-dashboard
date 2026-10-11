// Wandvullingen voor één vak/zijde. Lokaal assenstelsel: de wand loopt van
// x = -lengte/2 tot +lengte/2, y = 0 tot hoogte, buitenkant = +z.
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useMat, paneelVoor } from './materials.js'
import { useAnim, klikbaar } from './anim.js'
import { aantalSchuifPanelen, aantalPuiVleugels, puiVleugelBreedte } from '../layout.js'
import { SCHUIFWAND, SCHUIFPUI } from '../options.js'
import { MOBIEL } from './kwaliteit.js'

// Rails, kozijnen en profielen: box met 3 mm afgeronde langskanten, zodat de randen
// een lichte highlight vangen zoals echt aluminium. Buitenmaten blijven exact `args`;
// op mobiel minder bevel-segmenten (zelfde afronding, minder driehoeken).
function Box({ args, position, mat, schaduw = true }) {
  return (
    <RoundedBox args={args} radius={0.003} smoothness={2} bevelSegments={MOBIEL ? 2 : 4}
      position={position} material={mat} castShadow={schaduw} receiveShadow />
  )
}

// ─── Glazen schuifwand ────────────────────────────────────────────────────────
// Komgrepen (verzonken rvs-ringen Ø 50 mm) vallen op afstand weg; verder dan
// GREEP_AFSTAND worden ze verborgen, met één afstandsmeting per wand per frame.
const GREEP_AFSTAND = 7

function Schuifwand({ lengte, hoogte, open, glas, richting, kubus }) {
  const mat = useMat()
  const n = aantalSchuifPanelen(lengte)
  const overlap = SCHUIFWAND.overlap
  const pw = (lengte + (n - 1) * overlap) / n
  const rail = 0.024
  const railD = n * rail + 0.014
  // Bovenrail 55 mm hoog. Bij een kubistische omkasting hangt hij 20 mm in de sponning
  // onder de balk, zodat er 35 mm zichtbaar onder uitsteekt (bovenkant wand = onderkant balk).
  const railH = 0.055, onderH = 0.028
  const verzonken = kubus ? 0.02 : 0
  const bovenH = railH - verzonken
  const gh = hoogte - bovenH - onderH - 0.03
  const glasMat = paneelVoor(mat, glas)

  const nLinks = richting === 'midden' ? Math.floor(n / 2) : richting === 'rechts' ? 0 : n
  const dicht = i => -lengte / 2 + pw / 2 + i * (pw - overlap)
  const geopend = i => (i < nLinks
    ? -lengte / 2 + pw / 2 + i * 0.022
    : lengte / 2 - pw / 2 - (n - 1 - i) * 0.022)
  const spoor = i => (i - (n - 1) / 2) * rail

  const refs = useRef([])
  useAnim(open, t => {
    refs.current.forEach((g, i) => { if (g) g.position.x = dicht(i) + (geopend(i) - dicht(i)) * t })
  })

  // Komgreep: rvs ring Ø 50 mm (3 mm op het glas) met daarin een 1 mm verzonken
  // donkere kom Ø 36 mm; één geometrie voor alle panelen van deze wand.
  const greepGeom = useMemo(() => {
    const vorm = new THREE.Shape().absarc(0, 0, 0.025, 0, Math.PI * 2, false)
    vorm.holes.push(new THREE.Path().absarc(0, 0, 0.018, 0, Math.PI * 2, true))
    const ring = new THREE.ExtrudeGeometry(vorm, { depth: 0.003, bevelEnabled: false, curveSegments: 24 })
    ring.translate(0, 0, -0.0015)
    return { ring, kom: new THREE.CylinderGeometry(0.018, 0.018, 0.004, 24) }
  }, [])
  useEffect(() => () => { greepGeom.ring.dispose(); greepGeom.kom.dispose() }, [greepGeom])

  // Afstandsschakeling van de grepen: alle greep-groups van deze wand tegelijk.
  const wortel = useRef()
  const grepen = useRef([])
  const grepenZichtbaar = useRef(true)
  const wereld = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (!wortel.current) return
    const dichtbij = camera.position.distanceTo(wortel.current.getWorldPosition(wereld)) < GREEP_AFSTAND
    if (dichtbij === grepenZichtbaar.current) return
    grepenZichtbaar.current = dichtbij
    grepen.current.forEach(g => { if (g) g.visible = dichtbij })
  })

  return (
    <group ref={wortel}>
      <Box args={[lengte, railH, railD]} position={[0, hoogte - railH / 2 + verzonken, 0]} mat={mat.frame} />
      <Box args={[lengte, onderH, railD]} position={[0, onderH / 2, 0]} mat={mat.frame} />
      {Array.from({ length: n }, (_, i) => {
        const gaatLinks = i < nLinks
        const greepX = gaatLinks ? pw / 2 - 0.09 : -pw / 2 + 0.09
        // Afdichtstrip op de leidende verticale rand, 1 mm buiten de glasrand (geen samenvallende vlakken).
        const stripX = gaatLinks ? -pw / 2 + 0.003 : pw / 2 - 0.003
        return (
          <group key={i} ref={el => (refs.current[i] = el)} position={[dicht(i), 0, spoor(i)]}>
            <mesh material={glasMat} position={[0, onderH + 0.02 + gh / 2, 0]} renderOrder={3}>
              <boxGeometry args={[pw, gh, 0.01]} />
            </mesh>
            <Box args={[pw, 0.034, 0.02]} position={[0, onderH + 0.02 + gh + 0.017, 0]} mat={mat.frame} />
            <Box args={[pw, 0.03, 0.02]} position={[0, onderH + 0.005, 0]} mat={mat.frame} />
            {/* Afdichtstrip (tochtstrip) van zwart kunststof over de volle glashoogte */}
            <Box args={[0.008, gh, 0.014]} position={[stripX, onderH + 0.02 + gh / 2, 0]} mat={mat.rubber} schaduw={false} />
            {/* Komgreep aan beide kanten van het glas, alleen dichtbij zichtbaar: ring op
                z = ±0,0065 (1,5 mm buiten het glasvlak), kom 1 mm teruggezet in de ring */}
            <group ref={el => { grepen.current[i] = el; if (el) el.visible = grepenZichtbaar.current }} position={[greepX, 1.0, 0]}>
              {[-1, 1].map(s => (
                <group key={s}>
                  <mesh geometry={greepGeom.ring} material={mat.rvs} position={[0, 0, s * 0.0065]} />
                  <mesh geometry={greepGeom.kom} material={mat.rubber} position={[0, 0, s * 0.005]} rotation={[Math.PI / 2, 0, 0]} />
                </group>
              ))}
            </group>
          </group>
        )
      })}
    </group>
  )
}

// ─── Aluminium schuifpui ──────────────────────────────────────────────────────
function Vleugel({ b, h, mat, greep }) {
  const s = 0.085
  return (
    <group>
      <Box args={[s, h, 0.055]} position={[-b / 2 + s / 2, h / 2, 0]} mat={mat.frame} />
      <Box args={[s, h, 0.055]} position={[b / 2 - s / 2, h / 2, 0]} mat={mat.frame} />
      <Box args={[b - 2 * s, 0.09, 0.055]} position={[0, h - 0.045, 0]} mat={mat.frame} />
      <Box args={[b - 2 * s, 0.1, 0.055]} position={[0, 0.05, 0]} mat={mat.frame} />
      <mesh material={mat.dubbelGlas} position={[0, h / 2, 0]} renderOrder={3}>
        <boxGeometry args={[b - 2 * s + 0.01, h - 0.18, 0.024]} />
      </mesh>
      {greep !== undefined && [-1, 1].map(z => (
        <group key={z} position={[greep * (b / 2 - s / 2), 1.05, z * 0.045]}>
          <Box args={[0.025, 0.34, 0.025]} position={[0, 0, z * 0.012]} mat={mat.rvs} />
          <Box args={[0.02, 0.02, 0.03]} position={[0, 0.15, 0]} mat={mat.rvs} />
          <Box args={[0.02, 0.02, 0.03]} position={[0, -0.15, 0]} mat={mat.rvs} />
        </group>
      ))}
    </group>
  )
}

// 2-, 3- of 4-delig: cfg `delen`, via aantalPuiVleugels begrensd op de vleugelmaten (anders de
// automatische keuze). Spoor 0 is het buitenste spoor (+z); een vleugel die over een andere heen
// schuift loopt op een spoor daarbinnen. Sporen liggen 60 mm uit elkaar (vleugel 55 mm diep).
const SPOOR = 0.06
function Schuifpui({ lengte, hoogte, open, richting, delen }) {
  const mat = useMat()
  const fp = SCHUIFPUI.kozijn
  const n = aantalPuiVleugels(lengte, delen)
  const sporen = n === 3 ? 3 : 2
  const diep = 0.07 + sporen * SPOOR          // kozijndiepte: 2 sporen 130 mm, 3 sporen 190 mm (nog net 2 vlakken)
  const li = lengte - 2 * fp
  const sw = puiVleugelBreedte(lengte, n)
  const sh = hoogte - fp - 0.06
  const dicht = i => -li / 2 + sw / 2 + i * (sw - SCHUIFPUI.overlap)
  const naarRechts = richting === 'rechts'

  // Welke vleugels schuiven, waarheen, en op welk spoor ze lopen.
  let bewegend, spoor
  if (n === 4) {
    bewegend = { 1: dicht(0), 2: dicht(3) }                  // buitenste vast, middelste naar buiten
    spoor = [0, 1, 1, 0]
  } else if (n === 3) {
    bewegend = naarRechts ? { 0: dicht(2), 1: dicht(2) } : { 1: dicht(0), 2: dicht(0) }
    spoor = naarRechts ? [2, 1, 0] : [0, 1, 2]              // de verste vleugel loopt op het binnenste spoor
  } else {
    bewegend = naarRechts ? { 0: dicht(1) } : { 1: dicht(0) }
    spoor = naarRechts ? [1, 0] : [0, 1]
  }
  const spoorZ = i => ((sporen - 1) / 2 - spoor[i]) * SPOOR

  const refs = useRef([])
  useAnim(open, t => {
    refs.current.forEach((g, i) => {
      if (g && bewegend[i] !== undefined) g.position.x = dicht(i) + (bewegend[i] - dicht(i)) * t
    })
  })

  return (
    <group>
      <Box args={[lengte, fp, diep]} position={[0, hoogte - fp / 2, 0]} mat={mat.frame} />
      <Box args={[lengte, 0.06, diep + 0.04]} position={[0, 0.03, 0.02]} mat={mat.frame} />
      <Box args={[fp, hoogte, diep]} position={[-lengte / 2 + fp / 2, hoogte / 2, 0]} mat={mat.frame} />
      <Box args={[fp, hoogte, diep]} position={[lengte / 2 - fp / 2, hoogte / 2, 0]} mat={mat.frame} />
      {Array.from({ length: n }, (_, i) => {
        const beweegt = bewegend[i] !== undefined
        // Greep op de sluitstijl: de kant waar je de vleugel vastpakt (weg van de schuifrichting).
        const greep = beweegt ? (bewegend[i] < dicht(i) ? 1 : -1) : undefined
        return (
          <group key={`${n}-${i}`} ref={el => (refs.current[i] = el)} position={[dicht(i), 0.06, spoorZ(i)]}>
            <Vleugel b={sw} h={sh} mat={mat} greep={greep} />
          </group>
        )
      })}
    </group>
  )
}

// ─── Vaste glazen wand ────────────────────────────────────────────────────────
function VastGlas({ lengte, hoogte, glas }) {
  const mat = useMat()
  const n = Math.max(1, Math.ceil(lengte / 1.0))
  const b = lengte / n
  return (
    <group>
      <Box args={[lengte, 0.05, 0.06]} position={[0, hoogte - 0.025, 0]} mat={mat.frame} />
      <Box args={[lengte, 0.04, 0.06]} position={[0, 0.02, 0]} mat={mat.frame} />
      {/* Eindstijlen (aansluitprofiel tegen staander of gevel) en tussenstijlen */}
      {[-1, 1].map(s => (
        <Box key={`e${s}`} args={[0.035, hoogte - 0.09, 0.05]} position={[s * (lengte / 2 - 0.0175), hoogte / 2, 0]} mat={mat.frame} />
      ))}
      {Array.from({ length: n - 1 }, (_, i) => (
        <Box key={i} args={[0.035, hoogte - 0.09, 0.05]} position={[-lengte / 2 + b * (i + 1), hoogte / 2, 0]} mat={mat.frame} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <mesh key={`g${i}`} material={paneelVoor(mat, glas)} position={[-lengte / 2 + b * (i + 0.5), hoogte / 2, 0]} renderOrder={3}>
          <boxGeometry args={[b - 0.035, hoogte - 0.09, 0.01]} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Dichte aluminium (rabat) wand ───────────────────────────────────────────
// Vlakke rabatdelen (16 cm hart-op-hart) in een omlijsting van boven-, onder- en eindprofiel.
// Tussen de delen zit een 6 mm diepe schaduwvoeg (donkere strip, 13 mm teruggezet) en achter
// de delen een gesloten plaat: er is nergens een kier om doorheen te kijken, van buiten noch binnen.
function DichteWand({ lengte, hoogte }) {
  const mat = useMat()
  const boven = 0.05, onder = 0.04, stijl = 0.04, diep = 0.06
  const steek = 0.16, voeg = 0.006
  const vulB = lengte - 2 * stijl
  const vulH = hoogte - boven - onder
  const n = Math.max(1, Math.ceil(vulH / steek - 1e-9))
  return (
    <group>
      <Box args={[lengte, boven, diep]} position={[0, hoogte - boven / 2, 0]} mat={mat.frame} />
      <Box args={[lengte, onder, diep]} position={[0, onder / 2, 0]} mat={mat.frame} />
      {[-1, 1].map(s => (
        <Box key={s} args={[stijl, vulH, diep]} position={[s * (lengte / 2 - stijl / 2), onder + vulH / 2, 0]} mat={mat.frame} />
      ))}
      {/* Gesloten achterplaat (de binnenzijde van de wand), binnen de omlijsting */}
      <mesh material={mat.frame} position={[0, onder + vulH / 2, -0.016]} castShadow receiveShadow>
        <boxGeometry args={[vulB + 0.002, vulH + 0.002, 0.012]} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const y0 = onder + i * steek
        const y1 = Math.min(hoogte - boven, y0 + steek - (i < n - 1 ? voeg : 0))
        return (
          <group key={i}>
            <mesh material={mat.frame} position={[0, (y0 + y1) / 2, 0.005]} castShadow receiveShadow>
              <boxGeometry args={[vulB, y1 - y0, 0.02]} />
            </mesh>
            {i < n - 1 && (
              <mesh material={mat.rubber} position={[0, y1 + voeg / 2, -0.002]} receiveShadow>
                <boxGeometry args={[vulB, voeg + 0.004, 0.008]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

// `kubus`: de wand hangt onder een kubistische omkasting (Cubic/Cubic XL); de bovenrail
// van een glazen schuifwand verdwijnt dan 20 mm in de balk.
export function Wand({ w, lengte, hoogte, open, onToggle, position, rotation, kubus = false }) {
  if (!w || w.type === 'open') return null
  let inhoud = null
  if (w.type === 'schuifwand') inhoud = <Schuifwand lengte={lengte} hoogte={hoogte} open={open} glas={w.glas} richting={w.richting} kubus={kubus} />
  if (w.type === 'schuifpui') inhoud = <Schuifpui lengte={lengte} hoogte={hoogte} open={open} richting={w.richting} delen={w.delen} />
  if (w.type === 'vastglas') inhoud = <VastGlas lengte={lengte} hoogte={hoogte} glas={w.glas} />
  if (w.type === 'dicht') inhoud = <DichteWand lengte={lengte} hoogte={hoogte} />
  const bedienbaar = w.type === 'schuifwand' || w.type === 'schuifpui'
  return (
    <group position={position} rotation={rotation} {...(bedienbaar ? klikbaar(onToggle) : {})}>
      {inhoud}
    </group>
  )
}
