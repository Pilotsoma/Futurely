'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

// Generalized portal re-sync button. Works for any connected school portal
// (HAC, PowerSchool) — ClassLink is excluded while the integration is paused.
// Visuals intentionally match the original HAC-only button in Settings.

interface PortalResyncButtonProps {
  portalType: string            // SchoolConnection.systemType, e.g. 'HAC' | 'PowerSchool'
  districtUrl?: string | null   // the connected district; reserved for per-district routing
  onSynced?: () => void | Promise<void>
}

const SUPPORTED_PORTALS = ['HAC', 'PowerSchool']

function syncCall(portalType: string): Promise<unknown> {
  // Both supported portals share the /integrations/grades/sync-profile endpoint;
  // the backend branches on the stored systemType. Add new portal types here.
  switch (portalType) {
    case 'HAC':
    case 'PowerSchool':
      return api.portalSyncProfile()
    default:
      return Promise.reject(new Error(`Re-sync is not available for ${portalType}`))
  }
}

export default function PortalResyncButton({ portalType, onSynced }: PortalResyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  if (!SUPPORTED_PORTALS.includes(portalType)) return null

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      await syncCall(portalType)
      setSyncMsg(`Profile synced from ${portalType}!`)
      await onSynced?.()
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="ns-btn-ghost"
        style={{
          height: 36,
          padding: '0 16px',
          fontSize: 13,
          color: 'var(--primary)',
          borderColor: 'rgba(43,74,142,0.3)',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? (
          <>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
            Syncing…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Re-sync from {portalType}
          </>
        )}
      </button>
      {syncMsg && (
        <p style={{
          fontSize: 12,
          color: syncMsg.toLowerCase().includes('fail') || syncMsg.includes('Error') || syncMsg.includes('not available') ? 'var(--error)' : '#22C55E',
          marginTop: 6,
          textAlign: 'center',
        }}>
          {syncMsg}
        </p>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'center' }}>
        {portalType === 'HAC'
          ? 'Fetches counselor & graduation year from your school portal'
          : 'Refreshes your GPA from your school portal'}
      </p>
    </div>
  )
}
