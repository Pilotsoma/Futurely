'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { XMarkIcon } from '@/components/icons'

const POLL_INTERVAL = 7_000  // 7s
const LOADED_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev'

export default function UpdateBanner() {
  const [show, setShow] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Don't poll in local dev where SHA is always 'dev'
    if (LOADED_SHA === 'dev') return

    async function check() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { sha } = await res.json() as { sha: string }
        if (sha !== LOADED_SHA) setShow(true)
      } catch { /* ignore network errors */ }
    }

    timer.current = setInterval(check, POLL_INTERVAL)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--surface)', border: '1px solid var(--primary-glow)',
      borderRadius: 12, padding: '12px 18px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--primary)' }}>⟳</span>
      New update available
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--primary)', color: '#000', border: 'none',
          borderRadius: 8, padding: '6px 14px', fontSize: 12,
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setShow(false)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
      >
        <XMarkIcon size={14}/>
      </button>
    </div>
  )
}
