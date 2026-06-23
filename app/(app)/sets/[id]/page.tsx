'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, QuestionSetWithQuestions, Question, QuestionInput } from '../../../../lib/api'

const SUBJECTS = ['Math', 'Science', 'English', 'History', 'Spanish', 'French', 'Biology', 'Chemistry', 'Physics', 'Computer Science', 'Economics', 'Psychology', 'Other']

type Mode = 'view' | 'edit'

function QuestionRow({ q, index, isOwner, onEdit, onDelete }: { q: Question; index: number; isOwner: boolean; onEdit: () => void; onDelete: () => void }) {
  const opts = Array.isArray(q.options) ? (q.options as string[]) : []
  return (
    <div className="ns-card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 20, padding: '2px 10px', flexShrink: 0 }}>Q{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>{q.questionText}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {opts.map((opt, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: q.correctAnswer === String(i) ? 'var(--primary)' : 'var(--surface-2)', color: q.correctAnswer === String(i) ? '#fff' : 'var(--text-muted)', border: `1.5px solid ${q.correctAnswer === String(i) ? 'var(--primary)' : 'var(--border)'}` }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 13, color: q.correctAnswer === String(i) ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: q.correctAnswer === String(i) ? 700 : 400 }}>{opt}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.questionType === 'TRUE_FALSE' ? 'True/False' : 'Multiple Choice'} · {q.timeLimit}s</span>
          </div>
        </div>
        {isOwner && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} style={S.iconBtn} title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onClick={onDelete} style={{ ...S.iconBtn, color: 'var(--error)' }} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [set, setSet]       = useState<QuestionSetWithQuestions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [mode, setMode]     = useState<Mode>('view')

  // Edit set meta
  const [editTitle, setEditTitle]     = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editVis, setEditVis]         = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE')
  const [saving, setSaving]           = useState(false)

  // Add question inline
  const [addingQ, setAddingQ]   = useState(false)
  const [newQ, setNewQ]         = useState<{ questionText: string; questionType: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'; options: string[]; correctAnswer: string; timeLimit: number }>({ questionText: '', questionType: 'MULTIPLE_CHOICE', options: ['','','',''], correctAnswer: '0', timeLimit: 20 })
  const [addError, setAddError] = useState<string | null>(null)

  // Edit existing question
  const [editingQId, setEditingQId] = useState<number | null>(null)
  const [editQ, setEditQ] = useState<{ questionText: string; options: string[]; correctAnswer: string; timeLimit: number } | null>(null)

  // Host game
  const [hosting, setHosting]   = useState(false)
  const [hostError, setHostError] = useState<string | null>(null)

  const myId = (() => { try { const u = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { id?: number } | null; return u?.id ?? null } catch { return null } })()

  useEffect(() => {
    if (isNaN(id)) { router.replace('/sets'); return }
    api.getSet(id)
      .then(data => {
        setSet(data)
        setEditTitle(data.title)
        setEditDesc(data.description ?? '')
        setEditSubject(data.subject ?? '')
        setEditVis(data.visibility as 'PUBLIC' | 'PRIVATE')
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [id, router])

  const isOwner = set?.creatorId === myId

  async function handleSaveMeta() {
    if (!set) return
    setSaving(true)
    try {
      const updated = await api.updateSet(id, { title: editTitle, description: editDesc || null, subject: editSubject || null, visibility: editVis })
      setSet(updated)
      setMode('view')
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  async function handleAddQuestion() {
    if (!newQ.questionText.trim()) { setAddError('Question text required'); return }
    if (newQ.questionType === 'MULTIPLE_CHOICE' && newQ.options.some(o => !o.trim())) { setAddError('Fill in all options'); return }
    setAddError(null)
    try {
      const q = await api.addQuestion(id, {
        ...newQ,
        options: newQ.questionType === 'TRUE_FALSE' ? ['True','False'] : newQ.options,
      } satisfies QuestionInput)
      setSet(prev => prev ? { ...prev, questions: [...prev.questions, q] } : prev)
      setNewQ({ questionText: '', questionType: 'MULTIPLE_CHOICE', options: ['','','',''], correctAnswer: '0', timeLimit: 20 })
      setAddingQ(false)
    } catch (e) { setAddError(e instanceof Error ? e.message : 'Failed') }
  }

  async function handleDeleteQuestion(qid: number) {
    try {
      await api.deleteQuestion(id, qid)
      setSet(prev => prev ? { ...prev, questions: prev.questions.filter(q => q.id !== qid) } : prev)
    } catch { /* ignore */ }
  }

  async function handleSaveQuestion() {
    if (!editingQId || !editQ) return
    try {
      const updated = await api.updateQuestion(id, editingQId, editQ)
      setSet(prev => prev ? { ...prev, questions: prev.questions.map(q => q.id === editingQId ? updated : q) } : prev)
      setEditingQId(null); setEditQ(null)
    } catch { /* ignore */ }
  }

  async function handleHost() {
    setHosting(true); setHostError(null)
    try {
      const session = await api.createGame(id)
      router.push(`/play/${session.joinCode}`)
    } catch (e) {
      setHostError(e instanceof Error ? e.message : 'Failed')
      setHosting(false)
    }
  }

  if (loading) return <div style={S.page}>{[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 72, borderRadius: 12, marginBottom: 10 }} />)}</div>
  if (error || !set) return <div style={S.page}><p style={{ color: 'var(--error)' }}>{error ?? 'Set not found'}</p><Link href="/sets" style={{ color: 'var(--primary)', fontSize: 13 }}>← Back</Link></div>

  return (
    <div style={S.page}>
      <Link href="/sets" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Study Sets
      </Link>

      {/* Header */}
      {mode === 'view' ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>{set.title}</h1>
              {set.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{set.description}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {set.subject && <span style={S.chip}>{set.subject}</span>}
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{set.questions.length} questions</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>by {set.creator.name ?? 'User'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: set.visibility === 'PUBLIC' ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)', color: set.visibility === 'PUBLIC' ? '#22c55e' : 'var(--text-muted)', border: `1px solid ${set.visibility === 'PUBLIC' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}` }}>{set.visibility}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => void handleHost()} disabled={hosting || set.questions.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 20, background: set.questions.length > 0 ? 'var(--primary)' : 'var(--surface-2)', color: set.questions.length > 0 ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: 13, fontWeight: 700, cursor: set.questions.length > 0 ? 'pointer' : 'not-allowed' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {hosting ? 'Starting…' : 'Host Game'}
              </button>
              {isOwner && <button onClick={() => setMode('edit')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit</button>}
            </div>
          </div>
          {hostError && <p style={{ fontSize: 12, color: 'var(--error)', marginTop: 8 }}>{hostError}</p>}
        </div>
      ) : (
        <div className="ns-card" style={{ padding: '18px 20px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Edit Set</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" style={S.input} />
            <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" style={S.input} />
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={editSubject} onChange={e => setEditSubject(e.target.value)} style={{ ...S.select, flex: 1 }}>
                <option value="">No subject</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={editVis} onChange={e => setEditVis(e.target.value as 'PUBLIC' | 'PRIVATE')} style={{ ...S.select, flex: 1 }}>
                <option value="PRIVATE">Private</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => void handleSaveMeta()} disabled={saving} style={{ padding: '8px 20px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setMode('view')} style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', margin: 0 }}>Questions ({set.questions.length})</h2>
        {isOwner && !addingQ && <button onClick={() => setAddingQ(true)} disabled={set.questions.length >= 50} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {set.questions.map((q, i) =>
          editingQId === q.id && editQ ? (
            <div key={q.id} className="ns-card" style={{ padding: '16px 18px' }}>
              <input value={editQ.questionText} onChange={e => setEditQ(prev => prev ? { ...prev, questionText: e.target.value } : prev)} style={{ ...S.input, marginBottom: 10 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {editQ.options.map((opt, oi) => (
                  <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={() => setEditQ(prev => prev ? { ...prev, correctAnswer: String(oi) } : prev)} style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', border: `2px solid ${editQ.correctAnswer === String(oi) ? 'var(--primary)' : 'var(--border)'}`, background: editQ.correctAnswer === String(oi) ? 'var(--primary)' : 'transparent', flexShrink: 0 }} />
                    <input value={opt} onChange={e => { const o = [...editQ.options]; o[oi] = e.target.value; setEditQ(prev => prev ? { ...prev, options: o } : prev) }} style={{ ...S.input, flex: 1 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => void handleSaveQuestion()} style={{ padding: '7px 18px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                <button onClick={() => { setEditingQId(null); setEditQ(null) }} style={{ padding: '7px 14px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <QuestionRow
              key={q.id}
              q={q}
              index={i}
              isOwner={isOwner}
              onEdit={() => { setEditingQId(q.id); setEditQ({ questionText: q.questionText, options: Array.isArray(q.options) ? (q.options as string[]) : [], correctAnswer: q.correctAnswer, timeLimit: q.timeLimit }) }}
              onDelete={() => void handleDeleteQuestion(q.id)}
            />
          )
        )}

        {/* Add question form */}
        {addingQ && isOwner && (
          <div className="ns-card" style={{ padding: '16px 18px', border: '1.5px dashed var(--primary-glow)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>New Question</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <select value={newQ.questionType} onChange={e => {
                const t = e.target.value as 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
                setNewQ(prev => ({ ...prev, questionType: t, options: t === 'TRUE_FALSE' ? ['True','False'] : ['','','',''], correctAnswer: '0' }))
              }} style={S.select}>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="TRUE_FALSE">True / False</option>
              </select>
              <select value={newQ.timeLimit} onChange={e => setNewQ(prev => ({ ...prev, timeLimit: Number(e.target.value) }))} style={{ ...S.select, width: 90 }}>
                {[5,10,15,20,30,45,60,90,120].map(t => <option key={t} value={t}>{t}s</option>)}
              </select>
            </div>
            <input value={newQ.questionText} onChange={e => setNewQ(prev => ({ ...prev, questionText: e.target.value }))} placeholder="Question text…" maxLength={500} style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {(newQ.questionType === 'TRUE_FALSE' ? ['True','False'] : newQ.options).map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setNewQ(prev => ({ ...prev, correctAnswer: String(i) }))} style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', border: `2px solid ${newQ.correctAnswer === String(i) ? 'var(--primary)' : 'var(--border)'}`, background: newQ.correctAnswer === String(i) ? 'var(--primary)' : 'transparent', flexShrink: 0 }} />
                  {newQ.questionType === 'TRUE_FALSE'
                    ? <span style={{ fontSize: 13, color: 'var(--text)' }}>{opt}</span>
                    : <input value={opt} onChange={e => { const o = [...newQ.options]; o[i] = e.target.value; setNewQ(prev => ({ ...prev, options: o })) }} placeholder={`Option ${String.fromCharCode(65+i)}`} style={{ ...S.input, flex: 1 }} />
                  }
                </div>
              ))}
            </div>
            {addError && <p style={{ fontSize: 12, color: 'var(--error)', margin: '0 0 8px' }}>{addError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => void handleAddQuestion()} style={{ padding: '7px 18px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
              <button onClick={() => { setAddingQ(false); setAddError(null) }} style={{ padding: '7px 14px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {set.questions.length === 0 && !addingQ && (
          <div className="ns-card" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {isOwner ? 'No questions yet — click "+ Add" to get started.' : 'This set has no questions yet.'}
          </div>
        )}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:    { padding: '24px 28px', maxWidth: 720, margin: '0 auto' },
  input:   { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  select:  { padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' },
  chip:    { display: 'inline-block', background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: 'var(--primary)' },
  iconBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-secondary)' },
}
