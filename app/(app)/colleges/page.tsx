'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CatalogCollege, type CollegeListItem, type StudentData } from '../../../lib/api'

// ── Tier helpers ───────────────────────────────────────────────────────────────

type PredictTier = 'Safety' | 'Target' | 'Reach'

function tierColor(tier: PredictTier): string {
  if (tier === 'Safety') return '#22C55E'
  if (tier === 'Target') return '#F59E0B'
  return '#EF4444'
}

// ── Prediction cache entry ─────────────────────────────────────────────────────

interface PredictResult {
  probability: number
  tier: PredictTier
}

interface PredictState {
  status: 'loading' | 'ok' | 'error'
  data: PredictResult | null
  message: string | null
}

// ── College path types ─────────────────────────────────────────────────────────

interface CollegePathStep {
  type: 'quantitative' | 'qualitative'
  title: string
  description: string
  percentBoost: number
  source: 'model' | 'ai_estimate'
}

interface CollegePathResult {
  collegeName: string
  baselineProbability: number
  steps: CollegePathStep[]
}

interface CollegePathState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  data: CollegePathResult | null
  message: string | null
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CollegesPage() {
  const [list, setList]           = useState<CollegeListItem[]>([])
  const [profile, setProfile]     = useState<StudentData['profile'] | null>(null)
  const [portalGpa, setPortalGpa] = useState<{ unweightedGpa: number | null; weightedGpa: number | null } | null>(null)
  const [profileLoaded, setProfileLoaded]     = useState(false)
  const [portalGpaLoaded, setPortalGpaLoaded] = useState(false)

  // Search
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState<CatalogCollege[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // Per-item state
  const [adding, setAdding]   = useState<string | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)

  // Prediction cache keyed by catalog college id
  const [predictions, setPredictions] = useState<Record<number, PredictState>>({})
  // Catalog id cache for saved-list items keyed by CollegeListItem.id
  const [savedCatalogIds, setSavedCatalogIds] = useState<Record<number, number | null>>({})

  // ── Path-to-admission state ────────────────────────────────────────────────
  // Tracks which catalog id's path section is expanded (null = none)
  const [expandedPathCatalogId, setExpandedPathCatalogId] = useState<number | null>(null)
  // Cache of fetched path results keyed by catalog id — persisted so collapsing
  // and re-expanding does not refetch
  const [pathCache, setPathCache] = useState<Record<number, CollegePathState>>({})

  useEffect(() => {
    api.collegeList().then(setList).catch(() => {})
    api.me().then(d => {
      setProfile(d.profile)
      setProfileLoaded(true)
    }).catch(() => { setProfileLoaded(true) })
    api.portalGpa().then(d => {
      setPortalGpa({ unweightedGpa: d.unweightedGpa, weightedGpa: d.weightedGpa })
      setPortalGpaLoaded(true)
    }).catch(() => { setPortalGpaLoaded(true) })
  }, [])

  const statsReady = profileLoaded && portalGpaLoaded

  // Wait for both APIs before computing stats — prevents flash of wrong GPA
  const unweightedGpa = statsReady
    ? ((portalGpa?.unweightedGpa ?? 0) > 0 ? portalGpa!.unweightedGpa : (profile?.unweightedGpa ?? null))
    : null
  const weightedGpa = statsReady
    ? ((portalGpa?.weightedGpa ?? 0) > 0 ? portalGpa!.weightedGpa : (profile?.weightedGpa ?? null))
    : null
  const studentGPA = unweightedGpa
  const studentSAT = statsReady ? (profile?.satScore ?? null) : null
  const studentACT = statsReady ? (profile?.actScore ?? null) : null
  const hasStats   = statsReady && ((studentGPA && studentGPA > 0) || (studentSAT && studentSAT > 0))

  // ── Debounced catalog search ───────────────────────────────────────────────

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setShowDropdown(true)

    if (debounceRef.current !== null) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setSuggestions([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.collegeCatalog(value.trim(), 10)
        setSuggestions(results)
      } catch {
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)
  }, [])

  // ── Prediction fetch ───────────────────────────────────────────────────────

  const fetchPredict = useCallback(async (catalogId: number): Promise<void> => {
    if (!statsReady) return
    if (!studentGPA && !studentSAT) return

    // Already fetched or fetching
    setPredictions(prev => {
      if (prev[catalogId]) return prev
      return { ...prev, [catalogId]: { status: 'loading', data: null, message: null } }
    })

    const sat = studentSAT ?? 0
    const gpa = studentGPA ?? 0

    // The model needs both SAT and GPA — substituting a floor value for
    // whichever one is missing would skew the probability, not approximate it.
    if (sat <= 0 || gpa <= 0) {
      setPredictions(prev => ({
        ...prev,
        [catalogId]: { status: 'error', data: null, message: 'Add both GPA and SAT in Settings to see a probability' },
      }))
      return
    }

    try {
      const result = await api.collegePredict({
        collegeId: catalogId,
        studentSat: sat,
        studentAct: studentACT ?? null,
        studentGpa: gpa,
      })
      setPredictions(prev => ({
        ...prev,
        [catalogId]: { status: 'ok', data: { probability: result.probability, tier: result.tier }, message: null },
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null
      setPredictions(prev => ({
        ...prev,
        [catalogId]: { status: 'error', data: null, message: msg },
      }))
    }
  }, [statsReady, studentGPA, studentSAT, studentACT])

  // Trigger predictions for dropdown suggestions when stats are ready
  useEffect(() => {
    if (!hasStats) return
    for (const college of suggestions) {
      if (!predictions[college.id]) {
        void fetchPredict(college.id)
      }
    }
  }, [suggestions, hasStats, predictions, fetchPredict])

  // ── Resolve catalog id for saved list items ────────────────────────────────

  const resolveSavedCatalogId = useCallback(async (item: CollegeListItem): Promise<void> => {
    if (savedCatalogIds[item.id] !== undefined) return
    // Mark as resolving with sentinel -1 to avoid duplicate lookups
    setSavedCatalogIds(prev => ({ ...prev, [item.id]: -1 }))
    try {
      const results = await api.collegeCatalog(item.name, 5)
      const match = results.find(
        r => r.name.toLowerCase() === item.name.toLowerCase()
      )
      const catalogId = match?.id ?? null
      setSavedCatalogIds(prev => ({ ...prev, [item.id]: catalogId }))
      if (catalogId !== null && hasStats) {
        void fetchPredict(catalogId)
      }
    } catch {
      setSavedCatalogIds(prev => ({ ...prev, [item.id]: null }))
    }
  }, [savedCatalogIds, hasStats, fetchPredict])

  // Kick off catalog id resolution for every saved item
  useEffect(() => {
    if (!statsReady) return
    for (const item of list) {
      void resolveSavedCatalogId(item)
    }
  }, [list, statsReady, resolveSavedCatalogId])

  // Trigger predictions when catalog ids become known
  useEffect(() => {
    if (!hasStats) return
    for (const catalogId of Object.values(savedCatalogIds)) {
      if (catalogId !== null && catalogId > 0 && !predictions[catalogId]) {
        void fetchPredict(catalogId)
      }
    }
  }, [savedCatalogIds, hasStats, predictions, fetchPredict])

  // ── Path-to-admission fetch ────────────────────────────────────────────────

  const fetchCollegePath = useCallback(async (catalogId: number): Promise<void> => {
    // Already fetched — no-op (allows re-expand without refetch)
    const existing = pathCache[catalogId]
    if (existing && (existing.status === 'ok' || existing.status === 'loading')) return

    const sat = studentSAT ?? 0
    const gpa = studentGPA ?? 0
    if (sat <= 0 || gpa <= 0) return

    setPathCache(prev => ({
      ...prev,
      [catalogId]: { status: 'loading', data: null, message: null },
    }))

    try {
      const result = await api.collegePath({
        collegeId: catalogId,
        studentSat: sat,
        studentAct: studentACT ?? null,
        studentGpa: gpa,
      })
      setPathCache(prev => ({
        ...prev,
        [catalogId]: { status: 'ok', data: result, message: null },
      }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setPathCache(prev => ({
        ...prev,
        [catalogId]: { status: 'error', data: null, message: msg },
      }))
    }
  }, [pathCache, studentSAT, studentGPA, studentACT])

  const handleTogglePath = useCallback((catalogId: number) => {
    if (expandedPathCatalogId === catalogId) {
      // Collapse — do not discard cached result
      setExpandedPathCatalogId(null)
    } else {
      setExpandedPathCatalogId(catalogId)
      void fetchCollegePath(catalogId)
    }
  }, [expandedPathCatalogId, fetchCollegePath])

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const addedNames = new Set(list.map(l => l.name))

  async function handleAdd(college: CatalogCollege) {
    if (addedNames.has(college.name)) return
    setAdding(college.name)
    try {
      const item = await api.collegeAdd(college.name)
      setList(prev => [...prev, item])
      setQuery('')
      setSuggestions([])
      setShowDropdown(false)
      // Pre-fill catalog id so prediction doesn't need another catalog lookup
      setSavedCatalogIds(prev => ({ ...prev, [item.id]: college.id }))
      if (hasStats) void fetchPredict(college.id)
    } catch { /* duplicate or error — ignore */ }
    finally { setAdding(null) }
  }

  async function handleRemove(id: number) {
    setRemoving(id)
    try {
      await api.collegeRemove(id)
      setList(prev => prev.filter(i => i.id !== id))
    } catch { /* ignore */ }
    finally { setRemoving(null) }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderPredictBadge(catalogId: number | null | undefined): React.ReactNode {
    if (catalogId === undefined || catalogId === -1) {
      // Still resolving
      return <span style={S.predictLoading}>…</span>
    }
    if (catalogId === null) {
      return <span style={S.noPredict}>No prediction available</span>
    }
    const state = predictions[catalogId]
    if (!state || state.status === 'loading') {
      return <span style={S.predictLoading}>…</span>
    }
    if (state.status === 'error') {
      if (state.message) {
        return <span style={S.predictError}>{state.message}</span>
      }
      return null
    }
    if (!state.data) return null
    const { probability, tier } = state.data
    const color = tierColor(tier)
    return (
      <span style={{ ...S.tierBadge, color, borderColor: color + '44' }}>
        {tier} · {probability.toFixed(1)}%
      </span>
    )
  }

  function renderPathSection(catalogId: number): React.ReactNode {
    const pathState = pathCache[catalogId]

    if (!pathState || pathState.status === 'idle') {
      return null
    }

    if (pathState.status === 'loading') {
      return (
        <div style={S.pathSection}>
          <div style={S.pathLoading}>
            <span style={S.pathLoadingDot}>●</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Analyzing your path to admission…</span>
          </div>
        </div>
      )
    }

    if (pathState.status === 'error') {
      return (
        <div style={S.pathSection}>
          <div style={S.pathError}>
            <span style={{ color: 'var(--error)', fontSize: 13 }}>{pathState.message}</span>
          </div>
        </div>
      )
    }

    if (!pathState.data) return null

    const { steps } = pathState.data

    return (
      <div style={S.pathSection}>
        {/* Path disclaimer */}
        <p style={S.pathDisclaimer}>
          Numeric boosts for model-calculated steps are statistical estimates based on aggregate college data. Non-numeric suggestions are AI-generated and approximate.
        </p>

        {steps.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            No specific suggestions available right now.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, idx) => {
              const isAi = step.source === 'ai_estimate'
              return (
                <div key={idx} style={S.stepRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                      <span style={S.stepTitle}>{step.title}</span>
                      {isAi && (
                        <span style={S.aiTag}>AI suggested</span>
                      )}
                    </div>
                    <p style={S.stepDesc}>{step.description}</p>
                  </div>
                  <span style={{
                    ...S.boostBadge,
                    background: isAi ? 'rgba(124,58,237,0.15)' : 'rgba(41,121,255,0.15)',
                    color: isAi ? '#A855F7' : '#2979FF',
                    borderColor: isAi ? 'rgba(124,58,237,0.3)' : 'rgba(41,121,255,0.3)',
                  }}>
                    +{step.percentBoost.toFixed(1)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>College List</h1>
          <p style={S.sub}>Search and track the colleges you want to get into.</p>
        </div>
      </div>

      {/* Statistical disclaimer — always shown */}
      <p style={S.disclaimer}>
        This is a statistical estimate for planning purposes — not an official admissions prediction.
      </p>

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
          {searchLoading && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>…</span>
          )}
          {query && !searchLoading && (
            <button
              onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false) }}
              style={S.clearBtn}
            >
              ×
            </button>
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div style={S.dropdown}>
            {suggestions.map(c => {
              const already = addedNames.has(c.name)
              const state   = predictions[c.id]
              return (
                <button
                  key={c.id}
                  style={{ ...S.dropdownRow, opacity: already ? 0.5 : 1 }}
                  onClick={() => !already && void handleAdd(c)}
                  disabled={already || adding === c.name}
                >
                  <div style={{ flex: 1, textAlign: 'left' as const }}>
                    <div style={S.dropdownName}>{c.name}</div>
                    <div style={S.dropdownMeta}>
                      Avg GPA {c.avgGpa} · Avg SAT {c.avgSat}
                    </div>
                  </div>
                  {hasStats && state?.status === 'ok' && state.data && (
                    <span style={{ ...S.dropdownTier, color: tierColor(state.data.tier) }}>
                      {state.data.tier}
                    </span>
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
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎓</div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No colleges yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Search above to add colleges you&apos;re interested in.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(item => {
            const catalogId = savedCatalogIds[item.id]
            const resolvedCatalogId = catalogId === -1 ? undefined : catalogId
            const state     = resolvedCatalogId != null ? predictions[resolvedCatalogId] : undefined
            const hasResult = state?.status === 'ok' && state.data

            let barWidth    = 0
            let barColor    = 'var(--text-muted)'
            let tierLabel: string | null = null
            if (hasResult) {
              barWidth  = Math.min(100, Math.max(1, state!.data!.probability))
              barColor  = tierColor(state!.data!.tier)
              tierLabel = state!.data!.tier
            }

            const isPathExpanded = resolvedCatalogId != null && expandedPathCatalogId === resolvedCatalogId
            const pathState      = resolvedCatalogId != null ? pathCache[resolvedCatalogId] : undefined

            return (
              <div key={item.id} className="ns-card" style={{ ...S.collegeCard, flexDirection: 'column', padding: '18px 20px', alignItems: 'stretch', gap: 0 }}>
                {/* Top row: name + probability badge + remove */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.collegeName}>{item.name}</div>

                    {/* Meta from catalog if resolved */}
                    {resolvedCatalogId === undefined && (
                      <div style={S.collegeMeta}>Resolving…</div>
                    )}

                    {/* Prediction bar */}
                    {hasStats && (
                      <div style={{ marginTop: 10 }}>
                        {hasResult ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Admission Probability</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{tierLabel}</span>
                            </div>
                            <div style={S.barTrack}>
                              <div style={{ ...S.barFill, width: `${barWidth}%`, background: barColor }} />
                            </div>
                          </>
                        ) : state?.status === 'error' ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                            {state.message ?? 'No prediction available for this college'}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Loading prediction…</div>
                        )}
                      </div>
                    )}

                    {!hasStats && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Add GPA &amp; SAT in Settings to see score</div>
                    )}
                  </div>

                  {/* Probability badge */}
                  <div style={S.scoreBox}>
                    {hasResult ? (
                      <>
                        <div style={{ ...S.scoreNum, color: barColor }}>
                          {Math.round(state!.data!.probability)}
                        </div>
                        <div style={S.scoreOut}>%</div>
                      </>
                    ) : resolvedCatalogId === null ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const }}>No<br/>data</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' as const }}>—</div>
                    )}
                  </div>

                  <button
                    onClick={() => void handleRemove(item.id)}
                    disabled={removing === item.id}
                    style={S.removeBtn}
                    title="Remove"
                  >
                    {removing === item.id ? '…' : '×'}
                  </button>
                </div>

                {/* Show path to admission button — only visible once predict has resolved */}
                {hasResult && resolvedCatalogId != null && (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <button
                      onClick={() => handleTogglePath(resolvedCatalogId)}
                      disabled={pathState?.status === 'loading'}
                      style={S.showPathBtn}
                    >
                      {isPathExpanded ? 'Hide path to admission' : 'Show path to admission →'}
                    </button>
                  </div>
                )}

                {/* Expanded path section */}
                {isPathExpanded && resolvedCatalogId != null && renderPathSection(resolvedCatalogId)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  header:         { marginBottom: 8 },
  title:          { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)', marginBottom: 4 },
  sub:            { fontSize: 13, color: 'var(--text-secondary)' },
  disclaimer:     { fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 },
  warnCard:       { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 },
  statsRow:       { display: 'flex', alignItems: 'center', padding: '14px 20px', marginBottom: 20, gap: 0 },
  statChip:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statLabel:      { fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)' },
  statVal:        { fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' },
  statDivider:    { width: 1, height: 36, background: 'var(--border)', flexShrink: 0 },
  searchWrap:     { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 14px', height: 44 },
  searchInput:    { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', padding: 0 },
  clearBtn:       { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 },
  dropdown:       { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden' },
  dropdownRow:    { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' },
  dropdownName:   { fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  dropdownMeta:   { fontSize: 11.5, color: 'var(--text-muted)' },
  dropdownTier:   { fontSize: 12, fontWeight: 700, minWidth: 48, textAlign: 'right' as const },
  addedBadge:     { fontSize: 11, color: 'var(--text-muted)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 20, whiteSpace: 'nowrap' as const },
  addBtn:         { fontSize: 18, fontWeight: 300, color: 'var(--primary)', lineHeight: 1, padding: '0 4px' },
  empty:          { padding: 48, textAlign: 'center' as const, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  collegeCard:    { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px' },
  collegeName:    { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  collegeMeta:    { fontSize: 12, color: 'var(--text-muted)' },
  barTrack:       { height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
  scoreBox:       { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, minWidth: 52 },
  scoreNum:       { fontSize: 28, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 },
  scoreOut:       { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  removeBtn:      { background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 },
  tierBadge:      { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, border: '1px solid', whiteSpace: 'nowrap' as const },
  predictLoading: { fontSize: 12, color: 'var(--text-muted)' },
  predictError:   { fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' },
  noPredict:      { fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' },

  // Path-to-admission styles
  showPathBtn:    { background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'none' },
  pathSection:    { marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' },
  pathDisclaimer: { fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 14, lineHeight: 1.5, margin: '0 0 14px' },
  pathLoading:    { display: 'flex', alignItems: 'center', gap: 8 },
  pathLoadingDot: { fontSize: 8, color: 'var(--primary)', animation: 'pulse 1.2s infinite' },
  pathError:      { padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 },
  stepRow:        { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8 },
  stepTitle:      { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  aiTag:          { fontSize: 10, fontWeight: 600, color: '#A855F7', background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '1px 7px', whiteSpace: 'nowrap' as const },
  stepDesc:       { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '4px 0 0' },
  boostBadge:     { fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: '1px solid', whiteSpace: 'nowrap' as const, flexShrink: 0, alignSelf: 'flex-start' as const },
}
