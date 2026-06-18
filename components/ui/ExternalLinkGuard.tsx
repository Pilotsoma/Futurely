'use client'

import { useEffect, useState } from 'react'

export default function ExternalLinkGuard() {
  const [pending, setPending] = useState<{ href: string } | null>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      if ((anchor as HTMLAnchorElement).dataset.noIntercept) return

      const href = anchor.getAttribute('href') ?? ''
      if (!href.startsWith('http')) return

      try {
        const url = new URL(href)
        if (url.origin === window.location.origin) return
        e.preventDefault()
        e.stopPropagation()
        setPending({ href })
      } catch {
        // malformed URL — let browser handle it
      }
    }

    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  if (!pending) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={() => setPending(null)}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 28px 24px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 30, textAlign: 'center', marginBottom: 14 }}>🔗</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
          Do you want to visit this site?
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
          This link will open outside of Futurely.
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--primary)',
          background: 'var(--surface-2)',
          borderRadius: 8,
          padding: '9px 14px',
          textAlign: 'center',
          marginBottom: 24,
          overflowWrap: 'break-word',
          wordBreak: 'break-all',
          lineHeight: 1.5,
        }}>
          {pending.href}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setPending(null)}
            style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Stay on Futurely
          </button>
          <button
            onClick={() => { window.open(pending.href, '_blank', 'noopener,noreferrer'); setPending(null) }}
            style={{ flex: 1, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            Visit Site
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
