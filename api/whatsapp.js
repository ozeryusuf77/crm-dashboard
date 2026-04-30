const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')

const VERIFY_TOKEN = 'megaschuifwand_webhook_2026'

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge)
    }
    return res.status(403).end()
  }

  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body
    if (!body.object) return res.status(200).end()

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    if (!message || message.type !== 'text') return res.status(200).end()

    const from = message.from
    const tekst = message.text.body

    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
    )
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    const { data: items } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('active', true)
      .limit(10)

    const context = items?.map(i => `[${i.title}]\n${i.content}`).join('\n\n') || ''

    const { data: promptData } = await supabase
      .from('system_prompt')
      .select('content')
      .eq('id', 1)
      .single()

    const systeemPrompt = promptData?.content || 'Je bent een vriendelijke klantenservice-assistent voor Megaschuifwand.'

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `${systeemPrompt}

${context ? `KENNISBANK:\n${context}\n` : ''}
VRAAG: ${tekst}`

    let result
    for (let i = 0; i < 3; i++) {
      try {
        result = await model.generateContent(prompt)
        break
      } catch (err) {
        if (i === 2) throw err
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    const antwoord = result.response.text().trim()

    await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: from,
        type: 'text',
        text: { body: antwoord }
      })
    })

    return res.status(200).end()

  } catch (err) {
    console.error('WhatsApp webhook error:', err)
    return res.status(500).end()
  }
}