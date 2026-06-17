'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type PlannerItem, type CanvasStatus } from '../../../lib/api'
import { SORTED_ISD_LIST, isCollegeIsd } from '../../../lib/isds'
import PageLoader from '../../../components/ui/PageLoader'

type GroupKey = 'Overdue' | 'Today' | 'Tomorrow' | 'This Week' | 'Later' | 'Completed'
interface Group { key: GroupKey; items: PlannerItem[] }

const GROUP_META: Partial<Record<GroupKey, { color: string; bg: string }>> = {
  Overdue: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  Today:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
}

function groupAssignments(items: PlannerItem[]): Group[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)

  const groups: Record<GroupKey, PlannerItem[]> = {
    Overdue: [], Today: [], Tomorrow: [], 'This Week': [], Later: [], Completed: [],
  }

  for (const item of items) {
    if (item.completed) { groups.Completed.push(item); continue }
    const due = new Date(item.dueDate)
    if (due < todayStart) groups.Overdue.push(item)
    else if (due < tomorrowStart) groups.Today.push(item)
    else if (due < new Date(tomorrowStart.getTime() + 86400000)) groups.Tomorrow.push(item)
    else if (due < weekEnd) groups['This Week'].push(item)
    else groups.Later.push(item)
  }

  const ORDER: GroupKey[] = ['Overdue', 'Today', 'Tomorrow', 'This Week', 'Later', 'Completed']
  return ORDER.filter(k => groups[k].length > 0).map(k => ({ key: k, items: groups[k] }))
}

function formatDueDate(item: PlannerItem): string {
  const date = new Date(item.dueDate)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (item.dueTime) return `${dateStr} at ${item.dueTime}`
  return dateStr
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

export default function PlannerPage() {
  const [items, setItems] = useState<PlannerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<number>>(new Set())

  // Canvas state
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus | null>(null)
  const [canvasLoading, setCanvasLoading] = useState(false)
  const [showCanvasForm, setShowCanvasForm] = useState(false)
  const [canvasUrl, setCanvasUrl] = useState('')
  const [canvasToken, setCanvasToken] = useState('')
  const [canvasError, setCanvasError] = useState<string | null>(null)
  const [districtSearch, setDistrictSearch] = useState('')
  const [districtOpen, setDistrictOpen] = useState(false)
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const districtRef = useRef<HTMLDivElement>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [assignments, status] = await Promise.all([
        api.plannerList(),
        api.canvasStatus(),
      ])
      setItems(assignments)
      setCanvasStatus(status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load planner')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (districtRef.current && !districtRef.current.contains(e.target as Node)) {
        setDistrictOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const canvasDistricts = SORTED_ISD_LIST.filter(d => d.canvasUrl)
  const filteredDistricts = canvasDistricts.filter(d =>
    d.name.toLowerCase().includes(districtSearch.toLowerCase()) ||
    d.state.toLowerCase().includes(districtSearch.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !dueDate) return

    setSubmitting(true)
    setFormError(null)
    try {
      const created = await api.plannerCreate({
        title: title.trim(),
        subject: subject || undefined,
        dueDate,
        dueTime: dueTime || undefined,
      })
      setItems(prev => [...prev, created])
      setTitle('')
      setSubject('')
      setDueDate('')
      setDueTime('')
      setShowForm(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    setToggling(prev => new Set([...prev, id]))
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null } : item
    ))
    try {
      await api.plannerToggle(id, completed)
    } catch {
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, completed: !completed, completedAt: !completed ? new Date().toISOString() : null } : item
      ))
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function handleDelete(id: number) {
    setItems(prev => prev.filter(item => item.id !== id))
    try {
      await api.plannerDelete(id)
    } catch {
      void fetchData()
    }
  }

  async function handleCanvasSync() {
    setCanvasLoading(true)
    try {
      await api.canvasSync()
      const assignments = await api.plannerList()
      setItems(assignments)
      const status = await api.canvasStatus()
      setCanvasStatus(status)
    } catch (e) {
      setCanvasError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setCanvasLoading(false)
    }
  }

  async function handleCanvasConnect(e: React.FormEvent) {
    e.preventDefault()
    setCanvasLoading(true)
    setCanvasError(null)
    try {
      await api.canvasConnect(canvasUrl.trim(), canvasToken.trim())
      const fresh = await api.canvasStatus()
      setCanvasStatus(fresh)
      setShowCanvasForm(false)
      setCanvasUrl('')
      setCanvasToken('')
      setSelectedDistrict(null)
      setDistrictSearch('')
      await handleCanvasSync()
    } catch (e) {
      setCanvasError(e instanceof Error ? e.message : 'Failed to connect Canvas')
    } finally {
      setCanvasLoading(false)
    }
  }

  async function handleCanvasDisconnect(instanceUrl?: string) {
    setCanvasLoading(true)
    try {
      await api.canvasDisconnect(instanceUrl)
      const fresh = await api.canvasStatus()
      setCanvasStatus(fresh)
      if (!fresh.connected) {
        setItems(prev => prev.filter(item => item.source !== 'CANVAS'))
      }
    } catch (e) {
      setCanvasError(e instanceof Error ? e.message : 'Failed to disconnect')
    } finally {
      setCanvasLoading(false)
    }
  }

  if (error) return <div style={{ padding: 40, color: '#EF4444' }}>{error}</div>
  if (loading) return <PageLoader message="Opening planner…" />

  const groups = groupAssignments(items)

  // Normalised list of Canvas connections — works with old (single) and new (multi) backend
  const canvasConnections = canvasStatus?.connections?.length
    ? canvasStatus.connections
    : canvasStatus?.canvasInstanceUrl
      ? [{ canvasInstanceUrl: canvasStatus.canvasInstanceUrl, canvasUserName: canvasStatus.canvasUserName, lastSynced: canvasStatus.lastSynced, syncStatus: canvasStatus.syncStatus, syncError: canvasStatus.syncError }]
      : []

  function closeCanvasForm() {
    setShowCanvasForm(false)
    setCanvasUrl('')
    setCanvasToken('')
    setCanvasError(null)
    setSelectedDistrict(null)
    setDistrictSearch('')
    setDistrictOpen(false)
  }

  return (
    <div className="fade-up" style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Planner</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm ? 'var(--surface-2)' : 'var(--primary)',
            color: showForm ? 'var(--text)' : '#fff',
            border: showForm ? '1px solid var(--border)' : 'none',
            borderRadius: 10,
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {/* ── Canvas: Connect form (shown when adding first OR second connection) ── */}
      {showCanvasForm && (
        <div className="ns-card" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
            {canvasStatus?.connected ? 'Add another Canvas account' : 'Link your Canvas account'}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Get your token: Canvas → Profile → Settings → Approved Integrations → New Access Token
          </p>
          <form onSubmit={e => void handleCanvasConnect(e)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              <div ref={districtRef} style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search your school district…"
                  value={districtOpen ? districtSearch : (selectedDistrict ?? districtSearch)}
                  onChange={e => { setDistrictSearch(e.target.value); setDistrictOpen(true); setSelectedDistrict(null) }}
                  onFocus={() => { setDistrictOpen(true); setDistrictSearch('') }}
                  style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                  autoComplete="off"
                />
                {districtOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  }}>
                    {filteredDistricts.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                        No districts found — enter your Canvas URL below
                      </div>
                    ) : filteredDistricts.map(d => (
                      <div
                        key={d.canvasUrl}
                        onClick={() => {
                          setSelectedDistrict(`${d.name} (${d.state})`)
                          setCanvasUrl(d.canvasUrl!)
                          setDistrictOpen(false)
                          setDistrictSearch('')
                        }}
                        style={{
                          padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          color: 'var(--text)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span style={{ fontWeight: 500 }}>{d.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 6 }}>{d.state}</span>
                      </div>
                    ))}
                    <div
                      onClick={() => { setSelectedDistrict('Other'); setCanvasUrl(''); setDistrictOpen(false) }}
                      style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      Other — enter URL manually
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="katyisd.instructure.com"
                value={canvasUrl}
                onChange={e => setCanvasUrl(e.target.value)}
                required
                style={{ ...S.input, fontSize: 12, color: canvasUrl ? 'var(--text)' : 'var(--text-secondary)' }}
              />
              <input
                type="password"
                placeholder="Canvas Personal Access Token"
                value={canvasToken}
                onChange={e => setCanvasToken(e.target.value)}
                required
                style={S.input}
              />
            </div>
            {canvasError && (
              <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{canvasError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={canvasLoading || !canvasUrl.trim() || !canvasToken.trim()}
                style={{
                  ...S.button,
                  opacity: canvasLoading || !canvasUrl.trim() || !canvasToken.trim() ? 0.5 : 1,
                }}
              >
                {canvasLoading ? 'Connecting…' : 'Connect Canvas'}
              </button>
              <button type="button" onClick={closeCanvasForm} style={{
                padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Canvas: Connected state (shown when NOT editing) ── */}
      {canvasStatus?.connected && !showCanvasForm && (
        <div className="ns-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: canvasConnections.length > 1 ? 10 : 0 }}>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#22C55E', fontWeight: 700 }}>✓</span>
              Canvas connected
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => void handleCanvasSync()} disabled={canvasLoading} style={{
                background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text)',
                cursor: canvasLoading ? 'not-allowed' : 'pointer', opacity: canvasLoading ? 0.6 : 1,
              }}>
                {canvasLoading ? 'Syncing…' : 'Sync All'}
              </button>
              {canvasConnections.length < 2 && (
                <button onClick={() => setShowCanvasForm(true)} disabled={canvasLoading} style={{
                  background: 'none', border: '1px solid var(--primary)', borderRadius: 7,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--primary)',
                  cursor: canvasLoading ? 'not-allowed' : 'pointer', opacity: canvasLoading ? 0.6 : 1,
                }}>
                  + Add Canvas
                </button>
              )}
            </div>
          </div>
          {canvasConnections.map(conn => {
            const isCollege = isCollegeIsd(conn.canvasInstanceUrl)
            return (
              <div key={conn.canvasInstanceUrl} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '8px 0', borderTop: '1px solid var(--border)',
              }}>
                {conn.syncError === 'TOKEN_REVOKED' && (
                  <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>Token expired</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
                    background: isCollege ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                    color: isCollege ? '#22C55E' : '#3B82F6', flexShrink: 0,
                  }}>
                    {isCollege ? 'College' : 'High School'}
                  </span>
                  <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conn.canvasUserName ?? conn.canvasInstanceUrl}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{conn.canvasInstanceUrl}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  Synced {formatRelativeTime(conn.lastSynced)}
                </span>
                <button onClick={() => void handleCanvasDisconnect(conn.canvasInstanceUrl)} disabled={canvasLoading} style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                  cursor: canvasLoading ? 'not-allowed' : 'pointer', opacity: canvasLoading ? 0.6 : 1, flexShrink: 0,
                }}>
                  Disconnect
                </button>
              </div>
            )
          })}
          {canvasError && (
            <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{canvasError}</div>
          )}
        </div>
      )}

      {/* ── Canvas: Disconnected state ── */}
      {!canvasStatus?.connected && !showCanvasForm && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowCanvasForm(true)} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            Link Canvas
          </button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <form onSubmit={e => void handleCreate(e)} style={S.form}>
          <div style={S.formRow}>
            <input type="text" placeholder="Task name (e.g. Math Homework)" value={title}
              onChange={e => setTitle(e.target.value)} required style={{ ...S.input, flex: 2 }} />
          </div>
          <div style={S.formRow}>
            <input type="text" placeholder="Class (e.g. AP Calculus, English)" value={subject}
              onChange={e => setSubject(e.target.value)} style={{ ...S.input, flex: 1 }} />
          </div>
          <div style={S.formRow}>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required style={{ ...S.input, flex: 1 }} />
            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ ...S.input, flex: 1 }} />
          </div>
          {formError && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{formError}</div>}
          <button type="submit" disabled={submitting || !title.trim() || !dueDate}
            style={{ ...S.button, opacity: submitting || !title.trim() || !dueDate ? 0.5 : 1 }}>
            {submitting ? 'Adding…' : 'Add Task'}
          </button>
        </form>
      )}

      {/* Assignment Groups */}
      {groups.length === 0 ? (
        <div style={S.empty}>
          <div style={S.emptyIcon}>✓</div>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>No tasks yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click "+ New Task" to add your first assignment.</p>
        </div>
      ) : groups.map(group => {
        const meta = GROUP_META[group.key]
        return (
          <div key={group.key} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: meta?.color ?? 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                {group.key}
              </span>
              <span style={{ borderRadius: 100, padding: '2px 8px', fontSize: 11, fontWeight: 700, background: meta?.bg ?? 'var(--surface-2)', color: meta?.color ?? 'var(--text-secondary)' }}>
                {group.items.length}
              </span>
            </div>
            {group.items.map(item => (
              <div key={item.id} className="ns-card" style={{ padding: '13px 14px', marginBottom: 8, opacity: item.completed ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5,
                      border: `1.5px solid ${item.completed ? 'var(--primary)' : 'var(--border)'}`,
                      background: item.completed ? 'var(--primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}>
                      {item.completed && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="#060D10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input type="checkbox" checked={item.completed} disabled={toggling.has(item.id)}
                      onChange={() => void handleToggle(item.id, !item.completed)} style={{ display: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 500,
                        textDecoration: item.completed ? 'line-through' : 'none',
                        color: item.completed ? 'var(--text-muted)' : 'var(--text)',
                      }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.subject && <span>{item.subject}</span>}
                        {item.source === 'CANVAS' && (
                          <span style={{ background: 'rgba(229,57,53,0.12)', color: '#E53935', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, letterSpacing: '0.3px' }}>
                            Canvas
                          </span>
                        )}
                        <span>Due {formatDueDate(item)}</span>
                      </div>
                    </div>
                  </label>
                  <button onClick={() => void handleDelete(item.id)} title="Delete task" style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    fontSize: 16, padding: 4, opacity: 0.5, transition: 'opacity 0.15s', flexShrink: 0,
                  }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.5' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  form: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 28 },
  formRow: { display: 'flex', gap: 10, marginBottom: 10 },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, outline: 'none' },
  button: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  empty: { textAlign: 'center' as const, padding: '60px 20px' },
  emptyIcon: { width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, margin: '0 auto 14px' },
}