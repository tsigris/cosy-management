'use client'

import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'
import type { EconomicsPeriodId } from '@/lib/economics/types/economicsDto'
import { addDaysToDateKey, getTodayDateKey } from '@/lib/financialPeriods'

type EconomicsPeriodContextValue = {
  period: EconomicsPeriodId
  selectedYear: number
  fromDate: string
  toDate: string
  setPeriod: (period: EconomicsPeriodId) => void
  setSelectedYear: (year: number) => void
  setFromDate: (dateKey: string) => void
  setToDate: (dateKey: string) => void
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

function isValidDateKey(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

function parseDateKey(rawValue: string | null, fallback: string) {
  return isValidDateKey(rawValue) ? rawValue : fallback
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
  const today = getTodayDateKey()
  // Operator default window: yesterday -> today (only when URL has no explicit dates).
  const fallbackFrom = addDaysToDateKey(today, -1)

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

  const [fromDate, setFromDate] = useEconomicsUrlSyncedState<string>({
    key: 'from',
    defaultValue: fallbackFrom,
    parse: (rawValue) => parseDateKey(rawValue, fallbackFrom),
    serialize: (value) => (isValidDateKey(value) ? value : null),
  })

  const [toDate, setToDate] = useEconomicsUrlSyncedState<string>({
    key: 'to',
    defaultValue: today,
    parse: (rawValue) => parseDateKey(rawValue, today),
    serialize: (value) => (isValidDateKey(value) ? value : null),
  })

  const commitFromDate = useCallback(
    (dateKey: string) => {
      if (!isValidDateKey(dateKey)) {
        console.warn('[EconomicsPeriodProvider] Ignored invalid from date commit:', dateKey)
        return
      }
      setFromDate(dateKey)
    },
    [setFromDate],
  )

  const commitToDate = useCallback(
    (dateKey: string) => {
      if (!isValidDateKey(dateKey)) {
        console.warn('[EconomicsPeriodProvider] Ignored invalid to date commit:', dateKey)
        return
      }
      setToDate(dateKey)
    },
    [setToDate],
  )

  const value = useMemo<EconomicsPeriodContextValue>(
    () => ({
      period,
      selectedYear,
      fromDate,
      toDate,
      setPeriod,
      setSelectedYear,
      setFromDate: commitFromDate,
      setToDate: commitToDate,
    }),
    [period, selectedYear, fromDate, toDate, setPeriod, setSelectedYear, commitFromDate, commitToDate],
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
