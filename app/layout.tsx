import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Futurely — AI Academic Companion',
  description: 'Futurely helps high school students track grades, plan assignments, and prepare for college.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0F0D0A" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ns_theme')||'dark';document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('ns_grade_colors')==='false')document.documentElement.setAttribute('data-grade-colors','off');}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
