'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

// ── GPA helpers ─────────────────────────────────────────────────────────────

function numericToLetter(avg: number): string {
  if (avg >= 90) return 'A'
  if (avg >= 80) return 'B'
  if (avg >= 70) return 'C'
  if (avg >= 60) return 'D'
  return 'F'
}

function letterToPoints(letter: string, weighted: boolean): number {
  const base: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
  return (base[letter.charAt(0).toUpperCase()] ?? 0) + (weighted ? 1 : 0)
}

function calcGPA(
  courses: Array<{ average: number; weighted: boolean; hypo?: number }>,
): { uw: number; w: number } {
  const gradable = courses.filter(c => (c.hypo ?? c.average) > 0)
  if (!gradable.length) return { uw: 0, w: 0 }
  let uw = 0, w = 0
  for (const c of gradable) {
    const letter = numericToLetter(c.hypo ?? c.average)
    uw += letterToPoints(letter, false)
    w  += letterToPoints(letter, c.weighted)
  }
  return {
    uw: Math.round((uw / gradable.length) * 100) / 100,
    w:  Math.round((w  / gradable.length) * 100) / 100,
  }
}

const LETTER_COLORS: Record<string, string> = { A: '#22C55E', B: '#10B981', C: '#F59E0B', D: '#F97316', F: '#EF4444' }
const letterColor = (g: string) => LETTER_COLORS[g?.charAt(0)?.toUpperCase()] ?? 'var(--text-muted)'

// ── Types ────────────────────────────────────────────────────────────────────

interface SimCourse {
  id: string
  name: string
  period: string
  average: number
  weighted: boolean
  hypo: string
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WhatIfGpaPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<SimCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.portalGrades()
      .then(r => {
        setCourses((r.grades ?? []).map(c => ({
          id: c.id,
          name: c.name,
          period: c.period,
          average: c.average ?? 0,
          weighted: /^(AP|Pre-AP|Dual|IB)\b/i.test(c.name),
          hypo: '',
        })))
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load grades'))
      .finally(() => setLoading(false))
  }, [])

  const current   = calcGPA(courses.map(c => ({ average: c.average, weighted: c.weighted })))
  const simulated = calcGPA(courses.map(c => ({
    average: c.average,
    weighted: c.weighted,
    hypo: c.hypo !== '' ? (parseFloat(c.hypo) || undefined) : undefined,
  })))
  const hasChanges = courses.some(c => c.hypo !== '')
  const uwDelta = simulated.uw - current.uw
  const wDelta  = simulated.w  - current.w

  function updateHypo(id: string, val: string) {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, hypo: val } : c))
  }
  function clearAll() {
    setCourses(prev => prev.map(c => ({ ...c, hypo: '' })))
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading grades…</div>

  return (
    <div className="fade-up">
      <button onClick={() => router.push('/grades')} style={S.back}>← Grade Portal</button>
      <h1 style={S.title}>GPA What-If Calculator</h1>
      <p style={S.sub}>Change a course&apos;s final grade to see how your GPA would change.</p>

      {error && (
        <div style={S.errorBanner}>
          {error}
          {error.toLowerCase().includes('session') && (
            <span> — <a href="/settings" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>reconnect in Settings</a></span>
          )}
        </div>
      )}

      {courses.length > 0 && (
        <>
          {/* GPA summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="ns-card" style={{ padding: 20 }}>
              <div style={S.gpaLabel}>Unweighted GPA</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
                <div style={S.gpaNum}>{current.uw.toFixed(2)}</div>
                {hasChanges && (
                  <div style={{ paddingBottom: 4 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                      {simulated.uw.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: uwDelta >= 0 ? '#22C55E' : '#EF4444' }}>
                      {uwDelta >= 0 ? '+' : ''}{uwDelta.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              <div style={S.gpaNote}>Standard 4.0 scale</div>
            </div>

            <div className="ns-card" style={{ padding: 20 }}>
              <div style={S.gpaLabel}>Weighted GPA</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
                <div style={S.gpaNum}>{current.w.toFixed(2)}</div>
                {hasChanges && (
                  <div style={{ paddingBottom: 4 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                      {simulated.w.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: wDelta >= 0 ? '#22C55E' : '#EF4444' }}>
                      {wDelta >= 0 ? '+' : ''}{wDelta.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
              <div style={S.gpaNote}>AP/Pre-AP/Dual courses +1.0</div>
            </div>
          </div>

          {hasChanges && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={clearAll} style={S.clearBtn}>Clear all changes</button>
            </div>
          )}

          {/* Course rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map(c => {
              const effectiveAvg = c.hypo !== '' ? (parseFloat(c.hypo) || c.average) : c.average
              const letter = numericToLetter(effectiveAvg)
              const isChanged = c.hypo !== ''

              return (
                <div key={c.id} className="ns-card"
                  style={{ ...S.courseRow, borderColor: isChanged ? 'rgba(0,200,150,0.3)' : 'var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                      <span style={S.courseName}>{c.period ? `P${c.period} — ` : ''}{c.name}</span>
                      {c.weighted && <span style={S.weightedBadge}>Weighted</span>}
                    </div>
                    <div style={S.currentAvg}>Current: {c.average.toFixed(1)}% ({numericToLetter(c.average)})</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <div style={{ position: 'relative' as const }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={c.hypo}
                        onChange={e => updateHypo(c.id, e.target.value)}
                        placeholder={c.average.toFixed(1)}
                        className="ns-input"
                        style={{ width: 80, height: 36, textAlign: 'right' as const, fontSize: 13,
                          borderColor: isChanged ? 'var(--primary)' : undefined }}
                      />
                      {isChanged && (
                        <button onClick={() => updateHypo(c.id, '')}
                          style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18,
                            borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, width: 32, textAlign: 'center' as const,
                      color: letterColor(letter) }}>
                      {letter}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p style={S.disclaimer}>
            Type a new average (0–100) next to any course to simulate your GPA.
            AP/Pre-AP/Dual courses are automatically weighted +1.0.
          </p>
        </>
      )}

      {!loading && !error && courses.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          No grade data available. Connect your portal in Settings.
        </p>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  back:         { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 },
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 },
  sub:          { fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 },
  errorBanner:  { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--error)', fontSize: 13, marginBottom: 16 },
  gpaLabel:     { fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  gpaNum:       { fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', lineHeight: 1 },
  gpaNote:      { fontSize: 11, color: 'var(--text-muted)', marginTop: 6 },
  clearBtn:     { background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: '6px 14px' },
  courseRow:    { display: 'flex', alignItems: 'center', padding: '14px 18px', transition: 'border-color 0.15s', gap: 16 },
  courseName:   { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  weightedBadge:{ fontSize: 10.5, padding: '2px 7px', borderRadius: 4, background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)', flexShrink: 0 },
  currentAvg:   { fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 },
  disclaimer:   { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const, marginTop: 16, lineHeight: 1.5 },
}
