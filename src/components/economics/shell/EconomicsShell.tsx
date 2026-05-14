'use client'

import React from 'react'
import { EconomicsShellProvider } from './EconomicsShellProvider'
import EconomicsShellLayout from './EconomicsShellLayout'
import type { EconomicsPeriodId, EconomicsRouteId } from '@/lib/economics/types/economicsDto'

type EconomicsShellProps = {
  children: React.ReactNode
  storeId?: string | null
  activeRoute?: EconomicsRouteId
  activePeriod?: EconomicsPeriodId
  selectedDate?: string | null
  showBottomNav?: boolean
}

export default function EconomicsShell({
  children,
  storeId = null,
  activeRoute = 'home',
  activePeriod = 'month',
  selectedDate = null,
  showBottomNav = false,
}: EconomicsShellProps) {
  return (
    <EconomicsShellProvider
      initialStoreId={storeId}
      initialActiveRoute={activeRoute}
      initialActivePeriod={activePeriod}
      initialSelectedDate={selectedDate}
    >
      <EconomicsShellLayout showBottomNav={showBottomNav}>{children}</EconomicsShellLayout>
    </EconomicsShellProvider>
  )
}
