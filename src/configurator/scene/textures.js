// Procedurele canvas-texturen (kleur + normal map), zodat de configurator geen
// externe bestanden nodig heeft en toch diepte/structuur in het licht toont.
// De helpers (maakCanvas, naarTexture, canvasTex, normaalUitHoogte, rng) zijn
// geëxporteerd zodat Regen/Tuin/Meubels hun eigen maskers en normals kunnen tekenen.
import * as THREE from 'three'
import { MOBIEL } from './kwaliteit.js'

export function maakCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function naarTexture(canvas, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function canvasTex(w, h, teken, opties) {
  const c = maakCanvas(w, h)
  teken(c.getContext('2d'), w, h)
  return naarTexture(c, opties)
}

// Eenvoudige deterministische ruis zodat elke render er hetzelfde uitziet.
export function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// Zet een hoogtekaart (grijswaarden, licht = hoog) om naar een tangent-space normal map.
export function normaalUitHoogte(hoogte, sterkte = 2) {
  const w = hoogte.width, h = hoogte.height
  const bron = hoogte.getContext('2d').getImageData(0, 0, w, h).data
  const uit = maakCanvas(w, h)
  const ctx = uit.getContext('2d')
  const img = ctx.createImageData(w, h)
  const H = (x, y) => bron[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * sterkte
      const dy = (H(x, y + 1) - H(x, y - 1)) * sterkte
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return naarTexture(uit, { srgb: false })
}

// Tekent kleur en hoogte in één keer; geeft { map, normalMap }.
function pbrSet(w, h, teken, sterkte) {
  const kleur = maakCanvas(w, h)
  const hoogte = maakCanvas(w, h)
  teken(kleur.getContext('2d'), hoogte.getContext('2d'), w, h)
  return { map: naarTexture(kleur), normalMap: normaalUitHoogte(hoogte, sterkte) }
}

// Waalformaat baksteen (21 × 5 cm) in halfsteensverband met verdiepte, lichte voegen.
// Eén tegel van de texture = 4 stenen breed × 16 lagen hoog ≈ 0,88 × 0,9 m.
export function baksteen() {
  return pbrSet(512, 512, (g, hg, w, h) => {
    const r = rng(7)
    g.fillStyle = '#c9c2b6'
    g.fillRect(0, 0, w, h)
    hg.fillStyle = '#202020'
    hg.fillRect(0, 0, w, h)
    const rijen = 16, kolommen = 4
    const bh = h / rijen, bw = w / kolommen, voeg = 3
    for (let y = 0; y < rijen; y++) {
      const offset = y % 2 ? bw / 2 : 0
      for (let x = -1; x <= kolommen; x++) {
        const t = r(), t2 = r()
        const rood = 104 + t * 40, groen = 50 + t * 20 + t2 * 6, blauw = 40 + t * 14
        const x0 = x * bw + offset + voeg, y0 = y * bh + voeg
        g.fillStyle = `rgb(${rood | 0},${groen | 0},${blauw | 0})`
        g.fillRect(x0, y0, bw - 2 * voeg, bh - 2 * voeg)
        // Gesinterde vlekjes op de steen.
        for (let k = 0; k < 14; k++) {
          g.fillStyle = `rgba(${r() > 0.5 ? '40,20,15' : '190,130,100'},${0.08 + r() * 0.1})`
          g.fillRect(x0 + r() * (bw - 2 * voeg), y0 + r() * (bh - 2 * voeg), 2 + r() * 4, 1 + r() * 2)
        }
        hg.fillStyle = `rgb(${200 + r() * 30 | 0},${200 + r() * 30 | 0},${200 + r() * 30 | 0})`
        hg.fillRect(x0, y0, bw - 2 * voeg, bh - 2 * voeg)
      }
    }
  }, 3)
}

// Keramische terrastegels 60 × 60 cm; één texture-tegel = 2 × 2 tegels = 1,2 m.
export function tegels() {
  return pbrSet(512, 512, (g, hg, w, h) => {
    const r = rng(3)
    g.fillStyle = '#8c877f'
    g.fillRect(0, 0, w, h)
    hg.fillStyle = '#303030'
    hg.fillRect(0, 0, w, h)
    const n = 2, s = w / n, voeg = 3
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = r() * 14
        g.fillStyle = `rgb(${(176 + t) | 0},${(171 + t) | 0},${(162 + t) | 0})`
        g.fillRect(x * s + voeg, y * s + voeg, s - 2 * voeg, s - 2 * voeg)
        for (let k = 0; k < 900; k++) {
          const v = r()
          g.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '60,55,50'},${0.05 + r() * 0.06})`
          g.fillRect(x * s + voeg + r() * (s - 2 * voeg), y * s + voeg + r() * (s - 2 * voeg), 1.5, 1.5)
        }
        hg.fillStyle = '#d8d8d8'
        hg.fillRect(x * s + voeg, y * s + voeg, s - 2 * voeg, s - 2 * voeg)
      }
    }
  }, 4)
}

// Gazon: kleurvariatie in vlekken + fijne grassprieten als hoogte.
export function gras() {
  return pbrSet(512, 512, (g, hg, w, h) => {
    const r = rng(11)
    g.fillStyle = '#58853a'
    g.fillRect(0, 0, w, h)
    hg.fillStyle = '#808080'
    hg.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      const t = r()
      g.fillStyle = `rgba(${(70 + t * 40) | 0},${(110 + t * 40) | 0},${(40 + t * 20) | 0},0.18)`
      g.beginPath()
      g.arc(r() * w, r() * h, 20 + r() * 60, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 16000; i++) {
      const t = r(), x = r() * w, y = r() * h
      g.fillStyle = `rgba(${(55 + t * 60) | 0},${(100 + t * 70) | 0},${(30 + t * 30) | 0},0.55)`
      g.fillRect(x, y, 1, 2 + r() * 3)
      hg.fillStyle = `rgba(${t > 0.5 ? '255,255,255' : '0,0,0'},0.35)`
      hg.fillRect(x, y, 1, 2 + r() * 3)
    }
  }, 2.5)
}

// Kinderkopjes (kasseien): 6 × 6 keien per tegel, grijs met warme tint, donkere voeg en
// een bolle hoogte per kei. Eén herhaling ≈ 6 keien van 10 cm = 0,6 m.
export function kinderkopjes() {
  const n = MOBIEL ? 256 : 512
  const schaal = n / 512
  return pbrSet(n, n, (g, hg, w, h) => {
    const r = rng(29)
    g.fillStyle = '#3a3632'
    g.fillRect(0, 0, w, h)
    hg.fillStyle = '#101010'
    hg.fillRect(0, 0, w, h)
    const keien = 6, cel = w / keien, voeg = 10 * schaal
    for (let y = 0; y < keien; y++) {
      for (let x = 0; x < keien; x++) {
        // Kleine willekeur in maat en plek zodat het verband niet machinaal oogt.
        const kx = x * cel + voeg / 2 + (r() - 0.5) * 3 * schaal
        const ky = y * cel + voeg / 2 + (r() - 0.5) * 3 * schaal
        const kb = cel - voeg - r() * 4 * schaal
        const kh = cel - voeg - r() * 4 * schaal
        const grijs = 95 + r() * 55, tint = (r() - 0.5) * 16
        const rond = Math.min(kb, kh) * 0.22
        const pad = ctx => {
          ctx.beginPath()
          ctx.roundRect(kx, ky, kb, kh, rond)
          ctx.closePath()
        }
        g.fillStyle = `rgb(${(grijs + tint) | 0},${grijs | 0},${(grijs - tint) | 0})`
        pad(g)
        g.fill()
        // Slijtglans en vuil op de kei.
        for (let k = 0; k < 10; k++) {
          g.fillStyle = `rgba(${r() > 0.5 ? '255,250,240' : '30,28,26'},${0.05 + r() * 0.08})`
          g.fillRect(kx + r() * kb, ky + r() * kh, 2 + r() * 5 * schaal, 1 + r() * 3 * schaal)
        }
        // Hoogte: bolle kei (midden hoog, rand lager) via een radiale gradient.
        const cx = kx + kb / 2, cy = ky + kh / 2
        const grad = hg.createRadialGradient(cx, cy, 0, cx, cy, Math.max(kb, kh) * 0.62)
        grad.addColorStop(0, '#f0f0f0')
        grad.addColorStop(0.75, '#b0b0b0')
        grad.addColorStop(1, '#505050')
        hg.fillStyle = grad
        pad(hg)
        hg.fill()
      }
    }
  }, 3.5)
}

// Fijne structuurlak van gepoedercoat aluminium (alleen normal map). Niet meer op het
// frame gebruikt (de satijnglans komt uit clearcoat), beschikbaar voor andere delen.
export function poedercoat() {
  const c = maakCanvas(256, 256)
  const g = c.getContext('2d')
  const r = rng(19)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 9000; i++) {
    const v = (100 + r() * 60) | 0
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2)
  }
  return normaalUitHoogte(c, 1.2)
}

// Kanaalstructuur van 16 mm meerwandig polycarbonaat: 32 kanalen per herhaling (om de
// 16 px een fijne lijn) plus per kanaal een zachte gradient, zodat de kanalen door de
// melkwitte plaat heen schemeren in plaats van als harde strepen. Met repeat
// PLAAT_BREEDTE / 0.512 wordt één kanaal 16 mm breed.
export function polyKanalen() {
  return canvasTex(512, 16, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 16) {
      // Lichte welving per kanaal: iets lichter naast de kanaalwand, neutraal in het midden.
      const grad = g.createLinearGradient(x, 0, x + 16, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0.06)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0)')
      grad.addColorStop(1, 'rgba(255,255,255,0.06)')
      g.fillStyle = grad
      g.fillRect(x, 0, 16, h)
      g.fillStyle = 'rgba(120,130,140,0.28)'
      g.fillRect(x, 0, 1, h)
    }
  })
}

// Weefsel van screendoek (licht doorzichtig raster).
export function doekWeefsel() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(0,0,0,0.22)'
    for (let i = 0; i < w; i += 4) {
      g.fillRect(i, 0, 1, h)
      g.fillRect(0, i, w, 1)
    }
  }, { srgb: false })
}

// Rotan-vlechtwerk als alphaMap (hangstoel): twee families diagonale lijnen (±45°),
// periode 16 px langs de assen zodat de tegel naadloos herhaalt, lijnbreedte 6 px,
// wit op zwart. Gebruik met alphaTest ≈ 0.5 en DoubleSide.
export function rotan() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000000'
    g.fillRect(0, 0, w, h)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 6
    g.lineCap = 'butt'
    const periode = 16
    for (let i = -w; i <= 2 * w; i += periode) {
      // Familie 1: van linksboven naar rechtsonder; familie 2: gespiegeld.
      g.beginPath(); g.moveTo(i, -2); g.lineTo(i + h + 4, h + 2); g.stroke()
      g.beginPath(); g.moveTo(i, h + 2); g.lineTo(i + h + 4, -2); g.stroke()
    }
  }, { srgb: false })
}

// Bayer-matrix 8 × 8 (geordende dither): waarde k/64 per cel, elke waarde precies één keer.
export function bayer8() {
  let m = [[0]]
  for (let n = 1; n < 8; n *= 2) {
    const uit = []
    for (let y = 0; y < 2 * n; y++) {
      uit.push([])
      for (let x = 0; x < 2 * n; x++) {
        const basis = 4 * m[y % n][x % n]
        uit[y].push(basis + (y < n ? (x < n ? 0 : 2) : (x < n ? 3 : 1)))
      }
    }
    m = uit
  }
  return m
}

// Dither-masker voor gedeeltelijke schaduw (8 × 8, NearestFilter, zonder mipmaps):
// een fractie `dekking` van de cellen is wit. Gebruikt als alphaMap met alphaTest 0.5
// op een MeshDepthMaterial, zodat half-doorzichtige dakplaten een lichte schaduw werpen.
export function dither(dekking) {
  const m = bayer8()
  const t = canvasTex(8, 8, (g, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        g.fillStyle = m[y][x] / 64 < dekking ? '#ffffff' : '#000000'
        g.fillRect(x, y, 1, 1)
      }
    }
  }, { srgb: false })
  t.magFilter = t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.anisotropy = 1
  return t
}

// Houtnerf voor tafelblad / vlonder.
export function hout() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(23)
    g.fillStyle = '#8a6a4a'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 70; i++) {
      const y = r() * h, t = r()
      g.strokeStyle = `rgba(${t > 0.5 ? '60,40,25' : '170,130,90'},${0.15 + r() * 0.2})`
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      g.moveTo(0, y)
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3)
      g.stroke()
    }
  })
}
