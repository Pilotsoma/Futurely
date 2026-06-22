'use client'

import Link from 'next/link'
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
const ICON_STREAK = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
)
const ICON_SOCIAL = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const heroY       = useTransform(scrollYProgress, [0, 0.4], [0, -90])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0])
  const [navScrolled, setNavScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
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
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo1.png" alt="Futurely" style={{ height: 150, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)',
              color: 'var(--primary)', borderRadius: 8, padding: '8px 18px',
              fontWeight: 600, fontSize: 13.5, textDecoration: 'none', letterSpacing: '-0.1px',
            }}>
              Open app <span style={{ opacity: 0.6 }}>→</span>
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

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 860, margin: '0 auto', width: '100%' }}>

          {/* Label */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.04 }}
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 28 }}
          >
            AI Academic Companion
          </motion.p>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1], delay: 0.09 }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(54px, 8.5vw, 100px)',
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: '-2px',
              color: 'var(--text)',
              marginBottom: 30,
            }}
          >
            Track grades.{' '}
            <br />
            <span style={{ color: 'var(--primary)' }}>
              Plan smarter.
            </span>
            <br />
            Get ahead.
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: 0.17 }}
            style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 48px', lineHeight: 1.75, fontWeight: 400, letterSpacing: '-0.1px' }}
          >
            Futurely syncs your school portal, AI advisor, and college prep
            into one platform. The academic app you always wished existed.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.24 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 72 }}
          >
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 11, padding: '15px 38px',
              fontWeight: 600, fontSize: 15, textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(45,106,79,0.22)',
              letterSpacing: '-0.1px',
              transition: 'box-shadow 0.2s, transform 0.15s',
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
              See features
            </a>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.34 }}
            style={{
              display: 'inline-flex', overflow: 'hidden',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              boxShadow: '0 1px 4px rgba(26,21,14,0.06)',
            }}
          >
            {[
              { v: '10K+',  l: 'Grade syncs' },
              { v: '98%',   l: 'Data accuracy' },
              { v: '3.8',   l: 'Avg student GPA' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '18px 32px', textAlign: 'center' as const,
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, fontWeight: 500, letterSpacing: '0.3px' }}>{s.l}</div>
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
      <section id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: '120px 28px' }}>
        <Reveal>
          <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--primary)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
            Everything you need
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(34px, 5vw, 58px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 72 }}>
            One app.<br />Your entire academic life.
          </h2>
        </Reveal>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <Reveal delay={0.04}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#2D6A4F" icon={ICON_GRADES} label="Grade Portal"
                desc="Connect HAC or PowerSchool. Every grade, GPA trend, classwork score, and transcript — pulled in automatically. No more logging into clunky school portals."
                large />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.1}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#2B4A8E" icon={ICON_AI} label="AI Advisor"
                desc="Ask anything about your grades, college chances, or what to prioritize. Get answers built around your actual data." />
            </BorderGlow>
          </Reveal>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Reveal delay={0.06}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#8A6E2D" icon={ICON_PLANNER} label="Smart Planner"
                desc="Assignments, deadlines, and priorities surfaced automatically. Never miss a due date again." />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.12}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#6A5A8A" icon={ICON_SIM} label="GPA Simulator"
                desc="See how a grade change affects your GPA in real time before you turn it in." />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.18}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#C45A1A" icon={ICON_STREAK} label="Daily Streaks"
                desc="Log in every day. Build your streak. Earn coins, exclusive tags, and unlock the Marketplace." />
            </BorderGlow>
          </Reveal>
        </div>

        {/* Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <Reveal delay={0.08}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#3A6B8A" icon={ICON_SOCIAL} label="Study Feed"
                desc="Posts, reactions, follows. A social layer built for students — not another distraction." />
            </BorderGlow>
          </Reveal>
          <Reveal delay={0.14}>
            <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
              <BentoCard accent="#2D6A4F" icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                </svg>
              } label="Marketplace"
                desc="Unlock at a 3-day streak. Buy, sell, and trade items with coins you earn by showing up. Earn enough coins and you can snag exclusive profile effects, name colors, and gear."
                large />
            </BorderGlow>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent-blue)', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 16 }}>
              Three steps
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 'clamp(30px, 4vw, 50px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 72 }}>
              Up and running<br />in under a minute.
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {[
              { n: '01', title: 'Create your account', desc: 'Sign up with your school email. Free forever — no credit card required.' },
              { n: '02', title: 'Connect your portal', desc: 'Enter your HAC or PowerSchool login. We encrypt your credentials with AES-256 — your school never knows.' },
              { n: '03', title: 'See your full picture', desc: 'Grades, GPA trends, upcoming deadlines, and AI insights — all in one place, automatically.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <BorderGlow edgeSensitivity={30} glowColor="40 80 80" backgroundColor="var(--surface)" borderRadius={20} glowRadius={40} glowIntensity={1} coneSpread={25} animated={false} colors={['#c084fc', '#f472b6', '#38bdf8']}>
                  <div style={{
                    padding: '36px 28px', borderRadius: 19,
                    boxShadow: '0 1px 4px rgba(26,21,14,0.06)',
                    height: '100%',
                  }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: 20 }}>{s.n}</div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 12, lineHeight: 1.25 }}>{s.title}</h3>
                    <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{s.desc}</p>
                  </div>
                </BorderGlow>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px 120px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 800, height: 400, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(45,106,79,0.05) 0%, transparent 65%)',
        }} />
        <Reveal>
          <div style={{
            maxWidth: 680, margin: '0 auto', textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 28, padding: '64px 40px', position: 'relative',
            boxShadow: '0 8px 40px rgba(26,21,14,0.08), 0 2px 8px rgba(26,21,14,0.05)',
          }}>
            <div style={{
              position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
              width: 160, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(45,106,79,0.45), transparent)',
            }} />
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 600, color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1.06, marginBottom: 18 }}>
              Your future<br />won&apos;t wait.
            </h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7, letterSpacing: '-0.05px' }}>
              Join students who take their academics seriously.<br />
              Futurely is completely free to start.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              background: 'var(--primary)',
              color: '#fff', borderRadius: 12, padding: '16px 52px',
              fontWeight: 600, fontSize: 16, textDecoration: 'none', letterSpacing: '-0.1px',
              boxShadow: '0 4px 24px rgba(45,106,79,0.22)',
            }}>
              Get started — it&apos;s free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <img src="/logo.png" alt="Futurely" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
        </div>
        <p>© 2026 Futurely · Built for high school students who mean business.</p>
      </footer>
      </div>{/* end content wrapper */}
    </div>
  )
}

// ── Bento card ───────────────────────────────────────────────────────────────
function BentoCard({ accent, icon, label, desc, large = false }: {
  accent: string; icon: React.ReactNode; label: string; desc: string; large?: boolean
}) {
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
  }
  const rgb = hexToRgb(accent)
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
      {/* Accent wash in corner */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        background: `radial-gradient(circle, rgba(${rgb},0.07) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '25%', right: '25%', height: 1,
        background: `linear-gradient(90deg, transparent, rgba(${rgb},0.35), transparent)`,
      }} />
      {/* Icon */}
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
      <p style={{ fontSize: large ? 14.5 : 13.5, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{desc}</p>
    </div>
  )
}
