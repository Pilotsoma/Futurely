'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  api,
  CanvasTodoItem,
  CanvasCourseWithGrade,
  CanvasModule,
  CanvasModuleItem,
  CanvasAnnouncement,
  CanvasAssignmentDetail,
  CanvasCourseFile,
  CanvasGradesConnection,
  CanvasGradesCourse,
  CanvasGradesAssignment,
} from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)'
  if (score >= 90) return '#22C55E'
  if (score >= 80) return '#10B981'
  if (score >= 70) return '#F59E0B'
  if (score >= 60) return '#F97316'
  return '#EF4444'
}

function instanceLabel(url: string): string {
  const host = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
  const known: Record<string, string> = {
    'hccs.instructure.com': 'HCC Canvas',
    'sanjacinto.instructure.com': 'San Jac Canvas',
    'lonestar.instructure.com': 'Lone Star Canvas',
    'austincc.instructure.com': 'Austin CC Canvas',
    'collin.instructure.com': 'Collin College Canvas',
    'dcccd.instructure.com': 'Dallas College Canvas',
    'tarrantcounty.instructure.com': 'TCC Canvas',
  }
  if (known[host]) return known[host]
  const sub = host.split('.')[0]
  return `${sub.charAt(0).toUpperCase()}${sub.slice(1)} Canvas`
}

function fileIcon(contentType: string): string {
  if (contentType.includes('pdf')) return '📄'
  if (contentType.includes('image')) return '🖼️'
  if (contentType.includes('video')) return '🎬'
  if (contentType.includes('audio')) return '🎵'
  if (contentType.includes('zip') || contentType.includes('compressed')) return '🗜️'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('sheet') || contentType.includes('excel')) return '📊'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return '📊'
  return '📁'
}

function moduleItemIcon(type: string): string {
  switch (type) {
    case 'Assignment': return '✏️'
    case 'Quiz': return '❓'
    case 'Discussion': return '💬'
    case 'File': return '📄'
    case 'Page': return '📃'
    case 'ExternalUrl': return '🔗'
    case 'ExternalTool': return '🔧'
    case 'SubHeader': return ''
    default: return '•'
  }
}

function submissionStatusChip(a: CanvasGradesAssignment) {
  const sub = a.submission
  const state = sub?.workflow_state ?? 'unsubmitted'
  let label: string, bg: string, color: string
  if (sub?.missing) { label = 'Missing'; bg = 'rgba(239,68,68,0.12)'; color = '#EF4444' }
  else if (sub?.late && state !== 'graded') { label = 'Late'; bg = 'rgba(249,115,22,0.12)'; color = '#F97316' }
  else if (state === 'graded') { label = 'Graded'; bg = 'rgba(34,197,94,0.12)'; color = '#22C55E' }
  else if (state === 'submitted' || state === 'pending_review') { label = 'Submitted'; bg = 'rgba(59,130,246,0.12)'; color = '#3B82F6' }
  else { label = 'Not Submitted'; bg = 'rgba(107,114,128,0.12)'; color = '#6B7280' }
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap' as const }}>
      {label}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = 16, radius = 6, style }: { width?: string | number; height?: number; radius?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width, height, borderRadius: radius, background: 'var(--surface-2)', animation: 'pulse 1.5s ease-in-out infinite', ...style }} />
  )
}

function SidebarSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 8px' }}>
      {[80, 120, 100, 90, 110].map((w, i) => <Skeleton key={i} width={w} height={12} />)}
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={11} />
          <Skeleton width="90%" height={11} />
        </div>
      ))}
    </div>
  )
}

// ── Assignment Detail Panel ────────────────────────────────────────────────────

function AssignmentPanel({
  courseId, assignmentId, canvasInstanceUrl, instanceBaseUrl,
  onClose,
}: {
  courseId: number
  assignmentId: number
  canvasInstanceUrl: string
  instanceBaseUrl: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<CanvasAssignmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true); setError(false); setDetail(null)
    api.canvasAssignmentDetail(courseId, assignmentId, canvasInstanceUrl)
      .then(setDetail)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [courseId, assignmentId, canvasInstanceUrl])

  const sub = detail?.submission
  const subState = sub?.workflow_state ?? 'unsubmitted'

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 200, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(0,0,0,0.4)' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignment</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton width="80%" height={20} />
            <Skeleton width="50%" height={12} />
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <Skeleton height={12} /><Skeleton width="90%" height={12} /><Skeleton width="70%" height={12} />
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
            Failed to load assignment details.
          </div>
        )}

        {!loading && detail && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 14px', lineHeight: 1.3 }}>{detail.name}</h2>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
              <div>
                <div style={S.metaLabel}>Due</div>
                <div style={S.metaValue}>{fmtDate(detail.due_at)}</div>
              </div>
              <div>
                <div style={S.metaLabel}>Points</div>
                <div style={S.metaValue}>{detail.points_possible ?? '—'}</div>
              </div>
              {sub && (
                <div>
                  <div style={S.metaLabel}>Your Score</div>
                  <div style={{ ...S.metaValue, color: sub.score !== null ? scoreColor((sub.score / (detail.points_possible || 1)) * 100) : 'var(--text-muted)' }}>
                    {sub.score !== null ? `${sub.score} / ${detail.points_possible ?? '?'}` : '—'}
                  </div>
                </div>
              )}
              {sub && (
                <div>
                  <div style={S.metaLabel}>Status</div>
                  <div style={{ marginTop: 4 }}>
                    {(() => {
                      let label: string, color: string
                      if (sub.missing) { label = 'Missing'; color = '#EF4444' }
                      else if (sub.late && subState !== 'graded') { label = 'Late'; color = '#F97316' }
                      else if (subState === 'graded') { label = 'Graded'; color = '#22C55E' }
                      else if (subState === 'submitted') { label = 'Submitted'; color = '#3B82F6' }
                      else { label = 'Not Submitted'; color = '#6B7280' }
                      return <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Submission types */}
            {detail.submission_types.length > 0 && detail.submission_types[0] !== 'none' && (
              <div style={{ marginBottom: 18 }}>
                <div style={S.metaLabel}>Submission Type</div>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {detail.submission_types.map(t => t.replace(/_/g, ' ')).join(', ')}
                </div>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0 20px' }} />

            {/* Description */}
            {detail.description ? (
              <div>
                <div style={{ ...S.metaLabel, marginBottom: 10 }}>Instructions</div>
                <div
                  className="canvas-html"
                  style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: detail.description }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No instructions provided.</div>
            )}

            {/* Rubric */}
            {detail.rubric && detail.rubric.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ ...S.metaLabel, marginBottom: 10 }}>Rubric</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.rubric.map(r => (
                    <div key={r.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.description}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{r.points} pts</span>
                      </div>
                      {r.long_description && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{r.long_description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {detail && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <a
            href={`https://${instanceBaseUrl}${detail.html_url.startsWith('/') ? detail.html_url : `/${detail.html_url}`}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#060D10', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            Open in Canvas
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      )}
    </div>
  )
}

// ── Course content tabs ───────────────────────────────────────────────────────

type CourseTab = 'modules' | 'assignments' | 'announcements' | 'files' | 'grades'

function ModulesTab({
  courseId, canvasInstanceUrl,
  onSelectAssignment,
}: {
  courseId: number
  canvasInstanceUrl: string
  onSelectAssignment: (assignmentId: number) => void
}) {
  const [modules, setModules] = useState<CanvasModule[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  useEffect(() => {
    setLoading(true); setModules(null)
    api.canvasCourseModules(courseId, canvasInstanceUrl)
      .then(setModules)
      .catch(() => setModules([]))
      .finally(() => setLoading(false))
  }, [courseId, canvasInstanceUrl])

  const toggle = (id: number) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (loading) return <ContentSkeleton />
  if (!modules || modules.length === 0) return <Empty text="No modules found for this course." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {modules.map(mod => {
        const isOpen = !collapsed.has(mod.id)
        return (
          <div key={mod.id} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
            <button
              onClick={() => toggle(mod.id)}
              style={{ width: '100%', padding: '13px 18px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{mod.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mod.items_count} item{mod.items_count !== 1 ? 's' : ''}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </button>
            {isOpen && mod.items.length > 0 && (
              <div>
                {mod.items.map((item, idx) => (
                  item.type === 'SubHeader' ? (
                    <div key={item.id} style={{ padding: '8px 18px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', borderTop: idx > 0 ? '1px solid var(--border)' : 'none', background: 'rgba(0,0,0,0.15)' }}>
                      {item.title}
                    </div>
                  ) : (
                    <ModuleItemRow
                      key={item.id}
                      item={item}
                      isLast={idx === mod.items.length - 1}
                      onSelectAssignment={item.type === 'Assignment' && item.content_id ? () => onSelectAssignment(item.content_id!) : undefined}
                    />
                  )
                ))}
              </div>
            )}
            {isOpen && mod.items.length === 0 && (
              <div style={{ padding: '12px 18px', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>This module is empty.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ModuleItemRow({ item, isLast, onSelectAssignment }: { item: CanvasModuleItem; isLast: boolean; onSelectAssignment?: () => void }) {
  const isClickable = !!onSelectAssignment
  const complete = item.completion_requirement?.completed ?? false

  return (
    <div
      onClick={onSelectAssignment}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
        borderTop: '1px solid var(--border)',
        cursor: isClickable ? 'pointer' : 'default',
        background: isClickable ? undefined : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{moduleItemIcon(item.type)}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {item.type !== 'SubHeader' && item.completion_requirement && (
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${complete ? '#22C55E' : 'var(--border)'}`, background: complete ? 'rgba(34,197,94,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {complete && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
        )}
        {isClickable && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </div>
    </div>
  )
}

function AssignmentsTab({
  courseGrades,
  onSelectAssignment,
}: {
  courseGrades: CanvasGradesCourse | undefined
  onSelectAssignment: (assignmentId: number) => void
}) {
  if (!courseGrades) return <Empty text="No assignment data available." />
  if (courseGrades.assignments.length === 0) return <Empty text="No assignments found for this course." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 100px 28px', gap: 8, padding: '9px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        {['Assignment', 'Due', 'Score', 'Status', ''].map(h => (
          <span key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>{h}</span>
        ))}
      </div>
      {courseGrades.assignments.map(a => (
        <div
          key={a.id}
          onClick={() => onSelectAssignment(a.id)}
          style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 100px 28px', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', cursor: 'pointer', background: 'var(--surface)', transition: 'background 0.1s' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'}
        >
          <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(a.due_at)}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {a.submission?.score !== null && a.submission?.score !== undefined ? `${a.submission.score} / ${a.points_possible ?? '?'}` : '—'}
          </span>
          {submissionStatusChip(a)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      ))}
    </div>
  )
}

function AnnouncementsTab({ courseId, canvasInstanceUrl }: { courseId: number; canvasInstanceUrl: string }) {
  const [items, setItems] = useState<CanvasAnnouncement[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setItems(null)
    api.canvasCourseAnnouncements(courseId, canvasInstanceUrl)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [courseId, canvasInstanceUrl])

  if (loading) return <ContentSkeleton />
  if (!items || items.length === 0) return <Empty text="No announcements for this course." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(a => (
        <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: a.message ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{a.title}</span>
              {a.read_state === 'unread' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', flexShrink: 0, marginTop: 2 }}>NEW</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>{a.author.display_name}</span>
              <span>·</span>
              <span>{fmtDate(a.posted_at)}</span>
            </div>
          </div>
          {a.message && (
            <div
              className="canvas-html"
              style={{ padding: '14px 18px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}
              dangerouslySetInnerHTML={{ __html: a.message }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function FilesTab({ courseId, canvasInstanceUrl }: { courseId: number; canvasInstanceUrl: string }) {
  const [files, setFiles] = useState<CanvasCourseFile[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true); setFiles(null)
    api.canvasCourseFiles(courseId, canvasInstanceUrl)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [courseId, canvasInstanceUrl])

  if (loading) return <ContentSkeleton />
  if (!files || files.length === 0) return <Empty text="No files shared in this course." />

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {files.map((f, i) => (
        <a
          key={f.id}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none',
            background: 'var(--surface)', textDecoration: 'none', transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-2)'}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface)'}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>{f.locked ? '🔒' : fileIcon(f['content-type'])}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: f.locked ? 'var(--text-muted)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.display_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fmtSize(f.size)} · Updated {fmtDate(f.updated_at)}</div>
          </div>
          {!f.locked && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          )}
        </a>
      ))}
    </div>
  )
}

function GradesTab({ courseGrades }: { courseGrades: CanvasGradesCourse | undefined }) {
  if (!courseGrades) return <Empty text="No grade data available." />

  const score = courseGrades.currentScore
  const graded = courseGrades.assignments.filter(a => a.submission?.workflow_state === 'graded' && a.submission.score !== null)
  const submitted = courseGrades.assignments.filter(a => a.submission?.workflow_state === 'submitted')
  const missing = courseGrades.assignments.filter(a => a.submission?.missing)
  const unsubmitted = courseGrades.assignments.filter(a => !a.submission || a.submission.workflow_state === 'unsubmitted')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grade summary card */}
      <div style={{ padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor(score), lineHeight: 1 }}>
            {score !== null ? `${score.toFixed(1)}%` : '—'}
          </div>
          {courseGrades.currentGrade && (
            <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(score), marginTop: 4 }}>{courseGrades.currentGrade}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Current Grade</div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { label: 'Graded', value: graded.length, color: '#22C55E' },
            { label: 'Submitted', value: submitted.length, color: '#3B82F6' },
            { label: 'Missing', value: missing.length, color: '#EF4444' },
            { label: 'Not Submitted', value: unsubmitted.length, color: '#6B7280' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Graded assignments */}
      {graded.length > 0 && (
        <div>
          <div style={S.sectionTitle}>Graded Assignments</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {graded.map((a, i) => {
              const pct = a.points_possible && a.submission?.score !== null ? (a.submission!.score! / a.points_possible) * 100 : null
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < graded.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--surface)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(pct), flexShrink: 0 }}>
                    {a.submission?.score} / {a.points_possible ?? '?'}
                    {pct !== null && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>({pct.toFixed(1)}%)</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>{text}</div>
  )
}

// ── Dashboard View ────────────────────────────────────────────────────────────

function DashboardView({
  courses,
  todo,
  onSelectCourse,
}: {
  courses: CanvasCourseWithGrade[]
  todo: CanvasTodoItem[]
  onSelectCourse: (courseId: number) => void
}) {
  const upcoming = todo.filter(t => t.type === 'submitting')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* To-do */}
      {upcoming.length > 0 && (
        <div>
          <div style={S.sectionTitle}>To Do</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.assignment.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{t.context_name} · Due {fmtDate(t.assignment.due_at)}</div>
                </div>
                {t.assignment.points_possible && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{t.assignment.points_possible} pts</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course cards */}
      <div>
        <div style={S.sectionTitle}>My Courses</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {courses.map(course => (
            <button
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              style={{ padding: 20, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s', display: 'flex', flexDirection: 'column', gap: 10 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), #4B6EFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🎓
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 6 }}>{course.name}</div>
                {course.currentScore !== null ? (
                  <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(course.currentScore) }}>
                    {course.currentScore.toFixed(1)}%
                    {course.currentGrade && <span style={{ fontSize: 14, marginLeft: 6 }}>{course.currentGrade}</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No grade yet</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type View = 'dashboard' | 'course'

export default function CanvasPage() {
  const router = useRouter()

  // Connection / instance state
  const [connections, setConnections] = useState<Array<{ canvasInstanceUrl: string; canvasUserName: string | null }>>([])
  const [activeInstance, setActiveInstance] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Dashboard data per instance
  const [dashData, setDashData] = useState<Record<string, { todo: CanvasTodoItem[]; courses: CanvasCourseWithGrade[] }>>({})
  const [dashLoading, setDashLoading] = useState(false)

  // Grades data (for assignments tab and grades tab) per instance
  const [gradesData, setGradesData] = useState<Record<string, CanvasGradesConnection>>({})
  const [gradesLoading, setGradesLoading] = useState(false)

  // Course navigation
  const [view, setView] = useState<View>('dashboard')
  const [activeCourseId, setActiveCourseId] = useState<number | null>(null)
  const [courseTab, setCourseTab] = useState<CourseTab>('modules')

  // Assignment detail panel
  const [detailCourseId, setDetailCourseId] = useState<number | null>(null)
  const [detailAssignmentId, setDetailAssignmentId] = useState<number | null>(null)

  // Load connections on mount
  useEffect(() => {
    api.canvasStatus()
      .then(status => {
        if (!status.connected || status.connections.length === 0) {
          setNotConnected(true)
        } else {
          setConnections(status.connections)
          setActiveInstance(status.connections[0].canvasInstanceUrl)
        }
      })
      .catch(() => setNotConnected(true))
      .finally(() => setInitialLoading(false))
  }, [])

  // Load dashboard data when activeInstance changes
  useEffect(() => {
    if (!activeInstance) return
    if (dashData[activeInstance]) return // already loaded

    setDashLoading(true)
    api.canvasDashboard(activeInstance)
      .then(d => setDashData(prev => ({ ...prev, [activeInstance]: { todo: d.todo, courses: d.courses } })))
      .catch(() => setDashData(prev => ({ ...prev, [activeInstance]: { todo: [], courses: [] } })))
      .finally(() => setDashLoading(false))
  }, [activeInstance, dashData])

  // Load grades data when switching to course view (needed for Assignments + Grades tabs)
  const loadGradesIfNeeded = useCallback((instanceUrl: string) => {
    if (gradesData[instanceUrl]) return
    setGradesLoading(true)
    api.canvasGrades()
      .then(conns => {
        const conn = conns.find(c => c.canvasInstanceUrl === instanceUrl)
        if (conn) setGradesData(prev => ({ ...prev, [instanceUrl]: conn }))
      })
      .catch(() => {/* non-critical */})
      .finally(() => setGradesLoading(false))
  }, [gradesData])

  const openCourse = (courseId: number) => {
    setActiveCourseId(courseId)
    setView('course')
    setCourseTab('modules')
    setDetailAssignmentId(null)
    setDetailCourseId(null)
    if (activeInstance) loadGradesIfNeeded(activeInstance)
  }

  const openAssignment = (courseId: number, assignmentId: number) => {
    setDetailCourseId(courseId)
    setDetailAssignmentId(assignmentId)
  }

  const closeDetail = () => { setDetailCourseId(null); setDetailAssignmentId(null) }

  // Derived
  const dash = activeInstance ? dashData[activeInstance] : undefined
  const gradesConn = activeInstance ? gradesData[activeInstance] : undefined
  const activeCourse = dash?.courses.find(c => c.id === activeCourseId)
  const gradesForCourse = activeCourseId ? gradesConn?.courses.find(c => c.id === activeCourseId) : undefined
  const showDetailPanel = detailCourseId !== null && detailAssignmentId !== null

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!initialLoading && notConnected) {
    return (
      <div className="fade-up" style={{ maxWidth: 520, margin: '80px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 0 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 20 }}>🎓</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>Canvas not connected</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: '0 0 28px', maxWidth: 380 }}>
          Link your Canvas account in Settings to browse your courses, modules, assignments, and files here.
        </p>
        <button onClick={() => router.push('/settings#canvas')} className="ns-btn-primary" style={{ padding: '11px 28px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}>
          Go to Settings → Connect Canvas
        </button>
        <button onClick={() => router.push('/grades')} style={{ marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
          ← Back to Grade Portal
        </button>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .canvas-html img { max-width: 100%; height: auto; border-radius: 6px; }
        .canvas-html a { color: var(--primary); }
        .canvas-html p { margin: 0 0 10px; }
        .canvas-html ul, .canvas-html ol { padding-left: 20px; margin: 0 0 10px; }
        .canvas-html h1, .canvas-html h2, .canvas-html h3 { color: var(--text); margin: 12px 0 6px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', margin: '0 -24px' }}>
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflowY: 'auto' }}>
          {/* Back to grade portal */}
          <button
            onClick={() => router.push('/grades')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textAlign: 'left' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Grade Portal
          </button>

          {/* Instance switcher (for dual-enrolled) */}
          {connections.length > 1 && (
            <div style={{ padding: '10px 10px 4px' }}>
              {connections.map(c => (
                <button
                  key={c.canvasInstanceUrl}
                  onClick={() => { setActiveInstance(c.canvasInstanceUrl); setView('dashboard'); setActiveCourseId(null); closeDetail() }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none', background: activeInstance === c.canvasInstanceUrl ? 'var(--primary-dim)' : 'transparent', color: activeInstance === c.canvasInstanceUrl ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}
                >
                  {instanceLabel(c.canvasInstanceUrl)}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 4px' }} />
            </div>
          )}

          {/* Dashboard link */}
          <div style={{ padding: '8px 10px 4px' }}>
            <button
              onClick={() => { setView('dashboard'); setActiveCourseId(null); closeDetail() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 8, border: 'none', background: view === 'dashboard' ? 'var(--primary-dim)' : 'transparent', color: view === 'dashboard' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </button>
          </div>

          {/* Course list */}
          <div style={{ padding: '4px 10px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-muted)', padding: '8px 12px 4px' }}>Courses</div>
            {initialLoading || dashLoading ? (
              <SidebarSkeleton />
            ) : dash?.courses.map(course => (
              <button
                key={course.id}
                onClick={() => openCourse(course.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 12px', borderRadius: 8, border: 'none',
                  background: activeCourseId === course.id && view === 'course' ? 'var(--primary-dim)' : 'transparent',
                  color: activeCourseId === course.id && view === 'course' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: 12.5, fontWeight: activeCourseId === course.id && view === 'course' ? 700 : 400,
                  cursor: 'pointer', textAlign: 'left', lineHeight: 1.35, marginBottom: 1,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor(course.currentScore), flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', minWidth: 0 }}>
          {initialLoading ? (
            <ContentSkeleton />
          ) : view === 'dashboard' ? (
            <>
              {/* Dashboard header */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.4px' }}>
                      {activeInstance ? instanceLabel(activeInstance) : 'Canvas'}
                    </h1>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>Your Canvas dashboard — courses, to-dos, and grades in one place.</p>
                  </div>
                  {activeInstance && (
                    <a href={`https://${activeInstance}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Open Canvas
                    </a>
                  )}
                </div>
              </div>

              {dashLoading ? <ContentSkeleton /> : dash ? (
                <DashboardView
                  courses={dash.courses}
                  todo={dash.todo}
                  onSelectCourse={openCourse}
                />
              ) : null}
            </>
          ) : activeCourse ? (
            <>
              {/* Course header */}
              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={() => { setView('dashboard'); setActiveCourseId(null); closeDetail() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0, marginBottom: 12 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Dashboard
                </button>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.3px' }}>{activeCourse.name}</h1>
                    {activeCourse.currentScore !== null && (
                      <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor(activeCourse.currentScore) }}>
                        {activeCourse.currentScore.toFixed(1)}%
                        {activeCourse.currentGrade && <span style={{ marginLeft: 8 }}>{activeCourse.currentGrade}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                {(['modules', 'assignments', 'grades', 'announcements', 'files'] as CourseTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setCourseTab(tab); closeDetail() }}
                    style={{
                      padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: courseTab === tab ? 700 : 500,
                      color: courseTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                      borderBottom: courseTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                      marginBottom: -1,
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {courseTab === 'modules' && activeCourseId !== null && activeInstance && (
                <ModulesTab
                  courseId={activeCourseId}
                  canvasInstanceUrl={activeInstance}
                  onSelectAssignment={id => openAssignment(activeCourseId, id)}
                />
              )}
              {courseTab === 'assignments' && (
                gradesLoading ? <ContentSkeleton /> : (
                  <AssignmentsTab
                    courseGrades={gradesForCourse}
                    onSelectAssignment={id => openAssignment(activeCourseId!, id)}
                  />
                )
              )}
              {courseTab === 'announcements' && activeCourseId !== null && activeInstance && (
                <AnnouncementsTab courseId={activeCourseId} canvasInstanceUrl={activeInstance} />
              )}
              {courseTab === 'files' && activeCourseId !== null && activeInstance && (
                <FilesTab courseId={activeCourseId} canvasInstanceUrl={activeInstance} />
              )}
              {courseTab === 'grades' && (
                gradesLoading ? <ContentSkeleton /> : <GradesTab courseGrades={gradesForCourse} />
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Assignment detail slide-in */}
      {showDetailPanel && activeInstance && detailCourseId !== null && detailAssignmentId !== null && (
        <AssignmentPanel
          courseId={detailCourseId}
          assignmentId={detailAssignmentId}
          canvasInstanceUrl={activeInstance}
          instanceBaseUrl={activeInstance}
          onClose={closeDetail}
        />
      )}
    </>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  metaLabel: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 2 },
  metaValue: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  sectionTitle: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 12 },
}
