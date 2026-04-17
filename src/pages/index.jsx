import { useState } from 'react'
import { Badge, Avatar, DataRow, FilterBar, MetricCard, SectionTitle, WfRow, ConnBar, ToggleSwitch, showToast } from '../components/ui.jsx'

// ─── Shared sort helper ───────────────────────────────────────────────────────
const STATUS_ORDER = { hot: 0, warm: 1, cold: 2, new: 3, esc: 4 }
const STATUS_LABELS = { hot: 'Hot', warm: 'Warm', cold: 'Koud', new: 'Nieuw', esc: 'Escalatie' }

function sortLeads(leads, sortKey) {
  const d = [...leads]
  if (sortKey === 'date-asc')    return d.reverse()
  if (sortKey === 'status-hot')  return d.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  if (sortKey === 'status-cold') return d.sort((a, b) => STATUS_ORDER[b.status] - STATUS_ORDER[a.status])
  if (sortKey === 'name-az')     return d.sort((a, b) => a.name.localeCompare(b.name))
  if (sortKey === 'name-za')     return d.sort((a, b) => b.name.localeCompare(a.name))
  return d // date-desc default
}

const WA_FILTER_OPTIONS  = [{ value: 'all', label: 'Alle' }, { value: 'hot', label: 'Hot' }, { value: 'warm', label: 'Warm' }, { value: 'cold', label: 'Koud' }, { value: 'new', label: 'Nieuw' }]
const SORT_OPTIONS = [
  { value: 'date-desc',   label: 'Nieuwste eerst' },
  { value: 'date-asc',    label: 'Oudste eerst'   },
  { value: 'status-hot',  label: 'Warm → Koud'    },
  { value: 'status-cold', label: 'Koud → Warm'    },
  { value: 'name-az',     label: 'Naam A–Z'       },
]
const CAT_COLORS = { product: 'tag-blue', support: 'tag-green', escalation: 'tag-amber', sales: 'tag-purple' }
const CAT_LABELS = { product: 'Product', support: 'Support', escalation: 'Escalatie', sales: 'Sales' }

// ─── Overview ─────────────────────────────────────────────────────────────────
export function PageOverview({ leads, emails, visitors, navigate, openChat }) {
  const escLeads = leads.filter(l => l.status === 'esc')
  return (
    <div>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard label="WhatsApp chats"  value={leads.length}                          delta={`AI actief op ${leads.filter(l => l.ai_mode).length}`} onClick={() => navigate('wa-chats')} />
        <MetricCard label="E-mail inbox"    value={emails.filter(e => !e.filtered).length} delta="Concepten gereed"  onClick={() => navigate('em-inbox')} />
        <MetricCard label="Website live"    value={visitors.length}                        delta="Live actief"       onClick={() => navigate('wb-live')} />
        <MetricCard label="Escalaties"      value={escLeads.length} color={escLeads.length ? '#dc2626' : undefined} delta={escLeads.length ? 'actie vereist' : 'alles OK'} onClick={() => navigate('wa-esc')} />
      </div>
      <div className="two-col">
        <div className="card">
          <SectionTitle>Recente WhatsApp</SectionTitle>
          {leads.slice(0, 4).map(l => <DataRow key={l.id} lead={l} onClick={() => openChat('wa', l.id)} />)}
        </div>
        <div className="card">
          <SectionTitle>Recente e-mails</SectionTitle>
          {emails.filter(e => !e.filtered).map(e => (
            <div key={e.id} className="data-row clickable" onClick={() => openChat('em', e.id)}>
              <Avatar initials={e.initials} avatarClass={e.avatar_class} size={28} />
              <div className="row-name">{e.name}</div>
              <div className="row-detail">{e.subject}</div>
              <Badge status={e.status} />
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <SectionTitle>Actiepunten</SectionTitle>
        {escLeads.map(l => <WfRow key={l.id} num="!" highlight text={`${l.name} — ${l.summary}`} right={<button className="btn btn-sm" onClick={() => openChat('wa', l.id)}>Open ↗</button>} />)}
        {emails.filter(e => !e.filtered && !e.draft_status).slice(0, 1).map(e => <WfRow key={e.id} num="✉" text={`${e.name} — e-mail concept klaar`} right={<button className="btn btn-sm" onClick={() => openChat('em', e.id)}>Open ↗</button>} />)}
        {escLeads.length === 0 && <div className="empty-state" style={{ padding: '12px 0' }}>Geen openstaande actiepunten 🎉</div>}
      </div>
    </div>
  )
}

// ─── WA Chats ─────────────────────────────────────────────────────────────────
export function PageWaChats({ leads, waFilter, setWaFilter, waSort, setWaSort, openChat }) {
  let data = leads.filter(l => l.status !== 'esc')
  if (waFilter !== 'all') data = data.filter(l => l.status === waFilter)
  data = sortLeads(data, waSort)
  return (
    <div>
      <FilterBar options={WA_FILTER_OPTIONS} active={waFilter} onSelect={setWaFilter} sortOptions={SORT_OPTIONS} sortValue={waSort} onSort={setWaSort} />
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{data.length} gesprek{data.length !== 1 ? 'ken' : ''}</div>
      <div className="card" style={{ padding: '0 16px' }}>
        {data.length ? data.map(l => <DataRow key={l.id} lead={l} onClick={() => openChat('wa', l.id)} />) : <div className="empty-state">Geen gesprekken voor dit filter.</div>}
      </div>
    </div>
  )
}

// ─── WA Escalaties ────────────────────────────────────────────────────────────
export function PageWaEsc({ leads, openChat }) {
  const data = leads.filter(l => l.status === 'esc')
  return (
    <div>
      {data.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
          <div className="hdot" style={{ background: '#dc2626' }} /> {data.length} gesprek{data.length !== 1 ? 'ken' : ''} vereist jouw actie
        </div>
      )}
      <div className="card" style={{ padding: '0 16px' }}>
        {data.length ? data.map(l => (
          <div key={l.id} className="data-row clickable" onClick={() => openChat('wa', l.id)}>
            <Avatar initials={l.initials} avatarClass={l.avatar_class} size={30} />
            <div className="row-name">{l.name} <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>· {l.company}</span></div>
            <div className="row-detail">{l.summary}</div>
            <Badge status="esc" />
            <div className="row-time">{l.date_label}</div>
            <button className="btn btn-sm" onClick={e => { e.stopPropagation(); openChat('wa', l.id) }}>Overnemen ↗</button>
          </div>
        )) : <div className="empty-state">Geen open escalaties 🎉</div>}
      </div>
      <div className="card">
        <SectionTitle>Escalatieregels</SectionTitle>
        {['Vraag buiten kennisbank → escaleer naar jou', 'Klacht of negatief sentiment → escaleer', 'Budget >€500 of maatwerk → escaleer', 'Na afhandeling → status terug naar vorige lead-status'].map((t, i) => (
          <WfRow key={i} num={i + 1} text={t} right={<ToggleSwitch checked={true} onChange={() => {}} />} />
        ))}
      </div>
    </div>
  )
}

// ─── WA Leads ─────────────────────────────────────────────────────────────────
export function PageWaLeads({ leads, openChat }) {
  return (
    <div className="card" style={{ padding: '0 16px' }}>
      {leads.map(l => <DataRow key={l.id} lead={l} onClick={() => openChat('wa', l.id)} />)}
    </div>
  )
}

// ─── WA Reports ───────────────────────────────────────────────────────────────
export function PageWaReports({ leads, openChat }) {
  const esc = leads.filter(l => l.status === 'esc').length
  return (
    <div>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard label="Nieuwe leads"    value={12}   delta="+4 vs vorige week" />
        <MetricCard label="Hot leads"       value={2}    color="#991b1b" delta="+1" />
        <MetricCard label="AI-afhandeling"  value="87%"  delta="+5%" />
        <MetricCard label="Escalaties"      value={esc}  delta="deze week" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => showToast('Exporteren naar Sheets...')}>Sheets ↗</button>
        <button className="btn" onClick={() => showToast('E-mail rapport verstuurd!')}>E-mail ↗</button>
      </div>
      <div className="card"><SectionTitle>Leads week 16 — klik om gesprek te openen</SectionTitle>
        {leads.map(l => <DataRow key={l.id} lead={l} onClick={() => openChat('wa', l.id)} />)}
      </div>
    </div>
  )
}

// ─── WA Settings ─────────────────────────────────────────────────────────────
export function PageWaSettings() { return <SettingsPage channel="WhatsApp" /> }

// ─── EM Inbox ─────────────────────────────────────────────────────────────────
export function PageEmInbox({ emails, openChat }) {
  const [showFiltered, setShowFiltered] = useState(false)
  const visible  = emails.filter(e => !e.filtered)
  const filtered = emails.filter(e => e.filtered)

  if (showFiltered) return (
    <div>
      <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={() => setShowFiltered(false)}>← Terug naar inbox</button>
      <div className="card" style={{ padding: '0 16px' }}>
        {filtered.map(e => (
          <div key={e.id} className="data-row" style={{ opacity: 0.55 }}>
            <Avatar initials={e.initials} avatarClass={e.avatar_class} size={28} />
            <div className="row-name">{e.name}</div>
            <div className="row-detail">{e.subject}</div>
            <span className="badge" style={{ background: '#f3f4f6', color: '#666' }}>Gefilterd</span>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-sm" onClick={() => setShowFiltered(true)}>Gefilterd ({filtered.length})</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#166534' }}>
        <div className="hdot" style={{ background: '#16a34a' }} /> {filtered.length} e-mails automatisch gefilterd (spam, reclame, facturen, nieuwsbrieven)
      </div>
      <div className="card" style={{ padding: '0 16px' }}>
        {visible.map(e => (
          <div key={e.id} className="data-row clickable" onClick={() => openChat('em', e.id)}>
            <Avatar initials={e.initials} avatarClass={e.avatar_class} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{e.subject}</div>
              <div className="row-detail">{e.name} · {e.company}</div>
            </div>
            <Badge status={e.status} />
            {e.draft_status === 'sent' && <span className="badge badge-sent">Verzonden</span>}
            <div className="row-time">{e.date_label}</div>
            <span style={{ color: '#ccc' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageEmLeads({ emails, openChat }) {
  return (
    <div className="card" style={{ padding: '0 16px' }}>
      {emails.filter(e => !e.filtered).map(e => (
        <div key={e.id} className="data-row clickable" onClick={() => openChat('em', e.id)}>
          <Avatar initials={e.initials} avatarClass={e.avatar_class} size={28} />
          <div className="row-name">{e.name}</div>
          <div className="row-detail">{e.subject}</div>
          <Badge status={e.status} />
          <div className="row-time">{e.date_label}</div>
        </div>
      ))}
    </div>
  )
}

export function PageEmReports() {
  return (
    <div>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <MetricCard label="E-mail leads"     value={3}    delta="deze week" />
        <MetricCard label="Hot leads"        value={1}    color="#991b1b" />
        <MetricCard label="Auto-gefilterd"   value={2}    delta="spam / facturen" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => showToast('Exporteren naar Sheets...')}>Sheets ↗</button>
        <button className="btn" onClick={() => showToast('E-mail rapport verstuurd!')}>E-mail ↗</button>
      </div>
    </div>
  )
}

export function PageEmSettings() { return <SettingsPage channel="E-mail" showEmailOptions /> }

// ─── Website ──────────────────────────────────────────────────────────────────
export function PageWbLive({ visitors, openChat }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f9fafb', border: '1px solid #e5e5e5', borderRadius: 10, marginBottom: 12 }}>
        <div className="hdot hdot-ai pulse" /> <span style={{ fontSize: 13, fontWeight: 600 }}>{visitors.length} bezoekers actief</span>
        <span style={{ fontSize: 12, color: '#666' }}>— AI beantwoordt automatisch</span>
      </div>
      <div className="card" style={{ padding: '0 16px' }}>
        {visitors.map(v => (
          <div key={v.id} className="data-row clickable" onClick={() => openChat('wb', v.id)}>
            <Avatar initials={v.initials} avatarClass={v.avatar_class} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
              <div className="row-detail">{v.summary}</div>
            </div>
            <span className="badge" style={{ background: v.ai_mode ? '#dcfce7' : '#dbeafe', color: v.ai_mode ? '#166534' : '#1e40af' }}>
              {v.ai_mode ? 'AI actief' : 'Handmatig'}
            </span>
            <Badge status={v.status} />
            <span style={{ color: '#ccc' }}>›</span>
          </div>
        ))}
      </div>
      <div className="card">
        <SectionTitle>Hoe het werkt</SectionTitle>
        {['Bezoeker opent chat op de website', 'AI (Gemini + kennisbank) beantwoordt direct', 'Jij ziet het gesprek live — toggle om over te nemen', 'Zet terug op AI wanneer je klaar bent'].map((t, i) => (
          <WfRow key={i} num={i + 1} text={t} />
        ))}
      </div>
    </div>
  )
}

export function PageWbBot() {
  const [msgs, setMsgs] = useState([{ id: 1, from: 'bot', text: 'Hallo! Hoe kan ik je helpen? 👋' }])
  const [input, setInput] = useState('')
  const replies = { 'wat zijn jullie prijzen?': 'Pakketten vanaf €49/mnd. S, M en L beschikbaar!', 'hoe werkt het?': 'We automatiseren klantcommunicatie via WhatsApp, e-mail en website.', 'contact': 'Laat je naam en e-mail achter!' }
  const send = (text) => {
    if (!text.trim()) return
    const next = [...msgs, { id: Date.now(), from: 'user', text }]
    setMsgs(next)
    setInput('')
    const reply = replies[text.toLowerCase()] || 'Goede vraag! Kan ik ook je naam en e-mail noteren?'
    setTimeout(() => setMsgs(m => [...m, { id: Date.now() + 1, from: 'bot', text: reply }]), 600)
  }
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Live preview — probeer de chatbot.</div>
      <div style={{ maxWidth: 300, border: '1px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ background: '#4338ca', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#e0e7ff' }}>AI</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e7ff' }}>Hoi! Ik ben jouw assistent</div>
        </div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7, background: '#f9fafb', minHeight: 150 }}>
          {msgs.map(m => (
            <div key={m.id} style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12, background: m.from === 'user' ? '#4338ca' : '#fff', color: m.from === 'user' ? '#e0e7ff' : '#111', border: m.from === 'bot' ? '1px solid #e5e5e5' : 'none', borderBottomLeftRadius: m.from === 'bot' ? 2 : 10, borderBottomRightRadius: m.from === 'user' ? 2 : 10 }}>
                {m.text}
              </div>
            </div>
          ))}
          {msgs.length === 1 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {['Prijzen', 'Hoe werkt het?', 'Contact'].map(t => (
                <div key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, border: '1px solid #4338ca', color: '#4338ca', cursor: 'pointer' }} onClick={() => send(t.toLowerCase())}>{t}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, padding: 8, borderTop: '1px solid #e5e5e5', background: '#fff' }}>
          <input style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#f9fafb', outline: 'none' }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send(input)} placeholder="Stel een vraag..." />
          <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#4338ca', color: '#e0e7ff', border: 'none', cursor: 'pointer' }} onClick={() => send(input)}>→</button>
        </div>
      </div>
    </div>
  )
}

export function PageWbLeads({ leads, openChat }) {
  return <div className="card" style={{ padding: '0 16px' }}>{leads.slice(0, 3).map(l => <DataRow key={l.id} lead={l} onClick={() => openChat('wa', l.id)} />)}</div>
}
export function PageWbReports() { return <div className="empty-state">Website rapportages — in opbouw.</div> }
export function PageWbSettings() { return <SettingsPage channel="Website" /> }

// ─── KB Overview ──────────────────────────────────────────────────────────────
export function PageKbOverview({ kb, navigate, openChat }) {
  return (
    <div>
      <ConnBar label="Supabase verbonden" sub="— knowledge_base" right={<span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#166534' }}><div className="status-dot dot-green" />Gemini gekoppeld</span>} />
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <MetricCard label="Totaal items"     value={kb.length}                        onClick={() => navigate('kb-entries')} />
        <MetricCard label="Actief voor AI"   value={kb.filter(k => k.active).length}  color="#166534" delta="Gemini leest deze" />
        <MetricCard label="Queries vandaag"  value={47}                               onClick={() => navigate('kb-logs')} />
        <MetricCard label="Match drempel"    value="0.75"                             delta="similarity score" />
      </div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionTitle>Actieve items</SectionTitle>
          <button className="btn btn-sm" onClick={() => navigate('kb-entries')}>Alle bekijken</button>
        </div>
        {kb.filter(k => k.active).map(k => (
          <div key={k.id} className="data-row clickable" onClick={() => navigate('kb-entries')}>
            <span className={`tag ${CAT_COLORS[k.category]}`}>{CAT_LABELS[k.category]}</span>
            <div className="row-detail">{k.title}</div>
            <div className="row-time">{k.updated}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => navigate('kb-add')}>+ Nieuw item</button>
        <button className="btn" onClick={() => navigate('kb-supabase')}>Supabase</button>
        <button className="btn" onClick={() => navigate('kb-gemini')}>Gemini</button>
        <button className="btn" onClick={() => navigate('kb-logs')}>Logs</button>
      </div>
    </div>
  )
}

// ─── KB Entries ───────────────────────────────────────────────────────────────
export function PageKbEntries({ kb, kbFilter, setKbFilter, navigate, saveKbItem, deleteKbItem }) {
  const [editing, setEditing] = useState(null)
  const filtered = kbFilter === 'all' ? kb : kb.filter(k => k.category === kbFilter)

  if (editing) {
    return <KbEditForm item={editing} onSave={item => { saveKbItem(item); setEditing(null); showToast('Opgeslagen in Supabase ✓') }} onDelete={id => { deleteKbItem(id); setEditing(null); showToast('Verwijderd uit Supabase') }} onCancel={() => setEditing(null)} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('kb-add')}>+ Nieuw item</button>
      </div>
      <FilterBar options={[{ value: 'all', label: 'Alle' }, ...Object.entries(CAT_LABELS).map(([v, l]) => ({ value: v, label: l }))]} active={kbFilter} onSelect={setKbFilter} />
      <div className="card" style={{ padding: '0 16px' }}>
        {filtered.map(k => (
          <div key={k.id} className="data-row clickable" onClick={() => setEditing(k)}>
            <span className={`tag ${CAT_COLORS[k.category]}`}>{CAT_LABELS[k.category]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{k.title}</div>
              <div className="row-detail">{k.content}</div>
            </div>
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: k.active ? '#dcfce7' : '#f3f4f6', color: k.active ? '#166534' : '#888' }}>{k.active ? 'Actief' : 'Inactief'}</span>
            <div className="row-time">{k.updated}</div>
            <span style={{ color: '#ccc' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function KbEditForm({ item, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({ ...item })
  return (
    <div>
      <button className="btn btn-sm" style={{ marginBottom: 14 }} onClick={onCancel}>← Terug</button>
      <div className="card">
        <SectionTitle>Item bewerken</SectionTitle>
        <div className="form-group">
          <label className="form-label">Titel</label>
          <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Categorie</label>
          <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Inhoud — dit leest Gemini</label>
          <textarea className="form-input" value={form.content} rows={5} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ToggleSwitch checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <span style={{ fontSize: 13, color: '#555' }}>Actief voor Gemini</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Opslaan in Supabase</button>
          <button className="btn btn-danger" onClick={() => onDelete(item.id)}>Verwijderen</button>
        </div>
      </div>
    </div>
  )
}

// ─── KB Add ───────────────────────────────────────────────────────────────────
export function PageKbAdd({ saveKbItem, navigate }) {
  const [form, setForm] = useState({ title: '', category: 'product', content: '', active: true })
  const submit = () => {
    if (!form.title.trim() || !form.content.trim()) { showToast('Vul titel en inhoud in'); return }
    saveKbItem(form); showToast('Opgeslagen in Supabase ✓'); navigate('kb-entries')
  }
  return (
    <div className="card">
      <SectionTitle>Nieuw kennisitem</SectionTitle>
      <div className="form-group">
        <label className="form-label">Titel</label>
        <input className="form-input" value={form.title} placeholder="Bijv. Openingstijden support" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Categorie</label>
        <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Inhoud — dit leest Gemini als antwoord</label>
        <textarea className="form-input" value={form.content} rows={5} placeholder="Schrijf hier de informatie die de AI moet kennen..." onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <ToggleSwitch checked={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} />
        <span style={{ fontSize: 13, color: '#555' }}>Direct activeren voor Gemini</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={submit}>Opslaan in Supabase</button>
        <button className="btn" onClick={() => navigate('kb-entries')}>Annuleren</button>
      </div>
    </div>
  )
}

// ─── KB Supabase ──────────────────────────────────────────────────────────────
export function PageKbSupabase() {
  return (
    <div>
      <ConnBar label="Supabase verbonden" sub="mijnbedrijf-crm.supabase.co" right={<button className="btn btn-sm">Verbreek</button>} />
      <div className="two-col">
        <div className="card">
          <SectionTitle>Verbindingsinstellingen</SectionTitle>
          <div className="form-group"><label className="form-label">Project URL</label><input className="form-input" defaultValue="https://JOUW-ID.supabase.co" /></div>
          <div className="form-group"><label className="form-label">Anon API key</label><input className="form-input" type="password" defaultValue="eyJhbG..." /></div>
          <div className="form-group"><label className="form-label">Tabel naam</label><input className="form-input" defaultValue="knowledge_base" /></div>
          <button className="btn btn-primary" onClick={() => showToast('Instellingen opgeslagen ✓')}>Opslaan</button>
        </div>
        <div className="card">
          <SectionTitle>SQL tabelstructuur</SectionTitle>
          <div className="code-block">{`CREATE TABLE knowledge_base (
  id         BIGINT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  category   TEXT,
  active     BOOLEAN DEFAULT true,
  embedding  VECTOR(768),
  updated_at TIMESTAMPTZ DEFAULT now()
);`}</div>
        </div>
      </div>
    </div>
  )
}

// ─── KB Gemini ────────────────────────────────────────────────────────────────
export function PageKbGemini() {
  return (
    <div>
      <ConnBar label="Gemini 1.5 Pro verbonden" right={<span style={{ fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 5 }}><div className="status-dot dot-green" />API actief</span>} />
      <div className="two-col">
        <div className="card">
          <SectionTitle>API instellingen</SectionTitle>
          <div className="form-group"><label className="form-label">Gemini API key</label><input className="form-input" type="password" defaultValue="AIzaSy..." /></div>
          <div className="form-group">
            <label className="form-label">Model</label>
            <select className="form-select"><option>gemini-1.5-pro-latest</option><option>gemini-1.5-flash</option></select>
          </div>
          <div className="form-group"><label className="form-label">Max tokens</label><input className="form-input" type="number" defaultValue={1024} /></div>
          <button className="btn btn-primary" onClick={() => showToast('Gemini instellingen opgeslagen ✓')}>Opslaan</button>
        </div>
        <div className="card">
          <SectionTitle>Gedragsinstellingen</SectionTitle>
          {['Alleen kennisbank gebruiken', 'Escaleer bij score <0.75', 'Nederlands forceren', 'Conversatiehistorie meesturen', 'Klantnaam gebruiken'].map((t, i) => (
            <WfRow key={i} num={i + 1} text={t} right={<ToggleSwitch checked={true} onChange={() => {}} />} />
          ))}
        </div>
      </div>
      <div className="card">
        <SectionTitle>Systeem-prompt</SectionTitle>
        <textarea className="form-input" rows={6} defaultValue="Je bent een vriendelijke klantenservice-assistent voor MijnBedrijf. Beantwoord vragen uitsluitend op basis van de kennisbank uit Supabase. Antwoord altijd in het Nederlands. Gebruik de naam van de klant als die bekend is. Als een vraag buiten de kennisbank valt, geef aan dat je doorverwijst naar een collega." />
        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => showToast('Systeem-prompt opgeslagen ✓')}>Opslaan</button>
      </div>
    </div>
  )
}

// ─── KB Logs ──────────────────────────────────────────────────────────────────
export function PageKbLogs({ logs }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Alle Gemini queries — opgeslagen in Supabase tabel <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>ai_query_logs</code></div>
      <div className="card" style={{ padding: '0 16px' }}>
        {logs.map(l => (
          <div key={l.id} className="data-row">
            <div style={{ fontSize: 12, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{l.question}</div>
            <div className="row-detail">{l.matched_items}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: !l.escalated ? '#166534' : '#dc2626', minWidth: 28 }}>{l.escalated ? '—' : '✓'}</span>
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: !l.escalated ? '#dcfce7' : '#fee2e2', color: !l.escalated ? '#166534' : '#991b1b' }}>{l.escalated ? 'Geëscaleerd' : 'Beantwoord'}</span>
            <div className="row-time">{new Date(l.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared Settings page ─────────────────────────────────────────────────────
function SettingsPage({ channel, showEmailOptions = false }) {
  return (
    <div className="card">
      <SectionTitle>{channel} — instellingen</SectionTitle>
      {[
        'AI automatisch beantwoorden',
        'Escalatie-notificaties',
        'Leads opslaan in Supabase',
        'Wekelijkse rapportage per e-mail',
        ...(showEmailOptions ? ['Auto-filter spam/reclame/facturen', 'Concept genereren — nooit auto-verzenden'] : []),
      ].map((label, i) => (
        <WfRow key={i} num={null} text={label} right={<ToggleSwitch checked={true} onChange={() => {}} />} />
      ))}
    </div>
  )
}
