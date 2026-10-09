import { useState } from 'react'
import { AIToggle, Badge } from './ui.jsx'

const STATUS_LABELS = { hot: 'Hot', warm: 'Warm', cold: 'Koud', new: 'Nieuw' }
const STATUS_CLS    = { hot: 'badge-hot', warm: 'badge-warm', cold: 'badge-cold', new: 'badge-new' }

export default function ChatView({ lead, onClose, onToggleAI, onSend, onSetPrevStatus }) {
  const [text, setText] = useState('')
  const wasEsc = lead.status === 'esc'

  const handleSend = () => {
    if (!text.trim()) return
    onSend(lead.id, text.trim())
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: '-18px -20px', minHeight: 0 }}>

      {/* Customer memory strip */}
      <div style={{ padding: '10px 18px', background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Klantgeheugen</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 12 }}>
          {Object.entries(lead.memory).map(([k, v]) => (
            <>
              <span key={k + '-k'} style={{ color: '#888' }}>{k}</span>
              <span key={k + '-v'} style={{ fontWeight: 600 }}>{v}</span>
            </>
          ))}
        </div>
      </div>

      {/* Status picker when escalated */}
      {wasEsc && (
        <div className="status-picker">
          <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>Status na afhandeling:</span>
          {['hot', 'warm', 'cold', 'new'].map(s => (
            <button
              key={s}
              className={`filter-btn${lead.prev_status === s ? ' active' : ''}`}
              onClick={() => onSetPrevStatus(lead.id, s)}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="messages-area" style={{ flex: 1 }}>
        {lead.messages.map(m => {
          if (m.direction === 'sys') return (
            <div key={m.id} className="sys-note">{m.text}</div>
          )
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
        <AIToggle aiMode={lead.ai_mode} onToggle={() => onToggleAI(lead.id)} />
        {lead.ai_mode ? (
          <div className="ai-banner">
            <div className="hdot hdot-ai" />
            AI beantwoordt automatisch via Gemini + kennisbank
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onToggleAI(lead.id)}>Overnemen</button>
          </div>
        ) : (
          <>
            <div className="compose-row">
              <textarea
                className="compose-input"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder="Typ een bericht..."
              />
              <button className="btn btn-primary btn-sm" onClick={handleSend}>Verzend</button>
            </div>
            {wasEsc && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                → AI hervatten zet status op <strong>{STATUS_LABELS[lead.prev_status]}</strong>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
