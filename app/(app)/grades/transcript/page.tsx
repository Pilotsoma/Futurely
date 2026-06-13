'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

type TranscriptCourse = { name: string; grade: string; credits: string }
type Semester = { year: string; semester: string; courses: TranscriptCourse[] }
interface TranscriptData {
  semesters: Semester[]
  cumulativeGPA: string | null
  classRank: string | null
}

export default function TranscriptPage() {
  const router = useRouter()
  const [data, setData]     = useState<TranscriptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    api.portalTranscript()
      .then(r => setData(r.transcript as TranscriptData))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load transcript'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading transcript…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Transcript</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {/* GPA hero */}
      <div className="ns-card" style={S.gpaHero}>
        <p style={S.gpaLabel}>Cumulative GPA</p>
        <p style={S.gpaValue}>{data?.cumulativeGPA ?? '—'}</p>
        {data?.classRank && <p style={S.gpaRank}>Class Rank: {data.classRank}</p>}
      </div>

      {/* Semester tables */}
      {(data?.semesters ?? []).length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No transcript data available. Connect your school portal in Settings.
        </p>
      )}

      {(data?.semesters ?? []).map((sem, i) => (
        <div key={i} className="ns-card" style={S.semCard}>
          <p style={S.semTitle}>{sem.year || 'N/A'} — Semester {sem.semester || String(i + 1)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['Course', 'Grade', 'Credits'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sem.courses.map((c, j) => (
                <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={S.td}>{c.name}</td>
                  <td style={{ ...S.td, fontWeight: 600 }}>{c.grade || '—'}</td>
                  <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.credits || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:       { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:      { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner:{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  gpaHero:    { padding: '24px 28px', marginBottom: 20, background: 'rgba(0,200,150,0.06)', border: '1px solid rgba(0,200,150,0.2)' },
  gpaLabel:   { fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 6 },
  gpaValue:   { fontSize: 52, fontWeight: 800, letterSpacing: '-2px', color: 'var(--primary)', lineHeight: 1 },
  gpaRank:    { fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 },
  semCard:    { padding: '18px 20px', marginBottom: 14 },
  semTitle:   { fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 },
  th:         { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  td:         { padding: '10px 10px', fontSize: 13.5, color: 'var(--text)' },
}
