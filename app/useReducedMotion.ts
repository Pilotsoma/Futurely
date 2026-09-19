'use client'

import { useEffect, useState } from 'react'

// Chromebook-safe reduced-motion detection shared by the landing page's
// particle background and rotating headline — mirrors the OS-level
// prefers-reduced-motion setting and falls back to disabling heavy motion
// on low-end CPUs (<=4 logical cores).
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lowEndCpu = (navigator.hardwareConcurrency ?? 8) <= 4
    if (prefersReduced || lowEndCpu) setReduceMotion(true)
  }, [])

  return reduceMotion
}
