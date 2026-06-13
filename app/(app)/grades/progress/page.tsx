'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

const GRADE_COLOR: Record<string, string> = { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' }
const gradeColor = (g: string) => GRADE_COLOR[g?.charAt(0)?.toUpperCase()] ?? 'var(--text-muted)'

type Course = { name: string; period: string; average: string; letterGrade: string }

export default function ProgressPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.portalProgressReport()
      .then(r => setCourses(r.courses ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load progress report'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading progress report…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Progress Report</h1>
      <p style={S.sub}>Interim grades from your school portal</p>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {courses.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No progress report available. Connect your school portal in Settings.
        </p>
      )}

      {courses.length > 0 && (
        <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Course', 'Period', 'Average', 'Grade'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.map((c, i) => (
                <tr key={i} className="ns-tr" style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={S.td}>{c.name}</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.period || '—'}</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.average || '—'}</td>
                  <td style={S.td}>
                    {c.letterGrade
                      ? <span style={{ color: gradeColor(c.letterGrade), fontWeight: 700, fontSize: 16 }}>{c.letterGrade}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:       { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:      { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 },
  sub:        { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 },
  errorBanner:{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  th:         { textAlign: 'left' as const, padding: '14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  td:         { padding: '12px 14px', fontSize: 13.5, color: 'var(--text)' },
}
