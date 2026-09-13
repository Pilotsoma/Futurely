'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon, LightningBoltIcon, LockIcon, RobotIcon, GraduationCapIcon,
  CheckIcon,
} from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Particles from './Particles'

function Reveal({
  children, delay = 0, y = 32, style,
}: {
  children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const ICON_LOCK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)
const ICON_SHIELD = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const ICON_EYE_OFF = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const ICON_TRASH = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
)

// ── Rotating headline words ───────────────────────────────────────────────────
const ROTATE_WORDS: { text: string; color: string }[] = [
  { text: 'your future.',   color: '#22d3ee' },
  { text: 'your progress.', color: 'var(--primary)' },
  { text: 'your plan.',     color: 'var(--purple)' },
]

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const heroY       = useTransform(scrollYProgress, [0, 0.4], [0, -90])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0])
  const [navScrolled, setNavScrolled] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lowEndCpu = (navigator.hardwareConcurrency ?? 8) <= 4
    if (prefersReduced || lowEndCpu) setReduceMotion(true)
  }, [])

  const [wordIdx, setWordIdx] = useState(0)
  useEffect(() => {
    if (reduceMotion) return
    const id = setInterval(() => setWordIdx(i => (i + 1) % ROTATE_WORDS.length), 3700)
    return () => clearInterval(id)
  }, [reduceMotion])

  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>
      {/* Fixed cosmic background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse at 18% 72%, rgba(50,15,90,0.12) 0%, transparent 48%),
          radial-gradient(ellipse at 82% 18%, rgba(10,30,80,0.10) 0%, transparent 45%),
          radial-gradient(ellipse at 50% 40%, #0c0c22 0%, #04040e 100%)
        `.replace(/\s+/g,' ')
      }} />
      {/* Fixed particles layer */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        {reduceMotion ? (
          // Static star field — no JS animation, Chromebook-safe
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
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
          <Particles
            particleColors={['#ffffff']}
            particleCount={350}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={100}
            moveParticlesOnHover
            alphaParticles={false}
            disableRotation={false}
            pixelRatio={1}
          />
        )}
      </div>
      {/* All page content sits above particles */}
      <div style={{ position: 'relative', zIndex: 2 }}>

      {/* ── Scroll progress ──────────────────────────────────────────────── */}
      <motion.div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 200,
        background: 'var(--primary)',
        scaleX: scrollYProgress, transformOrigin: '0%',
        opacity: 0.8,
      }} />

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: `1px solid ${navScrolled ? 'var(--border)' : 'transparent'}`,
        background: navScrolled ? 'rgba(15,13,10,0.85)' : 'transparent',
        backdropFilter: navScrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: navScrolled ? 'blur(20px)' : 'none',
        transition: 'background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <span style={{
              fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px',
              backgroundImage: 'linear-gradient(90deg, #22d3ee 0%, var(--primary) 45%, var(--purple) 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}>myFuturely</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="#privacy" style={{ fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>Privacy</a>
            <a href="#compare" style={{ fontSize: 13.5, color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>Why us</a>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)',
              color: 'var(--primary)', borderRadius: 8, padding: '8px 18px',
              fontWeight: 600, fontSize: 13.5, textDecoration: 'none', letterSpacing: '-0.1px',
            }}>
              Open app <span style={{ opacity: 0.6 }}><ArrowRightIcon size={13}/></span>
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingTop: 60, overflow: 'hidden' }}>

        {/* Subtle warm washes */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
            width: 900, height: 700,
            background: 'radial-gradient(ellipse, rgba(45,106,79,0.06) 0%, transparent 65%)',
          }} />
          <div style={{
            position: 'absolute', top: '35%', right: '-10%',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(43,74,142,0.04) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '15%', left: '-8%',
            width: 440, height: 440,
            background: 'radial-gradient(circle, rgba(154,124,48,0.04) 0%, transparent 70%)',
          }} />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 1040, margin: '0 auto', width: '100%' }}>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1], delay: 0.09 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(72px, 11.5vw, 148px)',
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: '-3px',
              color: 'var(--text)',
              marginBottom: 36,
            }}
          >
            This is
            <br />
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIdx}
                initial={reduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 24, filter: 'blur(8px)', skewX: 3 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', skewX: 0 }}
                exit={reduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: -24, filter: 'blur(8px)', skewX: -3 }}
                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                style={{ display: 'inline-block', color: ROTATE_WORDS[wordIdx].color }}
              >
                {ROTATE_WORDS[wordIdx].text}
              </motion.span>
            </AnimatePresence>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: 0.17 }}
            style={{ fontSize: 21, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto 52px', lineHeight: 1.7, fontWeight: 400, letterSpacing: '-0.1px' }}
          >
            myFuturely pairs a personal AI advisor with a planner built around your
            academic life — giving you the tools to actually plan ahead, not just get by.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.24 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
          >
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 13, padding: '18px 44px',
              fontWeight: 600, fontSize: 17, textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(41,121,255,0.28)',
              letterSpacing: '-0.1px',
            }}>
              Start for free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a href="#features" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', borderRadius: 13, padding: '18px 44px',
              fontWeight: 500, fontSize: 17, textDecoration: 'none', letterSpacing: '-0.1px',
            }}>
              See what it does
            </a>
          </motion.div>

          {/* Trust badges — no fake stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.34 }}
            style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            {[
              { icon: <LightningBoltIcon size={19}/>, label: 'Organized automatically', sub: 'Zero manual entry' },
              { icon: <LockIcon size={19}/>, label: 'Encrypted end-to-end', sub: 'AES-256, always' },
              { icon: <RobotIcon size={19}/>, label: 'AI knows your data', sub: 'Not a generic chatbot' },
              { icon: <GraduationCapIcon size={19}/>, label: 'Built for students', sub: 'Not schools or counselors' },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 14, padding: '13px 20px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{b.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{b.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.2 }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase' as const }}>scroll</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: '120px 28px 100px' }}>
        <Reveal>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
            Everything you need
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(34px, 5vw, 58px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 16, maxWidth: 640 }}>
            One app. Your entire academic life.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 0 64px', lineHeight: 1.7 }}>
            Not a note-taking app. Not a homework tracker. A full academic command center
            built around what actually matters for your future.
          </p>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 56, alignItems: 'start' }}>

          {/* Left: editorial feature list — no boxes, typography carries the weight */}
          <div>
            {[
              {
                n: '01',
                label: 'Your Academic Advisor',
                accent: 'var(--purple)',
                desc: 'Ask anything — "What should I focus on this week?" or "What do I need to improve before the final?" Real answers from an advisor that actually knows your academic history, not a generic chatbot.',
              },
              {
                n: '02',
                label: 'Smart Planner',
                accent: 'var(--primary)',
                desc: 'Deadlines and assignments surfaced by priority. No manual entry — ever. Just open it and know what matters today.',
              },
              {
                n: '03',
                label: 'What-If Simulator',
                accent: '#A78BFA',
                desc: 'Drop a hypothetical score in and see how your overall standing shifts instantly. Know exactly what you need before you sit down for that final.',
              },
              {
                n: '04',
                label: 'Your Roadmap',
                accent: '#F59E0B',
                desc: 'A 4-year plan built around your goals — course suggestions, milestones by grade, and college prep guidance, all in one place.',
              },
            ].map((feat, i) => (
              <Reveal key={feat.n} delay={i * 0.06}>
                <div
                  onMouseEnter={() => setHoveredFeature(i)}
                  onMouseLeave={() => setHoveredFeature(prev => prev === i ? null : prev)}
                  style={{
                    padding: '28px 24px',
                    marginLeft: -24,
                    marginRight: -24,
                    borderTop: '1px solid var(--border)',
                    borderRadius: 12,
                    cursor: 'default',
                    background: hoveredFeature === i ? 'rgba(255,255,255,0.03)' : 'transparent',
                    transition: 'background 0.25s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      letterSpacing: '2.5px',
                      flexShrink: 0,
                    }}>
                      {feat.n}
                    </span>
                    <h3 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(19px, 2vw, 25px)',
                      fontWeight: 500,
                      letterSpacing: '-0.5px',
                      lineHeight: 1.15,
                      color: feat.accent,
                      margin: 0,
                    }}>
                      {feat.label}
                    </h3>
                  </div>
                  <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0, paddingLeft: 40 }}>
                    {feat.desc}
                  </p>
                </div>
              </Reveal>
            ))}
            <div style={{ borderTop: '1px solid var(--border)' }} />
          </div>

          {/* Right: sticky preview frame — one feature detailed at a time, on hover */}
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{
              position: 'relative',
              minHeight: 640,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 24,
              padding: '44px 44px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
                width: 620, height: 500, pointerEvents: 'none',
                opacity: hoveredFeature !== null ? 1 : 0.4,
                transition: 'opacity 0.4s ease',
                background: 'radial-gradient(ellipse, rgba(41,121,255,0.16) 0%, rgba(124,58,237,0.09) 40%, transparent 72%)',
              }} />

              <AnimatePresence mode="wait">
                {hoveredFeature === null && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ position: 'relative', textAlign: 'center' }}
                  >
                    <span style={{
                      display: 'inline-flex', width: 52, height: 52, borderRadius: 14, marginBottom: 20,
                      background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)',
                      alignItems: 'center', justifyContent: 'center', padding: 10,
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.6 }} />
                    </span>
                    <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                      Hover a feature to see it in action
                    </p>
                  </motion.div>
                )}

                {/* Advisor — full mini conversation + suggestion chips */}
                {hoveredFeature === 0 && (
                  <motion.div
                    key="advisor"
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                    style={{ position: 'relative', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>myFuturely AI</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Knows your academic history</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{
                          fontSize: 14, fontWeight: 500, color: '#fff',
                          background: 'var(--primary)', borderRadius: '12px 12px 2px 12px',
                          padding: '11px 17px', maxWidth: '78%', lineHeight: 1.45,
                        }}>
                          What should I focus on this week?
                        </span>
                      </div>
                      <div style={{ display: 'flex' }}>
                        <span style={{
                          fontSize: 14, color: 'var(--text-secondary)',
                          background: 'var(--surface-2)', borderRadius: '12px 12px 12px 2px',
                          padding: '12px 17px', lineHeight: 1.6, maxWidth: '85%',
                        }}>
                          Your chemistry report is due Monday — start it tonight so you have time to revise. Your SAT practice is also overdue by two days.
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span style={{
                          fontSize: 14, fontWeight: 500, color: '#fff',
                          background: 'var(--primary)', borderRadius: '12px 12px 2px 12px',
                          padding: '11px 17px', maxWidth: '78%', lineHeight: 1.45,
                        }}>
                          Am I ready for the chemistry unit test?
                        </span>
                      </div>
                      <div style={{ display: 'flex' }}>
                        <span style={{
                          fontSize: 14, color: 'var(--text-secondary)',
                          background: 'var(--surface-2)', borderRadius: '12px 12px 12px 2px',
                          padding: '12px 17px', lineHeight: 1.6, maxWidth: '85%',
                        }}>
                          You&apos;ve completed 4 of 5 assignments in this unit. Review chapters 4–5 tonight and you&apos;ll be in good shape.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['Study tips for finals', 'College prep advice', 'Help me plan my week'].map((chip, i) => (
                        <span key={i} style={{
                          fontSize: 12.5, color: 'var(--text-secondary)',
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          borderRadius: 20, padding: '7px 14px',
                        }}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Planner — full week, priority tags, stats */}
                {hoveredFeature === 1 && (
                  <motion.div
                    key="planner"
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                    style={{ position: 'relative', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>This week</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 7, padding: '3px 10px' }}>6 due</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 7, padding: '3px 10px' }}>2 high priority</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {[
                        { day: 'Mon', date: '15', task: 'Chemistry lab report', subject: 'Chemistry', color: '#2979FF', priority: 'High' },
                        { day: 'Tue', date: '16', task: 'Robotics club meeting prep', subject: 'Robotics Club', color: '#F59E0B', priority: null },
                        { day: 'Wed', date: '17', task: 'Read Ch. 5–6', subject: 'English', color: '#22d3ee', priority: null },
                        { day: 'Thu', date: '18', task: 'Practice SAT math section', subject: 'Test Prep', color: '#7C3AED', priority: 'High' },
                        { day: 'Fri', date: '19', task: 'History reading response', subject: 'History', color: '#A78BFA', priority: null },
                      ].map((t, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '13px 0',
                          borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.day}</div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t.date}</div>
                          </div>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14.5, color: 'var(--text)', lineHeight: 1.3 }}>{t.task}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.subject}</div>
                          </div>
                          {t.priority && (
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#F87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
                              {t.priority}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
                      Sorted by priority — automatically, no manual entry
                    </div>
                  </motion.div>
                )}

                {/* Simulator — multi-scenario bar comparison */}
                {hoveredFeature === 2 && (
                  <motion.div
                    key="simulator"
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                    style={{ position: 'relative', width: '100%' }}
                  >
                    <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>What-if Simulator</span>
                    <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 28px', lineHeight: 1.5 }}>
                      Adding extra study sessions each week
                    </p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, height: 160, marginBottom: 16 }}>
                      {[
                        { label: 'Now', pct: null, h: 32, color: 'var(--surface-2)' },
                        { label: '+1 / wk', pct: '+7%', h: 52, color: 'rgba(167,139,250,0.5)' },
                        { label: '+2 / wk', pct: '+18%', h: 78, color: 'rgba(167,139,250,0.75)' },
                        { label: '+3 / wk', pct: '+26%', h: 100, color: 'linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)' },
                      ].map((b, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                          {b.pct && <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{b.pct}</span>}
                          <span style={{
                            width: '100%', height: `${b.h}%`, borderRadius: 8,
                            background: b.color,
                          }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{b.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Three extra sessions a week could shift your standing by as much as 26% over a semester — see the exact impact before you commit to it.
                    </div>
                  </motion.div>
                )}

                {/* Roadmap — full 4-year timeline */}
                {hoveredFeature === 3 && (
                  <motion.div
                    key="roadmap"
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: [0.19, 1, 0.22, 1] }}
                    style={{ position: 'relative', width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                      <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>Your Roadmap</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '3px 10px' }}>Class of 2028</span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <div style={{ position: 'absolute', left: 15, top: 15, bottom: 15, width: 1, background: 'var(--border)' }} />
                      {[
                        { grade: '9', title: 'Explore interests', text: 'Try different clubs and subjects. Build strong foundations before specializing.', color: '#2979FF' },
                        { grade: '10', title: 'Challenge yourself', text: 'Take on AP or Honors courses in subjects you enjoy most.', color: '#22d3ee' },
                        { grade: '11', title: 'Build your college list', text: 'Start researching schools and narrowing down what matters to you.', color: '#A78BFA' },
                        { grade: '12', title: 'Apply with confidence', text: 'Applications, essays, and decisions — all tracked in one place.', color: '#F59E0B' },
                      ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '11px 0', position: 'relative' }}>
                          <span style={{
                            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                            background: `rgba(${s.color === '#2979FF' ? '41,121,255' : s.color === '#22d3ee' ? '34,211,238' : s.color === '#A78BFA' ? '167,139,250' : '245,158,11'},0.16)`,
                            border: `1px solid ${s.color}`, color: s.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12.5, fontWeight: 700,
                            position: 'relative', zIndex: 1,
                          }}>{s.grade}</span>
                          <div>
                            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{s.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy & Security ──────────────────────────────────────────── */}
      <section id="privacy" style={{ borderTop: '1px solid var(--border)', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

            {/* Left: statement */}
            <Reveal>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#22C55E', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 20 }}>
                Privacy First
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 24 }}>
                Your data.<br />Not ours.
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 32 }}>
                We built myFuturely privacy-first from the beginning — not as a checkbox. Your academic
                data is one of the most sensitive things about you. We treat it that way.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.18)',
                borderRadius: 12, padding: '14px 20px',
              }}>
                <div style={{ color: '#22C55E' }}>{ICON_SHIELD}</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>We will never sell your data.</span>{' '}
                  Not to colleges, data brokers, or advertisers. Ever.
                </p>
              </div>
            </Reveal>

            {/* Right: guarantee list — borderless divided rows */}
            <div>
              {[
                {
                  icon: ICON_LOCK,
                  color: '#60A5FA',
                  title: 'Everything stays encrypted',
                  body: 'Everything behind the scenes is encrypted with AES-256. It is never readable by our team and never sent to third parties.',
                },
                {
                  icon: ICON_EYE_OFF,
                  color: '#A78BFA',
                  title: 'No ad tracking. No data mining.',
                  body: "myFuturely doesn't embed Facebook Pixel, Google Analytics, or any third-party tracker that profiles your behavior. We collect only what's needed to run the app.",
                },
                {
                  icon: ICON_SHIELD,
                  color: '#34D399',
                  title: "Your data isn't shared with anyone",
                  body: 'We do not share, sell, or license your academic data to colleges, prep companies, or anyone else. It stays private, always.',
                },
                {
                  icon: ICON_TRASH,
                  color: '#F87171',
                  title: 'Delete everything, anytime',
                  body: 'Request account deletion and we remove every byte associated with your account from our servers. No holdbacks. No waiting period.',
                },
              ].map((g, i) => (
                <Reveal key={i} delay={i * 0.07}>
                  <div style={{
                    display: 'flex',
                    gap: 18,
                    alignItems: 'flex-start',
                    padding: '24px 0',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <div style={{ flexShrink: 0, color: g.color, marginTop: 2 }}>
                      {g.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>{g.title}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>{g.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
              <div style={{ borderTop: '1px solid var(--border)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Why myFuturely ───────────────────────────────────────────────── */}
      <section id="compare" style={{ borderTop: '1px solid var(--border)', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#F59E0B', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
              Why myFuturely
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4.5vw, 54px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 72 }}>
              Built for you,{' '}
              <span style={{ color: '#F59E0B' }}>not the system.</span>
            </h2>
          </Reveal>

          {/* Proof bar — three statements, typographic weight, no card chrome */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          }}>
            {[
              {
                headline: 'Actually organized.',
                sub: 'Assignments and deadlines sorted by priority, automatically — no manual entry, ever.',
                color: '#F59E0B',
              },
              {
                headline: 'Your data stays yours.',
                sub: 'Your academic data is never sold, licensed, or shared. Not with colleges, not with advertisers.',
                color: '#22C55E',
              },
              {
                headline: 'Zero trackers.',
                sub: 'No Pixel, no Analytics, no ad network. What happens in your account stays in your account.',
                color: '#38bdf8',
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{
                  padding: '48px 40px',
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                }}>
                  <p style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(20px, 2vw, 28px)',
                    fontWeight: 500,
                    letterSpacing: '-0.6px',
                    lineHeight: 1.18,
                    color: item.color,
                    marginBottom: 14,
                  }}>
                    {item.headline}
                  </p>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
                    {item.sub}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent-blue)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
              Get started
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
              Up and running<br />in under a minute.
            </h2>
            <p style={{ textAlign: 'center', fontSize: 15.5, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 80px', lineHeight: 1.75 }}>
              No setup. No configuration. Just a few seconds and you&apos;re in.
            </p>
          </Reveal>

          {/* Open steps — big display numbers, no box chrome */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--border)' }}>
            {[
              {
                n: '01',
                title: 'Create your account',
                desc: 'Sign up with your email in under a minute — no forms, no approval, nothing to install.',
                color: 'var(--primary)',
              },
              {
                n: '02',
                title: 'Your profile builds itself',
                desc: 'Assignments, deadlines, and progress populate automatically — no manual entry, ever.',
                color: '#60A5FA',
              },
              {
                n: '03',
                title: 'See your full picture',
                desc: "Everything updates in real time, all in one place. You'll always know exactly where you stand.",
                color: '#A78BFA',
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div style={{
                  paddingTop: 48,
                  paddingBottom: 48,
                  paddingRight: i < 2 ? 48 : 0,
                  paddingLeft: i > 0 ? 48 : 0,
                  borderRight: i < 2 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(52px, 6vw, 80px)',
                    fontWeight: 500,
                    letterSpacing: '-3px',
                    lineHeight: 1,
                    color: s.color,
                    marginBottom: 28,
                    opacity: 0.4,
                  }}>
                    {s.n}
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 14, lineHeight: 1.25 }}>{s.title}</h3>
                  <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px 140px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 900, height: 500, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(41,121,255,0.07) 0%, transparent 65%)',
        }} />
        <Reveal>
          <div style={{
            maxWidth: 700, margin: '0 auto', textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 28, padding: '72px 48px', position: 'relative',
            boxShadow: '0 8px 48px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
              width: 200, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(41,121,255,0.45), transparent)',
            }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 20 }}>
              Start Today
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 500, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.06, marginBottom: 20 }}>
              You don&apos;t need to wait<br />for senior year.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 44, lineHeight: 1.8, letterSpacing: '-0.05px', maxWidth: 480, margin: '0 auto 44px' }}>
              The students who succeed in college started taking their academics seriously
              before they had to. myFuturely is where that starts.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 12, padding: '17px 52px',
              fontWeight: 600, fontSize: 16, textDecoration: 'none', letterSpacing: '-0.1px',
              boxShadow: '0 4px 28px rgba(41,121,255,0.30)',
            }}>
              Get started — it&apos;s free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>

            {/* Social proof chips */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
              {[
                'No setup required',
                'Real-time updates',
                'Academic advisor included',
                'Cancel anytime',
              ].map(t => (
                <span key={t} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CheckIcon size={11}/>{t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 28px', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="myFuturely" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>Built for students who mean business.</span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href="#privacy" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>Privacy</a>
            <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>Features</a>
            <Link href="/login" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>Sign in</Link>
            <span>© 2026 myFuturely</span>
          </div>
        </div>
      </footer>
      </div>{/* end content wrapper */}
    </div>
  )
}

