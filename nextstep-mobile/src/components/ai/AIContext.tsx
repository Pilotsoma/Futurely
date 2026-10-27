/**
 * Usage (from any screen inside MainNavigator):
 *
 *   useAIContext('Chem grades', 'Explain my current grade in Chemistry and what I need to raise it')
 *
 * Registers what the student is looking at while the screen is focused; it is cleared on blur.
 * The floating AI button shows the label as a chip and opens AIChat with the prompt.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'

import { clearContext, registerContext, type AIContextEntry } from './aiContextState'

type Ctx = {
  current: AIContextEntry | null
  set: (entry: AIContextEntry | null) => void
  clear: (owner: AIContextEntry | null) => void
}

const AIContextValue = createContext<Ctx>({ current: null, set: () => {}, clear: () => {} })

export function AIContextProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<AIContextEntry | null>(null)
  const clear = useCallback(
    (owner: AIContextEntry | null) => setCurrent((c) => clearContext(c, owner)),
    [],
  )
  const value = useMemo(() => ({ current, set: setCurrent, clear }), [current, clear])
  return <AIContextValue.Provider value={value}>{children}</AIContextValue.Provider>
}

export function useCurrentAIContext(): AIContextEntry | null {
  return useContext(AIContextValue).current
}

export function useAIContext(label: string, prompt: string): void {
  const { set, clear } = useContext(AIContextValue)
  useFocusEffect(
    useCallback(() => {
      const entry = registerContext(label, prompt)
      set(entry)
      return () => clear(entry)
    }, [label, prompt, set, clear]),
  )
}
