'use client'

import React, { Suspense } from 'react'
import { EconomicsHomeScreen } from '@/components/economics/home'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import { mapHomeSummary } from '@/lib/economics/adapters/mapHomeSummary'
import { mapComparisonSummary } from '@/lib/economics/adapters/mapComparisonSummary'
import { buildHomeDisplay } from '@/lib/economics/adapters/buildHomeDisplay'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'

/**
 * Route adapter for /economics/income (home view).
 *
 * This is a thin wrapper that:
 * - bridges the old /economics/income route to the new home surface
 * - enriches canonical data with display-layer comparisons
 * - preserves the old route for deep links and browser history
 * - does NOT change finance semantics
 * - relies on the same canonical layer for all calculations
 *
 * Data is mocked here (stubs) — real integration happens via adapters.
 */
export function IncomeRouteAdapter() {
  // Stub canonical data from adapters.
  // In production, this would fetch from Supabase via the canonical finance layer.
  
  const summaryStub: EconomicsHomeSummaryDto = {
    todayLabel: 'Σήμερα',
    todayRevenue: 1500,
    todayProfit: 420,
    monthRevenue: 38000,
    monthProfit: 9800,
    cashRevenue: 600,
    cardRevenue: 900,
    bestDayLabel: 'Τετάρτη 13/05',
    worstDayLabel: 'Δευτέρα 11/05',
  }

  const comparisonStub: EconomicsComparisonDto = {
    periodLabel: 'Μάιος 2026',
    previousPeriodLabel: 'Μάιος 2025',
    currentTotal: 38000,
    previousTotal: 34000,
    delta: 4000,
    deltaPct: 11.8,
  }

  const summary = mapHomeSummary(summaryStub)
  const comparison = mapComparisonSummary(comparisonStub)

  // Enrich with display-layer comparisons for timeline narrative
  // In production: fetch yesterday + last month from canonical layer
  const displaySummary = buildHomeDisplay(summary, {
    yesterdayRevenue: 1200,  // Stub — would come from canonical layer
    yesterdayProfit: 320,    // Stub — would come from canonical layer
    lastMonthRevenue: 34000,
    lastMonthProfit: 8200,
  })

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsHomeScreen
            summary={displaySummary}
            comparison={comparison}
            summaryLoading={false}
            comparisonLoading={false}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}
