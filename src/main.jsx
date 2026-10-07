import React, { useState, lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './Login.jsx'
import ChatWidget from './pages/ChatWidget.jsx'
import './index.css'

// Publieke 3D veranda configurator (los geladen, zodat three.js niet in de CRM-bundel komt).
const VerandaConfigurator = lazy(() => import('./configurator/VerandaConfigurator.jsx'))
const CONFIGURATOR_PADEN = ['/configurator', '/veranda-configurator']

function Root() {
  const isChatWidget = window.location.pathname === '/chat-widget'
  if (isChatWidget) return <ChatWidget />
  if (CONFIGURATOR_PADEN.includes(window.location.pathname.replace(/\/$/, ''))) {
    return <Suspense fallback={null}><VerandaConfigurator /></Suspense>
  }

  const [ingelogd, setIngelogd] = useState(
    localStorage.getItem('crm_auth') === 'ja'
  )
  return ingelogd ? <App /> : <Login onLogin={() => setIngelogd(true)} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)