'use client'

import React from 'react'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'
import { EconomicsHomeSummarySection } from './EconomicsHomeSummarySection'
import { EconomicsYoYStrip } from './EconomicsYoYStrip'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { economicsSpacing } from '@/components/economics/primitives/tokens'

type EconomicsHomeScreenProps = {
  summary: EconomicsHomeSummaryDto | null
  comparison: EconomicsComparisonDto | null
  summaryLoading?: boolean
  comparisonLoading?: boolean
}

/**
 * Home screen — operator landing page.
 *
 * One screen, three questions:
 *   1. How is today going?
 *   2. How is this month going?
 *   3. Are we above or below last year?
 *
 * Each section has its own AsyncBoundary so failures remain isolated.
 */
export function EconomicsHomeScreen({
  summary,
  comparison,
  summaryLoading = false,
  comparisonLoading = false,
}: EconomicsHomeScreenProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: economicsSpacing.lg,
        padding: `${economicsSpacing.md}px 0`,
        width: '100%',
      }}
    >
      {/* Priority 1 + 2: Today & Month summary — isolated boundary */}
      <AsyncBoundary area="summary">
        <EconomicsHomeSummarySection summary={summary} loading={summaryLoading} />
      </AsyncBoundary>

      {/* Priority 3: YoY comparison strip — isolated boundary.
          A comparison failure cannot crash the summary above. */}
      <AsyncBoundary area="comparison">
        <EconomicsYoYStrip comparison={comparison} loading={comparisonLoading} />
      </AsyncBoundary>
    </div>
  )
}
