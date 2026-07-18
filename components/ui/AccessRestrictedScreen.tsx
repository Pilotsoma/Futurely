'use client'

import React from 'react'
import Image from 'next/image'

interface AccessRestrictedScreenProps {
  bannedUntilDate: string | null
  onLogout: () => void
}

function formatLongDate(isoDate: string | null): string {
  if (!isoDate) return ''
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

export default function AccessRestrictedScreen({ bannedUntilDate, onLogout }: AccessRestrictedScreenProps) {
  const readableDate = formatLongDate(bannedUntilDate)

  return (
    <div style={S.card}>
      <div style={S.logoRow}>
        <Image src="/logo.png" alt="myFuturely" width={40} height={40} style={{ objectFit: 'contain' }} />
        <span style={S.logoText}>myFuturely</span>
      </div>

      <div style={S.iconWrapper} aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h1 style={S.heading}>Access temporarily unavailable</h1>

      <p style={S.body}>
        Your account is not currently eligible to access Futurely. This is determined automatically based on
        information from your school record.
      </p>

      {readableDate && (
        <p style={S.dateNote}>
          You&rsquo;ll be able to access Futurely on <strong style={{ color: 'var(--text)' }}>{readableDate}</strong>.
        </p>
      )}

      <p style={S.hint}>
        If you believe this is an error, ask a parent or guardian to contact your school to update your
        records.
      </p>

      <button
        type="button"
        onClick={onLogout}
        style={S.logoutBtn}
      >
        Sign out
      </button>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '40px 36px',
    maxWidth: 440,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(245, 158, 11, 0.10)',
    border: '1px solid rgba(245, 158, 11, 0.20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 14px',
  },
  body: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  dateNote: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  hint: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: '0 0 28px',
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    padding: '10px 24px',
    borderRadius: 8,
    width: '100%',
    transition: 'border-color 0.15s',
  },
}
