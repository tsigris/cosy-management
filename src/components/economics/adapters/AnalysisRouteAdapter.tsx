'use client'

import React, { Suspense } from 'react'
import { EconomicsCalendarMonth } from '@/components/economics/calendar'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import type { EconomicsCalendarSeriesDto, EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'

/**
 * Route adapter for /economics/analysis (calendar view).
 *
 * This is a thin wrapper that:
 * - bridges the old /economics/analysis route to the new calendar surface
 * - preserves the old route for deep links and browser history
 * - does NOT change finance semantics
 * - relies on the same canonical layer for all calculations
 *
 * Data is mocked here (stubs) — real integration happens via adapters.
 */
export function AnalysisRouteAdapter() {
  // For now, use stub data.
  // In production, this would fetch from Supabase via the canonical finance layer.
  
  const seriesStub: EconomicsCalendarSeriesDto = {
    monthLabel: undefined,
    days: [],
  }

  const detailStub: EconomicsDayDetailDto | null = null

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={5} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsCalendarMonth
            series={seriesStub}
            dayDetail={detailStub}
            calendarLoading={false}
            detailLoading={false}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}
