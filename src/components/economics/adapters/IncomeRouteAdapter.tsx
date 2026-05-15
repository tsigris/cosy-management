'use client'

import React, { Suspense } from 'react'
import { EconomicsHomeScreen } from '@/components/economics/home'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import { mapHomeSummary } from '@/lib/economics/adapters/mapHomeSummary'
import { mapComparisonSummary } from '@/lib/economics/adapters/mapComparisonSummary'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'

/**
 * Route adapter for /economics/income (home view).
 *
 * This is a thin wrapper that:
 * - bridges the old /economics/income route to the new home surface
 * - preserves the old route for deep links and browser history
 * - does NOT change finance semantics
 * - relies on the same canonical layer for all calculations
 *
 * Data is mocked here (stubs) — real integration happens via adapters.
 */
export function IncomeRouteAdapter() {
  // For now, use stub data from adapters.
  // In production, this would fetch from Supabase via the canonical finance layer.
  
  const summaryStub: EconomicsHomeSummaryDto = {
    todayLabel: 'Σήμερα',
    todayRevenue: undefined,
    todayProfit: undefined,
  }

  const comparisonStub: EconomicsComparisonDto = {
    periodLabel: undefined,
    previousPeriodLabel: undefined,
  }

  const summary = mapHomeSummary(summaryStub)
  const comparison = mapComparisonSummary(comparisonStub)

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsHomeScreen
            summary={summary}
            comparison={comparison}
            summaryLoading={false}
            comparisonLoading={false}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}
