// Procedurele texturen voor de regenmodus (Regen.jsx): stroompjes over het dak, de
// structuur in de waterstraal, rimpels in de plas en zachte maskers voor de waterband
// in de goot en de plas. Alles wordt één keer per pagina op een canvas getekend
// (module-cache, nooit disposen) met de helpers uit textures.js; geen bestanden,
// geen fetch — dus CSP-veilig. Wie een eigen herhaling nodig heeft, kloont de
// textuur (Texture.clone deelt de GPU-upload) en disposet alleen die kloon.
// Alle texturen zijn data (NoColorSpace), RepeatWrapping, anisotropy 4.
import * as THREE from 'three'
import { maakCanvas, naarTexture, normaalUitHoogte, rng } from './textures.js'

const cache = new Map()
const eenmaal = (naam, maak) => {
  if (!cache.has(naam)) cache.set(naam, maak())
  return cache.get(naam)
}

// Datatextuur-instellingen (geen kleurruimte-conversie, herhalend, bescheiden anisotropie).
function data(t) {
  t.colorSpace = THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

// Tekent `teken(ctx, dx, dy)` ook over de randen heen, zodat de textuur naadloos herhaalt.
function metRandkopieën(g, w, h, x, y, rx, ry, teken) {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      if (x + dx + rx < 0 || x + dx - rx > w || y + dy + ry < 0 || y + dy - ry > h) continue
      teken(dx, dy)
    }
  }
}

// Zachte, verticaal gerekte ellips (radial gradient) op (x, y) met halve assen rx × ry.
function ellips(g, x, y, rx, ry, kleur, alpha) {
  g.save()
  g.translate(x, y)
  g.scale(rx, ry)
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
  grad.addColorStop(0, `rgba(${kleur},${alpha})`)
  grad.addColorStop(0.55, `rgba(${kleur},${alpha * 0.55})`)
  grad.addColorStop(1, `rgba(${kleur},0)`)
  g.fillStyle = grad
  g.beginPath()
  g.arc(0, 0, 1, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

// Stroompjes: ±90 zachte, verticaal gerekte ellipsen (6–14 × 60–200 px) en 25 dunne
// lijnen. Dezelfde tekening dient als alphamasker (wit op zwart) en als hoogtekaart
// (grijs 128 met lichtere blobs) — met dezelfde seed, zodat masker en normal samenvallen.
function tekenStroom(g, w, h, { basis, blobKleur, blobAlpha, lijnAlpha }) {
  const r = rng(41)
  g.fillStyle = basis
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 90; i++) {
    const x = r() * w, y = r() * h
    const rx = (6 + r() * 8) / 2, ry = (60 + r() * 140) / 2
    const a = blobAlpha * (0.6 + r() * 0.4)
    metRandkopieën(g, w, h, x, y, rx, ry, (dx, dy) => ellips(g, x + dx, y + dy, rx, ry, blobKleur, a))
  }
  g.strokeStyle = `rgba(${blobKleur},${lijnAlpha})`
  g.lineWidth = 1
  for (let i = 0; i < 25; i++) {
    const x = Math.round(r() * w) + 0.5, y0 = r() * h, l = 100 + r() * 200
    g.beginPath()
    g.moveTo(x, y0)
    g.lineTo(x + (r() - 0.5) * 6, y0 + l)
    g.stroke()
    if (y0 + l > h) {
      // Doorlopend over de onderrand: zelfde lijn één tegel hoger.
      g.beginPath()
      g.moveTo(x, y0 - h)
      g.lineTo(x + (r() - 0.5) * 6, y0 - h + l)
      g.stroke()
    }
  }
}

// Alphamasker van de stroompjes over het dak (256 × 512, verticaal = stroomrichting).
export const stroomMasker = () => eenmaal('stroomMasker', () => {
  const c = maakCanvas(256, 512)
  tekenStroom(c.getContext('2d'), 256, 512, { basis: '#000000', blobKleur: '255,255,255', blobAlpha: 1, lijnAlpha: 0.5 })
  return data(naarTexture(c, { srgb: false }))
})

// Normal map van dezelfde stroompjes (blobs als bolle waterlenzen, sterkte 2.5).
export const stroomNormal = () => eenmaal('stroomNormal', () => {
  const c = maakCanvas(256, 512)
  tekenStroom(c.getContext('2d'), 256, 512, { basis: '#808080', blobKleur: '255,255,255', blobAlpha: 0.5, lijnAlpha: 0.25 })
  return data(normaalUitHoogte(c, 2.5))
})

// Structuur in de waterstraal (64 × 256): wit met 12 donkere verticale strepen (alpha
// 0.35) en fijne ruis; het R-kanaal wordt door de straal-shader gelezen en scrollt.
export const straalStructuur = () => eenmaal('straalStructuur', () => {
  const w = 64, h = 256
  const c = maakCanvas(w, h)
  const g = c.getContext('2d')
  const r = rng(53)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 12; i++) {
    const x = r() * w, b = 2 + r() * 3
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.fillRect(x, 0, b, h)
    if (x + b > w) g.fillRect(x - w, 0, b, h)
  }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.12})`
    g.fillRect(r() * w, r() * h, 1, 1 + r() * 2)
  }
  return data(naarTexture(c, { srgb: false }))
})

// Rimpels in de plas (128 × 128): vier concentrische ringen met sinusprofiel, uitdovend
// naar de rand, plus hash-ruis als hoogtekaart → normal map (sterkte 1.5).
export const rimpelNormal = () => eenmaal('rimpelNormal', () => {
  const n = 128
  const c = maakCanvas(n, n)
  const g = c.getContext('2d')
  const img = g.createImageData(n, n)
  const r = rng(67)
  const ruis = new Float32Array(n * n)
  for (let i = 0; i < ruis.length; i++) ruis[i] = r()
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2)   // 0 in het midden, 1 aan de rand
      const uitdoving = 1 - THREE.MathUtils.smoothstep(d, 0.55, 1)
      // Vier ringen over de straal (sin-profiel), licht = hoog.
      const hoogte = 0.5 + 0.3 * Math.sin(d * 4 * Math.PI * 2 - Math.PI / 2) * uitdoving + (ruis[y * n + x] - 0.5) * 0.12
      const v = Math.max(0, Math.min(255, Math.round(hoogte * 255)))
      const i = (y * n + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return data(normaalUitHoogte(c, 1.5))
})

// Masker voor de waterband in de goot (16 × 64): zachte randen aan beide lange zijden,
// gradient 0 → 1 → 0 met een plateau van 70 % in het midden (langs de v-as).
export const bandMasker = () => eenmaal('bandMasker', () => {
  const w = 16, h = 64
  const c = maakCanvas(w, h)
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#000000')
  grad.addColorStop(0.15, '#ffffff')
  grad.addColorStop(0.85, '#ffffff')
  grad.addColorStop(1, '#000000')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  const t = data(naarTexture(c, { srgb: false }))
  t.wrapT = THREE.ClampToEdgeWrapping   // nooit herhalen dwars op de band
  return t
})

// Masker van de plas bij de uitloop (128 × 128): drie overlappende radiale gradients,
// iets uit het midden, zodat de rand onregelmatig is en zacht uitloopt.
export const plasMasker = () => eenmaal('plasMasker', () => {
  const n = 128
  const c = maakCanvas(n, n)
  const g = c.getContext('2d')
  g.fillStyle = '#000000'
  g.fillRect(0, 0, n, n)
  g.globalCompositeOperation = 'lighter'
  for (const [cx, cy, rad, a] of [[62, 66, 50, 1], [74, 58, 42, 0.85], [54, 54, 44, 0.8]]) {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
    grad.addColorStop(0, `rgba(255,255,255,${a})`)
    grad.addColorStop(0.6, `rgba(255,255,255,${a * 0.7})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(cx, cy, rad, 0, Math.PI * 2)
    g.fill()
  }
  const t = data(naarTexture(c, { srgb: false }))
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping   // één plas, geen herhaling
  return t
})
