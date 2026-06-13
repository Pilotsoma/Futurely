'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

type Teacher = { name: string; courseName: string; period: string; email: null; emailNote: string; emailHint: string }

function initials(name: string) {
  return name.trim().split(' ').map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase()
}

export default function ContactPage() {
  const router  = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    api.portalContactTeachers()
      .then(r => setTeachers(r.teachers ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load teacher contacts'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading teachers…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Contact Teachers</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {teachers.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No teacher data available. Connect your school portal in Settings.
        </p>
      )}

      <div style={S.grid}>
        {teachers.map((t, i) => (
          <div key={i} className="ns-card" style={S.card}>
            <div style={S.avatar}>{initials(t.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.name}>{t.name}</div>
              <div style={S.course}>{t.courseName}{t.period ? ` · Period ${t.period}` : ''}</div>
              {t.emailHint && (
                <div style={{ ...S.note, marginBottom: 2 }}>
                  <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{t.emailHint}</span>
                </div>
              )}
              <div style={S.note}>{t.emailNote}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:    { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:   { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
  card:    { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px' },
  avatar:  { width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  name:    { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 },
  course:  { fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 5 },
  note:    { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 },
}
