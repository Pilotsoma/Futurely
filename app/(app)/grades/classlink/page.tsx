'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

type Step = 'pick-district' | 'credentials' | 'connecting' | 'success' | 'error'

interface District {
  id: string
  name: string
  state: string
}

export default function ClasslinkConnectPage() {
  const [districts, setDistricts] = useState<District[]>([])
  const [search, setSearch] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<Step>('pick-district')
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState<{ districtName: string; schoology: boolean; infiniteCampus: boolean } | null>(null)

  useEffect(() => {
    api.classlinkDistricts()
      .then(d => setDistricts(d.districts))
      .catch(() => {})
  }, [])

  const filtered = districts.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.state.toLowerCase().includes(search.toLowerCase()) ||
    d.id.toLowerCase().includes(search.toLowerCase())
  )

  async function handleConnect() {
    if (!selectedDistrict || !username.trim() || !password) {
      setErrorMsg('Please fill in all fields.')
      setStep('error')
      return
    }
    setStep('connecting')
    setErrorMsg('')
    try {
      const res = await api.classlinkConnect(selectedDistrict.id, username.trim(), password)
      setResult({ districtName: res.districtName, schoology: res.schoology, infiniteCampus: res.infiniteCampus })
      setPassword('')
      setStep('success')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Connection failed. Check your credentials and try again.')
      setPassword('')
      setStep('error')
    }
  }

  return (
    <div className="fade-up" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={S.title}>Connect ClassLink</h1>
        <p style={S.subtitle}>
          Log in with your school&apos;s ClassLink account to pull Schoology grades and Infinite Campus data.
        </p>
      </div>

      {/* ── Step 1: Pick district ── */}
      {(step === 'pick-district' || step === 'credentials' || step === 'error') && !selectedDistrict && (
        <div style={S.section}>
          <label style={S.label}>Search for your district</label>
          <input
            style={S.input}
            placeholder="Type district name or state..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search.length > 0 && (
            <div style={S.districtList}>
              {filtered.length === 0 && (
                <div style={S.emptyState}>No districts found for &quot;{search}&quot;</div>
              )}
              {filtered.map(d => (
                <button
                  key={d.id}
                  style={S.districtRow}
                  onClick={() => { setSelectedDistrict(d); setSearch(''); setStep('credentials') }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={S.districtName}>{d.name}</div>
                    <div style={S.districtMeta}>{d.state} · ID: {d.id}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
          {search.length === 0 && (
            <div style={S.districtList}>
              {districts.map(d => (
                <button
                  key={d.id}
                  style={S.districtRow}
                  onClick={() => { setSelectedDistrict(d); setStep('credentials') }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={S.districtName}>{d.name}</div>
                    <div style={S.districtMeta}>{d.state}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Credentials ── */}
      {selectedDistrict && (step === 'credentials' || step === 'error') && (
        <div>
          {/* Selected district chip */}
          <div style={S.selectedChip}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedDistrict.name}</span>
            <button
              style={S.changeBtn}
              onClick={() => { setSelectedDistrict(null); setStep('pick-district'); setErrorMsg('') }}
            >
              Change
            </button>
          </div>

          <div style={S.section}>
            <div style={S.fieldGroup}>
              <label style={S.label}>ClassLink username</label>
              <input
                style={S.input}
                placeholder="Your school username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoCapitalize="none"
                autoComplete="username"
              />
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Password</label>
              <div style={S.passwordRow}>
                <input
                  style={{ ...S.input, flex: 1, marginBottom: 0 }}
                  placeholder="Your school password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={e => { if (e.key === 'Enter') void handleConnect() }}
                />
                <button
                  style={S.eyeBtn}
                  onClick={() => setShowPassword(v => !v)}
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {step === 'error' && errorMsg && (
              <div style={S.errorBanner}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errorMsg}
              </div>
            )}

            <div style={S.disclaimer}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Your credentials are used only to connect to your school portal. Your password is encrypted and never stored in plaintext.</span>
            </div>

            <button style={S.connectBtn} onClick={() => void handleConnect()}>
              Connect to {selectedDistrict.name.split(' ').slice(0, 3).join(' ')}
            </button>
          </div>
        </div>
      )}

      {/* ── Connecting spinner ── */}
      {step === 'connecting' && (
        <div style={S.centerState}>
          <div style={S.spinner} />
          <div style={S.spinnerLabel}>Connecting to ClassLink...</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>This may take up to 20 seconds</div>
        </div>
      )}

      {/* ── Success ── */}
      {step === 'success' && result && (
        <div style={S.successCard}>
          <div style={S.successIcon}>✓</div>
          <div style={S.successTitle}>Connected to {result.districtName}</div>
          <div style={S.successBody}>
            Your ClassLink session is active. Available data sources:
          </div>
          <div style={S.pillRow}>
            {result.schoology && <span style={{ ...S.pill, ...S.pillGreen }}>Schoology Grades</span>}
            {result.infiniteCampus && <span style={{ ...S.pill, ...S.pillBlue }}>Infinite Campus</span>}
            {!result.schoology && !result.infiniteCampus && (
              <span style={{ ...S.pill, color: 'var(--text-muted)' }}>No data sources enabled for this district</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {result.schoology && (
              <a href="/grades/classlink/schoology" style={S.actionBtn}>View Schoology Grades</a>
            )}
            {result.infiniteCampus && (
              <a href="/grades/classlink/ic" style={S.actionBtnSecondary}>Infinite Campus</a>
            )}
          </div>
          <button
            style={{ ...S.actionBtnSecondary, marginTop: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)' }}
            onClick={() => { setSelectedDistrict(null); setStep('pick-district'); setResult(null); setUsername('') }}
          >
            Connect a different district
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fade-up 0.25s ease; }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:      { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 8px' },
  subtitle:   { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 },
  section:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 20px 24px', marginBottom: 16 },
  label:      { display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 },
  input:      { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2, var(--background))', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', marginBottom: 16, outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  districtList: { display: 'flex', flexDirection: 'column' as const, gap: 4, maxHeight: 340, overflowY: 'auto' as const, marginTop: 4 },
  districtRow:  { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 9, border: 'none', background: 'none', cursor: 'pointer', width: '100%', transition: 'background 0.15s', color: 'var(--text)' },
  districtName: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  districtMeta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  emptyState:   { fontSize: 13, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' as const },
  selectedChip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--primary-dim, rgba(99,102,241,0.1))', border: '1px solid var(--primary)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 },
  changeBtn:    { fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  fieldGroup:   { marginBottom: 4 },
  passwordRow:  { display: 'flex', gap: 8, alignItems: 'center' },
  eyeBtn:       { flexShrink: 0, background: 'var(--surface-2, var(--background))', border: '1px solid var(--border)', borderRadius: 9, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' },
  errorBanner:  { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 13px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: 13, fontWeight: 500, lineHeight: 1.5, marginBottom: 14 },
  disclaimer:   { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '11px 13px', borderRadius: 9, background: 'var(--surface-2, rgba(0,0,0,0.04))', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 },
  connectBtn:   { width: '100%', padding: '13px 0', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  centerState:  { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '48px 0' },
  spinner:      { width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 },
  spinnerLabel: { fontSize: 15, fontWeight: 600, color: 'var(--text)' },
  successCard:  { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 24px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', textAlign: 'center' as const },
  successIcon:  { width: 52, height: 52, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid #22C55E', color: '#22C55E', fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 },
  successBody:  { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 340, marginBottom: 16 },
  pillRow:      { display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' },
  pill:         { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 99 },
  pillGreen:    { background: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  pillBlue:     { background: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  actionBtn:    { display: 'inline-block', padding: '11px 18px', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' },
  actionBtnSecondary: { display: 'inline-block', padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' },
}
