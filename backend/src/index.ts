import app from './app'
import { logger } from './common/logger'
import { WebSocketServer } from 'ws'
import http from 'http'
import jwt from 'jsonwebtoken'
import { clients, userClients, playerSessions, sessionPlayers, sessionAlive, registerBattlePlayers, sendToSessionExcept, sendToAllInSession } from './lib/websocket'
import { prisma } from './lib/prisma'

const PORT = Number(process.env.PORT ?? '3001')
// app.ts already exits in production when JWT_SECRET is missing or default.
// Read directly — no fallback — so WS auth behaves identically to requireAuth middleware.
const JWT_SECRET = process.env.JWT_SECRET

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  clients.add(ws)
  let authedUserId: number | null = null

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as Record<string, unknown>
      if (msg.type === 'AUTH' && typeof msg.token === 'string' && JWT_SECRET) {
        const payload = jwt.verify(msg.token, JWT_SECRET, { algorithms: ['HS256'] }) as { sub?: string | number }
        const userId = typeof payload.sub === 'number' ? payload.sub : parseInt(String(payload.sub ?? ''), 10)
        if (!isNaN(userId)) {
          authedUserId = userId
          if (!userClients.has(userId)) userClients.set(userId, new Set())
          userClients.get(userId)!.add(ws)
          ws.send(JSON.stringify({ event: 'AUTH_OK', data: { userId } }))
        }
        return
      }

      if (!authedUserId) return

      if (msg.type === 'BATTLE_READY') {
        const code = String(msg.code ?? '').toUpperCase()
        const session = await prisma.gameSession.findUnique({
          where: { joinCode: code },
          include: { participants: { select: { userId: true } } },
        })
        if (session) {
          const allIds = [session.hostId, ...session.participants.map(p => p.userId)]
          registerBattlePlayers(allIds, code)
        }
        return
      }

      if (msg.type === 'BATTLE_POSITION') {
        const code = playerSessions.get(authedUserId)
        if (!code) return
        sendToSessionExcept(code, authedUserId, 'BATTLE_POSITION', {
          userId: authedUserId,
          x: msg.x,
          y: msg.y,
          angle: msg.angle,
        })
        return
      }

      if (msg.type === 'BATTLE_FIRE') {
        const code = playerSessions.get(authedUserId)
        if (!code) return
        sendToSessionExcept(code, authedUserId, 'BATTLE_FIRE', {
          userId: authedUserId,
          x: msg.x,
          y: msg.y,
          angle: msg.angle,
          projId: msg.projId,
        })
        return
      }

      if (msg.type === 'BATTLE_HIT') {
        const code = playerSessions.get(authedUserId)
        if (!code) return
        const targetId = Number(msg.targetUserId)
        const alive = sessionAlive.get(code)
        if (!alive || !alive.has(targetId)) return
        alive.delete(targetId)
        sendToAllInSession(code, 'BATTLE_ELIMINATED', { userId: targetId, eliminatedBy: authedUserId })
        if (alive.size === 1) {
          const winnerId = [...alive][0]
          sendToAllInSession(code, 'BATTLE_WIN', { userId: winnerId })
          sessionPlayers.delete(code)
          sessionAlive.delete(code)
        }
        return
      }
    } catch {
      // ignore malformed messages
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    if (authedUserId !== null) {
      const set = userClients.get(authedUserId)
      set?.delete(ws)
      if (set?.size === 0) userClients.delete(authedUserId)
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  logger.info('NextStep API started', {
    port: PORT,
    url: `http://0.0.0.0:${PORT}`,
  })
})
