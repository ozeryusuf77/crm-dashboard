// Kwaliteitsniveau vóór het aanmaken van de Canvas bepalen (antialias kan daarna niet meer wisselen).
// Met ?kwaliteit=laag of ?kwaliteit=hoog in de URL is het niveau te forceren.
export const GEFORCEERD = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('kwaliteit') : null
export const MOBIEL = GEFORCEERD ? GEFORCEERD === 'laag' : typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4
)

// Rekwisietenset voor de tuin (Tuin.jsx/Meubels.jsx): welke GLB-set wordt geladen en hoeveel
// exemplaren er staan. `set` kiest de map in public/modellen/ ('laag' = gereduceerde modellen).
// Mobiel: weinig modellen, geen bistroset, geen 3D-grasrand, rotan hangstoel als dichte kuip.
// grasrand (3D-sprietkaartjes langs het terras, Gazon.jsx) staat op 0: ook kort en licht lezen de
// kaartjes op de fotostand als stekels; een gemaaide rand (ref1) oogt echter. Hoger = aantal pollen.
export const REKWISIETEN = MOBIEL
  ? { set: 'laag', bomen: 1, struiken: 3, potten: ['potplant_terracotta'], bistro: false, bank: true, plantenbakken: 1, schaduwPlanten: false, grasrand: 0, bladeren: 40, hangstoelRotan: false }
  : { set: 'hoog', bomen: 3, struiken: 7, potten: ['potplant_hoog', 'potplant_terracotta'], bistro: true, bank: true, plantenbakken: 2, schaduwPlanten: true, grasrand: 0, bladeren: 90, hangstoelRotan: true }
