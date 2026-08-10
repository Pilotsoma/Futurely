'use client'

import { useEffect, useState } from 'react'

// The single source of truth for the Settings → Appearance → "Reduce
// animations" toggle. Stored under the short key 'rm' (pre-existing, kept
// for compatibility with the inline <script> in app/layout.tsx that applies
// the .reduce-motion class before hydration).
const STORAGE_KEY = 'rm'
const CHANGE_EVENT = 'ns:motion-pref-changed'

export function isReducedMotionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setReducedMotionEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  document.documentElement.classList.toggle('reduce-motion', enabled)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Combines the user's explicit in-app choice with the OS-level
// prefers-reduced-motion setting — either one should be enough to skip
// heavy/decorative effects (particle backgrounds, entrance stagger
// animations, glow pulses, etc.), not just the marketplace cosmetic
// animations the .reduce-motion CSS class originally targeted.
export function usePerformanceMode(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compute = () => setReduced(isReducedMotionEnabled() || mq.matches)
    compute()
    window.addEventListener(CHANGE_EVENT, compute)
    window.addEventListener('storage', compute)
    mq.addEventListener('change', compute)
    return () => {
      window.removeEventListener(CHANGE_EVENT, compute)
      window.removeEventListener('storage', compute)
      mq.removeEventListener('change', compute)
    }
  }, [])

  return reduced
}
