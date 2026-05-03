const { GoogleGenerativeAI } = require('@google/generative-ai')
const { createClient } = require('@supabase/supabase-js')

const VERIFY_TOKEN = 'megaschuifwand_webhook_2026'

function bepaalSporen(breedte) {
  if (breedte <= 204) return 2
  if (breedte <= 305) return 3
  if (breedte <= 405) return 4
  if (breedte <= 505) return 5
  if (breedte <= 605) return 6
  if (breedte <= 705) return 7
  return null
}

function extractState(history) {
  const state = { breedte: null, sporen: null, glas: null, kleur: null, pakket: null, montage: null }

  for (const msg of history) {
    const text = msg.message.toLowerCase()

    if (msg.role === 'user') {
      const match = msg.message.match(/\b(1[0-9]{2}|[2-6][0-9]{2}|70[0-5])\b/)
      if (match) {
        const num = parseInt(match[1])
        if (num >= 100 && num <= 705) {
          state.breedte = num
          state.sporen = bepaalSporen(num)
        }
      }

      if (text.includes('getint')) state.glas = 'getint'
      else if (text.includes('helder')) state.glas = 'helder'

      if (text.includes('zwart') || text.includes('9005')) state.kleur = 'zwart (RAL 9005)'
      else if (text.includes('antraciet') || text.includes('7016')) state.kleur = 'antraciet (RAL 7016)'
      else if (text.includes('crème') || text.includes('creme') || text.includes('9001')) state.kleur = 'crème (RAL 9001)'

      if (text.includes('luxe')) state.pakket = 'luxe'
      else if (text.includes('aanbevolen')) state.pakket = 'aanbevolen'
      else if (text === 'basis') state.pakket = 'basis'

      if (text.includes('zelf') || text === 'nee' || text === 'nee.') state.montage = 'nee'
      else if (text === 'ja' || (text.includes('montage') && !text.includes('zelf'))) state.montage = 'ja'
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
    const messageId = message.id

    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    )

    // DUPLICATE CHECK — stop als dit bericht al verwerkt is
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('message_id', messageId)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log('Duplicate bericht genegeerd:', messageId)
      return res.status(200).end()
    }

    // Sla klantbericht op MET message_id
    await supabase.from('conversations').insert({
      phone: from,
      role: 'user',
      message: tekst,
      message_id: messageId
    })

    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
    )

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
VASTGESTELDE KLANTGEGEVENS — GEBRUIK DEZE EXACT, GEEN PLACEHOLDERS:
- Breedte: ${state.breedte ? state.breedte + ' cm ✓' : 'ONBEKEND → vraag dit eerst'}
- Spoor systeem: ${state.sporen ? state.sporen + '-spoor ✓' : 'nog te bepalen'}
- Glas: ${state.glas ? state.glas + ' ✓' : 'ONBEKEND → vraag na breedte'}
- Kleur: ${state.kleur ? state.kleur + ' ✓' : 'ONBEKEND → vraag na glas'}
- Pakket: ${state.pakket ? state.pakket + ' ✓' : 'ONBEKEND → vraag na kleur'}
- Montage: ${state.montage ? state.montage + ' ✓' : 'ONBEKEND → vraag na pakket'}

VOLGENDE ACTIE: ${volgendeStap}
- vraag_breedte → Vraag alleen de breedte in cm
- vraag_glas → Zeg dat breedte ${state.breedte}cm = ${state.sporen}-spoor. Vraag helder of getint glas
- vraag_kleur → Vraag kleur (zwart/antraciet/crème)
- vraag_pakket → Noem samenvatting (${state.sporen}-spoor, ${state.glas}, ${state.kleur}) en vraag pakket
- vraag_montage → Vraag ALLEEN: zelf monteren of montage erbij?
- stuur_link → Geef volledige samenvatting met alle werkelijke waarden en stuur productlink

VERBODEN:
- Gebruik NOOIT [X], [kleur], [pakket] of andere placeholders
- Vraag NOOIT opnieuw iets dat al bekend is
- Vraag NOOIT opnieuw de breedte — die is ${state.breedte ? state.breedte + ' cm' : 'onbekend'}
`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `${systeemPrompt}

${stateContext}

GESPREKSGESCHIEDENIS:
${geschiedenis}

LAATSTE BERICHT VAN KLANT: ${tekst}

Antwoord nu (Nederlands, max 1 vraag, geen placeholders):`

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
