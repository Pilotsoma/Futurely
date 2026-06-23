'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, GameSession, GameParticipant } from '../../../../lib/api'
import { getApiToken } from '../../../../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────
interface LiveQuestion {
  id: number
  questionText: string
  questionType: string
  options: string[]
  timeLimit: number
}

interface GameResults {
  questionId: number
  correctAnswer: string
  leaderboard: Array<{ rank: number; userId: number; name: string | null; score: number }>
}

interface FinalLeaderboard {
  rank: number; userId: number; name: string | null; score: number
  tag?: string | null; tagColor?: string | null; nameColor?: string | null
}

type Phase = 'lobby' | 'question' | 'results' | 'finished'

const OPTION_COLORS = ['#3b82f6','#ef4444','#22c55e','#f59e0b']
const OPTION_LABELS = ['A','B','C','D']

// ── Answer option button ─────────────────────────────────────────────────────
function OptionBtn({ label, text, color, selected, correct, revealed, onClick }: { label: string; text: string; color: string; selected: boolean; correct: boolean; revealed: boolean; onClick: () => void }) {
  let bg = color
  let border = color
  let opacity = 1
  if (revealed) {
    bg = correct ? '#22c55e' : selected ? '#ef4444' : 'var(--surface-2)'
    border = correct ? '#22c55e' : selected ? '#ef4444' : 'var(--border)'
    opacity = correct || selected ? 1 : 0.45
  } else if (selected) {
    bg = color; border = color
  } else {
    bg = 'var(--surface-2)'; border = 'var(--border)'
  }
  return (
    <button
      onClick={onClick}
      disabled={revealed || selected}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14, border: `2px solid ${border}`, background: bg, cursor: revealed || selected ? 'default' : 'pointer', opacity, transition: 'all 0.2s', textAlign: 'left', width: '100%' }}
    >
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: revealed ? 'rgba(255,255,255,0.2)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: revealed ? '#fff' : selected ? '#fff' : 'var(--text)', flex: 1 }}>{text}</span>
      {revealed && correct && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
      {revealed && selected && !correct && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
    </button>
  )
}

// ── Leaderboard row ──────────────────────────────────────────────────────────
function LbRow({ entry, myId }: { entry: { rank: number; userId: number; name: string | null; score: number; nameColor?: string | null }; myId: number | null }) {
  const isMe = entry.userId === myId
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: isMe ? 'var(--primary-dim)' : 'transparent', borderRadius: 10, border: isMe ? '1px solid var(--primary-glow)' : '1px solid transparent' }}>
      <span style={{ width: 28, fontWeight: 800, fontSize: 16, color: entry.rank <= 3 ? ['#fbbf24','#94a3b8','#cd7f32'][entry.rank-1] : 'var(--text-muted)', textAlign: 'center', flexShrink: 0 }}>
        {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank-1] : `#${entry.rank}`}
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: isMe ? 700 : 500, color: entry.nameColor ?? 'var(--text)' }}>{entry.name ?? 'Player'}{isMe ? ' (you)' : ''}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{entry.score.toLocaleString()}</span>
    </div>
  )
}

// ── Main game room ───────────────────────────────────────────────────────────
export default function GameRoomPage() {
  const params = useParams()
  const router = useRouter()
  const code   = (params.code as string).toUpperCase()

  const [session, setSession]     = useState<GameSession | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [phase, setPhase]         = useState<Phase>('lobby')

  // Live question state
  const [liveQ, setLiveQ]                 = useState<LiveQuestion | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQ]       = useState(0)
  const [selectedAnswer, setSelected]     = useState<string | null>(null)
  const [answerResult, setAnswerResult]   = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null)
  const [answerCount, setAnswerCount]     = useState(0)
  const [timer, setTimer]                 = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qStartRef = useRef<number>(0)

  // Results
  const [results, setResults]       = useState<GameResults | null>(null)
  const [finalBoard, setFinalBoard] = useState<FinalLeaderboard[]>([])

  // Host controls
  const [advancing, setAdvancing] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const myId = (() => { try { const u = JSON.parse(localStorage.getItem('ns_user') ?? 'null') as { id?: number } | null; return u?.id ?? null } catch { return null } })()

  const isHost = session?.hostId === myId

  // Refs so interval callback always reads current values without needing deps
  const phaseRef    = useRef<Phase>('lobby')
  const qIndexRef   = useRef(0)
  phaseRef.current  = phase
  qIndexRef.current = questionIndex

  // ── Load initial session ─────────────────────────────────────────────────
  useEffect(() => {
    api.getGame(code)
      .then(s => {
        setSession(s)
        if (s.status === 'ACTIVE') {
          const q = s.set.questions[s.currentQuestion]
          if (q) { setLiveQ(q as LiveQuestion); setPhase('question'); setQuestionIndex(s.currentQuestion); setTotalQ(s.set.questions.length); startTimer(q.timeLimit) }
        } else if (s.status === 'FINISHED') {
          setPhase('finished')
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Game not found'))
      .finally(() => setLoading(false))
  }, [code])

  // ── Universal polling fallback — covers all phases, 3 s cadence ──────────
  // WS drives instant updates; this catches anything WS drops (auth race,
  // reconnects, missed events). Stops only when the game is finished.
  useEffect(() => {
    const interval = setInterval(() => {
      const curPhase  = phaseRef.current
      const curQIndex = qIndexRef.current
      if (curPhase === 'finished') return

      api.getGame(code).then(s => {
        // Always keep participant list fresh
        setSession(prev => prev ? { ...prev, participants: s.participants } : prev)

        // Lobby → detect game start
        if (curPhase === 'lobby' && s.status === 'ACTIVE') {
          const q = s.set.questions[s.currentQuestion]
          if (!q) return
          setLiveQ(q as LiveQuestion)
          setPhase('question')
          setQuestionIndex(s.currentQuestion)
          setTotalQ(s.set.questions.length)
          setSelected(null); setAnswerResult(null); setAnswerCount(0); setShowResults(false)
          startTimer(q.timeLimit)
          return
        }

        // Question / results → detect host advancing to next question
        if ((curPhase === 'question' || curPhase === 'results') && s.status === 'ACTIVE' && s.currentQuestion > curQIndex) {
          const q = s.set.questions[s.currentQuestion]
          if (!q) return
          setLiveQ(q as LiveQuestion)
          setPhase('question')
          setQuestionIndex(s.currentQuestion)
          setSelected(null); setAnswerResult(null); setAnswerCount(0); setResults(null); setShowResults(false)
          startTimer(q.timeLimit)
          return
        }

        // Any active phase → detect game ended
        if (s.status === 'FINISHED') {
          const board = [...s.participants]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => ({ rank: i + 1, userId: p.userId, name: p.user.name, score: p.score, tag: p.user.tag, tagColor: p.user.tagColor, nameColor: p.user.nameColor }))
          setFinalBoard(board)
          setPhase('finished')
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }).catch(() => {})
    }, 3000)

    return () => clearInterval(interval)
  }, [code])

  // ── Timer ────────────────────────────────────────────────────────────────
  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimer(seconds)
    qStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // ── WebSocket ────────────────────────────────────────────────────────────
  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as { event: string; data: unknown }

      if (msg.event === 'GAME_PLAYER_JOINED') {
        const d = msg.data as { sessionId: number; participants: GameParticipant[] }
        setSession(prev => prev ? { ...prev, participants: d.participants } : prev)
      }

      if (msg.event === 'GAME_STARTED') {
        const d = msg.data as { questionIndex: number; totalQuestions: number; question: LiveQuestion }
        setLiveQ(d.question); setPhase('question'); setQuestionIndex(d.questionIndex); setTotalQ(d.totalQuestions)
        setSelected(null); setAnswerResult(null); setAnswerCount(0); setShowResults(false)
        startTimer(d.question.timeLimit)
      }

      if (msg.event === 'GAME_ANSWER_RECEIVED') {
        const d = msg.data as { answerCount: number; totalPlayers: number }
        setAnswerCount(d.answerCount)
      }

      if (msg.event === 'GAME_RESULTS') {
        const d = msg.data as GameResults
        setResults(d); setPhase('results'); setShowResults(true)
        if (timerRef.current) clearInterval(timerRef.current)
      }

      if (msg.event === 'GAME_QUESTION') {
        const d = msg.data as { questionIndex: number; totalQuestions: number; question: LiveQuestion }
        setLiveQ(d.question); setPhase('question'); setQuestionIndex(d.questionIndex); setTotalQ(d.totalQuestions)
        setSelected(null); setAnswerResult(null); setAnswerCount(0); setResults(null); setShowResults(false)
        startTimer(d.question.timeLimit)
      }

      if (msg.event === 'GAME_ENDED') {
        const d = msg.data as { leaderboard: FinalLeaderboard[] }
        setFinalBoard(d.leaderboard); setPhase('finished')
        if (timerRef.current) clearInterval(timerRef.current)
      }
    } catch { /* ignore malformed */ }
  }, [])

  useEffect(() => {
    const token = getApiToken()
    if (!token) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const wsBase = (process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, 'ws'))
    let ws: WebSocket, dead = false
    function connect() {
      if (dead) return
      ws = new WebSocket(wsBase)
      ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token }))
      ws.onmessage = handleWsMessage
      ws.onclose = () => { if (!dead) setTimeout(connect, 3000) }
    }
    connect()
    return () => { dead = true; ws?.close() }
  }, [handleWsMessage])

  // ── Player: submit answer ───────────────────────────────────────────────
  async function handleAnswer(answer: string) {
    if (!liveQ || selectedAnswer !== null) return
    setSelected(answer)
    const timeMs = Date.now() - qStartRef.current
    try {
      const res = await api.submitAnswer(code, { questionId: liveQ.id, answer, timeMs })
      setAnswerResult(res)
    } catch { /* ignore */ }
  }

  // ── Host: reveal results ────────────────────────────────────────────────
  async function handleReveal() {
    setRevealing(true)
    try { await api.revealResults(code) } catch { /* ignore */ }
    finally { setRevealing(false) }
  }

  // ── Host: next question / end ───────────────────────────────────────────
  async function handleNext() {
    setAdvancing(true)
    try { await api.nextQuestion(code) } catch { /* ignore */ }
    finally { setAdvancing(false) }
  }

  // ── Host: start game ────────────────────────────────────────────────────
  async function handleStart() {
    setAdvancing(true)
    try { await api.startGame(code) } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start')
    }
    setAdvancing(false)
  }

  // ── Loading / error ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
      <div className="shimmer" style={{ width: 80, height: 80, borderRadius: 16 }} />
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading game…</p>
    </div>
  )

  if (error || !session) return (
    <div style={{ padding: '40px 28px', textAlign: 'center' }}>
      <p style={{ color: 'var(--error)', fontSize: 14, marginBottom: 12 }}>{error ?? 'Game not found'}</p>
      <Link href="/play" style={{ color: 'var(--primary)', fontSize: 13 }}>← Back to Play</Link>
    </div>
  )

  // ── LOBBY ───────────────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div style={{ padding: '32px 28px', maxWidth: 560, margin: '0 auto' }}>
      <Link href="/play" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </Link>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Game Code</p>
        <div style={{ fontSize: 52, fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginBottom: 4 }}>{code}</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{session.set.title}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{session.set.questions.length} questions · hosted by {session.host.name ?? 'Host'}</p>
      </div>

      {/* Players in lobby */}
      <div className="ns-card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          Players Joined ({session.participants.length})
        </p>
        {session.participants.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Waiting for players to join…</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {session.participants.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: p.userId === myId ? 'var(--primary-dim)' : 'var(--surface-2)', border: `1px solid ${p.userId === myId ? 'var(--primary-glow)' : 'var(--border)'}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: p.user.nameColor ?? 'var(--text)' }}>{p.user.name ?? 'Player'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isHost ? (
        <button onClick={() => void handleStart()} disabled={advancing || session.participants.length === 0} style={{ width: '100%', padding: '14px', borderRadius: 14, background: session.participants.length > 0 && !advancing ? 'var(--primary)' : 'var(--surface-2)', color: session.participants.length > 0 && !advancing ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: 16, fontWeight: 800, cursor: session.participants.length > 0 && !advancing ? 'pointer' : 'not-allowed' }}>
          {advancing ? 'Starting…' : session.participants.length === 0 ? 'Waiting for players…' : `Start Game (${session.participants.length} player${session.participants.length !== 1 ? 's' : ''})`}
        </button>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Waiting for host to start the game…</p>
        </div>
      )}
    </div>
  )

  // ── QUESTION ────────────────────────────────────────────────────────────
  if (phase === 'question' && liveQ) {
    const opts = Array.isArray(liveQ.options) ? liveQ.options as string[] : []
    return (
      <div style={{ padding: '24px 28px', maxWidth: 680, margin: '0 auto' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((questionIndex + 1) / totalQuestions) * 100}%`, background: 'var(--primary)', transition: 'width 0.3s', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{questionIndex + 1}/{totalQuestions}</span>
          {/* Timer */}
          <div style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${timer <= 5 ? '#ef4444' : timer <= 10 ? '#f59e0b' : 'var(--primary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: timer <= 5 ? '#ef4444' : timer <= 10 ? '#f59e0b' : 'var(--primary)', transition: 'color 0.3s, border-color 0.3s', flexShrink: 0 }}>
            {timer}
          </div>
        </div>

        {/* Question */}
        <div className="ns-card" style={{ padding: '24px 22px', marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.4 }}>{liveQ.questionText}</p>
        </div>

        {/* Answer options */}
        <div style={{ display: 'grid', gridTemplateColumns: opts.length === 2 ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
          {opts.map((opt, i) => (
            <OptionBtn
              key={i}
              label={OPTION_LABELS[i] ?? String(i)}
              text={opt}
              color={OPTION_COLORS[i] ?? '#888'}
              selected={selectedAnswer === String(i)}
              correct={false}
              revealed={false}
              onClick={() => void handleAnswer(String(i))}
            />
          ))}
        </div>

        {/* After answering */}
        {selectedAnswer !== null && answerResult && (
          <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 12, background: answerResult.isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${answerResult.isCorrect ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: answerResult.isCorrect ? '#22c55e' : '#ef4444', margin: '0 0 2px' }}>{answerResult.isCorrect ? '✓ Correct!' : '✗ Wrong'}</p>
            {answerResult.isCorrect && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>+{answerResult.pointsEarned.toLocaleString()} pts</p>}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Waiting for host to reveal results…</p>
          </div>
        )}

        {selectedAnswer !== null && !answerResult && (
          <div style={{ marginTop: 16, padding: '12px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Answer submitted — waiting for results…</p>
          </div>
        )}

        {/* Host controls */}
        {isHost && (
          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {answerCount} / {session.participants.length} answered
            </div>
            <button onClick={() => void handleReveal()} disabled={revealing} style={{ padding: '11px 20px', borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: revealing ? 'not-allowed' : 'pointer' }}>
              {revealing ? '…' : 'Show Results'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────
  if (phase === 'results' && results && liveQ) {
    const opts = Array.isArray(liveQ.options) ? liveQ.options as string[] : []
    return (
      <div style={{ padding: '24px 28px', maxWidth: 560, margin: '0 auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>Question {questionIndex + 1} Results</p>

        <div className="ns-card" style={{ padding: '18px 20px', marginBottom: 14, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>{liveQ.questionText}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {opts.map((opt, i) => (
              <OptionBtn
                key={i}
                label={OPTION_LABELS[i] ?? String(i)}
                text={opt}
                color={OPTION_COLORS[i] ?? '#888'}
                selected={selectedAnswer === String(i)}
                correct={results.correctAnswer === String(i)}
                revealed={true}
                onClick={() => {}}
              />
            ))}
          </div>
        </div>

        <div className="ns-card" style={{ padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>Leaderboard</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.leaderboard.slice(0, 5).map(entry => <LbRow key={entry.userId} entry={entry} myId={myId} />)}
          </div>
        </div>

        {isHost && (
          <button onClick={() => void handleNext()} disabled={advancing} style={{ width: '100%', padding: '13px', borderRadius: 14, background: advancing ? 'var(--surface-2)' : 'var(--primary)', color: advancing ? 'var(--text-muted)' : '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: advancing ? 'not-allowed' : 'pointer' }}>
            {advancing ? '…' : questionIndex + 1 >= totalQuestions ? 'End Game' : 'Next Question →'}
          </button>
        )}

        {!isHost && (
          <div style={{ textAlign: 'center', padding: '14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Waiting for host to advance…</p>
          </div>
        )}
      </div>
    )
  }

  // ── FINISHED ────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const board = finalBoard.length > 0 ? finalBoard : session.participants.sort((a,b) => b.score - a.score).map((p,i) => ({ rank: i+1, userId: p.userId, name: p.user.name, score: p.score, nameColor: p.user.nameColor, tag: p.user.tag, tagColor: p.user.tagColor }))
    const myEntry = board.find(e => e.userId === myId)
    return (
      <div style={{ padding: '32px 28px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px' }}>Game Over!</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>{session.set.title}</p>

        {myEntry && (
          <div style={{ padding: '16px', borderRadius: 16, background: 'var(--primary-dim)', border: '1px solid var(--primary-glow)', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Your Result</p>
            <p style={{ fontSize: 30, fontWeight: 900, color: 'var(--primary)', margin: '0 0 2px' }}>{myEntry.score.toLocaleString()} pts</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Rank #{myEntry.rank} of {board.length}</p>
          </div>
        )}

        <div className="ns-card" style={{ padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>Final Leaderboard</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {board.map(entry => <LbRow key={entry.userId} entry={entry} myId={myId} />)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link href="/play" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 20, background: 'var(--primary)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Play Again</Link>
          <Link href="/sets" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>My Sets</Link>
        </div>
      </div>
    )
  }

  return null
}
