import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NextStep — AI Academic Companion',
  description: 'NextStep helps high school students track grades, plan assignments, and prepare for college.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
