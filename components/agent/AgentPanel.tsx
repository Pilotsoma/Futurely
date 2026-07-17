'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { renderChatMarkdown } from '../../lib/chatMarkdown'
import { useAgentSession } from './useAgentSession'
import AgentConfirmDialog from './AgentConfirmDialog'
import type { AgentModule } from '../../lib/api'

interface AgentPanelProps {
  /** Which backend module to target. */
  module: AgentModule
  /** Label for the trigger button shown on the page. */
  buttonLabel?: string
  /** Optional placeholder for the in-panel text input. */
  inputPlaceholder?: string
}

/**
 * AgentPanel — drop-in component for any page that needs agent session support.
 *
 * Renders a trigger button. When clicked, opens a modal-style panel where the
 * user types their request, the panel polls the backend until the session
 * completes, and the response is shown. Handles write_intent confirmation and
 * COPPA-blocked states.
 */
export default function AgentPanel({
  module,
  buttonLabel = 'Ask AI Agent',
  inputPlaceholder = 'What would you like the AI to do?',
}: AgentPanelProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  const { phase, finalResponse, pendingConfirm, errorMessage, startSession, confirmAction, reset } =
    useAgentSession()

  function handleOpen() {
    setOpen(true)
    reset()
    setInputValue('')
  }

  function handleClose() {
    setOpen(false)
    reset()
    setInputValue('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const msg = inputValue.trim()
    if (!msg) return
    await startSession(module, msg)
  }

  async function handleConfirm(confirmed: boolean) {
    setConfirmLoading(true)
    try {
      await confirmAction(confirmed)
    } finally {
      setConfirmLoading(false)
    }
  }

  const isActive = phase !== 'idle'

  return (
    <>
      {/* ── Trigger button ── */}
      <button onClick={handleOpen} style={S.trigger} aria-label={buttonLabel}>
        <Image src="/logo.png" alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
        {buttonLabel}
      </button>

      {/* ── Modal overlay ── */}
      {open && (
        <div
          style={S.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="AI Agent"
          onClick={e => {
            if (e.target === e.currentTarget) handleClose()
          }}
        >
          <div style={S.panel}>
            {/* Header */}
            <div style={S.header}>
              <div style={S.headerLeft}>
                <div style={S.avatarWrap}>
                  <Image
                    src="/logo.png"
                    alt="myFuturely AI"
                    width={18}
                    height={18}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <span style={S.headerTitle}>AI Agent</span>
                <span style={S.moduleBadge}>{module}</span>
              </div>
              <button
                style={S.closeBtn}
                onClick={handleClose}
                aria-label="Close AI Agent panel"
                disabled={phase === 'running'}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={S.body}>
              {/* Input form — visible until session starts */}
              {!isActive && (
                <form onSubmit={e => void handleSubmit(e)} style={S.form}>
                  <p style={S.hint}>
                    The AI Agent can read your academic data and take actions on your behalf. Each
                    change requires your confirmation.
                  </p>
                  <textarea
                    style={S.textarea}
                    rows={3}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={inputPlaceholder}
                    aria-label="Request for AI Agent"
                    autoFocus
                  />
                  <button
                    type="submit"
                    style={{
                      ...S.submitBtn,
                      opacity: !inputValue.trim() ? 0.4 : 1,
                    }}
                    disabled={!inputValue.trim()}
                  >
                    Ask Agent
                  </button>
                </form>
              )}

              {/* Running state */}
              {phase === 'running' && (
                <div style={S.stateBox}>
                  <div style={S.thinkingRow}>
                    <div style={S.spinner} aria-hidden="true" />
                    <span style={S.thinkingLabel}>Thinking…</span>
                  </div>
                  <p style={S.thinkingNote}>
                    The AI Agent is working. This may take a moment.
                  </p>
                </div>
              )}

              {/* Completed state */}
              {phase === 'completed' && finalResponse && (
                <div style={S.stateBox}>
                  <div style={S.successBadge}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Done
                  </div>
                  <div
                    style={S.responseBody}
                    dangerouslySetInnerHTML={{ __html: renderChatMarkdown(finalResponse) }}
                  />
                  <button style={S.resetBtn} onClick={() => { reset(); setInputValue('') }}>
                    Ask another question
                  </button>
                </div>
              )}

              {/* Failed state */}
              {phase === 'failed' && (
                <div style={S.stateBox}>
                  <div style={S.errorBadge}>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    {errorMessage ?? 'Session failed'}
                  </div>
                  <button style={S.resetBtn} onClick={() => { reset(); setInputValue('') }}>
                    Try again
                  </button>
                </div>
              )}

              {/* COPPA blocked state */}
              {phase === 'coppa_blocked' && (
                <div style={S.stateBox}>
                  <div style={S.coppaBox}>
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <div>
                      <p style={S.coppaTitle}>Parental consent required</p>
                      <p style={S.coppaText}>
                        This feature requires your parent or guardian to approve it in the Parent
                        Portal before it can be used.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog — rendered above everything else */}
      {open && phase === 'awaiting_confirm' && pendingConfirm && (
        <AgentConfirmDialog
          description={pendingConfirm.description}
          onConfirm={() => void handleConfirm(true)}
          onDeny={() => void handleConfirm(false)}
          loading={confirmLoading}
        />
      )}

      <style jsx>{`
        @keyframes agentSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 16px',
    borderRadius: 9,
    border: '1px solid rgba(41,121,255,0.3)',
    background: 'rgba(41,121,255,0.08)',
    color: 'var(--primary)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 120ms ease, border-color 120ms ease, transform 120ms ease',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    zIndex: 8000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    background: 'var(--surface-2)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  moduleBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    color: 'var(--primary)',
    background: 'rgba(41,121,255,0.1)',
    border: '1px solid rgba(41,121,255,0.2)',
    borderRadius: 4,
    padding: '2px 7px',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--surface-2)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  body: {
    padding: 20,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  hint: {
    fontSize: 12.5,
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    margin: 0,
  },
  textarea: {
    width: '100%',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontSize: 14,
    lineHeight: 1.5,
    padding: '10px 14px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    minHeight: 80,
  },
  submitBtn: {
    height: 44,
    borderRadius: 10,
    border: 'none',
    background: '#2979FF',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },
  stateBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  thinkingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  spinner: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2.5px solid rgba(41,121,255,0.2)',
    borderTopColor: '#2979FF',
    animation: 'agentSpin 0.9s linear infinite',
    flexShrink: 0,
  },
  thinkingLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  thinkingNote: {
    fontSize: 12.5,
    color: 'var(--text-muted)',
    lineHeight: 1.55,
    margin: 0,
  },
  successBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#10B981',
    background: 'rgba(16,185,129,0.10)',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 6,
    padding: '4px 10px',
    alignSelf: 'flex-start' as const,
  },
  responseBody: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text)',
    background: 'var(--surface-2)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '12px 16px',
    maxHeight: 320,
    overflowY: 'auto' as const,
  },
  resetBtn: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    alignSelf: 'flex-start' as const,
  },
  errorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    fontWeight: 600,
    color: '#EF4444',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 6,
    padding: '6px 12px',
  },
  coppaBox: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    background: 'rgba(245,158,11,0.07)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: 10,
    padding: '14px 16px',
  },
  coppaTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#F59E0B',
    marginBottom: 6,
  },
  coppaText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    margin: 0,
  },
}
