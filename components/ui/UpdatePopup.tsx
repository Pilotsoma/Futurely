'use client'

import { useEffect, useState } from 'react'
import { CHANGELOG, CURRENT_VERSION } from '@/lib/changelog'

const STORAGE_KEY = 'ns_seen_version'

export default function UpdatePopup() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== CURRENT_VERSION) setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    setShow(false)
  }

  if (!show) return null

  const latest = CHANGELOG[0]

  return (
    <div style={S.overlay} onClick={dismiss}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={S.badge}>v{latest.version}</div>
            <h2 style={S.title}>What&apos;s New in myFuturely</h2>
            <p style={S.subtitle}>{latest.title} · {latest.date}</p>
          </div>
          <button style={S.closeBtn} onClick={dismiss} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Changes */}
        <div style={S.list}>
          {latest.changes.map((c, i) => (
            <div key={i} style={S.item}>
              <span style={S.emoji}>{c.emoji}</span>
              <div style={S.itemText}>
                <div style={S.headline}>{c.headline}</div>
                <div style={S.detail}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerNote}>Full changelog available in Settings → Changelog</span>
          <button className="ns-btn-primary" style={{ height: 38, padding: '0 24px', fontSize: 14 }} onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  panel:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 24px 16px', borderBottom: '1px solid var(--border)' },
  badge:      { display: 'inline-block', fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 99, padding: '2px 10px', marginBottom: 6 },
  title:      { fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 },
  subtitle:   { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
  closeBtn:   { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 12 },
  list:       { flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 },
  item:       { display: 'flex', gap: 14, alignItems: 'flex-start' },
  emoji:      { fontSize: 22, lineHeight: 1, flexShrink: 0, width: 28, textAlign: 'center' as const, marginTop: 1 },
  itemText:   { flex: 1 },
  headline:   { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  detail:     { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 },
  footer:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 12 },
  footerNote: { fontSize: 11.5, color: 'var(--text-muted)', flex: 1 },
}
