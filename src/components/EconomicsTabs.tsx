'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { CSSProperties } from 'react'

type TabItem = {
  label: string
  path: string
}

const tabs: TabItem[] = [
  { label: 'Ταμειακή ροή', path: '/economics/cashflow' },
  { label: 'Δαπάνες', path: '/economics/expenses' },
  { label: 'Πιστώσεις', path: '/economics/credits' },
  { label: 'Αναφορές', path: '/economics/reports' },
  { label: 'Πληρωμές', path: '/economics/scheduled-payments' },
]

export default function EconomicsTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const withQueryParams = (path: string) => {
    // κρατάμε ΟΛΑ τα query params (store, date, range, κλπ)
    const qs = searchParams?.toString() || ''
    return qs ? `${path}?${qs}` : path
  }

  const isActivePath = (tabPath: string) => {
    // exact match (όπως πριν) + safe support για nested routes
    return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
  }

  return (
    <div style={tabsStickyWrap}>
      <div style={tabsScroller}>
        {tabs.map((tab) => {
          const isActive = isActivePath(tab.path)
          return (
            <Link
              key={tab.path}
              href={withQueryParams(tab.path)}
              style={{ ...tabBtn, ...(isActive ? tabBtnActive : null) }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const tabsStickyWrap: CSSProperties = {
  position: 'sticky',
  top: 12,
  zIndex: 20,
  marginBottom: 14,
  padding: 8,
  borderRadius: 18,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.06)',
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
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#0f172a',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 900,
  transition: 'all 150ms ease',
}

const tabBtnActive: CSSProperties = {
  background: '#0f172a',
  color: '#ffffff',
  border: '1px solid #0f172a',
  boxShadow: '0 8px 16px rgba(15, 23, 42, 0.2)',
}