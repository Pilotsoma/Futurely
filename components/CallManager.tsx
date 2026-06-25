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
  const [calling, setCalling] = useState(false)

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

      if (msg.event === 'CALL_ACCEPTED') {
        // The callee accepted — we already have the token from the initial request
        // Nothing to do here; the active call state was set when we sent the invite
      }

      if (msg.event === 'CALL_REJECTED') {
        setCalling(false)
        setActive(null)
      }

      if (msg.event === 'CALL_ENDED') {
        setActive(null)
        setCalling(false)
      }
    }
    ws.addEventListener('message', handler)
    return () => ws.removeEventListener('message', handler)
  }, [ws])

  // Listen for outgoing call requests dispatched from anywhere in the app
  useEffect(() => {
    const handler = (e: Event) => {
      const { targetUserId, targetName } = (e as CustomEvent<{ targetUserId: number; targetName: string }>).detail
      void startCallFromEvent(targetUserId, targetName)
    }
    window.addEventListener('futurely:call', handler)
    return () => window.removeEventListener('futurely:call', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws])

  const startCallFromEvent = useCallback(async (targetUserId: number, targetName: string) => {
    if (!ws) return
    setCalling(true)
    try {
      const result = await api.callToken(targetUserId)
      ws.send(JSON.stringify({ type: 'CALL_INVITE', targetUserId }))
      setActive({ token: result.token, roomName: result.roomName, livekitUrl: result.livekitUrl, otherUserId: targetUserId, otherName: targetName })
    } catch {
      setCalling(false)
    }
  }, [ws])

  // Accept an incoming call
  const acceptCall = useCallback(async () => {
    if (!incoming || !ws) return
    try {
      const result = await api.callToken(incoming.callerId)
      ws.send(JSON.stringify({ type: 'CALL_ACCEPTED', callerId: incoming.callerId }))
      setActive({ token: result.token, roomName: result.roomName, livekitUrl: result.livekitUrl, otherUserId: incoming.callerId, otherName: incoming.callerName })
      setIncoming(null)
    } catch { /* ignore */ }
  }, [incoming, ws])

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incoming || !ws) return
    ws.send(JSON.stringify({ type: 'CALL_REJECTED', callerId: incoming.callerId }))
    setIncoming(null)
  }, [incoming, ws])

  // Hang up active call
  const hangUp = useCallback(() => {
    if (!active || !ws) return
    ws.send(JSON.stringify({ type: 'CALL_ENDED', otherUserId: active.otherUserId }))
    setActive(null)
    setCalling(false)
  }, [active, ws])

  if (!incoming && !active) return null

  return (
    <>
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
            {/* Pulsing avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 800, color: '#fff',
                animation: 'callPulse 1.5s ease-in-out infinite',
              }}>
                {incoming.callerName.charAt(0).toUpperCase()}
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Incoming call</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{incoming.callerName}</div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={rejectCall}
                style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#EF4444', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Decline"
              >
                📵
              </button>
              <button
                onClick={() => void acceptCall()}
                style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#22C55E', cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Accept"
              >
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
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>📞 {active.otherName}</span>
            <button
              onClick={hangUp}
              style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb, 99,102,241), 0.4); }
          50% { box-shadow: 0 0 0 16px rgba(var(--primary-rgb, 99,102,241), 0); }
        }
      `}</style>
    </>
  )
}

