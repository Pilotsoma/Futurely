'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { api, ApiError } from '../../lib/api'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading]             = useState(false)
  const [error, setError]                     = useState<string | null>(null)
  const [success, setSuccess]                 = useState(false)

  // Validate password requirements client-side
  const requirements = [
    { label: 'At least 8 characters',     met: password.length >= 8 },
    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'At least one number',       met: /[0-9]/.test(password) },
  ]
  const allMet = requirements.every(r => r.met)

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push('/login'), 4000)
      return () => clearTimeout(t)
    }
  }, [success, router])

  if (!token) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 44 }}>🔗</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Invalid reset link</p>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          This link is missing a reset token. Please request a new one from the login page.
        </p>
        <button onClick={() => router.push('/login')} style={styles.btn}>
          Back to login
        </button>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Password updated!</p>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Your password has been reset. Redirecting you to login…
        </p>
        <button onClick={() => router.push('/login')} style={styles.btn}>
          Go to login
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!allMet) { setError('Please meet all password requirements.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setIsLoading(true)
    try {
      await api.resetPassword(token!, password)
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_TOKEN') {
        setError('This reset link has expired or already been used. Please request a new one.')
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        Choose a new password for your Futurely account.
      </p>

      <div style={styles.field}>
        <label style={styles.label}>New password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          required
          autoFocus
          style={styles.input}
        />
      </div>

      {/* Live requirements checklist */}
      {password.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {requirements.map(r => (
            <li key={r.label} style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7,
              color: r.met ? 'var(--success)' : 'var(--text-muted)' }}>
              <span style={{ fontSize: 14 }}>{r.met ? '✓' : '○'}</span>
              {r.label}
            </li>
          ))}
        </ul>
      )}

      <div style={styles.field}>
        <label style={styles.label}>Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          required
          style={{
            ...styles.input,
            borderColor: confirmPassword.length > 0 && confirmPassword !== password ? 'var(--error)' : undefined,
          }}
        />
        {confirmPassword.length > 0 && confirmPassword !== password && (
          <span style={{ fontSize: 12, color: 'var(--error)', marginTop: 2 }}>Passwords don&apos;t match</span>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        type="submit"
        disabled={isLoading || !allMet || password !== confirmPassword}
        style={{ ...styles.btn, opacity: isLoading || !allMet || password !== confirmPassword ? 0.5 : 1, marginTop: 4 }}
      >
        {isLoading ? 'Resetting...' : 'Reset my password'}
      </button>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
        <button type="button" onClick={() => router.push('/login')}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
          Back to login
        </button>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ marginBottom: 16 }}>
          <Image src="/logo2.png" alt="Futurely" width={100} height={100} />
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28, textAlign: 'center', fontSize: 14 }}>
          Reset your password
        </p>
        <Suspense fallback={<p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 },
  card:  { width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: '48px 42px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 40px rgba(26,21,14,0.08), 0 2px 10px rgba(26,21,14,0.05)' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  label: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.2px' },
  input: { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px', color: 'var(--text)', height: 46, width: '100%', outline: 'none', boxSizing: 'border-box' as const, fontSize: 14, transition: 'border-color 0.15s' },
  btn:   { background: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: 10, height: 48, fontWeight: 600, fontSize: 15, width: '100%', cursor: 'pointer', marginTop: 4, transition: 'background 0.15s' },
  error: { color: 'var(--error)', fontSize: 13.5, lineHeight: 1.4, margin: 0 },
}
