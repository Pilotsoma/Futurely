'use client'

import React, { useEffect, useState } from 'react'
import { api, type RoadmapData } from '../../../lib/api'
import PageLoader from '../../../components/ui/PageLoader'

// SVG progress ring math
// r=64 inside a 160x160 viewport
const RING_R = 64
const RING_CX = 80
const RING_CY = 80
const CIRCUMFERENCE = 2 * Math.PI * RING_R

function ProgressRing({ percentComplete }: { percentComplete: number }) {
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(Math.max(percentComplete, 0), 100) / 100)

  return (
    <div style={{ position: 'relative', width: 160, height: 160 }}>
      <svg
        width={160}
        height={160}
        style={{ transform: 'rotate(-90deg)' }}
        aria-label={`Progress toward graduation: ${percentComplete}%`}
        role="img"
      >
        {/* Track */}
        <circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={12}
        />
        {/* Progress arc */}
        <circle
          cx={RING_CX}
          cy={RING_CY}
          r={RING_R}
          fill="none"
          stroke="#A855F7"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#A855F7', lineHeight: 1, letterSpacing: '-1px' }}>
          {percentComplete}%
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 5 }}>
          toward graduation
        </span>
      </div>
    </div>
  )
}

export default function RoadmapPage() {
  const [data, setData]       = useState<RoadmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Personalized milestones load separately from the fast structured-data
  // fetch above, so the page renders immediately with the same generic
  // milestones every student used to see, then swaps in AI-personalized
  // ones a few seconds later without blocking anything.
  const [personalizedMilestones, setPersonalizedMilestones] = useState<RoadmapData['milestones'] | null>(null)
  const [personalizing, setPersonalizing] = useState(false)

  useEffect(() => {
    api.roadmap()
      .then(d => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load roadmap'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!data) return
    setPersonalizing(true)
    api.roadmapInsights()
      .then(({ milestones }) => setPersonalizedMilestones(milestones))
      .catch(() => {}) // AI personalization is best-effort — keep the generic milestones on failure
      .finally(() => setPersonalizing(false))
  }, [data])

  if (loading) return <PageLoader message="Loading your roadmap…" />

  if (error) {
    return (
      <div className="fade-up">
        <h1 style={S.title}>My Roadmap</h1>
        <div style={S.errorBanner}>{error}</div>
      </div>
    )
  }

  if (!data) return null

  const {
    gradeLevel, graduationYear, creditsCompleted, creditsRequired,
    percentComplete, creditsByCategory, weightedGpa, unweightedGpa,
  } = data
  const milestones = personalizedMilestones ?? data.milestones

  // Empty state check: no credits at all
  const hasNoCredits =
    creditsCompleted === 0 &&
    Object.values(creditsByCategory).every(v => v === 0)

  // Only show categories with credits > 0
  const activeCategories = Object.entries(creditsByCategory).filter(([, v]) => v > 0)

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={S.title}>My Roadmap</h1>
        {graduationYear !== null && (
          <p style={S.subtitle}>Class of {graduationYear}</p>
        )}
      </div>

      {/* ── Progress ring ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
        <ProgressRing percentComplete={percentComplete} />
      </div>

      {/* ── GPA tiles ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <div className="ns-card" style={{ flex: 1, padding: '16px 20px' }}>
          <div style={S.tileLabel}>Weighted GPA</div>
          <div style={S.tileNum}>{weightedGpa.toFixed(2)}</div>
        </div>
        <div className="ns-card" style={{ flex: 1, padding: '16px 20px' }}>
          <div style={S.tileLabel}>Unweighted GPA</div>
          <div style={S.tileNum}>{unweightedGpa.toFixed(2)}</div>
        </div>
      </div>

      {/* ── Credits by category OR empty state ───────────────────────────── */}
      {hasNoCredits ? (
        <div className="ns-card" style={{ padding: '32px 20px', textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎓</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            Connect your school account to see your transcript data here.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <div style={S.sectionLabel}>Credits by Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {activeCategories.map(([category, count]) => (
              <div key={category} style={S.categoryPill}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{category}</span>
                <span style={{
                  background: 'var(--primary-dim)',
                  color: 'var(--primary)',
                  borderRadius: 6,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginLeft: 6,
                }}>
                  {count} cr
                </span>
              </div>
            ))}
          </div>

          {/* Credits progress bar */}
          <div className="ns-card" style={{ padding: '14px 18px', marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              <span>Total credits</span>
              <span style={{ color: 'var(--text-secondary)' }}>{creditsCompleted} / {creditsRequired}</span>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 6,
                background: '#A855F7',
                width: `${Math.min((creditsCompleted / creditsRequired) * 100, 100)}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Milestone timeline ────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={S.sectionLabel}>4-Year Timeline</div>
          {personalizing && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Personalizing…</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {milestones.map(m => {
            const isCurrent = m.grade === gradeLevel
            const isFuture  = m.grade > gradeLevel && !m.done

            return (
              <div
                key={m.grade}
                className="ns-card"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderLeft: isCurrent ? '3px solid var(--primary)' : '3px solid transparent',
                  opacity: isFuture ? 0.55 : 1,
                }}
              >
                {/* Grade badge */}
                <div style={{
                  flexShrink: 0,
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: m.done ? 'rgba(168,85,247,0.15)' : isCurrent ? 'var(--primary-dim)' : 'var(--surface-2)',
                  border: m.done ? '1px solid rgba(168,85,247,0.3)' : isCurrent ? '1px solid var(--primary-glow)' : '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  color: m.done ? '#A855F7' : isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                }}>
                  {m.grade}
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isCurrent ? 600 : 500,
                    color: isFuture ? 'var(--text-muted)' : 'var(--text)',
                  }}>
                    {m.label}
                  </span>
                </div>

                {/* Status icon */}
                {m.done && (
                  <span style={{ flexShrink: 0, color: '#A855F7', fontSize: 16, fontWeight: 700 }}>✓</span>
                )}
                {isCurrent && !m.done && (
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 6, padding: '2px 8px' }}>
                    Current
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:       { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 },
  subtitle:    { fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 0 },
  errorBanner: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '12px 16px', color: 'var(--error)', fontSize: 13 },
  sectionLabel:{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  tileLabel:   { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 6 },
  tileNum:     { fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)', lineHeight: 1 },
  categoryPill:{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 12px', fontSize: 12.5 },
}
