'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import type { EconomicsPeriodId, EconomicsRouteId } from '@/lib/economics/types/economicsDto'

type EconomicsShellContextValue = {
  storeId: string | null
  activeRoute: EconomicsRouteId
  activePeriod: EconomicsPeriodId
  selectedDate: string | null
  setStoreId: (storeId: string | null) => void
  setActiveRoute: (route: EconomicsRouteId) => void
  setActivePeriod: (period: EconomicsPeriodId) => void
  setSelectedDate: (date: string | null) => void
}

const EconomicsShellContext = createContext<EconomicsShellContextValue | null>(null)

type EconomicsShellProviderProps = {
  children: React.ReactNode
  initialStoreId?: string | null
  initialActiveRoute?: EconomicsRouteId
  initialActivePeriod?: EconomicsPeriodId
  initialSelectedDate?: string | null
}

export function EconomicsShellProvider({
  children,
  initialStoreId = null,
  initialActiveRoute = 'home',
  initialActivePeriod = 'month',
  initialSelectedDate = null,
}: EconomicsShellProviderProps) {
  const [storeId, setStoreId] = useState<string | null>(initialStoreId)
  const [activeRoute, setActiveRoute] = useState<EconomicsRouteId>(initialActiveRoute)
  const [activePeriod, setActivePeriod] = useState<EconomicsPeriodId>(initialActivePeriod)
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelectedDate)

  const value = useMemo<EconomicsShellContextValue>(
    () => ({
      storeId,
      activeRoute,
      activePeriod,
      selectedDate,
      setStoreId,
      setActiveRoute,
      setActivePeriod,
      setSelectedDate,
    }),
    [storeId, activeRoute, activePeriod, selectedDate],
  )

  return <EconomicsShellContext.Provider value={value}>{children}</EconomicsShellContext.Provider>
}

export function useEconomicsShell() {
  const context = useContext(EconomicsShellContext)
  if (!context) {
    throw new Error('useEconomicsShell must be used within EconomicsShellProvider')
  }
  return context
}
