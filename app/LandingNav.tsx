'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRightIcon } from '@/components/icons'

export default function LandingNav() {
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
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
          <Image src="/logo.png" alt="" width={1706} height={2048} style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }} />
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
  )
}
