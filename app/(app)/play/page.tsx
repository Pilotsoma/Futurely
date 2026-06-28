'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../lib/api'

export default function PlayPage() {
  const router = useRouter()

  const [code, setCode]         = useState('')
  const [joining, setJoining]   = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 6) { setJoinError('Enter the 6-character game code'); return }
    setJoining(true); setJoinError(null)
    try {
      const session = await api.joinGame(trimmed)
      if (session.type === 'BATTLE') {
        router.push(`/battle/${trimmed}`)
      } else {
        router.push(`/play/${trimmed}`)
      }
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Game not found')
      setJoining(false)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Play a Game</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Enter a join code to play, or host your own game from a study set.</p>
      </div>

      {/* Join by code */}
      <div className="ns-card" style={{ padding: '24px 22px', marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Join with a Code
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0,6))}
            onKeyDown={e => e.key === 'Enter' && void handleJoin()}
            placeholder="XXXXXX"
            maxLength={6}
            style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 22, fontWeight: 800, letterSpacing: '0.3em', textAlign: 'center', outline: 'none', textTransform: 'uppercase' }}
          />
          <button
            onClick={() => void handleJoin()}
            disabled={joining || code.trim().length !== 6}
            style={{ padding: '12px 22px', borderRadius: 12, background: code.trim().length === 6 && !joining ? 'var(--primary)' : 'var(--surface-2)', color: code.trim().length === 6 && !joining ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: 14, fontWeight: 700, cursor: code.trim().length === 6 && !joining ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}
          >
            {joining ? '…' : 'Join'}
          </button>
        </div>
        {joinError && <p style={{ fontSize: 13, color: 'var(--error)', margin: '10px 0 0' }}>{joinError}</p>}
      </div>

      {/* Host from sets */}
      <div className="ns-card" style={{ padding: '20px 22px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Host a Game
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>Pick a study set from your library or browse public sets to host a live review game.</p>
        <Link href="/sets" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 20, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          Browse Study Sets →
        </Link>
      </div>
    </div>
  )
}
