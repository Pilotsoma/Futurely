'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type StudentData, type CanvasStatus } from '../../../lib/api'
import { clearWebAuth } from '../../../lib/authState'
import { SORTED_ISD_LIST, isCollegeIsd } from '../../../lib/isds'
import { CHANGELOG } from '../../../lib/changelog'

function DeleteAccountModal({ onClose, hasPassword }: { onClose: () => void; hasPassword: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (confirm !== 'DELETE') { setError('Type DELETE to confirm'); return }
    if (hasPassword && !password) { setError('Password required'); return }
    setLoading(true); setError(null)
    try {
      await api.deleteAccount(hasPassword ? password : undefined)
      clearWebAuth()
      localStorage.removeItem('ns_user')
      router.push('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 28, width: '90%', maxWidth: 400 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--error)', marginBottom: 8 }}>Delete Account</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
          This permanently deletes your account, posts, grades, and all data. There is no undo — the only way to get access back is to create a new account.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasPassword && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Current Password</label>
              <input type="password" className="ns-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Type <strong>DELETE</strong> to confirm</label>
            <input type="text" className="ns-input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="ns-btn-ghost" style={{ flex: 1, height: 44 }} onClick={onClose} disabled={loading}>Cancel</button>
            <button
              style={{ flex: 1, height: 44, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function parseHacName(raw: string | null | undefined): string {
  if (!raw) return ''
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
  if (raw.includes(',')) {
    const [rawLast, rawRest = ''] = raw.split(',')
    const first = cap(rawRest.trim().split(' ')[0])
    const last = cap(rawLast.trim())
    return `${first} ${last}`.trim()
  }
  return raw
}

function initials(name: string | null) {
  if (!name) return 'S'
  const parsed = parseHacName(name)
  const parts = parsed.trim().split(' ').filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parsed.slice(0, 2).toUpperCase()
}

type SystemType = 'HAC' | 'PowerSchool'
interface PortalStatus { connected: boolean; systemType: string | null; districtUrl: string | null; sessionExpiresIn: number; lastSynced: string | null }

const DEFAULT_GRADE_COLORS = { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' }

export default function SettingsPage() {
  const router = useRouter()
  const [theme, setTheme]                   = useState<'dark' | 'light'>('dark')
  const [reduceMotion, setReduceMotion]     = useState(false)

  const [gradeColors, setGradeColors]       = useState<Record<string, string>>(DEFAULT_GRADE_COLORS)
  const [data, setData]                     = useState<StudentData | null>(null)
  const [portalStatus, setPortalStatus]     = useState<PortalStatus | null>(null)
  const [portalLoading, setPortalLoading]   = useState(true)
  const [portalSystem, setPortalSystem]     = useState<SystemType>('HAC')
  const [portalUrl, setPortalUrl]           = useState('')
  const [portalUsername, setPortalUsername] = useState('')
  const [portalPassword, setPortalPassword] = useState('')
  const [portalConnecting, setPortalConnecting] = useState(false)
  const [portalError, setPortalError]       = useState<string | null>(null)
  const [portalIsdSearch, setPortalIsdSearch]   = useState('')
  const [portalIsdOpen, setPortalIsdOpen]       = useState(false)
  const [portalSelectedIsd, setPortalSelectedIsd] = useState<(typeof SORTED_ISD_LIST)[0] | null>(null)
  const [portalCustomUrl, setPortalCustomUrl]   = useState(false)
  const portalIsdRef = useRef<HTMLDivElement>(null)
  const [syncing, setSyncing]             = useState(false)
  const [syncMsg, setSyncMsg]             = useState<string | null>(null)

  // Editable academic fields
  const [satScore, setSatScore]         = useState('')
  const [actScore, setActScore]         = useState('')
  const [futurePlan, setFuturePlan]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [saveMsg, setSaveMsg]           = useState<string | null>(null)
  const [dirty, setDirty]               = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [avatarUrl, setAvatarUrl]             = useState('')

  // Canvas state
  const [canvasStatus, setCanvasStatus]       = useState<CanvasStatus | null>(null)
  const [canvasLoading, setCanvasLoading]     = useState(false)
  const [showCanvasForm, setShowCanvasForm]   = useState(false)
  const [canvasUrl, setCanvasUrl]             = useState('')
  const [canvasToken, setCanvasToken]         = useState('')
  const [canvasError, setCanvasError]         = useState<string | null>(null)
  const [districtSearch, setDistrictSearch]   = useState('')
  const [districtOpen, setDistrictOpen]       = useState(false)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const districtRef = useRef<HTMLDivElement>(null)
  const [avatarSaving, setAvatarSaving]       = useState(false)
  const [avatarMsg, setAvatarMsg]             = useState<string | null>(null)
  const [showChangelog, setShowChangelog]     = useState(false)
  const [hideGpa, setHideGpa]                 = useState(false)
  const [devStats, setDevStats]               = useState<{ totalUsers: number; activeUsers: number; liveUsers: number } | null>(null)
  const [devStatsLoading, setDevStatsLoading] = useState(false)

  async function handleSaveAvatar() {
    setAvatarSaving(true); setAvatarMsg(null)
    try {
      await api.updateAvatarUrl(avatarUrl.trim() || null)
      setAvatarMsg('Saved!')
    } catch {
      setAvatarMsg('Failed to save')
    } finally {
      setAvatarSaving(false)
      setTimeout(() => setAvatarMsg(null), 2000)
    }
  }

  useEffect(() => {
    setTheme((localStorage.getItem('ns_theme') as 'dark' | 'light') || 'dark')
    setHideGpa(localStorage.getItem('ns_hide_gpa') === '1')
    setReduceMotion(localStorage.getItem('rm') === '1')
    try {
      const saved = localStorage.getItem('ns_grade_colors_v2')
      if (saved) {
        const colors = JSON.parse(saved) as Record<string, string>
        setGradeColors(colors)
        applyGradeColors(colors)
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyGradeColors(colors: Record<string, string>) {
    const root = document.documentElement
    root.style.setProperty('--gc-a', colors.A)
    root.style.setProperty('--gc-b', colors.B)
    root.style.setProperty('--gc-c', colors.C)
    root.style.setProperty('--gc-d', colors.D)
    root.style.setProperty('--gc-f', colors.F)
  }

  function handleGradeColorChange(grade: string, color: string) {
    const next = { ...gradeColors, [grade]: color }
    setGradeColors(next)
    localStorage.setItem('ns_grade_colors_v2', JSON.stringify(next))
    applyGradeColors(next)
  }

  function handleResetGradeColors() {
    setGradeColors(DEFAULT_GRADE_COLORS)
    localStorage.removeItem('ns_grade_colors_v2')
    applyGradeColors(DEFAULT_GRADE_COLORS)
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('ns_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isDefaultGradeColors = Object.entries(gradeColors).every(
    ([g, c]) => c === DEFAULT_GRADE_COLORS[g as keyof typeof DEFAULT_GRADE_COLORS]
  )

  useEffect(() => {
    api.me().then(d => {
      setData(d)
      setSatScore(d.profile?.satScore?.toString() ?? '')
      setActScore(d.profile?.actScore?.toString() ?? '')
      setFuturePlan(d.profile?.futureDecision ?? '')
      if (d.role === 'DEV' || d.role === 'ADMIN') {
        setDevStatsLoading(true)
        api.adminStats().then(setDevStats).catch(() => null).finally(() => setDevStatsLoading(false))
      }
    }).catch(() => null)
    api.portalStatus().then(status => {
      setPortalStatus(status)
      if (!status.connected) {
        const saved = localStorage.getItem('ns_hac_url')
        if (saved) setPortalUrl(saved)
      }
      setPortalLoading(false)
    }).catch(() => setPortalLoading(false))
    api.canvasStatus().then(setCanvasStatus).catch(() => null)
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (districtRef.current && !districtRef.current.contains(e.target as Node)) {
        setDistrictOpen(false)
      }
      if (portalIsdRef.current && !portalIsdRef.current.contains(e.target as Node)) {
        setPortalIsdOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return 'Never'
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  }

  function closeCanvasForm() {
    setShowCanvasForm(false); setCanvasUrl(''); setCanvasToken('')
    setCanvasError(null); setSelectedDistrict(null)
    setDistrictSearch(''); setDistrictOpen(false)
  }

  async function handleCanvasConnect(e: React.FormEvent) {
    e.preventDefault()
    setCanvasLoading(true); setCanvasError(null)
    try {
      await api.canvasConnect(canvasUrl.trim(), canvasToken.trim())
      await api.canvasSync()
      const fresh = await api.canvasStatus()
      setCanvasStatus(fresh)
      closeCanvasForm()
    } catch (err) {
      setCanvasError(err instanceof Error ? err.message : 'Failed to connect Canvas')
    } finally { setCanvasLoading(false) }
  }

  async function handleCanvasSync() {
    setCanvasLoading(true); setCanvasError(null)
    try {
      await api.canvasSync()
      const fresh = await api.canvasStatus()
      setCanvasStatus(fresh)
    } catch (err) {
      setCanvasError(err instanceof Error ? err.message : 'Sync failed')
    } finally { setCanvasLoading(false) }
  }

  async function handleCanvasDisconnect(instanceUrl?: string) {
    setCanvasLoading(true); setCanvasError(null)
    try {
      await api.canvasDisconnect(instanceUrl)
      const fresh = await api.canvasStatus()
      setCanvasStatus(fresh)
    } catch (err) {
      setCanvasError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally { setCanvasLoading(false) }
  }

  function handleLogout() {
    localStorage.removeItem('ns_token')
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  const isPortalClasslink = !!(portalSelectedIsd?.classlinkId && !portalSelectedIsd?.hacUrl)

  async function handleConnect() {
    if (!portalUsername || !portalPassword) { setPortalError('Please enter your username and password.'); return }
    const needsUrl = !isPortalClasslink && (portalCustomUrl || !portalSelectedIsd)
    if (needsUrl && !portalUrl) { setPortalError('Please select your school district or enter a portal URL.'); return }
    if (!isPortalClasslink && !portalCustomUrl && !portalSelectedIsd) { setPortalError('Please select your school district.'); return }
    setPortalConnecting(true); setPortalError(null)
    try {
      if (isPortalClasslink && portalSelectedIsd?.classlinkId) {
        await api.classlinkConnect(portalSelectedIsd.classlinkId, portalUsername, portalPassword)
      } else if (portalSystem === 'HAC') {
        await api.portalLoginHAC(portalUrl, portalUsername, portalPassword)
      } else {
        await api.portalLoginPS(portalUrl, portalUsername, portalPassword)
      }
      setPortalPassword(''); setPortalUsername('')
      const [status, fresh] = await Promise.all([api.portalStatus(), api.me()])
      setPortalStatus(status)
      setData(fresh)
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Connection failed')
    } finally { setPortalConnecting(false) }
  }

  async function handleDisconnect() {
    setPortalConnecting(true)
    try {
      await api.portalDisconnect()
      setPortalStatus({ connected: false, systemType: null, districtUrl: null, sessionExpiresIn: 0, lastSynced: null })
    } catch { /* ignore */ }
    finally { setPortalConnecting(false) }
  }

  async function handleSyncProfile() {
    setSyncing(true); setSyncMsg(null)
    try {
      await api.portalSyncProfile()
      setSyncMsg('Profile synced from HAC!')
      // Refresh the user data to reflect the updated profile
      const fresh = await api.me()
      setData(fresh)
      setSatScore(fresh.profile?.satScore?.toString() ?? '')
      setActScore(fresh.profile?.actScore?.toString() ?? '')
      setFuturePlan(fresh.profile?.futureDecision ?? '')
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  async function handleSaveScores() {
    setSaving(true); setSaveMsg(null)
    const sat = satScore.trim() ? parseInt(satScore.trim(), 10) : null
    const act = actScore.trim() ? parseInt(actScore.trim(), 10) : null
    try {
      await api.updateProfile({
        satScore: sat,
        actScore: act,
        futureDecision: futurePlan.trim() || null,
      })
      setSaveMsg('Saved!')
      setDirty(false)
      const fresh = await api.me()
      setData(fresh)
    } catch {
      setSaveMsg('Failed to save')
    } finally { setSaving(false); setTimeout(() => setSaveMsg(null), 3000) }
  }

  const profile = data?.profile ?? null

  const canvasDistricts = SORTED_ISD_LIST.filter(d => d.canvasUrl)
  const filteredDistricts = canvasDistricts.filter(d =>
    d.name.toLowerCase().includes(districtSearch.toLowerCase()) ||
    d.state.toLowerCase().includes(districtSearch.toLowerCase())
  )
  const canvasConnections = canvasStatus?.connections?.length
    ? canvasStatus.connections
    : canvasStatus?.canvasInstanceUrl
      ? [{ canvasInstanceUrl: canvasStatus.canvasInstanceUrl, canvasUserName: canvasStatus.canvasUserName, lastSynced: canvasStatus.lastSynced, syncStatus: canvasStatus.syncStatus, syncError: canvasStatus.syncError }]
      : []

  return (
    <div className="fade-up">
      <h1 style={S.title}>Settings</h1>

      <div style={S.layout}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Profile card */}
          <div className="ns-card" style={S.profileCard}>
            <div style={S.avatar}>{initials(data?.name ?? null)}</div>
            <div style={{ flex: 1 }}>
              <div style={S.profileName}>{parseHacName(data?.name) || 'Student'}</div>
              <div style={S.profileSub}>
                {[profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : '', profile?.graduationYear ? `Class of ${profile.graduationYear}` : ''].filter(Boolean).join(' · ') || 'Student account'}
              </div>
              {data?.id && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  Futurely ID: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1 }}>{data.id}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)' }}>(share with your counselor to get linked)</span>
                </div>
              )}
            </div>
          </div>

          {/* Academic Info — editable */}
          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Academic Info</p>

            {/* SAT Score */}
            <div style={S.fieldRow}>
              <label style={S.fieldRowLabel}>SAT Score</label>
              <input
                className="ns-input"
                type="number"
                min={400} max={1600}
                placeholder="400–1600"
                value={satScore}
                onChange={e => { setSatScore(e.target.value); setDirty(true) }}
                style={S.inlineInput}
              />
            </div>

            {/* ACT Score */}
            <div style={S.fieldRow}>
              <label style={S.fieldRowLabel}>ACT Score</label>
              <input
                className="ns-input"
                type="number"
                min={1} max={36}
                placeholder="1–36"
                value={actScore}
                onChange={e => { setActScore(e.target.value); setDirty(true) }}
                style={S.inlineInput}
              />
            </div>

            {/* Future Plan */}
            <div style={S.fieldRow}>
              <label style={S.fieldRowLabel}>Future Plan</label>
              <input
                className="ns-input"
                type="text"
                placeholder="e.g. Computer Science at UT"
                value={futurePlan}
                onChange={e => { setFuturePlan(e.target.value); setDirty(true) }}
                style={S.inlineInput}
              />
            </div>

            {/* Counselor — read only, from HAC */}
            <InfoRow
              label="Counselor"
              value={profile?.counselorName ?? 'Unassigned'}
              sub={profile?.counselorName ? 'From school portal' : undefined}
            />

            {/* Graduation Year — read only, from HAC */}
            <InfoRow
              label="Graduation Year"
              value={profile?.graduationYear?.toString() ?? '—'}
              sub={profile?.graduationYear ? 'From school portal' : undefined}
            />

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="ns-btn-primary"
                style={{ height: 38, padding: '0 20px', fontSize: 13, opacity: dirty ? 1 : 0.5 }}
                onClick={handleSaveScores}
                disabled={saving || !dirty}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: 13, color: saveMsg === 'Saved!' ? '#22C55E' : 'var(--error)' }}>
                  {saveMsg}
                </span>
              )}
            </div>
          </div>

          {/* School Portal */}
          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>School Portal</p>
            {portalLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>
            ) : portalStatus?.connected ? (
              <div>
                <div style={S.connectedRow}>
                  <span style={S.connectedDot} />
                  <span style={S.connectedText}>Connected</span>
                  <span style={S.sysBadge}>{portalStatus.systemType}</span>
                </div>
                <p style={S.distUrl}>{portalStatus.districtUrl}</p>

                {/* Re-sync profile from HAC — refreshes counselor, graduation year, name */}
                {portalStatus.systemType === 'HAC' && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="ns-btn-ghost"
                      style={{
                        height: 36,
                        padding: '0 16px',
                        fontSize: 13,
                        color: 'var(--primary)',
                        borderColor: 'rgba(43,74,142,0.3)',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onClick={handleSyncProfile}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <>
                          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                          Syncing…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6"/>
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                            <path d="M3 22v-6h6"/>
                            <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                          </svg>
                          Re-sync from HAC
                        </>
                      )}
                    </button>
                    {syncMsg && (
                      <p style={{
                        fontSize: 12,
                        color: syncMsg.includes('fail') || syncMsg.includes('Error') ? 'var(--error)' : '#22C55E',
                        marginTop: 6,
                        textAlign: 'center',
                      }}>
                        {syncMsg}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
                      Fetches counselor & graduation year from your school portal
                    </p>
                  </div>
                )}

                <button className="ns-btn-ghost" style={{ ...S.disconnectBtn, marginTop: 14 }}
                  onClick={handleDisconnect} disabled={portalConnecting}>
                  {portalConnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ── District picker ── */}
                <div>
                  <label style={S.fieldLabel}>School District</label>
                  <div ref={portalIsdRef} style={{ position: 'relative' }}>
                    <button type="button" onClick={() => { setPortalIsdOpen(v => !v); setPortalIsdSearch('') }}
                      style={{ ...S.districtBtn, color: portalSelectedIsd ? 'var(--text)' : 'var(--text-muted)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, textAlign: 'left' as const }}>
                        {portalSelectedIsd
                          ? `${portalSelectedIsd.name} (${portalSelectedIsd.state})`
                          : portalCustomUrl ? 'Other / Not listed'
                          : 'Search for your school district…'}
                      </span>
                      <span style={{ fontSize: 11, flexShrink: 0 }}>{portalIsdOpen ? '▲' : '▼'}</span>
                    </button>
                    {portalIsdOpen && (
                      <div style={S.isdPanel}>
                        <div style={{ padding: '8px 8px 4px' }}>
                          <input autoFocus type="text" value={portalIsdSearch}
                            onChange={e => setPortalIsdSearch(e.target.value)}
                            placeholder="Type to search…"
                            style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' as const }}
                            onClick={e => e.stopPropagation()} />
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto' as const }}>
                          {SORTED_ISD_LIST
                            .filter(isd => (isd.hacUrl || isd.classlinkId) && (
                              isd.name.toLowerCase().includes(portalIsdSearch.toLowerCase()) ||
                              isd.state.toLowerCase().includes(portalIsdSearch.toLowerCase())
                            ))
                            .map(isd => (
                              <button key={isd.hacUrl ?? isd.classlinkId ?? isd.name} type="button"
                                onClick={() => {
                                  setPortalSelectedIsd(isd)
                                  setPortalUrl(isd.hacUrl ?? '')
                                  setPortalCustomUrl(false)
                                  setPortalIsdOpen(false)
                                  // Reset system toggle: ClassLink districts skip HAC/PS entirely
                                  if (!isd.classlinkId) setPortalSystem('HAC')
                                  setPortalError(null)
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: portalSelectedIsd === isd ? 'var(--primary-dim)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, color: portalSelectedIsd === isd ? 'var(--primary)' : 'var(--text)' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>{isd.name}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, flexShrink: 0 }}>
                                  {isd.state}{isd.classlinkId ? ' · ClassLink' : ''}
                                </span>
                              </button>
                            ))}
                          <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                          <button type="button"
                            onClick={() => { setPortalSelectedIsd(null); setPortalCustomUrl(true); setPortalUrl(''); setPortalIsdOpen(false); setPortalError(null) }}
                            style={{ display: 'block', width: '100%', padding: '9px 12px', background: portalCustomUrl ? 'var(--primary-dim)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' as const, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                            Other / My district is not listed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── HAC / PowerSchool toggle — only for non-ClassLink districts ── */}
                {!isPortalClasslink && (
                  <div style={S.sysToggle}>
                    {(['HAC', 'PowerSchool'] as SystemType[]).map(s => (
                      <button key={s} onClick={() => { setPortalSystem(s); setPortalError(null) }}
                        style={{ ...S.sysBtn, background: portalSystem === s ? 'var(--primary)' : 'transparent', color: portalSystem === s ? '#060D10' : 'var(--text-secondary)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Custom portal URL — only when "Other" selected ── */}
                {portalCustomUrl && !isPortalClasslink && (
                  <div>
                    <label style={S.fieldLabel}>Portal URL</label>
                    <input className="ns-input" type="url" value={portalUrl} onChange={e => setPortalUrl(e.target.value)}
                      placeholder="https://homeaccess.yourisd.org/" disabled={portalConnecting} />
                  </div>
                )}

                {/* ── Credentials ── */}
                <div>
                  <label style={S.fieldLabel}>{isPortalClasslink ? 'ClassLink Username' : 'Username'}</label>
                  <input className="ns-input" type="text" value={portalUsername} onChange={e => setPortalUsername(e.target.value)}
                    placeholder={isPortalClasslink ? 'Your ClassLink username' : 'Your school username'}
                    disabled={portalConnecting} autoComplete="username" />
                </div>
                <div>
                  <label style={S.fieldLabel}>{isPortalClasslink ? 'ClassLink Password' : 'Password'}</label>
                  <input className="ns-input" type="password" value={portalPassword} onChange={e => setPortalPassword(e.target.value)}
                    placeholder={isPortalClasslink ? 'Your ClassLink password' : 'Your school password'}
                    disabled={portalConnecting} autoComplete="current-password" />
                </div>

                {portalError && <p style={{ color: 'var(--error)', fontSize: 12.5, lineHeight: 1.4 }}>{portalError}</p>}
                <button className="ns-btn-primary" style={{ height: 44, marginTop: 2 }} onClick={handleConnect} disabled={portalConnecting}>
                  {portalConnecting ? 'Connecting…' : 'Connect Portal'}
                </button>
              </div>
            )}
          </div>
          {/* Canvas Integration */}
          <div id="canvas" className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Canvas Integration</p>

            {/* Connect form */}
            {showCanvasForm && (
              <form onSubmit={e => void handleCanvasConnect(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Get your token: Canvas → Profile → Settings → Approved Integrations → New Access Token
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                  When creating the token, set the expiry to <strong>120 days</strong> (the maximum recommended). Futurely will alert you when your token expires so you can renew it.
                </p>
                <div ref={districtRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search your school district…"
                    value={districtOpen ? districtSearch : (selectedDistrict ?? districtSearch)}
                    onChange={e => { setDistrictSearch(e.target.value); setDistrictOpen(true); setSelectedDistrict(null) }}
                    onFocus={() => { setDistrictOpen(true); setDistrictSearch('') }}
                    className="ns-input"
                    autoComplete="off"
                  />
                  {districtOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }}>
                      {filteredDistricts.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                          No districts found — enter your Canvas URL below
                        </div>
                      ) : filteredDistricts.map(d => (
                        <div
                          key={d.canvasUrl}
                          onClick={() => { setSelectedDistrict(`${d.name} (${d.state})`); setCanvasUrl(d.canvasUrl!); setDistrictOpen(false); setDistrictSearch('') }}
                          style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <span style={{ fontWeight: 500 }}>{d.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{d.state}</span>
                        </div>
                      ))}
                      <div
                        onClick={() => { setSelectedDistrict('Other'); setCanvasUrl(''); setDistrictOpen(false) }}
                        style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        Other — enter URL manually
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="ns-input"
                  placeholder="katyisd.instructure.com"
                  value={canvasUrl}
                  onChange={e => setCanvasUrl(e.target.value)}
                  required
                />
                <input
                  type="password"
                  className="ns-input"
                  placeholder="Canvas Personal Access Token"
                  value={canvasToken}
                  onChange={e => setCanvasToken(e.target.value)}
                  required
                />
                {canvasError && <p style={{ color: 'var(--error)', fontSize: 12 }}>{canvasError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    className="ns-btn-primary"
                    style={{ height: 40, flex: 1, opacity: canvasLoading || !canvasUrl.trim() || !canvasToken.trim() ? 0.5 : 1 }}
                    disabled={canvasLoading || !canvasUrl.trim() || !canvasToken.trim()}
                  >
                    {canvasLoading ? 'Connecting…' : 'Connect Canvas'}
                  </button>
                  <button type="button" className="ns-btn-ghost" style={{ height: 40, padding: '0 16px' }} onClick={closeCanvasForm}>Cancel</button>
                </div>
              </form>
            )}

            {/* Connected state */}
            {canvasStatus?.connected && !showCanvasForm && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 5 }}>
                    ✓ Canvas connected
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button
                      className="ns-btn-ghost"
                      style={{ height: 32, padding: '0 12px', fontSize: 12, opacity: canvasLoading ? 0.6 : 1 }}
                      onClick={() => void handleCanvasSync()}
                      disabled={canvasLoading}
                    >
                      {canvasLoading ? 'Syncing…' : 'Sync All'}
                    </button>
                    {canvasConnections.length < 2 && (
                      <button
                        className="ns-btn-ghost"
                        style={{ height: 32, padding: '0 12px', fontSize: 12, color: 'var(--primary)', borderColor: 'rgba(43,74,142,0.4)', opacity: canvasLoading ? 0.6 : 1 }}
                        onClick={() => setShowCanvasForm(true)}
                        disabled={canvasLoading}
                      >
                        + Add Canvas
                      </button>
                    )}
                  </div>
                </div>
                {canvasConnections.map(conn => {
                  const isCollege = isCollegeIsd(conn.canvasInstanceUrl)
                  return (
                    <div key={conn.canvasInstanceUrl} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                      {conn.syncError === 'TOKEN_REVOKED' && (
                        <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>Token expired</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
                        background: isCollege ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                        color: isCollege ? '#22C55E' : '#3B82F6', flexShrink: 0,
                      }}>
                        {isCollege ? 'College' : 'High School'}
                      </span>
                      <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conn.canvasUserName ?? conn.canvasInstanceUrl}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatRelativeTime(conn.lastSynced)}
                      </span>
                      <button
                        className="ns-btn-ghost"
                        style={{ height: 28, padding: '0 10px', fontSize: 11, color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)', flexShrink: 0, opacity: canvasLoading ? 0.6 : 1 }}
                        onClick={() => void handleCanvasDisconnect(conn.canvasInstanceUrl)}
                        disabled={canvasLoading}
                      >
                        Disconnect
                      </button>
                    </div>
                  )
                })}
                {canvasError && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 6 }}>{canvasError}</p>}
              </div>
            )}

            {/* Disconnected state */}
            {!canvasStatus?.connected && !showCanvasForm && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                  Link your Canvas account to sync assignments into the planner automatically.
                </p>
                <button
                  className="ns-btn-primary"
                  style={{ height: 40, width: '100%' }}
                  onClick={() => setShowCanvasForm(true)}
                >
                  Connect Canvas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Appearance</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Theme</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</div>
              </div>
              <button onClick={toggleTheme} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Reduce animations</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Disables tag, avatar, and name-color animations — helps if the app is lagging</div>
              </div>
              <button
                onClick={() => {
                  const next = !reduceMotion
                  setReduceMotion(next)
                  localStorage.setItem('rm', next ? '1' : '0')
                  if (next) document.documentElement.classList.add('reduce-motion')
                  else document.documentElement.classList.remove('reduce-motion')
                }}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                  background: reduceMotion ? 'var(--primary)' : 'var(--border)', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: reduceMotion ? 23 : 3, width: 18, height: 18,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Hide GPA on dashboard</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Blur your GPA so others can&apos;t see it over your shoulder</div>
              </div>
              <button
                onClick={() => { const next = !hideGpa; setHideGpa(next); localStorage.setItem('ns_hide_gpa', next ? '1' : '0') }}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                  background: hideGpa ? 'var(--primary)' : 'var(--border)', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: hideGpa ? 23 : 3, width: 18, height: 18,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>
            <div style={{ padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Grade color coding</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pick a color for each letter grade</div>
                </div>
                {!isDefaultGradeColors && (
                  <button
                    onClick={handleResetGradeColors}
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}
                  >
                    Reset to defaults
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => (
                  <label key={grade} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8,
                      background: gradeColors[grade],
                      border: '2px solid rgba(255,255,255,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    }}>
                      <input
                        type="color"
                        value={gradeColors[grade]}
                        onChange={e => handleGradeColorChange(grade, e.target.value)}
                        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: gradeColors[grade] }}>{grade}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Support</p>
            <InfoRow label="Contact" value="support@nextstep.ai" />
            <InfoRow label="Version" value="v1.0.3" />
          </div>

          <button style={S.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>

          {/* DEV-only: platform stats */}
          {(data?.role === 'DEV' || data?.role === 'ADMIN') && (
            <div className="ns-card" style={{ ...S.card, border: '1px solid rgba(43,74,142,0.25)', marginTop: 16 }}>
              <p style={{ ...S.cardLabel, color: 'var(--primary)', marginBottom: 14 }}>DEV — Platform Stats</p>
              {devStatsLoading ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>
              ) : devStats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { label: 'Total Users', value: devStats.totalUsers.toLocaleString(), desc: 'All accounts created' },
                    { label: 'Active Users', value: devStats.activeUsers.toLocaleString(), desc: 'Active in the last 3 days' },
                    { label: 'Live Users', value: devStats.liveUsers.toLocaleString(), desc: 'Active in the last 10 minutes' },
                  ] as { label: string; value: string; desc: string }[]).map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{row.desc}</div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{row.value}</div>
                    </div>
                  ))}
                  <button
                    className="ns-btn-ghost"
                    style={{ alignSelf: 'flex-end', height: 32, padding: '0 14px', fontSize: 12, marginTop: 4 }}
                    onClick={() => {
                      setDevStatsLoading(true)
                      api.adminStats().then(setDevStats).catch(() => null).finally(() => setDevStatsLoading(false))
                    }}
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--error)' }}>Failed to load stats</p>
              )}
            </div>
          )}

          {/* DEV-only: avatar URL */}
          {data?.role === 'ADMIN' && (
            <div className="ns-card" style={{ ...S.card, border: '1px solid rgba(43,74,142,0.25)' }}>
              <p style={{ ...S.cardLabel, color: 'var(--primary)' }}>DEV — Avatar URL</p>
              <div style={S.fieldRow}>
                <label style={S.fieldRowLabel}>Image URL</label>
                <input
                  className="ns-input"
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  style={{ ...S.inlineInput, width: 200 }}
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="ns-btn-primary"
                  style={{ height: 36, padding: '0 18px', fontSize: 13 }}
                  onClick={handleSaveAvatar}
                  disabled={avatarSaving}
                >
                  {avatarSaving ? 'Saving…' : 'Set Avatar'}
                </button>
                <button
                  className="ns-btn-ghost"
                  style={{ height: 36, padding: '0 14px', fontSize: 13 }}
                  onClick={() => { setAvatarUrl(''); api.updateAvatarUrl(null).then(() => setAvatarMsg('Cleared!')).catch(() => null) }}
                  disabled={avatarSaving}
                >
                  Clear
                </button>
                {avatarMsg && (
                  <span style={{ fontSize: 13, color: avatarMsg === 'Saved!' || avatarMsg === 'Cleared!' ? '#22C55E' : 'var(--error)' }}>
                    {avatarMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="ns-card" style={{ ...S.card, marginTop: 16, border: '1px solid rgba(239,68,68,0.25)' }}>
            <p style={{ ...S.cardLabel, color: 'var(--error)' }}>Danger Zone</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
              Permanently delete your account and all associated data. This cannot be undone.
            </p>
            <button
              style={{ width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, padding: '10px 0', color: 'var(--error)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Account
            </button>
          </div>

          {/* Changelog */}
          <div className="ns-card" style={{ ...S.card, marginTop: 16 }}>
            <button
              onClick={() => setShowChangelog(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' as const }}
            >
              <div>
                <p style={{ ...S.cardLabel, marginBottom: 4 }}>Changelog</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Every update to Futurely, explained in plain English.
                </p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 16, transform: showChangelog ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showChangelog && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 24, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                {CHANGELOG.map((entry, ei) => (
                  <div key={entry.version}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 99, padding: '2px 10px' }}>
                        v{entry.version}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{entry.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{entry.date}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                      {entry.changes.map((c, ci) => (
                        <div key={ci} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, width: 24, textAlign: 'center' as const, marginTop: 1 }}>{c.emoji}</span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{c.headline}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {ei < CHANGELOG.length - 1 && (
                      <div style={{ borderBottom: '1px solid var(--border)', marginTop: 20 }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} hasPassword={data?.hasPassword ?? true} />}
    </div>
  )
}

function InfoRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ textAlign: 'right' as const }}>
        <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 24 },
  layout:       { display: 'flex', gap: 20, alignItems: 'flex-start' },
  profileCard:  { display: 'flex', alignItems: 'center', gap: 16, padding: 20, marginBottom: 16 },
  avatar:       { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2B4A8E,#2D6A4F)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 },
  profileName:  { fontSize: 17, fontWeight: 700 },
  profileSub:   { fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 },
  card:         { padding: 20, marginBottom: 16 },
  cardLabel:    { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 14 },
  fieldRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 12 },
  fieldRowLabel:{ fontSize: 13.5, color: 'var(--text-secondary)', flexShrink: 0, margin: 0 },
  inlineInput:  { width: 160, textAlign: 'right' as const, padding: '5px 10px', fontSize: 13.5, height: 34 },
  connectedRow: { display: 'flex', alignItems: 'center', gap: 8 },
  connectedDot: { width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 },
  connectedText:{ color: '#22C55E', fontWeight: 600, fontSize: 14 },
  sysBadge:     { fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px' },
  distUrl:      { fontSize: 12, color: 'var(--text-muted)', marginTop: 6 },
  disconnectBtn:{ color: 'var(--error)', borderColor: 'rgba(239,68,68,0.3)', fontSize: 13 },
  sysToggle:    { display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' },
  sysBtn:       { flex: 1, borderRadius: 6, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'background 0.15s, color 0.15s' },
  districtBtn:  { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  isdPanel:     { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden' },
  fieldLabel:   { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 },
  logoutBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 0', color: 'var(--error)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
}
