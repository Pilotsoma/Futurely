'use client'

import React from 'react'
import { useEffect, useState, useCallback, useRef } from 'react'
import { api, type PlannerItem, type CanvasStatus } from '../../../lib/api'
import { SORTED_ISD_LIST, isCollegeIsd } from '../../../lib/isds'
import PageLoader from '../../../components/ui/PageLoader'
import { CheckIcon, SparklesIcon, XMarkIcon } from '@/components/icons'

type StudyPlan = {
  overview: string
  days: Array<{
    label: string
    date: string
    sessions: Array<{
      assignmentId: number
      title: string
      subject: string
      dueDate: string
      minutesToSpend: number
      notes: string
    }>
  }>
}

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

function isLate(item: PlannerItem): boolean {
  return !item.completed && new Date(item.dueDate).getTime() < Date.now()
}

function formatDueDate(item: PlannerItem): string {
  const date = new Date(item.dueDate)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // dueDate's time component always reflects the real due time — set explicitly on
  // manual creation, defaulted to end of day otherwise, or synced from Canvas —
  // so deriving from it keeps the format consistent across all assignment sources.
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
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
  const [toggleError, setToggleError] = useState<string | null>(null)
  const togglingRef = useRef<Set<number>>(new Set())

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

  // AI Study Plan state
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null)
  const [studyPlanLoading, setStudyPlanLoading] = useState(false)
  const [studyPlanError, setStudyPlanError] = useState<string | null>(null)
  const [showStudyPlan, setShowStudyPlan] = useState(false)

  const [showCompleted, setShowCompleted] = useState(false)

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
    setToggleError(null)
    togglingRef.current.add(id)
    setToggling(new Set(togglingRef.current))
    // Optimistic update
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null } : item
    ))
    try {
      // Confirm with server — use the returned item to keep state authoritative
      const updated = await api.plannerToggle(id, completed)
      setItems(prev => prev.map(item => item.id === id ? updated : item))
    } catch {
      // Revert optimistic update and surface the error
      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, completed: !completed, completedAt: !completed ? new Date().toISOString() : null } : item
      ))
      setToggleError('Failed to save — please try again.')
    } finally {
      togglingRef.current.delete(id)
      setToggling(new Set(togglingRef.current))
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
      setItems(prev => {
        const prevMap = new Map(prev.map(i => [i.id, i]))
        // Don't overwrite items that have an in-flight toggle — their local state
        // is more authoritative than the just-fetched DB snapshot
        return assignments.map(a => {
          if (togglingRef.current.has(a.id)) return prevMap.get(a.id) ?? a
          return a
        })
      })
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

  async function handleGenerateStudyPlan() {
    setStudyPlanLoading(true)
    setStudyPlanError(null)
    setShowStudyPlan(true)
    const timeout = setTimeout(() => {
      setStudyPlanLoading(false)
      setStudyPlanError('Request timed out — the AI took too long. Try again.')
    }, 30000)
    try {
      const plan = await api.studyPlan()
      setStudyPlan(plan)
    } catch (e) {
      setStudyPlanError(e instanceof Error ? e.message : 'Failed to generate study plan')
    } finally {
      clearTimeout(timeout)
      setStudyPlanLoading(false)
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
                    boxShadow: 'var(--neo-raised), var(--shadow-md)',
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
                background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--neo-raised)',
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
              <CheckIcon size={13} color='#22C55E'/>
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
                  cursor: canvasLoading ? 'not-allowed' : 'pointer', opacity: canvasLoading ? 0.6 : 1, flexShrink: 0, boxShadow: 'var(--neo-raised)',
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
            padding: '7px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', boxShadow: 'var(--neo-raised)',
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

      {/* AI Study Plan */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showStudyPlan ? 12 : 0 }}>
          <button
            onClick={() => {
              if (!showStudyPlan) { void handleGenerateStudyPlan() }
              else setShowStudyPlan(false)
            }}
            disabled={studyPlanLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: showStudyPlan ? 'var(--surface-2)' : 'none',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 14px',
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              cursor: studyPlanLoading ? 'not-allowed' : 'pointer',
              opacity: studyPlanLoading ? 0.7 : 1,
            }}
          >
            <SparklesIcon size={15} gradient/>
            {studyPlanLoading ? 'Generating plan…' : showStudyPlan ? 'Hide Study Plan' : 'AI Study Plan'}
          </button>
          {showStudyPlan && studyPlan && !studyPlanLoading && (
            <button
              onClick={() => void handleGenerateStudyPlan()}
              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
            >
              Regenerate
            </button>
          )}
        </div>

        {showStudyPlan && (
          <div className="ns-card" style={{ padding: 18, marginTop: 10 }}>
            {studyPlanLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
                <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                Building your personalized study plan…
              </div>
            )}
            {studyPlanError && (
              <div style={{ color: '#EF4444', fontSize: 13 }}>{studyPlanError}</div>
            )}
            {!studyPlanLoading && studyPlan && (
              <>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  {studyPlan.overview}
                </p>
                {studyPlan.days.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No sessions needed — you&apos;re all caught up!</p>
                ) : studyPlan.days.map(day => (
                  <div key={day.date} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                      {day.label}
                    </div>
                    {day.sessions.map((session, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, padding: '10px 12px', marginBottom: 6,
                        background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)', boxShadow: 'var(--neo-raised)',
                      }}>
                        <div style={{
                          flexShrink: 0, width: 42, height: 42, borderRadius: 8,
                          background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: 'var(--primary)',
                        }}>
                          {session.minutesToSpend}m
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                            {session.title}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                            {session.subject && <span>{session.subject}</span>}
                            <span>Due {session.dueDate}</span>
                          </div>
                          {session.notes && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              {session.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Toggle error toast */}
      {toggleError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#EF4444' }}>{toggleError}</span>
          <button onClick={() => setToggleError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 0, display: 'flex', alignItems: 'center' }}><XMarkIcon size={16}/></button>
        </div>
      )}

      {/* Assignment Groups */}
      {(() => {
        const activeGroups = groups.filter(g => g.key !== 'Completed')
        const completedGroup = groups.find(g => g.key === 'Completed')

        function AssignmentCard({ item }: { item: PlannerItem }) {
          return (
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
                      {isLate(item) && (
                        <span style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700, letterSpacing: '0.3px' }}>
                          Late
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
          )
        }

        return (
          <>
            {activeGroups.length === 0 && !completedGroup && (
              <div style={S.empty}>
                <div style={S.emptyIcon}><CheckIcon size={24}/></div>
                <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>No tasks yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Click &quot;+ New Task&quot; to add your first assignment.</p>
              </div>
            )}

            {activeGroups.length === 0 && completedGroup && (
              <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><CheckIcon size={22}/></div>
                <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>All caught up!</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Every assignment is completed.</p>
              </div>
            )}

            {activeGroups.map(group => {
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
                  {group.items.map(item => <AssignmentCard key={item.id} item={item} />)}
                </div>
              )
            })}

            {completedGroup && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setShowCompleted(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '8px 14px', fontSize: 13, fontWeight: 600,
                    color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: showCompleted ? 12 : 0,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: showCompleted ? 'rotate(90deg)' : 'none' }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  {showCompleted ? 'Hide completed assignments' : `Show completed assignments (${completedGroup.items.length})`}
                </button>
                {showCompleted && completedGroup.items.map(item => <AssignmentCard key={item.id} item={item} />)}
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  form: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 28, boxShadow: 'var(--neo-raised)' },
  formRow: { display: 'flex', gap: 10, marginBottom: 10 },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxShadow: 'var(--neo-inset)' },
  button: { padding: '10px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--neo-raised)' },
  empty: { textAlign: 'center' as const, padding: '60px 20px' },
  emptyIcon: { width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, margin: '0 auto 14px' },
}