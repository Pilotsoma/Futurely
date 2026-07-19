'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError, silentRefresh } from '@/lib/api'
import { clearWebAuth } from '@/lib/authState'
import AccessRestrictedScreen from '@/components/ui/AccessRestrictedScreen'

type CheckState = 'loading' | 'restricted' | 'redirecting'

export default function AccessRestrictedPage() {
  const router = useRouter()
  const [checkState, setCheckState] = useState<CheckState>('loading')
  const [bannedUntilDate, setBannedUntilDate] = useState<string | null>(null)

  useEffect(() => {
    async function checkStatus() {
      try {
        const user = await api.authMe()
        const status = user.accountStatus

        if (status === 'ACTIVE') {
          setCheckState('redirecting')
          // Refresh first so middleware.ts's edge check sees the updated
          // accountStatus claim rather than bouncing back on the stale one.
          await silentRefresh()
          router.replace('/dashboard')
          return
        }
        if (status === 'DOB_MISMATCH_LOCKED') {
          // Ban was lifted (expired) server-side — user still owes a correction
          setCheckState('redirecting')
          router.replace('/account/fix-birthday')
          return
        }
        // UNDER_13_BANNED
        setBannedUntilDate(user.bannedUntilDate)
        setCheckState('restricted')
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 401) {
          router.replace('/login')
          return
        }
        // Fail closed — show the restriction screen if we can't verify
        setCheckState('restricted')
      }
    }
    void checkStatus()
  }, [router])

  function handleLogout() {
    api.logout().catch(() => null)
    clearWebAuth()
    localStorage.removeItem('ns_user')
    router.push('/login')
  }

  if (checkState === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--text-muted)',
          fontSize: 14,
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <span>Checking account status&hellip;</span>
      </div>
    )
  }

  if (checkState === 'redirecting') return null

  return <AccessRestrictedScreen bannedUntilDate={bannedUntilDate} onLogout={handleLogout} />
}
