'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, CanvasGradesConnection, CanvasGradesCourse, CanvasGradesAssignment } from '@/lib/api'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtScore(a: CanvasGradesAssignment): string {
  const sub = a.submission
  if (!sub || sub.score === null) return '—'
  const pts = a.points_possible !== null ? ` / ${a.points_possible}` : ''
  return `${sub.score}${pts}`
}

function StatusChip({ a }: { a: CanvasGradesAssignment }) {
  const sub = a.submission
  const state = sub?.workflow_state ?? 'unsubmitted'
  let label: string, bg: string, color: string
  if (sub?.missing) {
    label = 'Missing';     bg = 'rgba(239,68,68,0.12)';   color = '#EF4444'
  } else if (sub?.late && state !== 'graded') {
    label = 'Late';        bg = 'rgba(249,115,22,0.12)';  color = '#F97316'
  } else if (state === 'graded') {
    label = 'Graded';      bg = 'rgba(34,197,94,0.12)';   color = '#22C55E'
  } else if (state === 'submitted' || state === 'pending_review') {
    label = 'Submitted';   bg = 'rgba(59,130,246,0.12)';  color = '#3B82F6'
  } else {
    label = 'Not Submitted'; bg = 'rgba(107,114,128,0.12)'; color = '#6B7280'
  }
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function CourseCard({ course }: { course: CanvasGradesCourse }) {
  const [open, setOpen] = useState(false)

  const scoreLabel = course.currentScore !== null
    ? `${course.currentScore.toFixed(1)}%${course.currentGrade ? ` (${course.currentGrade})` : ''}`
    : course.currentGrade ?? '—'

  const scoreColor = course.currentScore !== null
    ? course.currentScore >= 90 ? '#22C55E'
    : course.currentScore >= 80 ? '#10B981'
    : course.currentScore >= 70 ? '#F59E0B'
    : course.currentScore >= 60 ? '#F97316'
    : '#EF4444'
    : 'var(--text-muted)'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {course.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {course.assignments.length} assignment{course.assignments.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>{scoreLabel}</span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {course.assignments.length === 0 ? (
            <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text-muted)' }}>No assignments found.</div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 100px', gap: 8, padding: '8px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                {['Assignment', 'Due', 'Score', 'Status'].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>{h}</span>
                ))}
              </div>
              {course.assignments.map(a => (
                <div
                  key={a.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 100px', gap: 8, padding: '10px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(a.due_at)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{fmtScore(a)}</span>
                  <StatusChip a={a} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Derive a short display name from a Canvas instance URL, e.g. "hccs.instructure.com" → "HCC Canvas" */
function instanceLabel(url: string): string {
  const host = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
  const known: Record<string, string> = {
    'hccs.instructure.com':         'HCC Canvas',
    'sanjacinto.instructure.com':   'San Jac Canvas',
    'lonestar.instructure.com':     'Lone Star Canvas',
    'austincc.instructure.com':     'Austin CC Canvas',
    'collin.instructure.com':       'Collin College Canvas',
    'dcccd.instructure.com':        'Dallas College Canvas',
    'tarrantcounty.instructure.com':'TCC Canvas',
  }
  if (known[host]) return known[host]
  const subdomain = host.split('.')[0]
  return `${subdomain.charAt(0).toUpperCase()}${subdomain.slice(1)} Canvas`
}

export default function CanvasGradesPage() {
  const router = useRouter()
  const [data, setData]       = useState<CanvasGradesConnection[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [notConnected, setNotConnected] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    api.canvasGrades()
      .then(setData)
      .catch(e => {
        if (e?.code === 'NOT_CONNECTED' || e?.message?.includes('NOT_CONNECTED') || e?.message?.includes('No Canvas')) {
          setNotConnected(true)
        } else {
          setNotConnected(true) // treat any connection error as not-connected for redirect UX
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Not connected ────────────────────────────────────────────────────────
  if (!loading && notConnected) {
    return (
      <div className="fade-up" style={{ maxWidth: 520, margin: '80px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 20 }}>
          🎓
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>Canvas not connected</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 28px', maxWidth: 380 }}>
          Link your Canvas account in Settings to view live grades and submission status here.
        </p>
        <button
          onClick={() => router.push('/settings#canvas')}
          className="ns-btn-primary"
          style={{ padding: '11px 28px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}
        >
          Go to Settings → Connect Canvas
        </button>
        <button
          onClick={() => router.push('/grades')}
          style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}
        >
          ← Back to Grade Portal
        </button>
      </div>
    )
  }

  const conn = data?.[activeIdx]
  const hasMultiple = (data?.length ?? 0) > 1

  return (
    <div className="fade-up" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/grades')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, padding: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Grade Portal
        </button>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>Canvas Grades</span>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', margin: '0 0 4px' }}>Canvas Grades</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
            Live scores and submission status from your Canvas account.
          </p>
        </div>

        {/* Open-in-Canvas button(s) — only shown when connections exist */}
        {data && data.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.map((c, i) => (
              <a
                key={c.canvasInstanceUrl}
                href={`https://${c.canvasInstanceUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 16px', borderRadius: 9,
                  border: '1px solid var(--border)', background: i === activeIdx ? 'var(--primary-dim)' : 'var(--surface-2)',
                  color: i === activeIdx ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {instanceLabel(c.canvasInstanceUrl)}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Connection tabs — only for dual-enrolled users */}
      {hasMultiple && data && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {data.map((c, i) => (
            <button
              key={c.canvasInstanceUrl}
              onClick={() => setActiveIdx(i)}
              style={{
                padding: '7px 16px', borderRadius: 8, border: `1px solid ${activeIdx === i ? 'var(--primary)' : 'var(--border)'}`,
                background: activeIdx === i ? 'var(--primary-dim)' : 'transparent',
                color: activeIdx === i ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {instanceLabel(c.canvasInstanceUrl)}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
          <div style={{ width: 22, height: 22, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          Loading grades from Canvas…
        </div>
      )}

      {/* Grades */}
      {!loading && conn && (
        conn.error === 'TOKEN_EXPIRED' ? (
          <div style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)', color: '#F59E0B', fontSize: 13 }}>
            Canvas token expired for <b>{conn.canvasInstanceUrl}</b>.{' '}
            <button onClick={() => router.push('/settings#canvas')} style={{ background: 'none', border: 'none', color: '#F59E0B', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 13, padding: 0 }}>
              Reconnect in Settings
            </button>
          </div>
        ) : conn.courses.length === 0 ? (
          <div style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
            No active courses found for this Canvas account.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conn.courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
