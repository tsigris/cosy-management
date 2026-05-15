'use client'

import React, { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { EconomicsBottomNav } from './EconomicsBottomNav'
import { useEconomicsShell } from './EconomicsShellProvider'
import { mapShellNavigation } from '@/lib/economics/adapters/mapShellNavigation'
import type { EconomicsNavigationItemDto } from '@/lib/economics/types/economicsDto'

type EconomicsShellLayoutProps = {
  children: React.ReactNode
  showBottomNav?: boolean
  className?: string
  style?: React.CSSProperties
}

const NAV_ITEMS: EconomicsNavigationItemDto[] = [
  { id: 'home', label: 'Home', href: '/economics/home' },
  { id: 'days', label: 'Days', href: '/economics/days' },
  { id: 'expenses', label: 'Expenses', href: '/economics/expenses' },
  { id: 'comparisons', label: 'Comparisons', href: '/economics/comparisons' },
  { id: 'advanced', label: 'Advanced', href: '/economics/advanced' },
]

const SECTION_LABELS: Record<string, string> = {
  '/economics/home': 'Επισκόπηση',
  '/economics/days': 'Ημέρες',
  '/economics/expenses': 'Δαπάνες',
  '/economics/comparisons': 'Συγκρίσεις',
  '/economics/advanced': 'Αναφορές',
}

function ShellHeader({ pathname }: { pathname: string | null }) {
  const section =
    (pathname && SECTION_LABELS[pathname]) ??
    Object.entries(SECTION_LABELS).find(([k]) => pathname?.startsWith(k))?.[1] ??
    'Οικονομικά'

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        padding: '14px 0 10px',
        background: 'var(--surface, #fff)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        backdropFilter: 'blur(10px)',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          lineHeight: 1.1,
        }}
      >
        {section}
      </div>
    </div>
  )
}

export default function EconomicsShellLayout({
  children,
  showBottomNav = true,
  className,
  style,
}: EconomicsShellLayoutProps) {
  const { activeRoute } = useEconomicsShell()
  const pathname = usePathname()

  const navItems = useMemo(
    () => mapShellNavigation(NAV_ITEMS, activeRoute),
    [activeRoute],
  )

  return (
    <div className={className} style={style}>
      <EconomicsContainer>
        <ShellHeader pathname={pathname} />
        {children}
      </EconomicsContainer>
      <EconomicsBottomNav
        items={navItems}
        visible={showBottomNav}
      />
    </div>
  )
}
