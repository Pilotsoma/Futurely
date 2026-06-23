import { WebSocket } from 'ws'

// All connected clients (for broadcast)
export const clients = new Set<WebSocket>()

// userId → set of connections (for targeted delivery)
export const userClients = new Map<number, Set<WebSocket>>()

export const broadcast = (event: string, data: unknown) => {
  const message = JSON.stringify({ event, data })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message)
  })
}

export const sendToUser = (userId: number, event: string, data: unknown) => {
  const connections = userClients.get(userId)
  if (!connections) return
  const message = JSON.stringify({ event, data })
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message)
  })
}

export const sendToSession = (participantUserIds: number[], event: string, data: unknown) => {
  const message = JSON.stringify({ event, data })
  participantUserIds.forEach(userId => {
    const connections = userClients.get(userId)
    if (!connections) return
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(message)
    })
  })
}

// Battle session tracking
export const playerSessions = new Map<number, string>()          // userId → joinCode
export const sessionPlayers = new Map<string, Set<number>>()     // joinCode → Set<userId>
export const sessionAlive   = new Map<string, Set<number>>()     // joinCode → alive userId set

export function registerBattlePlayers(userIds: number[], code: string) {
  if (!sessionPlayers.has(code)) sessionPlayers.set(code, new Set())
  if (!sessionAlive.has(code))   sessionAlive.set(code, new Set())
  userIds.forEach(uid => {
    playerSessions.set(uid, code)
    sessionPlayers.get(code)!.add(uid)
    sessionAlive.get(code)!.add(uid)
  })
}

export function sendToSessionExcept(code: string, exceptId: number, event: string, data: unknown) {
  const players = sessionPlayers.get(code)
  if (!players) return
  players.forEach(uid => { if (uid !== exceptId) sendToUser(uid, event, data) })
}

export function sendToAllInSession(code: string, event: string, data: unknown) {
  const players = sessionPlayers.get(code)
  if (!players) return
  players.forEach(uid => sendToUser(uid, event, data))
}
