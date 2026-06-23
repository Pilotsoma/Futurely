'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, QuestionSet, QuestionSetWithQuestions, QuestionInput } from '../../../lib/api'

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Spanish', 'French', 'Biology', 'Chemistry', 'Physics', 'Computer Science', 'Economics', 'Psychology', 'Other']

type Tab = 'browse' | 'mine' | 'create'

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

// ── Inline question editor ───────────────────────────────────────────────────
interface QDraft {
  questionText: string
  questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  options: string[]
  correctAnswer: string
  timeLimit: number
}

function blankQ(): QDraft {
  return { questionText: '', questionType: 'MULTIPLE_CHOICE', options: ['', '', '', ''], correctAnswer: '0', timeLimit: 20 }
}

function QuestionEditor({ q, index, onChange, onDelete }: { q: QDraft; index: number; onChange: (q: QDraft) => void; onDelete: () => void }) {
  const isTF = q.questionType === 'TRUE_FALSE'
  return (
    <div className="ns-card" style={{ padding: '16px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 20, padding: '2px 10px' }}>Q{index + 1}</span>
        <select value={q.questionType} onChange={e => {
          const t = e.target.value as 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
          onChange({ ...q, questionType: t, options: t === 'TRUE_FALSE' ? ['True', 'False'] : ['', '', '', ''], correctAnswer: t === 'TRUE_FALSE' ? '0' : '0' })
        }} style={S.select}>
          <option value="MULTIPLE_CHOICE">Multiple Choice</option>
          <option value="TRUE_FALSE">True / False</option>
        </select>
        <select value={q.timeLimit} onChange={e => onChange({ ...q, timeLimit: Number(e.target.value) })} style={{ ...S.select, width: 100 }}>
          {[5,10,15,20,30,45,60,90,120].map(t => <option key={t} value={t}>{t}s</option>)}
        </select>
        <button onClick={onDelete} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
      </div>
      <input
        value={q.questionText}
        onChange={e => onChange({ ...q, questionText: e.target.value })}
        placeholder="Question text…"
        maxLength={500}
        style={{ ...S.input, marginBottom: 10, fontSize: 14 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(isTF ? ['True', 'False'] : q.options).map((opt, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => onChange({ ...q, correctAnswer: String(i) })}
              title="Mark as correct"
              style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: `2px solid ${q.correctAnswer === String(i) ? 'var(--primary)' : 'var(--border)'}`, background: q.correctAnswer === String(i) ? 'var(--primary)' : 'transparent', transition: 'all 0.15s' }}
            />
            {isTF ? (
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt}</span>
            ) : (
              <input
                value={opt}
                onChange={e => { const opts = [...q.options]; opts[i] = e.target.value; onChange({ ...q, options: opts }) }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                maxLength={200}
                style={{ ...S.input, flex: 1 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Set card ────────────────────────────────────────────────────────────────
function SetCard({ set, isOwner, onDelete, onHost }: { set: QuestionSet; isOwner: boolean; onDelete?: () => void; onHost?: () => void }) {
  const router = useRouter()
  return (
    <div className="ns-card" style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => router.push(`/sets/${set.id}`)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{set.title}</span>
            {set.visibility === 'PUBLIC'
              ? <span style={{ ...S.badge, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>Public</span>
              : <span style={{ ...S.badge, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Private</span>
            }
          </div>
          {set.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.description}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {set.subject && <span style={S.chip}>{set.subject}</span>}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{set._count?.questions ?? 0} questions</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {set.creator.name ?? 'User'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(set.updatedAt)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {onHost && (
            <button onClick={onHost} style={{ ...S.iconBtn, background: 'var(--primary)', color: '#fff', border: 'none' }} title="Host game">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          )}
          {isOwner && onDelete && (
            <button onClick={onDelete} style={{ ...S.iconBtn, color: 'var(--error)' }} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SetsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('browse')

  // Browse state
  const [sets, setSets]         = useState<QuestionSet[]>([])
  const [query, setQuery]       = useState('')
  const [subject, setSubject]   = useState('')
  const [loading, setLoading]   = useState(true)

  // Create state
  const [title, setTitle]           = useState('')
  const [desc, setDesc]             = useState('')
  const [subjectNew, setSubjectNew] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE')
  const [questions, setQuestions]   = useState<QDraft[]>([blankQ()])
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const [hostingSet, setHostingSet] = useState<number | null>(null)
  const [hostError, setHostError]   = useState<string | null>(null)

  useEffect(() => {
    void loadSets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function loadSets() {
    setLoading(true)
    try {
      const data = await api.sets(tab === 'mine' ? { mine: true, q: query, subject } : { q: query, subject })
      setSets(data ?? [])
    } catch { setSets([]) }
    finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!title.trim()) { setSaveError('Title is required'); return }
    const validQ = questions.filter(q => q.questionText.trim())
    if (validQ.length === 0) { setSaveError('Add at least one question'); return }
    for (const q of validQ) {
      if (q.questionType === 'MULTIPLE_CHOICE' && q.options.some(o => !o.trim())) { setSaveError('Fill in all answer options'); return }
    }
    setSaving(true); setSaveError(null)
    try {
      const payload: Parameters<typeof api.createSet>[0] = {
        title: title.trim(),
        description: desc.trim() || null,
        subject: subjectNew || null,
        visibility,
        questions: validQ.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.questionType === 'TRUE_FALSE' ? ['True', 'False'] : q.options.map(o => o.trim()),
          correctAnswer: q.correctAnswer,
          timeLimit: q.timeLimit,
        }) satisfies QuestionInput),
      }
      const created = await api.createSet(payload) as QuestionSetWithQuestions
      router.push(`/sets/${created.id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this set?')) return
    try {
      await api.deleteSet(id)
      setSets(prev => prev.filter(s => s.id !== id))
    } catch { /* ignore */ }
  }

  async function handleHost(setId: number) {
    setHostingSet(setId); setHostError(null)
    try {
      const session = await api.createGame(setId)
      router.push(`/play/${session.joinCode}`)
    } catch (e) {
      setHostError(e instanceof Error ? e.message : 'Failed to host game')
      setHostingSet(null)
    }
  }

  const myId = (() => { try { const u = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { id?: number } | null; return u?.id ?? null } catch { return null } })()

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Study Sets</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>Create question sets and host live review games</p>
        </div>
        <Link href="/play" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 20, background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Play / Host
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['browse', 'mine', 'create'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${t === tab ? 'var(--primary)' : 'var(--border)'}`, background: t === tab ? 'var(--primary)' : 'var(--surface-2)', color: t === tab ? '#fff' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
            {t === 'browse' ? 'Browse' : t === 'mine' ? 'My Sets' : '+ Create'}
          </button>
        ))}
      </div>

      {/* ── Browse / Mine ─────────────────────────────────────────── */}
      {tab !== 'create' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && void loadSets()} placeholder="Search sets…" style={{ ...S.input, flex: 1, minWidth: 180, maxWidth: 340 }} />
            <select value={subject} onChange={e => { setSubject(e.target.value); void loadSets() }} style={{ ...S.select, minWidth: 140 }}>
              <option value="">All subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => void loadSets()} style={{ padding: '8px 18px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Search</button>
          </div>
          {hostError && <p style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>{hostError}</p>}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 12 }} />)}
            </div>
          ) : sets.length === 0 ? (
            <div className="ns-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {tab === 'mine' ? "You haven't created any sets yet. Click ‘Create’ to get started." : 'No public sets found. Try a different search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sets.map(set => (
                <SetCard
                  key={set.id}
                  set={set}
                  isOwner={set.creatorId === myId}
                  onDelete={set.creatorId === myId ? () => void handleDelete(set.id) : undefined}
                  onHost={hostingSet === set.id ? undefined : () => void handleHost(set.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Create ────────────────────────────────────────────────── */}
      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680 }}>
          <div className="ns-card" style={{ padding: '18px 20px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>Set Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Set title (required)" maxLength={120} style={S.input} />
              <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" maxLength={400} style={S.input} />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={subjectNew} onChange={e => setSubjectNew(e.target.value)} style={{ ...S.select, flex: 1 }}>
                  <option value="">No subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={visibility} onChange={e => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')} style={{ ...S.select, flex: 1 }}>
                  <option value="PRIVATE">Private (only you)</option>
                  <option value="PUBLIC">Public (everyone)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Questions ({questions.length})</h2>
            <button onClick={() => setQuestions(prev => [...prev, blankQ()])} disabled={questions.length >= 50} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Question</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {questions.map((q, i) => (
              <QuestionEditor
                key={i}
                q={q}
                index={i}
                onChange={updated => setQuestions(prev => prev.map((x, j) => j === i ? updated : x))}
                onDelete={() => setQuestions(prev => prev.filter((_, j) => j !== i))}
              />
            ))}
          </div>

          {saveError && <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{saveError}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => void handleCreate()} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, background: saving ? 'var(--surface-2)' : 'var(--primary)', color: saving ? 'var(--text-muted)' : '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Set'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:    { padding: '24px 28px', maxWidth: 800, margin: '0 auto' },
  input:   { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  select:  { padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' },
  badge:   { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  chip:    { display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)' },
  iconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer' },
}
