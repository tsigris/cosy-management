'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'

type SelectedDayContextValue = {
  selectedDay: string | null
  setSelectedDay: (day: string | null) => void
}

const SelectedDayContext = createContext<SelectedDayContextValue | null>(null)

function isValidDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

type SelectedDayProviderProps = {
  children: React.ReactNode
  initialSelectedDay?: string | null
}

export function SelectedDayProvider({
  children,
  initialSelectedDay = null,
}: SelectedDayProviderProps) {
  const [selectedDay, setSelectedDay] = useEconomicsUrlSyncedState<string | null>({
    key: 'date',
    defaultValue: null,
    parse: (rawValue) => (isValidDateKey(rawValue) ? rawValue : null),
    serialize: (value) => (isValidDateKey(value) ? value : null),
    isEqual: (left, right) => left === right,
  })

  const value = useMemo<SelectedDayContextValue>(
    () => ({
      selectedDay,
      setSelectedDay,
    }),
    [selectedDay, setSelectedDay],
  )

  return <SelectedDayContext.Provider value={value}>{children}</SelectedDayContext.Provider>
}

export function useSelectedDay() {
  const context = useContext(SelectedDayContext)
  if (!context) {
    throw new Error('useSelectedDay must be used within SelectedDayProvider')
  }
  return context
}
