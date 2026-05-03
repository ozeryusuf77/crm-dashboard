const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')

const VERIFY_TOKEN = 'megaschuifwand_webhook_2026'

function extractState(history) {
  const state = {
    breedte: null,
    sporen: null,
    glas: null,
    kleur: null,
    pakket: null,
    montage: null,
  }

  for (const msg of history) {
    const text = msg.message.toLowerCase()

    if (msg.role === 'user') {
      const breedteMatch = msg.message.match(/\b(\d{2,3})\b/)
      if (breedteMatch) {
        const num = parseInt(breedteMatch[1])
        if (num >= 100 && num <= 705) {
          state.breedte = num
          if (num >= 162 && num <= 204) state.sporen = 2
          else if (num >= 205 && num <= 305) state.sporen = 3
          else if (num >= 306 && num <= 405) state.sporen = 4
          else if (num >= 406 && num <= 505) state.sporen = 5
          else if (num >= 506 && num <= 605) state.sporen = 6
          else if (num >= 606 && num <= 705) state.sporen = 7
          else if (num < 162) state.sporen = 2
        }
      }
    }

    if (text.includes('getint') || text.includes('getin')) state.glas = 'getint'
    if (text.includes('helder')) state.glas = 'helder'

    if (text.includes('zwart') || text.includes('9005')) state.kleur = 'zwart (RAL 9005)'
    if (text.includes('antraciet') || text.includes('7016')) state.kleur = 'antraciet (RAL 7016)'
    if (text.includes('crème') || text.includes('creme') || text.includes('9001')) state.kleur = 'crème (RAL 9001)'

    if (text.includes('luxe')) state.pakket = 'luxe'
    else if (text.includes('aanbevolen') || text.includes('aanbevel')) state.pakket = 'aanbevolen'
    else if (text.includes('basis')) state.pakket = 'basis'

    if (msg.role === 'user') {
      if (text.includes('montage') && (text.includes('ja') || text.includes('graag') || text.includes('wel'))) state.montage = 'ja'
      if (text === 'nee' || text === 'nee.' || (text.includes('zelf') && text.includes('monter'))) state.montage = 'nee'
    }
  }

  return state
}

function bepaalVolgendeStap(state) {
  if (!state.breedte) return 'vraag_breedte'
  if (!state.glas) return 'vraag_glas'
  if (!state.kleur) return 'vraag_kleur'
  if (!state.pakket) return 'vraag_pakket'
  if (!state.montage) return 'vraag_montage'
  return 'stuur_link'
}

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

    const msgTimestamp = message.timestamp
    const now = Math.floor(Date.now() / 1000)
    if (now - msgTimestamp > 30) return res.status(200).end()

    const from = message.from
    const tekst = message.text.body

    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
    )
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    await supabase.from('conversations').insert({
      phone: from,
      role: 'user',
      message: tekst
    })

    const { data: history } = await supabase
      .from('conversations')
      .select('role, message')
      .eq('phone', from)
      .order('created_at', { ascending: false })
      .limit(20)

    const gesorteerdHistory = history ? [...history].reverse() : []
    const state = extractState(gesorteerdHistory)
    const volgendeStap = bepaalVolgendeStap(state)

    const geschiedenis = gesorteerdHistory
      .map(h => `${h.role === 'user' ? 'Klant' : 'Assistent'}: ${h.message}`)
      .join('\n')

    const { data: promptData } = await supabase
      .from('system_prompt')
      .select('content')
      .eq('id', 1)
      .single()

    const systeemPrompt = promptData?.content || ''

    const stateContext = `
HUIDIGE KLANTGEGEVENS (gebruik deze EXACT in je antwoord, vervang NOOIT met placeholders):
- Breedte: ${state.breedte ? state.breedte + ' cm' : 'nog niet opgegeven'}
- Spoor systeem: ${state.sporen ? state.sporen + '-spoor' : 'nog niet bepaald'}
- Glas: ${state.glas || 'nog niet gekozen'}
- Kleur: ${state.kleur || 'nog niet gekozen'}
- Pakket: ${state.pakket || 'nog niet gekozen'}
- Montage: ${state.montage || 'nog niet gevraagd'}

VOLGENDE STAP DIE JE MOET DOEN: ${volgendeStap}
- vraag_breedte → Vraag de breedte van de opening
- vraag_glas → Breedte is ${state.breedte}cm = ${state.sporen}-spoor systeem. Vraag helder of getint glas
- vraag_kleur → Vraag welke kleur (zwart/antraciet/crème)
- vraag_pakket → Vraag welk pakket (basis/aanbevolen/luxe)
- vraag_montage → Klant heeft ${state.pakket} gekozen. Vraag of montage gewenst is
- stuur_link → Geef samenvatting met echte waarden en stuur de juiste productlink

KRITISCH:
- Gebruik NOOIT placeholders zoals [X], [kleur], [helder/getint] in je antwoord
- Gebruik ALTIJD de werkelijke waarden uit HUIDIGE KLANTGEGEVENS hierboven
- Als volgende stap "stuur_link" is: geef volledige samenvatting met alle werkelijke waarden en stuur de link
`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `${systeemPrompt}

${stateContext}

GESPREKSGESCHIEDENIS:
${geschiedenis}

LAATSTE BERICHT VAN KLANT: ${tekst}

Geef nu je antwoord (maximaal 1 vraag, in het Nederlands, geen placeholders):`

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

    let antwoord = result.response.text().trim()

    if (state.sporen) antwoord = antwoord.replace(/\[X\]-spoor/g, `${state.sporen}-spoor`)
    if (state.glas) antwoord = antwoord.replace(/\[helder\/getint\]/g, state.glas)
    if (state.kleur) antwoord = antwoord.replace(/\[kleur\]/g, state.kleur)
    if (state.pakket) antwoord = antwoord.replace(/\[pakket\]/g, state.pakket)
    if (state.breedte) antwoord = antwoord.replace(/\[breedte\]/g, `${state.breedte} cm`)
    if (state.montage) antwoord = antwoord.replace(/\[ja\/nee\]/g, state.montage)

    await supabase.from('conversations').insert({
      phone: from,
      role: 'assistant',
      message: antwoord
    })

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