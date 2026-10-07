const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const tekst = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Offerte-aanvraag vanuit de 3D veranda configurator → lead in Supabase.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const body = req.body || {}
  const naam = tekst(body.naam, 120)
  const email = tekst(body.email, 200)
  if (!naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Naam en een geldig e-mailadres zijn verplicht' })
  }

  const configuratie = body.configuratie && typeof body.configuratie === 'object' ? body.configuratie : {}
  if (JSON.stringify(configuratie).length > 20000) return res.status(413).json({ error: 'Configuratie te groot' })
  const regels = Array.isArray(body.regels) ? body.regels.slice(0, 60) : []
  const totaal = Number(body.totaal) || 0

  try {
    const { error } = await supabase.from('leads').insert({
      id: `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: naam,
      status: 'new',
      channel: 'configurator',
      summary: `Offerte veranda ${configuratie.breedte || '?'} × ${configuratie.diepte || '?'} cm — indicatie € ${Math.round(totaal)}`,
      ai_mode: false,
      memory: {
        email,
        telefoon: tekst(body.telefoon, 40),
        postcode: tekst(body.postcode, 12),
        opmerking: tekst(body.opmerking, 2000),
        link: tekst(body.link, 4000),
        totaal,
        regels,
        configuratie,
      },
    })
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Offerte opslaan mislukt:', err)
    return res.status(500).json({ error: 'Opslaan mislukt' })
  }
}
