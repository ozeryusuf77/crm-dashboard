import { useState } from 'react'

const KB_ANTWOORDEN = {
  'prijs': 'Onze pakketten starten vanaf €49/mnd. S: €49, M: €99, L: €199. Bij jaarbetaling 2 maanden gratis!',
  'pakket': 'We hebben S (€49/mnd), M (€99/mnd) en L (€199/mnd). Welk pakket past bij jou?',
  'levering': 'Standaard levering duurt 2-3 werkdagen. Spoed is mogelijk voor €15 extra.',
  'retour': '14 dagen retour mogelijk, ongebruikt en in originele verpakking.',
  'demo': 'We plannen graag een demo in! Stuur een mail naar demo@bedrijf.nl of app via WhatsApp.',
  'contact': 'Je kunt ons bereiken via info@bedrijf.nl of WhatsApp. We reageren binnen 1 werkdag!',
}

function getAntwoord(vraag) {
  const v = vraag.toLowerCase()
  for (const [sleutel, antwoord] of Object.entries(KB_ANTWOORDEN)) {
    if (v.includes(sleutel)) return antwoord
  }
  return 'Goede vraag! Laat je naam en e-mail achter dan nemen wij zo snel mogelijk contact op.'
}

export default function ChatWidget() {
  const [msgs, setMsgs] = useState([
    { van: 'bot', tekst: 'Hoi! 👋 Hoe kan ik je helpen?' }
  ])
  const [input, setInput] = useState('')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [leadForm, setLeadForm] = useState(false)
  const [verstuurd, setVerstuurd] = useState(false)

  const stuur = () => {
    if (!input.trim()) return
    const vraag = input.trim()
    setInput('')
    const nieuweMsg = [...msgs, { van: 'user', tekst: vraag }]
    setMsgs(nieuweMsg)
    setTimeout(() => {
      const antwoord = getAntwoord(vraag)
      setMsgs(m => [...m, { van: 'bot', tekst: antwoord }])
      if (nieuweMsg.length >= 3 && !leadForm && !verstuurd) {
        setTimeout(() => {
          setMsgs(m => [...m, { van: 'bot', tekst: 'Wil je dat wij contact met je opnemen? Laat dan even je gegevens achter!' }])
          setLeadForm(true)
        }, 800)
      }
    }, 600)
  }

  const verstuurLead = () => {
    if (!naam.trim() || !email.trim()) return
    setLeadForm(false)
    setVerstuurd(true)
    setMsgs(m => [...m, { van: 'bot', tekst: `Bedankt ${naam}! We nemen zo snel mogelijk contact op via ${email}. 🎉` }])
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', fontFamily:'-apple-system, sans-serif', fontSize:13 }}>
      <div style={{ padding:'12px 16px', background:'#111', color:'#fff', display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'#333', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>AI</div>
        <div>
          <div style={{ fontWeight:600, fontSize:14 }}>MijnBedrijf Assistent</div>
          <div style={{ fontSize:11, color:'#aaa' }}>Meestal binnen 1 minuut</div>
        </div>
        <div style={{ marginLeft:'auto', width:8, height:8, borderRadius:'50%', background:'#16a34a' }} />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8, background:'#f9fafb' }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.van === 'user' ? 'flex-end' : 'flex-start', maxWidth:'80%' }}>
            <div style={{
              padding:'8px 12px', borderRadius:10, fontSize:13, lineHeight:1.5,
              background: m.van === 'user' ? '#111' : '#fff',
              color: m.van === 'user' ? '#fff' : '#111',
              border: m.van === 'bot' ? '1px solid #e5e5e5' : 'none',
              borderBottomLeftRadius: m.van === 'bot' ? 2 : 10,
              borderBottomRightRadius: m.van === 'user' ? 2 : 10,
            }}>
              {m.tekst}
            </div>
          </div>
        ))}

        {leadForm && !verstuurd && (
          <div style={{ background:'#fff', border:'1px solid #e5e5e5', borderRadius:10, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Laat je gegevens achter</div>
            <input placeholder="Jouw naam" value={naam} onChange={e => setNaam(e.target.value)}
              style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid #e5e5e5', fontSize:12, marginBottom:6, outline:'none', fontFamily:'inherit' }} />
            <input placeholder="E-mailadres" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width:'100%', padding:'7px 10px', borderRadius:7, border:'1px solid #e5e5e5', fontSize:12, marginBottom:8, outline:'none', fontFamily:'inherit' }} />
            <button onClick={verstuurLead}
              style={{ width:'100%', padding:'7px', borderRadius:7, background:'#111', color:'#fff', border:'none', fontSize:12, cursor:'pointer', fontWeight:600 }}>
              Verstuur
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'10px 12px', borderTop:'1px solid #e5e5e5', display:'flex', gap:8, background:'#fff' }}>
        <input
          placeholder="Stel een vraag..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && stuur()}
          style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #e5e5e5', fontSize:13, outline:'none', fontFamily:'inherit' }}
        />
        <button onClick={stuur}
          style={{ padding:'8px 14px', borderRadius:8, background:'#111', color:'#fff', border:'none', fontSize:13, cursor:'pointer', fontWeight:600 }}>
          →
        </button>
      </div>
    </div>
  )
}