'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

interface AiBarProps {
  placeholder?: string
  /**
   * When provided, the parent owns the full submit flow (animation + navigation).
   * AiBar calls this with the trimmed query string and waits for it to resolve.
   * When omitted, AiBar falls back to writing ai_pending_msg and pushing /ai directly.
   */
  onSubmit?: (query: string) => Promise<void>
}

export default function AiBar({ placeholder = 'Ask myFuturely AI…', onSubmit }: AiBarProps) {
  const [query, setQuery] = useState('')
  const router = useRouter()

  async function handleSubmit() {
    const trimmed = query.trim()
    if (!trimmed) return

    if (onSubmit) {
      await onSubmit(trimmed)
    } else {
      sessionStorage.setItem('ai_pending_msg', trimmed)
      router.push('/ai')
    }
  }

  return (
    <motion.div
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={S.wrap}
    >
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void handleSubmit() }}
        placeholder={placeholder}
        aria-label="Ask myFuturely AI"
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
