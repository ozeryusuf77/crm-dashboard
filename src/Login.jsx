import { useState, useEffect } from 'react'

const WACHTWOORD = 'Yusuf@CRM2026!'
const MAX_POGINGEN = 5
const LOCKOUT_MINUTEN = 15

export default function Login({ onLogin }) {
  const [pw, setPw] = useState('')
  const [fout, setFout] = useState(false)
  const [pogingen, setPogingen] = useState(() => {
    return parseInt(localStorage.getItem('crm_pogingen') || '0')
  })
  const [geblokkeerd, setGeblokkeerd] = useState(() => {
    const tot = localStorage.getItem('crm_lockout')
    return tot && Date.now() < parseInt(tot)
  })
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (!geblokkeerd) return
    const interval = setInterval(() => {
      const tot = parseInt(localStorage.getItem('crm_lockout'))
      const over = tot - Date.now()
      if (over <= 0) {
        setGeblokkeerd(false)
        setPogingen(0)
        localStorage.removeItem('crm_lockout')
        localStorage.removeItem('crm_pogingen')
        clearInterval(interval)
      } else {
        const min = Math.floor(over / 60000)
        const sec = Math.floor((over % 60000) / 1000)
        setCountdown(`${min}:${sec.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [geblokkeerd])

  const probeer = () => {
    if (geblokkeerd) return
    if (pw === WACHTWOORD) {
      localStorage.removeItem('crm_pogingen')
      localStorage.removeItem('crm_lockout')
      localStorage.setItem('crm_auth', 'ja')
      onLogin()
    } else {
      const nieuw = pogingen + 1
      setPogingen(nieuw)
      localStorage.setItem('crm_pogingen', nieuw)
      setFout(true)
      setPw('')
      if (nieuw >= MAX_POGINGEN) {
        const tot = Date.now() + LOCKOUT_MINUTEN * 60 * 1000
        localStorage.setItem('crm_lockout', tot)
        setGeblokkeerd(true)
      }
    }
  }

  const over = MAX_POGINGEN - pogingen

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f5f5f5' }}>
      <div style={{ background:'#fff', padding:'2rem', borderRadius:12, border:'1px solid #e5e5e5', width:320 }}>
        <div style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>MijnBedrijf CRM</div>
        <div style={{ fontSize:13, color:'#888', marginBottom:24 }}>Log in om verder te gaan</div>

        {geblokkeerd ? (
          <div style={{ textAlign:'center', padding:'1rem', background:'#fee2e2', borderRadius:8 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#991b1b', marginBottom:6 }}>
              Account tijdelijk geblokkeerd
            </div>
            <div style={{ fontSize:12, color:'#dc2626', marginBottom:8 }}>
              Te veel verkeerde pogingen
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:'#991b1b' }}>{countdown}</div>
            <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>
              Probeer opnieuw over bovenstaande tijd
            </div>
          </div>
        ) : (
          <>
            <input
              type="password"
              placeholder="Wachtwoord"
              value={pw}
              onChange={e => { setPw(e.target.value); setFout(false) }}
              onKeyDown={e => e.key === 'Enter' && probeer()}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${fout ? '#dc2626' : '#e5e5e5'}`, fontSize:13, marginBottom:8, outline:'none', fontFamily:'inherit' }}
            />
            {fout && (
              <div style={{ fontSize:12, color:'#dc2626', marginBottom:8 }}>
                Wachtwoord onjuist — nog {over} poging{over !== 1 ? 'en' : ''} voor blokkering
              </div>
            )}
            <button
              onClick={probeer}
              style={{ width:'100%', padding:'9px', borderRadius:8, background:'#111', color:'#fff', border:'none', fontSize:13, cursor:'pointer', fontWeight:600 }}
            >
              Inloggen
            </button>
          </>
        )}
      </div>
    </div>
  )
}