'use client'

import React, { useCallback, useState } from 'react'
import type { EconomicsExpenseSearchDto } from '@/lib/economics/types/economicsDto'
import { EconomicsExpenseSearchBar } from './EconomicsExpenseSearchBar'
import { EconomicsExpenseFilterChips } from './EconomicsExpenseFilterChips'
import type { ExpenseFilterChipId } from './EconomicsExpenseFilterChips'
import { EconomicsExpenseTotalsStrip } from './EconomicsExpenseTotalsStrip'
import { EconomicsExpenseResultList } from './EconomicsExpenseResultList'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { useSearchState } from '@/components/economics/shell/SearchStateProvider'
import { economicsSpacing } from '@/components/economics/primitives/tokens'

type EconomicsExpensesScreenProps = {
  searchData: EconomicsExpenseSearchDto | null
  total?: number
  loading?: boolean
}

/**
 * Expenses screen — search-first, lookup-first.
 *
 * Layout order:
 *   1. Search bar  (primary interaction)
 *   2. Filter chips (lightweight, secondary)
 *   3. Totals strip (contextual)
 *   4. Result list  (fast to scan)
 *
 * Finance math never lives here — totals come from props (DTO layer).
 * Search query is URL-synced via SearchStateProvider.
 */
export function EconomicsExpensesScreen({
  searchData,
  total,
  loading = false,
}: EconomicsExpensesScreenProps) {
  const { query, setQuery, clearQuery } = useSearchState()
  const [activeChip, setActiveChip] = useState<ExpenseFilterChipId>('all')

  const handleChipSelect = useCallback((id: ExpenseFilterChipId) => {
    setActiveChip(id)
  }, [])

  const results = searchData?.results ?? []

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: economicsSpacing.md,
        padding: `${economicsSpacing.md}px 0`,
        width: '100%',
      }}
    >
      {/* 1. Search bar — primary */}
      <EconomicsExpenseSearchBar
        query={query}
        onChange={setQuery}
        onClear={clearQuery}
      />

      {/* 2. Filter chips — secondary, lightweight */}
      <EconomicsExpenseFilterChips
        activeChip={activeChip}
        onSelect={handleChipSelect}
      />

      {/* 3. Totals strip — contextual, isolated boundary */}
      <AsyncBoundary area="summary">
        <EconomicsExpenseTotalsStrip
          total={total}
          count={results.length > 0 ? results.length : undefined}
          loading={loading}
        />
      </AsyncBoundary>

      {/* 4. Result list — isolated boundary.
          Result failures cannot crash the search bar or filters. */}
      <AsyncBoundary area="expenses">
        <EconomicsExpenseResultList
          results={results}
          query={query}
          loading={loading}
        />
      </AsyncBoundary>
    </div>
  )
}
