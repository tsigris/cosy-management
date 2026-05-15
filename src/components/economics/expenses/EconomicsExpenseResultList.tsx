'use client'

import React, { memo } from 'react'
import type { EconomicsExpenseSearchDto } from '@/lib/economics/types/economicsDto'
import { EmptyState } from '@/components/economics/primitives/EmptyState'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

type ExpenseResult = EconomicsExpenseSearchDto['results'][number]

// ─── Format helpers ────────────────────────────────────────────────────────

function fmtAmount(value: number): string {
  return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

/** Parse YYYY-MM-DD → DD/MM/YY for display */
function fmtDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  if (!year || !month || !day) return dateStr
  return `${day}/${month}/${year.slice(2)}`
}

// ─── Single expense row ─────────────────────────────────────────────────────

const ExpenseRow = memo(function ExpenseRow({ item }: { item: ExpenseResult }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${economicsSpacing.sm}px 0`,
        borderBottom: `1px solid ${economicsColorTokens.border}`,
        gap: economicsSpacing.sm,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Primary label */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: economicsColorTokens.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label ?? item.category ?? '—'}
        </div>
        {/* Secondary metadata: date + method */}
        <div
          style={{
            fontSize: 11,
            color: economicsColorTokens.muted,
            marginTop: 2,
            display: 'flex',
            gap: economicsSpacing.xs,
          }}
        >
          <span>{fmtDate(item.date)}</span>
          {item.method && (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.method}</span>
            </>
          )}
          {item.category && item.label && (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.category}</span>
            </>
          )}
        </div>
      </div>

      {/* Amount */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: economicsColorTokens.negative,
          flexShrink: 0,
        }}
      >
        {fmtAmount(item.amount)}
      </div>
    </div>
  )
})

// ─── Main component ─────────────────────────────────────────────────────────

type EconomicsExpenseResultListProps = {
  results: EconomicsExpenseSearchDto['results']
  query: string
  loading?: boolean
}

function EconomicsExpenseResultListInner({
  results,
  query,
  loading = false,
}: EconomicsExpenseResultListProps) {
  if (loading) {
    return <LoadingSkeleton lines={5} label="Φόρτωση αποτελεσμάτων" />
  }

  if (results.length === 0) {
    const description = query.trim()
      ? `Δεν βρέθηκαν έξοδα για "${query}".`
      : 'Δεν υπάρχουν έξοδα για αυτή την περίοδο.'

    return (
      <EmptyState
        title="Δεν βρέθηκαν αποτελέσματα"
        description={description}
      />
    )
  }

  return (
    <div role="list" aria-label="Αποτελέσματα αναζήτησης εξόδων">
      {results.map((item) => (
        <div key={item.id} role="listitem">
          <ExpenseRow item={item} />
        </div>
      ))}
    </div>
  )
}

export const EconomicsExpenseResultList = memo(EconomicsExpenseResultListInner)
