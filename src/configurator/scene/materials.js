import * as THREE from 'three'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { KLEUREN, DAKKEN, DOEK_KLEUREN, vind } from '../options.js'
import { polyKanalen, doekWeefsel } from './textures.js'

const MatContext = createContext(null)
export const MaterialenProvider = MatContext.Provider
export const useMat = () => useContext(MatContext)

function glas(kleur, opacity, roughness = 0.03) {
  return new THREE.MeshPhysicalMaterial({
    color: kleur, transparent: true, opacity, roughness, metalness: 0,
    envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.05,
  })
}

function dakMateriaal(id, kanalen) {
  switch (id) {
    case 'polyHelder': return new THREE.MeshPhysicalMaterial({ color: '#e7f1f7', transparent: true, opacity: 0.42, roughness: 0.25, map: kanalen, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1 })
    case 'polyOpaal':  return new THREE.MeshPhysicalMaterial({ color: '#f6f5f0', transparent: true, opacity: 0.86, roughness: 0.5, map: kanalen, side: THREE.DoubleSide, depthWrite: false, emissive: '#3a3a36', emissiveIntensity: 0.25 })
    case 'polyIr':     return new THREE.MeshPhysicalMaterial({ color: '#efe3d6', transparent: true, opacity: 0.88, roughness: 0.45, map: kanalen, side: THREE.DoubleSide, depthWrite: false, emissive: '#3b3029', emissiveIntensity: 0.25, sheen: 1, sheenColor: '#f5d9c0' })
    case 'glasMat':    return glas('#f3f6f6', 0.78, 0.55)
    case 'glasGetint': return glas('#59666b', 0.55)
    default:           return glas('#dcecf2', 0.22)
  }
}

export function useMaterialen(cfg) {
  const kleurHex = vind(KLEUREN, cfg.kleur).hex
  const dakMat = vind(DAKKEN, cfg.dak).mat
  const doekHex = vind(DOEK_KLEUREN, cfg.zonwering.doek).hex

  const vast = useMemo(() => {
    const kanalen = polyKanalen()
    kanalen.repeat.set(1.4, 1)
    const weefsel = doekWeefsel()
    weefsel.repeat.set(30, 30)
    return {
      kanalen, weefsel,
      glasHelder: glas('#d8ecf2', 0.2),
      glasGetint: glas('#4f5b60', 0.5),
      glasMat: glas('#f4f7f7', 0.8, 0.6),
      dubbelGlas: glas('#cfe5ec', 0.26),
      polySpie: new THREE.MeshPhysicalMaterial({ color: '#f2f2ee', transparent: true, opacity: 0.8, roughness: 0.5, map: kanalen, side: THREE.DoubleSide, depthWrite: false }),
      rubber: new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.8 }),
      rvs: new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 }),
      led: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe2b0', emissiveIntensity: 0 }),
      heater: new THREE.MeshStandardMaterial({ color: '#2a2b2d', emissive: '#ff5a1f', emissiveIntensity: 0, roughness: 0.4 }),
    }
  }, [])

  const frame = useMemo(() => new THREE.MeshStandardMaterial({
    color: kleurHex, metalness: 0.35, roughness: 0.42, envMapIntensity: 0.9,
  }), [kleurHex])

  const dak = useMemo(() => dakMateriaal(dakMat, vast.kanalen), [dakMat, vast.kanalen])

  const doek = useMemo(() => new THREE.MeshStandardMaterial({
    color: doekHex, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.78,
    alphaMap: vast.weefsel, depthWrite: false,
  }), [doekHex, vast.weefsel])

  const doekDicht = useMemo(() => new THREE.MeshStandardMaterial({
    color: doekHex, roughness: 0.95, side: THREE.DoubleSide,
  }), [doekHex])

  useEffect(() => () => frame.dispose(), [frame])
  useEffect(() => () => dak.dispose(), [dak])
  useEffect(() => () => { doek.dispose(); doekDicht.dispose() }, [doek, doekDicht])

  return useMemo(() => ({ ...vast, frame, dak, doek, doekDicht }), [vast, frame, dak, doek, doekDicht])
}

export const glasVoor = (mat, soort) =>
  soort === 'getint' ? mat.glasGetint : soort === 'mat' ? mat.glasMat : mat.glasHelder
