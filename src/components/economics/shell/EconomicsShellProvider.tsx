'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import type { EconomicsRouteId } from '@/lib/economics/types/economicsDto'

type EconomicsShellContextValue = {
  storeId: string | null
  activeRoute: EconomicsRouteId
  setStoreId: (storeId: string | null) => void
  setActiveRoute: (route: EconomicsRouteId) => void
}

const EconomicsShellContext = createContext<EconomicsShellContextValue | null>(null)

type EconomicsShellProviderProps = {
  children: React.ReactNode
  initialStoreId?: string | null
  initialActiveRoute?: EconomicsRouteId
}

export function EconomicsShellProvider({
  children,
  initialStoreId = null,
  initialActiveRoute = 'home',
}: EconomicsShellProviderProps) {
  const [storeId, setStoreId] = useState<string | null>(initialStoreId)
  const [activeRoute, setActiveRoute] = useState<EconomicsRouteId>(initialActiveRoute)

  const value = useMemo<EconomicsShellContextValue>(
    () => ({
      storeId,
      activeRoute,
      setStoreId,
      setActiveRoute,
    }),
    [storeId, activeRoute],
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
