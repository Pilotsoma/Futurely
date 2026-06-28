'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../lib/api'
import { clearWebAuth } from '../../../lib/authState'

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (confirm !== 'DELETE') { setError('Type DELETE to confirm'); return }
    setLoading(true); setError(null)
    try {
      await api.deleteAccount(password || undefined)
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
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Password (if you have one)</label>
            <input type="password" className="ns-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
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

interface UserInfo { name: string | null; email: string; role: string }

export default function TeacherSettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('ns_user')
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string | null; email?: string; role?: string }
      setUser({ name: parsed.name ?? null, email: parsed.email ?? '', role: parsed.role ?? 'TEACHER' })
    }
  }, [])

  return (
    <div className="fade-up">
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
      <div style={S.pageHeader}>
        <h1 style={S.title}>Settings</h1>
        <p style={S.subtitle}>Your account information</p>
      </div>

      <div className="ns-card" style={{ padding: 28, maxWidth: 480 }}>
        <p style={S.sectionLabel}>Account</p>

        <div style={S.field}>
          <label style={S.fieldLabel}>Name</label>
          <div style={S.fieldValue}>{user?.name ?? '—'}</div>
        </div>

        <div style={S.field}>
          <label style={S.fieldLabel}>Email</label>
          <div style={S.fieldValue}>{user?.email ?? '—'}</div>
        </div>

        <div style={{ ...S.field, borderBottom: 'none' }}>
          <label style={S.fieldLabel}>Role</label>
          <div style={{ display: 'inline-flex' }}>
            <span style={S.roleBadge}>Teacher</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 }}>
          To update your name or email, please contact your institution administrator.
        </p>
      </div>

      <div style={{ maxWidth: 480, marginTop: 16 }}>
        <button onClick={() => setShowDelete(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '11px 0', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete Account
        </button>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  pageHeader:   { marginBottom: 28 },
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:     { fontSize: 13, color: 'var(--text-secondary)' },
  sectionLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 20 },
  field:        { marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  fieldLabel:   { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 },
  fieldValue:   { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  roleBadge:    { background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--primary)' },
}
