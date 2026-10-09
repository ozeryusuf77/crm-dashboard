import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase, logAiQuery } from './supabase.js'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null

const SYSTEM_PROMPT = `Je bent een vriendelijke klantenservice-assistent voor MijnBedrijf.
Beantwoord vragen uitsluitend op basis van de kennisbank-context die je krijgt.
Antwoord altijd in het Nederlands.
Gebruik de naam van de klant als die bekend is.
Als een vraag NIET beantwoord kan worden met de kennisbank, antwoord dan EXACT met:
ESCALATE: [korte reden]
Houd antwoorden kort en duidelijk.`

/**
 * Haal de meest relevante kennisbank-items op via Supabase tekst-zoeken.
 * (Vervang dit later door pgvector similarity search voor betere resultaten.)
 */
async function getRelevantContext(question) {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, content')
    .eq('active', true)
    .textSearch('content', question.split(' ').slice(0, 5).join(' | '), { type: 'websearch' })
    .limit(3)

  if (error || !data || data.length === 0) {
    // Fallback: haal alle actieve items op
    const { data: all } = await supabase
      .from('knowledge_base')
      .select('title, content')
      .eq('active', true)
      .limit(10)
    return all || []
  }
  return data
}

/**
 * Genereer een AI-antwoord op basis van de kennisbank.
 * Geeft { answer, escalate, reason } terug.
 */
export async function askGemini({ question, customerName, history = [] }) {
  if (!genAI) {
    return { answer: 'AI is niet geconfigureerd. Voeg je VITE_GEMINI_API_KEY toe in .env', escalate: false }
  }

  try {
    const contextItems = await getRelevantContext(question)
    const contextText = contextItems.length > 0
      ? contextItems.map(i => `[${i.title}]\n${i.content}`).join('\n\n')
      : 'Geen relevante kennisbank-items gevonden.'

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const historyText = history.slice(-6).map(m =>
      `${m.role === 'user' ? 'Klant' : 'Assistent'}: ${m.text}`
    ).join('\n')

    const prompt = `${SYSTEM_PROMPT}

KENNISBANK CONTEXT:
${contextText}

${customerName ? `KLANTNAAM: ${customerName}` : ''}

${historyText ? `GESPREKSGESCHIEDENIS:\n${historyText}\n` : ''}

NIEUWE VRAAG VAN KLANT:
${question}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const escalate = text.startsWith('ESCALATE:')
    const reason = escalate ? text.replace('ESCALATE:', '').trim() : null
    const answer = escalate ? null : text

    // Log to Supabase
    await logAiQuery({
      question,
      matched_items: contextItems.map(i => i.title).join(', '),
      answer: answer || `ESCALATED: ${reason}`,
      escalated: escalate,
      created_at: new Date().toISOString()
    })

    return { answer, escalate, reason }

  } catch (err) {
    console.error('Gemini error:', err)
    return { answer: null, escalate: true, reason: 'AI-fout: ' + err.message }
  }
}

/**
 * Genereer een concept e-mail reactie.
 */
export async function generateEmailDraft({ subject, body, senderName }) {
  if (!genAI) return 'Geen API key geconfigureerd.'

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Schrijf een professionele, vriendelijke e-mail reactie in het Nederlands.

Van: ${senderName}
Onderwerp: ${subject}
Inhoud van de ontvangen e-mail:
${body}

Schrijf een reactie die:
- Begint met "Hallo ${senderName},"
- Kort en professioneel is
- Eindigt met "Met vriendelijke groet," en een lege regel voor de naam
- Geen opmaak of markdown gebruikt`

    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch (err) {
    console.error('Gemini email draft error:', err)
    return 'Kon geen concept genereren. Controleer je API key.'
  }
}
