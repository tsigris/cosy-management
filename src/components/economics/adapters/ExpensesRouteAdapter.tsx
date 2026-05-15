'use client'

import React, { Suspense } from 'react'
import { EconomicsExpensesScreen } from '@/components/economics/expenses'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import { AsyncBoundary, LoadingSkeleton } from '@/components/economics/primitives'
import { mapExpenseSearch } from '@/lib/economics/adapters/mapExpenseSearch'
import type { EconomicsExpenseSearchDto } from '@/lib/economics/types/economicsDto'

/**
 * Route adapter for /economics/expenses (search view).
 *
 * This is a thin wrapper that:
 * - bridges the old /economics/expenses route to the new search surface
 * - preserves the old route for deep links and browser history
 * - does NOT change finance semantics
 * - relies on the same canonical layer for all calculations
 *
 * Data is mocked here (stubs) — real integration happens via adapters.
 */
export function ExpensesRouteAdapter() {
  // For now, use stub data from adapters.
  // In production, this would fetch from Supabase via the canonical finance layer.
  
  const searchStub: EconomicsExpenseSearchDto = {
    query: '',
    results: [],
  }

  const search = mapExpenseSearch(searchStub)

  return (
    <EconomicsShell showBottomNav={true}>
      <Suspense fallback={<LoadingSkeleton lines={3} label="Φόρτωση" />}>
        <AsyncBoundary area="shell">
          <EconomicsExpensesScreen
            searchData={search}
            loading={false}
          />
        </AsyncBoundary>
      </Suspense>
    </EconomicsShell>
  )
}
