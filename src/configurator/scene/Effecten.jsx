// Nabewerking voor desktop (los geladen, alleen bij `hoog`), afgestemd op de
// referentiebeelden (archviz-stills): een brede, koele contactschaduw in hoeken en
// onder meubels, een milde S-curve en iets minder verzadiging, een licht vignet
// naar de beeldhoeken en SMAA op de hoogste stand zodat dunne aluminium liggers
// geen trapjes vertonen. 's Avonds gloeien alleen oppervlakken boven 1,0 lineair
// (verlichte ramen, LED's); overdag is er geen bloom.
//
// Volgorde van de keten (postprocessing voegt opeenvolgende niet-convolutie-
// effecten samen tot één pass):
//   1. N8AO          ambient occlusion op halve resolutie, 64 samples ('high')
//   2. Bloom         alleen 's avonds, vóór de tonemapping (convolutie, eigen pass)
//   3. ToneMapping   Khronos PBR Neutral: kleurechte RAL-tinten (geen ACES/AgX)
//      + BrightnessContrast / HueSaturation / Vignette in dezelfde pass,
//      ná de tonemapping dus in weergaveruimte
//   4. SMAA          ULTRA, kleurranden + dieptepredicatie (convolutie, eigen pass)
// Bewust géén scherptediepte: beide referenties zijn overal scherp en een vrij
// draaibare camera zou er hinder van hebben.
import { useEffect, useRef } from 'react'
import { EffectComposer, N8AO, SMAA, Bloom, ToneMapping, BrightnessContrast, HueSaturation, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode, SMAAPreset, EdgeDetectionMode, PredicationMode, VignetteTechnique } from 'postprocessing'

// Ambient occlusion: straal in meters. Groter dan ±1 m geeft halo's rond dunne
// liggers tegen de lucht; 0,9–1,1 m geeft de 'vuile hoek' van de referenties.
const AO = { straal: 1.1, verval: 0.45, sterkte: 3.2, kleur: '#0a0c10' }
// Vignet: offset = waar het donker worden begint, darkness = hoe donker de hoeken.
// Niet boven 0,5: anders oogt de UI-overlay in de hoeken 'vuil'.
const VIGNET = { offset: 0.3, donkerte: 0.45 }

// De keten zelf. Wordt bij een dag/avond-wissel opnieuw opgebouwd (zie Effecten):
// een effect dat pas later wordt gemount (Bloom) zet @react-three/postprocessing
// altijd achteraan de lijst, waardoor de bloom anders ná de tonemapping en SMAA
// zou lopen in plaats van op de HDR-waarden ervóór.
function Keten({ nacht }) {
  const composer = useRef(null)
  // De composer-wrapper ruimt zijn rendertargets niet zelf op; bij het afbreken
  // van deze keten gebeurt dat hier, zodat een wissel geen GPU-geheugen lekt.
  useEffect(() => () => composer.current?.dispose(), [])
  return (
    <EffectComposer ref={composer} multisampling={0}>
      <N8AO halfRes quality="high" aoRadius={AO.straal} distanceFalloff={AO.verval} intensity={AO.sterkte} color={AO.kleur} />
      {nacht ? <Bloom mipmapBlur luminanceThreshold={0.75} luminanceSmoothing={0.3} intensity={0.55} radius={0.6} /> : null}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <BrightnessContrast brightness={0} contrast={0.08} />
      <HueSaturation saturation={-0.04} />
      <Vignette technique={VignetteTechnique.DEFAULT} offset={VIGNET.offset} darkness={VIGNET.donkerte} />
      <SMAA preset={SMAAPreset.ULTRA} edgeDetectionMode={EdgeDetectionMode.COLOR} predicationMode={PredicationMode.DEPTH} />
    </EffectComposer>
  )
}

export default function Effecten({ nacht }) {
  return <Keten key={nacht ? 'avond' : 'dag'} nacht={nacht} />
}
