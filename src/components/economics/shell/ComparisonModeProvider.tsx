'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'

export type EconomicsComparisonMode = 'calendar' | 'weekday'

type ComparisonModeContextValue = {
  comparisonMode: EconomicsComparisonMode
  setComparisonMode: (mode: EconomicsComparisonMode) => void
}

const ComparisonModeContext = createContext<ComparisonModeContextValue | null>(null)

type ComparisonModeProviderProps = {
  children: React.ReactNode
  initialComparisonMode?: EconomicsComparisonMode
}

function parseComparisonMode(rawValue: string | null): EconomicsComparisonMode {
  return rawValue === 'weekday' ? 'weekday' : 'calendar'
}

export function ComparisonModeProvider({
  children,
  initialComparisonMode = 'calendar',
}: ComparisonModeProviderProps) {
  const [comparisonMode, setComparisonMode] = useEconomicsUrlSyncedState<EconomicsComparisonMode>({
    key: 'compare',
    defaultValue: 'calendar',
    parse: parseComparisonMode,
    serialize: (value) => value,
    isEqual: (left, right) => left === right,
  })

  const value = useMemo<ComparisonModeContextValue>(
    () => ({
      comparisonMode,
      setComparisonMode,
    }),
    [comparisonMode, setComparisonMode],
  )

  return <ComparisonModeContext.Provider value={value}>{children}</ComparisonModeContext.Provider>
}

export function useComparisonMode() {
  const context = useContext(ComparisonModeContext)
  if (!context) {
    throw new Error('useComparisonMode must be used within ComparisonModeProvider')
  }
  return context
}
