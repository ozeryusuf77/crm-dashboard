// Nabewerking voor desktop (los geladen): ambient occlusion voor contactschaduw
// in hoeken en onder meubels, neutrale tonemapping voor kleurechte RAL-tinten,
// SMAA anti-aliasing en 's avonds een lichte gloed rond de LED's.
import { EffectComposer, N8AO, SMAA, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export default function Effecten({ nacht }) {
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes quality="medium" aoRadius={0.5} distanceFalloff={1} intensity={2.2} />
      {nacht ? <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.8} /> : null}
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
    </EffectComposer>
  )
}
