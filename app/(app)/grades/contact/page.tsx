'use client'

import React from 'react'
import { ArrowLeftIcon } from '@/components/icons'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageLoader from '../../../../components/ui/PageLoader'
import { getApiToken } from '../../../../lib/api'

const BASE = ''

interface TeacherCourse {
  courseName: string
  period: string
}

interface Teacher {
  name: string
  email: string
  room: string
  building: string
  courses: TeacherCourse[]
}

function initials(name: string) {
  return name.trim().split(/[\s,]+/).filter(Boolean).map(p => p.charAt(0)).join('').slice(0, 2).toUpperCase()
}

function apiFetch<T>(path: string): Promise<T> {
  const token = typeof window !== 'undefined' ? getApiToken() : null
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(r => r.json())
}

export default function ContactTeachersPage() {
  const router = useRouter()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ data?: { teachers?: Teacher[] }; error?: { message?: string } | string }>('/api/integrations/grades/contact-teachers')
      .then(json => {
        if (json.error) {
          const msg = typeof json.error === 'string' ? json.error : (json.error?.message ?? 'Failed to load')
          setError(msg)
          return
        }
        setTeachers(json.data?.teachers ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load teacher contacts'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader message="Loading teacher contacts…" />

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}><ArrowLeftIcon size={14}/> Grade Portal</button>
      <h1 style={S.title}>Contact Teachers</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      <div style={S.grid}>
        {teachers.map((t, i) => (
          <div key={i} className="ns-card" style={S.card}>
            <div style={S.avatar}>{initials(t.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.name}>{t.name}</div>
              <div style={S.courses}>
                {t.courses.map((c, ci) => (
                  <span key={ci} style={S.coursePill}>
                    {c.period ? `P${c.period} ` : ''}{c.courseName}
                  </span>
                ))}
              </div>
              <div style={S.meta}>
                {t.room && <span style={S.metaChip}>Room {t.room}</span>}
                {t.building && t.building !== 'Seven Lakes HS' && (
                  <span style={S.metaChip}>{t.building}</span>
                )}
              </div>
              <div style={S.email}>{t.email}</div>
            </div>
            <a href={`mailto:${t.email}`} style={S.emailBtn}>Email</a>
          </div>
        ))}
      </div>

      {teachers.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No teacher data available. Make sure your school account is connected.
        </p>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:      { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:     { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  grid:      { display: 'flex', flexDirection: 'column', gap: 10 },
  card:      { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px' },
  avatar:    { width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 },
  name:      { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 5 },
  courses:   { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 },
  coursePill:{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 7px', color: 'var(--text-secondary)' },
  meta:      { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  metaChip:  { fontSize: 11, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 5, padding: '2px 7px', color: 'var(--primary)' },
  email:     { fontSize: 11.5, color: 'var(--text-muted)' },
  emailBtn:  { flexShrink: 0, padding: '6px 14px', borderRadius: 8, background: 'var(--primary-dim)', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, textDecoration: 'none' },
}
