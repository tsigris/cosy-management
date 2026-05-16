'use client'

import React, { useEffect, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { EconomicsShellProvider, useEconomicsShell } from './EconomicsShellProvider'
import { EconomicsPeriodProvider } from './EconomicsPeriodProvider'
import { SelectedDayProvider } from './SelectedDayProvider'
import { DrawerProvider } from './DrawerProvider'
import { ComparisonModeProvider } from './ComparisonModeProvider'
import { SearchStateProvider } from './SearchStateProvider'
import type { EconomicsPeriodId, EconomicsRouteId } from '@/lib/economics/types/economicsDto'
import type { EconomicsComparisonMode } from './ComparisonModeProvider'

function isValidDateKey(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

function parsePeriod(rawValue: string | null): EconomicsPeriodId {
  return rawValue === 'year' || rawValue === '30days' || rawValue === 'all' ? rawValue : 'month'
}

function parseYear(rawValue: string | null) {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : new Date().getFullYear()
}

function resolveActiveRoute(pathname: string | null): EconomicsRouteId {
  if (!pathname || pathname === '/economics') return 'home'
  if (pathname.startsWith('/economics/expenses')) return 'expenses'
  if (pathname.startsWith('/economics/analysis') || pathname.startsWith('/economics/reports')) return 'comparisons'
  if (pathname.startsWith('/economics/scheduled-payments') || pathname.startsWith('/economics/payroll-percent')) {
    return 'days'
  }
  if (pathname.startsWith('/economics/cashflow') || pathname.startsWith('/economics/income')) return 'home'
  return 'advanced'
}

type EconomicsRouteProvidersProps = {
  children: React.ReactNode
}

function EconomicsShellUrlSync({
  pathname,
  storeId,
}: {
  pathname: string | null
  storeId: string | null
}) {
  const { activeRoute, setActiveRoute, storeId: activeStoreId, setStoreId } = useEconomicsShell()

  useEffect(() => {
    const nextRoute = resolveActiveRoute(pathname)
    if (activeRoute !== nextRoute) {
      setActiveRoute(nextRoute)
    }
  }, [activeRoute, pathname, setActiveRoute])

  useEffect(() => {
    if (activeStoreId !== storeId) {
      setStoreId(storeId)
    }
  }, [activeStoreId, setStoreId, storeId])

  return null
}

export function EconomicsRouteProviders({ children }: EconomicsRouteProvidersProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Extract individual primitives from searchParams so useMemo deps are stable strings,
  // not the searchParams object reference (which changes on every URL update).
  const storeParam = searchParams?.get('store')?.trim() || null
  const periodParam = searchParams?.get('period') || null
  const yearParam = searchParams?.get('year') || null
  const dateParam = searchParams?.get('date') || null
  const drawerParam = searchParams?.get('drawer')?.trim() || null
  const compareParam = searchParams?.get('compare') || null
  const queryParam = searchParams?.get('q')?.trim() || ''

  const initialValues = useMemo(() => {
    const storeId = storeParam
    const period = parsePeriod(periodParam)
    const year = parseYear(yearParam)
    const selectedDay = isValidDateKey(dateParam) ? dateParam : null
    const drawerId = drawerParam
    const comparisonMode: EconomicsComparisonMode =
      compareParam === 'weekday' ? 'weekday' : 'calendar'
    const query = queryParam

    return {
      storeId,
      activeRoute: resolveActiveRoute(pathname),
      period,
      year,
      selectedDay,
      drawerId,
      comparisonMode,
      query,
    }
  }, [pathname, storeParam, periodParam, yearParam, dateParam, drawerParam, compareParam, queryParam])

  return (
    <EconomicsShellProvider initialStoreId={initialValues.storeId} initialActiveRoute={initialValues.activeRoute}>
      <EconomicsShellUrlSync pathname={pathname} storeId={initialValues.storeId} />
      <EconomicsPeriodProvider initialPeriod={initialValues.period} initialSelectedYear={initialValues.year}>
        <SelectedDayProvider initialSelectedDay={initialValues.selectedDay}>
          <DrawerProvider initialDrawerId={initialValues.drawerId}>
            <ComparisonModeProvider initialComparisonMode={initialValues.comparisonMode}>
              <SearchStateProvider initialQuery={initialValues.query}>{children}</SearchStateProvider>
            </ComparisonModeProvider>
          </DrawerProvider>
        </SelectedDayProvider>
      </EconomicsPeriodProvider>
    </EconomicsShellProvider>
  )
}
