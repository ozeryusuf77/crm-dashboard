// Kwaliteitsniveau vóór het aanmaken van de Canvas bepalen (antialias kan daarna niet meer wisselen).
// Met ?kwaliteit=laag of ?kwaliteit=hoog in de URL is het niveau te forceren.
export const GEFORCEERD = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('kwaliteit') : null
export const MOBIEL = GEFORCEERD ? GEFORCEERD === 'laag' : typeof window !== 'undefined' && (
  window.matchMedia?.('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4
)
