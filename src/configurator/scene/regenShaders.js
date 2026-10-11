// GLSL-strings voor de regenmodus (Regen.jsx). Alles is GLSL ES 1.0 (texture2D,
// attribute/varying), want de ShaderMaterials hebben geen glslVersion. three levert
// zelf `cameraPosition`, `viewMatrix`, `modelViewMatrix`, `projectionMatrix` en
// `normalMatrix`; die worden hier bewust NIET opnieuw gedeclareerd (dubbele
// declaratie = compilefout). Elke fragment-shader eindigt met three's tonemapping- en
// kleurruimte-chunks, zodat de kleuren gelijk lopen met de MeshStandard-materialen.
//
// Gedeelde uniforms (REGEN in regenUniforms.js): uTijd, uRegen, uWind, uVul, uSpetters.

const AFSLUITING = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`

// ── Regenval ────────────────────────────────────────────────────────────────────
// Eén quad per druppelstreep, in een doos (2·uStraal × uHoogte × 2·uStraal) die met de
// camera meereist en in alle richtingen wrapt. Strepen vallen met hun eigen snelheid,
// drijven mee met de wind en worden ingeklapt (vA = 0) zodra ze onder het dakvlak
// (uDak = xMin, xMax, zMin, zMax; uDakY = hoogte op zMin, tan helling) of in de woning
// (uHuis = xMin, xMax, zMin, zMax tot hoogte uHuisY; door de pui zou je ze anders binnen
// zien vallen) terechtkomen. Het quad staat als billboard om de valrichting naar de camera gedraaid.
export const REGENVAL_VERT = /* glsl */`
attribute vec3 aOffset;   // startpositie in de doos [0, 2R] × [0, H] × [0, 2R]
attribute vec2 aEig;      // x = valsnelheid (m/s), y = streeplengte (m)
uniform float uTijd;
uniform float uRegen;
uniform float uStraal;
uniform float uHoogte;
uniform float uBodem;
uniform float uBreedte;
uniform vec3 uWind;
uniform vec4 uDak;
uniform vec2 uDakY;
uniform vec4 uHuis;
uniform float uHuisY;
varying vec2 vUv;
varying float vA;
float inDoos(vec4 doos, vec3 c, float top) {
  return step(doos.x, c.x) * step(c.x, doos.y) * step(doos.z, c.z) * step(c.z, doos.w) * step(c.y, top);
}
void main() {
  vec3 val = vec3(uWind.x, -aEig.x, uWind.z);
  vec3 c;
  c.y = mod(aOffset.y - uTijd * aEig.x, uHoogte) + uBodem;
  vec2 drift = aOffset.xz + uWind.xz * uTijd - cameraPosition.xz;
  c.xz = mod(drift, 2.0 * uStraal) - uStraal + cameraPosition.xz;
  float dakY = uDakY.x - (c.z - uDak.z) * uDakY.y;
  float droog = max(inDoos(uDak, c, dakY), inDoos(uHuis, c, uHuisY));
  vec3 as = normalize(val);
  vec3 naarCam = cameraPosition - c;
  float d = max(length(naarCam), 0.001);
  vec3 zij = normalize(cross(as, naarCam / d) + vec3(1e-4, 0.0, 0.0));
  vec3 p = c + as * ((position.y + 0.5) * aEig.y) + zij * (position.x * uBreedte * (1.0 + d * 0.04));
  vA = uRegen * (1.0 - droog) * smoothstep(0.3, 1.2, d) * (1.0 - smoothstep(uStraal * 0.6, uStraal, d));
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

// Zachte streep: dwars een parabool, in de lengte een korte kop en een lange staart.
export const REGENVAL_FRAG = /* glsl */`
uniform vec3 uKleur;
varying vec2 vUv;
varying float vA;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float a = (1.0 - x * x) * smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
  gl_FragColor = vec4(uKleur, a * vA * 0.42);
  ${AFSLUITING}
}
`

// ── Druppels langs de gootrand / voorrand (alleen desktop) ──────────────────────
// Vallen versnellend van (aX, uY0, uZ) naar de grond; per cyclus beslist een hash of
// de druppel meedoet, zodat het druppen onregelmatig blijft. Zelfde fragment als regenval.
export const DRUPPEL_VERT = /* glsl */`
attribute float aX;
attribute float aFase;
uniform float uTijd;
uniform float uRegen;
uniform float uY0;
uniform float uZ;
uniform float uBodem;
varying vec2 vUv;
varying float vA;
void main() {
  float cyc = uTijd * 0.9 + aFase;
  float t = fract(cyc);
  float actief = step(0.55, fract(aFase * 13.7 + floor(cyc) * 0.37));
  float y = uY0 - (uY0 - uBodem) * t * t;
  float lengte = 0.05 + 0.05 * t;
  vec3 c = vec3(aX, y, uZ);
  vec3 as = vec3(0.0, -1.0, 0.0);
  vec3 naarCam = cameraPosition - c;
  float d = max(length(naarCam), 0.001);
  vec3 zij = normalize(cross(as, naarCam / d) + vec3(1e-4, 0.0, 0.0));
  vec3 p = c + as * ((position.y + 0.5) * lengte) + zij * (position.x * 0.012 * (1.0 + d * 0.04));
  vA = uRegen * actief * (1.0 - t) * 0.6;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

// ── Waterstraal / waterkolom (TubeGeometry langs a.pad) ─────────────────────────
// uv.x loopt van de gootuitloop (0) naar de grond (1); het vulfront uVul discard't
// alles voorbij de vulling, zodat de kolom zichtbaar van boven naar beneden vult.
// Na de mond (uMond) 'parelt' de vrije straal licht; de stroomtextuur scrolt mee. De
// straal dooft mee met het gootwater (uGoot): bij uitschakelen vervaagt de kolom in
// plaats van van onderaf 'terug te trekken'.
export const STRAAL_VERT = /* glsl */`
uniform float uTijd;
uniform float uMond;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;
void main() {
  vUv = uv;
  vec3 verplaatst = position + normal * 0.0015 * sin(uTijd * 18.0 + uv.x * 90.0) * step(uMond, uv.x);
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(verplaatst, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

export const STRAAL_FRAG = /* glsl */`
uniform float uTijd;
uniform float uVul;
uniform float uGoot;
uniform float uHerhaal;
uniform float uSnelheid;
uniform vec3 uKleur;
uniform sampler2D uStroom;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vP;
void main() {
  float u = vUv.x;
  if (u > uVul) discard;
  float str = texture2D(uStroom, vec2(vUv.y * 2.0, u * uHerhaal - uTijd * uSnelheid * uHerhaal)).r;
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), 2.0);
  float kop = smoothstep(uVul - 0.03, uVul, u);
  vec3 kleur = mix(uKleur, vec3(1.0), fres * 0.6 + str * 0.25);
  float alpha = clamp(0.55 + 0.35 * str + 0.3 * fres, 0.0, 0.95) * (1.0 - 0.6 * kop) * smoothstep(0.0, 0.5, uGoot);
  gl_FragColor = vec4(kleur, alpha);
  ${AFSLUITING}
}
`

// ── Spetters bij de uitloop ─────────────────────────────────────────────────────
// Per instance een parabool vanuit uOorsprong (aSeed = hoek, snelheid xz, snelheid y,
// fase); camera-billboard, iets uitgerekt in de bewegingsrichting; onder de grond onzichtbaar.
export const SPETTER_VERT = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uOorsprong;
uniform float uTijd;
uniform float uAan;
uniform float uGrond;
varying vec2 vUv;
varying float vA;
void main() {
  float t = fract(uTijd * 1.4 + aSeed.w);
  vec3 p = uOorsprong + vec3(cos(aSeed.x) * aSeed.y * t, aSeed.z * t - 4.905 * t * t, sin(aSeed.x) * aSeed.y * t);
  float maat = 0.006 + 0.004 * fract(aSeed.w * 7.3);
  vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);   // camera-rechts (wereld)
  vec3 o = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);   // camera-omhoog (wereld)
  float rek = 1.0 + 0.08 * length(vec2(aSeed.y, aSeed.z - 9.81 * t));
  vA = uAan * (1.0 - t) * step(0.0, p.y - uGrond);
  p += r * position.x * maat + o * position.y * maat * rek;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

export const SPETTER_FRAG = /* glsl */`
varying vec2 vUv;
varying float vA;
void main() {
  float a = smoothstep(0.5, 0.3, length(vUv - 0.5));
  gl_FragColor = vec4(vec3(0.91, 0.95, 0.97), a * vA * 0.7);
  ${AFSLUITING}
}
`

// ── Rimpelringen (uitloop) en spatjes op het terras ────────────────────────────
// Vlakke quads op de grond (aPos), elk met een eigen fase; de ring dijt uit met
// t = fract(uTijd·uTempo + aFase) en dooft uit. Ook voor de 'kletterende' spatjes.
export const RING_VERT = /* glsl */`
attribute vec3 aPos;
attribute float aFase;
uniform float uTijd;
uniform float uTempo;
uniform float uSchaal;
varying vec2 vUv;
varying float vT;
void main() {
  vT = fract(uTijd * uTempo + aFase);
  vec3 p = aPos + vec3(position.x, 0.0, -position.y) * uSchaal;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

export const RING_FRAG = /* glsl */`
uniform float uAan;
uniform float uSterkte;
varying vec2 vUv;
varying float vT;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float ring = smoothstep(0.1, 0.0, abs(d - vT * 0.95));
  gl_FragColor = vec4(vec3(0.93, 0.96, 0.98), ring * (1.0 - vT) * uSterkte * uAan);
  ${AFSLUITING}
}
`
