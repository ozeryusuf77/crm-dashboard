const PAGE_TITLES = {
  overview: 'Overzicht',
  'wa-chats': 'WhatsApp — chats', 'wa-esc': 'WhatsApp — escalaties', 'wa-leads': 'WhatsApp — leads',
  'wa-reports': 'WhatsApp — rapportages', 'wa-settings': 'WhatsApp — instellingen',
  'em-inbox': 'E-mail — inbox', 'em-leads': 'E-mail — leads', 'em-reports': 'E-mail — rapportages', 'em-settings': 'E-mail — instellingen',
  'wb-live': 'Website — live chat', 'wb-bot': 'Website — chatbot', 'wb-leads': 'Website — leads',
  'wb-reports': 'Website — rapportages', 'wb-settings': 'Website — instellingen',
  'kb-overview': 'Kennisbank — overzicht', 'kb-entries': 'Kennisbank — alle items', 'kb-add': 'Kennisbank — nieuw item',
  'kb-supabase': 'Kennisbank — Supabase', 'kb-gemini': 'Kennisbank — Gemini', 'kb-logs': 'Kennisbank — AI logs',
}

export default function Topbar({ page, chat, onBack }) {
  const title = chat
    ? chat.type === 'wb' ? 'Website — live chat gesprek'
    : chat.type === 'em' ? 'E-mail bekijken'
    : 'WhatsApp gesprek'
    : PAGE_TITLES[page] || page

  return (
    <div className="topbar">
      {chat && <button className="btn btn-sm" onClick={onBack}>← Terug</button>}
      <span className="page-title">{title}</span>
    </div>
  )
}
