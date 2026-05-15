'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'

type DrawerContextValue = {
  drawerId: string | null
  isOpen: boolean
  openDrawer: (drawerId?: string | null) => void
  closeDrawer: () => void
  toggleDrawer: (drawerId?: string | null) => void
  setDrawerId: (drawerId: string | null) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

type DrawerProviderProps = {
  children: React.ReactNode
  initialDrawerId?: string | null
}

export function DrawerProvider({
  children,
  initialDrawerId = null,
}: DrawerProviderProps) {
  const [drawerId, setDrawerId] = useEconomicsUrlSyncedState<string | null>({
    key: 'drawer',
    defaultValue: null,
    parse: (rawValue) => rawValue?.trim() || null,
    serialize: (value) => value?.trim() || null,
    isEqual: (left, right) => left === right,
  })

  const value = useMemo<DrawerContextValue>(
    () => ({
      drawerId,
      isOpen: Boolean(drawerId),
      openDrawer: (nextDrawerId = 'default') => setDrawerId(nextDrawerId),
      closeDrawer: () => setDrawerId(null),
      toggleDrawer: (nextDrawerId = 'default') => {
        setDrawerId(drawerId === nextDrawerId ? null : nextDrawerId)
      },
      setDrawerId,
    }),
    [drawerId, setDrawerId],
  )

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

export function useBottomSheet() {
  const context = useContext(DrawerContext)
  if (!context) {
    throw new Error('useBottomSheet must be used within DrawerProvider')
  }
  return context
}
