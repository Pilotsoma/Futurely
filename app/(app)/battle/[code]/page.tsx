'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, GameSession, GameParticipant, getApiToken } from '../../../../lib/api'

// ── Constants ────────────────────────────────────────────────────────────────
const WORLD_SIZE    = 2400
const PLAYER_SPEED  = 6
const PLAYER_HEIGHT = 1.8
const EYE_HEIGHT    = 1.6
const GRAVITY       = 0.5
const JUMP_FORCE    = 12
const TERRAIN_SEGS  = 80
const TERRAIN_SEED  = 42
const ZONE_INITIAL  = 1100
const ZONE_FINAL    = 80
const ZONE_DURATION = 180_000 // 3 min to fully close
const POS_HZ        = 20
const DAMAGE_PER_HIT = 25
const START_AMMO    = 10

const PLAYER_COLORS = ['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6','#1abc9c','#e67e22','#ff5252']

// ── Terrain ──────────────────────────────────────────────────────────────────
function terrainH(wx: number, wz: number): number {
  const x = wx / WORLD_SIZE, z = wz / WORLD_SIZE
  return (
    Math.sin(x * 6.2 + TERRAIN_SEED) * Math.cos(z * 5.8) * 28 +
    Math.sin(x * 13 + 1.3) * Math.cos(z * 11 + 0.7) * 14 +
    Math.sin(x * 27 + 2.1) * Math.cos(z * 23 + 1.9) * 6 +
    Math.sin(x * 52) * Math.cos(z * 48 + 0.5) * 2
  )
}

// ── Building seed list ───────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

interface Building { x: number; z: number; w: number; d: number; h: number }
function genBuildings(): Building[] {
  const rng = seededRng(TERRAIN_SEED + 1)
  const list: Building[] = []
  const margin = 200
  for (let i = 0; i < 30; i++) {
    const x = (rng() * (WORLD_SIZE - margin * 2) + margin) - WORLD_SIZE / 2
    const z = (rng() * (WORLD_SIZE - margin * 2) + margin) - WORLD_SIZE / 2
    list.push({ x, z, w: rng() * 40 + 15, d: rng() * 40 + 15, h: rng() * 20 + 8 })
  }
  return list
}
const BUILDINGS = genBuildings()

// ── Types ────────────────────────────────────────────────────────────────────
interface RemotePlayer {
  userId: number; name: string; color: string
  x: number; y: number; z: number; rotY: number
  hp: number; alive: boolean
}

interface KillEntry { killer: string; victim: string; ts: number }

interface Question {
  questionId: number; questionText: string
  options: { A: string; B: string; C: string; D: string } | string[]
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BattlePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const [session, setSession] = useState<GameSession | null>(null)
  const [phase, setPhase] = useState<'lobby' | 'battle' | 'dead' | 'won' | 'ended'>('lobby')
  const [error, setError] = useState('')

  // HUD state
  const [hp, setHp] = useState(100)
  const [ammo, setAmmo] = useState(START_AMMO)
  const [kills, setKills] = useState<KillEntry[]>([])
  const [question, setQuestion] = useState<Question | null>(null)
  const [qFeedback, setQFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [zoneRadius, setZoneRadius] = useState(ZONE_INITIAL)
  const [playersAlive, setPlayersAlive] = useState(0)
  const [winnerName, setWinnerName] = useState('')

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const gameRef     = useRef<GameEngine | null>(null)
  const wsRef       = useRef<WebSocket | null>(null)
  const myUserIdRef = useRef<number>(0)
  const myNameRef   = useRef<string>('You')
  const startTimeRef = useRef<number>(0)
  const ammoRef     = useRef(START_AMMO)
  const hpRef       = useRef(100)

  // keep refs in sync
  useEffect(() => { ammoRef.current = ammo }, [ammo])
  useEffect(() => { hpRef.current = hp }, [hp])

  const phaseRef = useRef<'lobby' | 'battle' | 'dead' | 'won' | 'ended'>('lobby')
  phaseRef.current = phase

  // ── Load session ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return
    api.getGame(code).then(s => {
      setSession(s)
      setPlayersAlive(s.participants.length)
      // If we land on a game already started (e.g. rejoining), go straight to battle
      if (s.status === 'ACTIVE') { startTimeRef.current = Date.now(); setPhase('battle') }
    }).catch(() => setError('Game not found'))
    api.me().then(me => { myUserIdRef.current = me.id; myNameRef.current = me.name ?? 'You' }).catch(() => {})
  }, [code])

  // ── Polling — updates player list in lobby and catches missed GAME_STARTED ─
  useEffect(() => {
    if (!code) return
    const interval = setInterval(() => {
      if (phaseRef.current !== 'lobby') return
      api.getGame(code).then(s => {
        setSession(prev => prev ? { ...prev, participants: s.participants } : s)
        if (s.status === 'ACTIVE') {
          startTimeRef.current = Date.now()
          setPhase('battle')
        }
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [code])

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const handleWsMessage = useCallback((e: MessageEvent) => {
    try {
      const { event, data } = JSON.parse(e.data as string)

      if (event === 'AUTH_OK') {
        wsRef.current?.send(JSON.stringify({ type: 'BATTLE_READY', code }))
      }

      if (event === 'GAME_PLAYER_JOINED') {
        const d = data as { participants: GameParticipant[] }
        setSession(prev => prev ? { ...prev, participants: d.participants } : prev)
      }

      if (event === 'GAME_STARTED') {
        startTimeRef.current = Date.now()
        setPhase('battle')
      }

      if (event === 'BATTLE_POSITION' && gameRef.current) {
        gameRef.current.updateRemotePlayer(data.userId, data.x, data.y, data.z, data.rotY)
      }

      if (event === 'BATTLE_PLAYER_HEALTH' && gameRef.current) {
        gameRef.current.updateRemotePlayerHp(data.userId, data.hp)
        if (data.hp <= 0) setPlayersAlive(p => Math.max(0, p - 1))
      }

      if (event === 'BATTLE_ELIMINATED') {
        const engine = gameRef.current
        const killerName = engine?.getPlayerName(data.eliminatedBy) ?? 'Someone'
        const victimName = engine?.getPlayerName(data.userId) ?? 'Player'
        setKills(k => [...k.slice(-4), { killer: killerName, victim: victimName, ts: Date.now() }])
        if (data.userId === myUserIdRef.current) {
          setPhase('dead')
          gameRef.current?.destroy()
        }
      }

      if (event === 'BATTLE_WIN') {
        const isMe = data.userId === myUserIdRef.current
        setWinnerName(isMe ? myNameRef.current : (gameRef.current?.getPlayerName(data.userId) ?? 'Someone'))
        setPhase(isMe ? 'won' : 'ended')
        gameRef.current?.destroy()
      }

      if (event === 'BATTLE_QUESTION') {
        setQuestion(data)
        setQFeedback(null)
        // Release pointer lock so the cursor reappears for clicking answers
        if (document.pointerLockElement) document.exitPointerLock()
      }

      if (event === 'BATTLE_AMMO') {
        setAmmo(data.ammo)
        setQFeedback(data.correct ? 'correct' : 'wrong')
        if (data.correct) setTimeout(() => { setQuestion(null); setQFeedback(null) }, 800)
        else setTimeout(() => setQFeedback(null), 1200)
      }
    } catch { /* ignore */ }
  }, [code])

  useEffect(() => {
    const token = getApiToken()
    if (!token) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl.replace(/^http/, 'ws')
    let ws: WebSocket, dead = false
    function connect() {
      if (dead) return
      ws = new WebSocket(wsBase)
      wsRef.current = ws
      ws.onopen = () => ws.send(JSON.stringify({ type: 'AUTH', token }))
      ws.onmessage = handleWsMessage
      ws.onclose = () => { if (!dead) setTimeout(connect, 3000) }
    }
    connect()
    return () => { dead = true; ws?.close() }
  }, [handleWsMessage])

  // ── Zone timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'battle') return
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const t = Math.min(1, elapsed / ZONE_DURATION)
      setZoneRadius(ZONE_INITIAL + (ZONE_FINAL - ZONE_INITIAL) * t)
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // ── Start game (host) ─────────────────────────────────────────────────────
  async function handleStart() {
    if (!code) return
    try { await api.startGame(code) } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  // ── Init Three.js after phase → battle ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'battle' || !canvasRef.current) return

    const engine = new GameEngine(
      canvasRef.current,
      myUserIdRef.current,
      myNameRef.current,
      session?.participants ?? [],
      (x, y, z, rotY) => {
        wsRef.current?.send(JSON.stringify({ type: 'BATTLE_POSITION', x, y, z, rotY }))
      },
      (targetId, damage) => {
        wsRef.current?.send(JSON.stringify({ type: 'BATTLE_DAMAGE', targetUserId: targetId, damage }))
      },
      () => {
        // Request question when out of ammo
        wsRef.current?.send(JSON.stringify({ type: 'BATTLE_NEED_AMMO' }))
      },
      (newHp) => setHp(newHp),
      (newAmmo) => setAmmo(newAmmo),
      ammoRef,
      hpRef,
    )
    gameRef.current = engine
    return () => { engine.destroy(); gameRef.current = null }
  }, [phase, session])

  // ── Answer question ──────────────────────────────────────────────────────
  function handleAnswer(answer: string) {
    if (!question || qFeedback) return
    wsRef.current?.send(JSON.stringify({ type: 'BATTLE_ANSWER', questionId: question.questionId, answer }))
  }

  // A/B/C/D keyboard shortcuts while question panel is open
  useEffect(() => {
    if (!question) return
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = { KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D' }
      const ans = map[e.code]
      if (ans) handleAnswer(ans)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, qFeedback])

  // ── Render ────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#fff', fontSize: 18 }}>
      {error} — <button onClick={() => router.back()} style={{ marginLeft: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, textDecoration: 'underline' }}>Go back</button>
    </div>
  )

  if (phase === 'lobby') return <LobbyScreen session={session} onStart={handleStart} myId={myUserIdRef.current} />

  if (phase === 'dead') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>💀</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Eliminated</div>
        <div style={{ color: '#9ca3af', marginBottom: 24 }}>Better luck next time</div>
        <button onClick={() => router.push('/sets')} style={btn}>Back to Sets</button>
      </div>
    </div>
  )

  if (phase === 'won') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>Victory Royale!</div>
        <div style={{ color: '#9ca3af', marginBottom: 24 }}>You are the last one standing</div>
        <button onClick={() => router.push('/sets')} style={btn}>Back to Sets</button>
      </div>
    </div>
  )

  if (phase === 'ended') return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎮</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Game Over</div>
        <div style={{ color: '#fbbf24', marginBottom: 24 }}>{winnerName} won the match</div>
        <button onClick={() => router.push('/sets')} style={btn}>Back to Sets</button>
      </div>
    </div>
  )

  // Battle HUD
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Crosshair */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.9)', margin: '0 auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.9)' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
          <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.9)' }} />
        </div>
        <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.9)', margin: '0 auto' }} />
      </div>

      {/* Bottom HUD */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 20, alignItems: 'flex-end' }}>
        {/* HP */}
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.1)', minWidth: 120 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>HEALTH</div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${hp}%`, background: hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.2s, background 0.3s' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444' }}>{hp}</div>
        </div>

        {/* Ammo */}
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.1)', minWidth: 100 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>AMMO</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: ammo > 0 ? '#fff' : '#ef4444' }}>
            {ammo} <span style={{ fontSize: 12, color: '#6b7280' }}>/ 30</span>
          </div>
          {ammo === 0 && <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>ANSWER Q FOR AMMO</div>}
        </div>

        {/* Players alive */}
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>ALIVE</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{playersAlive}</div>
        </div>
      </div>

      {/* Zone indicator top-right */}
      <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, marginBottom: 2 }}>ZONE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>⌀ {Math.round(zoneRadius * 2)}m</div>
      </div>

      {/* Kill feed top-left */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {kills.filter(k => Date.now() - k.ts < 5000).map((k, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#fff', fontWeight: 600 }}>
            <span style={{ color: '#fbbf24' }}>{k.killer}</span>
            <span style={{ color: '#6b7280', margin: '0 6px' }}>eliminated</span>
            <span style={{ color: '#ef4444' }}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div style={{ position: 'absolute', bottom: 24, right: 20, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
        WASD · Move &nbsp;|&nbsp; Mouse · Look &nbsp;|&nbsp; Click · Shoot &nbsp;|&nbsp; Q · Question &nbsp;|&nbsp; Click canvas to lock
      </div>

      {/* Question panel */}
      {question && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(16px)', borderRadius: 16, padding: 28, border: '1px solid rgba(99,102,241,0.4)', width: 360, maxWidth: '90vw', zIndex: 100 }}>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 8 }}>⚡ ANSWER FOR +5 AMMO &nbsp;·&nbsp; press A / B / C / D</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16, lineHeight: 1.4 }}>{question.questionText}</div>
          {qFeedback && (
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: qFeedback === 'correct' ? '#22c55e' : '#ef4444', marginBottom: 12 }}>
              {qFeedback === 'correct' ? '✓ Correct! +5 ammo' : '✗ Wrong!'}
            </div>
          )}
          {!qFeedback && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(Array.isArray(question.options)
                ? question.options.map((o, i) => ({ key: ['A','B','C','D'][i] ?? String(i), val: o }))
                : Object.entries(question.options as Record<string,string>).map(([k,v]) => ({ key: k, val: v }))
              ).map(({ key, val }) => (
                <button key={key} onClick={() => handleAnswer(key)}
                  style={{ padding: '10px 8px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ color: '#6366f1', fontWeight: 800, marginRight: 6 }}>{key}.</span>{val}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Lobby Screen ─────────────────────────────────────────────────────────────
function LobbyScreen({ session, onStart, myId }: { session: GameSession | null; onStart: () => void; myId: number }) {
  const isHost = session?.hostId === myId
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{session?.set?.title ?? 'Battle Royale'}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Code: <span style={{ color: '#6366f1', fontWeight: 700 }}>{session?.joinCode}</span></div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 8 }}>PLAYERS ({session?.participants?.length ?? 0})</div>
          {session?.participants?.map((p: GameParticipant) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAYER_COLORS[p.userId % PLAYER_COLORS.length] ?? '#6366f1' }} />
              <span style={{ color: '#fff', fontSize: 13 }}>{p.user?.name ?? 'Player'}</span>
              {p.userId === session.hostId && <span style={{ marginLeft: 'auto', fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>HOST</span>}
            </div>
          ))}
        </div>
        {isHost
          ? <button onClick={onStart} style={{ ...btn, width: '100%' }}>Start Battle</button>
          : <div style={{ color: '#6b7280', fontSize: 13 }}>Waiting for host to start…</div>
        }
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const card: React.CSSProperties = { background: 'rgba(15,15,25,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 40, textAlign: 'center', minWidth: 280 }
const btn: React.CSSProperties = { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }

// ── Game Engine (Three.js) ───────────────────────────────────────────────────
class GameEngine {
  private scene!: import('three').Scene
  private camera!: import('three').PerspectiveCamera
  private renderer!: import('three').WebGLRenderer
  private terrain!: import('three').Mesh
  private playerMeshes = new Map<number, import('three').Group>()
  private playerNames = new Map<number, string>()
  private playerHps = new Map<number, number>()
  private nameLabels = new Map<number, HTMLDivElement>()
  private labelContainer!: HTMLDivElement
  private keys = new Set<string>()
  private yaw = 0
  private pitch = 0
  private velY = 0
  private px = 0; private py = 50; private pz = 0
  private pointerLocked = false
  private animId = 0
  private lastTime = 0
  private destroyed = false
  private three!: typeof import('three')
  private THREE_CSS!: any
  private buildingMeshes: import('three').Mesh[] = []
  private onPosition: (x: number, y: number, z: number, rotY: number) => void
  private onDamage: (targetId: number, damage: number) => void
  private onNeedAmmo: () => void
  private onHpChange: (hp: number) => void
  private onAmmoChange: (ammo: number) => void
  private ammoRef: React.MutableRefObject<number>
  private hpRef: React.MutableRefObject<number>
  private myHp = 100
  private myAmmo: number
  private canvas: HTMLCanvasElement
  private myId: number
  private raycaster!: import('three').Raycaster
  private shootCooldown = 0
  private posInterval = 0
  private needAmmoSent = false
  private vmGroup!: import('three').Group
  private vmBand!: import('three').Mesh
  private vmPouch!: import('three').Mesh
  private vmShooting = false
  private vmAnimTime = 0
  private readonly VM_ANIM_DUR = 0.18

  constructor(
    canvas: HTMLCanvasElement,
    myId: number,
    myName: string,
    participants: GameParticipant[],
    onPosition: (x: number, y: number, z: number, rotY: number) => void,
    onDamage: (targetId: number, damage: number) => void,
    onNeedAmmo: () => void,
    onHpChange: (hp: number) => void,
    onAmmoChange: (ammo: number) => void,
    ammoRef: React.MutableRefObject<number>,
    hpRef: React.MutableRefObject<number>,
  ) {
    this.canvas = canvas
    this.myId = myId
    this.onPosition = onPosition
    this.onDamage = onDamage
    this.onNeedAmmo = onNeedAmmo
    this.onHpChange = onHpChange
    this.onAmmoChange = onAmmoChange
    this.ammoRef = ammoRef
    this.hpRef = hpRef
    this.myAmmo = START_AMMO

    // Store participant names
    participants.forEach(p => {
      if (p.userId !== myId) {
        this.playerNames.set(p.userId, p.user?.name ?? `Player ${p.userId}`)
        this.playerHps.set(p.userId, 100)
      }

    })
    this.playerNames.set(myId, myName)

    this.init()
  }

  private async init() {
    const THREE = await import('three')
    this.three = THREE
    this.raycaster = new THREE.Raycaster()
    await this.buildScene()
    this.buildViewmodel()
    this.setupInput()
    this.startLoop()

    // Broadcast position every 1/20s
    this.posInterval = window.setInterval(() => {
      this.onPosition(this.px, this.py, this.pz, this.yaw)
    }, 1000 / POS_HZ)
  }

  private async buildScene() {
    const THREE = this.three
    const W = this.canvas.clientWidth || window.innerWidth
    const H = this.canvas.clientHeight || window.innerHeight

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(W, H)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb)
    this.scene.fog = new THREE.Fog(0x87ceeb, 200, 800)

    // Camera
    this.camera = new THREE.PerspectiveCamera(80, W / H, 0.1, 1200)

    // Lights
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.6)
    sun.position.set(300, 500, 200)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 1500
    sun.shadow.camera.left = -600
    sun.shadow.camera.right = 600
    sun.shadow.camera.top = 600
    sun.shadow.camera.bottom = -600
    this.scene.add(sun)
    this.scene.add(new THREE.AmbientLight(0x6080c0, 0.7))

    // Terrain
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGS, TERRAIN_SEGS)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as import('three').BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      pos.setY(i, terrainH(x, z))
    }
    geo.computeVertexNormals()
    const terrMat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f })
    this.terrain = new THREE.Mesh(geo, terrMat)
    this.terrain.receiveShadow = true
    this.scene.add(this.terrain)

    // Zone danger ring (outer red circle on terrain)
    const ringGeo = new THREE.RingGeometry(ZONE_INITIAL - 4, ZONE_INITIAL, 64)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.y = 2
    this.scene.add(ring)

    // Buildings
    BUILDINGS.forEach(b => {
      const gy = terrainH(b.x, b.z)
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d)
      const bMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 + Math.floor(Math.random() * 0x111111) })
      const mesh = new THREE.Mesh(bGeo, bMat)
      mesh.position.set(b.x, gy + b.h / 2, b.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
      this.buildingMeshes.push(mesh)

      // Roof trim
      const roofGeo = new THREE.BoxGeometry(b.w + 0.5, 0.5, b.d + 0.5)
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x5c4a2a })
      const roof = new THREE.Mesh(roofGeo, roofMat)
      roof.position.set(b.x, gy + b.h + 0.25, b.z)
      this.scene.add(roof)
    })

    // Label container for nametags
    this.labelContainer = document.createElement('div')
    this.labelContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'
    this.canvas.parentElement?.appendChild(this.labelContainer)

    // Spawn player
    this.px = 0; this.pz = 0
    this.py = terrainH(0, 0) + EYE_HEIGHT + 2

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (this.destroyed) return
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight
      this.renderer.setSize(w, h)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    })
    ro.observe(this.canvas)
  }

  private makePlayerMesh(userId: number): import('three').Group {
    const THREE = this.three
    const color = PLAYER_COLORS[userId % PLAYER_COLORS.length]
    const group = new THREE.Group()
    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.3, 8)
    const bodyMat = new THREE.MeshLambertMaterial({ color })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.65
    body.castShadow = true
    group.add(body)
    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 8, 8)
    const headMat = new THREE.MeshLambertMaterial({ color })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.65
    head.castShadow = true
    group.add(head)
    return group
  }

  private makeNameLabel(name: string, hp: number, color: string): HTMLDivElement {
    const div = document.createElement('div')
    div.style.cssText = `position:absolute;transform:translateX(-50%);pointer-events:none;text-align:center;`
    div.innerHTML = `
      <div style="background:rgba(0,0,0,0.75);border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;color:${color};white-space:nowrap;margin-bottom:3px">${name}</div>
      <div style="width:50px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto">
        <div id="hpbar" style="height:100%;width:${hp}%;background:${hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444'};border-radius:2px;transition:width 0.2s"></div>
      </div>
    `
    this.labelContainer.appendChild(div)
    return div
  }

  private buildViewmodel() {
    const THREE = this.three
    // Camera must be in scene for its children to render
    this.scene.add(this.camera)

    const group = new THREE.Group()
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x7B4A2D })
    const skinMat  = new THREE.MeshLambertMaterial({ color: 0xDEB887 })
    const bandMat  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888888 })

    // ── Hand ─────────────────────────────────────────────────────────────────
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.19), skinMat)
    group.add(palm)
    // Thumb stub
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.09, 5), skinMat)
    thumb.position.set(-0.064, 0.028, -0.05)
    thumb.rotation.z = 0.7
    group.add(thumb)
    // Fingers hint
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.062, 0.08), skinMat)
    fingers.position.set(0, 0.01, -0.13)
    group.add(fingers)

    // ── Slingshot handle ─────────────────────────────────────────────────────
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 7), woodMat)
    handle.position.set(0, 0.19, 0)
    group.add(handle)

    // ── Y-fork arms ──────────────────────────────────────────────────────────
    const forkGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6)
    const leftFork = new THREE.Mesh(forkGeo, woodMat)
    leftFork.position.set(-0.072, 0.37, -0.072)
    leftFork.rotation.set(0.36, 0, -0.5)
    group.add(leftFork)
    const rightFork = new THREE.Mesh(forkGeo, woodMat)
    rightFork.position.set(0.072, 0.37, -0.072)
    rightFork.rotation.set(0.36, 0, 0.5)
    group.add(rightFork)

    // ── Elastic band ─────────────────────────────────────────────────────────
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.21, 4), bandMat)
    band.rotation.z = Math.PI / 2
    band.position.set(0, 0.45, -0.17)
    this.vmBand = band
    group.add(band)

    // ── Stone / pouch ─────────────────────────────────────────────────────────
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), stoneMat)
    pouch.position.set(0, 0.45, -0.17)
    this.vmPouch = pouch
    group.add(pouch)

    // Position: right side, bottom, forward in camera space
    group.position.set(0.3, -0.31, -0.5)
    group.rotation.set(0, -0.15, 0)
    this.vmGroup = group
    this.camera.add(group)
  }

  updateRemotePlayer(userId: number, x: number, y: number, z: number, rotY: number) {
    if (this.destroyed || userId === this.myId) return
    if (!this.playerMeshes.has(userId)) {
      const mesh = this.makePlayerMesh(userId)
      this.scene.add(mesh)
      this.playerMeshes.set(userId, mesh)
      const name = this.playerNames.get(userId) ?? `Player ${userId}`
      const color = PLAYER_COLORS[userId % PLAYER_COLORS.length]!
      const label = this.makeNameLabel(name, 100, color)
      this.nameLabels.set(userId, label)
    }
    const mesh = this.playerMeshes.get(userId)!
    mesh.position.set(x, y - EYE_HEIGHT + PLAYER_HEIGHT / 2, z)
    mesh.rotation.y = rotY
  }

  updateRemotePlayerHp(userId: number, hp: number) {
    this.playerHps.set(userId, hp)
    const label = this.nameLabels.get(userId)
    if (label) {
      const bar = label.querySelector('#hpbar') as HTMLElement
      if (bar) {
        bar.style.width = `${hp}%`
        bar.style.background = hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444'
      }
    }
    if (hp <= 0) {
      const mesh = this.playerMeshes.get(userId)
      if (mesh) { this.scene.remove(mesh); this.playerMeshes.delete(userId) }
      const label2 = this.nameLabels.get(userId)
      if (label2) { label2.remove(); this.nameLabels.delete(userId) }
    }
  }

  getPlayerName(userId: number): string {
    return this.playerNames.get(userId) ?? `Player ${userId}`
  }

  private getTerrainHeightAt(x: number, z: number): number {
    return terrainH(x, z)
  }

  private checkBuildingCollision(nx: number, nz: number): boolean {
    for (const b of BUILDINGS) {
      const hw = b.w / 2 + 0.5, hd = b.d / 2 + 0.5
      if (nx > b.x - hw && nx < b.x + hw && nz > b.z - hd && nz < b.z + hd) return true
    }
    return false
  }

  private shoot() {
    if (this.shootCooldown > 0) return
    if (this.ammoRef.current <= 0) {
      if (!this.needAmmoSent) { this.needAmmoSent = true; this.onNeedAmmo() }
      return
    }
    this.needAmmoSent = false
    this.shootCooldown = 0.15
    this.vmShooting = true
    this.vmAnimTime = 0

    const newAmmo = Math.max(0, this.ammoRef.current - 1)
    this.onAmmoChange(newAmmo)

    // Raycast from camera center
    const THREE = this.three
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const targets: import('three').Object3D[] = []
    this.playerMeshes.forEach(g => g.traverse(c => targets.push(c)))
    const hits = this.raycaster.intersectObjects(targets, true)
    if (hits.length > 0) {
      // Find which player was hit
      for (const [uid, group] of this.playerMeshes) {
        let found = false
        group.traverse(c => { if (c === hits[0]!.object) found = true })
        if (found) {
          this.onDamage(uid, DAMAGE_PER_HIT)
          break
        }
      }
    }

    // Muzzle flash
    this.showMuzzleFlash()
  }

  private showMuzzleFlash() {
    const flash = document.createElement('div')
    flash.style.cssText = 'position:absolute;inset:0;background:rgba(255,200,100,0.08);pointer-events:none;z-index:50'
    this.canvas.parentElement?.appendChild(flash)
    setTimeout(() => flash.remove(), 60)
  }

  private setupInput() {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      this.keys[down ? 'add' : 'delete'](e.code)
    }
    window.addEventListener('keydown', e => {
      onKey(e, true)
      if (e.code === 'KeyQ') {
        this.needAmmoSent = false
        this.onNeedAmmo()
      }
    })
    window.addEventListener('keyup', e => onKey(e, false))

    this.canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock()
      } else {
        this.shoot()
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas
    })

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return
      this.yaw   -= e.movementX * 0.003
      this.pitch -= e.movementY * 0.003
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch))
    })
  }

  private startLoop() {
    const loop = (now: number) => {
      if (this.destroyed) return
      const dt = Math.min((now - this.lastTime) / 1000, 0.05)
      this.lastTime = now
      this.update(dt)
      this.updateLabels()
      this.renderer.render(this.scene, this.camera)
      this.animId = requestAnimationFrame(loop)
    }
    this.animId = requestAnimationFrame(loop)
  }

  private update(dt: number) {
    const THREE = this.three
    if (this.shootCooldown > 0) this.shootCooldown -= dt

    // ── Slingshot shoot animation ────────────────────────────────────────────
    if (this.vmShooting && this.vmBand && this.vmPouch && this.vmGroup) {
      this.vmAnimTime += dt
      const t = Math.min(1, this.vmAnimTime / this.VM_ANIM_DUR)
      // pull back 0→0.3, snap forward 0.3→1.0
      const pull = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7
      this.vmBand.position.z  = -0.17 + pull * 0.13
      this.vmPouch.position.z = -0.17 + pull * 0.13
      this.vmGroup.rotation.x = pull * 0.09
      if (t >= 1) {
        this.vmShooting = false
        this.vmBand.position.z  = -0.17
        this.vmPouch.position.z = -0.17
        this.vmGroup.rotation.x = 0
      }
    }

    // Movement direction from yaw
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw)
    let dx = 0, dz = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    { dx -= sinY; dz -= cosY }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  { dx += sinY; dz += cosY }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  { dx -= cosY; dz += sinY }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { dx += cosY; dz -= sinY }
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len > 0) { dx /= len; dz /= len }

    const nx = this.px + dx * PLAYER_SPEED * dt
    const nz = this.pz + dz * PLAYER_SPEED * dt

    // Clamp to world bounds
    const half = WORLD_SIZE / 2 - 10
    const cx = Math.max(-half, Math.min(half, nx))
    const cz = Math.max(-half, Math.min(half, nz))

    if (!this.checkBuildingCollision(cx, this.pz)) this.px = cx
    if (!this.checkBuildingCollision(this.px, cz)) this.pz = cz

    // Gravity + terrain follow
    const groundY = this.getTerrainHeightAt(this.px, this.pz) + EYE_HEIGHT
    this.velY -= GRAVITY * dt * 60
    this.py += this.velY * dt
    if (this.py < groundY) { this.py = groundY; this.velY = 0 }

    // Jump
    if ((this.keys.has('Space') || this.keys.has('KeyJ')) && this.py <= groundY + 0.1) {
      this.velY = JUMP_FORCE
    }

    // Update camera
    this.camera.position.set(this.px, this.py, this.pz)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
  }

  private updateLabels() {
    const THREE = this.three
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight
    this.nameLabels.forEach((label, userId) => {
      const mesh = this.playerMeshes.get(userId)
      if (!mesh) return
      const pos3 = mesh.position.clone()
      pos3.y += 2.2
      pos3.project(this.camera)
      if (pos3.z > 1) { label.style.display = 'none'; return }
      const sx = (pos3.x * 0.5 + 0.5) * W
      const sy = (-pos3.y * 0.5 + 0.5) * H
      label.style.display = 'block'
      label.style.left = `${sx}px`
      label.style.top = `${sy}px`
    })
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.animId)
    clearInterval(this.posInterval)
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.labelContainer?.remove()
    this.renderer?.dispose()
  }
}
