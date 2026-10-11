// Klein bovenaanzicht (gezien vanuit de tuin, woning boven, tuin onder).
// modus 'wanden': klik op een zijde (en vak) om de wand te kiezen; de afvoerstaanders
// krijgen een kleine druppel. modus 'afvoer': de twee voorste hoekstaanders zijn
// aanklikbaar (afvoer aan/uit) en tonen de uitlooprichting als pijl.
import { WAND_TYPES, AFVOER_RICHTINGEN, vind } from './options.js'
import { wandVoor } from './layout.js'

const KLEUR = { open: '#cbd2d9', schuifwand: '#2f7fd8', schuifpui: '#7b4fd6', vastglas: '#20a39e', dicht: '#545b63' }
const AFVOER_BLAUW = '#2f7fd8'
const KANT_TEKST = { links: 'Linker', rechts: 'Rechter' }

// Druppelsymbool (hemelwaterafvoer) met de punt omhoog; r = halve hoogte.
export function AfvoerDruppel({ x, y, r = 4, fill = '#fff', titel }) {
  const k = r / 5
  const d = `M${x} ${y - 5 * k} C${x + 2.6 * k} ${y - 1.5 * k} ${x + 4 * k} ${y + 0.5 * k} ${x + 4 * k} ${y + 2 * k}` +
    ` A${4 * k} ${4 * k} 0 0 1 ${x - 4 * k} ${y + 2 * k} C${x - 4 * k} ${y + 0.5 * k} ${x - 2.6 * k} ${y - 1.5 * k} ${x} ${y - 5 * k} Z`
  return (
    <path d={d} fill={fill} style={{ pointerEvents: 'none' }}>
      {titel && <title>{titel}</title>}
    </path>
  )
}

// Pijl van de staander af in de uitlooprichting (dx, dy in schermrichting van het schema).
function Pijl({ x, y, dx, dy, van = 9, tot = 27 }) {
  const x1 = x + dx * van, y1 = y + dy * van
  const x2 = x + dx * tot, y2 = y + dy * tot
  // Pijlpunt: twee korte lijnen schuin terug vanaf het uiteinde.
  const px = -dy, py = dx
  const kop = `M${x2 - dx * 5 + px * 4} ${y2 - dy * 5 + py * 4} L${x2} ${y2} L${x2 - dx * 5 - px * 4} ${y2 - dy * 5 - py * 4}`
  return (
    <g stroke={AFVOER_BLAUW} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path d={kop} />
    </g>
  )
}

// Hoekstaander met afvoer-status: blauw vierkant met druppel (actief) of licht vierkant (inactief);
// bij 'onder' een gestippelde cirkel met stip in plaats van een pijl.
function AfvoerStaander({ x, y, kant, richting, groot, onKies }) {
  const actief = !!richting
  const R = richting ? vind(AFVOER_RICHTINGEN, richting) : null
  const titel = actief
    ? `${KANT_TEKST[kant]} hoekstaander: afvoer, uitloop ${R.label.toLowerCase()}${groot ? ' — klik om te verwijderen' : ''}`
    : `${KANT_TEKST[kant]} hoekstaander: geen afvoer${groot ? ' — klik om toe te voegen' : ''}`
  const h = groot ? 16 : 7
  return (
    <g onClick={groot && onKies ? () => onKies(kant) : undefined} className={groot ? 'vc-zk-staander' : undefined}
      role={groot ? 'button' : undefined} aria-label={groot ? titel : undefined} tabIndex={groot ? 0 : undefined}
      onKeyDown={groot && onKies ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onKies(kant) } } : undefined}>
      <title>{titel}</title>
      {groot && actief && richting !== 'onder' && <Pijl x={x} y={y} dx={R.n[0]} dy={R.n[1]} />}
      <rect x={x - h / 2} y={y - h / 2} width={h} height={h} rx={groot ? 3.5 : 1}
        fill={actief ? AFVOER_BLAUW : '#eef2f6'} stroke={actief ? AFVOER_BLAUW : '#333a40'} strokeWidth={groot ? 1.5 : 1} />
      {groot && actief && richting !== 'onder' && <AfvoerDruppel x={x} y={y} r={4.5} />}
      {groot && actief && richting === 'onder' && (
        <g style={{ pointerEvents: 'none' }}>
          <circle cx={x} cy={y} r={4.6} fill="none" stroke="#fff" strokeWidth="1.3" strokeDasharray="2 1.6" />
          <circle cx={x} cy={y} r={1.6} fill="#fff" />
        </g>
      )}
      {!groot && actief && <AfvoerDruppel x={x} y={y} r={4} titel="Hemelwaterafvoer" />}
      {groot && <rect x={x - 14} y={y - 14} width={28} height={28} fill="transparent" />}
    </g>
  )
}

export default function Zijdekiezer({ cfg, L, zijde, vak, onKies, modus = 'wanden', onKiesAfvoer }) {
  const afvoerModus = modus === 'afvoer'
  const interactief = !afvoerModus && typeof onKies === 'function'
  const B = 220, H = 150
  // In de afvoermodus extra marge opzij voor de pijlen naar links/rechts.
  const marge = afvoerModus ? 70 : 40
  const sx = (B - marge) / L.W, sz = (H - 50) / L.D
  const s = Math.min(sx, sz)
  const w = L.W * s, d = L.D * s
  const x0 = (B - w) / 2, y0 = 26
  // Voorwand-lijn ligt op de staanderlijn (bij overstek dus binnen de dakrand).
  const yVoor = y0 + (L.zVoorStaander / L.D) * d
  const lijn = (k, i) => {
    const t = wandVoor(cfg, i === undefined ? k : `${k}#${i}`)?.type || 'open'
    const actief = interactief && zijde === k && (i === undefined || vak === 'alle' || vak === i)
    return { stroke: KLEUR[t], strokeWidth: actief ? 9 : 6, opacity: actief ? 1 : 0.75, strokeLinecap: 'round', cursor: interactief ? 'pointer' : 'default' }
  }
  const titel = (k, i) => vind(WAND_TYPES, wandVoor(cfg, i === undefined ? k : `${k}#${i}`)?.type).label
  const klik = (z, v) => (interactief ? () => onKies(z, v) : undefined)
  const afvoer = L.afvoer || cfg.afvoer || {}
  const xStaander = x => x0 + (x + L.W / 2) * s
  const hoek = { links: L.xStaanders[0], rechts: L.xStaanders[L.xStaanders.length - 1] }

  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="vc-zijdekiezer" role="group"
      aria-label={afvoerModus ? 'Kies de hoekstaander met de afvoer' : 'Kies een zijde'}>
      {/* Woning / gevel */}
      {!L.vrijstaand && <rect x={x0 - 12} y={4} width={w + 24} height={y0 - 10} rx={3} fill="#b7795f" opacity="0.8" />}
      {!L.vrijstaand && <text x={B / 2} y={15} textAnchor="middle" className="vc-zk-tekst" fill="#fff">Woning</text>}
      <rect x={x0} y={y0} width={w} height={d} fill="#eef2f6" stroke="#d5dbe1" />

      {L.vakken.map((v, i) => {
        const a = x0 + (v.x0 + L.W / 2) * s, b = x0 + (v.x1 + L.W / 2) * s
        return (
          <g key={`v${i}`} onClick={klik('voor', L.vakken.length > 1 ? i : 'alle')}>
            <title>{`Voorzijde${L.vakken.length > 1 ? ` vak ${i + 1}` : ''}: ${titel('voor', i)}`}</title>
            <line x1={a + 3} y1={yVoor} x2={b - 3} y2={yVoor} {...lijn('voor', i)} />
            {interactief && <rect x={a} y={yVoor - 10} width={b - a} height={20} fill="transparent" />}
          </g>
        )
      })}
      {L.vrijstaand && L.vakken.map((v, i) => {
        const a = x0 + (v.x0 + L.W / 2) * s, b = x0 + (v.x1 + L.W / 2) * s
        return (
          <g key={`a${i}`} onClick={klik('achter', L.vakken.length > 1 ? i : 'alle')}>
            <title>{`Achterzijde${L.vakken.length > 1 ? ` vak ${i + 1}` : ''}: ${titel('achter', i)}`}</title>
            <line x1={a + 3} y1={y0} x2={b - 3} y2={y0} {...lijn('achter', i)} />
            {interactief && <rect x={a} y={y0 - 10} width={b - a} height={20} fill="transparent" />}
          </g>
        )
      })}
      {[['links', x0], ['rechts', x0 + w]].map(([k, x]) => (
        <g key={k} onClick={klik(k, 'alle')}>
          <title>{`${KANT_TEKST[k]}zijde: ${titel(k)}`}</title>
          <line x1={x} y1={y0 + 4} x2={x} y2={yVoor - 4} {...lijn(k)} />
          {interactief && <rect x={x - 10} y={y0} width={20} height={yVoor - y0} fill="transparent" />}
        </g>
      ))}
      {L.koppelingen.map((k, i) => (
        <line key={`k${i}`} x1={xStaander(k)} y1={y0} x2={xStaander(k)} y2={y0 + d}
          stroke="#0a2342" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      ))}
      {/* Tussen- en koppelstaanders voor; de twee hoekstaanders apart (afvoer). */}
      {L.xStaanders.slice(1, -1).map((x, i) => (
        <rect key={i} x={xStaander(x) - 3.5} y={yVoor - 3.5} width={7} height={7} fill="#333a40" />
      ))}
      {L.vrijstaand && L.xStaanders.map((x, i) => (
        <rect key={`a${i}`} x={xStaander(x) - 3.5} y={y0 + (L.zAchter / L.D) * d - 3.5} width={7} height={7} fill="#333a40" />
      ))}
      {['links', 'rechts'].map(kant => (
        <AfvoerStaander key={`hoek-${kant}`} x={xStaander(hoek[kant])} y={yVoor} kant={kant}
          richting={afvoer[kant] || null} groot={afvoerModus} onKies={onKiesAfvoer} />
      ))}
      <text x={B / 2} y={H - 6} textAnchor="middle" className="vc-zk-tekst" fill="#6b7480">Tuin</text>
    </svg>
  )
}

export { KLEUR as WAND_KLEUR }
