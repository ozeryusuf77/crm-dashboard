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
    // Haal kennisbank op
    const { data: items } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('active', true)
      .limit(10)

    const context = items?.map(i => `[${i.title}]\n${i.content}`).join('\n\n') || ''

    // Haal systeem prompt op uit Supabase
    const { data: promptData } = await supabase
      .from('system_prompt')
      .select('content')
      .eq('id', 1)
      .single()

    const systeemPrompt = promptData?.content || 'Je bent een vriendelijke klantenservice-assistent voor Megaschuifwand.'

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `${systeemPrompt}

${context ? `KENNISBANK:\n${context}\n` : ''}
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