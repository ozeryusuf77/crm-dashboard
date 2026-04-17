import { useState } from 'react'
import { Badge } from './ui.jsx'

export default function EmailView({ email, onClose, onSend, onIgnore, onUpdate }) {
  const [draft, setDraft] = useState(email.draft)

  const handleSend = () => {
    onUpdate(email.id, draft)
    onSend(email.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Incoming email */}
      <div>
        <div className="sec-title">Inkomende e-mail</div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className={`avatar ${email.avatar_class}`} style={{ width: 34, height: 34, fontSize: 12, minWidth: 34 }}>{email.initials}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{email.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{email.company} · {email.date_label}</div>
            </div>
            <Badge status={email.status} />
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', padding: '10px 12px', background: '#f9fafb', borderRadius: 8, color: '#111' }}>
            {email.body}
          </div>
        </div>
      </div>

      {/* Draft or result */}
      {email.draft_status === 'sent' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534' }}>
          <div className="hdot hdot-ai" /> E-mail verzonden
        </div>
      ) : email.draft_status === 'ignored' ? (
        <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 13, color: '#666' }}>
          Concept genegeerd — geen actie ondernomen.
        </div>
      ) : (
        <div>
          <div className="sec-title">AI-concept — jouw reactie</div>
          <div className="draft-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div className="hdot hdot-ai" /> AI-gegenereerd concept — nog niet verzonden
            </div>
            <textarea
              className="draft-textarea"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <div className="draft-actions">
              <button className="btn btn-green" onClick={handleSend}>Verzenden</button>
              <button className="btn" onClick={() => document.querySelector('.draft-textarea')?.focus()}>Bewerken</button>
              <button className="btn btn-danger" onClick={() => onIgnore(email.id)}>Negeren</button>
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>Jij beslist — AI verzendt nooit automatisch</div>
          </div>
        </div>
      )}
    </div>
  )
}
