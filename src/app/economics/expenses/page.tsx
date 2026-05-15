'use client'

import { ExpensesRouteAdapter } from '@/components/economics/adapters'

/**
 * /economics/expenses -- search-first expense workflow.
 *
 * Primary interaction: type to search.
 * Filters: All / Cash / Card / Supplier
 * Totals: contextual result count + amount
 *
 * Thin wrapper -- all logic lives in the canonical layer.
 * Legacy detailed view accessible from Advanced.
 */
export default function EconomicsExpensesPage() {
  return <ExpensesRouteAdapter />
}
