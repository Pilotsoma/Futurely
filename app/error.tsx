'use client'

import { useEffect, useRef } from 'react'

const CHUNK_RELOAD_KEY = '__mf_chunk_reload_attempted'

function isChunkLoadError(error: Error): boolean {
  // Webpack's built-in ChunkLoadError class
  if (error.name === 'ChunkLoadError') return true

  const msg = error.message ?? ''

  // Webpack: "Loading chunk N failed." / "Loading chunk N (from ...)"
  if (/Loading chunk \d+ failed/i.test(msg)) return true
  if (/Loading chunk/i.test(msg) && /failed/i.test(msg)) return true

  // Next.js / webpack: chunk fetch failure
  if (/Failed to fetch dynamically imported module/i.test(msg)) return true

  // Safari: "Importing a module script failed."
  if (/Importing a module script failed/i.test(msg)) return true

  // Generic dynamic import network failure
  if (/dynamically imported module/i.test(msg)) return true

  // CSS chunk load failure
  if (/Loading CSS chunk/i.test(msg)) return true

  // Next.js specific: "ChunkLoadError: Loading chunk … failed." — narrowed to
  // require chunk/import context in the stack so a plain failed fetch() call
  // elsewhere in the app isn't mistaken for a stale-deploy chunk error.
  if (error.name === 'TypeError' && /failed to fetch/i.test(msg) && /chunk|import/i.test(error.stack ?? '')) return true

  return false
}

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const hasAttemptedAutoReload = useRef(false)

  useEffect(() => {
    if (!isChunkLoadError(error)) {
      console.error('[ErrorBoundary] Unhandled error:', error)
      return
    }

    // Only auto-reload once per session — prevent an infinite reload loop
    // if the chunk is genuinely gone (e.g., stale deploy with corrupted cache)
    const alreadyAttempted = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'
    if (alreadyAttempted) {
      console.error('[ErrorBoundary] ChunkLoadError recurred after reload — showing manual UI', error)
      return
    }

    hasAttemptedAutoReload.current = true
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  }, [error])

  // During the auto-reload window, render nothing visible — the reload will
  // replace the page before the user notices.
  const isAboutToAutoReload =
    isChunkLoadError(error) &&
    sessionStorage.getItem(CHUNK_RELOAD_KEY) !== '1'

  if (isAboutToAutoReload) {
    return (
      <div style={styles.overlay}>
        <div style={styles.dots}>
          <span style={styles.dot} />
          <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
          <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
        </div>
      </div>
    )
  }

  const isStaleChunk = isChunkLoadError(error)

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.iconWrap}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#2979FF' }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={styles.heading}>
          {isStaleChunk ? 'New version available' : 'Something went wrong'}
        </h1>

        <p style={styles.body}>
          {isStaleChunk
            ? "This page couldn't load because a new version of myFuturely was deployed while you had the app open. A reload will get you the latest version."
            : "This page couldn't load correctly. Try again — if the problem persists, reloading usually fixes it."}
        </p>

        <div style={styles.buttonRow}>
          <button
            onClick={() => window.history.back()}
            style={styles.primaryBtn}
          >
            Go back
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem(CHUNK_RELOAD_KEY)
              window.location.reload()
            }}
            style={styles.ghostBtn}
          >
            Reload page
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details style={styles.details}>
            <summary style={styles.summary}>Error details (dev only)</summary>
            <pre style={styles.pre}>
              {error.name}: {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// ── Inline styles — no CSS pipeline dependency ─────────────────────────────
// Uses the same design tokens as the app (CSS vars where available, matching
// raw values as fallbacks since CSS vars always resolve in the same document).

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg, #0D1829)',
    color: 'var(--text, #E8EEFF)',
    fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif)',
    padding: '24px',
  },
  card: {
    background: 'var(--surface, #162235)',
    border: '1px solid var(--border, #273D5E)',
    borderRadius: '18px',
    padding: '40px 36px',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
  },
  iconWrap: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'rgba(41, 121, 255, 0.10)',
    border: '1px solid rgba(41, 121, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  heading: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text, #E8EEFF)',
    marginBottom: '12px',
    lineHeight: 1.3,
  },
  body: {
    fontSize: '14px',
    color: 'var(--text-secondary, #96AACC)',
    lineHeight: 1.6,
    marginBottom: '28px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  primaryBtn: {
    background: '#2979FF',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '12px',
    padding: '10px 24px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghostBtn: {
    background: 'transparent',
    color: 'var(--text-secondary, #96AACC)',
    border: '1px solid var(--border, #273D5E)',
    borderRadius: '12px',
    padding: '10px 24px',
    fontWeight: 500,
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  details: {
    marginTop: '24px',
    textAlign: 'left',
  },
  summary: {
    color: 'var(--text-muted, #52698A)',
    fontSize: '12px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  pre: {
    background: 'var(--surface-2, #1C2D47)',
    border: '1px solid var(--border, #273D5E)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '11px',
    color: 'var(--text-secondary, #96AACC)',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  // Auto-reload spinner dots
  dots: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#2979FF',
    animation: 'aiDotBounce 1.2s ease-in-out infinite',
  },
}
