'use client'

import React, { Suspense } from 'react'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton, EmptyState } from '@/components/economics/primitives'
import { EconomicsYoYStrip } from '@/components/economics/home/EconomicsYoYStrip'
import { economicsSpacing } from '@/components/economics/primitives/tokens'

/**
 * /economics/comparisons - contextual comparison blocks.
 *
 * Answers: Are we above or below last year? Period over period?
 *
 * This surface will grow to include:
 *   - Year-over-year revenue
 *   - Period comparisons
 *   - Store benchmarks
 *
 * Currently shows YoY strip as the primary comparison surface.
 * Full data wiring is a future phase.
 */
export default function EconomicsComparisonsPage() {
  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Fotosi sygkriseon" />}>
        <AsyncBoundary area="comparison">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: economicsSpacing.lg,
              paddingTop: economicsSpacing.sm,
            }}
          >
            <EconomicsYoYStrip comparison={null} loading={false} />

            <EmptyState
              title="Synkriseis"
              description="Perissoteres synkriseis erxontai syntoma."
            />
          </div>
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}