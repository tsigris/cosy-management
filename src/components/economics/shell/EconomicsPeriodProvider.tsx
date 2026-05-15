'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'
import type { EconomicsPeriodId } from '@/lib/economics/types/economicsDto'

type EconomicsPeriodContextValue = {
  period: EconomicsPeriodId
  selectedYear: number
  setPeriod: (period: EconomicsPeriodId) => void
  setSelectedYear: (year: number) => void
}

const EconomicsPeriodContext = createContext<EconomicsPeriodContextValue | null>(null)

const PERIOD_VALUES: EconomicsPeriodId[] = ['month', 'year', '30days', 'all']

function parsePeriod(rawValue: string | null): EconomicsPeriodId {
  if (rawValue && PERIOD_VALUES.includes(rawValue as EconomicsPeriodId)) {
    return rawValue as EconomicsPeriodId
  }
  return 'month'
}

function parseYear(rawValue: string | null, fallback: number) {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

type EconomicsPeriodProviderProps = {
  children: React.ReactNode
  initialPeriod?: EconomicsPeriodId
  initialSelectedYear?: number
}

export function EconomicsPeriodProvider({
  children,
  initialPeriod = 'month',
  initialSelectedYear = new Date().getFullYear(),
}: EconomicsPeriodProviderProps) {
  const [period, setPeriod] = useEconomicsUrlSyncedState<EconomicsPeriodId>({
    key: 'period',
    defaultValue: 'month',
    parse: parsePeriod,
    serialize: (value) => value,
  })

  const [selectedYear, setSelectedYear] = useEconomicsUrlSyncedState<number>({
    key: 'year',
    defaultValue: new Date().getFullYear(),
    parse: (rawValue) => parseYear(rawValue, initialSelectedYear),
    serialize: (value) => (Number.isFinite(value) ? String(Math.floor(value)) : null),
  })

  const value = useMemo<EconomicsPeriodContextValue>(
    () => ({
      period,
      selectedYear,
      setPeriod,
      setSelectedYear,
    }),
    [period, selectedYear, setPeriod, setSelectedYear],
  )

  return <EconomicsPeriodContext.Provider value={value}>{children}</EconomicsPeriodContext.Provider>
}

export function useEconomicsPeriod() {
  const context = useContext(EconomicsPeriodContext)
  if (!context) {
    throw new Error('useEconomicsPeriod must be used within EconomicsPeriodProvider')
  }
  return context
}
