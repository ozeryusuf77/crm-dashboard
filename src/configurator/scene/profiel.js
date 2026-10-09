// Aluminium profielen met licht afgeronde langskanten. Per doorsnede wordt één
// geometrie (lengte 1, langs lokale z) gecachet; de lengte gaat via scale.
import * as THREE from 'three'
import { createElement } from 'react'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const cache = new Map()

function afgerondeRechthoek(b, h, r) {
  const s = new THREE.Shape()
  const x = -b / 2, y = -h / 2
  r = Math.min(r, b / 2 - 1e-4, h / 2 - 1e-4)
  s.moveTo(x + r, y)
  s.lineTo(x + b - r, y)
  s.absarc(x + b - r, y + r, r, -Math.PI / 2, 0)
  s.lineTo(x + b, y + h - r)
  s.absarc(x + b - r, y + h - r, r, 0, Math.PI / 2)
  s.lineTo(x + r, y + h)
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  return s
}

// Geometrie met doorsnede b (lokale x) × h (lokale y), lengte 1 langs lokale z.
export function profielGeom(b, h, r = 0.004) {
  const k = `${b.toFixed(4)}|${h.toFixed(4)}|${r}`
  if (!cache.has(k)) {
    const g = new THREE.ExtrudeGeometry(afgerondeRechthoek(b, h, r), { depth: 1, bevelEnabled: false, curveSegments: 3 })
    g.translate(0, 0, -0.5)
    const glad = toCreasedNormals(g, Math.PI / 4)
    g.dispose()
    cache.set(k, glad)
  }
  return cache.get(k)
}

// Oriëntatie van de lengteas: 'z' (diepte), 'x' (breedte) of 'y' (verticaal).
// Bij 'x' is b de maat in z; bij 'y' is b de maat in x en h de maat in z.
const AS_ROTATIE = { z: [0, 0, 0], x: [0, Math.PI / 2, 0], y: [-Math.PI / 2, 0, 0] }

export function Balk({ b, h, lengte, as = 'z', r = 0.004, position, rotation, mat, schaduw = true, ...rest }) {
  if (lengte <= 0.001) return null
  return createElement('group', { position, rotation, ...rest },
    createElement('mesh', {
      geometry: profielGeom(b, h, r), material: mat, rotation: AS_ROTATIE[as],
      scale: [1, 1, lengte], castShadow: schaduw, receiveShadow: true,
    }))
}
