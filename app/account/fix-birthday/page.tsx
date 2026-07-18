'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { clearWebAuth } from '@/lib/authState'
import FixBirthdayBlockScreen from '@/components/ui/FixBirthdayBlockScreen'

type CheckState = 'loading' | 'locked' | 'redirecting'

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
        // DOB_MISMATCH_LOCKED or any unrecognised locked status
        setCheckState('locked')
      } catch (err) {
        if (err instanceof ApiError && err.httpStatus === 401) {
          // Not authenticated
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

  return (
    <>
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
    </>
  )
}
