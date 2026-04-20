const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args))

const VERIFY_TOKEN = 'megaschuifwand_webhook_2026'

module.exports = async function handler(req, res) {
  // Webhook verificatie door Meta
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
    if (!body.object) return res.sendStatus(404)

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const message = change?.value?.messages?.[0]

    if (!message || message.type !== 'text') return res.sendStatus(200)

    const from = message.from
    const tekst = message.text.body

    // Haal kennisbank op via Supabase en stuur naar Gemini
    const aiRes = await fetch(`${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vraag: tekst, geschiedenis: '' })
    })

    // Direct Gemini aanroepen
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const { createClient } = require('@supabase/supabase-js')

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Je bent een vriendelijke klantenservice-assistent voor Megaschuifwand.
Beantwoord vragen op basis van de onderstaande kennisbank.
Antwoord altijd in het Nederlands. Houd antwoorden kort en duidelijk.
Als de kennisbank ge