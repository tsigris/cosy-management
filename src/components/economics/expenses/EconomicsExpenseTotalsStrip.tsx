'use client'

import React, { memo } from 'react'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

// ─── Format helpers (no local finance math — values come from DTO) ──────────

function fmtAmount(value?: number): string {
  if (value === undefined || value === null) return '—'
  return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

// ─── Single total cell ──────────────────────────────────────────────────────

type TotalCellProps = {
  label: string
  value: string
  tone?: string
}

function TotalCell({ label, value, tone }: TotalCellProps) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: economicsColorTokens.muted,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: tone ?? economicsColorTokens.text,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

type EconomicsExpenseTotalsStripProps = {
  /** Total amount for the current result set (comes from DTO, never computed locally) */
  total?: number
  /** Number of matching results */
  count?: number
  loading?: boolean
}

function EconomicsExpenseTotalsStripInner({
  total,
  count,
  loading = false,
}: EconomicsExpenseTotalsStripProps) {
  if (loading) {
    return <LoadingSkeleton lines={1} compact label="Φόρτωση συνόλων" />
  }

  if (total === undefined && count === undefined) return null

  return (
    <div
      aria-label="Σύνολα εξόδων"
      style={{
        display: 'flex',
        gap: economicsSpacing.md,
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        borderRadius: 12,
        border: `1px solid ${economicsColorTokens.border}`,
        background: economicsColorTokens.surface,
      }}
    >
      {count !== undefined && (
        <TotalCell label="Αποτελέσματα" value={String(count)} />
      )}
      {total !== undefined && (
        <TotalCell
          label="Σύνολο"
          value={fmtAmount(total)}
          tone={economicsColorTokens.negative}
        />
      )}
    </div>
  )
}

export const EconomicsExpenseTotalsStrip = memo(EconomicsExpenseTotalsStripInner)
