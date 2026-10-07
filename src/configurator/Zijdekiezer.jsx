// Klein bovenaanzicht waarin je een zijde (en vak) aanklikt om de wand te kiezen.
import { WAND_TYPES, vind } from './options.js'
import { wandVoor } from './layout.js'

const KLEUR = { open: '#cbd2d9', schuifwand: '#2f7fd8', schuifpui: '#7b4fd6', vastglas: '#20a39e', dicht: '#545b63' }

export default function Zijdekiezer({ cfg, L, zijde, vak, onKies }) {
  const B = 220, H = 150
  const sx = (B - 40) / L.W, sz = (H - 50) / L.D
  const s = Math.min(sx, sz)
  const w = L.W * s, d = L.D * s
  const x0 = (B - w) / 2, y0 = 26
  // Voorwand-lijn ligt op de staanderlijn (bij overstek dus binnen de dakrand).
  const yVoor = y0 + (L.zVoorStaander / L.D) * d
  const lijn = (k, i) => {
    const t = wandVoor(cfg, i === undefined ? k : `${k}#${i}`)?.type || 'open'
    const actief = zijde === k && (i === undefined || vak === 'alle' || vak === i)
    return { stroke: KLEUR[t], strokeWidth: actief ? 9 : 6, opacity: actief ? 1 : 0.75, strokeLinecap: 'round', cursor: 'pointer' }
  }
  const titel = (k, i) => vind(WAND_TYPES, wandVoor(cfg, i === undefined ? k : `${k}#${i}`)?.type).label

  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="vc-zijdekiezer" role="group" aria-label="Kies een zijde">
      {/* Woning / gevel */}
      {!L.vrijstaand && <rect x={x0 - 12} y={4} width={w + 24} height={y0 - 10} rx={3} fill="#b7795f" opacity="0.8" />}
      {!L.vrijstaand && <text x={B / 2} y={15} textAnchor="middle" className="vc-zk-tekst" fill="#fff">Woning</text>}
      <rect x={x0} y={y0} width={w} height={d} fill="#eef2f6" stroke="#d5dbe1" />

      {L.vakken.map((v, i) => {
        const a = x0 + (v.x0 + L.W / 2) * s, b = x0 + (v.x1 + L.W / 2) * s
        return (
          <g key={`v${i}`} onClick={() => onKies('voor', L.vakken.length > 1 ? i : 'alle')}>
            <title>{`Voorzijde${L.vakken.length > 1 ? ` vak ${i + 1}` : ''}: ${titel('voor', i)}`}</title>
            <line x1={a + 3} y1={yVoor} x2={b - 3} y2={yVoor} {...lijn('voor', i)} />
            <rect x={a} y={yVoor - 10} width={b - a} height={20} fill="transparent" />
          </g>
        )
      })}
      {L.vrijstaand && L.vakken.map((v, i) => {
        const a = x0 + (v.x0 + L.W / 2) * s, b = x0 + (v.x1 + L.W / 2) * s
        return (
          <g key={`a${i}`} onClick={() => onKies('achter', L.vakken.length > 1 ? i : 'alle')}>
            <title>{`Achterzijde${L.vakken.length > 1 ? ` vak ${i + 1}` : ''}: ${titel('achter', i)}`}</title>
            <line x1={a + 3} y1={y0} x2={b - 3} y2={y0} {...lijn('achter', i)} />
            <rect x={a} y={y0 - 10} width={b - a} height={20} fill="transparent" />
          </g>
        )
      })}
      {[['links', x0], ['rechts', x0 + w]].map(([k, x]) => (
        <g key={k} onClick={() => onKies(k, 'alle')}>
          <title>{`${k === 'links' ? 'Linker' : 'Rechter'}zijde: ${titel(k)}`}</title>
          <line x1={x} y1={y0 + 4} x2={x} y2={yVoor - 4} {...lijn(k)} />
          <rect x={x - 10} y={y0} width={20} height={yVoor - y0} fill="transparent" />
        </g>
      ))}
      {L.koppelingen.map((k, i) => (
        <line key={`k${i}`} x1={x0 + (k + L.W / 2) * s} y1={y0} x2={x0 + (k + L.W / 2) * s} y2={y0 + d}
          stroke="#0a2342" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      ))}
      {L.xStaanders.map((x, i) => (
        <rect key={i} x={x0 + (x + L.W / 2) * s - 3.5} y={yVoor - 3.5} width={7} height={7} fill="#333a40" />
      ))}
      <text x={B / 2} y={H - 6} textAnchor="middle" className="vc-zk-tekst" fill="#6b7480">Tuin</text>
    </svg>
  )
}

export { KLEUR as WAND_KLEUR }
