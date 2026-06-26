'use client'

import DOMPurify from 'dompurify'
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
  type CanvasPage,
  type CanvasDiscussionEntry,
  type CanvasDiscussionParticipant,
  type CanvasDiscussionTopic,
  type CanvasDiscussionView,
  type CanvasQuizDetail,
  type CanvasQuizQuestion,
  type CanvasQuizSubmission,
  type CanvasActiveQuizSubmission,
  type CanvasSubmissionQuestion,
  type CanvasSubmissionQuestionAnswer,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function prepareCanvasHtml(html: string, canvasBaseUrl?: string): string {
  if (typeof window === 'undefined') return ''
  let out = html
  if (canvasBaseUrl) {
    const base = `https://${canvasBaseUrl.replace(/^https?:\/\//, '')}`
    out = out.replace(/(src|href)=(["'])\/\//gi, `$1=$2https://`)
    out = out.replace(/(src|href)=(["'])\//gi, `$1=$2${base}/`)
  }
  return DOMPurify.sanitize(out, { USE_PROFILES: { html: true } })
}

// ── Page Detail Panel ─────────────────────────────────────────────────────────

function PagePanel({
  courseId, pageSlug, pageTitle, canvasInstanceUrl,
  onClose,
}: {
  courseId: number
  pageSlug: string
  pageTitle: string
  canvasInstanceUrl: string
  onClose: () => void
}) {
  const [page, setPage] = useState<CanvasPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setErr(null); setPage(null)
    api.canvasCoursePage(courseId, pageSlug, canvasInstanceUrl)
      .then(setPage)
      .catch(() => setErr('Could not load page content.'))
      .finally(() => setLoading(false))
  }, [courseId, pageSlug, canvasInstanceUrl])

  const canvasUrl = page?.url
    ? (page.url.startsWith('http') ? page.url : `https://${canvasInstanceUrl}/courses/${courseId}/pages/${page.url}`)
    : undefined

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: 560, height: '100%', background: 'var(--background)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', borderRadius: 6, display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 2 }}>Page</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pageTitle}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading && <ContentSkeleton />}
        {err && <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 40 }}>{err}</div>}
        {page && !loading && (
          page.body ? (
            <div
              className="canvas-page-body"
              dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(page.body, canvasInstanceUrl) }}
              style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>This page has no content.</div>
          )
        )}
      </div>

      {/* Footer */}
      {canvasUrl && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
            Open in Canvas
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      )}
    </div>
  )
}

// ── Discussion Panel ──────────────────────────────────────────────────────────

function DiscussionEntryRow({
  entry, participants, depth, canvasBaseUrl, courseId, topicId, canvasInstanceUrl, onReplyPosted,
}: {
  entry: CanvasDiscussionEntry
  participants: CanvasDiscussionParticipant[]
  depth: number
  canvasBaseUrl: string
  courseId: number
  topicId: number
  canvasInstanceUrl: string
  onReplyPosted: () => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [posting, setPosting] = useState(false)
  const author = participants.find(p => p.id === entry.user_id)

  async function handleReply() {
    if (!replyText.trim() || posting) return
    setPosting(true)
    try {
      await api.canvasDiscussionPost(courseId, topicId, { message: replyText.trim(), parentEntryId: entry.id, canvasInstanceUrl })
      setReplyText('')
      setShowReply(false)
      onReplyPosted()
    } catch { /* swallow */ } finally { setPosting(false) }
  }

  return (
    <div style={{ marginLeft: depth * 16, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none', paddingLeft: depth > 0 ? 12 : 0, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
          {author?.avatar_image_url
            ? <img src={author.avatar_image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : (author?.display_name?.[0] ?? '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{author?.display_name ?? 'Unknown'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(entry.created_at)}</span>
          </div>
          <div
            className="canvas-html"
            style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(entry.message, canvasBaseUrl) }}
          />
          <button
            onClick={() => setShowReply(r => !r)}
            style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--primary)', fontWeight: 600, padding: 0 }}
          >
            {showReply ? 'Cancel' : '↩ Reply'}
          </button>
          {showReply && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                rows={3}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleReply}
                disabled={posting || !replyText.trim()}
                style={{ alignSelf: 'flex-end', padding: '8px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: posting || !replyText.trim() ? 0.6 : 1, flexShrink: 0 }}
              >
                {posting ? '…' : 'Post'}
              </button>
            </div>
          )}
        </div>
      </div>
      {entry.replies?.map(r => (
        <DiscussionEntryRow key={r.id} entry={r} participants={participants} depth={depth + 1}
          canvasBaseUrl={canvasBaseUrl} courseId={courseId} topicId={topicId}
          canvasInstanceUrl={canvasInstanceUrl} onReplyPosted={onReplyPosted} />
      ))}
    </div>
  )
}

function DiscussionPanel({
  courseId, topicId, topicTitle, canvasInstanceUrl, onClose,
}: {
  courseId: number
  topicId: number
  topicTitle: string
  canvasInstanceUrl: string
  onClose: () => void
}) {
  const [data, setData] = useState<{ topic: CanvasDiscussionTopic; view: CanvasDiscussionView } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [newPost, setNewPost] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(() => {
    setLoading(true); setErr(null)
    api.canvasDiscussion(courseId, topicId, canvasInstanceUrl)
      .then(setData)
      .catch(() => setErr('Could not load discussion.'))
      .finally(() => setLoading(false))
  }, [courseId, topicId, canvasInstanceUrl])

  useEffect(() => { load() }, [load])

  async function handlePost() {
    if (!newPost.trim() || posting) return
    setPosting(true)
    try {
      await api.canvasDiscussionPost(courseId, topicId, { message: newPost.trim(), canvasInstanceUrl })
      setNewPost('')
      load()
    } catch { /* swallow */ } finally { setPosting(false) }
  }

  const canvasUrl = data?.topic.html_url ?? ''

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: 580, height: '100%', background: 'var(--background)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', borderRadius: 6, display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 2 }}>Discussion</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.topic.title ?? topicTitle}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
        {loading && <ContentSkeleton />}
        {err && <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 40 }}>{err}</div>}
        {data && !loading && (
          <>
            {data.topic.message && (
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 8 }}>Prompt</div>
                <div className="canvas-html" style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)' }}
                  dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(data.topic.message, canvasInstanceUrl) }} />
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 12 }}>
              {data.view.view.length} {data.view.view.length === 1 ? 'reply' : 'replies'}
            </div>
            {data.view.view.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>No replies yet. Be the first!</div>
            )}
            {data.view.view.map(entry => (
              <DiscussionEntryRow key={entry.id} entry={entry} participants={data.view.participants}
                depth={0} canvasBaseUrl={canvasInstanceUrl} courseId={courseId} topicId={topicId}
                canvasInstanceUrl={canvasInstanceUrl} onReplyPosted={load} />
            ))}
          </>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={newPost}
          onChange={e => setNewPost(e.target.value)}
          placeholder="Write a new post…"
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handlePost}
            disabled={posting || !newPost.trim()}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: posting || !newPost.trim() ? 0.6 : 1 }}
          >
            {posting ? 'Posting…' : '✏️ Post Reply'}
          </button>
          {canvasUrl && (
            <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              Open in Canvas
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Quiz Taker Panel ──────────────────────────────────────────────────────────

type QuizAnswer = number | string | number[] | null

function QuizTakerQuestion({
  question,
  answer,
  onChange,
  idx,
}: {
  question: CanvasSubmissionQuestion
  answer: QuizAnswer
  onChange: (answer: QuizAnswer) => void
  idx: number
  total: number
}) {
  const qType = question.question_type

  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', marginTop: 1 }}>
            Q{idx + 1}
          </span>
          <div
            className="canvas-html"
            style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.65, flex: 1 }}
            dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(question.question_text) }}
          />
        </div>
        <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {question.points_possible} pt{question.points_possible !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Multiple choice / True-False */}
      {(qType === 'multiple_choice_question' || qType === 'true_false_question') && question.answers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {question.answers.map((ans: CanvasSubmissionQuestionAnswer) => {
            const selected = answer === ans.id
            return (
              <button
                key={ans.id}
                onClick={() => onChange(ans.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 8, border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'rgba(var(--primary-rgb),0.08)' : 'var(--surface-2)',
                  color: selected ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: selected ? 700 : 400, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'var(--primary)' : 'transparent',
                }} />
                <span dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(ans.html ?? ans.text) }} />
              </button>
            )
          })}
        </div>
      )}

      {/* Multiple answers (checkboxes) */}
      {qType === 'multiple_answers_question' && question.answers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {question.answers.map((ans: CanvasSubmissionQuestionAnswer) => {
            const selected = Array.isArray(answer) && (answer as number[]).includes(ans.id)
            return (
              <button
                key={ans.id}
                onClick={() => {
                  const cur = (Array.isArray(answer) ? answer : []) as number[]
                  onChange(selected ? cur.filter(id => id !== ans.id) : [...cur, ans.id])
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 8, border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'rgba(var(--primary-rgb),0.08)' : 'var(--surface-2)',
                  color: selected ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: selected ? 700 : 400, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>}
                </span>
                <span dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(ans.html ?? ans.text) }} />
              </button>
            )
          })}
        </div>
      )}

      {/* Short answer */}
      {qType === 'short_answer_question' && (
        <input
          type="text"
          value={(answer as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Your answer…"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
        />
      )}

      {/* Essay */}
      {qType === 'essay_question' && (
        <textarea
          value={(answer as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Write your response here…"
          rows={5}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      )}

      {/* Numerical */}
      {qType === 'numerical_question' && (
        <input
          type="number"
          value={(answer as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter a number…"
          style={{ width: 180, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 }}
        />
      )}

      {/* Unsupported types */}
      {!['multiple_choice_question','true_false_question','multiple_answers_question','short_answer_question','essay_question','numerical_question','text_only_question'].includes(qType) && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0', fontStyle: 'italic' }}>
          This question type ({qType.replace(/_/g, ' ')}) must be answered in Canvas.
        </div>
      )}
    </div>
  )
}

function QuizTakerPanel({
  courseId, quizId, quizTitle, quizDetail, canvasInstanceUrl, onClose, onSubmitted,
}: {
  courseId: number
  quizId: number
  quizTitle: string
  quizDetail: { time_limit: number | null; allowed_attempts: number; question_count: number }
  canvasInstanceUrl: string
  onClose: () => void
  onSubmitted: () => void
}) {
  const [stage, setStage] = useState<'confirm' | 'loading' | 'taking' | 'submitting' | 'done' | 'error'>('confirm')
  const [submission, setSubmission] = useState<CanvasActiveQuizSubmission | null>(null)
  const [questions, setQuestions] = useState<CanvasSubmissionQuestion[]>([])
  const [answers, setAnswers] = useState<Map<number, QuizAnswer>>(new Map())
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startQuiz() {
    setStage('loading')
    try {
      const sub = await api.canvasStartQuizSubmission(courseId, quizId, canvasInstanceUrl)
      const qs = await api.canvasGetSubmissionQuestions(courseId, quizId, sub.id, sub.validation_token, canvasInstanceUrl)
      setSubmission(sub)
      setQuestions(qs)
      setAnswers(new Map())

      if (sub.end_at) {
        const remaining = Math.max(0, Math.floor((new Date(sub.end_at).getTime() - Date.now()) / 1000))
        setTimeLeft(remaining)
        timerRef.current = setInterval(() => {
          setTimeLeft(t => {
            if (t === null || t <= 1) {
              clearInterval(timerRef.current!)
              return 0
            }
            return t - 1
          })
        }, 1000)
      }

      autoSaveRef.current = setInterval(() => {
        setAnswers(cur => {
          const quizQs = Array.from(cur.entries()).map(([id, answer]) => ({ id, flagged: false, answer }))
          api.canvasSaveQuizAnswers(courseId, quizId, sub.id, {
            validationToken: sub.validation_token,
            attempt: sub.attempt,
            quizQuestions: quizQs,
            canvasInstanceUrl,
          }).catch(() => {})
          return cur
        })
      }, 30_000)

      setStage('taking')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not start quiz. It may have reached its attempt limit.')
      setStage('error')
    }
  }

  async function submitQuiz() {
    if (!submission) return
    setStage('submitting')
    try {
      const quizQs = Array.from(answers.entries()).map(([id, answer]) => ({ id, flagged: false, answer }))
      await api.canvasSaveQuizAnswers(courseId, quizId, submission.id, {
        validationToken: submission.validation_token,
        attempt: submission.attempt,
        quizQuestions: quizQs,
        canvasInstanceUrl,
      })
      await api.canvasCompleteQuizSubmission(courseId, quizId, submission.id, {
        validationToken: submission.validation_token,
        attempt: submission.attempt,
        canvasInstanceUrl,
      })
      setStage('done')
      onSubmitted()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Submission failed. Please try again.')
      setStage('taking')
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [])

  const answeredCount = answers.size
  const totalQ = questions.filter(q => q.question_type !== 'text_only_question').length

  function fmtTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--background)', borderRadius: 14, width: '100%', maxWidth: 700,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)', border: '1px solid var(--border)',
        margin: '0 16px',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 2 }}>Quiz</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quizTitle}</div>
          </div>
          {stage === 'taking' && timeLeft !== null && (
            <div style={{
              fontSize: 15, fontWeight: 800, padding: '5px 12px', borderRadius: 8,
              background: timeLeft < 120 ? 'rgba(239,68,68,0.12)' : 'var(--surface-2)',
              color: timeLeft < 120 ? '#EF4444' : 'var(--text)',
              border: `1px solid ${timeLeft < 120 ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtTime(timeLeft)}
            </div>
          )}
          {stage === 'taking' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {answeredCount}/{totalQ} answered
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Confirm stage */}
          {stage === 'confirm' && (
            <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
              <div style={{ fontSize: 36 }}>📝</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Ready to start?</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 380 }}>
                This will start a new quiz attempt. Once started, {quizDetail.time_limit ? `you'll have ${quizDetail.time_limit} minutes.` : 'you can take your time.'}
                {quizDetail.allowed_attempts > 0 && ` You have ${quizDetail.allowed_attempts} attempt${quizDetail.allowed_attempts !== 1 ? 's' : ''} allowed.`}
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                <button onClick={startQuiz} style={{ flex: 2, padding: '11px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Start Quiz</button>
              </div>
            </div>
          )}

          {/* Loading */}
          {stage === 'loading' && (
            <div style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Starting quiz…</div>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div style={{ padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Could not start quiz</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 360 }}>{errorMsg}</div>
              <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Close</button>
            </div>
          )}

          {/* Done */}
          {stage === 'done' && (
            <div style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Quiz Submitted!</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>Your answers have been submitted. Check back in the quiz panel to see your score once it&apos;s graded.</div>
              <button onClick={onClose} style={{ padding: '11px 28px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Done</button>
            </div>
          )}

          {/* Taking / Submitting */}
          {(stage === 'taking' || stage === 'submitting') && questions.map((q, idx) => (
            <QuizTakerQuestion
              key={q.id}
              question={q}
              answer={answers.get(q.id) ?? null}
              onChange={val => setAnswers(prev => new Map(prev).set(q.id, val))}
              idx={idx}
              total={questions.length}
            />
          ))}
        </div>

        {/* Footer — Submit button */}
        {(stage === 'taking' || stage === 'submitting') && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {errorMsg && stage === 'taking' && (
              <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', fontWeight: 600 }}>{errorMsg}</div>
            )}
            <button
              onClick={submitQuiz}
              disabled={stage === 'submitting'}
              style={{ width: '100%', padding: '12px 0', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: stage === 'submitting' ? 'not-allowed' : 'pointer', opacity: stage === 'submitting' ? 0.7 : 1 }}
            >
              {stage === 'submitting' ? 'Submitting…' : `Submit Quiz (${answeredCount}/${totalQ} answered)`}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Answers auto-save every 30 seconds</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Quiz Panel ────────────────────────────────────────────────────────────────

function QuizQuestionRow({ question, submissionData, showCorrect }: {
  question: CanvasQuizQuestion
  submissionData?: { answer_id?: number; text?: string; answer_for_text_entry?: string; correct: boolean | null; points: number }
  showCorrect: boolean
}) {
  const isAnswered = submissionData !== undefined
  const isCorrect = submissionData?.correct
  const selectedAnswerId = submissionData?.answer_id
  const selectedText = submissionData?.text ?? submissionData?.answer_for_text_entry

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 12, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <div className="canvas-html" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}
          dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(question.question_text) }} />
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{question.points_possible} pt{question.points_possible !== 1 ? 's' : ''}</span>
          {isAnswered && showCorrect && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isCorrect ? '#22C55E' : '#EF4444' }}>
              {isCorrect ? `✓ +${submissionData.points}` : '✗ 0'}
            </span>
          )}
        </div>
      </div>

      {(question.question_type === 'multiple_choice_question' || question.question_type === 'true_false_question') && question.answers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {question.answers.map(ans => {
            const isSelected = selectedAnswerId === ans.id
            const isCorrectAnswer = showCorrect && ans.weight > 0
            return (
              <div key={ans.id} style={{
                padding: '8px 12px', borderRadius: 7, fontSize: 13,
                border: `1px solid ${isSelected ? (isCorrect === false ? '#EF4444' : 'var(--primary)') : isCorrectAnswer ? 'rgba(34,197,94,0.5)' : 'var(--border)'}`,
                background: isSelected ? (isCorrect === false ? 'rgba(239,68,68,0.08)' : 'rgba(var(--primary-rgb),0.08)') : isCorrectAnswer ? 'rgba(34,197,94,0.06)' : 'transparent',
                color: isSelected ? 'var(--text)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, background: isSelected ? 'var(--primary)' : 'transparent', flexShrink: 0 }} />
                {ans.text || ans.html?.replace(/<[^>]*>/g, '') || '(no text)'}
                {isSelected && !isCorrect && showCorrect && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#EF4444' }}>Your answer</span>}
                {isCorrectAnswer && showCorrect && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#22C55E' }}>Correct</span>}
              </div>
            )
          })}
        </div>
      )}

      {(question.question_type === 'short_answer_question' || question.question_type === 'fill_in_blank_question' || question.question_type === 'essay_question' || question.question_type === 'numerical_question') && (
        <div style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 13, color: 'var(--text-secondary)', minHeight: 36 }}>
          {selectedText ?? <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No answer recorded</span>}
        </div>
      )}

      {question.question_type === 'text_only_question' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Informational — no answer required</div>
      )}
    </div>
  )
}

function QuizPanel({
  courseId, quizId, quizTitle, canvasInstanceUrl, canvasItemUrl, onClose,
}: {
  courseId: number
  quizId: number
  quizTitle: string
  canvasInstanceUrl: string
  canvasItemUrl?: string
  onClose: () => void
}) {
  const [data, setData] = useState<{ quiz: CanvasQuizDetail; questions: CanvasQuizQuestion[]; submissions: CanvasQuizSubmission[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selectedAttempt, setSelectedAttempt] = useState(0)
  const [showTaker, setShowTaker] = useState(false)

  useEffect(() => {
    setLoading(true); setErr(null)
    api.canvasQuiz(courseId, quizId, canvasInstanceUrl)
      .then(d => { setData(d); setSelectedAttempt(d.submissions.length - 1) })
      .catch(() => setErr('new-quiz'))
      .finally(() => setLoading(false))
  }, [courseId, quizId, canvasInstanceUrl])

  const sub = data?.submissions[selectedAttempt]
  const subMap = new Map((sub?.submission_data ?? []).map(s => [s.question_id, s]))
  const canvasUrl = data?.quiz.html_url || canvasItemUrl || ''

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: 580, height: '100%', background: 'var(--background)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', borderRadius: 6, display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 2 }}>Quiz</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data?.quiz.title ?? quizTitle}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
        {loading && <ContentSkeleton />}
        {err && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 40, padding: '0 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Quiz data not available</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 340 }}>
              This appears to be a <strong>New Quiz (LTI)</strong> — your school&apos;s quiz engine doesn&apos;t expose results or questions through the Canvas API. You&apos;ll need to open it in Canvas to take it or see your results.
            </div>
            {canvasUrl && (
              <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Open Quiz in Canvas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            )}
          </div>
        )}
        {data && !loading && (
          <>
            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Points', `${data.quiz.points_possible}`],
                ['Questions', `${data.quiz.question_count}`],
                ['Time Limit', data.quiz.time_limit ? `${data.quiz.time_limit} min` : 'None'],
                ['Attempts', data.quiz.allowed_attempts === -1 ? 'Unlimited' : `${data.quiz.allowed_attempts}`],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Submissions */}
            {data.submissions.length > 0 ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>Your Attempts</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {data.submissions.map((s, i) => (
                      <button key={s.id} onClick={() => setSelectedAttempt(i)}
                        style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${selectedAttempt === i ? 'var(--primary)' : 'var(--border)'}`, background: selectedAttempt === i ? 'var(--primary-dim)' : 'transparent', color: selectedAttempt === i ? 'var(--primary)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        #{s.attempt} {s.score !== null ? `— ${s.score}/${s.quiz_points_possible}` : `(${s.workflow_state})`}
                      </button>
                    ))}
                  </div>
                </div>

                {sub && data.questions.length > 0 ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Question Review {!data.quiz.show_correct_answers && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· correct answers hidden by instructor</span>}
                      {!sub.submission_data?.length && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · your selected answers are not available for this attempt</span>}
                    </div>
                    {data.questions.map(q => (
                      <QuizQuestionRow key={q.id} question={q} submissionData={subMap.get(q.id) as Parameters<typeof QuizQuestionRow>[0]['submissionData']} showCorrect={data.quiz.show_correct_answers} />
                    ))}
                  </>
                ) : sub ? (
                  <div style={{ padding: '16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{sub.kept_score ?? sub.score ?? '—'} / {sub.quiz_points_possible}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Question details are not available for this quiz.</div>
                  </div>
                ) : null}
              </>
            ) : (
              <div style={{ padding: '20px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>You haven&apos;t taken this quiz yet.</div>
                <button
                  onClick={() => setShowTaker(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
                >
                  Take Quiz
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!err && (
          <button
            onClick={() => setShowTaker(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', width: '100%' }}
          >
            {data?.submissions.length ? 'Retake Quiz' : 'Take Quiz'}
          </button>
        )}
        <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
          {data?.submissions.length ? 'Review / Retake in Canvas' : 'Open in Canvas'}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>

      {showTaker && data && (
        <QuizTakerPanel
          courseId={courseId}
          quizId={quizId}
          quizTitle={data.quiz.title ?? quizTitle}
          quizDetail={{ time_limit: data.quiz.time_limit, allowed_attempts: data.quiz.allowed_attempts, question_count: data.quiz.question_count }}
          canvasInstanceUrl={canvasInstanceUrl}
          onClose={() => setShowTaker(false)}
          onSubmitted={() => {
            setShowTaker(false)
            setLoading(true)
            api.canvasQuiz(courseId, quizId, canvasInstanceUrl)
              .then(d => { setData(d); setSelectedAttempt(d.submissions.length - 1) })
              .catch(() => {})
              .finally(() => setLoading(false))
          }}
        />
      )}
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

  // Submission state
  const [submitMode, setSubmitMode] = useState(false)
  const [submitText, setSubmitText] = useState('')
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setLoading(true); setError(false); setDetail(null); setSubmitMode(false); setSubmitMsg(null)
    api.canvasAssignmentDetail(courseId, assignmentId, canvasInstanceUrl)
      .then(setDetail)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [courseId, assignmentId, canvasInstanceUrl])

  async function handleSubmit(type: 'online_text_entry' | 'online_url') {
    if (submitting) return
    setSubmitting(true); setSubmitMsg(null)
    try {
      await api.canvasSubmitAssignment(courseId, assignmentId, {
        submissionType: type,
        body: type === 'online_text_entry' ? submitText : undefined,
        url: type === 'online_url' ? submitUrl : undefined,
        canvasInstanceUrl,
      })
      setSubmitMsg({ ok: true, text: '✓ Submitted successfully!' })
      setSubmitMode(false)
      // Refresh detail to get updated submission state
      api.canvasAssignmentDetail(courseId, assignmentId, canvasInstanceUrl).then(setDetail).catch(() => {})
    } catch (e) {
      setSubmitMsg({ ok: false, text: e instanceof Error ? e.message : 'Submission failed' })
    } finally {
      setSubmitting(false)
    }
  }

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
                  dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(detail.description, instanceBaseUrl) }}
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
      {detail && (() => {
        const canSubmitText = detail.submission_types.includes('online_text_entry')
        const canSubmitUrl = detail.submission_types.includes('online_url')
        const canSubmitFile = detail.submission_types.includes('online_upload')
        const canSubmitAny = canSubmitText || canSubmitUrl || canSubmitFile
        const alreadySubmitted = sub && sub.workflow_state !== 'unsubmitted'
        const canvasUrl = detail.html_url.startsWith('http')
          ? detail.html_url
          : `https://${instanceBaseUrl}${detail.html_url.startsWith('/') ? detail.html_url : `/${detail.html_url}`}`

        return (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {submitMsg && (
              <div style={{ fontSize: 12, fontWeight: 600, color: submitMsg.ok ? '#22C55E' : '#EF4444', textAlign: 'center' }}>{submitMsg.text}</div>
            )}

            {submitMode && canSubmitText && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={submitText}
                  onChange={e => setSubmitText(e.target.value)}
                  placeholder="Write your submission here…"
                  rows={5}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSubmit('online_text_entry')} disabled={submitting || !submitText.trim()}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: submitting || !submitText.trim() ? 0.6 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit Text'}
                  </button>
                  <button onClick={() => setSubmitMode(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {submitMode && canSubmitUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="url"
                  value={submitUrl}
                  onChange={e => setSubmitUrl(e.target.value)}
                  placeholder="https://…"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSubmit('online_url')} disabled={submitting || !submitUrl.trim()}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: submitting || !submitUrl.trim() ? 0.6 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit URL'}
                  </button>
                  <button onClick={() => setSubmitMode(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {!submitMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {canSubmitAny && !alreadySubmitted && (canSubmitText || canSubmitUrl) && (
                  <button
                    onClick={() => setSubmitMode(true)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
                  >
                    ✏️ Submit Assignment
                  </button>
                )}
                {canSubmitFile && !alreadySubmitted && (
                  <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    📎 Upload File in Canvas
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                )}
                <a href={canvasUrl} target="_blank" rel="noopener noreferrer" data-no-intercept="true"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                  Open in Canvas
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Course content tabs ───────────────────────────────────────────────────────

type CourseTab = 'modules' | 'assignments' | 'announcements' | 'files' | 'grades'

type PendingCanvasItem = { title: string; type: string; href: string }

function canvasRedirectMessage(type: string, href: string): string {
  if (type === 'Quiz') return "Classic quizzes must be taken on Canvas. Once completed, click to view your attempt scores and question review inside Futurely."
  if (type === 'Discussion') return "This discussion will open in Futurely once loaded."
  if (type === 'ExternalTool' && href.includes('/quizzes/')) return "Your school uses New Quizzes (LTI). These can't be accessed via the Canvas API and must be taken directly in Canvas."
  if (type === 'ExternalTool') return "This external tool must be launched from Canvas."
  if (type === 'ExternalUrl') return "This is an external link that will open in your browser."
  if (/\/modules/.test(href)) return "This links to a Canvas modules section."
  return "This content isn't available inside Futurely and will open in Canvas."
}

function ModulesTab({
  courseId, canvasInstanceUrl, instanceBaseUrl,
  onSelectAssignment, onSelectPage, onSelectDiscussion, onSelectQuiz,
}: {
  courseId: number
  canvasInstanceUrl: string
  instanceBaseUrl: string
  onSelectAssignment: (assignmentId: number) => void
  onSelectPage: (pageSlug: string, title: string) => void
  onSelectDiscussion: (topicId: number, title: string) => void
  onSelectQuiz: (quizId: number, title: string, itemUrl?: string) => void
}) {
  const [modules, setModules] = useState<CanvasModule[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [pending, setPending] = useState<PendingCanvasItem | null>(null)

  useEffect(() => {
    setLoading(true); setModules(null)
    api.canvasCourseModules(courseId, canvasInstanceUrl)
      .then(setModules)
      .catch(() => setModules([]))
      .finally(() => setLoading(false))
  }, [courseId, canvasInstanceUrl])

  const toggle = (id: number) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const handleOpenInCanvas = (title: string, type: string, href: string) => {
    // If the link targets a specific module anchor, expand it in-app instead
    const moduleMatch = href.match(/#module_(\d+)/)
    if (moduleMatch) {
      const moduleId = parseInt(moduleMatch[1])
      setCollapsed(s => { const n = new Set(s); n.delete(moduleId); return n })
      setTimeout(() => {
        document.getElementById(`futurely-module-${moduleId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      return
    }
    setPending({ title, type, href })
  }

  if (loading) return <ContentSkeleton />
  if (!modules || modules.length === 0) return <Empty text="No modules found for this course." />

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {modules.map(mod => {
          const isOpen = !collapsed.has(mod.id)
          return (
            <div key={mod.id} id={`futurely-module-${mod.id}`} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
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
                        instanceBaseUrl={instanceBaseUrl}
                        onSelectAssignment={
                          (item.type === 'Assignment' || (item.type !== 'Quiz' && item.type !== 'Discussion' && item.html_url?.includes('/assignments/')))
                            ? (() => {
                                const id = item.content_id ?? parseInt(item.html_url?.split('/assignments/')[1]?.split('?')[0] ?? '')
                                if (id) onSelectAssignment(id)
                              })
                            : undefined
                        }
                        onSelectPage={
                          (item.type === 'Page' || (item.type !== 'Quiz' && item.type !== 'Discussion' && item.html_url?.includes('/pages/')))
                            ? (() => {
                                const slug = item.url?.split('/pages/')[1] ?? item.html_url?.split('/pages/')[1]?.split('?')[0]
                                if (slug) onSelectPage(slug, item.title)
                              })
                            : undefined
                        }
                        onSelectDiscussion={
                          item.type === 'Discussion'
                            ? (() => {
                                const id = item.content_id ?? parseInt(item.html_url?.split('/discussion_topics/')[1]?.split('?')[0] ?? '')
                                if (id) onSelectDiscussion(id, item.title)
                              })
                            : undefined
                        }
                        onSelectQuiz={
                          (item.type === 'Quiz' || (item.type === 'ExternalTool' && item.html_url?.includes('/quizzes/')))
                            ? (() => {
                                const id = item.content_id ?? parseInt(item.html_url?.split('/quizzes/')[1]?.split('?')[0] ?? '')
                                if (id) onSelectQuiz(id, item.title, item.html_url)
                              })
                            : undefined
                        }
                        onOpenInCanvas={handleOpenInCanvas}
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

      {/* Canvas redirect confirmation modal */}
      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setPending(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 12, textAlign: 'center' }}>{moduleItemIcon(pending.type)}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>{pending.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
              {canvasRedirectMessage(pending.type, pending.href)}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPending(null)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <a href={pending.href} target="_blank" rel="noopener noreferrer" data-no-intercept="true" onClick={() => setPending(null)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 9, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Open in Canvas
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ModuleItemRow({ item, isLast, onSelectAssignment, onSelectPage, onSelectDiscussion, onSelectQuiz, onOpenInCanvas, instanceBaseUrl }: { item: CanvasModuleItem; isLast: boolean; onSelectAssignment?: () => void; onSelectPage?: () => void; onSelectDiscussion?: () => void; onSelectQuiz?: () => void; onOpenInCanvas?: (title: string, type: string, href: string) => void; instanceBaseUrl?: string }) {
  const complete = item.completion_requirement?.completed ?? false
  const hasInAppHandler = !!onSelectAssignment || !!onSelectPage || !!onSelectDiscussion || !!onSelectQuiz
  const rawHref = item.html_url ?? ''
  const canvasHref = !hasInAppHandler && rawHref
    ? (rawHref.startsWith('http') ? rawHref : `https://${instanceBaseUrl ?? ''}${rawHref.startsWith('/') ? rawHref : `/${rawHref}`}`)
    : undefined
  const opensInCanvas = !hasInAppHandler && !!canvasHref
  const handleClick = onSelectAssignment ?? onSelectPage ?? onSelectDiscussion ?? onSelectQuiz ?? (opensInCanvas && canvasHref && onOpenInCanvas ? () => onOpenInCanvas(item.title, item.type, canvasHref) : undefined)
  const isClickable = !!handleClick

  const inner = (
    <>
      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: 'center' }}>{moduleItemIcon(item.type)}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {item.type !== 'SubHeader' && item.completion_requirement && (
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${complete ? '#22C55E' : 'var(--border)'}`, background: complete ? 'rgba(34,197,94,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {complete && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
          </div>
        )}
        {isClickable && (
          opensInCanvas
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--text-muted)' }}><polyline points="9 18 15 12 9 6"/></svg>
        )}
      </div>
    </>
  )

  const sharedStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
    borderTop: '1px solid var(--border)',
    cursor: isClickable ? 'pointer' : 'default',
    background: 'transparent',
    transition: 'background 0.12s',
    width: '100%', textAlign: 'left',
  }

  return (
    <div onClick={handleClick} style={sharedStyle}
      onMouseEnter={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={e => { if (isClickable) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
      {inner}
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
              dangerouslySetInnerHTML={{ __html: prepareCanvasHtml(a.message, canvasInstanceUrl) }}
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
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--accent-blue))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
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

  // Page detail panel
  const [detailPageCourseId, setDetailPageCourseId] = useState<number | null>(null)
  const [detailPageSlug, setDetailPageSlug] = useState<string | null>(null)
  const [detailPageTitle, setDetailPageTitle] = useState<string>('')

  // Discussion panel
  const [detailDiscussionCourseId, setDetailDiscussionCourseId] = useState<number | null>(null)
  const [detailDiscussionTopicId, setDetailDiscussionTopicId] = useState<number | null>(null)
  const [detailDiscussionTitle, setDetailDiscussionTitle] = useState<string>('')

  // Quiz panel
  const [detailQuizCourseId, setDetailQuizCourseId] = useState<number | null>(null)
  const [detailQuizId, setDetailQuizId] = useState<number | null>(null)
  const [detailQuizTitle, setDetailQuizTitle] = useState<string>('')
  const [detailQuizItemUrl, setDetailQuizItemUrl] = useState<string>('')

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
    setDetailPageSlug(null)
  }

  const openPage = (courseId: number, pageSlug: string, title: string) => {
    setDetailPageCourseId(courseId); setDetailPageSlug(pageSlug); setDetailPageTitle(title)
    setDetailCourseId(null); setDetailAssignmentId(null)
    setDetailDiscussionTopicId(null); setDetailQuizId(null)
  }

  const openDiscussion = (courseId: number, topicId: number, title: string) => {
    setDetailDiscussionCourseId(courseId); setDetailDiscussionTopicId(topicId); setDetailDiscussionTitle(title)
    setDetailCourseId(null); setDetailAssignmentId(null); setDetailPageSlug(null)
    setDetailQuizId(null)
  }

  const openQuiz = (courseId: number, quizId: number, title: string, itemUrl?: string) => {
    setDetailQuizCourseId(courseId); setDetailQuizId(quizId); setDetailQuizTitle(title)
    setDetailQuizItemUrl(itemUrl ?? '')
    setDetailCourseId(null); setDetailAssignmentId(null); setDetailPageSlug(null)
    setDetailDiscussionTopicId(null)
  }

  const closeDetail = () => {
    setDetailCourseId(null); setDetailAssignmentId(null)
    setDetailPageSlug(null); setDetailPageCourseId(null)
    setDetailDiscussionTopicId(null); setDetailDiscussionCourseId(null)
    setDetailQuizId(null); setDetailQuizCourseId(null); setDetailQuizItemUrl('')
  }

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
                  instanceBaseUrl={activeInstance}
                  onSelectAssignment={id => openAssignment(activeCourseId, id)}
                  onSelectPage={(slug, title) => openPage(activeCourseId, slug, title)}
                  onSelectDiscussion={(id, title) => openDiscussion(activeCourseId, id, title)}
                  onSelectQuiz={(id, title, url) => openQuiz(activeCourseId, id, title, url)}
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

      {/* Page detail slide-in */}
      {activeInstance && detailPageCourseId !== null && detailPageSlug !== null && (
        <PagePanel
          courseId={detailPageCourseId}
          pageSlug={detailPageSlug}
          pageTitle={detailPageTitle}
          canvasInstanceUrl={activeInstance}
          onClose={closeDetail}
        />
      )}

      {/* Discussion slide-in */}
      {activeInstance && detailDiscussionCourseId !== null && detailDiscussionTopicId !== null && (
        <DiscussionPanel
          courseId={detailDiscussionCourseId}
          topicId={detailDiscussionTopicId}
          topicTitle={detailDiscussionTitle}
          canvasInstanceUrl={activeInstance}
          onClose={closeDetail}
        />
      )}

      {/* Quiz slide-in */}
      {activeInstance && detailQuizCourseId !== null && detailQuizId !== null && (
        <QuizPanel
          courseId={detailQuizCourseId}
          quizId={detailQuizId}
          quizTitle={detailQuizTitle}
          canvasInstanceUrl={activeInstance}
          canvasItemUrl={detailQuizItemUrl || undefined}
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
