// Gedeelde uniforms voor de regenmodus. Alle shaders en materialen verwijzen naar
// dezelfde { value }-objecten; alleen RegenRegie (Regen.jsx) schrijft ze per frame,
// Licht.jsx en de natte materialen (regenNat.js) lezen ze. Geen React-state per frame.
import * as THREE from 'three'

export const REGEN = {
  uTijd: { value: 0 },      // seconden sinds de start van de regen (loopt door)
  uRegen: { value: 0 },     // 0..1 zichtbaarheid van de regenval
  uNat: { value: 0 },       // 0..1 natheid van oppervlakken (donkerder, glanzender)
  uDakwater: { value: 0 },  // 0..1 waterlaag op het dak
  uGoot: { value: 0 },      // 0..1 waterband in de goot
  uVul: { value: 0 },       // 0..1 vulling van de waterkolom in de staander
  uSpetters: { value: 0 },  // 0..1 spetters bij de uitloop
  uPlas: { value: 0 },      // 0..1 plas op de grond bij de uitloop
  uWind: { value: new THREE.Vector3(0.9, 0, 0.35) }, // m/s, drijft de regenval schuin
}
