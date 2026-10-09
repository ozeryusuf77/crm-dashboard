// Echte foto-PBR-texturen (CC0, zie assets/BRONNEN.md) uit src/configurator/assets/texturen/<oppervlak>/.
// Vite bundelt de bestanden mee (geen CDN); ze laden als <img>, dus ook onder een
// strenge CSP. Zolang ze laden of als een set ontbreekt, valt de scène terug op de
// procedurele canvas-texturen.
import * as THREE from 'three'
import { useEffect, useState } from 'react'
import { MOBIEL } from './kwaliteit.js'

const BESTANDEN = import.meta.glob('../assets/texturen/*/*.jpg', { eager: true, query: '?url', import: 'default' })

// Per oppervlak: kleur + normal (2K, of *_1k op mobiel) en arm (R = AO, G = ruwheid).
export function fotoUrls(oppervlak) {
  const pak = naam => BESTANDEN[`../assets/texturen/${oppervlak}/${naam}.jpg`]
  const kies = rol => (MOBIEL ? pak(`${rol}_1k`) || pak(rol) : pak(rol) || pak(`${rol}_1k`))
  return { kleur: kies('kleur'), normal: kies('normal'), arm: pak('arm') }
}

// Eén laadbelofte per bestand voor de hele pagina; elke gebruiker krijgt een clone
// (deelt de afbeelding en GPU-upload) met een eigen herhaling.
const cache = new Map()
const loader = new THREE.TextureLoader()
export function laadAfbeelding(url, srgb) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).then(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      return t
    }))
  }
  return cache.get(url)
}

// Geeft { map, normalMap, roughnessMap, aoMap } of null zolang de set niet geladen is.
// herhaling = [x, y] aantal herhalingen over het oppervlak; verschuiving = [x, y] in herhalingen
// (om bijvoorbeeld de lagen van een topgevel op de muur eronder te laten aansluiten).
export function useFotoTexturen(oppervlak, herhaling, verschuiving = [0, 0]) {
  const [set, setSet] = useState(null)
  const [hx, hy] = herhaling
  const [vx, vy] = verschuiving

  useEffect(() => {
    const urls = fotoUrls(oppervlak)
    if (!urls.kleur) return
    let actief = true
    Promise.all([
      laadAfbeelding(urls.kleur, true),
      urls.normal ? laadAfbeelding(urls.normal, false) : null,
      urls.arm ? laadAfbeelding(urls.arm, false) : null,
    ])
      .then(([kleur, normal, arm]) => {
        if (!actief) return
        const s = { map: kleur.clone() }
        if (normal) s.normalMap = normal.clone()
        // AO en ruwheid delen één textuur (verschillende kanalen).
        if (arm) s.roughnessMap = s.aoMap = arm.clone()
        setSet(s)
      })
      .catch(err => console.warn(`Foto-textuur ${oppervlak} niet geladen, terugval op procedureel`, err))
    return () => { actief = false }
  }, [oppervlak])

  useEffect(() => {
    if (!set) return
    // Herhaling gaat via de uv-transformatie; geen nieuwe upload nodig.
    new Set(Object.values(set)).forEach(t => { t.repeat.set(hx, hy); t.offset.set(vx, vy) })
  }, [set, hx, hy, vx, vy])

  useEffect(() => () => { if (set) new Set(Object.values(set)).forEach(t => t.dispose()) }, [set])

  return set
}
