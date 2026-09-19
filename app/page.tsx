import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CheckIcon } from '@/components/icons'
import Reveal from './Reveal'
import ScrollProgressBar from './ScrollProgressBar'
import LandingNav from './LandingNav'
import ParticlesLayer from './ParticlesLayer'
import Hero from './Hero'
import FeatureShowcase from './FeatureShowcase'
import FAQ from './FAQ'

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

export default function LandingPage() {
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
      <ParticlesLayer />
      {/* All page content sits above particles */}
      <div style={{ position: 'relative', zIndex: 2 }}>

      {/* ── Scroll progress ──────────────────────────────────────────────── */}
      <ScrollProgressBar />

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Hero />

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

        <FeatureShowcase />
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

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <FAQ />

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
            <Image src="/logo.png" alt="myFuturely" width={1706} height={2048} style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
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
