import { useEffect, useState } from 'react'
import { useDisplayPreferences } from '../preferences/displayPreferences'

// Mirrors web's useCountUp/useCountUpFloat (app/(app)/dashboard/page.tsx) —
// an eased count-up so numbers "land" with a bit of life instead of just
// appearing. Re-runs whenever `target` changes (e.g. on every focus refetch).

export function useCountUp(target: number | null, duration = 700): number {
  const [val, setVal] = useState(0)
  const { reduceMotion } = useDisplayPreferences()
  const instant = reduceMotion || target === null || target === 0

  useEffect(() => {
    if (instant) return
    const goal = target
    const start = Date.now()
    let raf: ReturnType<typeof requestAnimationFrame>
    function tick(): void {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(goal * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, instant])

  return instant ? (target ?? 0) : val
}

export function useCountUpFloat(target: number | null, duration = 900): number {
  const [val, setVal] = useState(0)
  const { reduceMotion } = useDisplayPreferences()
  const instant = reduceMotion || target === null

  useEffect(() => {
    if (instant) return
    const goal = target
    const start = Date.now()
    let raf: ReturnType<typeof requestAnimationFrame>
    function tick(): void {
      const p = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(goal * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, instant])

  return instant ? (target ?? 0) : val
}
