'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { LightningBoltIcon } from '@/components/icons'

// Trigger if more than half of frames in a 1-second window take > 33ms (< 30fps effective)
// and that condition holds for 2 consecutive windows.
const SLOW_FRAME_MS    = 33   // frame gap that counts as "slow"
const SLOW_RATIO       = 0.5  // fraction of frames that must be slow
const SLOW_WINDOWS     = 2    // consecutive slow windows needed
const FRAMES_PER_WINDOW = 30  // sample this many frames per window

export default function LagDetector() {
  const [showBanner, setShowBanner] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    // Once per browser session (sessionStorage resets on tab close)
    if (sessionStorage.getItem('rm_warned') === '1') return
    if (localStorage.getItem('rm') === '1') return

    let lastFrame = 0
    let slowFrames = 0
    let totalFrames = 0
    let slowWindows = 0
    let stopped = false

    function tick(now: number) {
      if (stopped) return

      if (lastFrame > 0) {
        totalFrames++
        if (now - lastFrame > SLOW_FRAME_MS) slowFrames++

        if (totalFrames >= FRAMES_PER_WINDOW) {
          if (slowFrames / totalFrames >= SLOW_RATIO) {
            slowWindows++
            if (slowWindows >= SLOW_WINDOWS) {
              sessionStorage.setItem('rm_warned', '1')
              setShowBanner(true)
              return
            }
          } else {
            slowWindows = 0
          }
          slowFrames = 0
          totalFrames = 0
        }
      }

      lastFrame = now
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      stopped = true
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
          <LightningBoltIcon size={13}/> Experiencing lag?
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
