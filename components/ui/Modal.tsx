'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@/components/icons'

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  closeLabel?: string
}

export default function Modal({ onClose, children, maxWidth = 380, closeLabel = 'Close' }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  return createPortal(
    <div style={S.overlay} onClick={onClose}>
      <div
        ref={cardRef}
        style={{ ...S.card, maxWidth }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <button onClick={onClose} className="ns-modal-close" style={S.close} aria-label={closeLabel}>
          <XMarkIcon size={16} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000, padding: 20,
  },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
    padding: 28, width: '100%', position: 'relative', boxShadow: 'var(--shadow-xl)',
  },
  close: {
    position: 'absolute', top: 12, right: 12, background: 'none', border: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', padding: 6, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
}
