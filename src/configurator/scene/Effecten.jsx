// Nabewerking voor desktop (los geladen, alleen bij `hoog`), afgestemd op de
// referentiebeelden (archviz-stills): een korte, neutrale contactschaduw in hoeken en
// onder meubels, een milde S-curve en iets minder verzadiging, een licht vignet naar
// de beeldhoeken en SMAA op de hoogste stand zodat dunne aluminium liggers geen
// trapjes vertonen. 's Avonds gloeien alleen de felste oppervlakken (verlichte ramen,
// LED's); overdag is er geen bloom. Alles is licht afgesteld: de brede AO, het zware
// vignet en het extra contrast van ronde 1 maakten het totaalbeeld te donker en vuil.
// De belichting (exposure) zit niet hier maar op de renderer: three zet
// toneMappingExposure in elk programma met die uniform, dus ook in de ToneMapping-pass
// van postprocessing (WebGLRenderer.setProgram).
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

// Ambient occlusion: straal in meters. Kort (0,6 m) en neutraal zwart: tekent de
// contactschaduw onder meubels en in de hoeken zonder het hele terras onder het dak te
// verdonkeren; een grote straal met hoge sterkte (ronde 1: 1,1 m / 3,2) gaf halo's rond
// dunne liggers en een vuil totaalbeeld.
const AO = { straal: 0.6, verval: 0.6, sterkte: 1.5, kleur: '#000000' }
// Vignet: offset = waar het donker worden begint, darkness = hoe donker de hoeken.
// Licht gehouden: in de referenties zijn de hoeken nauwelijks donkerder dan het midden.
const VIGNET = { offset: 0.45, donkerte: 0.22 }

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
      {nacht ? <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.3} intensity={0.35} radius={0.6} /> : null}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <BrightnessContrast brightness={0} contrast={0.04} />
      <HueSaturation saturation={-0.04} />
      <Vignette technique={VignetteTechnique.DEFAULT} offset={VIGNET.offset} darkness={VIGNET.donkerte} />
      <SMAA preset={SMAAPreset.ULTRA} edgeDetectionMode={EdgeDetectionMode.COLOR} predicationMode={PredicationMode.DEPTH} />
    </EffectComposer>
  )
}

export default function Effecten({ nacht }) {
  return <Keten key={nacht ? 'avond' : 'dag'} nacht={nacht} />
}
