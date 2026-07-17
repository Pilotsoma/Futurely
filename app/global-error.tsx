'use client'

import { useEffect } from 'react'

// global-error.tsx catches errors thrown inside the root layout itself —
// the only errors app/error.tsx cannot catch. Per Next.js convention this
// component MUST render its own <html> and <body> tags because it completely
// replaces the root layout when triggered.

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalErrorBoundary] Root layout error:', error)
  }, [error])

  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong — myFuturely</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { height: 100%; }
          body {
            background: #0D1829;
            color: #E8EEFF;
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.55;
            -webkit-font-smoothing: antialiased;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }
          .card {
            background: #162235;
            border: 1px solid #273D5E;
            border-radius: 18px;
            padding: 40px 36px;
            max-width: 440px;
            width: 100%;
            text-align: center;
          }
          .icon-wrap {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(41, 121, 255, 0.10);
            border: 1px solid rgba(41, 121, 255, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #E8EEFF;
            margin-bottom: 12px;
            line-height: 1.3;
          }
          p {
            font-size: 14px;
            color: #96AACC;
            line-height: 1.6;
            margin-bottom: 28px;
          }
          .btn-row {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .btn-primary {
            background: #2979FF;
            color: #FFFFFF;
            border: none;
            border-radius: 12px;
            padding: 10px 24px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            font-family: inherit;
          }
          .btn-ghost {
            background: transparent;
            color: #96AACC;
            border: 1px solid #273D5E;
            border-radius: 12px;
            padding: 10px 24px;
            font-weight: 500;
            font-size: 14px;
            cursor: pointer;
            font-family: inherit;
          }
          .btn-primary:hover { background: #1B4DB0; }
          .btn-ghost:hover { color: #E8EEFF; border-color: #2F4970; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2979FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1>Something went wrong</h1>

          <p>
            myFuturely encountered an unexpected error. Try again — if the problem
            persists, reloading the page usually fixes it.
          </p>

          <div className="btn-row">
            <button className="btn-primary" onClick={() => reset()}>
              Try again
            </button>
            <button className="btn-ghost" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
