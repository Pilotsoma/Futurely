'use client'

import React from 'react'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { InboxIcon, ArrowLeftIcon, WarningIcon, XMarkIcon, MailboxIcon } from '@/components/icons'
import { LEGAL_EFFECTIVE_DATE, TOS_INTRO, TOS_SECTIONS, PRIVACY_INTRO, PRIVACY_SECTIONS } from '@/lib/legalText'
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
  const [agreedTos, setAgreedTos]               = useState(false)
  const [agreedAge, setAgreedAge]               = useState(false)
  const [pendingOAuthNew, setPendingOAuthNew]   = useState(false)

  const [institution, setInstitution] = useState('')
  const [applyAsCounselor, setApplyAsCounselor] = useState(false)

  const [schoolQuery, setSchoolQuery]       = useState('')
  const [schoolResults, setSchoolResults]   = useState<Array<{ name: string; city: string; state: string }>>([])
  const [schoolOpen, setSchoolOpen]         = useState(false)
  const [schoolLoading, setSchoolLoading]   = useState(false)
  const schoolRef = useRef<HTMLDivElement>(null)

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
      if (schoolRef.current && !schoolRef.current.contains(e.target as Node)) {
        setSchoolOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  // Debounced school search
  useEffect(() => {
    if (schoolQuery.length < 2) { setSchoolResults([]); setSchoolOpen(false); return }
    const timer = setTimeout(async () => {
      setSchoolLoading(true)
      try {
        const results = await api.searchSchools(schoolQuery)
        setSchoolResults(results)
        setSchoolOpen(true)
      } catch { setSchoolResults([]) }
      finally { setSchoolLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [schoolQuery])

  // Handle OAuth redirect back
  useEffect(() => {
    const oauthResult = searchParams.get('oauth')
    const oauthError = searchParams.get('error')
    if (oauthError) {
      setError(oauthError === 'oauth_cancelled' ? 'Sign-in cancelled.' : 'Sign-in failed. Please try again.')
    }
    if (oauthResult === 'success') {
      // Seed ns_user from authMe so the app layout has the role immediately on first load.
      api.authMe().then(u => {
        if (u) localStorage.setItem('ns_user', JSON.stringify(u))
      }).catch(() => {})
      router.push('/dashboard')
    }
    if (oauthResult === 'new') {
      // New account created via OAuth — must agree to ToS before entering the app
      api.authMe().then(u => {
        if (u) localStorage.setItem('ns_user', JSON.stringify(u))
      }).catch(() => {})
      setAgreedPrivacy(false)
      setAgreedTos(false)
      setAgreedAge(false)
      setPendingOAuthNew(true)
      setShowPrivacyModal(true)
    }
  }, [searchParams, router])

  const filteredIsds = SORTED_ISD_LIST.filter(isd =>
    (isd.hacUrl || isd.classlinkId) && (
      isd.name.toLowerCase().includes(isdSearch.toLowerCase()) ||
      isd.state.toLowerCase().includes(isdSearch.toLowerCase())
    )
  )

  // True when the selected district uses ClassLink instead of HAC
  const isClasslinkDistrict = !!(selectedIsd?.classlinkId && !selectedIsd?.hacUrl)

  function selectIsd(isd: ISDEntry) {
    setSelectedIsd(isd); setHacUrl(isd.hacUrl ?? ''); setUseCustomUrl(false); setIsdSearch(''); setIsdOpen(false)
  }
  function selectOther() {
    setSelectedIsd(null); setHacUrl(''); setUseCustomUrl(true); setIsdSearch(''); setIsdOpen(false)
  }
  function reset() { setError(null); setHacError(null); setPortalDisconnected(false); setRegisterStep('form'); setOtpCode(''); setOtpError(null); setSchoolQuery(''); setSchoolResults([]); setSchoolOpen(false) }
  function fullReset() { reset(); setInstitution(''); setApplyAsCounselor(false) }

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
      if (!isClasslinkDistrict && !hacUrl.trim() && !useCustomUrl) { setError('Please select your school district'); return }
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
    setAgreedTos(false)
    setAgreedAge(false)
    setShowPrivacyModal(true)
  }

  async function doRegisterOrLogin() {
    setIsLoading(true)
    try {
      let result: { user: { id: number; name: string | null; role: string } }
      if (mode === 'login') {
        result = await api.login(email, password)
      } else if (mode === 'register-student') {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined, undefined, agreedTos, agreedPrivacy, agreedAge)
      } else if (mode === 'register-teacher') {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined, 'TEACHER', agreedTos, agreedPrivacy, agreedAge)
      } else {
        result = await api.register(email, password, otpCode.trim(), name.trim() || undefined, 'PARENT', agreedTos, agreedPrivacy, agreedAge)
      }
      setWebLogin()
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
          if (isClasslinkDistrict && selectedIsd?.classlinkId) {
            await api.classlinkConnect(selectedIsd.classlinkId, hacUsername.trim(), hacPassword.trim())
          } else {
            await api.portalLoginHAC(hacUrl.trim(), hacUsername.trim(), hacPassword.trim())
            localStorage.setItem('ns_hac_url', hacUrl.trim())
          }
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
      const role = result.user.role
      if (role === 'PARENT') router.push('/parent/dashboard')
      else if (role === 'TEACHER') router.push('/teacher/dashboard')
      else if (role === 'COUNSELOR') router.push('/counselor/dashboard')
      else router.push('/dashboard')
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
        {/* Logo — icon + live text wordmark (logo2.png has "Futurely" baked into the pixels) */}
        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Image src="/logo.png" alt="" width={64} height={64} style={{ objectFit: 'contain' }} />
          <span style={{
            fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px',
            backgroundImage: 'linear-gradient(90deg, #22d3ee 0%, var(--primary) 45%, var(--purple) 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}>myFuturely</span>
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
              <div style={{ marginBottom: 8 }}><InboxIcon size={36}/></div>
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
              <ArrowLeftIcon size={13}/> Back / change email
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

                {useCustomUrl && !isClasslinkDistrict && (
                  <div style={styles.field}>
                    <label style={styles.label}>Portal URL</label>
                    <input type="url" value={hacUrl} onChange={e => setHacUrl(e.target.value)}
                      placeholder="https://homeaccess.yourisd.org/" style={styles.input} required />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter the base URL of your school&apos;s Home Access Center portal.</span>
                  </div>
                )}

                <div style={styles.field}>
                  <label style={styles.label}>{isClasslinkDistrict ? 'ClassLink Username' : 'HAC Username'}</label>
                  <input type="text" value={hacUsername} onChange={e => setHacUsername(e.target.value)}
                    placeholder={isClasslinkDistrict ? 'Your ClassLink username' : 'Your HAC username'} autoComplete="username" style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{isClasslinkDistrict ? 'ClassLink Password' : 'HAC Password'}</label>
                  <input type="password" value={hacPassword} onChange={e => setHacPassword(e.target.value)}
                    placeholder={isClasslinkDistrict ? 'Your ClassLink password' : 'Your HAC password'} autoComplete="current-password" style={styles.input} />
                </div>
                <p style={styles.hint}>Your school credentials are never stored — used only to fetch grades.</p>
                {hacError && <p style={{...styles.hacError, display: 'flex', alignItems: 'center', gap: 4}}><WarningIcon size={13}/> {hacError} — you can reconnect later in Settings.</p>}
              </div>
            </>
          )}

          {mode === 'register-teacher' && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>School / Organization</label>
                <div ref={schoolRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={schoolQuery || institution}
                    onChange={e => { setSchoolQuery(e.target.value); setInstitution(e.target.value) }}
                    onFocus={() => { if (schoolResults.length > 0) setSchoolOpen(true) }}
                    placeholder="Start typing your school name..."
                    autoComplete="off"
                    style={styles.input}
                  />
                  {schoolLoading && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>searching…</span>
                  )}
                  {schoolOpen && schoolResults.length > 0 && (
                    <div style={styles.dropdownPanel}>
                      <div style={styles.dropdownList}>
                        {schoolResults.map(s => (
                          <button
                            key={`${s.name}-${s.city}-${s.state}`}
                            type="button"
                            style={{ ...styles.dropdownItem, background: institution === s.name ? 'var(--primary-dim)' : 'transparent', color: institution === s.name ? 'var(--primary)' : 'var(--text)' }}
                            onClick={() => { setInstitution(s.name); setSchoolQuery(''); setSchoolOpen(false) }}
                          >
                            <span style={{ fontWeight: 500 }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{s.city}{s.city && s.state ? ', ' : ''}{s.state}</span>
                          </button>
                        ))}
                        <div style={styles.dropdownDivider} />
                        <button
                          type="button"
                          style={{ ...styles.dropdownItem, color: 'var(--text-secondary)', fontStyle: 'italic' }}
                          onClick={() => { setSchoolOpen(false) }}
                        >
                          Not listed — keep what I typed
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
              <button type="button" onClick={() => { setMode('register-student'); fullReset() }} style={styles.switchLink}>Create one</button>
            </p>
            <p style={{ ...styles.switchText, marginTop: 4 }}>
              Parent or guardian?{' '}
              <button type="button" onClick={() => { setMode('register-parent'); fullReset() }} style={styles.switchLink}>Create a parent account</button>
            </p>
            <p style={{ ...styles.switchText, marginTop: 4 }}>
              Teacher or counselor?{' '}
              <button type="button" onClick={() => { setMode('register-teacher'); fullReset() }} style={styles.switchLink}>Create a teacher account</button>
            </p>
          </>
        )}

        {mode === 'register-student' && (
          <>
            <p style={styles.switchText}>Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); fullReset() }} style={styles.switchLink}>Log In</button></p>
            <p style={styles.switchText}>Parent or guardian?{' '}<button type="button" onClick={() => { setMode('register-parent'); fullReset() }} style={styles.switchLink}>Create a parent account instead</button></p>
          </>
        )}

        {mode === 'register-parent' && (
          <p style={styles.switchText}>
            Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); fullReset() }} style={styles.switchLink}>Log In</button>
            {' · '}<button type="button" onClick={() => { setMode('register-student'); fullReset() }} style={styles.switchLink}>Student account</button>
          </p>
        )}

        {mode === 'register-teacher' && (
          <p style={styles.switchText}>
            Already have an account?{' '}<button type="button" onClick={() => { setMode('login'); fullReset() }} style={styles.switchLink}>Log In</button>
            {' · '}<button type="button" onClick={() => { setMode('register-student'); fullReset() }} style={styles.switchLink}>Student account</button>
          </p>
        )}
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={styles.modalBackdrop} onClick={() => setShowForgot(false)}>
          <div style={{ ...styles.modalCard, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Reset your password</span>
              <button type="button" onClick={() => setShowForgot(false)} style={styles.modalClose}><XMarkIcon size={16}/></button>
            </div>
            <div style={{ padding: '28px 28px 32px' }}>
              {forgotSent ? (
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div><MailboxIcon size={44}/></div>
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
                    Enter the email address for your myFuturely account and we&apos;ll send you a reset link.
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

      {/* ── Terms of Service & Privacy Policy Modal ── */}
      {showPrivacyModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowPrivacyModal(false)}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Terms of Service &amp; Privacy Policy</span>
              <button type="button" onClick={() => setShowPrivacyModal(false)} style={styles.modalClose}><XMarkIcon size={16}/></button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.ppMeta}>{LEGAL_EFFECTIVE_DATE}</p>

              {/* ── Terms of Service ── */}
              <p style={{ ...styles.ppSection, marginTop: 0, fontSize: 14 }}>Terms of Service</p>
              <p style={styles.ppText}>{TOS_INTRO}</p>
              {TOS_SECTIONS.map((section) => (
                <React.Fragment key={section.heading}>
                  <p style={styles.ppSection}>{section.heading}</p>
                  <p style={styles.ppText}>{section.body}</p>
                </React.Fragment>
              ))}

              {/* ── Privacy Policy ── */}
              <p style={{ ...styles.ppSection, marginTop: 28, fontSize: 14 }}>Privacy Policy</p>
              <p style={styles.ppText}>{PRIVACY_INTRO}</p>
              {PRIVACY_SECTIONS.map((section) => (
                <React.Fragment key={section.heading}>
                  <p style={styles.ppSection}>{section.heading}</p>
                  <p style={styles.ppText}>{section.body}</p>
                </React.Fragment>
              ))}
            </div>

            <div style={styles.modalFooter}>
              <label style={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={agreedTos}
                  onChange={e => setAgreedTos(e.target.checked)}
                  style={styles.checkbox}
                />
                <span style={styles.checkLabel}>I have read and agree to the Terms of Service</span>
              </label>
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
              {error && <p style={styles.error}>{error}</p>}

              <button
                type="button"
                disabled={!agreedTos || !agreedPrivacy || !agreedAge || isLoading}
                onClick={() => {
                  if (pendingOAuthNew) {
                    setIsLoading(true)
                    setError(null)
                    void (async () => {
                      try {
                        await api.submitConsent()
                        setShowPrivacyModal(false)
                        router.push('/dashboard')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to save consent. Please try again.')
                      } finally {
                        setIsLoading(false)
                      }
                    })()
                  } else {
                    setError(null)
                    void doRegisterOrLogin()
                  }
                }}
                style={{ ...styles.btn, marginTop: 6, opacity: (!agreedTos || !agreedPrivacy || !agreedAge || isLoading) ? 0.45 : 1 }}
              >
                {isLoading ? 'Creating account...' : pendingOAuthNew ? 'Continue to myFuturely' : 'Continue & Create Account'}
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
