'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../lib/api'
import { clearWebAuth } from '../../../lib/authState'

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hasPassword, setHasPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { passwordHash?: string | null } | null
    if (u && u.passwordHash === null) setHasPassword(false)
  }, [])

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
          This permanently deletes your account and all data. There is no undo.
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
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void handleDelete()} disabled={loading} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ParentSettingsPage() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ns_user')
      if (stored) {
        const u = JSON.parse(stored)
        setName(u.name ?? null)
        setEmail(u.email ?? null)
      }
    } catch { /* ignore */ }
  }, [])

  function handleLogout() {
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  function initials(n: string | null) {
    if (!n) return 'P'
    return n.trim().split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div className="fade-up">
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
      <h1 style={S.title}>Settings</h1>

      <div style={S.layout}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Profile card */}
          <div className="ns-card" style={S.profileCard}>
            <div style={S.avatar}>{initials(name)}</div>
            <div>
              <div style={S.profileName}>{name ?? 'Parent'}</div>
              <div style={S.profileSub}>Parent account</div>
            </div>
          </div>

          {/* Account info */}
          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Account</p>
            <InfoRow label="Name" value={name ?? '—'} />
            <InfoRow label="Email" value={email ?? '—'} />
            <InfoRow label="Account Type" value="Parent / Guardian" />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ns-card" style={S.card}>
            <p style={S.cardLabel}>Support</p>
            <InfoRow label="Contact" value="support@nextstep.ai" />
            <InfoRow label="Version" value="v1.0 MVP" />
          </div>

          <button style={S.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>

          <button style={S.deleteBtn} onClick={() => setShowDelete(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 24 },
  layout:       { display: 'flex', gap: 20, alignItems: 'flex-start' },
  profileCard:  { display: 'flex', alignItems: 'center', gap: 16, padding: 20, marginBottom: 16 },
  avatar:       { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2D6A4F,#2B4A8E)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 },
  profileName:  { fontSize: 17, fontWeight: 700 },
  profileSub:   { fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 },
  card:         { padding: 20, marginBottom: 16 },
  cardLabel:    { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 14 },
  logoutBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 0', color: 'var(--error)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  deleteBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: '#EF4444', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
}
