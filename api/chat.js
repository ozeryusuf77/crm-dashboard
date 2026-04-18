const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { vraag, geschiedenis } = req.body
  if (!vraag) return res.status(400).json({ error: 'Geen vraag' })

  try {
    const { data: items } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('active', true)
      .limit(10)

    const context = items?.map(i => `[${i.title}]\n${i.content}`).join('\n\n') || ''

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

    const prompt = `Je bent een vriendelijke klantenservice-assistent voor Megaschuifwand.
Beantwoord vragen op basis van de onderstaande kennisbank.
Antwoord altijd in het Nederlands. Houd antwoorden kort en duidelijk.
Als de kennisbank geen antwoord bevat, zeg dan dat je de vraag doorstuurt naar een collega.
Vraag NIET om naam of e-mail tenzij de klant zelf aangeeft een offerte of bestelling te willen.

KENNISBANK:
${context}

${geschiedenis ? `GESPREKSGESCHIEDENIS:\n${geschiedenis}\n` : ''}
VRAAG: ${vraag}`

    const result = await model.generateContent(prompt)
    const antwoord = result.response.text().trim()

    return res.status(200).json({ antwoord })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ antwoord: 'Er ging iets mis. Probeer het opnieuw.' })
  }
}