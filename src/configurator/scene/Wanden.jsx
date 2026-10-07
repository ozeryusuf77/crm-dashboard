// Wandvullingen voor één vak/zijde. Lokaal assenstelsel: de wand loopt van
// x = -lengte/2 tot +lengte/2, y = 0 tot hoogte, buitenkant = +z.
import { useRef } from 'react'
import { useMat, glasVoor } from './materials.js'
import { useAnim, klikbaar } from './anim.js'
import { aantalSchuifPanelen, aantalPuiVleugels } from '../layout.js'

function Box({ args, position, mat, schaduw = true }) {
  return (
    <mesh position={position} material={mat} castShadow={schaduw} receiveShadow>
      <boxGeometry args={args} />
    </mesh>
  )
}

// ─── Glazen schuifwand ────────────────────────────────────────────────────────
function Schuifwand({ lengte, hoogte, open, glas, richting }) {
  const mat = useMat()
  const n = aantalSchuifPanelen(lengte)
  const overlap = 0.045
  const pw = (lengte + (n - 1) * overlap) / n
  const rail = 0.024
  const railD = n * rail + 0.014
  const bovenH = 0.055, onderH = 0.028
  const gh = hoogte - bovenH - onderH - 0.03
  const glasMat = glasVoor(mat, glas)

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

  return (
    <group>
      <Box args={[lengte, bovenH, railD]} position={[0, hoogte - bovenH / 2, 0]} mat={mat.frame} />
      <Box args={[lengte, onderH, railD]} position={[0, onderH / 2, 0]} mat={mat.frame} />
      {Array.from({ length: n }, (_, i) => {
        const gaatLinks = i < nLinks
        const greepX = gaatLinks ? pw / 2 - 0.12 : -pw / 2 + 0.12
        return (
          <group key={i} ref={el => (refs.current[i] = el)} position={[dicht(i), 0, spoor(i)]}>
            <mesh material={glasMat} position={[0, onderH + 0.02 + gh / 2, 0]} renderOrder={3}>
              <boxGeometry args={[pw, gh, 0.01]} />
            </mesh>
            <Box args={[pw, 0.034, 0.02]} position={[0, onderH + 0.02 + gh + 0.017, 0]} mat={mat.frame} />
            <Box args={[pw, 0.03, 0.02]} position={[0, onderH + 0.005, 0]} mat={mat.frame} />
            {/* Komgreep aan beide kanten van het glas */}
            {[-1, 1].map(s => (
              <mesh key={s} position={[greepX, 1.0, s * 0.008]} rotation={[Math.PI / 2, 0, 0]} material={mat.rubber}>
                <cylinderGeometry args={[0.028, 0.028, 0.006, 24]} />
              </mesh>
            ))}
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

function Schuifpui({ lengte, hoogte, open, richting }) {
  const mat = useMat()
  const fp = 0.07, diep = 0.13
  const li = lengte - 2 * fp
  const n = aantalPuiVleugels(lengte)
  const overlap = 0.07
  const sw = (li + (n - 1) * overlap) / n
  const sh = hoogte - fp - 0.06
  const dicht = i => -li / 2 + sw / 2 + i * (sw - overlap)

  // Welke vleugels schuiven en waar naartoe?
  let bewegend
  if (n === 4) bewegend = { 1: dicht(0), 2: dicht(3) }
  else bewegend = richting === 'rechts' ? { 0: dicht(1) } : { 1: dicht(0) }

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
        // Greep aan de kant waar je de vleugel vastpakt (weg van de schuifrichting).
        const greep = beweegt ? (bewegend[i] < dicht(i) ? 1 : -1) : undefined
        return (
          <group key={i} ref={el => (refs.current[i] = el)} position={[dicht(i), 0.06, beweegt ? -0.03 : 0.03]}>
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
      {Array.from({ length: n - 1 }, (_, i) => (
        <Box key={i} args={[0.035, hoogte - 0.09, 0.05]} position={[-lengte / 2 + b * (i + 1), hoogte / 2, 0]} mat={mat.frame} />
      ))}
      <mesh material={glasVoor(mat, glas)} position={[0, hoogte / 2, 0]} renderOrder={3}>
        <boxGeometry args={[lengte, hoogte - 0.09, 0.01]} />
      </mesh>
    </group>
  )
}

// ─── Dichte aluminium (rabat) wand ───────────────────────────────────────────
function DichteWand({ lengte, hoogte }) {
  const mat = useMat()
  const plank = 0.16
  const n = Math.ceil(hoogte / plank)
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const h = Math.min(plank, hoogte - i * plank)
        return (
          <mesh key={i} material={mat.frame} position={[0, i * plank + h / 2, 0.006]} rotation={[-0.05, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[lengte, h - 0.004, 0.022]} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Wand({ w, lengte, hoogte, open, onToggle, position, rotation }) {
  if (!w || w.type === 'open') return null
  let inhoud = null
  if (w.type === 'schuifwand') inhoud = <Schuifwand lengte={lengte} hoogte={hoogte} open={open} glas={w.glas} richting={w.richting} />
  if (w.type === 'schuifpui') inhoud = <Schuifpui lengte={lengte} hoogte={hoogte} open={open} richting={w.richting} />
  if (w.type === 'vastglas') inhoud = <VastGlas lengte={lengte} hoogte={hoogte} glas={w.glas} />
  if (w.type === 'dicht') inhoud = <DichteWand lengte={lengte} hoogte={hoogte} />
  const bedienbaar = w.type === 'schuifwand' || w.type === 'schuifpui'
  return (
    <group position={position} rotation={rotation} {...(bedienbaar ? klikbaar(onToggle) : {})}>
      {inhoud}
    </group>
  )
}
