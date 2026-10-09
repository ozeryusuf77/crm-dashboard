import { useState } from 'react'
import { AIToggle } from './ui.jsx'

export default function WebChatView({ visitor, onClose, onToggleAI, onSend }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim()) return
    onSend(visitor.id, text.trim())
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-18px -20px', minHeight: 0 }}>

      {/* Visitor info */}
      <div style={{ padding: '10px 18px', background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Bezoeker info</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 12 }}>
          <span style={{ color: '#888' }}>ID</span>       <span style={{ fontWeight: 600 }}>{visitor.name}</span>
          <span style={{ color: '#888' }}>Pagina</span>   <span style={{ fontWeight: 600 }}>Pricing pagina</span>
          <span style={{ color: '#888' }}>Status</span>   <span style={{ fontWeight: 600, color: visitor.ai_mode ? '#166534' : '#1e40af' }}>{visitor.ai_mode ? 'AI beantwoordt' : 'Handmatig actief'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-area" style={{ flex: 1 }}>
        {visitor.messages.map(m => {
          if (m.direction === 'sys') return <div key={m.id} className="sys-note">{m.text}</div>
          return (
            <div key={m.id} className={`msg ${m.direction === 'in' ? 'incoming' : 'outgoing'}${m.ai ? ' ai-msg' : ''}`}>
              <div className="bubble">{m.text}</div>
              <div className="msg-meta">{m.ts}{m.ai ? ' · AI' : ''}</div>
            </div>
          )
        })}
      </div>

      {/* Compose */}
      <div className="compose-area">
        <AIToggle aiMode={visitor.ai_mode} onToggle={() => onToggleAI(visitor.id)} />
        {visitor.ai_mode ? (
          <div className="ai-banner">
            <div className="hdot hdot-ai" />
            AI beantwoordt automatisch via Gemini + kennisbank
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onToggleAI(visitor.id)}>Overnemen</button>
          </div>
        ) : (
          <div className="compose-row">
            <textarea
              className="compose-input"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Typ een bericht aan de bezoeker..."
            />
            <button className="btn btn-primary btn-sm" onClick={handleSend}>Verzend</button>
          </div>
        )}
      </div>
    </div>
  )
}
