import type { Metadata } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
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
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF8F5" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ns_theme')||'light';document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('ns_grade_colors')==='false')document.documentElement.setAttribute('data-grade-colors','off');}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
