'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { api, ApiError, type CollegeInsights, type CollegeInsightsStep, type CollegeListItem, type CollegeSearchResult, type StudentData } from '../../../lib/api'
import { GraduationCapIcon } from '@/components/icons'

// ── Display helpers ────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 75) return '#22C55E'
  if (s >= 50) return '#F59E0B'
  if (s >= 25) return '#F97316'
  return '#EF4444'
}

const CATEGORY_COLORS: Record<CollegeInsightsStep['category'], string> = {
  test:            '#2979FF',
  gpa:             '#10B981',
  essay:           '#7C3AED',
  extracurricular: '#F97316',
  strategy:        '#00BCD4',
}

const PRIORITY_COLORS: Record<CollegeInsightsStep['priority'], string> = {
  high:   '#EF4444',
  medium: '#F59E0B',
  low:    '#52698A',
}

const PRIORITY_LABELS: Record<CollegeInsightsStep['priority'], string> = {
  high:   'High',
  medium: 'Med',
  low:    'Low',
}

// ── Insight state types ────────────────────────────────────────────────────────

type InsightState =
  | { status: 'loading' }
  | { status: 'error-404' }
  | { status: 'error-503'; retry: () => void }
  | { status: 'success'; data: CollegeInsights }

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightsSkeleton(): React.JSX.Element {
  return (
    <>
      <style>{`
        @keyframes nsInsightPulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.7;  }
        }
        .ns-skeleton-bar {
          background: var(--surface-2);
          border-radius: 5px;
          animation: nsInsightPulse 1.4s ease-in-out infinite;
        }
      `}</style>
      <div style={{ padding: '0 20px 20px' }}>
        <div className="ns-skeleton-bar" style={{ height: 13, width: '100%', marginBottom: 8 }} />
        <div className="ns-skeleton-bar" style={{ height: 13, width: '88%', marginBottom: 8 }} />
        <div className="ns-skeleton-bar" style={{ height: 13, width: '72%', marginBottom: 20 }} />
        {([80, 90, 65] as number[]).map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="ns-skeleton-bar" style={{ width: 52, height: 20, borderRadius: 4, flexShrink: 0 }} />
            <div className="ns-skeleton-bar" style={{ height: 13, width: `${w}%` }} />
          </div>
        ))}
      </div>
    </>
  )
}

function InsightsError({ message, onRetry }: { message: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</span>
      </div>
      {onRetry !== undefined && (
        <button onClick={onRetry} style={SI.retryBtn}>Try again</button>
      )}
    </div>
  )
}

function CategoryBadge({ category }: { category: CollegeInsightsStep['category'] }): React.JSX.Element {
  const color = CATEGORY_COLORS[category]
  return (
    <span style={{
      ...SI.badge,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
    }}>
      {category}
    </span>
  )
}

function PriorityDot({ priority }: { priority: CollegeInsightsStep['priority'] }): React.JSX.Element {
  const color = PRIORITY_COLORS[priority]
  return (
    <span style={{ ...SI.priorityChip, color, border: `1px solid ${color}55`, background: `${color}18` }}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function InsightsContent({ data }: { data: CollegeInsights }): React.JSX.Element {
  const generatedDate = new Date(data.generatedAt)
  const now = new Date()
  const diffMs = now.getTime() - generatedDate.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const timeLabel = diffHours < 1
    ? 'just now'
    : diffHours < 24
      ? `${diffHours}h ago`
      : `${Math.floor(diffHours / 24)}d ago`

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <p style={SI.narrative}>{data.narrativeSummary}</p>

      {data.actionableSteps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <span style={SI.sectionLabel}>Action Steps</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {data.actionableSteps.map((step, i) => (
              <div key={i} style={SI.stepRow}>
                <CategoryBadge category={step.category} />
                <span style={SI.stepText}>{step.step}</span>
                <PriorityDot priority={step.priority} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={SI.metaText}>Generated {timeLabel}</span>
        {data.cached && (
          <span style={SI.cachedBadge}>cached</span>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollegesPage() {
  const [list, setList]           = useState<CollegeListItem[]>([])
  const [profile, setProfile]     = useState<StudentData['profile'] | null>(null)
  const [portalGpa, setPortalGpa] = useState<{ unweightedGpa: number | null; weightedGpa: number | null } | null>(null)
  const [profileLoaded, setProfileLoaded]     = useState(false)
  const [portalGpaLoaded, setPortalGpaLoaded] = useState(false)
  const [query, setQuery]         = useState('')
  const [suggestions, setSuggestions] = useState<CollegeSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [adding, setAdding]       = useState<string | null>(null)
  const [removing, setRemoving]   = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [insightsCache, setInsightsCache] = useState<Record<number, InsightState>>({})
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef      = useRef<HTMLInputElement>(null)
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQueryRef = useRef('')

  useEffect(() => {
    api.collegeList().then(setList).catch(() => {})
    api.me().then(d => { setProfile(d.profile); setProfileLoaded(true) }).catch(() => { setProfileLoaded(true) })
    api.portalGpa().then(d => { setPortalGpa({ unweightedGpa: d.unweightedGpa, weightedGpa: d.weightedGpa }); setPortalGpaLoaded(true) }).catch(() => { setPortalGpaLoaded(true) })
  }, [])

  const statsReady = profileLoaded && portalGpaLoaded

  function handleQueryChange(value: string) {
    setQuery(value)
    setShowDropdown(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setSuggestions([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      const q = value
      currentQueryRef.current = q
      try {
        const results = await api.collegeSearch(q)
        if (currentQueryRef.current === q) {
          setSuggestions(results.slice(0, 8))
        }
      } catch {
        if (currentQueryRef.current === q) {
          setSuggestions([])
        }
      } finally {
        if (currentQueryRef.current === q) {
          setSearchLoading(false)
        }
      }
    }, 300)
  }

  const addedNames = new Set(list.map(l => l.name))

  async function handleAdd(name: string, scorecardUnitId?: string) {
    if (addedNames.has(name)) return
    setAdding(name)
    try {
      const item = await api.collegeAdd(name, scorecardUnitId)
      setList(prev => [...prev, item])
      setQuery('')
      setSuggestions([])
      setShowDropdown(false)
    } catch { /* duplicate or error — ignore */ }
    finally { setAdding(null) }
  }

  async function handleRemove(id: number) {
    setRemoving(id)
    try {
      await api.collegeRemove(id)
      setList(prev => prev.filter(i => i.id !== id))
      if (expandedId === id) setExpandedId(null)
      setInsightsCache(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch { /* ignore */ }
    finally { setRemoving(null) }
  }

  async function fetchInsights(id: number): Promise<void> {
    setInsightsCache(prev => ({ ...prev, [id]: { status: 'loading' } }))
    try {
      const data = await api.collegeInsights(id)
      setInsightsCache(prev => ({ ...prev, [id]: { status: 'success', data } }))
    } catch (err) {
      const httpStatus = err instanceof ApiError ? err.httpStatus : undefined
      if (httpStatus === 503) {
        setInsightsCache(prev => ({
          ...prev,
          [id]: { status: 'error-503', retry: () => { void fetchInsights(id) } },
        }))
      } else {
        setInsightsCache(prev => ({ ...prev, [id]: { status: 'error-404' } }))
      }
    }
  }

  function handleToggleInsights(id: number): void {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (insightsCache[id] !== undefined) return
    void fetchInsights(id)
  }

  // Wait for both APIs to settle before computing stats
  const unweightedGpa = statsReady ? ((portalGpa?.unweightedGpa ?? 0) > 0 ? portalGpa!.unweightedGpa : (profile?.unweightedGpa ?? null)) : null
  const weightedGpa   = statsReady ? ((portalGpa?.weightedGpa ?? 0) > 0   ? portalGpa!.weightedGpa   : (profile?.weightedGpa   ?? null)) : null
  const studentSAT    = statsReady ? (profile?.satScore ?? null) : null
  const hasStats      = statsReady && ((unweightedGpa && unweightedGpa > 0) || (studentSAT && studentSAT > 0))

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>College List</h1>
          <p style={S.sub}>Search and track the colleges you want to get into.</p>
        </div>
      </div>

      {/* Stats context */}
      {!hasStats && (
        <div className="ns-card" style={{ ...S.warnCard }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Add your GPA and SAT score in <a href="/settings" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Settings</a> to see your likelihood scores.</span>
        </div>
      )}
      {hasStats && (
        <div className="ns-card" style={S.statsRow}>
          <div style={S.statChip}>
            <span style={S.statLabel}>Unweighted GPA</span>
            <span style={S.statVal}>{unweightedGpa?.toFixed(3) ?? '—'}</span>
          </div>
          <div style={S.statDivider} />
          <div style={S.statChip}>
            <span style={S.statLabel}>Weighted GPA</span>
            <span style={S.statVal}>{weightedGpa?.toFixed(3) ?? '—'}</span>
          </div>
          <div style={S.statDivider} />
          <div style={S.statChip}>
            <span style={S.statLabel}>Your SAT</span>
            <span style={S.statVal}>{studentSAT ?? '—'}</span>
          </div>
          <div style={S.statDivider} />
          <div style={S.statChip}>
            <span style={S.statLabel}>Colleges Added</span>
            <span style={S.statVal}>{list.length}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <div style={S.searchWrap}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            className="ns-input"
            style={S.searchInput}
            placeholder="Search colleges…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          />
          {query && (
            <button onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false) }} style={S.clearBtn}>×</button>
          )}
        </div>

        {showDropdown && query.trim().length > 0 && (searchLoading || suggestions.length > 0) && (
          <div style={S.dropdown}>
            {searchLoading && suggestions.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>Searching…</div>
            )}
            {suggestions.map(c => {
              const already = addedNames.has(c.name)
              return (
                <button
                  key={c.unitId}
                  style={{ ...S.dropdownRow, opacity: already ? 0.5 : 1 }}
                  onClick={() => !already && handleAdd(c.name, c.unitId)}
                  disabled={already || adding === c.name}
                >
                  <div style={{ flex: 1, textAlign: 'left' as const }}>
                    <div style={S.dropdownName}>{c.name}</div>
                    <div style={S.dropdownMeta}>{[c.city, c.state].filter(Boolean).join(', ') || 'College'}</div>
                  </div>
                  {c.score !== null && (
                    <span style={{ ...S.dropdownScore, color: scoreColor(c.score) }}>{c.score}</span>
                  )}
                  {already
                    ? <span style={S.addedBadge}>Added</span>
                    : <span style={S.addBtn}>{adding === c.name ? '…' : '+'}</span>
                  }
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* College list */}
      {list.length === 0 ? (
        <div className="ns-card" style={S.empty}>
          <div style={{ marginBottom: 10 }}><GraduationCapIcon size={32}/></div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No colleges yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Search above to add colleges you're interested in.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(item => {
            const score = item.score
            const color = score !== null ? scoreColor(score) : 'var(--text-muted)'
            const label = item.label
            const isExpanded = expandedId === item.id
            const insight = insightsCache[item.id]

            return (
              <div key={item.id} className="ns-card" style={{ overflow: 'hidden', padding: 0 }}>
                {/* Clickable card row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`View admission insights for ${item.name}`}
                  style={{ ...S.collegeCardRow, cursor: 'pointer' }}
                  onClick={() => handleToggleInsights(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToggleInsights(item.id)
                    }
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.collegeName}>{item.name}</div>
                    {(item.city || item.state) && (
                      <div style={S.collegeMeta}>{[item.city, item.state].filter(Boolean).join(', ')}</div>
                    )}
                    {score !== null && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Likelihood</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                        </div>
                        <div style={S.barTrack}>
                          <div style={{ ...S.barFill, width: `${score}%`, background: color }} />
                        </div>
                      </div>
                    )}
                    {score === null && !hasStats && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Add GPA & SAT in Settings to see score</div>
                    )}
                  </div>

                  <div style={S.scoreBox}>
                    {score !== null ? (
                      <>
                        <div style={{ ...S.scoreNum, color }}>{score}</div>
                        <div style={S.scoreOut}>/100</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const }}>No<br/>data</div>
                    )}
                  </div>

                  {/* Expand/collapse chevron */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    style={{
                      flexShrink: 0,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>

                  <button
                    onClick={(e) => { e.stopPropagation(); void handleRemove(item.id) }}
                    disabled={removing === item.id}
                    style={S.removeBtn}
                    title="Remove"
                    aria-label={`Remove ${item.name}`}
                  >
                    {removing === item.id ? '…' : '×'}
                  </button>
                </div>

                {/* Insights panel */}
                {isExpanded && (
                  <div style={S.insightsDivider}>
                    <div style={{ height: 1, background: 'var(--border)' }} />
                    <div style={{ paddingTop: 16 }}>
                      {(insight === undefined || insight.status === 'loading') && <InsightsSkeleton />}
                      {insight?.status === 'error-404' && (
                        <InsightsError message="We don't have enough admissions data for this college yet." />
                      )}
                      {insight?.status === 'error-503' && (
                        <InsightsError
                          message="Insights are temporarily unavailable — try again in a bit."
                          onRetry={insight.retry}
                        />
                      )}
                      {insight?.status === 'success' && (
                        <InsightsContent data={insight.data} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  header:       { marginBottom: 24 },
  title:        { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 },
  sub:          { fontSize: 13, color: 'var(--text-secondary)' },
  warnCard:     { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 },
  statsRow:     { display: 'flex', alignItems: 'center', padding: '14px 20px', marginBottom: 20, gap: 0 },
  statChip:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statLabel:    { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  statVal:      { fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' },
  statDivider:  { width: 1, height: 36, background: 'var(--border)', flexShrink: 0 },
  searchWrap:   { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 14px', height: 44 },
  searchInput:  { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', padding: 0 },
  clearBtn:     { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 },
  dropdown:     { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden' },
  dropdownRow:  { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' },
  dropdownName: { fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  dropdownMeta: { fontSize: 11.5, color: 'var(--text-muted)' },
  dropdownScore:{ fontSize: 15, fontWeight: 800, minWidth: 32, textAlign: 'right' as const },
  addedBadge:   { fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap' as const },
  addBtn:       { fontSize: 18, fontWeight: 300, color: 'var(--primary)', lineHeight: 1, padding: '0 4px' },
  empty:        { padding: 48, textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  collegeCardRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px' },
  collegeName:  { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  collegeMeta:  { fontSize: 12, color: 'var(--text-muted)' },
  barTrack:     { height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
  scoreBox:     { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, minWidth: 52 },
  scoreNum:     { fontSize: 28, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 },
  scoreOut:     { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  removeBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 },
  insightsDivider: { padding: '0 0 0 0' },
}

const SI: Record<string, React.CSSProperties> = {
  retryBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '5px 12px',
    fontWeight: 500,
  },
  narrative: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    margin: 0,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    color: 'var(--text-muted)',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '9px 12px',
    background: 'var(--surface-2)',
    borderRadius: 8,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: 'var(--text)',
    lineHeight: 1.5,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    padding: '3px 7px',
    borderRadius: 4,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    marginTop: 2,
  },
  priorityChip: {
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 6px',
    borderRadius: 4,
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  cachedBadge: {
    fontSize: 10,
    color: 'var(--text-muted)',
    padding: '2px 6px',
    border: '1px solid var(--border)',
    borderRadius: 4,
  },
}
