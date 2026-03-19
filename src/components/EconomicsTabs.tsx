'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import {
  Wallet,
  TrendingDown,
  Receipt,
  BarChart3,
  CalendarDays,
  LineChart,
  Coins,
  Users,
} from 'lucide-react'

type TabItem = {
  label: string
  path: string
  Icon: any
}

const tabs: TabItem[] = [
  { label: 'Έσοδα', path: '/economics/income', Icon: Coins },
  { label: 'Ταμειακή Ροή', path: '/economics/cashflow', Icon: Wallet },
  { label: 'Δαπάνες', path: '/economics/expenses', Icon: TrendingDown },
  { label: 'Πιστώσεις', path: '/economics/credits', Icon: Receipt },
  { label: 'Αναφορές', path: '/economics/reports', Icon: BarChart3 },
  { label: 'Πληρωμές', path: '/economics/scheduled-payments', Icon: CalendarDays },
  { label: 'Ανάλυση', path: '/economics/analysis', Icon: LineChart },
  { label: 'Κέρδος', path: '/economics/profit', Icon: LineChart },
  { label: 'Μισθοδοσία %', path: '/economics/payroll-percent', Icon: Users },
]

export default function EconomicsTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTabRef = useRef<HTMLAnchorElement | null>(null)

  const withQueryParams = (path: string) => {
    const qs = searchParams?.toString() || ''
    return qs ? `${path}?${qs}` : path
  }

  const isActivePath = (tabPath: string) => {
    return pathname === tabPath || pathname?.startsWith(`${tabPath}/`)
  }

  useEffect(() => {
    if (!activeTabRef.current) return

    activeTabRef.current.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [pathname])

  return (
    <div style={tabsStickyWrap}>
      <div style={tabsScroller}>
        {tabs.map((tab) => {
          const isActive = isActivePath(tab.path)
          const Icon = tab.Icon

          return (
            <Link
              key={tab.path}
              href={withQueryParams(tab.path)}
              ref={isActive ? activeTabRef : null}
              style={{ ...tabBtn, ...(isActive ? tabBtnActive : null) }}
            >
              <div style={tabInner}>
                <Icon size={20} style={{ marginBottom: 6 }} />
                <div style={tabLabel}>{tab.label}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const tabsStickyWrap: CSSProperties = {
  position: 'sticky',
  top: 72,
  zIndex: 20,
  marginBottom: 14,
  padding: 8,
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  backdropFilter: 'blur(6px)',
  boxShadow: 'var(--shadow)',
}

const tabsScroller: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  whiteSpace: 'nowrap',
}

const tabBtn: CSSProperties = {
  flex: '0 0 auto',
  textDecoration: 'none',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--surfaceSolid)',
  color: 'var(--text)',
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 900,
  transition: 'all 150ms ease',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const tabBtnActive: CSSProperties = {
  background: 'var(--text)',
  color: 'var(--surfaceSolid)',
  border: '1px solid var(--text)',
  boxShadow: 'var(--shadow)',
}

const tabInner: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0,
}

const tabLabel: CSSProperties = {
  fontSize: 11,
  lineHeight: '12px',
}