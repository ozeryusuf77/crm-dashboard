import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// Laat een waarde vloeiend naar `doel` bewegen en roept elke frame `toepassen(v)` aan.
export function useAnim(doel, toepassen, snelheid = 2.4) {
  const v = useRef(doel)
  useFrame((_, dt) => {
    v.current = THREE.MathUtils.damp(v.current, doel, snelheid, Math.min(dt, 0.1))
    toepassen(v.current)
  })
}

// Klik-handlers voor bedienbare onderdelen (negeert klikken na het slepen van de camera).
export function klikbaar(onToggle) {
  if (!onToggle) return {}
  return {
    onClick: e => {
      if (e.delta > 6) return
      e.stopPropagation()
      onToggle()
    },
    onPointerOver: e => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
    },
  }
}
