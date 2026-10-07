// Echte foto-PBR-texturen (CC0) uit src/configurator/assets/texturen/<oppervlak>/.
// Vite bundelt de bestanden mee (geen CDN); ze laden als <img>, dus ook onder een
// strenge CSP. Zolang ze laden of als een set ontbreekt, valt de scène terug op de
// procedurele canvas-texturen.
import * as THREE from 'three'
import { useEffect, useState } from 'react'

const BESTANDEN = import.meta.glob('../assets/texturen/*/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' })

const ROLLEN = ['kleur', 'normal', 'ruwheid', 'ao']

export function fotoUrls(oppervlak) {
  const urls = {}
  for (const [pad, url] of Object.entries(BESTANDEN)) {
    const m = pad.match(/texturen\/([^/]+)\/([^/.]+)\.(jpe?g|png|webp)$/)
    if (m && m[1] === oppervlak && ROLLEN.includes(m[2])) urls[m[2]] = url
  }
  return urls
}

// Eén laadbelofte per bestand voor de hele pagina; elke gebruiker krijgt een clone
// (deelt de afbeelding en GPU-upload) met een eigen herhaling.
const cache = new Map()
const loader = new THREE.TextureLoader()
function laad(url, rol) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).then(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
      t.colorSpace = rol === 'kleur' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      return t
    }))
  }
  return cache.get(url)
}

// Geeft { map, normalMap, roughnessMap, aoMap } (alleen wat bestaat) of null zolang
// er niets geladen is. herhaling = [x, y] aantal herhalingen over het oppervlak.
export function useFotoTexturen(oppervlak, herhaling) {
  const [set, setSet] = useState(null)
  const [hx, hy] = herhaling

  useEffect(() => {
    const urls = fotoUrls(oppervlak)
    const rollen = ROLLEN.filter(r => urls[r])
    if (!urls.kleur) return
    let actief = true
    Promise.all(rollen.map(r => laad(urls[r], r)))
      .then(texs => {
        if (!actief) return
        const s = {}
        const naam = { kleur: 'map', normal: 'normalMap', ruwheid: 'roughnessMap', ao: 'aoMap' }
        texs.forEach((t, i) => { s[naam[rollen[i]]] = t.clone() })
        setSet(s)
      })
      .catch(err => console.warn(`Foto-textuur ${oppervlak} niet geladen, terugval op procedureel`, err))
    return () => { actief = false }
  }, [oppervlak])

  useEffect(() => {
    if (!set) return
    // Herhaling gaat via de uv-transformatie; geen nieuwe upload nodig.
    Object.values(set).forEach(t => t.repeat.set(hx, hy))
  }, [set, hx, hy])

  useEffect(() => () => { if (set) Object.values(set).forEach(t => t.dispose()) }, [set])

  return set
}
