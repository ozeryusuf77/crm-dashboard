import { useState, useRef, useEffect } from 'react'

export default function ChatWidget() {
  const [msgs, setMsgs] = useState([
    { van: 'bot', tekst: 'Hoi! 👋 Welkom bij Megaschuifwand. Hoe kan ik je helpen?' }
  ])
  const [input, setInput] = useState('')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [leadForm, setLeadForm] = useState(false)
  const [verstuurd, setVerstuurd] = useState(false)
  const [laden, setLaden] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, laden])

  const quickVragen = [
    'Welke maten zijn er?',
    'Wat kost een schuifwand?',
    'Hoe werkt de montage?',
  ]

  const stuur = async (tekst) => {
    const vraag = (tekst || input).trim()
    if (!vraag || laden) return
    setInput('')
    const nieuweMsg = [...msgs, { van: 'user', tekst: vraag }]
    setMsgs(nieuweMsg)
    setLaden(true)

    const geschiedenis = msgs.slice(-6).map(m =>
      `${m.van === 'user' ? 'Klant' : 'Assistent'}: ${m.tekst}`
    ).join('\n')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vraag, geschiedenis })
      })
      const data = await res.json()
      setMsgs(m => [...m, { van: 'bot', tekst: data.antwoord || 'Even geduld — probeer het opnieuw.' }])
    } catch {
      setMsgs(m => [...m, { van: 'bot', tekst: 'Even geduld — probeer het opnieuw.' }])
    }

    setLaden(false)

    if (nieuweMsg.length >= 5 && !leadForm && !verstuurd) {
      setTimeout(() => {
        setMsgs(m => [...m, { van: 'bot', tekst: 'Kan ik je ook een offerte of advies op maat sturen? Laat dan even je gegevens achter!' }])
        setLeadForm(true)
      }, 800)
    }
  }

  const verstuurLead = () => {
    if (!naam.trim() || !email.trim()) return
    setLeadForm(false)
    setVerstuurd(true)
    setMsgs(m => [...m, { van: 'bot', tekst: `Bedankt ${naam}! We nemen snel contact op via ${email}. Tot dan! 👋` }])
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 13, background: '#f8f9fa'
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a2342 0%, #1a3a5c 100%)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
          background: '#00b4d8', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="14" rx="2" stroke="white" strokeWidth="1.5"/>
            <path d="M3 8h18" stroke="white" strokeWidth="1.5"/>
            <path d="M8 8v10" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
            Megaschuifwand
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ color: '#90c4d8', fontSize: 11 }}>AI-assistent online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '14px 12px',
        display: 'flex', flexDirection: 'column', gap: 10
      }}>

        {/* Quick vragen — alleen bij start */}
        {msgs.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {quickVragen.map((v, i) => (
              <button key={i} onClick={() => stuur(v)} style={{
                fontSize: 11, padding: '5px 11px', borderRadius: 20,
                border: '1px solid #00b4d8', background: '#fff',
                color: '#0a2342', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s'
              }}>
                {v}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.van === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 3
          }}>
            {m.van === 'bot' && (
              <div style={{ fontSize: 10, color: '#888', paddingLeft: 4 }}>Megaschuifwand AI</div>
            )}
            <div style={{
              padding: '9px 13px',
              borderRadius: m.van === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
              fontSize: 13, lineHeight: 1.55,
              background: m.van === 'user'
                ? 'linear-gradient(135deg, #0a2342, #1a3a5c)'
                : '#fff',
              color: m.van === 'user' ? '#fff' : '#1a1a2e',
              border: m.van === 'bot' ? '1px solid #e8ecef' : 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              {m.tekst}
            </div>
          </div>
        ))}

        {laden && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
            <div style={{ fontSize: 10, color: '#888', paddingLeft: 4, marginBottom: 3 }}>Megaschuifwand AI</div>
            <div style={{
              padding: '10px 14px', borderRadius: '14px 14px 14px 3px',
              background: '#fff', border: '1px solid #e8ecef',
              display: 'flex', gap: 4, alignItems: 'center'
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#00b4d8',
                  animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`
                }} />
              ))}
            </div>
          </div>
        )}

        {leadForm && !verstuurd && (
          <div style={{
            background: '#fff', border: '1px solid #e8ecef', borderRadius: 12,
            padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0a2342', marginBottom: 10 }}>
              Laat je gegevens achter
            </div>
            <input
              placeholder="Jouw naam"
              value={naam}
              onChange={e => setNaam(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 12, marginBottom: 7,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
            <input
              placeholder="E-mailadres"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verstuurLead()}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 12, marginBottom: 10,
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
            <button
              onClick={verstuurLead}
              style={{
                width: '100%', padding: '9px', borderRadius: 8,
                background: 'linear-gradient(135deg, #0a2342, #1a3a5c)',
                color: '#fff', border: 'none', fontSize: 12,
                cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit'
              }}
            >
              Verstuur →
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid #e8ecef',
        display: 'flex', gap: 8, background: '#fff', flexShrink: 0
      }}>
        <input
          placeholder="Stel een vraag over schuifwanden..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && stuur()}
          disabled={laden}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 22,
            border: '1.5px solid #e2e8f0', fontSize: 13,
            outline: 'none', fontFamily: 'inherit',
            background: '#f8f9fa', color: '#1a1a2e',
            transition: 'border-color 0.15s'
          }}
        />
        <button
          onClick={() => stuur()}
          disabled={laden || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: laden || !input.trim()
              ? '#e2e8f0'
              : 'linear-gradient(135deg, #0a2342, #00b4d8)',
            border: 'none', cursor: laden || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
