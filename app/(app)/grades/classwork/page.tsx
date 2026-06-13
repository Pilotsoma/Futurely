'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import WhatIfScorer from '../../../../components/ui/WhatIfScorer'

const BASE = ''

interface Assignment {
  name: string
  category: string
  score: number | null
  totalPoints: number | null
  percentage: string
  dateDue: string
}

interface Course {
  name: string
  period: string
  teacher: string
  room: string
  average: string | null
  scores: Assignment[]
}

const GRADE_COLOR: Record<string, string> = { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' }

function letterFromAvg(avg: string | null): string {
  if (!avg) return ''
  const n = parseFloat(avg)
  if (isNaN(n)) return avg.charAt(0).toUpperCase()
  if (n >= 90) return 'A'
  if (n >= 80) return 'B'
  if (n >= 70) return 'C'
  if (n >= 60) return 'D'
  return 'F'
}

function avgColor(avg: string | null): string {
  const letter = letterFromAvg(avg)
  return GRADE_COLOR[letter] ?? 'var(--text-muted)'
}

export default function ClassworkPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [tabMap, setTabMap] = useState<Record<number, 'assignments' | 'upcoming'>>({})
  const [openWhatIf, setOpenWhatIf] = useState<number | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ns_token') : null
    fetch(`${BASE}/api/integrations/grades/classwork`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((json: { data?: { classes?: Course[] }; error?: { message?: string } | string }) => {
        if (json.error) {
          const msg = typeof json.error === 'string' ? json.error : (json.error?.message ?? 'Failed to load grades')
          setError(msg)
          return
        }
        setCourses(json.data?.classes ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load grades'))
      .finally(() => setLoading(false))
  }, [])

  function toggleRow(i: number) {
    setExpanded(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading grades…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Grades</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {courses.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No grade data available. Connect your school portal in Settings.</p>
      )}

      {courses.length > 0 && (
        <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={S.th}>Course</th>
                <th style={S.th}>Teacher</th>
                <th style={S.th}>Period</th>
                <th style={S.th}>Avg</th>
                <th style={S.th}>Grade</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {courses.flatMap((c, i) => {
                const isExpanded = expanded.has(i)
                const tab = tabMap[i] ?? 'assignments'
                const rows = tab === 'assignments' ? c.scores : []
                const letter = letterFromAvg(c.average)
                return [
                  <tr key={i} className="ns-tr"
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => toggleRow(i)}>
                    <td style={S.td}>{c.name} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span></td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.teacher || '—'}</td>
                    <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.period || '—'}</td>
                    <td style={{ ...S.td, color: avgColor(c.average), fontWeight: 700 }}>{c.average ?? '—'}</td>
                    <td style={S.td}>
                      {letter ? <span style={{ color: GRADE_COLOR[letter] ?? 'var(--text-muted)', fontWeight: 700, fontSize: 16 }}>{letter}</span> : '—'}
                    </td>
                    <td style={S.td} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenWhatIf(openWhatIf === i ? null : i)}
                        style={{ background: openWhatIf === i ? 'var(--primary)' : 'var(--primary-dim)', border: '1px solid var(--primary)', color: openWhatIf === i ? '#000' : 'var(--primary)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        What-If
                      </button>
                    </td>
                  </tr>,
                  openWhatIf === i && (
                    <tr key={`${i}-whatif`}>
                      <td colSpan={6} style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 20px' }}>
                        <WhatIfScorer
                          currentAverage={parseFloat(c.average ?? '0') || 0}
                          existingAssignments={c.scores.map(a => ({ score: a.score, total: a.totalPoints }))}
                          onClose={() => setOpenWhatIf(null)}
                        />
                      </td>
                    </tr>
                  ),
                  isExpanded && (
                    <tr key={`${i}-exp`}>
                      <td colSpan={6} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                          {(['assignments'] as const).map(t => (
                            <button key={t} onClick={e => { e.stopPropagation(); setTabMap(p => ({ ...p, [i]: t })) }}
                              style={{ background: 'none', border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--primary)', borderBottom: '2px solid var(--primary)', cursor: 'pointer' }}>
                              Assignments ({c.scores.length})
                            </button>
                          ))}
                        </div>
                        {rows.length === 0
                          ? <p style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>No assignments found.</p>
                          : <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5 }}>
                              <thead><tr>{['Assignment','Category','Due','Score'].map(h => <th key={h} style={{ textAlign: 'left' as const, padding: '4px 8px', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const }}>{h}</th>)}</tr></thead>
                              <tbody>{rows.map((a, j) => (
                                <tr key={j} style={{ borderTop: '1px solid var(--border)' }}>
                                  <td style={{ padding: '7px 8px', color: 'var(--text)' }}>{a.name}</td>
                                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{a.category || '—'}</td>
                                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{a.dateDue || '—'}</td>
                                  <td style={{ padding: '7px 8px' }}>
                                    {a.score !== null && a.totalPoints !== null
                                      ? <span style={{ color: avgColor(String((a.score / (a.totalPoints || 1)) * 100)) }}>{a.score}/{a.totalPoints}</span>
                                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                  </td>
                                </tr>
                              ))}</tbody>
                            </table>}
                      </td>
                    </tr>
                  ),
                ].filter(Boolean)
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:        { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  th:          { textAlign: 'left' as const, padding: '14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--text-muted)' },
  td:          { padding: '12px 14px', fontSize: 13.5 },
}
