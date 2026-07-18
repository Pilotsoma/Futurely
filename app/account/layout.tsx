import React from 'react'

// Minimal layout for account recovery screens (DOB lock, access restriction).
// Intentionally has no sidebar, navigation, or AI chat — just a centered
// full-viewport container using the app's existing CSS variables.

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      {children}
    </div>
  )
}
