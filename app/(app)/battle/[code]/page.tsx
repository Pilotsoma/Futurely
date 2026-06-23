'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, GameSession, getApiToken } from '../../../../lib/api'

// ── Constants ────────────────────────────────────────────────────────────────
const WORLD_W = 2400
const WORLD_H = 2400
const PLAYER_R = 16
const PROJ_R = 5
const PLAYER_SPEED = 200
const PROJ_SPEED = 600
const PROJ_MAX_DIST = 750
const POSITION_HZ = 20   // send position updates per second
const AMMO_PER_CORRECT = 5

const PLAYER_COLORS = [
  '#e74c3c', '#3498db', '#f39c12', '#2ecc71',
  '#9b59b6', '#1abc9c', '#e67e22', '#ff5252',
]

const SPAWN_POSITIONS = [
  { x: 380, y: 380 }, { x: 2020, y: 380 }, { x: 380, y: 2020 }, { x: 2020, y: 2020 },
  { x: 1200, y: 280 }, { x: 1200, y: 2120 }, { x: 280, y: 1200 }, { x: 2120, y: 1200 },
]

// ── Types ────────────────────────────────────────────────────────────────────
interface WorldObj {
  type: 'house' | 'tree' | 'rock' | 'bush'
  x: number; y: number
  w?: number; h?: number
  r?: number
  solid: boolean
}

interface PlayerState {
  userId: number
  name: string
  color: string
  x: number; y: number
  angle: number
  alive: boolean
}

interface Projectile {
  id: string
  ownerId: number
  x: number; y: number
  vx: number; vy: number
  dist: number
}

interface GameStateRef {
  players: Map<number, PlayerState>
  projectiles: Projectile[]
  myId: number | null
  world: WorldObj[]
}

// ── Seeded RNG ───────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── World generation ─────────────────────────────────────────────────────────
function generateWorld(seed: number): WorldObj[] {
  const rng = mulberry32(seed)
  const objs: WorldObj[] = []
  const m = 250

  for (let i = 0; i < 8; i++) {
    const w = 70 + rng() * 60, h = 60 + rng() * 50
    objs.push({ type: 'house', x: m + rng() * (WORLD_W - 2 * m - w), y: m + rng() * (WORLD_H - 2 * m - h), w, h, solid: true })
  }
  for (let i = 0; i < 22; i++) {
    objs.push({ type: 'tree', x: m + rng() * (WORLD_W - 2 * m), y: m + rng() * (WORLD_H - 2 * m), r: 18 + rng() * 14, solid: true })
  }
  for (let i = 0; i < 14; i++) {
    objs.push({ type: 'rock', x: m + rng() * (WORLD_W - 2 * m), y: m + rng() * (WORLD_H - 2 * m), r: 10 + rng() * 16, solid: true })
  }
  for (let i = 0; i < 28; i++) {
    objs.push({ type: 'bush', x: m + rng() * (WORLD_W - 2 * m), y: m + rng() * (WORLD_H - 2 * m), r: 24 + rng() * 20, solid: false })
  }
  return objs
}

// ── Collision helpers ────────────────────────────────────────────────────────
function circleVsRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw))
  const nearY = Math.max(ry, Math.min(cy, ry + rh))
  const dx = cx - nearX, dy = cy - nearY
  return dx * dx + dy * dy < cr * cr
}

function circleVsCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = ax - bx, dy = ay - by
  const r = ar + br
  return dx * dx + dy * dy < r * r
}

function playerCollides(x: number, y: number, world: WorldObj[]): boolean {
  for (const o of world) {
    if (!o.solid) continue
    if (o.type === 'house') { if (circleVsRect(x, y, PLAYER_R, o.x, o.y, o.w!, o.h!)) return true }
    else { if (circleVsCircle(x, y, PLAYER_R, o.x, o.y, o.r!)) return true }
  }
  if (x < PLAYER_R || x > WORLD_W - PLAYER_R || y < PLAYER_R || y > WORLD_H - PLAYER_R) return true
  return false
}

function projCollides(x: number, y: number, world: WorldObj[]): boolean {
  for (const o of world) {
    if (!o.solid) continue
    if (o.type === 'house') { if (circleVsRect(x, y, PROJ_R, o.x, o.y, o.w!, o.h!)) return true }
    else { if (circleVsCircle(x, y, PROJ_R, o.x, o.y, o.r!)) return true }
  }
  if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) return true
  return false
}

function isInBush(x: number, y: number, world: WorldObj[]): boolean {
  for (const o of world) {
    if (o.type !== 'bush') continue
    const dx = x - o.x, dy = y - o.y
    if (dx * dx + dy * dy < o.r! * o.r!) return true
  }
  return false
}

// ── Drawing functions ────────────────────────────────────────────────────────
function drawGround(ctx: CanvasRenderingContext2D, camX: number, camY: number, cw: number, ch: number, rng: () => number) {
  ctx.fillStyle = '#3d7a2a'
  ctx.fillRect(0, 0, cw, ch)
  // Tiled grass patches
  const patchSize = 120
  const startX = Math.floor(camX / patchSize) * patchSize
  const startY = Math.floor(camY / patchSize) * patchSize
  for (let wx = startX; wx < camX + cw + patchSize; wx += patchSize) {
    for (let wy = startY; wy < camY + ch + patchSize; wy += patchSize) {
      const hash = ((wx * 1337 + wy * 7919) & 0xffffff) / 0xffffff
      if (hash < 0.35) {
        ctx.fillStyle = hash < 0.15 ? '#3a7228' : '#428030'
        ctx.fillRect(wx - camX, wy - camY, patchSize, patchSize)
      }
    }
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, o: WorldObj, camX: number, camY: number) {
  const sx = o.x - camX, sy = o.y - camY
  const w = o.w!, h = o.h!
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fillRect(sx + 8, sy + 8, w, h)
  // Walls
  ctx.fillStyle = '#d4b896'
  ctx.fillRect(sx, sy, w, h)
  ctx.strokeStyle = '#b89870'
  ctx.lineWidth = 1.5
  ctx.strokeRect(sx, sy, w, h)
  // Roof
  ctx.fillStyle = '#7a3a18'
  ctx.beginPath()
  ctx.moveTo(sx - 6, sy)
  ctx.lineTo(sx + w / 2, sy - 22)
  ctx.lineTo(sx + w + 6, sy)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5a2a0c'
  ctx.lineWidth = 1
  ctx.stroke()
  // Door
  const dw = 14, dh = 20
  ctx.fillStyle = '#3a1f0a'
  ctx.fillRect(sx + w / 2 - dw / 2, sy + h - dh, dw, dh)
  // Windows
  ctx.fillStyle = 'rgba(160,220,255,0.55)'
  ctx.fillRect(sx + 8, sy + 12, 16, 12)
  ctx.fillRect(sx + w - 24, sy + 12, 16, 12)
  ctx.strokeStyle = '#5a4030'
  ctx.lineWidth = 1
  ctx.strokeRect(sx + 8, sy + 12, 16, 12)
  ctx.strokeRect(sx + w - 24, sy + 12, 16, 12)
}

function drawTree(ctx: CanvasRenderingContext2D, o: WorldObj, camX: number, camY: number) {
  const sx = o.x - camX, sy = o.y - camY, r = o.r!
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath(); ctx.ellipse(sx + 4, sy + r * 0.4, r * 0.8, r * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5a3010'
  ctx.fillRect(sx - 4, sy + r * 0.3, 8, r * 0.5)
  ctx.fillStyle = '#1e6b14'
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#28901a'
  ctx.beginPath(); ctx.arc(sx - r * 0.25, sy - r * 0.2, r * 0.55, 0, Math.PI * 2); ctx.fill()
}

function drawRock(ctx: CanvasRenderingContext2D, o: WorldObj, camX: number, camY: number) {
  const sx = o.x - camX, sy = o.y - camY, r = o.r!
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath(); ctx.ellipse(sx + 3, sy + r * 0.5, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#888'
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#aaa'
  ctx.beginPath(); ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.45, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke()
}

function drawBush(ctx: CanvasRenderingContext2D, o: WorldObj, camX: number, camY: number) {
  const sx = o.x - camX, sy = o.y - camY, r = o.r!
  ctx.globalAlpha = 0.88
  ctx.fillStyle = '#196b14'
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#22921a'
  ctx.beginPath(); ctx.arc(sx - r * 0.25, sy - r * 0.15, r * 0.7, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(sx + r * 0.2, sy - r * 0.1, r * 0.6, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState, isLocal: boolean, inBush: boolean, sx: number, sy: number) {
  const alpha = inBush && !isLocal ? 0.3 : 1
  ctx.globalAlpha = alpha
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath(); ctx.ellipse(sx + 3, sy + 6, PLAYER_R, PLAYER_R * 0.45, 0, 0, Math.PI * 2); ctx.fill()
  // Body
  ctx.fillStyle = p.color
  ctx.beginPath(); ctx.arc(sx, sy, PLAYER_R, 0, Math.PI * 2); ctx.fill()
  // Rim
  ctx.strokeStyle = isLocal ? '#fff' : 'rgba(0,0,0,0.5)'
  ctx.lineWidth = isLocal ? 3 : 1.5
  ctx.stroke()
  // Aim direction nub
  const nx = sx + Math.cos(p.angle) * (PLAYER_R + 8)
  const ny = sy + Math.sin(p.angle) * (PLAYER_R + 8)
  ctx.fillStyle = isLocal ? '#fff' : 'rgba(255,255,255,0.7)'
  ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2); ctx.fill()
  // Name tag
  ctx.globalAlpha = Math.max(alpha, 0.6)
  ctx.font = 'bold 11px system-ui,sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = '#fff'
  ctx.fillText(p.name.slice(0, 12), sx, sy - PLAYER_R - 3)
  ctx.globalAlpha = 1
}

function drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, camX: number, camY: number) {
  const sx = proj.x - camX, sy = proj.y - camY
  ctx.shadowColor = '#ff8c00'
  ctx.shadowBlur = 10
  ctx.fillStyle = '#f97316'
  ctx.beginPath(); ctx.arc(sx, sy, PROJ_R, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0
  // Stone texture
  ctx.fillStyle = '#d97706'
  ctx.beginPath(); ctx.arc(sx - 1.5, sy - 1.5, PROJ_R * 0.45, 0, Math.PI * 2); ctx.fill()
}

function drawTrajectory(ctx: CanvasRenderingContext2D, ox: number, oy: number, angle: number, camX: number, camY: number, world: WorldObj[]) {
  const DOT_COUNT = 12
  const DOT_SPACING = 55
  ctx.fillStyle = 'rgba(249,115,22,0.6)'
  for (let i = 1; i <= DOT_COUNT; i++) {
    const d = i * DOT_SPACING
    const wx = ox + Math.cos(angle) * d
    const wy = oy + Math.sin(angle) * d
    if (projCollides(wx, wy, world)) break
    const alpha = 0.7 - (i / DOT_COUNT) * 0.55
    ctx.globalAlpha = alpha
    ctx.beginPath(); ctx.arc(wx - camX, wy - camY, 3.5, 0, Math.PI * 2); ctx.fill()
  }
  ctx.globalAlpha = 1
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BattlePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gsRef = useRef<GameStateRef>({ players: new Map(), projectiles: [], myId: null, world: [] })
  const keysRef = useRef<Set<string>>(new Set())
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastPosRef = useRef<{ x: number; y: number; angle: number }>({ x: 0, y: 0, angle: 0 })
  const wsRef = useRef<WebSocket | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const lastPosSendRef = useRef<number>(0)

  const [session, setSession] = useState<GameSession | null>(null)
  const [myId, setMyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'eliminated' | 'won' | 'lost'>('lobby')
  const [ammo, setAmmo] = useState(10)
  const [aliveCount, setAliveCount] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [killMsg, setKillMsg] = useState<string | null>(null)
  const phaseRef = useRef<'lobby' | 'playing' | 'eliminated' | 'won' | 'lost'>('lobby')
  const ammoRef = useRef(10)

  // Question state
  const [questions, setQuestions] = useState<Array<{ id: number; questionText: string; options: string[]; correctAnswer?: string }>>([])
  const [qIndex, setQIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const qIndexRef = useRef(0)
  const sessionRef = useRef<GameSession | null>(null)

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return
    api.getGame(code.toUpperCase()).then(s => {
      if (s.type !== 'BATTLE') { router.replace(`/play/${code}`); return }
      setSession(s)
      sessionRef.current = s
      setQuestions(s.set.questions)
      const world = generateWorld(s.id)
      gsRef.current.world = world
      setLoading(false)
    }).catch(() => router.replace('/play'))
  }, [code, router])

  // ── WS setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const token = getApiToken()
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.futurely.app'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (token) ws.send(JSON.stringify({ type: 'AUTH', token }))
    }

    ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data)

        if (event === 'AUTH_OK') {
          setMyId(data.userId)
          gsRef.current.myId = data.userId
          // Register in battle session
          ws.send(JSON.stringify({ type: 'BATTLE_READY', code: code.toUpperCase() }))
          // Init my player at spawn position
          initMyPlayer(data.userId)
        }

        if (event === 'BATTLE_POSITION') {
          const gs = gsRef.current
          const p = gs.players.get(data.userId)
          if (p) { p.x = data.x; p.y = data.y; p.angle = data.angle }
        }

        if (event === 'BATTLE_FIRE') {
          const angle = data.angle as number
          gsRef.current.projectiles.push({
            id: data.projId as string,
            ownerId: data.userId as number,
            x: data.x as number, y: data.y as number,
            vx: Math.cos(angle), vy: Math.sin(angle),
            dist: 0,
          })
        }

        if (event === 'BATTLE_ELIMINATED') {
          const gs = gsRef.current
          const p = gs.players.get(data.userId)
          if (p) { p.alive = false }
          const alive = [...gs.players.values()].filter(pl => pl.alive)
          setAliveCount(alive.length)
          if (data.userId === gs.myId) {
            phaseRef.current = 'eliminated'
            setPhase('eliminated')
          }
          const killerName = gs.players.get(data.eliminatedBy as number)?.name ?? 'Someone'
          const victimName = p?.name ?? 'A player'
          setKillMsg(`${killerName} eliminated ${victimName}!`)
          setTimeout(() => setKillMsg(null), 3000)
        }

        if (event === 'BATTLE_WIN') {
          const gs = gsRef.current
          const winnerName = gs.players.get(data.userId as number)?.name ?? 'A player'
          setWinner(winnerName)
          if (data.userId === gs.myId) {
            phaseRef.current = 'won'; setPhase('won')
          } else {
            phaseRef.current = 'lost'; setPhase('lost')
          }
        }
      } catch { /* ignore */ }
    }

    return () => { ws.close() }
  }, [session, code])

  function initMyPlayer(userId: number) {
    const s = sessionRef.current
    if (!s) return
    const allIds = [s.hostId, ...s.participants.map(p => p.userId)]
    const myIndex = allIds.indexOf(userId)
    const spawnIdx = Math.max(0, myIndex) % SPAWN_POSITIONS.length
    const spawn = SPAWN_POSITIONS[spawnIdx]

    const gs = gsRef.current
    allIds.forEach((uid, i) => {
      const sp = SPAWN_POSITIONS[i % SPAWN_POSITIONS.length]
      const participant = s.participants.find(p => p.userId === uid) ?? { userId: uid, user: { name: uid === s.hostId ? s.host.name : 'Player', nameColor: null } }
      const name = uid === s.hostId
        ? (s.host.name ?? 'Host')
        : (participant as { user: { name: string | null } }).user?.name ?? 'Player'
      gs.players.set(uid, { userId: uid, name: name ?? 'Player', color: PLAYER_COLORS[i % PLAYER_COLORS.length], x: sp.x, y: sp.y, angle: 0, alive: true })
    })

    lastPosRef.current = { x: spawn.x, y: spawn.y, angle: 0 }
    setAliveCount(allIds.length)
    phaseRef.current = 'playing'
    setPhase('playing')
  }

  // ── Input setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[down ? 'add' : 'delete'](e.key.toLowerCase())
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleCanvasClick = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    if (ammoRef.current <= 0) return
    const gs = gsRef.current
    if (!gs.myId) return
    const me = gs.players.get(gs.myId)
    if (!me || !me.alive) return

    const canvas = canvasRef.current
    if (!canvas) return
    const cw = canvas.width, ch = canvas.height
    const camX = Math.max(0, Math.min(me.x - cw / 2, WORLD_W - cw))
    const camY = Math.max(0, Math.min(me.y - ch / 2, WORLD_H - ch))
    const mx = mousePosRef.current.x + camX
    const my = mousePosRef.current.y + camY
    const angle = Math.atan2(my - me.y, mx - me.x)
    const projId = `${gs.myId}_${Date.now()}`

    gs.projectiles.push({ id: projId, ownerId: gs.myId, x: me.x, y: me.y, vx: Math.cos(angle), vy: Math.sin(angle), dist: 0 })

    ammoRef.current -= 1
    setAmmo(a => a - 1)

    wsRef.current?.send(JSON.stringify({ type: 'BATTLE_FIRE', x: me.x, y: me.y, angle, projId }))
  }, [])

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !session) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function loop(ts: number) {
      rafRef.current = requestAnimationFrame(loop)
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = ts

      const gs = gsRef.current
      const me = gs.myId ? gs.players.get(gs.myId) : null

      // ── Update ──────────────────────────────────────────────────────────
      if (me && me.alive) {
        const keys = keysRef.current
        let dx = 0, dy = 0
        if (keys.has('w') || keys.has('arrowup')) dy -= 1
        if (keys.has('s') || keys.has('arrowdown')) dy += 1
        if (keys.has('a') || keys.has('arrowleft')) dx -= 1
        if (keys.has('d') || keys.has('arrowright')) dx += 1

        if (dx !== 0 || dy !== 0) {
          const len = Math.sqrt(dx * dx + dy * dy)
          dx /= len; dy /= len
          const nx = me.x + dx * PLAYER_SPEED * dt
          const ny = me.y + dy * PLAYER_SPEED * dt
          if (!playerCollides(nx, me.y, gs.world)) me.x = nx
          if (!playerCollides(me.x, ny, gs.world)) me.y = ny
        }

        const cw = canvas!.width, ch = canvas!.height
        const camX = Math.max(0, Math.min(me.x - cw / 2, WORLD_W - cw))
        const camY = Math.max(0, Math.min(me.y - ch / 2, WORLD_H - ch))
        const wx = mousePosRef.current.x + camX
        const wy = mousePosRef.current.y + camY
        me.angle = Math.atan2(wy - me.y, wx - me.x)

        // Send position at fixed interval
        const now = Date.now()
        if (now - lastPosSendRef.current > 1000 / POSITION_HZ) {
          lastPosSendRef.current = now
          wsRef.current?.send(JSON.stringify({ type: 'BATTLE_POSITION', x: me.x, y: me.y, angle: me.angle }))
        }
      }

      // Update projectiles
      for (let i = gs.projectiles.length - 1; i >= 0; i--) {
        const proj = gs.projectiles[i]
        const step = PROJ_SPEED * dt
        proj.x += proj.vx * step
        proj.y += proj.vy * step
        proj.dist += step

        if (proj.dist > PROJ_MAX_DIST || projCollides(proj.x, proj.y, gs.world)) {
          gs.projectiles.splice(i, 1)
          continue
        }

        // Hit detection (only for my projectiles)
        if (proj.ownerId === gs.myId) {
          let hit = false
          for (const [uid, player] of gs.players) {
            if (uid === gs.myId || !player.alive) continue
            const dx = proj.x - player.x, dy = proj.y - player.y
            if (dx * dx + dy * dy < (PLAYER_R + PROJ_R) * (PLAYER_R + PROJ_R)) {
              hit = true
              gs.projectiles.splice(i, 1)
              wsRef.current?.send(JSON.stringify({ type: 'BATTLE_HIT', targetUserId: uid, projId: proj.id }))
              break
            }
          }
          if (hit) continue
        }
      }

      // ── Render ──────────────────────────────────────────────────────────
      const cw = canvas!.width, ch = canvas!.height
      const camX = me ? Math.max(0, Math.min(me.x - cw / 2, WORLD_W - cw)) : 0
      const camY = me ? Math.max(0, Math.min(me.y - ch / 2, WORLD_H - ch)) : 0

      ctx!.clearRect(0, 0, cw, ch)
      drawGround(ctx!, camX, camY, cw, ch, () => 0)

      // Sort world objects by y for depth
      const sorted = [...gs.world].sort((a, b) => (a.y + (a.h ?? a.r ?? 0)) - (b.y + (b.h ?? b.r ?? 0)))

      // Draw non-bush first
      for (const o of sorted) {
        if (o.type === 'bush') continue
        const sx = o.x - camX, sy = o.y - camY
        const pad = 100
        if (sx < -pad || sx > cw + pad || sy < -pad || sy > ch + pad) continue
        if (o.type === 'house') drawHouse(ctx!, o, camX, camY)
        else if (o.type === 'tree') drawTree(ctx!, o, camX, camY)
        else if (o.type === 'rock') drawRock(ctx!, o, camX, camY)
      }

      // Draw players (sorted by y)
      const playersSorted = [...gs.players.values()].filter(p => p.alive).sort((a, b) => a.y - b.y)
      for (const p of playersSorted) {
        const sx = p.x - camX, sy = p.y - camY
        if (sx < -60 || sx > cw + 60 || sy < -60 || sy > ch + 60) continue
        const inBush = isInBush(p.x, p.y, gs.world)
        drawPlayer(ctx!, p, p.userId === gs.myId, inBush, sx, sy)
      }

      // Draw bushes on top of players (for hiding)
      for (const o of sorted) {
        if (o.type !== 'bush') continue
        const sx = o.x - camX, sy = o.y - camY
        if (sx < -100 || sx > cw + 100 || sy < -100 || sy > ch + 100) continue
        drawBush(ctx!, o, camX, camY)
      }

      // Draw projectiles
      for (const proj of gs.projectiles) {
        drawProjectile(ctx!, proj, camX, camY)
      }

      // Draw trajectory preview for local player
      if (me && me.alive && ammoRef.current > 0) {
        drawTrajectory(ctx!, me.x, me.y, me.angle, camX, camY, gs.world)
      }

      // ── HUD ─────────────────────────────────────────────────────────────
      // Ammo counter (top-left)
      ctx!.fillStyle = 'rgba(0,0,0,0.55)'
      ctx!.beginPath(); ctx!.roundRect(12, 12, 110, 42, 10); ctx!.fill()
      ctx!.fillStyle = '#f97316'
      ctx!.font = 'bold 13px system-ui,sans-serif'
      ctx!.textAlign = 'left'
      ctx!.textBaseline = 'middle'
      ctx!.fillText('AMMO', 22, 27)
      ctx!.fillStyle = ammoRef.current > 0 ? '#fff' : '#ef4444'
      ctx!.font = 'bold 20px system-ui,sans-serif'
      ctx!.fillText(String(ammoRef.current), 22, 45)

      // Alive counter (top-right)
      ctx!.fillStyle = 'rgba(0,0,0,0.55)'
      ctx!.beginPath(); ctx!.roundRect(cw - 122, 12, 110, 42, 10); ctx!.fill()
      ctx!.fillStyle = '#22c55e'
      ctx!.font = 'bold 13px system-ui,sans-serif'
      ctx!.textAlign = 'right'
      ctx!.fillText('ALIVE', cw - 22, 27)
      ctx!.fillStyle = '#fff'
      ctx!.font = 'bold 20px system-ui,sans-serif'
      ctx!.fillText(String([...gs.players.values()].filter(p => p.alive).length), cw - 22, 45)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, session])

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width
        canvas.height = entry.contentRect.height
      }
    })
    obs.observe(canvas)
    return () => obs.disconnect()
  }, [])

  // ── Answer question ───────────────────────────────────────────────────────
  async function handleAnswer(answer: string) {
    if (submitting || answerResult !== null) return
    const q = questions[qIndexRef.current]
    if (!q || !session) return
    setSelectedAnswer(answer)
    setSubmitting(true)
    try {
      const result = await api.submitAnswer(session.joinCode, { questionId: q.id, answer, timeMs: 0 })
      setAnswerResult(result.isCorrect ? 'correct' : 'wrong')
      if (result.isCorrect) {
        ammoRef.current += AMMO_PER_CORRECT
        setAmmo(a => a + AMMO_PER_CORRECT)
        setTimeout(() => {
          const next = qIndexRef.current + 1 < questions.length ? qIndexRef.current + 1 : 0
          qIndexRef.current = next
          setQIndex(next)
          setSelectedAnswer(null)
          setAnswerResult(null)
          setSubmitting(false)
        }, 1200)
      } else {
        setTimeout(() => { setSelectedAnswer(null); setAnswerResult(null); setSubmitting(false) }, 1200)
      }
    } catch {
      setSubmitting(false)
    }
  }

  const q = questions[qIndex]
  const OPTION_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e']

  // ── Start the battle (host only) ───────────────────────────────────────────
  async function handleStartBattle() {
    if (!session) return
    try {
      await api.startGame(session.joinCode)
      // Host triggers BATTLE_READY for everyone via the start endpoint
      wsRef.current?.send(JSON.stringify({ type: 'BATTLE_READY', code: session.joinCode }))
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#111', color: '#fff', fontSize: 16, fontWeight: 700 }}>
      Loading battle...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d0d0d', overflow: 'hidden' }}>
      {/* ── Game Canvas ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: phase === 'playing' ? 'crosshair' : 'default' }}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
        />

        {/* Kill feed message */}
        {killMsg && (
          <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#f97316', padding: '8px 20px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {killMsg}
          </div>
        )}

        {/* Lobby overlay */}
        {phase === 'lobby' && session && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 20, padding: '40px 50px', textAlign: 'center', maxWidth: 420, width: '90%' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏹</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Battle Royale</h1>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px' }}>{session.set.title}</p>
              <div style={{ background: '#111', borderRadius: 12, padding: '12px 20px', marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>JOIN CODE</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#f97316', letterSpacing: '0.2em' }}>{session.joinCode}</div>
              </div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>
                {session.participants.length + 1} player{session.participants.length !== 0 ? 's' : ''} joined
              </div>
              {myId === session.hostId ? (
                <button
                  onClick={() => void handleStartBattle()}
                  style={{ padding: '14px 36px', borderRadius: 14, background: '#f97316', border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
                >
                  Start Battle
                </button>
              ) : (
                <div style={{ fontSize: 13, color: '#888' }}>Waiting for host to start...</div>
              )}
            </div>
          </div>
        )}

        {/* Eliminated overlay */}
        {phase === 'eliminated' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>💀</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', marginBottom: 8 }}>You were eliminated!</div>
              <div style={{ fontSize: 14, color: '#888' }}>Keep answering questions to spectate</div>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {phase === 'won' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>🏆</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b', marginBottom: 8 }}>You Won!</div>
              <div style={{ fontSize: 15, color: '#aaa', marginBottom: 28 }}>Last player standing</div>
              <button onClick={() => router.push('/play')} style={{ padding: '12px 32px', borderRadius: 14, background: '#f59e0b', border: 'none', color: '#000', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Loss overlay */}
        {phase === 'lost' && winner && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎮</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{winner} wins!</div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 28 }}>Better luck next time</div>
              <button onClick={() => router.push('/play')} style={{ padding: '12px 32px', borderRadius: 14, background: '#6366f1', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Question Panel ─────────────────────────────────────────────────── */}
      {(phase === 'playing' || phase === 'eliminated') && q && (
        <div style={{ height: 170, background: '#111', borderTop: '1px solid #222', padding: '14px 20px', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', background: '#1f1005', padding: '3px 10px', borderRadius: 10 }}>
                +{AMMO_PER_CORRECT} AMMO
              </span>
              <span style={{ fontSize: 12, color: '#666' }}>Q{qIndex + 1} of {questions.length}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.4, marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
              {q.questionText}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0, width: 420 }}>
            {q.options.map((opt, i) => {
              const isSelected = selectedAnswer === opt
              const isResult = answerResult !== null && isSelected
              const bg = isResult
                ? answerResult === 'correct' ? '#166534' : '#7f1d1d'
                : isSelected ? '#1e40af' : '#1c1c1c'
              const border = isResult
                ? answerResult === 'correct' ? '#22c55e' : '#ef4444'
                : isSelected ? '#3b82f6' : '#2a2a2a'
              return (
                <button
                  key={i}
                  onClick={() => void handleAnswer(opt)}
                  disabled={submitting || answerResult !== null}
                  style={{
                    padding: '10px 14px', borderRadius: 10, background: bg, border: `1.5px solid ${border}`,
                    color: '#fff', fontSize: 12, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: OPTION_COLORS[i], color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                    {['A','B','C','D'][i]}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
