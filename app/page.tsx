'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'

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
      transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

const ICON_GRADES = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const ICON_AI = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
)
const ICON_PLANNER = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const ICON_SIM = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const ICON_STREAK = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
)
const ICON_SOCIAL = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const heroY       = useTransform(scrollYProgress, [0, 0.4], [0, -90])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0])

  return (
    <div style={{ background: '#060709', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── Scroll progress ─────────────────────────────────────────────────── */}
      <motion.div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 200,
        background: 'linear-gradient(90deg, #00C896 0%, #4B6EFF 60%, #A78BFA 100%)',
        scaleX: scrollYProgress, transformOrigin: '0%',
      }} />

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        background: 'rgba(6,7,9,0.75)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 28px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
            style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, #00C896 0%, #4B6EFF 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px',
            }}>F</div>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Futurely</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.25)',
              color: '#00C896', borderRadius: 8, padding: '8px 18px',
              fontWeight: 600, fontSize: 13.5, textDecoration: 'none', letterSpacing: '-0.1px',
            }}>
              Open app <span style={{ opacity: 0.7 }}>→</span>
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingTop: 60 }}>

        {/* Ambient glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-15%', left: '50%', transform: 'translateX(-50%)',
            width: 900, height: 700,
            background: 'radial-gradient(ellipse, rgba(0,200,150,0.13) 0%, transparent 65%)',
            filter: 'blur(1px)',
          }} />
          <div style={{
            position: 'absolute', top: '30%', right: '-15%',
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(75,110,255,0.09) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', left: '-10%',
            width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }} />
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
          }} />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity, position: 'relative', textAlign: 'center', padding: '0 24px', maxWidth: 860, margin: '0 auto', width: '100%' }}>

          {/* Eyebrow pill */}
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }} style={{ marginBottom: 32 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.18)',
              color: '#00C896', borderRadius: 100, padding: '6px 18px',
              fontSize: 12.5, fontWeight: 600, letterSpacing: '0.4px',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#00C896', display: 'inline-block',
                boxShadow: '0 0 8px rgba(0,200,150,0.8)',
                animation: 'futurePulse 2s ease-in-out infinite',
              }} />
              The academic platform built for your generation
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.07 }}
            style={{
              fontSize: 'clamp(52px, 8.5vw, 96px)',
              fontWeight: 800, lineHeight: 1.02, letterSpacing: '-3.5px',
              color: '#fff', marginBottom: 28,
            }}
          >
            Track grades.{' '}
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #00C896 0%, #4B8BFF 55%, #A78BFA 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Plan smarter.
            </span>
            <br />
            Get ahead.
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
            style={{ fontSize: 19, color: 'rgba(255,255,255,0.42)', maxWidth: 520, margin: '0 auto 44px', lineHeight: 1.7, fontWeight: 400, letterSpacing: '-0.2px' }}
          >
            Futurely syncs your school portal, AI advisor, and college prep
            into one platform. The academic app you always wished existed.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.22 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 72 }}
          >
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #00C896 0%, #00B588 100%)',
              color: '#03120D', borderRadius: 12, padding: '15px 38px',
              fontWeight: 700, fontSize: 15.5, textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(0,200,150,0.4), 0 8px 40px rgba(0,200,150,0.22)',
              letterSpacing: '-0.2px',
            }}>
              Start for free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <a href="#features" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: '15px 38px',
              fontWeight: 600, fontSize: 15.5, textDecoration: 'none', letterSpacing: '-0.2px',
            }}>
              See features
            </a>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: 0.33 }}
            style={{
              display: 'inline-flex', overflow: 'hidden',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
            }}
          >
            {[
              { v: '10K+',  l: 'Grade syncs' },
              { v: '98%',   l: 'Data accuracy' },
              { v: '3.8',   l: 'Avg student GPA' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '18px 32px', textAlign: 'center' as const,
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', marginTop: 5, fontWeight: 500, letterSpacing: '0.3px' }}>{s.l}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
          style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
          <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 5, color: 'rgba(255,255,255,0.18)' }}>
            <span style={{ fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase' as const }}>scroll</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Bento Features ───────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1160, margin: '0 auto', padding: '120px 28px' }}>
        <Reveal>
          <p style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#00C896', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 14 }}>
            Everything you need
          </p>
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 800, color: '#fff', letterSpacing: '-2.5px', lineHeight: 1.06, marginBottom: 72 }}>
            One app.<br />Your entire academic life.
          </h2>
        </Reveal>

        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
          <Reveal delay={0.04}>
            <BentoCard accent="#00C896" icon={ICON_GRADES} label="Grade Portal"
              desc="Connect HAC or PowerSchool. Every grade, GPA trend, classwork score, and transcript — pulled in automatically. No more logging into clunky school portals."
              large />
          </Reveal>
          <Reveal delay={0.1}>
            <BentoCard accent="#4B6EFF" icon={ICON_AI} label="AI Advisor"
              desc="Ask anything about your grades, college chances, or what to prioritize. Get answers built around your actual data." />
          </Reveal>
        </div>

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Reveal delay={0.06}>
            <BentoCard accent="#F59E0B" icon={ICON_PLANNER} label="Smart Planner"
              desc="Assignments, deadlines, and priorities surfaced automatically. Never miss a due date again." />
          </Reveal>
          <Reveal delay={0.12}>
            <BentoCard accent="#A78BFA" icon={ICON_SIM} label="GPA Simulator"
              desc="See how a grade change affects your GPA in real time before you turn it in." />
          </Reveal>
          <Reveal delay={0.18}>
            <BentoCard accent="#EAB308" icon={ICON_STREAK} label="Daily Streaks"
              desc="Log in every day. Build your streak. Earn coins, exclusive tags, and unlock the Marketplace." />
          </Reveal>
        </div>

        {/* Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
          <Reveal delay={0.08}>
            <BentoCard accent="#EC4899" icon={ICON_SOCIAL} label="Study Feed"
              desc="Posts, reactions, follows. A social layer built for students — not another distraction." />
          </Reveal>
          <Reveal delay={0.14}>
            <BentoCard accent="#00C896" icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            } label="Marketplace"
              desc="Unlock at a 3-day streak. Buy, sell, and trade items with coins you earn by showing up. Earn enough coins and you can snag exclusive profile effects, name colors, and gear."
              large />
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '100px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <Reveal>
            <p style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#4B6EFF', letterSpacing: '2.5px', textTransform: 'uppercase', marginBottom: 14 }}>
              Three steps
            </p>
            <h2 style={{ textAlign: 'center', fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-2px', lineHeight: 1.08, marginBottom: 72 }}>
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
                <div style={{
                  padding: '36px 28px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.022)',
                  border: '1px solid rgba(255,255,255,0.065)',
                  height: '100%',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.14)', letterSpacing: '3px', marginBottom: 20 }}>{s.n}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.6px', marginBottom: 12, lineHeight: 1.2 }}>{s.title}</h3>
                  <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 28px 120px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 900, height: 500, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(0,200,150,0.1) 0%, transparent 65%)',
          filter: 'blur(30px)',
        }} />
        <Reveal>
          <div style={{
            maxWidth: 680, margin: '0 auto', textAlign: 'center',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 28, padding: '64px 40px', position: 'relative',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 0 1px rgba(0,200,150,0.06) inset, 0 40px 80px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
              width: 200, height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(0,200,150,0.5), transparent)',
            }} />
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, color: '#fff', letterSpacing: '-2.5px', lineHeight: 1.05, marginBottom: 16 }}>
              Your future<br />won&apos;t wait.
            </h2>
            <p style={{ fontSize: 16.5, color: 'rgba(255,255,255,0.38)', marginBottom: 40, lineHeight: 1.65, letterSpacing: '-0.1px' }}>
              Join students who take their academics seriously.<br />
              Futurely is completely free to start.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #00C896 0%, #00B080 100%)',
              color: '#03120D', borderRadius: 14, padding: '16px 52px',
              fontWeight: 700, fontSize: 16, textDecoration: 'none', letterSpacing: '-0.2px',
              boxShadow: '0 0 0 1px rgba(0,200,150,0.4), 0 8px 48px rgba(0,200,150,0.2)',
            }}>
              Get started — it&apos;s free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 28px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #00C896, #4B6EFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff' }}>F</div>
          <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.28)' }}>Futurely</span>
        </div>
        <p>© 2026 Futurely · Built for high school students who mean business.</p>
      </footer>
    </div>
  )
}

// ── Bento card component ─────────────────────────────────────────────────────
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
      background: 'rgba(255,255,255,0.022)',
      border: '1px solid rgba(255,255,255,0.065)',
      borderRadius: 20, padding: large ? '36px 32px' : '28px 26px',
      height: '100%', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = `rgba(${rgb},0.25)`
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = `0 8px 32px rgba(${rgb},0.1)`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'rgba(255,255,255,0.065)'
        el.style.transform = 'translateY(0px)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 240, height: 240,
        background: `radial-gradient(circle, rgba(${rgb},0.12) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Top border highlight */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
        background: `linear-gradient(90deg, transparent, rgba(${rgb},0.4), transparent)`,
      }} />
      <div style={{
        width: 48, height: 48, borderRadius: 13,
        background: `rgba(${rgb},0.1)`,
        border: `1px solid rgba(${rgb},0.22)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, marginBottom: 20, position: 'relative',
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: large ? 22 : 18, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '-0.5px', lineHeight: 1.2 }}>{label}</h3>
      <p style={{ fontSize: large ? 15 : 13.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>{desc}</p>
    </div>
  )
}
