'use client'

export default function PageLoader({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 64px)', color: 'var(--text-muted)',
      fontSize: 13, flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        width: 24, height: 24,
        border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <span>{message}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>This takes a few seconds.</span>
    </div>
  )
}