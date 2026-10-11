# Bronnen van de foto-texturen, lucht en 3D-modellen

Alle bestanden zijn CC0 1.0 (publiek domein): vrij te gebruiken, ook commercieel, zonder
verplichte naamsvermelding. Ze zijn alleen omgezet naar web-formaat (JPG, 2K en 1K) en,
waar vermeld, technisch bewerkt; er is niets aan de inhoud getekend.

| Map | Bron | Auteur | Echte maat van 1 herhaling |
| --- | --- | --- | --- |
| `texturen/baksteen` | Poly Haven "Red Brick" — https://polyhaven.com/a/red_brick | Rob Tuytel | 1,4 × 1,4 m |
| `texturen/terras` | Poly Haven "Large Floor Tiles 02" — https://polyhaven.com/a/large_floor_tiles_02 | Rob Tuytel | 1,8 × 1,8 m (tegels 60 × 60) |
| `texturen/vlonder` | Poly Haven "Wood Floor Deck" — https://polyhaven.com/a/wood_floor_deck | Dimitrios Savva | 1,8 × 1,8 m (12 planken van ca. 15 cm) |
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
- `texturen/vlonder/LICENTIE.txt`: herkomst, controlesommen en bewerking van de vlonderset.

## Bewerkingen van de kleurkaarten

Alleen de kleurkaarten (`kleur.jpg` en `kleur_1k.jpg`) zijn aangepast; normal, ruwheid en AO
zijn ongewijzigd. De scripts staan buiten de repo (scratchpad: `scripts-baksteen/mortar2.py`,
`check-W1-terras/assets.py`); de uitkomsten zijn hieronder vastgelegd.

| Map | Bewerking |
| --- | --- |
| `texturen/baksteen` | `kleur.jpg`: voeg opgelicht — alleen de mortelvoegen zijn lichter gemaakt (masker uit de displacement-kaart en de kleurverzadiging, zodat de stenen zelf onaangeroerd blijven; eigen afgeleide `kleur_lichte_voeg.jpg` van de Poly Haven-bron). `kleur_1k.jpg` is daar een LANCZOS-verkleining (1024 px, q85) van. Doel: rood-oranje baksteen met lichte voeg zoals in de referentiebeelden. |
| `texturen/terras` | `kleur*.jpg`: lichter en warmer — in Lab L × 1,25 en daarna het blauwkanaal (B) × 0,94 (gemiddeld rgb 117/118/115 → 149/150/137). |
| `texturen/vlonder` | `kleur*.jpg`: geblondeerd — de bron is donker roodbruin gebeitst grenen; in Lab L naar gemiddeld 70 met contrast × 1,15, a × 0,42, b × 0,78 (blanke vlonder). Details in `texturen/vlonder/LICENTIE.txt`. |

## Lucht

De HDRI's zijn met een vaste belichting en Khronos PBR Neutral tone mapping omgezet naar JPG.
Onder de horizon staat in een "pure sky"-HDRI een spiegeling van de lucht. In `dag.jpg` en
`nacht.jpg` is die vervangen door nevel in de horizonkleur, en in `*_omgeving.jpg` (alleen voor
belichting en reflecties) door een egale grondkleur. De zon (dag) en maan (nacht) worden bij het
laden als HDR-schijf in de omgevingskaart gebakken (scene/Licht.jsx), zodat aluminium en glas
een echte zonglans krijgen.

## 3D-modellen

De rekwisieten in de tuin (bomen, struiken, potplanten, bistroset, tuinbank, plantenbakken)
zijn CC0-modellen van Poly Haven. Ze staan niet in deze map maar in `public/modellen/` (zodat
ze als gewone same-origin bestanden laden: `.gltf` + `.bin` + losse `.jpg`/`.png`, zonder
decoders en zonder blob:- of data:-URI's); de volledige bronvermelding, auteurs, bewerkingen en
licentietekst staan in `public/modellen/LICENTIE.txt`, de maten en bestandslijsten in
`public/modellen/MODELLEN.json`.

| Map in `public/modellen/` | Bron (Poly Haven) |
| --- | --- |
| `boom_loofboom/` | https://polyhaven.com/a/tree_small_02 |
| `struik_groot/` | https://polyhaven.com/a/searsia_lucida (variant d) |
| `struik_klein/` | https://polyhaven.com/a/searsia_lucida (variant e) |
| `struik_laag/` | https://polyhaven.com/a/wild_rooibos_bush (variant a) |
| `potplant_hoog/` | https://polyhaven.com/a/potted_plant_01 |
| `potplant_terracotta/` | https://polyhaven.com/a/potted_plant_02 |
| `tuinset_bistro/` | https://polyhaven.com/a/outdoor_table_chair_set_01 |
| `tuinbank_hout/` | https://polyhaven.com/a/painted_wooden_bench |
| `plantenbak_hout/` | https://polyhaven.com/a/planter_box_01 |
| `laag/<naam>/` | dezelfde negen modellen in een lichtere variant (minder driehoeken, kleinere texturen) voor de mobiele tier |

Licentie: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/ (Poly Haven: https://polyhaven.com/license).
