'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useAnimation, useReducedMotion } from 'framer-motion'

interface AiBarProps {
  placeholder?: string
}

const PULSE_DURATION_S = 0.22

export default function AiBar({ placeholder = 'Ask Futurely AI…' }: AiBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()
  const controls = useAnimation()
  const prefersReducedMotion = useReducedMotion()

  async function handleSubmit() {
    const trimmed = query.trim()
    if (!trimmed) return

    sessionStorage.setItem('ai_pending_msg', trimmed)
    sessionStorage.setItem('ai_morph_enter', '1')

    if (!prefersReducedMotion) {
      // Pill-pulse: compress then release with a ring glow radiating outward.
      // Resolves after PULSE_DURATION_S before navigation fires.
      await controls.start({
        scale: [1, 0.97, 1.0],
        boxShadow: [
          '0 0 0 0px rgba(41,121,255,0)',
          '0 0 0 7px rgba(41,121,255,0.30)',
          '0 0 0 14px rgba(41,121,255,0)',
        ],
        transition: {
          duration: PULSE_DURATION_S,
          ease: [0.19, 1, 0.22, 1],
        },
      })
    }

    router.push('/ai')
  }

  return (
    <motion.div
      animate={controls}
      // Suppress layout shift: reset boxShadow to a valid initial value so
      // framer-motion does not interpolate from undefined on the first frame.
      initial={{ boxShadow: '0 0 0 0px rgba(41,121,255,0)' }}
      style={S.wrap}
    >
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }}
        placeholder={placeholder}
        aria-label="Ask Futurely AI"
        style={S.input}
      />
      <button
        onClick={() => void handleSubmit()}
        disabled={!query.trim()}
        aria-label="Ask AI"
        style={{ ...S.btn, opacity: query.trim() ? 1 : 0.45 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </motion.div>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 100,
    padding: '10px 10px 10px 20px',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--primary)',
    border: 'none',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
}
