'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

// Generalized portal re-sync button. Works for any connected school portal
// that supports /integrations/grades/sync-profile (HAC, PowerSchool).

interface PortalResyncButtonProps {
  portalType: string   // SchoolConnection.systemType, e.g. 'HAC' | 'PowerSchool'
  onSynced?: () => void | Promise<void>
}

const SUPPORTED_PORTALS = ['HAC', 'PowerSchool']

export default function PortalResyncButton({ portalType, onSynced }: PortalResyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  if (!SUPPORTED_PORTALS.includes(portalType)) return null

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      await api.portalSyncProfile()
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
            Re-sync
          </>
        )}
      </button>
      {syncMsg && (
        <p style={{
          fontSize: 12,
          color: syncMsg.toLowerCase().includes('fail') || syncMsg.includes('Error') ? 'var(--error)' : '#22C55E',
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
