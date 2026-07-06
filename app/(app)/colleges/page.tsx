'use client'

import { useEffect, useRef, useState } from 'react'
import { api, type CollegeListItem, type CollegeSearchResult, type StudentData } from '../../../lib/api'

// ── Display helpers ────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 75) return '#22C55E'
  if (s >= 50) return '#F59E0B'
  if (s >= 25) return '#F97316'
  return '#EF4444'
}

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
    } catch { /* ignore */ }
    finally { setRemoving(false as unknown as null) }
  }

  // Wait for both APIs to settle before computing stats — prevents a flash
  // where the stored profile GPA (higher) shows briefly before the live portal GPA loads
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
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎓</div>
          <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No colleges yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Search above to add colleges you're interested in.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(item => {
            const score = item.score
            const color = score !== null ? scoreColor(score) : 'var(--text-muted)'
            const label = item.label

            return (
              <div key={item.id} className="ns-card" style={S.collegeCard}>
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

                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={removing === item.id}
                  style={S.removeBtn}
                  title="Remove"
                >
                  {removing === item.id ? '…' : '×'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  collegeCard:  { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px' },
  collegeName:  { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 },
  collegeMeta:  { fontSize: 12, color: 'var(--text-muted)' },
  barTrack:     { height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 99, transition: 'width 0.4s ease' },
  scoreBox:     { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, minWidth: 52 },
  scoreNum:     { fontSize: 28, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 },
  scoreOut:     { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  removeBtn:    { background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 },
}
