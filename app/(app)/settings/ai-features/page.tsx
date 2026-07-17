'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '../../../../lib/api'

// ── Disclosure copy — verbatim, reviewed by legal ──────────────────────────

const DISCLOSURE_TITLE = 'About Automatic AI Check-ins'

const DISCLOSURE_BODY = `When you turn this on, NextStep's AI may periodically review your academic information to offer proactive advice. This includes:
- Checking your GPA trends and notifying you if something changes significantly
- Reviewing your upcoming assignments and sending study reminders
- Suggesting updates to your course plan based on your academic progress

What the AI will and will never do automatically:
The AI will never automatically change your grades, delete assignments, or modify your course plan without your explicit tap-to-confirm in the app. Every automatic action requires your approval before it takes effect.

Your activity log:
All automatic AI activity is visible in Account > AI Activity. You can review every action the AI has taken or suggested on your behalf at any time.

Turning it off:
You can disable automatic AI check-ins at any time in Settings > AI Features. Turning it off stops all future automatic analysis immediately.

For students under 13:
If your parent or guardian has set up your account, they must also approve this feature in the Parent Portal before it can be enabled.

Your data rights:
All analysis uses only your own academic data. Your information is never shared with other students and is never used to train AI models.`

// ── Toggle component ────────────────────────────────────────────────────────

function Toggle({
  enabled,
  loading,
  disabled,
  onChange,
}: {
  enabled: boolean
  loading: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Disable AI Check-ins' : 'Enable AI Check-ins'}
      onClick={() => !disabled && !loading && onChange(!enabled)}
      disabled={disabled || loading}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        background: enabled ? 'var(--primary)' : 'var(--border)',
        transition: 'background 200ms ease',
        opacity: disabled ? 0.5 : loading ? 0.7 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 200ms ease',
        }}
      />
    </button>
  )
}

// ── Consent disclosure modal ────────────────────────────────────────────────

function ConsentModal({
  onAccept,
  onCancel,
  loading,
}: {
  onAccept: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div style={S.overlay} role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div style={S.modal}>
        <h2 id="consent-title" style={S.modalTitle}>
          {DISCLOSURE_TITLE}
        </h2>

        <div style={S.disclosureBody}>
          {DISCLOSURE_BODY.split('\n').map((line, i) => {
            if (line.startsWith('- ')) {
              return (
                <p key={i} style={S.disclosureBullet}>
                  {line}
                </p>
              )
            }
            if (line.trim() === '') return <div key={i} style={{ height: 10 }} />
            const isSectionHeading = line.endsWith(':')
            return (
              <p
                key={i}
                style={isSectionHeading ? S.disclosureHeading : S.disclosureText}
              >
                {line}
              </p>
            )
          })}
        </div>

        <p style={S.consentNote}>
          By clicking "Turn on AI Check-ins" you confirm you have read the above and consent to
          the AI periodically reviewing your academic information.
        </p>

        <div style={S.modalBtns}>
          <button style={S.btnCancel} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            style={{ ...S.btnAccept, opacity: loading ? 0.6 : 1 }}
            onClick={onAccept}
            disabled={loading}
          >
            {loading ? 'Turning on…' : 'Turn on AI Check-ins'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AiFeaturesPage() {
  // Server-side enabled state — set after loading or server confirmation.
  const [enabled, setEnabled] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)
  const [toggleLoading, setToggleLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [coppaBlocked, setCoppaBlocked] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Load initial consent state from the user profile.
  // If the me() endpoint includes an autonomousConsentAccepted field, use it.
  // Fail closed (default OFF) if not present.
  useEffect(() => {
    api.me()
      .then(data => {
        const d = data as typeof data & { autonomousConsentAccepted?: boolean }
        setEnabled(d.autonomousConsentAccepted === true)
      })
      .catch(() => {
        // Couldn't load — default to OFF (safe)
        setEnabled(false)
      })
      .finally(() => setLoadingInit(false))
  }, [])

  // Called when user flips the toggle.
  // Turning ON: show disclosure modal first.
  // Turning OFF: call server FIRST, await response, THEN update UI.
  async function handleToggle(next: boolean) {
    setServerError(null)

    if (next) {
      setShowModal(true)
      return
    }

    // Turning OFF — must await server confirmation before flipping the toggle.
    setToggleLoading(true)
    try {
      await api.updateAutonomousConsent(false)
      // Server confirmed — now safe to update local state.
      setEnabled(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COPPA_BLOCKED') {
        setCoppaBlocked(true)
      } else {
        // Toggle MUST remain ON; surface an error for the user.
        setServerError(
          err instanceof Error ? err.message : 'Failed to disable AI Check-ins. Please try again.',
        )
        // Do NOT flip enabled — it stays ON.
      }
    } finally {
      setToggleLoading(false)
    }
  }

  // Called when user clicks "Turn on AI Check-ins" in the modal.
  async function handleAcceptConsent() {
    setToggleLoading(true)
    setServerError(null)
    try {
      await api.updateAutonomousConsent(true)
      setEnabled(true)
      setShowModal(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COPPA_BLOCKED') {
        setCoppaBlocked(true)
        setShowModal(false)
      } else {
        setServerError(
          err instanceof Error ? err.message : 'Failed to enable AI Check-ins. Please try again.',
        )
        // Do NOT update enabled — it stays OFF.
      }
    } finally {
      setToggleLoading(false)
    }
  }

  return (
    <div style={S.page}>
      {/* Back link */}
      <Link href="/settings" style={S.backLink}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Settings
      </Link>

      <h1 style={S.title}>AI Features</h1>
      <p style={S.subtitle}>Control how the AI interacts with your academic data automatically.</p>

      {/* COPPA block — shown instead of toggle if account is under-13 unverified */}
      {coppaBlocked ? (
        <div style={S.coppaCard}>
          <div style={S.coppaIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p style={S.coppaTitle}>Parental consent required</p>
            <p style={S.coppaText}>
              Your parent or guardian must approve this feature in the{' '}
              <strong>Parent Portal</strong> before it can be enabled. Once they approve it
              there, you'll be able to turn it on here.
            </p>
          </div>
        </div>
      ) : (
        <div className="ns-card" style={S.card}>
          {loadingInit ? (
            <div style={S.loadingRow}>
              <div style={S.spinner} aria-label="Loading" />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading settings…</span>
            </div>
          ) : (
            <>
              <div style={S.toggleRow}>
                <div style={S.toggleInfo}>
                  <span style={S.toggleLabel}>Automatic AI Check-ins</span>
                  <span style={S.toggleDesc}>
                    {enabled
                      ? 'The AI will periodically review your academic data and offer proactive advice.'
                      : 'Off — the AI will only respond when you ask it directly.'}
                  </span>
                </div>
                <Toggle
                  enabled={enabled}
                  loading={toggleLoading}
                  disabled={false}
                  onChange={next => void handleToggle(next)}
                />
              </div>

              {serverError && (
                <div style={S.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: 13, color: 'var(--error)' }}>{serverError}</span>
                </div>
              )}

              {enabled && (
                <div style={S.activeNote}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Active — AI check-ins are enabled. All activity is logged in{' '}
                  <Link href="/ai/activity" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                    AI Activity
                  </Link>.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Info card */}
      <div className="ns-card" style={S.infoCard}>
        <p style={S.infoLabel}>What the AI can do</p>
        {[
          'Read your GPA trends and notify you of significant changes',
          'Review upcoming assignments and send study reminders',
          'Suggest updates to your course plan based on academic progress',
        ].map(item => (
          <div key={item} style={S.infoRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}

        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

        <p style={S.infoLabel}>What the AI will never do</p>
        {[
          'Automatically change your grades or delete assignments',
          'Modify your course plan without your tap-to-confirm',
          'Share your data with other students or use it to train AI models',
        ].map(item => (
          <div key={item} style={S.infoRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Consent modal */}
      {showModal && (
        <ConsentModal
          onAccept={() => void handleAcceptConsent()}
          onCancel={() => setShowModal(false)}
          loading={toggleLoading}
        />
      )}

      <style jsx>{`
        @keyframes aifSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 680,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 13,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: '-0.4px',
    color: 'var(--text)',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 24,
  },
  card: {
    padding: 20,
    marginBottom: 16,
  },
  infoCard: {
    padding: 20,
    marginBottom: 16,
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid rgba(41,121,255,0.2)',
    borderTopColor: '#2979FF',
    animation: 'aifSpin 0.9s linear infinite',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  toggleDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    maxWidth: 460,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.07)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
  },
  activeNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    fontSize: 12.5,
    color: '#10B981',
    background: 'rgba(16,185,129,0.07)',
    border: '1px solid rgba(16,185,129,0.18)',
    borderRadius: 7,
    padding: '8px 12px',
  },
  infoLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    color: 'var(--text-muted)',
    marginBottom: 10,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  coppaCard: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    background: 'rgba(245,158,11,0.07)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 16,
  },
  coppaIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coppaTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#F59E0B',
    marginBottom: 6,
  },
  coppaText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0,
  },
  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    zIndex: 9500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: 'var(--text)',
    marginBottom: 16,
  },
  disclosureBody: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 16,
    maxHeight: 320,
    overflowY: 'auto' as const,
  },
  disclosureText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 4px',
  },
  disclosureHeading: {
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '10px 0 4px',
  },
  disclosureBullet: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '2px 0 2px 8px',
  },
  consentNote: {
    fontSize: 12.5,
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    marginBottom: 18,
  },
  modalBtns: {
    display: 'flex',
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnAccept: {
    flex: 2,
    height: 44,
    borderRadius: 9,
    border: 'none',
    background: '#2979FF',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },
}
