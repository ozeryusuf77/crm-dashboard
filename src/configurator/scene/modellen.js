// Rekwisietmodellen (CC0, Poly Haven — zie public/modellen/LICENTIE.txt) laden met three's eigen
// GLTFLoader: zonder Draco/meshopt/KTX2-decoders en zonder drei's useGLTF (dat instantieert
// WebAssembly voor meshopt en wijst een Draco-decoderpad op gstatic aan — beide onmogelijk onder
// de strenge CSP). De modellen staan als .gltf + .bin + losse jpg/png in
//   public/modellen/<naam>/<naam>.gltf          (set 'hoog', desktop)
//   public/modellen/laag/<naam>/<naam>.gltf     (set 'laag', mobiel)
// zodat alles same-origin laadt: fetch voor .gltf/.bin (connect-src 'self'), <img> voor de
// afbeeldingen (img-src 'self'); geen blob- of data-URI's. De bestanden vereisen alleen
// KHR_mesh_quantization (de boom ook KHR_texture_transform), beide native in three r170.
//
// Gebruik: <Suspense><Model naam="struik_groot" position={[x, 0, z]} rotation={[0, yaw, 0]} /></Suspense>
// binnen een <Foutgrens>, zodat een mislukte lading alleen dat model verbergt. Elk Model krijgt
// een clone van de geladen scene (deelt geometrie en texturen op de GPU); useLoader cachet per URL.
import * as THREE from 'three'
import { createElement, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MOBIEL, REKWISIETEN } from './kwaliteit.js'

export const MODELNAMEN = [
  'boom_loofboom', 'struik_groot', 'struik_klein', 'struik_laag',
  'potplant_hoog', 'potplant_terracotta', 'tuinset_bistro', 'tuinbank_hout', 'plantenbak_hout',
]
export const SETS = ['hoog', 'laag']

// URL van een model in de gevraagde set; BASE_URL eindigt in Vite altijd op '/'.
export function modelUrl(naam, set = REKWISIETEN.set) {
  return `${import.meta.env.BASE_URL}modellen/${set === 'laag' ? 'laag/' : ''}${naam}/${naam}.gltf`
}

// GLTFLoader-plugin: afbeeldingen via TextureLoader (<img src="…">) in plaats van de standaard
// ImageBitmapLoader (fetch + createImageBitmap). Voor same-origin bestanden zijn beide routes
// toegestaan; de <img>-route is de extra zekerheid voor een CSP waarvan connect-src strenger is
// dan img-src. Texturen met een extensie (webp/avif/ktx2) blijven aan de standaardplugins.
class ImgTexturen {
  constructor(parser) {
    this.parser = parser
    this.name = 'CSP_IMG_TEXTUREN'
    this.loader = new THREE.TextureLoader(parser.options.manager)
    this.loader.setCrossOrigin(parser.options.crossOrigin)
  }
  loadTexture(i) {
    const def = this.parser.json.textures[i]
    if (def.source === undefined || (def.extensions && Object.keys(def.extensions).length)) return null
    return this.parser.loadTextureImage(i, def.source, this.loader)
  }
}
const maakImgTexturen = parser => new ImgTexturen(parser)
// Stabiele callback: GLTFLoader.register slaat een al geregistreerde functie over, en useLoader
// roept deze functie bij elke lading opnieuw aan op dezelfde (gememoriseerde) loader.
export const zonderDecoders = loader => { loader.register(maakImgTexturen) }

const TEXTUUR_VELDEN = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']

// Materialen één keer per geladen gltf klaarmaken (clones delen de materialen):
// bladeren (alphaMode MASK → alphaTest 0.5) iets lager op 0.45 tegen 'mip-erosie' op afstand,
// zonder transparant-sortering; anisotropie op de kleurkaarten; omgevingsreflectie gedempt.
const voorbereid = new WeakSet()
function bereidMaterialenVoor(gltf) {
  if (voorbereid.has(gltf)) return
  voorbereid.add(gltf)
  gltf.scene.traverse(o => {
    if (!o.isMesh) return
    for (const m of [].concat(o.material)) {
      if (m.alphaTest > 0) {
        m.alphaTest = 0.45
        m.transparent = false
        m.depthWrite = true
      }
      if (m.map) m.map.anisotropy = MOBIEL ? 2 : 4
      m.envMapIntensity = 0.7
      m.needsUpdate = true
    }
  })
}

// Clone van de geladen scene voor één plaatsing; schaduw per instantie instelbaar.
function maakInstantie(gltf, schaduw) {
  bereidMaterialenVoor(gltf)
  const scene = gltf.scene.clone(true)
  scene.traverse(o => {
    if (!o.isMesh) return
    o.castShadow = schaduw
    o.receiveShadow = true
  })
  return scene
}

// Geladen gltf's per URL, zodat ruimOp() de GPU-bronnen kan vrijgeven (useLoader heeft geen peek).
const GELADEN = new Map()

// Laadt (met Suspense) het model en geeft een eigen clone terug. `schaduw` bepaalt castShadow
// van alle meshes (standaard de rekwisietenset: bladplanten op mobiel geen schaduw).
export function useModel(naam, set = REKWISIETEN.set, { schaduw = REKWISIETEN.schaduwPlanten } = {}) {
  const url = modelUrl(naam, set)
  const gltf = useLoader(GLTFLoader, url, zonderDecoders)
  GELADEN.set(url, gltf)
  return useMemo(() => maakInstantie(gltf, schaduw), [gltf, schaduw])
}

// <Model naam set position rotation scale schaduw /> → <primitive>. rotation mag ook één getal
// zijn (draaiing om de y-as in radialen). Moet in een <Suspense> staan.
export function Model({ naam, set, position, rotation, scale, schaduw, ...rest }) {
  const object = useModel(naam, set, schaduw === undefined ? undefined : { schaduw })
  const rot = typeof rotation === 'number' ? [0, rotation, 0] : rotation
  return createElement('primitive', { object, position, rotation: rot, scale, ...rest })
}

// Vooraf in de cache laden (bijv. voor het standpunt dat als eerste in beeld komt); de
// <Model>-componenten met dezelfde naam/set tonen dan zonder te wachten (useLoader.preload
// geeft niets terug, de lading loopt op de achtergrond).
export function laadVooraf(namen, set = REKWISIETEN.set) {
  for (const naam of [].concat(namen)) useLoader.preload(GLTFLoader, modelUrl(naam, set), zonderDecoders)
}

// Geeft geometrie, materialen en texturen van niet meer gebruikte modellen vrij en haalt ze uit de
// useLoader-cache. `namen` zijn modelnamen (in `set`) of complete URL's uit modelUrl(). Clones
// delen de bronnen met het origineel, dus alleen aanroepen als geen enkele instantie meer in de
// scène staat. Bij de boom (KHR_texture_transform) heeft elk materiaal eigen textuurklonen; die
// delen de upload met de bron, dus per materiaal disposen maakt alles vrij.
export function ruimOp(namen, set = REKWISIETEN.set) {
  for (const naam of [].concat(namen)) {
    const url = naam.endsWith('.gltf') ? naam : modelUrl(naam, set)
    const gltf = GELADEN.get(url)
    if (gltf) {
      gltf.scene.traverse(o => {
        if (!o.isMesh) return
        o.geometry.dispose()
        for (const m of [].concat(o.material)) {
          for (const veld of TEXTUUR_VELDEN) m[veld]?.dispose()
          m.dispose()
        }
      })
      GELADEN.delete(url)
    }
    useLoader.clear(GLTFLoader, url)
  }
}
