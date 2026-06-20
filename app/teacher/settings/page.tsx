'use client'

import { useEffect, useState } from 'react'

interface UserInfo {
  name: string | null
  email: string
  role: string
}

export default function TeacherSettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('ns_user')
    if (raw) {
      const parsed = JSON.parse(raw) as { name?: string | null; email?: string; role?: string }
      setUser({
        name: parsed.name ?? null,
        email: parsed.email ?? '',
        role: parsed.role ?? 'TEACHER',
      })
    }
  }, [])

  return (
    <div className="fade-up">
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

        <div style={S.field}>
          <label style={S.fieldLabel}>Role</label>
          <div style={{ display: 'inline-flex' }}>
            <span style={S.roleBadge}>Teacher</span>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 24, lineHeight: 1.6 }}>
          To update your name or email, please contact your institution administrator.
        </p>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  pageHeader:  { marginBottom: 28 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:    { fontSize: 13, color: 'var(--text-secondary)' },
  sectionLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 20 },
  field:       { marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' },
  fieldLabel:  { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 },
  fieldValue:  { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  roleBadge:   { background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: 'var(--primary)' },
}
