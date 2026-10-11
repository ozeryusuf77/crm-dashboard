// Omgeving rond de veranda: compositie van gazon, terras, woning, meubels en erf. De
// onderdelen zelf staan in Gazon.jsx, Terras.jsx, Woning.jsx, Meubels.jsx en Tuin.jsx; het
// licht in Licht.jsx. Elk onderdeel zit in een eigen Foutgrens, zodat een fout in bijvoorbeeld
// de woning alleen de woning verbergt en niet de hele 3D-weergave.
//
//   <Omgeving L cfg nacht meubels hoog laadRekwisieten />
//
// Assen: x = breedte (0 = midden), y = omhoog, z = diepte (0 = gevel, +z = tuin); meters.
import { Html } from '@react-three/drei'
import { Gazon } from './Gazon.jsx'
import { Terras } from './Terras.jsx'
import { Woning } from './Woning.jsx'
import { Meubels } from './Meubels.jsx'
import { Erf } from './Tuin.jsx'
import { Foutgrens } from './Foutgrens.jsx'
import { MOBIEL } from './kwaliteit.js'

// Tijdelijke re-export: Scene.jsx importeert Licht hier nog vandaan tot W2-scene rechtstreeks
// uit Licht.jsx importeert; daarna kan deze regel weg.
export { Licht } from './Licht.jsx'

// De prop `cfg` (Scene geeft die door) wordt hier bewust niet gelezen: alle maten komen uit L,
// dus de compositie werkt ook zonder cfg. `hoog` en `laadRekwisieten` hebben defaults zodat de
// oude Scene.jsx, die ze nog niet doorgeeft, blijft werken.
export function Omgeving({ L, nacht = false, meubels = true, hoog = !MOBIEL, laadRekwisieten = true }) {
  return (
    <group>
      <Foutgrens naam="Gazon"><Gazon L={L} hoog={hoog} /></Foutgrens>
      <Foutgrens naam="Terras"><Terras L={L} hoog={hoog} /></Foutgrens>
      {!L.vrijstaand && <Foutgrens naam="Woning"><Woning L={L} nacht={nacht} hoog={hoog} /></Foutgrens>}
      {meubels && <Foutgrens naam="Meubels"><Meubels L={L} hoog={hoog} /></Foutgrens>}
      <Foutgrens naam="Erf"><Erf L={L} hoog={hoog} meubels={meubels} laadRekwisieten={laadRekwisieten} /></Foutgrens>
    </group>
  )
}

// Maatlabels (breedte, diepte, hoogte) bij de veranda; de vloerlabels staan 5 cm boven de vloer.
export function Maatvoering({ L, cfg }) {
  const stijl = 'vc-maat'
  const y = L.vloerY + 0.05
  return (
    <group>
      <Html position={[0, y, L.D + 0.55]} center className={stijl}>{cfg.breedte} cm</Html>
      <Html position={[L.W / 2 + 0.5, y, L.D / 2]} center className={stijl}>{cfg.diepte} cm</Html>
      <Html position={[L.xStaanders[L.xStaanders.length - 1] + 0.35, L.Hf / 2, L.zVoorStaander + 0.2]} center className={stijl}>{cfg.hoogte} cm</Html>
    </group>
  )
}

export default Omgeving
