// Procedurele canvas-texturen, zodat de configurator geen externe bestanden nodig heeft.
import * as THREE from 'three'

function canvasTex(w, h, teken, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  teken(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Eenvoudige deterministische ruis zodat elke render er hetzelfde uitziet.
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export function baksteen() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(7)
    g.fillStyle = '#b9b2a6'
    g.fillRect(0, 0, w, h)
    const rijen = 16, kolommen = 4
    const bh = h / rijen, bw = w / kolommen
    for (let y = 0; y < rijen; y++) {
      const offset = y % 2 ? bw / 2 : 0
      for (let x = -1; x <= kolommen; x++) {
        const t = r()
        const rood = 112 + t * 34, groen = 58 + t * 18, blauw = 46 + t * 12
        g.fillStyle = `rgb(${rood | 0},${groen | 0},${blauw | 0})`
        g.fillRect(x * bw + offset + 3, y * bh + 3, bw - 6, bh - 6)
      }
    }
  })
}

export function tegels() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(3)
    g.fillStyle = '#8f8a82'
    g.fillRect(0, 0, w, h)
    const n = 4, s = w / n
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const t = r() * 18
        g.fillStyle = `rgb(${(172 + t) | 0},${(167 + t) | 0},${(158 + t) | 0})`
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4)
      }
    }
  })
}

export function gras() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(11)
    g.fillStyle = '#5c8a3a'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 5000; i++) {
      const t = r()
      g.fillStyle = `rgba(${(60 + t * 50) | 0},${(110 + t * 50) | 0},${(35 + t * 25) | 0},0.55)`
      g.fillRect(r() * w, r() * h, 1.5, 3)
    }
  })
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
