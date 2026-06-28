'use client'

import { useState } from 'react'

const ASSIGNMENT_TYPES = ['Daily', 'Minor', 'Major'] as const
type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]

const DEFAULT_WEIGHTS: Record<AssignmentType, number> = {
  Daily: 0.10,
  Minor: 0.30,
  Major: 0.60,
}

interface ExistingAssignment {
  score: number | null
  total: number | null
  category: string
}

interface Hypothetical {
  title: string
  grade: number
  type: AssignmentType
}

interface WhatIfScorerProps {
  currentAverage: number
  existingAssignments: ExistingAssignment[]
  categoryWeights?: Record<string, number>
  onClose: () => void
}

function normalizeCat(raw: string): AssignmentType | null {
  const s = raw.toLowerCase()
  if (s.includes('daily')) return 'Daily'
  if (s.includes('minor')) return 'Minor'
  if (s.includes('major')) return 'Major'
  return null
}

function avg(grades: number[]): number {
  return grades.reduce((s, g) => s + g, 0) / grades.length
}

function recalculate(
  existing: ExistingAssignment[],
  hyps: Hypothetical[],
  weights: Record<string, number>,
  currentAverage: number,
): { simAvg: number; firstInCat: AssignmentType[] } {
  // Group existing graded assignments by category
  const existingByCat: Partial<Record<AssignmentType, number[]>> = {}
  for (const a of existing) {
    if (a.score === null || a.total === null || a.total <= 0) continue
    const cat = normalizeCat(a.category)
    if (!cat) continue
    ;(existingByCat[cat] ??= []).push((a.score / a.total) * 100)
  }

  // Group simulated grades by type
  const hypsByCat: Partial<Record<AssignmentType, number[]>> = {}
  for (const h of hyps) {
    ;(hypsByCat[h.type] ??= []).push(h.grade)
  }

  // For each affected category:
  //   delta = (new_cat_avg − old_cat_avg) × weight
  // old_avg = 0 when category has no existing grades (simulated grade is the first).
  // Then: simulated = currentAverage + Σ(deltas)
  let totalDelta = 0
  const firstInCat: AssignmentType[] = []

  for (const [cat, simGrades] of Object.entries(hypsByCat) as [AssignmentType, number[]][]) {
    const w = weights[cat] ?? DEFAULT_WEIGHTS[cat] ?? 0
    const existingGrades = existingByCat[cat] ?? []

    if (existingGrades.length === 0) firstInCat.push(cat)

    const oldAvg = existingGrades.length > 0 ? avg(existingGrades) : 0
    const newAvg = avg([...existingGrades, ...simGrades])
    totalDelta += (newAvg - oldAvg) * w
  }

  return { simAvg: currentAverage + totalDelta, firstInCat }
}

export default function WhatIfScorer({
  currentAverage,
  existingAssignments,
  categoryWeights,
  onClose,
}: WhatIfScorerProps) {
  const weights = { ...DEFAULT_WEIGHTS, ...categoryWeights }

  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState('')
  const [type, setType] = useState<AssignmentType>('Daily')
  const [hyps, setHyps] = useState<Hypothetical[]>([])

  function add() {
    const g = parseFloat(grade)
    if (isNaN(g) || g < 0 || g > 100) return
    setHyps(prev => [...prev, { title: title.trim() || 'Untitled', grade: g, type }])
    setTitle('')
    setGrade('')
  }

  const { simAvg, firstInCat } = hyps.length > 0
    ? recalculate(existingAssignments, hyps, weights, currentAverage)
    : { simAvg: currentAverage, firstInCat: [] }

  const delta = simAvg - currentAverage
  const deltaColor = delta > 0.005 ? '#22C55E' : delta < -0.005 ? '#EF4444' : 'var(--text-muted)'

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <span style={S.label}>What-If Scorer</span>
        <button onClick={onClose} style={S.closeBtn}>✕ Close</button>
      </div>

      <div style={S.scoreRow}>
        <div>
          <div style={S.scoreTag}>Current</div>
          <div style={S.scoreNum}>{currentAverage.toFixed(2)}%</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>→</span>
        <div>
          <div style={S.scoreTag}>Simulated</div>
          <div style={{ ...S.scoreNum, color: hyps.length > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
            {simAvg.toFixed(2)}%
          </div>
        </div>
        {hyps.length > 0 && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' as const }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: deltaColor }}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      <div style={S.inputRow}>
        <input className="ns-input" style={{ flex: 2, height: 36, fontSize: 12 }} type="text"
          value={title} onChange={e => setTitle(e.target.value)} placeholder="Assignment title" />
        <input className="ns-input" style={{ flex: 1, height: 36, fontSize: 12, textAlign: 'right' as const }}
          type="number" min="0" max="100"
          value={grade} onChange={e => setGrade(e.target.value)} placeholder="Grade"
          onKeyDown={e => e.key === 'Enter' && add()} />
      </div>

      <div style={S.ctaRow}>
        <select className="ns-input" style={{ height: 34, fontSize: 12, width: 'auto', paddingRight: 8 }}
          value={type} onChange={e => setType(e.target.value as AssignmentType)}>
          {ASSIGNMENT_TYPES.map(t => (
            <option key={t} value={t}>
              {t} ({Math.round((weights[t] ?? DEFAULT_WEIGHTS[t]) * 100)}%)
            </option>
          ))}
        </select>
        <button className="ns-btn-primary" style={{ height: 34, padding: '0 16px', fontSize: 12 }}
          onClick={add} disabled={!grade}>
          + Add
        </button>
        {hyps.length > 0 && (
          <button className="ns-btn-ghost" style={{ height: 34, padding: '0 12px', fontSize: 12 }}
            onClick={() => setHyps([])}>
            Clear all
          </button>
        )}
      </div>

      {hyps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {hyps.map((h, i) => (
            <div key={i} style={S.hypRow}>
              <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{h.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>{h.type}</span>
              <span style={{ fontWeight: 500 }}>{h.grade}%</span>
              <button onClick={() => setHyps(p => p.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 8, fontSize: 12, padding: '0 2px' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {firstInCat.length > 0 && (
        <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, color: '#D97706', lineHeight: 1.5 }}>
          No existing {firstInCat.join(', ')} grades — simulating as your first assignment in {firstInCat.length > 1 ? 'those categories' : 'that category'}.
        </div>
      )}

      {!categoryWeights && (
        <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, color: '#D97706', lineHeight: 1.5 }}>
          Weights not detected from HAC — using Katy ISD defaults (Daily 10% / Minor 30% / Major 60%). Refresh your Grades page to sync actual weights.
        </div>
      )}
      {categoryWeights && (
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Using weights from HAC: Daily {Math.round(weights.Daily * 100)}% / Minor {Math.round(weights.Minor * 100)}% / Major {Math.round(weights.Major * 100)}%.
        </p>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap:     { background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 10, padding: '14px 16px' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label:    { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.7px', color: 'var(--text-muted)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 },
  scoreTag: { fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 },
  scoreNum: { fontSize: 18, fontWeight: 700, color: 'var(--text)' },
  inputRow: { display: 'flex', gap: 8, marginBottom: 8 },
  ctaRow:   { display: 'flex', gap: 8, alignItems: 'center' },
  hypRow:   { display: 'flex', alignItems: 'center', background: 'var(--surface-2)', borderRadius: 6, padding: '6px 10px', fontSize: 12 },
}
