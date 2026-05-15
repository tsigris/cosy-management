'use client'

import React, { useMemo } from 'react'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { EconomicsBottomNav } from './EconomicsBottomNav'
import { useEconomicsShell } from './EconomicsShellProvider'
import { mapShellNavigation } from '@/lib/economics/adapters/mapShellNavigation'
import type { EconomicsNavigationItemDto } from '@/lib/economics/types/economicsDto'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'

type EconomicsShellLayoutProps = {
  children: React.ReactNode
  showBottomNav?: boolean
  className?: string
  style?: React.CSSProperties
}

const NAV_ITEMS: EconomicsNavigationItemDto[] = [
  { id: 'home', label: 'Home', href: '/economics' },
  { id: 'days', label: 'Days', href: '/economics/days' },
  { id: 'expenses', label: 'Expenses', href: '/economics/expenses' },
  { id: 'comparisons', label: 'Comparisons', href: '/economics/comparisons' },
  { id: 'advanced', label: 'Advanced', href: '/economics/advanced' },
]

export default function EconomicsShellLayout({
  children,
  showBottomNav = false,
  className,
  style,
}: EconomicsShellLayoutProps) {
  const { activeRoute } = useEconomicsShell()

  const navItems = useMemo(
    () => mapShellNavigation(NAV_ITEMS, activeRoute),
    [activeRoute],
  )

  return (
    <div className={className} style={style}>
      <EconomicsContainer>
        <AsyncBoundary area="shell" loadingFallback={<LoadingSkeleton lines={2} label="Φόρτωση shell" />}>
          {children}
        </AsyncBoundary>
      </EconomicsContainer>
      <EconomicsBottomNav
        items={navItems}
        onNavigate={() => {
          return
        }}
        visible={showBottomNav}
      />
    </div>
  )
}
