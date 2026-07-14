'use client'

import React from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon, LightningBoltIcon, LockIcon, RobotIcon, GraduationCapIcon,
  CheckIcon,
} from '@/components/icons'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import Particles from './Particles'
import BorderGlow from './BorderGlow'

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
const ICON_GRADES = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const ICON_AI = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
)
const ICON_PLANNER = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const ICON_SIM = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
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
const ICON_FIRE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8.5 14.5A2.5 2.5 0 0011 17h2a2.5 2.5 0 002.5-2.5c0-1.5-.5-2-1-3-1 .5-1.5 1.5-2 3-.5-2-1-4-3-5.5 0 2-2 3-2 5z"/>
  </svg>
)

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

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

          {/* Label */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.04 }}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 28 }}
          >
            The Academic Platform Built for Students
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1], delay: 0.09 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(50px, 8vw, 96px)',
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: '-2.5px',
              color: 'var(--text)',
              marginBottom: 30,
            }}
          >
            Your grades.{' '}
            <br />
            <span style={{ color: 'var(--primary)' }}>
              Your roadmap.
            </span>
            <br />
            Your edge.
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: 0.17 }}
            style={{ fontSize: 18.5, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.75, fontWeight: 400, letterSpacing: '-0.1px' }}
          >
            myFuturely syncs directly with your school portal, pairs it with an AI advisor
            that actually knows your transcript, and gives you the tools to plan — not just track.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.24 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
          >
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 11, padding: '15px 38px',
              fontWeight: 600, fontSize: 15, textDecoration: 'none',
              boxShadow: '0 4px 24px rgba(45,106,79,0.28)',
              letterSpacing: '-0.1px',
            }}>
              Start for free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a href="#features" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', borderRadius: 11, padding: '15px 38px',
              fontWeight: 500, fontSize: 15, textDecoration: 'none', letterSpacing: '-0.1px',
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
              { icon: <LightningBoltIcon size={16}/>, label: 'Live grade sync', sub: 'HAC & PowerSchool' },
              { icon: <LockIcon size={16}/>, label: 'Credentials encrypted', sub: 'AES-256, always' },
              { icon: <RobotIcon size={16}/>, label: 'AI knows your data', sub: 'Not a generic chatbot' },
              { icon: <GraduationCapIcon size={16}/>, label: 'Free for students', sub: 'No trial. No paywall.' },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 16px',
              }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>{b.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.2 }}>{b.sub}</div>
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

      {/* ── Bento Features ──────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: '120px 28px 100px' }}>
        <Reveal>
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
            Everything you need
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(34px, 5vw, 58px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 16 }}>
            One app. Your entire academic life.
          </h2>
          <p style={{ textAlign: 'center', fontSize: 16, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 72px', lineHeight: 1.7 }}>
            Not a note-taking app. Not a homework tracker. A full academic command center
            built around the data that actually matters — your grades.
          </p>
        </Reveal>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <Reveal delay={0.04}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#2D6A4F" icon={ICON_GRADES} label="Real-Time Grade Sync"
                desc="Connect HAC or PowerSchool once. Every grade, GPA trend, attendance record, and classwork score pulls automatically — the moment your teacher posts it, not three days later when you remember to check."
                large />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.1}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#2B4A8E" icon={ICON_AI} label="AI That Knows You"
                desc="Our AI has read your transcript. Ask 'can I still get an A?' and get a real answer — not generic study tips." />
            </BorderGlow>
          </Reveal>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Reveal delay={0.06}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#8A6E2D" icon={ICON_PLANNER} label="Smart Planner"
                desc="Deadlines and assignments surfaced by priority. No manual entry — ever. Just open it and know what matters today." />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.12}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#6A5A8A" icon={ICON_SIM} label="GPA Simulator"
                desc="Drop a grade in and watch your GPA recalculate live. Know exactly what you need on that final before you sit down to take it." />
            </BorderGlow>
          </Reveal>
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 24 }}>
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

            {/* Right: guarantee cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                {
                  icon: ICON_LOCK,
                  color: '#60A5FA',
                  title: 'Credentials are encrypted, not exposed',
                  body: 'Your HAC or PowerSchool login is encrypted with AES-256 and stored solely to keep your grades in sync in the background. It is never readable by our team and never sent to third parties.',
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
                  title: 'Your grades aren\'t shared with anyone',
                  body: 'We do not share, sell, or license your academic data to colleges, prep companies, or anyone else. Your transcript is private.',
                },
                {
                  icon: ICON_TRASH,
                  color: '#F87171',
                  title: 'Delete everything, anytime',
                  body: 'Request account deletion and we remove every byte associated with your account from our servers. No holdbacks. No waiting period.',
                },
              ].map((g, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <div style={{
                    display: 'flex', gap: 16, alignItems: 'flex-start',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 16, padding: '20px 22px',
                  }}>
                    <div style={{
                      flexShrink: 0,
                      width: 38, height: 38, borderRadius: 10,
                      background: `rgba(${hexToRgbStr(g.color)},0.09)`,
                      border: `1px solid rgba(${hexToRgbStr(g.color)},0.18)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: g.color,
                    }}>
                      {g.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 5, lineHeight: 1.3 }}>{g.title}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{g.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
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
            <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4.5vw, 54px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
              Everything, built{' '}
              <span style={{ color: '#F59E0B' }}>around your future.</span>
            </h2>
            <p style={{ textAlign: 'center', fontSize: 15.5, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 64px', lineHeight: 1.75 }}>
              myFuturely isn&apos;t a grade portal or a homework tracker. It&apos;s the one place where
              your grades, your AI advisor, and your plan for what&apos;s next all live together.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              {
                color: '#2D6A4F', icon: ICON_GRADES,
                title: 'Real-time grade sync',
                body: 'Connect your school portal once. Every grade, GPA trend, and attendance record updates automatically — the moment your teacher posts it.',
              },
              {
                color: '#2B4A8E', icon: ICON_AI,
                title: 'AI that knows your transcript',
                body: 'Ask "can I still get an A?" and get a real answer, because our AI has actually read your grades — not generic study tips.',
              },
              {
                color: '#6A5A8A', icon: ICON_SIM,
                title: 'GPA simulator',
                body: 'Drop a hypothetical grade in and watch your GPA recalculate live. Know exactly what you need before you sit down to take that final.',
              },
              {
                color: '#F59E0B', icon: <GraduationCapIcon size={22}/>,
                title: 'Your account, your data',
                body: 'myFuturely belongs to you, not your school. It follows your academic journey and stays with you after you graduate.',
              },
              {
                color: '#22C55E', icon: ICON_SHIELD,
                title: 'Privacy-first, always',
                body: 'We will never sell your data. No ad trackers, no data brokers, no exceptions.',
              },
              {
                color: '#38bdf8', icon: <LightningBoltIcon size={22}/>,
                title: 'Free for students',
                body: 'No credit card, no trial period, no paywall. The core of myFuturely is free — forever.',
              },
            ].map((card, i) => (
              <Reveal key={card.title} delay={i * 0.06}>
                <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
                  <div style={{ background: 'var(--surface)', borderRadius: 19, padding: '28px 24px', height: '100%' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `rgba(${hexToRgbStr(card.color)},0.09)`,
                      border: `1px solid rgba(${hexToRgbStr(card.color)},0.18)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: card.color, marginBottom: 18,
                    }}>
                      {card.icon}
                    </div>
                    <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>{card.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>{card.body}</p>
                  </div>
                </BorderGlow>
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
            <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
              Up and running<br />in under a minute.
            </h2>
            <p style={{ textAlign: 'center', fontSize: 15.5, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 72px', lineHeight: 1.75 }}>
              No setup. No configuration. Just your school login and a few seconds.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              {
                n: '01',
                title: 'Create your account',
                desc: 'Sign up free with your email. No credit card, no trial period, no paywall. The core of myFuturely is free — forever.',
                color: 'var(--primary)',
              },
              {
                n: '02',
                title: 'Connect your school portal',
                desc: 'Enter your HAC or PowerSchool credentials. They\'re encrypted with AES-256 and used solely to pull your grades — nothing else.',
                color: '#60A5FA',
              },
              {
                n: '03',
                title: 'See your full picture',
                desc: 'Every grade, GPA trend, due date, and AI insight — all in one place, automatically updated. You\'ll never log into a school portal again.',
                color: '#A78BFA',
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
                  <div style={{
                    padding: '36px 28px', borderRadius: 19,
                    height: '100%', position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: '25%', right: '25%', height: 1,
                      background: `linear-gradient(90deg, transparent, ${s.color}55, transparent)`,
                    }} />
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: 20 }}>{s.n}</div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 14, lineHeight: 1.25 }}>{s.title}</h3>
                    <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{s.desc}</p>
                  </div>
                </BorderGlow>
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
          background: 'radial-gradient(ellipse, rgba(45,106,79,0.07) 0%, transparent 65%)',
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
              background: 'linear-gradient(90deg, transparent, rgba(45,106,79,0.55), transparent)',
            }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 20 }}>
              Start Today
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.06, marginBottom: 20 }}>
              You don&apos;t need to wait<br />for senior year.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.8, letterSpacing: '-0.05px', maxWidth: 480, margin: '0 auto 16px' }}>
              The students who succeed in college started taking their academics seriously
              before they had to. myFuturely is where that starts.
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 44, lineHeight: 1.6 }}>
              Free to use. No credit card. No trial period. Just your grades and a plan.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 12, padding: '17px 52px',
              fontWeight: 600, fontSize: 16, textDecoration: 'none', letterSpacing: '-0.1px',
              boxShadow: '0 4px 28px rgba(45,106,79,0.30)',
            }}>
              Get started — it&apos;s free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>

            {/* Social proof chips */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 32 }}>
              {[
                'No setup required',
                'Works with HAC & PowerSchool',
                'AI advisor included',
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Bento card ────────────────────────────────────────────────────────────────
function BentoCard({ accent, icon, label, desc, large = false }: {
  accent: string; icon: React.ReactNode; label: string; desc: string; large?: boolean
}) {
  const rgb = hexToRgbStr(accent)
  return (
    <div style={{
      background: 'var(--surface)',
      borderRadius: 19,
      padding: large ? '36px 32px' : '28px 26px',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(26,21,14,0.05)',
      transition: 'transform 0.25s, box-shadow 0.25s',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = `0 12px 40px rgba(${rgb},0.10), 0 3px 10px rgba(${rgb},0.07)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0px)'
        el.style.boxShadow = '0 1px 4px rgba(26,21,14,0.05)'
      }}
    >
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        background: `radial-gradient(circle, rgba(${rgb},0.07) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: '25%', right: '25%', height: 1,
        background: `linear-gradient(90deg, transparent, rgba(${rgb},0.35), transparent)`,
      }} />
      <div style={{
        width: 46, height: 46, borderRadius: 12,
        background: `rgba(${rgb},0.08)`,
        border: `1px solid rgba(${rgb},0.16)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, marginBottom: 20, position: 'relative',
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: large ? 21 : 17, fontWeight: 600, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.3px', lineHeight: 1.25 }}>{label}</h3>
      <p style={{ fontSize: large ? 14.5 : 13.5, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{desc}</p>
    </div>
  )
}
