import * as THREE from 'three'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { KLEUREN, DAKKEN, DOEK_KLEUREN, vind } from '../options.js'
import { polyKanalen, doekWeefsel, poedercoat } from './textures.js'

const MatContext = createContext(null)
export const MaterialenProvider = MatContext.Provider
export const useMat = () => useContext(MatContext)

// "Fresnel-glas": de doorzichtigheid dimt alleen de diffuse kleur, niet de
// spiegelende reflecties — zo blijft glas helder maar glanst het naar de randen.
function glas(kleur, opacity, roughness = 0.03) {
  const m = new THREE.MeshPhysicalMaterial({
    color: kleur, metalness: 0, roughness, ior: 1.5, specularIntensity: 1,
    transparent: true, opacity, premultipliedAlpha: true, depthWrite: false,
    side: THREE.FrontSide, envMapIntensity: 1.2,
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

// Groenige glasrand (de zijkanten van een glasplaat), voor materiaal-arrays op boxen.
function glasrand() {
  return new THREE.MeshStandardMaterial({ color: '#8fb3a6', roughness: 0.15, transparent: true, opacity: 0.85 })
}

// Doorschijnende plaat (polycarbonaat/doek): DoubleSide in één pass voor goedkope sortering.
function plaat(opties) {
  return new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, forceSinglePass: true, ...opties })
}

function dakMateriaal(id, kanalen) {
  switch (id) {
    case 'polyHelder': return plaat({ color: '#e7f1f7', opacity: 0.42, roughness: 0.25, map: kanalen })
    case 'polyOpaal':  return plaat({ color: '#f6f5f0', opacity: 0.86, roughness: 0.5, map: kanalen, emissive: '#3a3a36', emissiveIntensity: 0.25 })
    case 'polyIr':     return plaat({ color: '#efe3d6', opacity: 0.88, roughness: 0.45, map: kanalen, emissive: '#3b3029', emissiveIntensity: 0.25, sheen: 1, sheenColor: '#f5d9c0' })
    case 'glasMat':    return glas('#f3f6f6', 0.78, 0.55)
    case 'glasGetint': return glas('#59666b', 0.5)
    default:           return glas('#dcecf2', 0.12)
  }
}

// Ondoorzichtige daktypes werpen schaduw; helder glas/poly niet.
const DAK_SCHADUW = { polyOpaal: true, polyIr: true, glasMat: true }

export function useMaterialen(cfg) {
  const kleurHex = vind(KLEUREN, cfg.kleur).hex
  const dakMat = vind(DAKKEN, cfg.dak).mat
  const doekHex = vind(DOEK_KLEUREN, cfg.zonwering.doek).hex

  const vast = useMemo(() => {
    const kanalen = polyKanalen()
    kanalen.repeat.set(1.4, 1)
    const weefsel = doekWeefsel()
    weefsel.repeat.set(30, 30)
    const structuur = poedercoat()
    structuur.repeat.set(3, 3)
    const rand = glasrand()
    const glasHelder = glas('#d8ecf2', 0.1)
    const glasGetint = glas('#4f5b60', 0.45)
    const glasMat = glas('#f4f7f7', 0.78, 0.6)
    return {
      kanalen, weefsel, structuur, rand,
      glasHelder, glasGetint, glasMat,
      // BoxGeometry-volgorde: +x, -x, +y, -y (randen), +z, -z (glasvlakken).
      paneel: {
        helder: [rand, rand, rand, rand, glasHelder, glasHelder],
        getint: [rand, rand, rand, rand, glasGetint, glasGetint],
        mat: [rand, rand, rand, rand, glasMat, glasMat],
      },
      dubbelGlas: glas('#cfe5ec', 0.16),
      polySpie: plaat({ color: '#f2f2ee', opacity: 0.8, roughness: 0.5, map: kanalen }),
      rubber: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.8 }),
      rvs: new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 }),
      lood: new THREE.MeshStandardMaterial({ color: '#5d6266', metalness: 0.2, roughness: 0.6 }),
      led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe2b0', emissiveIntensity: 0 }),
      heater: new THREE.MeshStandardMaterial({ color: '#2a2b2d', emissive: '#ff5a1f', emissiveIntensity: 0, roughness: 0.4 }),
    }
  }, [])

  // Gepoedercoat aluminium: satijnglans met fijne structuur.
  const frame = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: kleurHex, metalness: 0.25, roughness: 0.48, envMapIntensity: 0.9,
    normalMap: vast.structuur, normalScale: new THREE.Vector2(0.18, 0.18),
    clearcoat: 0.25, clearcoatRoughness: 0.5,
  }), [kleurHex, vast.structuur])

  // Koppelstuk: zelfde kleur, iets donkerder zodat de naad zichtbaar is.
  const koppel = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(kleurHex).multiplyScalar(0.8), metalness: 0.3, roughness: 0.45,
  }), [kleurHex])

  const dak = useMemo(() => dakMateriaal(dakMat, vast.kanalen), [dakMat, vast.kanalen])

  const doek = useMemo(() => plaat({
    color: doekHex, roughness: 0.95, opacity: 0.78, alphaMap: vast.weefsel,
  }), [doekHex, vast.weefsel])

  const doekDicht = useMemo(() => new THREE.MeshStandardMaterial({
    color: doekHex, roughness: 0.95, side: THREE.DoubleSide,
  }), [doekHex])

  useEffect(() => () => { frame.dispose(); koppel.dispose() }, [frame, koppel])
  useEffect(() => () => dak.dispose(), [dak])
  useEffect(() => () => { doek.dispose(); doekDicht.dispose() }, [doek, doekDicht])

  return useMemo(() => ({ ...vast, frame, koppel, dak, dakSchaduw: !!DAK_SCHADUW[dakMat], doek, doekDicht }),
    [vast, frame, koppel, dak, dakMat, doek, doekDicht])
}

export const glasVoor = (mat, soort) =>
  soort === 'getint' ? mat.glasGetint : soort === 'mat' ? mat.glasMat : mat.glasHelder

export const paneelVoor = (mat, soort) => mat.paneel[soort] || mat.paneel.helder
