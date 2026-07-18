'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { clearWebAuth } from '@/lib/authState'
import FixBirthdayBlockScreen from '@/components/ui/FixBirthdayBlockScreen'
import ConnectSchoolBlockScreen from '@/components/ui/ConnectSchoolBlockScreen'

type CheckState = 'loading' | 'no-school' | 'locked' | 'redirecting'

const centeredPage: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '24px 20px',
}

export default function FixBirthdayPage() {
  const router = useRouter()
  const [checkState, setCheckState] = useState<CheckState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkStatus() {
      try {
        const user = await api.authMe()
        const status = user.accountStatus

        if (status === 'ACTIVE') {
          setCheckState('redirecting')
          router.replace('/dashboard')
          return
        }
        if (status === 'UNDER_13_BANNED') {
          setCheckState('redirecting')
          router.replace('/account/access-restricted')
          return
        }
        // DOB_MISMATCH_LOCKED or any unrecognised locked status — check whether
        // a school connection exists before showing the birthday form.
        if (!user.hasSchoolConnection) {
          setCheckState('no-school')
        } else {
          setCheckState('locked')
        }
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 401) {
          router.replace('/login')
          return
        }
        setError('Unable to check account status. Please try again.')
        setCheckState('locked')
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

  if (checkState === 'no-school') {
    return (
      <div style={centeredPage}>
        <ConnectSchoolBlockScreen
          onLogout={handleLogout}
          onConnected={() => setCheckState('locked')}
        />
      </div>
    )
  }

  return (
    <div style={centeredPage}>
      {error && (
        <p
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            zIndex: 100,
          }}
        >
          {error}
        </p>
      )}
      <FixBirthdayBlockScreen onLogout={handleLogout} />
    </div>
  )
}
