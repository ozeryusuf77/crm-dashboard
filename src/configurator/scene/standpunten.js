// Camerastandpunten van de configurator (pure functies, geen React).
// Assenstelsel: x = breedte (0 = midden), y = omhoog (0 = terrasreferentie), z = diepte
// (0 = gevel, +z = tuin). Alle maten in meters, hoeken in graden (FOV) of radialen (intern).
//
// Gebruik: `const { pos, doel, fov, binnen } = cameraStandpunt(view.naam, L, { aspect, kant: view.kant })`
// waarbij `aspect` de beeldverhouding (breedte / hoogte) van de canvas is. De fotostand
// 'buiten' en de voorkant 'voor' kaderen de hele veranda op basis van die beeldverhouding:
// een smal (portret-)scherm zet de camera verder weg, een breed scherm dichterbij.
import * as THREE from 'three'

// Verticale beeldhoek (graden) per standpunt. 'buiten' = fotostand op ooghoogte zoals de
// referentiebeelden (±48°, verticale verticalen); 'binnen' is bewust wijd (rondkijken).
export const FOV = { buiten: 48, voor: 48, links: 42, rechts: 42, boven: 40, binnen: 66, afvoer: 52, achter: 40 }

const OOGHOOGTE = 1.5          // camerahoogte van de fotostand en de voorkant
const GRAAD = Math.PI / 180
const VOOR_FOV_MAX = 54        // 'voor': beeldhoek mag oplopen als de tuin te klein is voor de afstand
const MIN_AFSTAND = 2.5        // minDistance van OrbitControls buiten het binnenstandpunt (Scene.jsx)

// Halve horizontale beeldhoek (rad) bij verticale beeldhoek `fov` (graden) en beeldverhouding `aspect`.
const halveBreedteHoek = (fov, aspect) => Math.atan(Math.tan((fov * GRAAD) / 2) * aspect)

// Beeldverhouding binnen een zinnige band houden; onbruikbare waarden (0, NaN) → desktopstandaard.
const begrensAspect = aspect => (Number.isFinite(aspect) && aspect > 0 ? Math.min(3.5, Math.max(0.5, aspect)) : 1.6)

const v3 = (x, y, z) => new THREE.Vector3(x, y, z)

// De afvoer waarop het standpunt 'afvoer' zich richt: de gevraagde kant, anders de eerste.
// Zonder actieve afvoer (alleen bij een gemanipuleerde cfg) de hoekstaander aan die kant zelf.
function afvoerVoor(L, kant) {
  const lijst = Array.isArray(L.afvoeren) ? L.afvoeren : []
  const a = (kant && lijst.find(item => item.kant === kant)) || lijst[0]
  if (a) return a
  const s = kant === 'links' ? -1 : 1
  const naam = s < 0 ? 'links' : 'rechts'
  return { kant: naam, s, x: s * (L.W / 2 - L.sB / 2), z: L.zVoorStaander, richting: naam, n: [s, 0] }
}

// Geeft altijd { pos: Vector3, doel: Vector3, fov } (en `binnen: true` voor het binnenstandpunt).
// Onbekende namen vallen terug op de fotostand 'buiten'.
export function cameraStandpunt(naam, L, { aspect = 1.6, kant } = {}) {
  const asp = begrensAspect(aspect)
  // Maquette-straal voor de overzichtsstandpunten 'boven' en 'achter'.
  const r = Math.max(L.W, L.D * 1.6) * 0.9 + 4.5
  const midden = v3(0, 1.3, L.D * 0.45)

  switch (naam) {
    case 'voor': {
      // Recht van voren op ooghoogte. Afstand uit de breedte (W/2 + 0,8 m marge) én uit de
      // hoogte (bovenkant voorzijde + 0,25 m marge), maar nooit voorbij de achterschutting.
      const tuinD = L.erf?.tuinD ?? L.D + 8
      const zMax = tuinD - 0.6
      const halfH = halveBreedteHoek(FOV.voor, asp)
      const halfV = (FOV.voor * GRAAD) / 2
      const zBreedte = L.zVoorStaander + (L.W / 2 + 0.8) / Math.tan(halfH)
      const zHoogte = L.zGoot + Math.max(0, L.Hf + L.gootH + 0.25 - OOGHOOGTE) / Math.tan(halfV)
      const zNodig = Math.max(zBreedte, zHoogte)
      let fov = FOV.voor
      let z = zNodig
      if (zNodig > zMax) {
        // De tuin is te klein voor de afstand (bij ±1,6 beeldverhouding vanaf ±9 m breed, op een
        // smal scherm eerder): beeldhoek verruimen tot maximaal 54° zodat de veranda blijft passen.
        z = zMax
        const tanNodig = (L.W / 2 + 0.8) / Math.max(0.5, zMax - L.zVoorStaander)
        const fovNodig = (2 * Math.atan(tanNodig / asp)) / GRAAD
        fov = Math.min(VOOR_FOV_MAX, Math.max(FOV.voor, fovNodig))
      }
      return { pos: v3(0, OOGHOOGTE, z), doel: v3(0, OOGHOOGTE, 0.3 * L.D), fov }
    }
    case 'links':
    case 'rechts': {
      // Zijaanzicht op ooghoogte: afstand op basis van de diepte, gericht op het dichtstbijzijnde uiteinde.
      const s = naam === 'links' ? -1 : 1
      const rz = Math.max(L.D * 1.6, 4) * 0.9 + 4
      const doel = v3(s * Math.max(0, L.W / 2 - 1.8), 1.5, L.D * 0.45)
      return { pos: v3(s * (L.W / 2 + rz * 0.85), 1.7, L.D * 0.75 + 1.5), doel, fov: FOV[naam] }
    }
    case 'boven':
      return { pos: v3(0.001, r * 1.6, L.D / 2 + 1.2), doel: v3(0, 0, L.D / 2), fov: FOV.boven }
    case 'binnen': {
      // In de hoek links-achter bij de gevel, schuin over de loungeset naar de hangstoel en de
      // tuin kijkend (rondkijken door te slepen). Links, zodat de camera nooit in de kuip van
      // de hangstoel (rechts van het midden) staat.
      const pos = v3(-(L.W / 2 - 0.7), 1.55, L.zAchter + 0.5)
      const blik = v3(L.W * 0.3, 1.15, L.D + 1.5).sub(pos).setLength(0.1)
      return { pos, doel: pos.clone().add(blik), fov: FOV.binnen, binnen: true }
    }
    case 'achter':
      return { pos: v3(r * 0.35, 2.2, -r * 0.75), doel: midden, fov: FOV.achter }
    case 'afvoer': {
      // Verhoogd standpunt (goothoogte + 0,8 m) schuin van buiten op de hoekstaander met de
      // afvoer, zodat dakvlak/dakwater, de open goot (waterband, druppels), de hele staander,
      // het uitloopgat met bocht/kapje en de plas op het terras in één beeld staan. Bij 'onder'
      // iets lager kijken (gestippelde lijn onder de vloer).
      const a = afvoerVoor(L, kant)
      if (a.richting === 'achter') {
        // Uitloop onder de veranda: van binnenuit op de achterkant van de staander (de hangstoel
        // verbergt zichzelf zodra de camera dichterbij dan 1,2 m komt, zie Meubels.jsx).
        // OrbitControls (Scene.jsx) houdt buiten het binnenstandpunt minstens 2,5 m tussen camera
        // en draaipunt; het draaipunt ligt daarom op 2,5 m in dezelfde kijkrichting (net achter
        // het staandervlak), anders duwt de besturing de camera elk frame naar achteren.
        const pos = v3(a.x - a.s * 1.5, 1.35, Math.max(0.5, a.z - 1.6))
        const blik = v3(a.x, 0.8, a.z - 0.15).sub(pos)
        return { pos, doel: pos.clone().add(blik.setLength(Math.max(blik.length(), MIN_AFSTAND))), fov: 56 }
      }
      // Opzij aan de kant van het gat: buitenwaarts = buiten de veranda (zoals a.s), binnenwaarts
      // (gat in het vlak naar de andere staander) vóór de veranda aan de binnenkant, anders
      // verbergt de staander zijn eigen uitloop. De x blijft minstens 0,5 m binnen de schutting
      // (erfX), zodat de camera vóór de schutting staat en de Zijde-logica (Tuin.jsx) die niet
      // wegneemt.
      const xMax = (L.erf?.erfX ?? L.W / 2 + 3) - 0.5
      const nx = Array.isArray(a.n) ? a.n[0] : 0
      const zijde = nx !== 0 ? Math.sign(nx) : a.s
      const pos = v3(THREE.MathUtils.clamp(a.x + zijde * 2.4, -xMax, xMax), L.Hf + 0.8, a.z + 3.4)
      const doel = v3(a.x, a.richting === 'onder' ? 0.7 : 1.25, a.z)
      return { pos, doel, fov: FOV.afvoer }
    }
    case 'buiten':
    default: {
      // Fotostand: ooghoogte 1,5 m, pitch 0 (verticalen blijven verticaal), afstand zó dat de
      // veranda plus 1 m marge per kant de beeldbreedte vult (≈ 71 % bij 1,6; verder weg op een
      // smal scherm), iets links van het midden en licht schuin op de gevel gericht.
      const halfH = halveBreedteHoek(FOV.buiten, asp)
      const afst = Math.max(4.4, (L.W / 2 + 1.0) / Math.tan(halfH))
      return { pos: v3(-0.15 * L.W, OOGHOOGTE, L.zVoorStaander + afst), doel: v3(0.02 * L.W, OOGHOOGTE, 0.3 * L.D), fov: FOV.buiten }
    }
  }
}
