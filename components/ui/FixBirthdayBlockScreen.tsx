'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { api, ApiError } from '@/lib/api'

interface FixBirthdayBlockScreenProps {
  onLogout: () => void
  // Called on successful verification, in addition to navigating to
  // /dashboard. The parent app layout (app/(app)/layout.tsx) renders this
  // component as an in-place overlay driven by its own accountStatus state,
  // set once when the layout mounts and never re-checked afterward — a
  // client-side router.push() to a route the layout is already showing
  // doesn't remount it or re-run its auth check, so without this callback
  // the overlay would keep rendering forever even after the account is
  // unlocked. Optional because the standalone /account/fix-birthday page
  // doesn't render inside that layout and doesn't need it.
  onVerified?: () => void
  // Whether the school has ever synced a DOB for this account. When false
  // (most commonly a brand-new OAuth signup that hasn't connected a school
  // portal yet), there's nothing to have actually mismatched — this is a
  // first-time DOB entry, not a correction, and the copy below reflects
  // that rather than implying an error was detected.
  hasSchoolRecord: boolean
}

type SubmitState = 'idle' | 'submitting' | 'success'

interface UserMessage {
  text: string
  type: 'error' | 'info' | 'success'
}

export default function FixBirthdayBlockScreen({ onLogout, onVerified, hasSchoolRecord }: FixBirthdayBlockScreenProps) {
  const router = useRouter()
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<UserMessage | null>(null)
  const [inputFocused, setInputFocused] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!dateOfBirth) return
    setSubmitState('submitting')
    setMessage(null)

    try {
      await api.updateDob(dateOfBirth)
      // 200 success — DOB matched, account is now ACTIVE
      setSubmitState('success')
      setMessage({
        text: hasSchoolRecord
          ? 'Your birthday has been verified. Taking you to the app...'
          : "Thanks! Taking you to the app — we'll double check this against your school's records once you connect a school portal.",
        type: 'success',
      })
      setTimeout(() => {
        onVerified?.()
        router.push('/dashboard')
      }, 1500)
    } catch (err) {
      setSubmitState('idle')

      if (!(err instanceof ApiError)) {
        setMessage({ text: 'Something went wrong. Please try again.', type: 'error' })
        return
      }

      const code = err.code

      if (code === 'ACCOUNT_BANNED') {
        // This correction attempt revealed the student is actually under 13 — ban issued
        router.push('/account/access-restricted')
        return
      }

      if (code === 'NO_CORRECTION_NEEDED') {
        onVerified?.()
        router.push('/dashboard')
        return
      }

      if (code === 'DOB_STILL_MISMATCHED') {
        setMessage({ text: err.message ?? "That birthday still doesn't match what your school has on file. Please try again.", type: 'error' })
        return
      }

      if (code === 'CORRECTION_ATTEMPTS_EXHAUSTED') {
        setMessage({
          text: "You've used all available correction attempts. Please contact support@myfuturely.com so we can help resolve this.",
          type: 'error',
        })
        return
      }

      if (code === 'COPPA_AGE_GATE') {
        setMessage({
          text: 'Based on the birthday you entered, you must be at least 13 to use Futurely.',
          type: 'error',
        })
        return
      }

      if (code === 'TOO_MANY_REQUESTS') {
        setMessage({ text: 'Too many attempts. Please wait a few minutes before trying again.', type: 'error' })
        return
      }

      if (code === 'VALIDATION_ERROR') {
        setMessage({ text: 'Please enter a valid birthday in the correct format.', type: 'error' })
        return
      }

      setMessage({ text: err.message ?? 'Something went wrong. Please try again.', type: 'error' })
    }
  }

  return (
    <div style={S.card}>
      <div style={S.logoRow}>
        <Image src="/logo.png" alt="myFuturely" width={40} height={40} style={{ objectFit: 'contain' }} />
        <span style={S.logoText}>myFuturely</span>
      </div>

      <h1 style={S.heading}>{hasSchoolRecord ? "Let’s verify your birthday" : "What’s your birthday?"}</h1>
      <p style={S.body}>
        {hasSchoolRecord
          ? "The birthday in your account doesn’t match what your school has on file. Please enter your correct birthday so we can confirm it matches your school record."
          : "You must be at least 13 to use Futurely. If you connect a school portal later, we’ll automatically double check this against your school’s records."}
      </p>

      <form onSubmit={e => void handleSubmit(e)} style={S.form}>
        <label htmlFor="dob-input" style={S.label}>
          Your birthday
        </label>
        <input
          id="dob-input"
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          max={todayStr}
          required
          disabled={submitState === 'submitting' || submitState === 'success'}
          aria-invalid={message?.type === 'error' ? true : undefined}
          aria-describedby={message ? 'dob-message' : undefined}
          style={{
            ...S.input,
            borderColor: message?.type === 'error'
              ? 'var(--error)'
              : inputFocused
              ? 'var(--primary)'
              : 'var(--border)',
            boxShadow: inputFocused && message?.type !== 'error'
              ? '0 0 0 3px var(--primary-glow)'
              : 'none',
          }}
        />

        {message && (
          <p
            id="dob-message"
            role={message.type === 'error' ? 'alert' : 'status'}
            style={{
              ...S.messageBase,
              color: 'var(--text)',
              borderColor: message.type === 'error'
                ? 'var(--error)'
                : message.type === 'success'
                ? 'var(--success)'
                : 'var(--border)',
              background: message.type === 'error'
                ? 'rgba(239, 68, 68, 0.08)'
                : message.type === 'success'
                ? 'rgba(16, 185, 129, 0.08)'
                : 'transparent',
            }}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitState === 'submitting' || submitState === 'success' || !dateOfBirth}
          style={{
            ...S.btn,
            opacity: submitState === 'submitting' || submitState === 'success' || !dateOfBirth ? 0.5 : 1,
            cursor: submitState === 'submitting' || submitState === 'success' || !dateOfBirth ? 'not-allowed' : 'pointer',
          }}
        >
          {submitState === 'submitting' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', flexShrink: 0 }}
              />
              Verifying&hellip;
            </>
          ) : submitState === 'success' ? 'Verified!' : 'Verify birthday'}
        </button>
      </form>

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
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },
  heading: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 12px',
  },
  body: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.02em',
  },
  input: {
    width: '100%',
    height: 48,
    padding: '0 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  messageBase: {
    fontSize: 13,
    lineHeight: 1.5,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    margin: 0,
  },
  btn: {
    width: '100%',
    height: 48,
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
    padding: '12px 0',
    minHeight: 44,
    textAlign: 'center' as const,
    width: '100%',
    marginTop: 8,
  },
}
