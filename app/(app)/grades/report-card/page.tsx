'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, type NormalizedCourse } from '../../../../lib/api'
import WhatIfScorer from '../../../../components/ui/WhatIfScorer'

const GRADE_COLOR: Record<string, string> = { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' }
const gradeColor = (g: string | null) => !g ? 'var(--text-muted)' : GRADE_COLOR[g.charAt(0).toUpperCase()] ?? 'var(--text-muted)'

type SortKey = 'name' | 'period' | 'grade' | 'percentage'
type SortDir = 'asc' | 'desc'

export default function ReportCardPage() {
  const router = useRouter()
  const [courses, setCourses]   = useState<NormalizedCourse[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [sortKey, setSortKey]   = useState<SortKey>('period')
  const [sortDir, setSortDir]   = useState<SortDir>('asc')
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())
  const [tabMap, setTabMap]       = useState<Record<string, 'graded' | 'upcoming'>>({})
  const [openWhatIf, setOpenWhatIf] = useState<string | null>(null)

  useEffect(() => {
    api.portalGrades()
      .then(r => setCourses(r.grades ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load grades'))
      .finally(() => setLoading(false))
  }, [])

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function toggleRow(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading report card…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>Report Card</h1>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {courses.length === 0 && !error && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No live grades available. Connect your school portal in Settings.</p>
      )}

      {courses.length > 0 && (() => {
        const sorted = [...courses].sort((a, b) => {
          const va = sortKey === 'name' ? a.name : sortKey === 'period' ? a.period : sortKey === 'grade' ? (a.letterGrade ?? 'Z') : (a.average ?? -1)
          const vb = sortKey === 'name' ? b.name : sortKey === 'period' ? b.period : sortKey === 'grade' ? (b.letterGrade ?? 'Z') : (b.average ?? -1)
          return va < vb ? (sortDir === 'asc' ? -1 : 1) : va > vb ? (sortDir === 'asc' ? 1 : -1) : 0
        })
        const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
          <th onClick={() => handleSort(k)} style={{ ...S.th, cursor: 'pointer', color: sortKey === k ? 'var(--primary)' : 'var(--text-muted)' }}>
            {label}{sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </th>
        )
        return (
          <div className="ns-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <thead>
                <tr>
                  <SortTh k="name" label="Course" />
                  <th style={S.th}>Teacher</th>
                  <SortTh k="period" label="Period" />
                  <SortTh k="grade" label="Grade" />
                  <SortTh k="percentage" label="%" />
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.flatMap(c => {
                  const isExpanded = expanded.has(c.id)
                  const tab = tabMap[c.id] ?? 'graded'
                  const rows = tab === 'graded' ? c.assignments : c.upcomingAssignments
                  return [
                    <tr key={c.id} className="ns-tr"
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => toggleRow(c.id)}>
                      <td style={S.td}>{c.name} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span></td>
                      <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.teacher || '—'}</td>
                      <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.period || '—'}</td>
                      <td style={S.td}>
                        {c.letterGrade ? <span style={{ color: gradeColor(c.letterGrade), fontWeight: 700, fontSize: 16 }}>{c.letterGrade}</span> : '—'}
                      </td>
                      <td style={{ ...S.td, color: 'var(--text-secondary)' }}>{c.average !== null ? `${c.average.toFixed(1)}%` : '—'}</td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenWhatIf(openWhatIf === c.id ? null : c.id)}
                          style={{ background: openWhatIf === c.id ? 'var(--primary)' : 'var(--primary-dim)', border: '1px solid var(--primary)', color: openWhatIf === c.id ? '#000' : 'var(--primary)', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          What-If
                        </button>
                      </td>
                    </tr>,
                    openWhatIf === c.id && (
                      <tr key={`${c.id}-whatif`}>
                        <td colSpan={6} style={{ background: 'rgba(0,0,0,0.15)', padding: '12px 20px' }}>
                          <WhatIfScorer
                            currentAverage={c.average ?? 0}
                            existingAssignments={c.assignments.map(a => ({ score: a.score, total: a.totalPoints }))}
                            onClose={() => setOpenWhatIf(null)}
                          />
                        </td>
                      </tr>
                    ),
                    isExpanded && (
                      <tr key={`${c.id}-exp`}>
                        <td colSpan={6} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 20px' }}>
                          <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                            {(['graded', 'upcoming'] as const).map(t => (
                              <button key={t} onClick={e => { e.stopPropagation(); setTabMap(p => ({ ...p, [c.id]: t })) }}
                                style={{ background: 'none', border: 'none', padding: '6px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer' }}>
                                {t === 'graded' ? `Graded (${c.assignments.length})` : `Upcoming (${c.upcomingAssignments.length})`}
                              </button>
                            ))}
                          </div>
                          {rows.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>No {tab} assignments.</p>
                            : <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12.5 }}>
                                <thead><tr>{['Assignment','Category','Due','Score'].map(h => <th key={h} style={{ textAlign: 'left' as const, padding: '4px 8px', color: 'var(--text-muted)', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const }}>{h}</th>)}</tr></thead>
                                <tbody>{rows.map((a, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: '7px 8px', color: 'var(--text)' }}>{a.name}</td>
                                    <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{a.category}</td>
                                    <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{a.dateDue || '—'}</td>
                                    <td style={{ padding: '7px 8px' }}>{a.score !== null && a.totalPoints !== null ? `${a.score}/${a.totalPoints}` : '—'}</td>
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
        )
      })()}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:       { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:      { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 20 },
  errorBanner:{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  th:         { textAlign: 'left' as const, padding: '14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', transition: 'color 0.1s' },
  td:         { padding: '12px 14px', fontSize: 13.5 },
}
