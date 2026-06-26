'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const LOW_FPS_THRESHOLD = 30
const LOW_FPS_SECONDS   = 3
const WARN_COOLDOWN_MS  = 24 * 60 * 60 * 1000

export default function LagDetector() {
  const [showBanner, setShowBanner] = useState(false)
  const rafRef = useRef<number>(0)
  const lowFpsSecondsRef = useRef(0)
  const activeRef = useRef(true)

  useEffect(() => {
    const lastWarn = parseInt(localStorage.getItem('rm_warned') ?? '0', 10)
    if (Date.now() - lastWarn < WARN_COOLDOWN_MS) return
    if (localStorage.getItem('rm') === '1') return

    let lastSec = performance.now()
    let frameCount = 0

    function tick(now: number) {
      if (!activeRef.current) return
      frameCount++
      const elapsed = now - lastSec
      if (elapsed >= 1000) {
        const fps = (frameCount / elapsed) * 1000
        if (fps < LOW_FPS_THRESHOLD) {
          lowFpsSecondsRef.current++
          if (lowFpsSecondsRef.current >= LOW_FPS_SECONDS) {
            localStorage.setItem('rm_warned', String(Date.now()))
            setShowBanner(true)
            return
          }
        } else {
          lowFpsSecondsRef.current = 0
        }
        frameCount = 0
        lastSec = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      activeRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (!showBanner) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 18px', maxWidth: 300,
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>
          ⚡ Experiencing lag?
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Looks like animations are slowing things down. You can turn them off in Settings → Appearance.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href="/settings" style={{ flex: 1, textDecoration: 'none' }} onClick={() => setShowBanner(false)}>
          <button style={{ width: '100%', height: 34, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
            Go to Settings
          </button>
        </Link>
        <button
          onClick={() => setShowBanner(false)}
          style={{ height: 34, padding: '0 12px', background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
