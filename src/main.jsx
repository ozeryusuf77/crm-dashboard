import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './Login.jsx'
import ChatWidget from './pages/ChatWidget.jsx'
import './index.css'

function Root() {
  const isChatWidget = window.location.pathname === '/chat-widget'
  if (isChatWidget) return <ChatWidget />

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