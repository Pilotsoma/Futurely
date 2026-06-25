'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { api } from '../lib/api'

interface IncomingCall {
  callerId: number
  callerName: string
  roomName: string
}

interface ActiveCall {
  token: string
  roomName: string
  livekitUrl: string
  otherUserId: number
  otherName: string
}

interface CallManagerProps {
  ws: WebSocket | null
  currentUserId: number | null
}

export default function CallManager({ ws, currentUserId }: CallManagerProps) {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null)
  const [active, setActive] = useState<ActiveCall | null>(null)
  const [calling, setCalling] = useState<{ name: string; userId: number } | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  // Keep a stable ref so event handlers always see the latest ws
  const wsRef = useRef<WebSocket | null>(ws)
  useEffect(() => { wsRef.current = ws }, [ws])

  useEffect(() => {
    if (!ws) return
    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as { event: string; data: Record<string, unknown> }

      if (msg.event === 'CALL_INCOMING') {
        setIncoming({
          callerId: msg.data.callerId as number,
          callerName: msg.data.callerName as string,
          roomName: msg.data.roomName as string,
        })
      }

      if (msg.event === 'CALL_REJECTED') {
        setCalling(null)
        setCallError('Call declined.')
        setTimeout(() => setCallError(null), 3000)
      }

      if (msg.event === 'CALL_ENDED') {
        setActive(null)
        setCalling(null)
      }
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [ws])

  // Listen for outgoing call requests dispatched from anywhere in the app
  useEffect(() => {
    const handler = (e: Event) => {
      const { targetUserId, targetName } = (e as CustomEvent<{ targetUserId: number; targetName: string }>).detail
      void startCall(targetUserId, targetName)
    }
    window.addEventListener('futurely:call', handler)
    return () => window.removeEventListener('futurely:call', handler)
  // startCall uses wsRef so it doesn't need ws in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCall = useCallback(async (targetUserId: number, targetName: string) => {
    setCallError(null)
    const currentWs = wsRef.current
    if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
      setCallError('Not connected — please wait a moment and try again.')
      setTimeout(() => setCallError(null), 4000)
      return
    }
    setCalling({ name: targetName, userId: targetUserId })
    try {
      const result = await api.callToken(targetUserId)
      currentWs.send(JSON.stringify({ type: 'CALL_INVITE', targetUserId }))
      setActive({ token: result.token, roomName: result.roomName, livekitUrl: result.livekitUrl, otherUserId: targetUserId, otherName: targetName })
      setCalling(null)
    } catch (err) {
      setCalling(null)
      setCallError(err instanceof Error ? err.message : 'Failed to start call.')
      setTimeout(() => setCallError(null), 4000)
    }
  }, [])

  const acceptCall = useCallback(async () => {
    if (!incoming) return
    const currentWs = wsRef.current
    try {
      const result = await api.callToken(incoming.callerId)
      currentWs?.send(JSON.stringify({ type: 'CALL_ACCEPTED', callerId: incoming.callerId }))
      setActive({ token: result.token, roomName: result.roomName, livekitUrl: result.livekitUrl, otherUserId: incoming.callerId, otherName: incoming.callerName })
      setIncoming(null)
    } catch { /* ignore */ }
  }, [incoming])

  const rejectCall = useCallback(() => {
    if (!incoming) return
    wsRef.current?.send(JSON.stringify({ type: 'CALL_REJECTED', callerId: incoming.callerId }))
    setIncoming(null)
  }, [incoming])

  const hangUp = useCallback(() => {
    if (!active) return
    wsRef.current?.send(JSON.stringify({ type: 'CALL_ENDED', otherUserId: active.otherUserId }))
    setActive(null)
    setCalling(null)
  }, [active])

  if (!incoming && !active && !calling && !callError) return null

  return (
    <>
      {/* Error toast */}
      {callError && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10000, background: '#EF4444', color: '#fff', fontWeight: 700,
          fontSize: 13, padding: '10px 20px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {callError}
        </div>
      )}

      {/* Calling... overlay (outgoing, waiting for answer) */}
      {calling && !active && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', minWidth: 280,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800, color: '#fff',
              animation: 'callPulse 1.5s ease-in-out infinite',
            }}>
              {calling.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Calling…</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{calling.name}</div>
            </div>
            <button
              onClick={() => {
                wsRef.current?.send(JSON.stringify({ type: 'CALL_ENDED', otherUserId: calling.userId }))
                setCalling(null)
              }}
              style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Cancel"
            >
              📵
            </button>
          </div>
        </div>
      )}

      {/* Incoming call modal */}
      {incoming && !active && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: '32px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', minWidth: 280,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800, color: '#fff',
              animation: 'callPulse 1.5s ease-in-out infinite',
            }}>
              {incoming.callerName.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Incoming call</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{incoming.callerName}</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={rejectCall}
                style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Decline">
                📵
              </button>
              <button onClick={() => void acceptCall()}
                style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#22C55E', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Accept">
                📞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call */}
      {active && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: '#0a0a0a', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>📞 {active.otherName}</span>
            <button onClick={hangUp}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              End Call
            </button>
          </div>
          <LiveKitRoom
            serverUrl={active.livekitUrl}
            token={active.token}
            connect
            video
            audio
            onDisconnected={hangUp}
            style={{ flex: 1, minHeight: 0 }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        </div>
      )}

      <style>{`
        @keyframes callPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50% { box-shadow: 0 0 0 16px rgba(99,102,241,0); }
        }
      `}</style>
    </>
  )
}
