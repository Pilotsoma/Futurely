'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'

export default function Hero() {
  const { scrollYProgress } = useScroll()
  const heroY       = useTransform(scrollYProgress, [0, 0.4], [0, -90])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.28], [1, 0])

  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingTop: 76, overflow: 'hidden' }}>

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
            fontSize: 'clamp(36px, 5.5vw, 76px)',
            fontWeight: 500,
            lineHeight: 1.08,
            letterSpacing: '-2px',
            color: 'var(--text)',
            marginBottom: 36,
          }}
        >
          <span style={{
            backgroundImage: 'linear-gradient(90deg, #22d3ee 0%, var(--primary) 45%, var(--purple) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}>
            Your AI Academic Advisor
          </span>{' '}for High School Students
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.19, 1, 0.22, 1], delay: 0.17 }}
          style={{ fontSize: 21, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto 52px', lineHeight: 1.7, fontWeight: 400, letterSpacing: '-0.1px' }}
        >
          myFuturely pairs a personal AI advisor with a planner built around your
          academic life, giving you the tools to actually plan ahead, not just get by.
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
  )
}
