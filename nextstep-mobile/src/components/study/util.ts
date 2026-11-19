import { useCallback, useEffect, useRef } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { GENERIC_ERROR_MESSAGE, toUserMessage } from '../../utils/errorMessage'

/** Study-screen alias for the shared mapper: never surfaces raw server or developer text. */
export function errorMessage(err: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  return toUserMessage(err, fallback)
}

/**
 * Runs `tick` every `intervalMs` while the screen is focused and mounted; the interval is
 * cleared on blur and unmount. `tick` is read through a ref so it can change freely
 * without restarting the timer. Pass `enabled=false` to pause (e.g. once a game ends).
 */
export function useFocusedInterval(tick: () => void, intervalMs: number, enabled = true): void {
  const tickRef = useRef(tick)
  useEffect(() => {
    tickRef.current = tick
  })

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined
      const id = setInterval(() => tickRef.current(), intervalMs)
      return () => clearInterval(id)
    }, [intervalMs, enabled]),
  )
}
