// Natte oppervlakken bij regen: een onBeforeCompile-injectie voor MeshStandard- en
// MeshPhysicalMaterial die het oppervlak donkerder en glanzender maakt naarmate
// REGEN.uNat stijgt en (optioneel) plassen in wereldcoördinaten tekent. De plassen
// liggen vast in de wereld (vWereld.xz), dus ze blijven op hun plek bij camerabeweging
// en lopen door over tegelnaden. Geen extra draw calls; alleen wat ALU per fragment.
import { REGEN } from './regenUniforms.js'

// Hash + bilineaire value-noise, één octaaf. Naam 'ruis' botst niet met three's chunks.
export const RUIS_GLSL = /* glsl */`
float ruisHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruis(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ruisHash(i), ruisHash(i + vec2(1.0, 0.0)), f.x),
             mix(ruisHash(i + vec2(0.0, 1.0)), ruisHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`

// Wereldpositie uit `transformed` (na skinning/displacement), met instancing-ondersteuning.
// Niet uit `worldPosition` van three: die bestaat alleen onder envmap/shadow/transmission-defines.
export const WERELD_VERTEX_GLSL = /* glsl */`
#ifdef USE_INSTANCING
  vWereld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWereld = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`

// Plasmasker: twee octaven ruis op het wereld-xz-vlak, alleen bij `plassen`.
const PLAS_GLSL = plassen => plassen
  ? 'smoothstep(0.58, 0.72, 0.6 * ruis(vWereld.xz * 0.7 + 3.1) + 0.4 * ruis(vWereld.xz * 1.6 + 7.0)) * uNat'
  : '0.0'

function maakNatShader(plassen) {
  const fn = shader => {
    // Dezelfde { value }-objecten als REGEN: één schrijver, alle materialen lezen mee.
    shader.uniforms.uNat = REGEN.uNat
    shader.uniforms.uTijd = REGEN.uTijd
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWereld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + WERELD_VERTEX_GLSL)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vWereld;\nuniform float uNat;\nuniform float uTijd;\n' + RUIS_GLSL)
      // color_fragment komt in three vóór roughnessmap_fragment: plas hier declareren.
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
  float plas = ${PLAS_GLSL(plassen)};
  diffuseColor.rgb *= mix(1.0, 0.62, uNat) * mix(1.0, 0.55, plas);`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
  roughnessFactor *= mix(1.0, 0.45, uNat);
  roughnessFactor = mix(roughnessFactor, 0.04, plas);`)
      // In een plas kijkt de normaal 'omhoog' (view-space) met een kleine, bewegende rimpel.
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
  if (plas > 0.0) {
    vec3 natOmhoog = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec2 natRimpel = vec2(sin(vWereld.x * 41.0 + uTijd * 7.0), cos(vWereld.z * 37.0 - uTijd * 6.0)) * 0.03 * plas;
    normal = normalize(mix(normal, natOmhoog + vec3(natRimpel, 0.0), plas));
  }`)
  }
  return fn
}

// Eén functie-instantie per variant, zodat React-props en three's programcache stabiel blijven.
const SHADERS = { 0: maakNatShader(false), 1: maakNatShader(true) }
const SLEUTELS = { 0: () => 'nat-0', 1: () => 'nat-1' }

// onBeforeCompile-functie voor een materiaal; `plassen` tekent plasvlekken (alleen op vlakke grond).
export const natShader = plassen => SHADERS[plassen ? 1 : 0]

// Programcache-sleutel, verplicht bij onBeforeCompile op gedeelde materialen.
export const natKey = plassen => `nat-${plassen ? 1 : 0}`

// Stabiele functie voor `customProgramCacheKey` (voor React-props op <meshStandardMaterial>).
export const natKeyFn = plassen => SLEUTELS[plassen ? 1 : 0]

// Zet de hook op een bestaand materiaal (frame, koppel, eigen materialen). Geeft het materiaal terug.
export function natHook(material, { plassen = false } = {}) {
  material.onBeforeCompile = natShader(plassen)
  material.customProgramCacheKey = natKeyFn(plassen)
  material.needsUpdate = true
  return material
}
