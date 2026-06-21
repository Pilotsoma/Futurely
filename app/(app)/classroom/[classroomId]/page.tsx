'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ClassroomDetail } from '../../../../lib/api'

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ClassroomDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = Number(params.classroomId)

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    if (isNaN(id)) { router.replace('/classroom'); return }
    api.studentClassroomDetail(id)
      .then(data => setClassroom(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load classroom'))
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      </div>
    )
  }

  if (error || !classroom) {
    return (
      <div style={S.page}>
        <p style={{ color: 'var(--error)', fontSize: 14 }}>{error ?? 'Classroom not found.'}</p>
        <Link href="/classroom" style={{ color: 'var(--primary)', fontSize: 13, marginTop: 8, display: 'inline-block' }}>← Back</Link>
      </div>
    )
  }

  const upcoming = classroom.assignments.filter(a => !isOverdue(a.dueDate))
  const past     = classroom.assignments.filter(a => isOverdue(a.dueDate))

  return (
    <div style={S.page}>
      {/* Back */}
      <Link href="/classroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        All Classrooms
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{classroom.name}</h1>
        {classroom.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{classroom.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Teacher: <strong style={{ color: 'var(--text)' }}>{classroom.educator.name ?? classroom.educator.email}</strong>
          </span>
          <span style={S.pill}>{classroom.memberships.length} student{classroom.memberships.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Upcoming assignments */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={S.sectionLabel}>Assignments</h2>
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="ns-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No assignments yet — check back later.
          </div>
        ) : upcoming.length === 0 ? (
          <div className="ns-card" style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>All assignments are past due.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(a => (
              <div key={a.id} className="ns-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: '0 0 2px' }}>{a.title}</p>
                    {a.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{a.description}</p>}
                    <span style={S.subjectBadge}>{a.subject}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Due</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{formatDate(a.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past assignments */}
      {past.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ ...S.sectionLabel, color: 'var(--text-muted)' }}>Past Due</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(a => (
              <div key={a.id} className="ns-card" style={{ padding: '12px 18px', opacity: 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', margin: '0 0 2px', textDecoration: 'line-through' }}>{a.title}</p>
                    <span style={S.subjectBadge}>{a.subject}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, flexShrink: 0 }}>Due {formatDate(a.dueDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section>
        <h2 style={S.sectionLabel}>Classmates</h2>
        <div className="ns-card" style={{ padding: '6px 0' }}>
          {classroom.memberships.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < classroom.memberships.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                {(m.student.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{m.student.name ?? 'Student'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:         { padding: '24px 28px', maxWidth: 720, margin: '0 auto' },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: 12 },
  pill:         { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: 'var(--text-muted)' },
  subjectBadge: { display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginTop: 4 },
}
