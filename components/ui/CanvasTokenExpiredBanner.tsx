'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, ApiError } from '@/lib/api'
import type { CanvasConnectionInfo } from '@/lib/api'

export default function CanvasTokenExpiredBanner() {
  const [expiredConnections, setExpiredConnections] = useState<CanvasConnectionInfo[]>([])
  const [current, setCurrent] = useState<CanvasConnectionInfo | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const status = await api.canvasStatus()
      const expired = status.connections.filter((c: CanvasConnectionInfo) => c.tokenInvalid)
      setExpiredConnections(expired)
    } catch {
      // silently fail — don't interrupt the user
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 60_000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // Keep current in sync with expiredConnections list
  useEffect(() => {
    if (expiredConnections.length === 0) {
      setCurrent(null)
      return
    }
    if (!current || !expiredConnections.find(c => c.canvasInstanceUrl === current.canvasInstanceUrl)) {
      setCurrent(expiredConnections[0])
    }
  }, [expiredConnections, current])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || !token.trim()) return
    setLoading(true)
    setError(null)
    try {
      await api.canvasRefreshToken(current.canvasInstanceUrl, token.trim())
      setToken('')
      await checkStatus()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.code === 'INVALID_TOKEN'
            ? 'That token is invalid. Please double-check and try again.'
            : err.message ?? 'Something went wrong. Please try again.'
        )
      } else {
        setError('Network error. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!current) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '36px 32px',
        maxWidth: 440,
        width: '90%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(255, 80, 80, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5050" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Canvas token expired</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {current.canvasInstanceUrl}
            </p>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Your Canvas access token has expired. To continue syncing grades and assignments, generate a new token and paste it below.
        </p>

        {/* Instructions */}
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px',
          border: '1px solid var(--border)',
        }}>
          Canvas → Profile → Settings → Approved Integrations → New Access Token
          <br />
          <span style={{ color: 'var(--text-tertiary)' }}>Set the expiry to <strong style={{ color: 'var(--text-secondary)' }}>120 days</strong> (maximum recommended)</span>
        </div>

        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            className="ns-input"
            placeholder="Paste new Canvas access token…"
            value={token}
            onChange={e => { setToken(e.target.value); setError(null) }}
            disabled={loading}
            autoFocus
            style={{ fontSize: 13 }}
          />
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--error)' }}>{error}</p>
          )}
          <button
            type="submit"
            className="ns-btn-primary"
            style={{ height: 42, opacity: loading || !token.trim() ? 0.5 : 1 }}
            disabled={loading || !token.trim()}
          >
            {loading ? 'Verifying…' : 'Update Token'}
          </button>
        </form>

        {expiredConnections.length > 1 && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            {expiredConnections.length - 1} other Canvas connection{expiredConnections.length > 2 ? 's' : ''} also need{expiredConnections.length === 2 ? 's' : ''} a new token. You&apos;ll be prompted for each one.
          </p>
        )}
      </div>
    </div>
  )
}
