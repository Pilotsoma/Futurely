'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { api, ApiError } from '../../lib/api'
import { setWebLogin } from '../../lib/authState'
import { SORTED_ISD_LIST, type ISDEntry } from '../../lib/isds'

type Mode = 'login' | 'register-student' | 'register-parent' | 'register-teacher'
type RegisterStep = 'form' | 'otp'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form')

  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName]                       = useState('')

  const [hacUrl, setHacUrl]           = useState('')
  const [hacUsername, setHacUsername] = useState('')
  const [hacPassword, setHacPassword] = useState('')

  const [selectedIsd, setSelectedIsd]     = useState<ISDEntry | null>(null)
  const [isdSearch, setIsdSearch]         = useState('')
  const [isdOpen, setIsdOpen]             = useState(false)
  const [useCustomUrl, setUseCustomUrl]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [error, setError]     = useState<string | null>(null)
  const [hacError, setHacError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep]       = useState<'auth' | 'connecting' | 'syncing'>('auth')
  const [portalDisconnected, setPortalDisconnected] = useState(false)

  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy]       = useState(false)
  const [agreedAge, setAgreedAge]               = useState(false)

  const [institution, setInstitution] = useState('')
  const [applyAsCounselor, setApplyAsCounselor] = useState(false)

  const [showForgot, setShowForgot]       = useState(false)
  const [forgotEmail, setForgotEmail]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError]     = useState<string | null>(null)
  const [forgotSent, setForgotSent]       = useState(false)

  const [otpCode, setOtpCode]       = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError]     = useState<string | null>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsdOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // Handle OAuth redirect back
  useEffect(() => {
    const oauthResult = searchParams.get('oauth')
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(oauthError === 'oauth_cancelled' ? 'Sign-in cancelled.' : 'Sign-in failed. Please try again.')
    }
    if (oauthResult === 'success') {
      router.push('/dashboard')
    }
  }, [searchParams, router])

  const filteredIsds = SORTED_ISD_LIST.filter(isd =>
    isd.hacUrl && (
      isd.name.toLowerCase().includes(isdSearch.toLowerCase()) ||
      isd.state.toLowerCase().includes(isdSearch.toLowerCase())
    )
  )

  function selectIsd(isd: ISDEntry) {
    setSelectedIsd(isd); setHacUrl(isd.hacUrl ?? ''); setUseCustomUrl(false); setIsdSearch(''); setIsdOpen(false)
  }
  function selectOther() {
    setSelectedIsd(null); setHacUrl(''); setUseCustomUrl(true); setIsdSearch(''); setIsdOpen(false)
  }
  function reset() { setError(null); setHacError(null); setPortalDisconnected(false); setRegisterStep('form'); setOtpCode(''); setOtpError(null); setInstitution(''); setApplyAsCounselor(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (mode === 'login') {
      await doRegisterOrLogin()
      return
    }
    // Registration — validate first
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6)          { setError('Password must be at least 6 characters'); return }
    if (mode === 'register-student') {
      if (!hacUsername.trim() || !hacPassword.trim()) { setError('School portal credentials are required'); return }
      if (!hacUrl.trim()) { setError('Please select your school district'); return }
    }
    // Send OTP before showing privacy modal
    setOtpLoading(true)
    setOtpError(null)
    try {
      await api.sendOtp(email.trim())
      setOtpCode('')
      setRegisterStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.')
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setOtpError(null)
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpError('Enter the 6-digit code we sent to your email.')
      return
    }
    setAgreedPrivacy(false)
    setAgreedAge(false)
    setShowPrivacyModal(true)
  }

  async function doRegisterOrLogin() {
    setIsLoading(true)
    try {
      let result: { token: string; user: { id: number; name: string | null; role: string } }
      if (mode === 'login') {
        result = await api.login(email, password)
      } else if (mode === 'register-student') {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined)
      } else if (mode === 'register-teacher') {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined, 'TEACHER')
      } else {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined, 'PARENT')
      }
      setWebLogin(result.token)
      localStorage.setItem('ns_user', JSON.stringify(result.user))
      if (mode === 'register-teacher') {
        const requestedRole = applyAsCounselor ? 'COUNSELOR' : 'TEACHER'
        try {
          await api.educatorRequestRole(requestedRole, institution.trim() || 'Not specified')
        } catch {
          // Role request failed (e.g. already submitted) — account was created, redirect anyway
        }
        router.push('/teacher/dashboard')
        return
      }
      if (mode === 'register-student') {
        setStep('connecting')
        try {
          await api.portalLoginHAC(hacUrl.trim(), hacUsername.trim(), hacPassword.trim())
          localStorage.setItem('ns_hac_url', hacUrl.trim())
        } catch (hacErr) {
          setHacError(hacErr instanceof Error ? hacErr.message : 'School portal connection failed')
          await new Promise(r => setTimeout(r, 2000))
        }
      }
      if (mode === 'login' && result.user.role !== 'PARENT') {
        setStep('syncing')
        try {
          const status = await api.portalStatus()
          if (status.connected) await api.portalGrades()
        } catch (syncErr) {
          const msg = syncErr instanceof Error ? syncErr.message : ''
          if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('school')) {
            setPortalDisconnected(true)
            await new Promise(r => setTimeout(r, 2500))
          }
        }
      }
      router.push(result.user.role === 'PARENT' ? '/parent/dashboard' : '/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NAME_TAKEN') {
        setError('That display name is already taken. Please choose a different one.')
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_LOCKED' && err.secondsRemaining) {
        const totalMins = Math.ceil(err.secondsRemaining / 60)
        const hours = Math.floor(totalMins / 60)
        const mins = totalMins % 60
        const timeStr = hours > 0
          ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
          : `${mins}m`
        setError(`Account locked. Too many failed attempts — try again in ${timeStr}.`)
      } else {
        const msg = err instanceof Error ? err.message : (mode === 'login' ? 'Login failed' : 'Registration failed')
        setError(msg)
      }
    } finally { setIsLoading(false); setStep('auth') }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)
    try {
      await api.forgotPassword(forgotEmail.trim())
      setForgotSent(true)
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const btnLabel = otpLoading
    ? 'Sending code...'
    : isLoading
    ? step === 'connecting' ? 'Connecting to school portal...'
    : step === 'syncing'    ? 'Syncing grades...'
    : mode === 'login'      ? 'Logging in...'
    : 'Creating account...'
    : mode === 'login'      ? 'Log In'
    : 'Send verification code'

  const headingText =
    mode === 'login'            ? 'Your academic companion' :
    mode === 'register-parent'  ? 'Create a parent account' :
    mode === 'register-teacher' ? 'Create a teacher account' :
                                  'Create your student account'

  const isdDisplayLabel = useCustomUrl ? 'Other / Not Listed' : selectedIsd ? `${selectedIsd.name} (${selectedIsd.state})` : ''

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={{ marginBottom: 12 }}>
          <Image src="/logo2.png" alt="Futurely" width={120} height={120} />
        </div>
        <p style={styles.subheading}>{headingText}</p>

        {portalDisconnected && (
          <div style={styles.toastWarn}>
            Your school portal session has expired. Reconnect it in Settings after logging in.
          </div>
        )}

        {/* ── OAuth buttons (login + student register only — parent/teacher need extra fields) ── */}
        {(mode === 'login' || mode === 'register-student') && registerStep === 'form' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
            <a href={`${BASE}/api/auth/oauth/google`} style={styles.oauthBtn}>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </a>
<div style={styles.dividerRow}>
              <div style={styles.dividerLine}/>
              <span style={styles.dividerText}>{mode === 'login' ? 'or sign in with email' : 'or use email'}</span>
              <div style={styles.dividerLine}/>
            </div>
          </div>
        )}

        {/* ── OTP verification step ── */}
        {registerStep === 'otp' && (
          <form onSubmit={e => void handleVerifyOtp(e)} style={{ ...styles.form, marginBottom: 8 }}>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📨</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Check your email</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Verification code</label>
              <input
                type="text" inputMode="numeric" maxLength={6} autoFocus
                value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" style={{ ...styles.input, textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: 8 }}
              />
            </div>
            {otpError && <p style={styles.error}>{otpError}</p>}
            <button type="submit" style={styles.btn}>Verify code</button>
            <button type="button" onClick={() => setRegisterStep('form')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textAlign: 'center' as const }}>
              ← Back / change email
            </button>
          </form>
        )}

        {registerStep === 'form' && <form onSubmit={e => void handleSubmit(e)} style={styles.form}>
          {mode !== 'login' && (
            <div style={styles.field}>
              <label style={styles.label}>
                {mode === 'register-parent' || mode === 'register-teacher' ? 'Your Name' : 'Display Name'}{' '}
                {mode === 'register-student' && <span style={{ color: 'var(--text-muted)' }}>(optional)</span>}
              </label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder={mode === 'register-parent' || mode === 'register-teacher' ? 'Jane Smith' : 'Jane Doe'}
                required={mode === 'register-parent' || mode === 'register-teacher'} style={styles.input} />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required style={styles.input} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode !== 'login' ? 'At least 6 characters' : '••••••••'}
              required minLength={mode !== 'login' ? 6 : undefined} style={styles.input} />
          </div>

          {mode !== 'login' && (
            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password" required style={styles.input} />
            </div>
          )}

          {mode === 'register-student' && (
            <>
              <div style={styles.dividerRow}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>required — school portal</span>
                <div style={styles.dividerLine} />
              </div>
              <div style={styles.hacSection}>
                {/* ISD Dropdown */}
                <div style={styles.field}>
                  <label style={styles.label}>School District</label>
                  <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => { setIsdOpen(v => !v); setIsdSearch('') }}
                      style={{ ...styles.input, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', background: 'var(--bg)', color: isdDisplayLabel ? 'var(--text)' : 'var(--text-muted)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isdDisplayLabel || 'Search for your school district...'}
                      </span>
                      <span style={{ fontSize: 12, marginLeft: 8, flexShrink: 0 }}>{isdOpen ? '▲' : '▼'}</span>
                    </button>
                    {isdOpen && (
                      <div style={styles.dropdownPanel}>
                        <div style={{ padding: '8px 8px 4px' }}>
                          <input autoFocus type="text" value={isdSearch} onChange={e => setIsdSearch(e.target.value)}
                            placeholder="Type to search..." style={{ ...styles.input, height: 36, fontSize: 13, padding: '6px 10px' }}
                            onClick={e => e.stopPropagation()} />
                        </div>
                        <div style={styles.dropdownList}>
                          {filteredIsds.length === 0 ? (
                            <div style={styles.dropdownEmpty}>No districts found</div>
                          ) : filteredIsds.map(isd => (
                            <button key={isd.hacUrl ?? isd.name} type="button"
                              style={{ ...styles.dropdownItem, background: selectedIsd?.hacUrl === isd.hacUrl ? 'var(--primary-dim)' : 'transparent', color: selectedIsd?.hacUrl === isd.hacUrl ? 'var(--primary)' : 'var(--text)' }}
                              onClick={() => selectIsd(isd)}>
                              <span style={{ fontWeight: 500 }}>{isd.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{isd.state}</span>
                            </button>
                          ))}
                          <div style={styles.dropdownDivider} />
                          <button type="button"
                            style={{ ...styles.dropdownItem, background: useCustomUrl ? 'var(--primary-dim)' : 'transparent', color: useCustomUrl ? 'var(--primary)' : 'var(--text-secondary)', fontStyle: 'italic' }}
                            onClick={selectOther}>
                            Other / My district is not listed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {useCustomUrl && (
                  <div style={styles.field}>
                    <label style={styles.label}>Portal URL</label>
                    <input type="url" value={hacUrl} onChange={e => setHacUrl(e.target.value)}
                      placeholder="https://homeaccess.yourisd.org/" style={styles.input} required />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter the base URL of your school&apos;s Home Access Center portal.</span>
                  </div>
                )}

                <div style={styles.field}>
                  <label style={styles.label}>HAC Username</label>
                  <input type="text" value={hacUsername} onChange={e => setHacUsername(e.target.value)}
                    placeholder="Your HAC username" autoComplete="username" style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>HAC Password</label>
                  <input type="password" value={hacPassword} onChange={e => setHacPassword(e.target.value)}
                    placeholder="Your HAC password" autoComplete="current-password" style={styles.input} />
                </div>
                <p style={styles.hint}>Your school credentials are never stored — used only to fetch grades.</p>
                {hacError && <p style={styles.hacError}>⚠ {hacError} — you can reconnect later in Settings.</p>}
              </div>
            </>
          )}

          {mode === 'register-teacher' && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>School / Organization</label>
                <input type="text" value={institution} onChange={e => setInstitution(e.target.value)}
                  placeholder="Lincoln High School" required style={styles.input} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <input type="checkbox" checked={applyAsCounselor} onChange={e => setApplyAsCounselor(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                I am applying as a <strong style={{ color: 'var(--text)' }}>counselor</strong> (includes all teacher features + student chat &amp; guidance tools)
              </label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                Your request will be reviewed by an admin before educator features are unlocked. You&apos;ll receive a Teacher tag immediately.
              </p>
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={isLoading} style={{ ...styles.btn, opacity: isLoading ? 0.6 : 1 }}>
            {btnLabel}
          </button>

          {mode === 'login' && (
            <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotError(null); setForgotSent(false) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: 0, marginTop: 2, textAlign: 'center' as const, width: '100%' }}>
              Forgot password?
            </button>
          )}
        </form>}

        {mode === 'login' && (
          <>
            <p style={styles.switchText}>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => { setMode('register-student'); reset() }} style={styles.switchLink}>Create one</button>
            </p>
            <p style={{ ...styles.switchText, marginTop: 4 }}>
              Parent or guardian?{' '}
              <button type="button" onClick={() => { setMode('register-parent'); reset() }} style={styles.switchLink}>Create a parent account</button>
            </p>
            <p style={{ ...styles.switchText, marginTop: 4 }}>
              Teacher or counselor?{' '}
              <button type="button" onClick={() => { setMode('register-teacher'); reset() }} style={styles.switchLink}>Create a teacher account</button>
            </p>
          </>
        )}

        {mode === 'register-student' && (
          <>
            <p style={styles.switchText}>Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); reset() }} style={styles.switchLink}>Log In</button></p>
            <p style={styles.switchText}>Parent or guardian?{' '}<button type="button" onClick={() => { setMode('register-parent'); reset() }} style={styles.switchLink}>Create a parent account instead</button></p>
          </>
        )}

        {mode === 'register-parent' && (
          <p style={styles.switchText}>
            Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); reset() }} style={styles.switchLink}>Log In</button>
            {' · '}<button type="button" onClick={() => { setMode('register-student'); reset() }} style={styles.switchLink}>Student account</button>
          </p>
        )}

        {mode === 'register-teacher' && (
          <p style={styles.switchText}>
            Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); reset() }} style={styles.switchLink}>Log In</button>
            {' · '}<button type="button" onClick={() => { setMode('register-student'); reset() }} style={styles.switchLink}>Student account</button>
          </p>
        )}
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={styles.modalBackdrop} onClick={() => setShowForgot(false)}>
          <div style={{ ...styles.modalCard, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Reset your password</span>
              <button type="button" onClick={() => setShowForgot(false)} style={styles.modalClose}>✕</button>
            </div>
            <div style={{ padding: '28px 28px 32px' }}>
              {forgotSent ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 44 }}>📬</div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Check your email</p>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, maxWidth: 300 }}>
                    A password reset link has been sent to <strong>{forgotEmail}</strong>. Check your spam folder if you don&apos;t see it.
                  </p>
                  <button type="button" onClick={() => setShowForgot(false)} style={{ ...styles.btn, marginTop: 8 }}>
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={e => void handleForgotPassword(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    Enter the email address for your Futurely account and we&apos;ll send you a reset link.
                  </p>
                  <div style={styles.field}>
                    <label style={styles.label}>Email address</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      style={styles.input}
                    />
                  </div>
                  {forgotError && <p style={styles.error}>{forgotError}</p>}
                  <button type="submit" disabled={forgotLoading || !forgotEmail.trim()} style={{ ...styles.btn, marginTop: 0, opacity: forgotLoading || !forgotEmail.trim() ? 0.55 : 1 }}>
                    {forgotLoading ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Policy Modal ── */}
      {showPrivacyModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowPrivacyModal(false)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Privacy Policy</span>
              <button type="button" onClick={() => setShowPrivacyModal(false)} style={styles.modalClose}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.ppMeta}>Effective Date: June 18, 2026 · Futurely, Inc.</p>

              <p style={styles.ppText}>
                Welcome to Futurely. This Privacy Policy explains how we collect, use, and protect
                your information when you use our platform. By creating an account you agree to
                these terms.
              </p>

              <p style={styles.ppSection}>1. Information We Collect</p>
              <p style={styles.ppText}>
                We collect the information you provide when registering (name, email address, and
                password). For students who connect their school portal, we temporarily process
                your Home Access Center credentials solely to fetch your academic data — these
                credentials are <strong>never stored</strong> on our servers. We also collect
                usage data (pages visited, features used) to improve the platform.
              </p>

              <p style={styles.ppSection}>2. How We Use Your Information</p>
              <p style={styles.ppText}>
                Your information is used to operate and personalize the Futurely platform, display
                your grades and academic progress, power AI-assisted features, and communicate
                important account updates. We do <strong>not</strong> use your data for advertising
                or sell it to third parties under any circumstances.
              </p>

              <p style={styles.ppSection}>3. Data Sharing</p>
              <p style={styles.ppText}>
                We do not sell, rent, or share your personal information with third parties except
                as required by law or with your explicit consent. We use industry-standard
                service providers (hosting, infrastructure) who are contractually bound to protect
                your data and may not use it for any other purpose.
              </p>

              <p style={styles.ppSection}>4. Educational Records (FERPA)</p>
              <p style={styles.ppText}>
                Futurely is designed to comply with the Family Educational Rights and Privacy Act
                (FERPA). Academic data fetched from your school portal is used solely to provide
                you with the services you request and is never disclosed to unauthorized parties.
              </p>

              <p style={styles.ppSection}>5. Children&apos;s Privacy (COPPA)</p>
              <p style={styles.ppText}>
                Futurely is intended for users who are <strong>13 years of age or older</strong>.
                We do not knowingly collect personal information from children under 13. If you
                believe a child under 13 has created an account, please contact us and we will
                promptly delete the account and any associated data.
              </p>

              <p style={styles.ppSection}>6. Data Security</p>
              <p style={styles.ppText}>
                We use encryption in transit (HTTPS/TLS) and at rest to protect your data.
                Passwords are hashed using industry-standard algorithms and are never stored in
                plain text. Despite these measures, no system is completely secure — please use a
                strong, unique password for your account.
              </p>

              <p style={styles.ppSection}>7. Your Rights</p>
              <p style={styles.ppText}>
                You may request access to, correction of, or deletion of your personal data at any
                time by visiting Settings → Account or contacting us at{' '}
                <strong>support@futurely.app</strong>. Account deletion permanently removes all
                your data from our systems within 30 days.
              </p>

              <p style={styles.ppSection}>8. Changes to This Policy</p>
              <p style={styles.ppText}>
                We may update this Privacy Policy periodically. We will notify you of material
                changes via email or an in-app notice. Continued use of Futurely after such notice
                constitutes acceptance of the updated policy.
              </p>

              <p style={styles.ppSection}>9. Contact Us</p>
              <p style={styles.ppText}>
                Questions or concerns? Reach us at <strong>support@futurely.app</strong>.
              </p>
            </div>

            <div style={styles.modalFooter}>
              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={e => setAgreedPrivacy(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={styles.checkLabel}>I have read and agree to the Privacy Policy</span>
              </label>
              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={agreedAge}
                  onChange={e => setAgreedAge(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={styles.checkLabel}>I am at least 13 years of age</span>
              </label>
              <button
                type="button"
                disabled={!agreedPrivacy || !agreedAge || isLoading}
                onClick={() => { setShowPrivacyModal(false); void doRegisterOrLogin() }}
                style={{ ...styles.btn, marginTop: 6, opacity: (!agreedPrivacy || !agreedAge || isLoading) ? 0.45 : 1 }}
              >
                {isLoading ? 'Creating account...' : 'Continue & Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page:            { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 },
  card:            { width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: '48px 42px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 8px 40px rgba(26,21,14,0.08), 0 2px 10px rgba(26,21,14,0.05)' },
  heading:         { fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 6 },
  subheading:      { color: 'var(--text-secondary)', marginBottom: 28, textAlign: 'center', fontSize: 14 },
  form:            { width: '100%', display: 'flex', flexDirection: 'column', gap: 14 },
  field:           { display: 'flex', flexDirection: 'column', gap: 6 },
  label:           { fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.2px' },
  input:           { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '12px 14px', color: 'var(--text)', height: 46, width: '100%', outline: 'none', boxSizing: 'border-box' as const, fontSize: 14, transition: 'border-color 0.15s, box-shadow 0.15s' },
  dividerRow:      { display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' },
  dividerLine:     { flex: 1, height: 1, background: 'var(--border)' },
  dividerText:     { fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.7px', fontWeight: 600 },
  hacSection:      { display: 'flex', flexDirection: 'column', gap: 12, padding: 16, background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)' },
  hint:            { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 },
  error:           { color: 'var(--error)', fontSize: 13.5, lineHeight: 1.4 },
  hacError:        { color: 'var(--warning)', fontSize: 12, lineHeight: 1.5 },
  btn:             { background: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: 10, height: 48, fontWeight: 600, fontSize: 15, width: '100%', cursor: 'pointer', marginTop: 4, letterSpacing: '0.1px', transition: 'background 0.15s, box-shadow 0.15s' },
  oauthBtn:        { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: 46, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', transition: 'background 0.15s' },
  testHint:        { marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' as const },
  switchText:      { marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' as const },
  switchLink:      { background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 },
  toastWarn:       { width: '100%', background: 'rgba(154,124,48,0.08)', border: '1px solid rgba(154,124,48,0.25)', borderRadius: 9, padding: '10px 14px', color: 'var(--warning)', fontSize: 13, lineHeight: 1.5, marginBottom: 10, textAlign: 'center' as const },
  dropdownPanel:   { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(26,21,14,0.10)', marginTop: 4, overflow: 'hidden' },
  dropdownList:    { maxHeight: 220, overflowY: 'auto' as const, padding: '4px 8px 8px' },
  dropdownItem:    { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left' as const, transition: 'background 0.1s' },
  dropdownEmpty:   { padding: '12px 10px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' as const },
  dropdownDivider: { height: 1, background: 'var(--border)', margin: '4px 0' },

  modalBackdrop:  { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard:      { width: '100%', maxWidth: 540, maxHeight: '88vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, display: 'flex', flexDirection: 'column' as const, boxShadow: '0 24px 80px rgba(0,0,0,0.35)' },
  modalHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  modalClose:     { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 6 },
  modalBody:      { overflowY: 'auto' as const, padding: '20px 22px', flex: 1 },
  modalFooter:    { padding: '16px 22px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' as const, gap: 12, flexShrink: 0 },
  ppMeta:         { fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 },
  ppSection:      { fontWeight: 700, fontSize: 13, color: 'var(--text)', marginTop: 18, marginBottom: 4 },
  ppText:         { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 },
  checkRow:       { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  checkbox:       { width: 16, height: 16, marginTop: 1, flexShrink: 0, accentColor: 'var(--primary)', cursor: 'pointer' },
  checkLabel:     { fontSize: 13.5, color: 'var(--text)', lineHeight: 1.4 },
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
