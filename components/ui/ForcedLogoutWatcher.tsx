'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isWebAuthed, clearWebAuthed } from '../../lib/api'
import { onCrossTabLogout } from '../../lib/authState'

export default function ForcedLogoutWatcher() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const fired = useRef(false)

  function trigger() {
    if (fired.current) return
    fired.current = true
    setShow(true)
    setTimeout(() => {
      clearWebAuthed()
      localStorage.removeItem('ns_user')
      router.replace('/login')
    }, 2000)
  }

  // WebSocket — catches cross-device logout (FORCE_LOGOUT server event). Auth
  // happens server-side via the httpOnly cookie sent automatically on the
  // handshake, so there's no token for this client to hold or transmit.
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, 'ws')
    let ws: WebSocket, dead = false
    function connect() {
      if (dead) return
      ws = new WebSocket(wsBase)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { event: string }
          if (msg.event === 'FORCE_LOGOUT' && isWebAuthed()) {
            trigger()
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => { if (!dead) setTimeout(connect, 3000) }
    }
    connect()
    return () => { dead = true; ws?.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // BroadcastChannel — catches same-browser cross-tab logout
  useEffect(() => {
    return onCrossTabLogout(trigger)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!show) return null

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <p style={S.title}>You&apos;ve been logged out</p>
        <p style={S.sub}>Your account was signed out from another session. Redirecting you to login…</p>
        <div style={S.dots}>
          <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px 32px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  iconWrap: { width: 64, height: 64, borderRadius: 18, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:    { fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:      { fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 },
  dots:     { display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 },
}
