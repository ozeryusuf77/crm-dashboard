export default function Sidebar({ page, navOpen, onNav, onToggleNav, escCount, emailCount, visitorCount, kbCount }) {
  const channels = [
    {
      key: 'wa', label: 'WhatsApp', color: '#dcfce7', textColor: '#166534', abbr: 'WA',
      items: [
        { id: 'wa-chats',    label: 'Chats',        badge: null },
        { id: 'wa-esc',      label: 'Escalaties',   badge: escCount || null, badgeCls: 'nb-red' },
        { id: 'wa-leads',    label: 'Leads' },
        { id: 'wa-reports',  label: 'Rapportages' },
        { id: 'wa-settings', label: 'Instellingen' },
      ],
    },
    {
      key: 'em', label: 'E-mail', color: '#dbeafe', textColor: '#1e40af', abbr: 'EM',
      items: [
        { id: 'em-inbox',    label: 'Inbox',        badge: emailCount || null, badgeCls: 'nb-blue' },
        { id: 'em-leads',    label: 'Leads' },
        { id: 'em-reports',  label: 'Rapportages' },
        { id: 'em-settings', label: 'Instellingen' },
      ],
    },
    {
      key: 'wb', label: 'Website', color: '#ede9fe', textColor: '#5b21b6', abbr: 'WB',
      items: [
        { id: 'wb-live',     label: 'Live chat',    badge: visitorCount || null, badgeCls: 'nb-amber' },
        { id: 'wb-bot',      label: 'Chatbot' },
        { id: 'wb-leads',    label: 'Leads' },
        { id: 'wb-reports',  label: 'Rapportages' },
        { id: 'wb-settings', label: 'Instellingen' },
      ],
    },
    {
      key: 'kb', label: 'Kennisbank', color: '#fef3c7', textColor: '#92400e', abbr: 'KB',
      items: [
        { id: 'kb-overview', label: 'Overzicht' },
        { id: 'kb-entries',  label: 'Alle items',   badge: kbCount || null, badgeCls: 'nb-amber' },
        { id: 'kb-add',      label: '+ Nieuw item' },
        { id: 'kb-supabase', label: 'Supabase bron' },
        { id: 'kb-gemini',   label: 'Gemini instellingen' },
        { id: 'kb-logs',     label: 'AI query logs' },
      ],
    },
  ]

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-name">MijnBedrijf CRM</div>
        <div className="brand-sub">AI-assistent actief</div>
      </div>

      <nav className="nav">
        <div className={`nav-item${page === 'overview' ? ' active' : ''}`} onClick={() => onNav('overview')}>
          <span style={{ fontSize: 14 }}>⊞</span> Overzicht
        </div>

        {channels.map(ch => {
          const open = navOpen[ch.key]
          return (
            <div key={ch.key}>
              <div className="nav-item" onClick={() => onToggleNav(ch.key)}>
                <span className="ch-icon" style={{ background: ch.color, color: ch.textColor }}>{ch.abbr}</span>
                {ch.label}
                <span className={`chevron${open ? ' open' : ''}`}>›</span>
              </div>
              <div className={`subnav${open ? ' open' : ''}`}>
                {ch.items.map(it => (
                  <div key={it.id} className={`sni${page === it.id ? ' active' : ''}`} onClick={() => onNav(it.id)}>
                    {it.label}
                    {it.badge ? <span className={`notif-badge ${it.badgeCls}`}>{it.badge}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="avatar av-purple" style={{ width: 28, height: 28, fontSize: 11 }}>JD</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Jouw naam</div>
          <div style={{ fontSize: 10, color: '#888' }}>Admin</div>
        </div>
      </div>
    </div>
  )
}
