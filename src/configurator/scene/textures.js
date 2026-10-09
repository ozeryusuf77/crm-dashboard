// Procedurele canvas-texturen (kleur + normal map), zodat de configurator geen
// externe bestanden nodig heeft en toch diepte/structuur in het licht toont.
import * as THREE from 'three'

function maakCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function naarTexture(canvas, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function canvasTex(w, h, teken, opties) {
  const c = maakCanvas(w, h)
  teken(c.getContext('2d'), w, h)
  return naarTexture(c, opties)
}

// Eenvoudige deterministische ruis zodat elke render er hetzelfde uitziet.
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// Zet een hoogtekaart (grijswaarden, licht = hoog) om naar een tangent-space normal map.
function normaalUitHoogte(hoogte, sterkte = 2) {
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

// Waalformaat baksteen (21 × 5 cm) in halfsteensverband met verdiepte voegen.
// Eén tegel van de texture = 4 stenen breed × 16 lagen hoog ≈ 0,88 × 0,9 m.
export function baksteen() {
  return pbrSet(512, 512, (g, hg, w, h) => {
    const r = rng(7)
    g.fillStyle = '#a49c90'
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

// Fijne structuurlak van gepoedercoat aluminium (alleen normal map).
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

// Kanaalstructuur van meerwandig polycarbonaat (lichtere/donkere strepen).
export function polyKanalen() {
  return canvasTex(256, 16, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = 'rgba(160,170,180,0.55)'
      g.fillRect(x, 0, 1.5, h)
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
