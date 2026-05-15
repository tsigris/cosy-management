'use client'

import React, { memo } from 'react'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

export type ExpenseFilterChipId = 'all' | 'cash' | 'card' | 'supplier' | 'date'

export type ExpenseFilterChip = {
  id: ExpenseFilterChipId
  label: string
}

export const DEFAULT_EXPENSE_FILTER_CHIPS: ExpenseFilterChip[] = [
  { id: 'all',      label: 'Όλα' },
  { id: 'cash',     label: 'Μετρητά' },
  { id: 'card',     label: 'Κάρτα' },
  { id: 'supplier', label: 'Προμηθευτής' },
]

type ChipProps = {
  chip: ExpenseFilterChip
  active: boolean
  onSelect: (id: ExpenseFilterChipId) => void
}

const Chip = memo(function Chip({ chip, active, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(chip.id)}
      style={{
        border: `1.5px solid ${active ? economicsColorTokens.neutral : economicsColorTokens.border}`,
        borderRadius: 20,
        padding: `4px ${economicsSpacing.md}px`,
        background: active ? 'rgba(59,130,246,0.12)' : economicsColorTokens.surface,
        color: active ? economicsColorTokens.neutral : economicsColorTokens.text,
        fontSize: 12,
        fontWeight: active ? 800 : 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'border-color 100ms ease, background 100ms ease',
      }}
    >
      {chip.label}
    </button>
  )
})

type EconomicsExpenseFilterChipsProps = {
  chips?: ExpenseFilterChip[]
  activeChip: ExpenseFilterChipId
  onSelect: (id: ExpenseFilterChipId) => void
}

function EconomicsExpenseFilterChipsInner({
  chips = DEFAULT_EXPENSE_FILTER_CHIPS,
  activeChip,
  onSelect,
}: EconomicsExpenseFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="Φίλτρα εξόδων"
      style={{
        display: 'flex',
        gap: economicsSpacing.xs,
        overflowX: 'auto',
        paddingBottom: 2,
        // hide scrollbar but remain scrollable
        scrollbarWidth: 'none',
      }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          chip={chip}
          active={chip.id === activeChip}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export const EconomicsExpenseFilterChips = memo(EconomicsExpenseFilterChipsInner)
