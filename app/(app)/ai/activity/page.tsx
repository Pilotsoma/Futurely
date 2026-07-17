'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, type AgentSessionData } from '../../../../lib/api'

const MODULE_LABELS: Record<string, string> = {
  PLANNER: 'Planner',
  GPA: 'GPA',
  ROADMAP: 'Roadmap',
  CHAT: 'Chat',
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10B981',
  FAILED: '#EF4444',
  RUNNING: '#2979FF',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AiActivityPage() {
  const [sessions, setSessions] = useState<AgentSessionData[]>([])
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async (cursor?: number) => {
    try {
      const result = await api.getAgentSessions(cursor)
      setSessions(prev => cursor != null ? [...prev, ...result.sessions] : result.sessions)
      setNextCursor(result.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI activity.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  async function handleLoadMore() {
    if (nextCursor == null) return
    setLoadingMore(true)
    await loadSessions(nextCursor)
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <Link href="/ai" style={S.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to AI Chat
          </Link>
          <h1 style={S.title}>AI Activity</h1>
        </div>
        <div style={S.loadingRow}>
          <div style={S.spinner} aria-label="Loading" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading activity…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <Link href="/ai" style={S.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to AI Chat
          </Link>
          <h1 style={S.title}>AI Activity</h1>
        </div>
        <div style={S.emptyBox}>
          <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>
          <button style={S.retryBtn} onClick={() => { setError(null); setLoading(true); void loadSessions() }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <Link href="/ai" style={S.backLink}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to AI Chat
        </Link>
        <h1 style={S.title}>AI Activity</h1>
        <p style={S.subtitle}>
          Every AI Agent session run on your account — newest first.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div style={S.emptyBox}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            No AI Agent sessions yet. Start one from the AI Chat or Planner pages.
          </p>
        </div>
      ) : (
        <div style={S.list}>
          {sessions.map(s => (
            <Link key={s.id} href={`/ai/activity/${s.id}`} style={{ textDecoration: 'none' }}>
              <div style={S.row}>
                <div style={S.rowLeft}>
                  <span style={S.modulePill}>{MODULE_LABELS[s.module] ?? s.module}</span>
                  <span style={{ ...S.statusDot, background: STATUS_COLORS[s.status] ?? 'var(--border)' }} />
                  <span style={{ fontSize: 12, color: STATUS_COLORS[s.status] ?? 'var(--text-muted)', fontWeight: 600 }}>
                    {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div style={S.rowMid}>
                  <span style={S.userMsg}>
                    {s.userMessage
                      ? s.userMessage.length > 80
                        ? s.userMessage.slice(0, 80) + '…'
                        : s.userMessage
                      : 'Automatic check-in'}
                  </span>
                  <span style={S.rowDate}>{formatDate(s.startedAt)}</span>
                </div>
                <div style={S.rowRight}>
                  <span style={S.toolCount}>{s.toolCallCount} tool call{s.toolCallCount !== 1 ? 's' : ''}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}

          {nextCursor != null && (
            <button style={S.loadMoreBtn} onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes actSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 720,
  },
  header: {
    marginBottom: 28,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.4px',
    color: 'var(--text)',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid rgba(41,121,255,0.2)',
    borderTopColor: '#2979FF',
    animation: 'actSpin 0.9s linear infinite',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '48px 24px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    textAlign: 'center',
  },
  retryBtn: {
    padding: '8px 18px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 16px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'border-color 120ms ease, background 120ms ease',
  },
  rowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    minWidth: 130,
  },
  modulePill: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--primary)',
    background: 'rgba(41,121,255,0.1)',
    border: '1px solid rgba(41,121,255,0.18)',
    borderRadius: 4,
    padding: '2px 7px',
    flexShrink: 0,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  rowMid: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  userMsg: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  rowDate: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  rowRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  toolCount: {
    fontSize: 11.5,
    color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  loadMoreBtn: {
    width: '100%',
    padding: '10px 0',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 9,
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 4,
  },
}
