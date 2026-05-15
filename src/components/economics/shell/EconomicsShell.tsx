'use client'

import React from 'react'
import EconomicsShellLayout from './EconomicsShellLayout'
import { useEconomicsPeriod } from './EconomicsPeriodProvider'
import { useEconomicsShell } from './EconomicsShellProvider'

type EconomicsShellProps = {
  children: React.ReactNode
  showBottomNav?: boolean
}

export default function EconomicsShell({
  children,
  showBottomNav = false,
}: EconomicsShellProps) {
  // Consume provider hooks so this shell remains bound to route-level state ownership.
  useEconomicsShell()
  useEconomicsPeriod()

  return (
    <EconomicsShellLayout showBottomNav={showBottomNav}>{children}</EconomicsShellLayout>
  )
}
