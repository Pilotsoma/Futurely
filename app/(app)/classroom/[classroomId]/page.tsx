'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, ClassroomDetail, ClassroomPost } from '../../../../lib/api'

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date()
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ClassroomDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = Number(params.classroomId)

  const [classroom, setClassroom] = useState<ClassroomDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Posts state
  const [posts, setPosts]           = useState<ClassroomPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postBody, setPostBody]     = useState('')
  const [posting, setPosting]       = useState(false)
  const [postError, setPostError]   = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isNaN(id)) { router.replace('/classroom'); return }
    api.studentClassroomDetail(id)
      .then(data => setClassroom(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load classroom'))
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    if (isNaN(id)) return
    api.classroomPosts(id)
      .then(data => setPosts(data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false))
  }, [id])

  async function handlePost() {
    const trimmed = postBody.trim()
    if (!trimmed || posting) return
    setPosting(true)
    setPostError(null)
    try {
      const newPost = await api.classroomCreatePost(id, trimmed)
      setPosts(prev => [newPost, ...prev])
      setPostBody('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      </div>
    )
  }

  if (error || !classroom) {
    return (
      <div style={S.page}>
        <p style={{ color: 'var(--error)', fontSize: 14 }}>{error ?? 'Classroom not found.'}</p>
        <Link href="/classroom" style={{ color: 'var(--primary)', fontSize: 13, marginTop: 8, display: 'inline-block' }}>← Back</Link>
      </div>
    )
  }

  const upcoming = classroom.assignments.filter(a => !isOverdue(a.dueDate))
  const past     = classroom.assignments.filter(a => isOverdue(a.dueDate))

  return (
    <div style={S.page}>
      {/* Back */}
      <Link href="/classroom" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        All Classrooms
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{classroom.name}</h1>
        {classroom.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{classroom.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Teacher: <strong style={{ color: 'var(--text)' }}>{classroom.educator.name ?? classroom.educator.email}</strong>
          </span>
          <span style={S.pill}>{classroom.memberships.length} student{classroom.memberships.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Classroom Feed */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={S.sectionLabel}>Classroom Feed</h2>

        {/* Composer */}
        <div className="ns-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
          <textarea
            ref={textareaRef}
            value={postBody}
            onChange={e => {
              setPostBody(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { void handlePost() } }}
            placeholder="Share something with your class…"
            maxLength={500}
            rows={2}
            style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', lineHeight: 1.5, overflow: 'hidden' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{postBody.length}/500</span>
            <button
              onClick={() => void handlePost()}
              disabled={!postBody.trim() || posting}
              style={{ padding: '6px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: postBody.trim() && !posting ? 'pointer' : 'not-allowed', background: postBody.trim() && !posting ? 'var(--primary)' : 'var(--surface-2)', color: postBody.trim() && !posting ? '#fff' : 'var(--text-muted)', border: 'none', transition: 'all 0.15s' }}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {postError && <p style={{ fontSize: 12, color: 'var(--error)', margin: '6px 0 0' }}>{postError}</p>}
        </div>

        {/* Posts list */}
        {postsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2].map(i => <div key={i} className="shimmer" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="ns-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No posts yet — be the first to share something!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map(p => (
              <div key={p.id} className="ns-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--primary)', flexShrink: 0, overflow: 'hidden' }}>
                    {p.author.avatarUrl
                      ? <img src={p.author.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (p.author.name?.[0] ?? 'S').toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: p.author.nameColor ?? 'var(--text)' }}>
                      {p.author.name ?? 'Student'}
                    </span>
                    {p.author.tag && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {p.author.tag}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(p.createdAt)}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming assignments */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={S.sectionLabel}>Assignments</h2>
        {upcoming.length === 0 && past.length === 0 ? (
          <div className="ns-card" style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No assignments yet — check back later.
          </div>
        ) : upcoming.length === 0 ? (
          <div className="ns-card" style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13 }}>All assignments are past due.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(a => (
              <div key={a.id} className="ns-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', margin: '0 0 2px' }}>{a.title}</p>
                    {a.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px' }}>{a.description}</p>}
                    <span style={S.subjectBadge}>{a.subject}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>Due</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{formatDate(a.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Past assignments */}
      {past.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ ...S.sectionLabel, color: 'var(--text-muted)' }}>Past Due</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(a => (
              <div key={a.id} className="ns-card" style={{ padding: '12px 18px', opacity: 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', margin: '0 0 2px', textDecoration: 'line-through' }}>{a.title}</p>
                    <span style={S.subjectBadge}>{a.subject}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, flexShrink: 0 }}>Due {formatDate(a.dueDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section>
        <h2 style={S.sectionLabel}>Classmates</h2>
        <div className="ns-card" style={{ padding: '6px 0' }}>
          {classroom.memberships.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < classroom.memberships.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                {(m.student.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, color: 'var(--text)' }}>{m.student.name ?? 'Student'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:         { padding: '24px 28px', maxWidth: 720, margin: '0 auto' },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: 12 },
  pill:         { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: 'var(--text-muted)' },
  subjectBadge: { display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginTop: 4 },
}
