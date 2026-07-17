'use client'

import React from 'react'

interface AgentConfirmDialogProps {
  description: string
  onConfirm: () => void
  onDeny: () => void
  loading?: boolean
}

export default function AgentConfirmDialog({
  description,
  onConfirm,
  onDeny,
  loading = false,
}: AgentConfirmDialogProps) {
  return (
    <div style={S.overlay} role="dialog" aria-modal="true" aria-labelledby="acd-title">
      <div style={S.panel}>
        <div style={S.iconRow}>
          <div style={S.icon}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span id="acd-title" style={S.title}>
            AI wants to make a change
          </span>
        </div>

        <p style={S.description}>{description}</p>

        <p style={S.note}>
          Review the action above. Confirming will let the AI proceed; cancelling stops this session.
        </p>

        <div style={S.btnRow}>
          <button
            style={{ ...S.btn, ...S.btnCancel }}
            onClick={onDeny}
            disabled={loading}
            aria-label="Cancel this action"
          >
            Cancel
          </button>
          <button
            style={{ ...S.btn, ...S.btnConfirm, opacity: loading ? 0.6 : 1 }}
            onClick={onConfirm}
            disabled={loading}
            aria-label="Confirm this action"
          >
            {loading ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    background: 'var(--surface)',
    border: '1px solid rgba(245,158,11,0.35)',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
  },
  description: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 120ms ease, transform 120ms ease',
  },
  btnCancel: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)' as unknown as string,
    color: 'var(--text-secondary)',
  },
  btnConfirm: {
    background: '#2979FF',
    color: '#fff',
  },
}
