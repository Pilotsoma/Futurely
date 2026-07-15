'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { api, isWebAuthed } from '@/lib/api'
import { clearWebAuth } from '@/lib/authState'
import Particles from '../../app/Particles'

const IDLE_MS         = 5 * 60 * 1000   // 5 minutes idle before the animation appears
const LOGOUT_AFTER_MS = 3 * 60 * 1000   // clicking the animation logs out once it's been up this long
const SLIDE_MS        = 12500

const SLIDES = [
  { id: 'grades',  label: 'Grade Viewer',       color: '#2979FF', glow2: '#7C3AED' },
  { id: 'gpa',     label: 'GPA Simulator',      color: '#00E5FF', glow2: '#2979FF' },
  { id: 'planner', label: 'Smart Planner',       color: '#7C3AED', glow2: '#A855F7' },
  { id: 'roadmap', label: 'High School Roadmap', color: '#A855F7', glow2: '#00E5FF' },
] as const

// ─── Slide mockup: Grade Viewer ───────────────────────────────────────────────

function GradeViewerMockup({ reduced }: { reduced: boolean }) {
  const subjects = [
    { name: 'AP Calculus BC', grade: 'A', pct: 96, color: '#10B981', trend: '↑', delta: '+2' },
    { name: 'AP English Lit', grade: 'B', pct: 84, color: '#2979FF', trend: '→', delta: ''   },
    { name: 'Chemistry',      grade: 'A', pct: 92, color: '#10B981', trend: '↑', delta: '+1' },
    { name: 'World History',  grade: 'C', pct: 74, color: '#F59E0B', trend: '↓', delta: '−3' },
    { name: 'Spanish III',    grade: 'B', pct: 88, color: '#2979FF', trend: '→', delta: ''   },
  ]
  const trendColor = (trend: string) =>
    trend === '↑' ? '#10B981' : trend === '↓' ? '#EF4444' : '#52698A'

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#52698A' }}>
          Grade Viewer
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, fontWeight: 800, color: '#2979FF', lineHeight: 1, letterSpacing: '-2px' }}>3.87</span>
          <span style={{ fontSize: 16, color: '#52698A', fontWeight: 600 }}>GPA</span>
        </div>
      </div>

      {/* Subject rows */}
      {subjects.map((s, i) => (
        <motion.div
          key={s.name}
          initial={reduced ? false : { opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduced ? 0 : 0.08 + i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '20px 0',
            borderBottom: i < subjects.length - 1 ? '1px solid #1C2D47' : 'none',
          }}
        >
          <div style={{ width: 11, height: 11, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 23, color: '#96AACC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.name}
          </span>
          <span style={{ fontSize: 18, color: trendColor(s.trend), fontWeight: 700, minWidth: 46, textAlign: 'right' }}>
            {s.trend}{s.delta}
          </span>
          <span style={{ fontSize: 19, color: '#52698A' }}>{s.pct}%</span>
          <span style={{
            background: s.color + '22', color: s.color,
            borderRadius: 12, padding: '9px 20px',
            fontWeight: 800, fontSize: 24,
            border: `1px solid ${s.color}44`,
            minWidth: 50, textAlign: 'center',
          }}>
            {s.grade}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Slide mockup: GPA Simulator ─────────────────────────────────────────────

function GPASimulatorMockup({ reduced }: { reduced: boolean }) {
  const currentGpa   = 3.67
  const projectedGpa = 3.89
  const targetGpa    = 4.0
  const progressPct  = Math.min((projectedGpa / targetGpa) * 100, 100)

  return (
    <div>
      <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#52698A' }}>
        GPA Simulator
      </span>

      {/* Hero GPA number */}
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.82 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ textAlign: 'center', margin: '34px 0 36px' }}
      >
        <div style={{ fontSize: 128, fontWeight: 800, lineHeight: 1, color: '#00E5FF', letterSpacing: '-5px' }}>
          {projectedGpa.toFixed(2)}
        </div>
        <div style={{ fontSize: 17, color: '#52698A', marginTop: 12, fontWeight: 600 }}>Projected GPA</div>
      </motion.div>

      {/* Current vs Projected cards */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
        style={{ display: 'flex', gap: 16, marginBottom: 32, alignItems: 'center' }}
      >
        <div style={{
          flex: 1, background: '#1C2D47', border: '1px solid #273D5E',
          borderRadius: 16, padding: '22px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, color: '#52698A', marginBottom: 8, fontWeight: 600 }}>Current</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#E8EEFF' }}>{currentGpa.toFixed(2)}</div>
        </div>

        <div style={{ color: '#00E5FF', fontSize: 32, fontWeight: 300, flexShrink: 0 }}>→</div>

        <div style={{
          flex: 1, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.28)',
          borderRadius: 16, padding: '22px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, color: '#00BCD4', marginBottom: 8, fontWeight: 600 }}>Projected</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#00E5FF' }}>{projectedGpa.toFixed(2)}</div>
        </div>
      </motion.div>

      {/* Progress bar toward target */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.4 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#52698A', marginBottom: 12, fontWeight: 600 }}>
          <span>Toward {targetGpa.toFixed(1)} target</span>
          <span style={{ color: '#00E5FF' }}>{progressPct.toFixed(0)}%</span>
        </div>
        <div style={{ background: '#1C2D47', borderRadius: 8, height: 15, overflow: 'hidden' }}>
          <motion.div
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ delay: 0.5, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', borderRadius: 8, background: 'linear-gradient(90deg, #00BCD4, #00E5FF)' }}
          />
        </div>
      </motion.div>
    </div>
  )
}

// ─── Slide mockup: Smart Planner ─────────────────────────────────────────────

function SmartPlannerMockup({ reduced }: { reduced: boolean }) {
  const assignments = [
    {
      subject: 'AP Calculus', subjectColor: '#10B981',
      title: 'Problem Set 7 — Integrals',
      due: 'Today  ·  11:59 PM', status: 'today',
      priority: 'High', priorityColor: '#EF4444', priorityBg: 'rgba(239,68,68,0.12)',
    },
    {
      subject: 'AP English', subjectColor: '#2979FF',
      title: 'Essay Draft — Beloved',
      due: 'Tomorrow  ·  8:00 AM', status: 'soon',
      priority: 'Medium', priorityColor: '#F59E0B', priorityBg: 'rgba(245,158,11,0.12)',
    },
    {
      subject: 'Chemistry', subjectColor: '#F59E0B',
      title: 'Lab Report: Titration',
      due: 'Jul 18  ·  11:59 PM', status: 'later',
      priority: 'Low', priorityColor: '#52698A', priorityBg: 'rgba(82,105,138,0.12)',
    },
  ]
  const dueColor = (s: string) => s === 'today' ? '#EF4444' : s === 'soon' ? '#F59E0B' : '#52698A'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#52698A' }}>
          Smart Planner
        </span>
        <span style={{
          fontSize: 15, background: 'rgba(124,58,237,0.15)', color: '#A78BFA',
          border: '1px solid rgba(124,58,237,0.35)', borderRadius: 20, padding: '7px 18px', fontWeight: 700,
        }}>
          ✦ AI Sorted
        </span>
      </div>

      {/* Assignment cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {assignments.map((a, i) => (
          <motion.div
            key={a.title}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.1 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: '#1C2D47',
              border: '1px solid #273D5E',
              borderLeft: `5px solid ${a.subjectColor}`,
              borderRadius: 14,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: a.subjectColor, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  {a.subject}
                </div>
                <div style={{ fontSize: 22, color: '#E8EEFF', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 16, color: dueColor(a.status), marginTop: 7, fontWeight: 600 }}>
                  {a.due}
                </div>
              </div>
              <span style={{
                flexShrink: 0, fontSize: 14, fontWeight: 700,
                background: a.priorityBg, color: a.priorityColor,
                border: `1px solid ${a.priorityColor}44`,
                borderRadius: 20, padding: '7px 16px', whiteSpace: 'nowrap',
              }}>
                {a.priority}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide mockup: High School Roadmap ───────────────────────────────────────

function RoadmapMockup({ reduced }: { reduced: boolean }) {
  const CIRCUMFERENCE = 2 * Math.PI * 36
  const PROGRESS = 0.68
  const dashOffset = CIRCUMFERENCE * (1 - PROGRESS)

  const years = [
    { label: '9th',  courses: ['Algebra II', 'English I', 'Biology'],  done: true,  current: false },
    { label: '10th', courses: ['Pre-Calc',   'English II', 'Chem'],    done: true,  current: false },
    { label: '11th', courses: ['AP Calc',    'AP Eng',    'Physics'],  done: false, current: true  },
    { label: '12th', courses: ['AP Stats',   'Eng IV',    'AP Gov'],   done: false, current: false },
  ]

  return (
    <div>
      <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '1.4px', textTransform: 'uppercase', color: '#52698A' }}>
        High School Roadmap
      </span>

      {/* Graduation progress ring */}
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.78 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 36px' }}
      >
        <div style={{ position: 'relative', width: 170, height: 170 }}>
          <svg width={170} height={170} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx={85} cy={85} r={68} fill="none" stroke="#1C2D47" strokeWidth={13} />
            <motion.circle
              cx={85} cy={85} r={68} fill="none"
              stroke="#A855F7" strokeWidth={13} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={reduced ? false : { strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ delay: 0.35, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 42, fontWeight: 800, color: '#A855F7', lineHeight: 1 }}>68%</span>
            <span style={{ fontSize: 14, color: '#52698A', fontWeight: 600, marginTop: 6 }}>Complete</span>
          </div>
        </div>
      </motion.div>

      {/* Grade-year timeline */}
      <div style={{ display: 'flex', gap: 12 }}>
        {years.map((y, i) => (
          <motion.div
            key={y.label}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 0.22 + i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flex: 1,
              background: y.current ? 'rgba(168,85,247,0.10)' : '#1C2D47',
              border: `1px solid ${y.current ? 'rgba(168,85,247,0.45)' : '#273D5E'}`,
              borderRadius: 14,
              padding: '18px 11px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 18, fontWeight: 800, marginBottom: 12,
              color: y.done ? '#A855F7' : y.current ? '#C084FC' : '#52698A',
            }}>
              {y.done ? '✓' : y.current ? '→' : '·'}&nbsp;{y.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {y.courses.map(c => (
                <div
                  key={c}
                  style={{
                    fontSize: 13.5, fontWeight: 600,
                    background: y.done ? 'rgba(168,85,247,0.18)' : '#162235',
                    color: y.done ? '#C084FC' : '#52698A',
                    borderRadius: 6, padding: '5px 8px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InactivityWatcher() {
  const router = useRouter()
  const [show, setShow] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [readyToLogout, setReadyToLogout] = useState(false)
  const [lowSpec, setLowSpec] = useState(false)
  const prefersReducedMotion = useReducedMotion() ?? false
  const reduced = prefersReducedMotion || lowSpec

  // Heuristic low-spec detection: few CPU cores or little RAM struggles with
  // the blurred, continuously-animating glow orbs, so skip them on weaker machines.
  useEffect(() => {
    const cores  = navigator.hardwareConcurrency ?? 8
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 8
    if (cores <= 4 || memory <= 4) setLowSpec(true)
  }, [])

  const idleTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const slideTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const readyTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const showingRef = useRef(false)
  const shownAtRef = useRef(0)
  const lastReset  = useRef(0)

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
    if (readyTimer.current) clearInterval(readyTimer.current)
    slideTimer.current = setInterval(() => {
      setSlideIndex(i => (i + 1) % SLIDES.length)
    }, SLIDE_MS)
    // Polls real elapsed time rather than trusting a single delayed callback —
    // background-tab timer throttling can't drift this out of sync with the
    // Date.now() check onTap actually uses to decide whether to log out.
    readyTimer.current = setInterval(() => {
      if (Date.now() - shownAtRef.current >= LOGOUT_AFTER_MS) setReadyToLogout(true)
    }, 1000)
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
    if (readyTimer.current) clearInterval(readyTimer.current)
    showingRef.current = false
    setShow(false)
    resetIdleTimer()
  }, [resetIdleTimer])

  const onTap = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current
    if (elapsed >= LOGOUT_AFTER_MS) {
      if (slideTimer.current) clearInterval(slideTimer.current)
      if (readyTimer.current) clearInterval(readyTimer.current)
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
      if (readyTimer.current) clearInterval(readyTimer.current)
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      window.removeEventListener('ns:test-idle-overlay', showOverlay)
    }
  }, [resetIdleTimer, onActivity, showOverlay])

  if (!show) return null

  const slide = SLIDES[slideIndex]

  return (
    <div
      className="ns-idle-overlay"
      onClick={onTap}
      role="button"
      tabIndex={0}
      aria-label={readyToLogout ? 'Tap to log out' : 'Tap to dismiss and return to app'}
    >
      {/* Deep space gradient + animated starfield — same cosmic backdrop as the
          landing page, so the idle screen feels like part of the same world. */}
      <div className="ns-space-gradient" />
      <div className="ns-starfield">
        {reduced ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 180 }, (_, i) => {
              const seed = i * 2654435761
              const x = ((seed >>> 0) % 10000) / 100
              const y = ((seed * 1234567) >>> 0) % 10000 / 100
              const r = 0.4 + ((seed * 987654) >>> 0) % 10 / 14
              const op = 0.25 + ((seed * 123456) >>> 0) % 10 / 17
              return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" fillOpacity={op} />
            })}
          </svg>
        ) : (
          <Particles particleColors={['#ffffff']} particleCount={350} particleSpread={10} speed={0.1} particleBaseSize={100} alphaParticles={false} />
        )}
      </div>

      {/* Layered ambient glow orbs — ken-burns drift. Skipped entirely (not just
          un-animated) on low-spec machines: the blur filters are expensive to
          paint even when static. */}
      {!reduced && (
        <>
          <div className="ns-glow-a" style={{ background: slide.color }} />
          <div className="ns-glow-b" style={{ background: slide.glow2 }} />
          <div className="ns-glow-c" style={{ background: slide.color }} />
        </>
      )}

      {/* Widget card — AnimatePresence handles crossfade + depth transition */}
      <div className="ns-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04, y: -14 }}
            transition={{ duration: reduced ? 0.15 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="ns-widget-card"
            style={{
              width: '100%',
              background: '#162235',
              border: '1px solid #273D5E',
              borderRadius: 30,
              padding: '52px 56px',
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4), 0 20px 56px rgba(0,0,0,0.35)',
            }}
          >
            {/* Slow, continuous zoom while the slide is on screen — reads as premium, not the crossfade's snap */}
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: reduced ? 1 : 1.12 }}
              transition={{ duration: SLIDE_MS / 1000, ease: 'easeOut' }}
            >
              {slideIndex === 0 && <GradeViewerMockup   reduced={reduced} />}
              {slideIndex === 1 && <GPASimulatorMockup   reduced={reduced} />}
              {slideIndex === 2 && <SmartPlannerMockup   reduced={reduced} />}
              {slideIndex === 3 && <RoadmapMockup         reduced={reduced} />}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hint */}
      <p className="ns-hint" style={{ opacity: readyToLogout ? 1 : 0.5 }}>
        {readyToLogout ? 'Tap anywhere to log out' : 'Tap anywhere to jump back in'}
      </p>

      <style jsx>{`
        .ns-idle-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
          background: #04040e;
          cursor: pointer;
          overflow: hidden;
          animation: nsFadeIn 0.6s ease both;
          user-select: none;
        }

        /* Same deep space gradient as the landing page */
        .ns-space-gradient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 18% 72%, rgba(50,15,90,0.12) 0%, transparent 48%),
            radial-gradient(ellipse at 82% 18%, rgba(10,30,80,0.10) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 40%, #0c0c22 0%, #04040e 100%);
        }

        .ns-starfield {
          position: absolute;
          inset: 0;
        }

        /* Three glow orbs at different positions for layered depth */
        .ns-glow-a {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.15;
          top: -22%;
          left: -12%;
          transition: background 1.2s ease;
          animation: nsKb1 24s ease-in-out infinite;
        }
        .ns-glow-b {
          position: absolute;
          width: 44vmax;
          height: 44vmax;
          border-radius: 50%;
          filter: blur(110px);
          opacity: 0.10;
          bottom: -14%;
          right: -10%;
          transition: background 1.4s ease;
          animation: nsKb2 28s ease-in-out infinite;
        }
        .ns-glow-c {
          position: absolute;
          width: 30vmax;
          height: 30vmax;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.08;
          top: 55%;
          left: 55%;
          transition: background 1s ease;
          animation: nsKb3 20s ease-in-out infinite;
        }

        .ns-stage {
          position: relative;
          width: min(760px, calc(100vw - 48px));
          /* Fixed height prevents layout shift during card transitions */
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ns-hint {
          position: relative;
          font-size: 14px;
          color: #52698A;
          margin: 0;
          transition: opacity 0.4s ease;
        }

        @keyframes nsFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes nsKb1 {
          0%, 100% { transform: translate(0%, 0%) scale(1);      }
          30%      { transform: translate(8%, 14%) scale(1.14);   }
          65%      { transform: translate(-4%, 7%) scale(0.94);   }
        }
        @keyframes nsKb2 {
          0%, 100% { transform: translate(0%, 0%) scale(1);      }
          40%      { transform: translate(-11%, -9%) scale(1.12); }
          72%      { transform: translate(7%, -13%) scale(0.91);  }
        }
        @keyframes nsKb3 {
          0%, 100% { transform: translate(0%, 0%) scale(1);      }
          50%      { transform: translate(-8%, 10%) scale(1.18);  }
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-idle-overlay { animation: none; }
          .ns-glow-a, .ns-glow-b, .ns-glow-c { animation: none; }
        }
      `}</style>
    </div>
  )
}
