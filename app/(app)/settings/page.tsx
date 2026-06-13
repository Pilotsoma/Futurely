'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type StudentData } from '../../../lib/api'

function initials(name: string | null): string {
  if (!name) return 'S'
  return name.trim().split(' ').map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2)
}

type SystemType = 'HAC' | 'PowerSchool'

interface PortalStatus {
  connected: boolean
  systemType: string | null
  districtUrl: string | null
  sessionExpiresIn: number
  lastSynced: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [data, setData] = useState<StudentData | null>(null)

  // Portal state
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
  const [portalLoading, setPortalLoading] = useState(true)
  const [portalSystem, setPortalSystem] = useState<SystemType>('HAC')
  const [portalUrl, setPortalUrl] = useState('https://homeaccess.katyisd.org/')
  const [portalUsername, setPortalUsername] = useState('')
  const [portalPassword, setPortalPassword] = useState('')
  const [portalConnecting, setPortalConnecting] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(setData).catch(() => null)
    api.portalStatus()
      .then(status => {
        setPortalStatus(status)
        // Pre-fill URL from localStorage if not connected
        if (!status.connected) {
          const savedUrl = localStorage.getItem('ns_hac_url')
          if (savedUrl) setPortalUrl(savedUrl)
        }
        setPortalLoading(false)
      })
      .catch(() => setPortalLoading(false))
  }, [])

  function handleLogout() {
    localStorage.removeItem('ns_token')
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  function handleSystemSwitch(system: SystemType) {
    setPortalSystem(system)
    setPortalUrl(system === 'HAC' ? 'https://homeaccess.katyisd.org/' : '')
    setPortalError(null)
  }

  async function handlePortalConnect() {
    if (!portalUrl || !portalUsername || !portalPassword) {
      setPortalError('Please fill in all fields.')
      return
    }
    setPortalConnecting(true)
    setPortalError(null)
    try {
      if (portalSystem === 'HAC') {
        await api.portalLoginHAC(portalUrl, portalUsername, portalPassword)
      } else {
        await api.portalLoginPS(portalUrl, portalUsername, portalPassword)
      }
      // Credentials are used and immediately discarded — never stored beyond this call
      setPortalPassword('')
      setPortalUsername('')
      const status = await api.portalStatus()
      setPortalStatus(status)
    } catch (err: unknown) {
      setPortalError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setPortalConnecting(false)
    }
  }

  async function handlePortalDisconnect() {
    setPortalConnecting(true)
    try {
      await api.portalDisconnect()
      setPortalStatus({ connected: false, systemType: null, districtUrl: null, sessionExpiresIn: 0, lastSynced: null })
    } catch {
      // ignore
    } finally {
      setPortalConnecting(false)
    }
  }

  const profile = data?.profile ?? null

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '24px' }}>Settings</h1>
      <div style={styles.layout}>
        {/* Left column */}
        <div style={{ flex: 1 }}>
          {/* Profile card */}
          <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', marginBottom: '20px' }}>
            <div style={styles.avatar}>{initials(data?.name ?? null)}</div>
            <div style={styles.name}>{data?.name ?? 'Student'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {[profile?.gradeLevel ? `Grade ${profile.gradeLevel}` : '', profile?.graduationYear ? `Class of ${profile.graduationYear}` : ''].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* Academic info */}
          <div style={styles.card}>
            <div style={styles.cardTitle}>Academic Info</div>
            <InfoRow label="SAT Score" value={profile?.satScore?.toString() ?? 'Not set'} />
            <InfoRow label="ACT Score" value={profile?.actScore?.toString() ?? 'Not set'} />
            <InfoRow label="Future Plan" value={profile?.futureDecision ?? 'Not set'} />
            <InfoRow label="Counselor" value={profile?.counselorName ?? 'Unassigned'} />
            <InfoRow label="Graduation Year" value={profile?.graduationYear?.toString() ?? '—'} />
          </div>

          {/* School Portal card */}
          <div style={{ ...styles.card, marginTop: '16px' }}>
            <div style={styles.cardTitle}>School Portal</div>

            {portalLoading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '8px 0' }}>Loading...</div>
            ) : portalStatus?.connected ? (
              /* Connected state */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={styles.connectedDot} />
                  <span style={styles.connectedText}>Connected</span>
                  <span style={styles.systemBadge}>{portalStatus.systemType}</span>
                </div>
                <div style={styles.districtUrl}>{portalStatus.districtUrl}</div>
                <button
                  style={styles.disconnectBtn}
                  onClick={handlePortalDisconnect}
                  disabled={portalConnecting}
                >
                  {portalConnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              /* Connect form */
              <div>
                {/* System selector */}
                <div style={styles.systemSelector}>
                  <button
                    style={{ ...styles.sysBtn, ...(portalSystem === 'HAC' ? styles.sysBtnActive : styles.sysBtnInactive) }}
                    onClick={() => handleSystemSwitch('HAC')}
                    disabled={portalConnecting}
                  >
                    HAC
                  </button>
                  <button
                    style={{ ...styles.sysBtn, ...(portalSystem === 'PowerSchool' ? styles.sysBtnActive : styles.sysBtnInactive) }}
                    onClick={() => handleSystemSwitch('PowerSchool')}
                    disabled={portalConnecting}
                  >
                    PowerSchool
                  </button>
                </div>

                {/* Portal URL */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.inputLabel}>Portal URL</label>
                  <input
                    style={styles.input}
                    type="url"
                    value={portalUrl}
                    onChange={e => setPortalUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={portalConnecting}
                  />
                </div>

                {/* Username */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.inputLabel}>Username</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={portalUsername}
                    onChange={e => setPortalUsername(e.target.value)}
                    placeholder="Your school username"
                    disabled={portalConnecting}
                    autoComplete="username"
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={styles.inputLabel}>Password</label>
                  <input
                    style={styles.input}
                    type="password"
                    value={portalPassword}
                    onChange={e => setPortalPassword(e.target.value)}
                    placeholder="Your school password"
                    disabled={portalConnecting}
                    autoComplete="current-password"
                  />
                </div>

                {portalError && (
                  <div style={styles.errorText}>{portalError}</div>
                )}

                <button
                  style={{ ...styles.connectBtn, opacity: portalConnecting ? 0.6 : 1 }}
                  onClick={handlePortalConnect}
                  disabled={portalConnecting}
                >
                  {portalConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: 1 }}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Appearance</div>
            <InfoRow label="Color Theme" value="Dark" />
            <InfoRow label="Color Coding" value="Enabled" />
          </div>

          <div style={{ ...styles.card, marginTop: '16px' }}>
            <div style={styles.cardTitle}>Support</div>
            <InfoRow label="Contact Support" value="support@nextstep.ai" />
            <InfoRow label="Version" value="v1.0.0 MVP" />
          </div>

          <button style={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{label}</span>
      <span style={{ fontSize: '14px' }}>{value}</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  cardTitle: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: '16px' },
  avatar: { width: '72px', height: '72px', borderRadius: '36px', background: 'var(--primary)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', marginBottom: '12px' },
  name: { fontSize: '20px', fontWeight: '700', marginBottom: '4px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  logoutBtn: { width: '100%', background: 'transparent', border: 'none', color: 'var(--error)', fontSize: '16px', fontWeight: '700', padding: '16px', textAlign: 'center' as const, marginTop: '8px' },
  // Portal
  systemSelector: { display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 8, padding: 4, border: '1px solid var(--border)', marginBottom: 16 },
  sysBtn: { borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'background 0.15s', flex: 1 },
  sysBtnActive: { background: 'var(--primary)', color: 'var(--bg)' },
  sysBtnInactive: { background: 'var(--border)', color: 'var(--text-secondary)' },
  inputLabel: { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' },
  input: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', height: 48, width: '100%', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const, fontSize: 14 },
  connectBtn: { background: 'var(--primary)', color: 'var(--bg)', border: 'none', borderRadius: 8, height: 48, fontWeight: 600, fontSize: 15, width: '100%', cursor: 'pointer' },
  errorText: { color: 'var(--error)', fontSize: 13, marginTop: 8, lineHeight: 1.4, marginBottom: 8 },
  connectedDot: { width: 8, height: 8, borderRadius: 4, background: '#3FB950', display: 'inline-block', marginRight: 8 },
  connectedText: { color: '#3FB950', fontWeight: 600, fontSize: 14 },
  systemBadge: { fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 },
  districtUrl: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
  disconnectBtn: { background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 12 },
}
