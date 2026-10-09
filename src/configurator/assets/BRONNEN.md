# Bronnen van de foto-texturen en lucht

Alle bestanden zijn CC0 1.0 (publiek domein): vrij te gebruiken, ook commercieel, zonder
verplichte naamsvermelding. Ze zijn alleen omgezet naar web-formaat (JPG, 2K en 1K) en,
waar vermeld, technisch bewerkt; er is niets aan de inhoud getekend.

| Map | Bron | Auteur | Echte maat van 1 herhaling |
| --- | --- | --- | --- |
| `texturen/baksteen` | Poly Haven "Red Brick" — https://polyhaven.com/a/red_brick | Rob Tuytel | 1,4 × 1,4 m |
| `texturen/terras` | Poly Haven "Large Floor Tiles 02" — https://polyhaven.com/a/large_floor_tiles_02 | Rob Tuytel | 1,8 × 1,8 m (tegels 60 × 60) |
| `texturen/gras` | ambientCG "Grass 004" — https://ambientcg.com/a/Grass004 | ambientCG (Lennart Demes) | ca. 1,6 × 1,6 m |
| `texturen/hout` | Poly Haven "Oak Wood Planks" — https://polyhaven.com/a/oak_wood_planks | Dimitrios Savva | 1,2 × 1,2 m |
| `texturen/dakpannen` | Poly Haven "Roof 09" — https://polyhaven.com/a/roof_09 | Rob Tuytel | ca. 2,4 × 1,8 m (11 pannen × 6 rijen) |
| `lucht/dag*` | Poly Haven HDRI "Kloofendal 48d Partly Cloudy (Pure Sky)" — https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | zie bronpagina | — |
| `lucht/nacht*` | Poly Haven HDRI "Kloppenheim 02 (Pure Sky)" — https://polyhaven.com/a/kloppenheim_02_puresky | zie bronpagina | — |

Licenties: https://polyhaven.com/license en https://docs.ambientcg.com/legal/license

## Bestanden per oppervlak

- `kleur.jpg` / `kleur_1k.jpg`: albedo (sRGB), 2K voor desktop en 1K voor mobiel.
- `normal.jpg` / `normal_1k.jpg`: normal map in OpenGL-conventie (+Y), wat three.js verwacht.
- `arm.jpg` (1K): R = ambient occlusion, G = ruwheid (B leeg), zo leest three.js `aoMap` en `roughnessMap`.

## Lucht

De HDRI's zijn met een vaste belichting en Khronos PBR Neutral tone mapping omgezet naar JPG.
Onder de horizon staat in een "pure sky"-HDRI een spiegeling van de lucht. In `dag.jpg` en
`nacht.jpg` is die vervangen door nevel in de horizonkleur, en in `*_omgeving.jpg` (alleen voor
belichting en reflecties) door een egale grondkleur.
