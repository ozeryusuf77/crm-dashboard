// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ status }) {
  const map = {
    hot:  'badge badge-hot',  warm: 'badge badge-warm',
    cold: 'badge badge-cold', new:  'badge badge-new',
    esc:  'badge badge-esc',  sent: 'badge badge-sent',
  }
  const labels = { hot: 'Hot', warm: 'Warm', cold: 'Koud', new: 'Nieuw', esc: 'Escalatie', sent: 'Verzonden' }
  return <span className={map[status] || 'badge'}>{labels[status] || status}</span>
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ initials, avatarClass, size = 30 }) {
  return (
    <div className={`avatar ${avatarClass}`} style={{ width: size, height: size, minWidth: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}

// ─── DataRow ──────────────────────────────────────────────────────────────────
export function DataRow({ lead, onClick, right }) {
  return (
    <div className={`data-row${onClick ? ' clickable' : ''}`} onClick={onClick}>
      <Avatar initials={lead.initials} avatarClass={lead.avatar_class} size={30} />
      <div className="row-name">{lead.name}</div>
      <div className="row-detail">{lead.summary || lead.subject || ''}</div>
      {right || <Badge status={lead.status} />}
      <div className="row-time">{lead.date_label}</div>
      {onClick && <span style={{ color: '#ccc', fontSize: 14 }}>›</span>}
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────
export function ToggleSwitch({ checked, onChange }) {
  return (
    <label className="tog-wrap">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="tog-slider" />
    </label>
  )
}

// ─── AI/Human toggle pill ─────────────────────────────────────────────────────
export function AIToggle({ aiMode, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div className={`hdot ${aiMode ? 'hdot-ai' : 'hdot-human'}`} />
      <span style={{ fontSize: 12, fontWeight: 600, color: aiMode ? '#166534' : '#1e40af' }}>
        {aiMode ? 'AI actief' : 'Handmatig actief'}
      </span>
      <div className="toggle-pill" onClick={onToggle}>
        <span style={{ fontSize: 12 }}>{aiMode ? 'Overnemen' : 'AI hervatten'}</span>
      </div>
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
export function FilterBar({ options, active, onSelect, sortOptions, sortValue, onSort }) {
  return (
    <div className="filter-bar">
      {options.map(o => (
        <button key={o.value} className={`filter-btn${active === o.value ? ' active' : ''}`} onClick={() => onSelect(o.value)}>
          {o.label}
        </button>
      ))}
      {sortOptions && (
        <select className="sort-select" value={sortValue} onChange={e => onSort(e.target.value)}>
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────
export function MetricCard({ label, value, delta, color, onClick }) {
  return (
    <div className="metric-card" onClick={onClick}>
      <div className="metric-label">{label}</div>
      <div className="metric-val" style={color ? { color } : {}}>{value}</div>
      {delta && <div className="metric-delta" style={{ color: '#888' }}>{delta}</div>}
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────
export function SectionTitle({ children }) {
  return <div className="sec-title">{children}</div>
}

// ─── Workflow row ─────────────────────────────────────────────────────────────
export function WfRow({ num, text, right, highlight }) {
  return (
    <div className="wf-row">
      <div className="wf-num" style={highlight ? { background: '#fee2e2', color: '#991b1b' } : {}}>{num}</div>
      <div style={{ flex: 1 }}>{text}</div>
      {right}
    </div>
  )
}

// ─── Connection status bar ────────────────────────────────────────────────────
export function ConnBar({ label, sub, status = 'green', right }) {
  return (
    <div className="conn-bar">
      <div className={`status-dot dot-${status}`} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: '#666' }}>{sub}</span>}
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  )
}

// ─── Toast (imperative helper) ────────────────────────────────────────────────
export function showToast(msg) {
  let el = document.getElementById('__toast')
  if (!el) {
    el = document.createElement('div')
    el.id = '__toast'
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#111;color:#fff;font-size:13px;padding:9px 16px;border-radius:8px;z-index:9999;transition:opacity .3s;pointer-events:none'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.opacity = '1'
  clearTimeout(el._t)
  el._t = setTimeout(() => { el.style.opacity = '0' }, 2400)
}
