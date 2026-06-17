'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const IDLE_MS = 30 * 60 * 1000  // 30 minutes before warning
const WARN_S  = 5 * 60          // 5 minutes to respond

export default function InactivityWatcher() {
  const router = useRouter()
  const [show, setShow]         = useState(false)
  const [countdown, setCountdown] = useState(WARN_S)
  const idleTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const showingRef = useRef(false)
  const lastReset  = useRef(0)

  const doLogout = useCallback(() => {
    api.logout().catch(() => null)
    localStorage.removeItem('ns_token')
    localStorage.removeItem('ns_user')
    router.replace('/login')
  }, [router])

  const startCountdown = useCallback(() => {
    showingRef.current = true
    setShow(true)
    setCountdown(WARN_S)
    let remaining = WARN_S
    countTimer.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(countTimer.current!)
        doLogout()
      }
    }, 1000)
  }, [doLogout])

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(startCountdown, IDLE_MS)
  }, [startCountdown])

  // Throttled activity handler — only resets if popup isn't showing
  const onActivity = useCallback(() => {
    if (showingRef.current) return
    const now = Date.now()
    if (now - lastReset.current < 10_000) return  // throttle to once per 10s
    lastReset.current = now
    resetIdleTimer()
  }, [resetIdleTimer])

  function stayHere() {
    if (countTimer.current) clearInterval(countTimer.current)
    showingRef.current = false
    setShow(false)
    setCountdown(WARN_S)
    resetIdleTimer()
  }

  function logOut() {
    if (countTimer.current) clearInterval(countTimer.current)
    doLogout()
  }

  useEffect(() => {
    if (!localStorage.getItem('ns_token')) return
    resetIdleTimer()
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    return () => {
      if (idleTimer.current)  clearTimeout(idleTimer.current)
      if (countTimer.current) clearInterval(countTimer.current)
      events.forEach(ev => window.removeEventListener(ev, onActivity))
    }
  }, [resetIdleTimer, onActivity])

  if (!show) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const display = `${mins}:${secs.toString().padStart(2, '0')}`
  const urgent = countdown <= 60

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ ...S.iconWrap, borderColor: urgent ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.3)', background: urgent ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={urgent ? '#EF4444' : '#EAB308'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <p style={S.title}>Are you still there?</p>
        <p style={S.sub}>You&apos;ve been inactive for 30 minutes. We&apos;ll log you out automatically if you don&apos;t respond.</p>

        <div style={{ ...S.timerBox, borderColor: urgent ? 'rgba(239,68,68,0.35)' : 'var(--border)', background: urgent ? 'rgba(239,68,68,0.06)' : 'var(--surface-2)' }}>
          <span style={{ ...S.timerNum, color: urgent ? '#EF4444' : 'var(--text)' }}>{display}</span>
          <span style={{ ...S.timerLabel, color: urgent ? '#EF4444' : 'var(--text-muted)' }}>remaining</span>
        </div>

        <div style={S.btnRow}>
          <button
            className="ns-btn-ghost"
            style={{ flex: 1, height: 44, fontSize: 14 }}
            onClick={logOut}
          >
            Log me out
          </button>
          <button
            className="ns-btn-primary"
            style={{ flex: 1, height: 44, fontSize: 14 }}
            onClick={stayHere}
          >
            Yes, I&apos;m here
          </button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '36px 32px', maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
  iconWrap:  { width: 64, height: 64, borderRadius: 18, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2, transition: 'all 0.4s ease' },
  title:     { fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 },
  sub:       { fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 },
  timerBox:  { borderRadius: 14, border: '1px solid', padding: '18px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.4s ease', width: '100%' },
  timerNum:  { fontSize: 42, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, transition: 'color 0.4s ease', fontVariantNumeric: 'tabular-nums' },
  timerLabel:{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', transition: 'color 0.4s ease' },
  btnRow:    { display: 'flex', gap: 10, width: '100%', marginTop: 2 },
}
