import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Topbar  from './components/Topbar.jsx'
import {
  PageOverview,
  PageWaChats, PageWaEsc, PageWaLeads, PageWaReports, PageWaSettings,
  PageEmInbox, PageEmLeads, PageEmReports, PageEmSettings,
  PageWbLive, PageWbBot, PageWbLeads, PageWbReports, PageWbSettings,
  PageKbOverview, PageKbEntries, PageKbAdd, PageKbCrawl, PageKbSupabase, PageKbGemini, PageKbLogs,
} from './pages/index.jsx'
import ChatView    from './components/ChatView.jsx'
import EmailView   from './components/EmailView.jsx'
import WebChatView from './components/WebChatView.jsx'
import { getKnowledgeItems, saveKnowledgeItem } from './lib/supabase.js'
import {
  MOCK_LEADS, MOCK_EMAILS, MOCK_WEBSITE_VISITORS, MOCK_KB, MOCK_LOGS
} from './lib/mockData.js'

export default function App() {
  // ─── Global state ──────────────────────────────────────────────────────────
  const [page,    setPage]    = useState('overview')
  const [navOpen, setNavOpen] = useState({ wa: true, em: false, wb: false, kb: false })
  const [chat,    setChat]    = useState(null) // { type: 'wa'|'em'|'wb', id: string }

  // data state (in production these come from Supabase)
  const [leads,    setLeads]    = useState(MOCK_LEADS)
  const [emails,   setEmails]   = useState(MOCK_EMAILS)
  const [visitors, setVisitors] = useState(MOCK_WEBSITE_VISITORS)
  const [kb, setKb] = useState([])
  useEffect(() => {
  getKnowledgeItems().then(data => { if (data.length > 0) setKb(data) })
}, [])
  
useEffect(() => {
  getKnowledgeItems().then(data => { if (data.length > 0) setKb(data) })
}, [])
  const [logs]                  = useState(MOCK_LOGS)

  // filter / sort state for WA chats
  const [waFilter, setWaFilter] = useState('all')
  const [waSort,   setWaSort]   = useState('date-desc')
  const [kbFilter, setKbFilter] = useState('all')

  // ─── Navigation ────────────────────────────────────────────────────────────
  const navigate = useCallback((p) => { setPage(p); setChat(null) }, [])
  const toggleNav = useCallback((k) => {
    setNavOpen(prev => ({ ...prev, [k]: !prev[k] }))
  }, [])
  const openChat = useCallback((type, id) => setChat({ type, id }), [])
  const closeChat = useCallback(() => setChat(null), [])

  // ─── WhatsApp lead actions ──────────────────────────────────────────────────
  const toggleWaAI = useCallback((id) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l
      const wasAI = l.ai_mode
      const nowHuman = !wasAI
      const sysMsg = { id: Date.now(), direction: 'sys', text: nowHuman
        ? 'Je hebt het gesprek overgenomen — AI gepauzeerd'
        : l.status === 'esc'
          ? `Escalatie afgehandeld — status terug naar "${l.prev_status}". AI hervat.`
          : 'AI heeft het gesprek hervat', ts: '', ai: false }
      return {
        ...l,
        ai_mode: !l.ai_mode,
        status: nowHuman && l.status !== 'esc' ? 'esc' : nowHuman ? l.status : l.status === 'esc' ? l.prev_status : l.status,
        prev_status: nowHuman && l.status !== 'esc' ? l.status : l.prev_status,
        messages: [...l.messages, sysMsg],
        memory: { ...l.memory, Status: nowHuman ? 'Escalatie' : l.prev_status + ' lead' },
      }
    }))
  }, [])

  const sendWaMsg = useCallback((id, text) => {
    const ts = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    setLeads(prev => prev.map(l => l.id !== id ? l : {
      ...l, messages: [...l.messages, { id: Date.now(), direction: 'out', text, ts, ai: false }]
    }))
  }, [])

  const setPrevStatus = useCallback((id, status) => {
    setLeads(prev => prev.map(l => l.id !== id ? l : { ...l, prev_status: status }))
  }, [])

  // ─── Email actions ──────────────────────────────────────────────────────────
  const sendDraft = useCallback((id) => {
    setEmails(prev => prev.map(e => e.id !== id ? e : { ...e, draft_status: 'sent' }))
  }, [])

  const ignoreDraft = useCallback((id) => {
    setEmails(prev => prev.map(e => e.id !== id ? e : { ...e, draft_status: 'ignored' }))
  }, [])

  const updateDraft = useCallback((id, text) => {
    setEmails(prev => prev.map(e => e.id !== id ? e : { ...e, draft: text }))
  }, [])

  // ─── Website visitor actions ────────────────────────────────────────────────
  const toggleWbAI = useCallback((id) => {
    setVisitors(prev => prev.map(v => {
      if (v.id !== id) return v
      const sysMsg = { id: Date.now(), direction: 'sys',
        text: v.ai_mode ? 'Je hebt de chat overgenomen — AI gepauzeerd' : 'AI heeft de chat hervat',
        ts: '', ai: false }
      return { ...v, ai_mode: !v.ai_mode, messages: [...v.messages, sysMsg] }
    }))
  }, [])

  const sendWbMsg = useCallback((id, text) => {
    const ts = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    setVisitors(prev => prev.map(v => v.id !== id ? v : {
      ...v, messages: [...v.messages, { id: Date.now(), direction: 'out', text, ts, ai: false }]
    }))
  }, [])

  // ─── KB actions ─────────────────────────────────────────────────────────────
  const saveKbItem = useCallback(async (item) => {
  await saveKnowledgeItem(item)
  const data = await getKnowledgeItems()
  if (data.length > 0) setKb(data)
}, [])

  // ─── Shared props ───────────────────────────────────────────────────────────
  const sharedProps = {
    leads, emails, visitors, kb, logs,
    waFilter, setWaFilter, waSort, setWaSort, kbFilter, setKbFilter,
    navigate, openChat,
    toggleWaAI, sendWaMsg, setPrevStatus,
    sendDraft, ignoreDraft, updateDraft,
    toggleWbAI, sendWbMsg,
    saveKbItem, deleteKbItem,
  }

  // ─── Render active chat view ────────────────────────────────────────────────
  const renderChat = () => {
    if (!chat) return null
    if (chat.type === 'wa') {
      const lead = leads.find(l => l.id === chat.id)
      return lead ? <ChatView lead={lead} onClose={closeChat} onToggleAI={toggleWaAI} onSend={sendWaMsg} onSetPrevStatus={setPrevStatus} /> : null
    }
    if (chat.type === 'em') {
      const email = emails.find(e => e.id === chat.id)
      return email ? <EmailView email={email} onClose={closeChat} onSend={sendDraft} onIgnore={ignoreDraft} onUpdate={updateDraft} /> : null
    }
    if (chat.type === 'wb') {
      const visitor = visitors.find(v => v.id === chat.id)
      return visitor ? <WebChatView visitor={visitor} onClose={closeChat} onToggleAI={toggleWbAI} onSend={sendWbMsg} /> : null
    }
    return null
  }

  // ─── Render main page ───────────────────────────────────────────────────────
  const renderPage = () => {
    if (chat) return renderChat()
    const pages = {
      overview:     <PageOverview   {...sharedProps} />,
      'wa-chats':   <PageWaChats    {...sharedProps} />,
      'wa-esc':     <PageWaEsc      {...sharedProps} />,
      'wa-leads':   <PageWaLeads    {...sharedProps} />,
      'wa-reports': <PageWaReports  {...sharedProps} />,
      'wa-settings':<PageWaSettings {...sharedProps} />,
      'em-inbox':   <PageEmInbox    {...sharedProps} />,
      'em-leads':   <PageEmLeads    {...sharedProps} />,
      'em-reports': <PageEmReports  {...sharedProps} />,
      'em-settings':<PageEmSettings {...sharedProps} />,
      'wb-live':    <PageWbLive     {...sharedProps} />,
      'wb-bot':     <PageWbBot      {...sharedProps} />,
      'wb-leads':   <PageWbLeads    {...sharedProps} />,
      'wb-reports': <PageWbReports  {...sharedProps} />,
      'wb-settings':<PageWbSettings {...sharedProps} />,
      'kb-overview':<PageKbOverview {...sharedProps} />,
      'kb-entries': <PageKbEntries  {...sharedProps} />,
      'kb-add':     <PageKbAdd      {...sharedProps} />,
      'kb-crawl':   <PageKbCrawl   {...sharedProps} />,
      'kb-supabase':<PageKbSupabase {...sharedProps} />,
      'kb-gemini':  <PageKbGemini   {...sharedProps} />,
      'kb-logs':    <PageKbLogs     {...sharedProps} />,
    }
    return pages[page] || <div className="empty-state">Sectie in opbouw.</div>
  }

  const escCount = leads.filter(l => l.status === 'esc').length

  return (
    <div className="shell">
      <Sidebar page={page} navOpen={navOpen} onNav={navigate} onToggleNav={toggleNav} escCount={escCount} emailCount={emails.filter(e => !e.filtered).length} visitorCount={visitors.length} kbCount={kb.length} />
      <div className="main">
        <Topbar page={page} chat={chat} onBack={closeChat} sharedProps={sharedProps} />
        <div className="content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
