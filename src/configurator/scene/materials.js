import * as THREE from 'three'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { KLEUREN, DAKKEN, DOEK_KLEUREN, PLAAT_BREEDTE, vind } from '../options.js'
import { polyKanalen, doekWeefsel, dither } from './textures.js'
import { natHook } from './regenNat.js'
import { MOBIEL } from './kwaliteit.js'

const MatContext = createContext(null)
export const MaterialenProvider = MatContext.Provider
export const useMat = () => useContext(MatContext)

// "Fresnel-glas": de doorzichtigheid dimt alleen de diffuse kleur, niet de
// spiegelende reflecties — zo blijft glas helder maar glanst het naar de randen.
// ior 1.52 = floatglas; envMapIntensity 1.0 (dubbel glas: 1.3, twee ruiten spiegelen).
function glas(kleur, opacity, roughness = 0.03, envMapIntensity = 1.0) {
  const m = new THREE.MeshPhysicalMaterial({
    color: kleur, metalness: 0, roughness, ior: 1.52, specularIntensity: 1,
    transparent: true, opacity, premultipliedAlpha: true, depthWrite: false,
    side: THREE.FrontSide, envMapIntensity,
  })
  m.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <opaque_fragment>',
        'gl_FragColor = vec4( ( totalDiffuse + totalEmissiveRadiance ) * diffuseColor.a + totalSpecular, diffuseColor.a );')
      .replace('#include <premultiplied_alpha_fragment>', '')
  }
  m.customProgramCacheKey = () => 'fresnel-glas'
  return m
}

// Groene polijstrand van 10 mm gehard glas (de zijkanten van een glasplaat), voor materiaal-arrays op boxen.
function glasrand() {
  return new THREE.MeshStandardMaterial({ color: '#79a98f', metalness: 0, roughness: 0.1, transparent: true, opacity: 0.95 })
}

// Doorschijnende plaat (polycarbonaat/doek): DoubleSide in één pass voor goedkope sortering.
function plaat(opties) {
  return new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, forceSinglePass: true, ...opties })
}

// 16 mm opaal polycarbonaat: melkwit met glanzende bovenhuid; de emissie geeft de diffuse
// gloed van onderaf (daglicht dat door de plaat strooit), op mobiel iets zwakker.
const OPAAL = () => ({
  color: '#f4f3ee', opacity: 0.94, roughness: 0.16, metalness: 0, envMapIntensity: 0.6,
  emissive: '#6b6a64', emissiveIntensity: MOBIEL ? 0.12 : 0.22,
})

function dakMateriaal(id, kanalen) {
  switch (id) {
    case 'polyHelder': return plaat({ color: '#eef5f8', opacity: 0.55, roughness: 0.12, map: kanalen })
    case 'polyOpaal':  return plaat({ ...OPAAL(), map: kanalen })
    case 'polyIr':     return plaat({ color: '#ebe4d8', opacity: 0.95, roughness: 0.18, map: kanalen, emissive: '#5c5048', emissiveIntensity: 0.2 })
    case 'glasMat':    return glas('#eef2f1', 0.82, 0.55)
    case 'glasGetint': return glas('#454b4a', 0.52, 0.02)
    default:           return glas('#d8e8e6', 0.14)
  }
}

// Ondoorzichtige daktypes werpen een volle schaduw; helder glas/poly werpt via het
// dither-dieptemateriaal een lichte schaduw (zie DakDiepteMateriaal).
const DAK_SCHADUW = { polyOpaal: true, polyIr: true, glasMat: true }

// Poedercoat aluminium: een diëlektrische satijnlak (metalness ≈ 0) met een dunne, licht
// ruwe clearcoat voor de heldere randglans uit de referentiebeelden. RAL 9007 is een
// metallic lak en krijgt metalness 0.3. Op mobiel geen clearcoat (tweede GGX-lobe).
const POEDERCOAT = () => ({
  metalness: 0.05, roughness: 0.45, specularIntensity: 0.9,
  clearcoat: MOBIEL ? 0 : 0.45, clearcoatRoughness: 0.3, envMapIntensity: 0.8,
})
const metalnessVoor = kleurId => (kleurId === 'ral9007' ? 0.3 : 0.05)

// Dieptemateriaal voor de schaduw van half-doorzichtige dakplaten: een geordende dither
// (Bayer 8 × 8) laat een fractie `dekking` van de cellen schaduw werpen; de zachte
// schaduw (PCSS/PCF) smeert dat uit tot een lichte, egale slagschaduw.
//
// Let op: three (WebGLShadowMap.getDepthMaterial) overschrijft bij ÉLKE schaduwpas
// alphaMap, alphaTest en map van een customDepthMaterial met die van het render-
// materiaal van de mesh. Een alphaMap-dither op dit materiaal werkt daarom nooit; de
// dither zit in de shader zelf, op een wereldraster van `raster` meter, zodat één
// materiaal voor alle platen (en voor elke geometrie) klopt zonder per-plaat repeat.
// `alphaMap` blijft als dither-textuur beschikbaar (API-compatibel: clone/repeat mag),
// maar wordt niet door three leeggemaakt en niet voor de dither gebruikt.
const DAK_DITHER_GLSL = /* glsl */`
float ditherBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float ditherBayer4(vec2 a) { return ditherBayer2(0.5 * a) * 0.25 + ditherBayer2(a); }
float ditherBayer8(vec2 a) { return ditherBayer4(0.5 * a) * 0.25 + ditherBayer2(a); }
`
export class DakDiepteMateriaal extends THREE.MeshDepthMaterial {
  constructor({ dekking = 0.25, raster = 0.03, ...rest } = {}) {
    super({ depthPacking: THREE.RGBADepthPacking, ...rest })
    this.isDakDiepteMateriaal = true
    // Eigen uniform-objecten (niet `uniforms`: dat veld is bij three voorbehouden aan ShaderMaterial).
    this.ditherUniforms = { uDekking: { value: dekking }, uRaster: { value: raster } }
    this._dither = dither(dekking)
  }
  get dekking() { return this.ditherUniforms.uDekking.value }
  set dekking(v) { this.ditherUniforms.uDekking.value = v }
  get raster() { return this.ditherUniforms.uRaster.value }
  set raster(v) { this.ditherUniforms.uRaster.value = v }
  // three zet alphaMap per schaduwpas op die van het rendermateriaal (meestal null): negeren.
  get alphaMap() { return this._dither ?? null }
  set alphaMap(t) { if (t) this._dither = t }
  // alphaTest blijft 0: de dither discard't zelf, een alphaMap-test zou dubbel ditheren.
  get alphaTest() { return 0 }
  set alphaTest(_v) {}
  onBeforeCompile(shader) {
    shader.uniforms.uDekking = this.ditherUniforms.uDekking
    shader.uniforms.uRaster = this.ditherUniforms.uRaster
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWereld;')
      .replace('#include <project_vertex>', /* glsl */`#include <project_vertex>
#ifdef USE_INSTANCING
  vWereld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWereld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWereld;\nuniform float uDekking;\nuniform float uRaster;\n' + DAK_DITHER_GLSL)
      // Raster op xz, met y erbij zodat ook (bijna) verticale vlakken een vlak patroon krijgen.
      .replace('#include <alphatest_fragment>', /* glsl */`#include <alphatest_fragment>
  vec2 ditherCel = floor((vWereld.xz + vWereld.y * 0.5) / uRaster);
  if (ditherBayer8(ditherCel) >= uDekking) discard;`)
  }
  customProgramCacheKey() { return 'dak-dither' }
  copy(bron) {
    super.copy(bron)
    this.ditherUniforms = { uDekking: { value: bron.dekking }, uRaster: { value: bron.raster } }
    // Eigen textuur-kloon (deelt de upload), zodat dispose() van een kloon het origineel niet raakt.
    if (bron._dither) { this._dither = bron._dither.clone(); this._dither.needsUpdate = true }
    return this
  }
  dispose() {
    this._dither?.dispose()
    super.dispose()
  }
}

export function useMaterialen(cfg) {
  const kleurHex = vind(KLEUREN, cfg.kleur).hex
  const dakMat = vind(DAKKEN, cfg.dak).mat
  const doekHex = vind(DOEK_KLEUREN, cfg.zonwering.doek).hex

  const vast = useMemo(() => {
    const kanalen = polyKanalen()
    // 32 kanalen per herhaling van 0,512 m → één kanaal is 16 mm breed op de plaat.
    kanalen.repeat.set(PLAAT_BREEDTE / 0.512, 1)
    const weefsel = doekWeefsel()
    weefsel.repeat.set(30, 30)
    const rand = glasrand()
    const glasHelder = glas('#d7e6e2', 0.14)
    const glasGetint = glas('#454b4a', 0.52, 0.02)
    const glasMat = glas('#eef2f1', 0.82, 0.55)
    return {
      kanalen, weefsel, rand,
      glasHelder, glasGetint, glasMat,
      // BoxGeometry-volgorde: +x, -x, +y, -y (randen), +z, -z (glasvlakken).
      paneel: {
        helder: [rand, rand, rand, rand, glasHelder, glasHelder],
        getint: [rand, rand, rand, rand, glasGetint, glasGetint],
        mat: [rand, rand, rand, rand, glasMat, glasMat],
      },
      // HR++ dubbel glas (schuifpui, woningpui): twee ruiten = sterkere spiegeling.
      dubbelGlas: glas('#cde0dc', 0.2, 0.03, 1.3),
      polySpie: plaat({ ...OPAAL(), map: kanalen }),
      rubber: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.8 }),
      rvs: new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 }),
      lood: new THREE.MeshStandardMaterial({ color: '#5d6266', metalness: 0.2, roughness: 0.6 }),
      led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe2b0', emissiveIntensity: 0 }),
      heater: new THREE.MeshStandardMaterial({ color: '#2a2b2d', emissive: '#ff5a1f', emissiveIntensity: 0, roughness: 0.4 }),
      // Doorzichtige PVC-afvoerbuis in de doorkijk-staander (renderOrder 5.5, depthWrite uit).
      pvc: new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.55, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
      // Zwart-aluminium komgreep/handgreep van schuifwanden.
      greep: new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.8, roughness: 0.3 }),
      // Schaduw-dither voor dakplaten: helder glas/poly 25 %, opaal/mat 60 % dekking.
      dakDiepte: new DakDiepteMateriaal({ dekking: 0.25 }),
      dakDiepteOpaal: new DakDiepteMateriaal({ dekking: 0.6 }),
    }
  }, [])
  useEffect(() => () => {
    vast.kanalen.dispose(); vast.weefsel.dispose()
    ;[vast.rand, vast.glasHelder, vast.glasGetint, vast.glasMat, vast.dubbelGlas, vast.polySpie, vast.rubber, vast.rvs,
      vast.lood, vast.led, vast.heater, vast.pvc, vast.greep, vast.dakDiepte, vast.dakDiepteOpaal].forEach(m => m.dispose())
  }, [vast])

  // Gepoedercoat aluminium: één keer aanmaken en alleen kleur/metalness bijwerken,
  // zodat een kleurwissel geen shader-hercompilatie kost. natHook maakt het frame bij
  // regen donkerder en glanzender (zonder plassen).
  const frame = useMemo(() => natHook(new THREE.MeshPhysicalMaterial(POEDERCOAT())), [])
  // Koppelstuk: zelfde lak, iets donkerder zodat de naad zichtbaar is.
  const koppel = useMemo(() => natHook(new THREE.MeshPhysicalMaterial(POEDERCOAT())), [])
  // Doorkijk-staander (regenmodus): hetzelfde profiel half doorzichtig, zodat buis en water te zien zijn.
  const frameDoorkijk = useMemo(() => natHook(new THREE.MeshPhysicalMaterial({
    ...POEDERCOAT(), transparent: true, opacity: 0.3, depthWrite: false,
  })), [])
  // Synchroon zetten (vóór de eerste render), niet pas in een effect.
  frame.color.set(kleurHex)
  koppel.color.set(kleurHex).multiplyScalar(0.94)
  frameDoorkijk.color.set(kleurHex)
  frame.metalness = koppel.metalness = frameDoorkijk.metalness = metalnessVoor(cfg.kleur)

  const dak = useMemo(() => dakMateriaal(dakMat, vast.kanalen), [dakMat, vast.kanalen])

  const doek = useMemo(() => plaat({ roughness: 0.95, opacity: 0.78, alphaMap: vast.weefsel }), [vast.weefsel])
  const doekDicht = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide }), [])
  doek.color.set(doekHex)
  doekDicht.color.set(doekHex)

  useEffect(() => () => { frame.dispose(); koppel.dispose(); frameDoorkijk.dispose() }, [frame, koppel, frameDoorkijk])
  useEffect(() => () => dak.dispose(), [dak])
  useEffect(() => () => { doek.dispose(); doekDicht.dispose() }, [doek, doekDicht])

  return useMemo(() => ({ ...vast, frame, koppel, frameDoorkijk, dak, dakSchaduw: !!DAK_SCHADUW[dakMat], doek, doekDicht }),
    [vast, frame, koppel, frameDoorkijk, dak, dakMat, doek, doekDicht])
}

export const glasVoor = (mat, soort) =>
  soort === 'getint' ? mat.glasGetint : soort === 'mat' ? mat.glasMat : mat.glasHelder

export const paneelVoor = (mat, soort) => mat.paneel[soort] || mat.paneel.helder
