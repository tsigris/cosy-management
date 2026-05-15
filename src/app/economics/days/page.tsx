'use client'

import { AnalysisRouteAdapter } from '@/components/economics/adapters'

/**
 * /economics/days — primary days workflow.
 *
 * Month calendar with selectable day cells.
 * Performance coloring, day drawer, swipe-friendly inspection.
 *
 * Thin wrapper. All data & logic lives in the canonical layer.
 */
export default function EconomicsDaysPage() {
  return <AnalysisRouteAdapter />
}
