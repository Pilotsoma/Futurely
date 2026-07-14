'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, isWebAuthed } from '@/lib/api'
import { clearWebAuth } from '@/lib/authState'

const IDLE_MS       = 5 * 60 * 1000   // 5 minutes idle before the animation appears
const LOGOUT_AFTER_MS = 3 * 60 * 1000 // clicking the animation logs out once it's been up this long

const SLIDES = [
  {
    title: 'Grade Viewer',
    body: 'All your grades from HAC, Skyward, and PowerSchool — synced in one place.',
    color: '#2979FF',
  },
  {
    title: 'GPA Simulator',
    body: 'Try out "what-if" scenarios and see your GPA and college readiness update instantly.',
    color: '#00E5FF',
  },
  {
    title: 'Smart Planner',
    body: 'Canvas and Google Classroom assignments, organized into a plan by AI.',
    color: '#7C3AED',
  },
  {
    title: 'High School Roadmap',
    body: 'Course suggestions and graduation tracking, mapped out from 9th to 12th grade.',
    color: '#A855F7',
  },
] as const

const SLIDE_MS = 4500

export default function InactivityWatcher() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [readyToLogout, setReadyToLogout] = useState(false)

  const idleTimer   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const slideTimer  = useRef<ReturnType<typeof setInterval> | null>(null)
  const readyTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const showingRef  = useRef(false)
  const shownAtRef  = useRef(0)
  const lastReset   = useRef(0)

  const doLogout = useCallback(() => {
    api.logout().catch(() => null)
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.replace('/login')
  }, [router])

  const showOverlay = useCallback(() => {
    showingRef.current = true
    shownAtRef.current = Date.now()
    setShow(true)
    setSlideIndex(0)
    setReadyToLogout(false)
    if (slideTimer.current) clearInterval(slideTimer.current)
    if (readyTimer.current) clearTimeout(readyTimer.current)
    slideTimer.current = setInterval(() => {
      setSlideIndex(i => (i + 1) % SLIDES.length)
    }, SLIDE_MS)
    readyTimer.current = setTimeout(() => setReadyToLogout(true), LOGOUT_AFTER_MS)
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(showOverlay, IDLE_MS)
  }, [showOverlay])

  // Throttled activity handler — only resets while the animation isn't showing
  const onActivity = useCallback(() => {
    if (showingRef.current) return
    const now = Date.now()
    if (now - lastReset.current < 10_000) return // throttle to once per 10s
    lastReset.current = now
    resetIdleTimer()
  }, [resetIdleTimer])

  const dismiss = useCallback(() => {
    if (slideTimer.current) clearInterval(slideTimer.current)
    if (readyTimer.current) clearTimeout(readyTimer.current)
    showingRef.current = false
    setShow(false)
    resetIdleTimer()
  }, [resetIdleTimer])

  const onTap = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current
    if (elapsed >= LOGOUT_AFTER_MS) {
      if (slideTimer.current) clearInterval(slideTimer.current)
      if (readyTimer.current) clearTimeout(readyTimer.current)
      doLogout()
    } else {
      dismiss()
    }
  }, [doLogout, dismiss])

  useEffect(() => {
    if (!isWebAuthed()) return
    resetIdleTimer()
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    window.addEventListener('ns:test-idle-overlay', showOverlay)
    return () => {
      if (idleTimer.current)  clearTimeout(idleTimer.current)
      if (slideTimer.current) clearInterval(slideTimer.current)
      if (readyTimer.current) clearTimeout(readyTimer.current)
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      window.removeEventListener('ns:test-idle-overlay', showOverlay)
    }
  }, [resetIdleTimer, onActivity, showOverlay])

  if (!show) return null

  const slide = SLIDES[slideIndex]

  return (
    <div className="ns-idle-overlay" onClick={onTap} role="button" tabIndex={0}>
      <div className="ns-idle-glow" style={{ background: slide.color }} />

      <div className="ns-idle-content">
        <div className="ns-idle-badge">myFuturely</div>

        <div key={slideIndex} className="ns-idle-slide">
          <h2 className="ns-idle-title" style={{ color: slide.color }}>{slide.title}</h2>
          <p className="ns-idle-body">{slide.body}</p>
        </div>

        <div className="ns-idle-dots">
          {SLIDES.map((s, i) => (
            <span key={s.title} className="ns-idle-dot" style={{ background: i === slideIndex ? s.color : 'var(--border)' }} />
          ))}
        </div>

        <p className="ns-idle-hint" style={{ opacity: readyToLogout ? 1 : 0.55 }}>
          {readyToLogout ? "Tap anywhere to log out" : 'Tap anywhere to jump back in'}
        </p>
      </div>

      <style jsx>{`
        .ns-idle-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          cursor: pointer;
          overflow: hidden;
          animation: idleFadeIn 0.6s ease both;
        }
        .ns-idle-glow {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.18;
          transition: background 1s ease;
          animation: idleDrift 18s ease-in-out infinite;
        }
        .ns-idle-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          max-width: 440px;
          padding: 32px;
          text-align: center;
        }
        .ns-idle-badge {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .ns-idle-slide {
          animation: idleSlideIn 0.5s ease both;
          min-height: 96px;
        }
        .ns-idle-title {
          font-size: 28px;
          font-weight: 800;
          margin: 0 0 10px;
          transition: color 0.4s ease;
        }
        .ns-idle-body {
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0;
        }
        .ns-idle-dots {
          display: flex;
          gap: 8px;
        }
        .ns-idle-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          transition: background 0.4s ease;
        }
        .ns-idle-hint {
          font-size: 13px;
          color: var(--text-muted);
          margin: 12px 0 0;
          transition: opacity 0.4s ease;
        }
        @keyframes idleFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes idleSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes idleDrift {
          0%, 100% { transform: translate(-10%, -6%) scale(1); }
          50%      { transform: translate(10%, 6%) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-idle-overlay, .ns-idle-glow, .ns-idle-slide { animation: none; }
        }
      `}</style>
    </div>
  )
}
