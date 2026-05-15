'use client'

import { IncomeRouteAdapter } from '@/components/economics/adapters'

/**
 * /economics/home — primary operational landing.
 *
 * Answers:
 *   1. How is today going?
 *   2. How is this month going?
 *   3. Are we above or below last year?
 *
 * Thin wrapper. All data & logic lives in the canonical layer.
 */
export default function EconomicsHomePage() {
  return <IncomeRouteAdapter />
}
