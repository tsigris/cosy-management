'use client'

import React, { memo } from 'react'
import type { EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

// ─── Format helpers ────────────────────────────────────────────────────────

function fmtAmount(value?: number): string {
  if (value === undefined || value === null) return '—'
  return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function fmtDeltaPct(deltaPct?: number | null): string {
  if (deltaPct === undefined || deltaPct === null) return ''
  const sign = deltaPct >= 0 ? '+' : ''
  return `${sign}${deltaPct.toLocaleString('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// ─── Main component ─────────────────────────────────────────────────────────

type EconomicsYoYStripProps = {
  comparison: EconomicsComparisonDto | null
  loading?: boolean
}

function EconomicsYoYStripInner({ comparison, loading = false }: EconomicsYoYStripProps) {
  if (loading) {
    return <LoadingSkeleton lines={1} compact label="Φόρτωση σύγκρισης" />
  }

  if (!comparison) return null

  const delta = comparison.delta ?? 0
  const deltaPct = comparison.deltaPct
  const tone =
    delta > 0
      ? economicsColorTokens.positive
      : delta < 0
        ? economicsColorTokens.negative
        : economicsColorTokens.muted

  const directionMark = delta > 0 ? '↑' : delta < 0 ? '↓' : '—'
  const pctText = fmtDeltaPct(deltaPct)

  return (
    <div
      aria-label="Σύγκριση προηγούμενης περιόδου"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 14,
        border: `1px solid ${delta > 0 ? economicsColorTokens.positiveMid : delta < 0 ? economicsColorTokens.negativeMid : economicsColorTokens.border}`,
        background: delta > 0
          ? economicsColorTokens.positiveLight
          : delta < 0
            ? economicsColorTokens.negativeLight
            : economicsColorTokens.surface,
        flexWrap: 'wrap',
      }}
    >
      {/* Period label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', color: economicsColorTokens.muted }}>
          YoY
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: economicsColorTokens.text, marginTop: 2 }}>
          {comparison.periodLabel ?? '—'}
          {comparison.previousPeriodLabel
            ? <span style={{ color: economicsColorTokens.muted }}> vs {comparison.previousPeriodLabel}</span>
            : null}
        </div>
      </div>

      {/* Current total */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: economicsColorTokens.muted, fontWeight: 700, textTransform: 'uppercase' }}>
          Current
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: economicsColorTokens.text, letterSpacing: '-0.02em' }}>
          {fmtAmount(comparison.currentTotal)}
        </div>
      </div>

      {/* Delta badge */}
      {(deltaPct !== undefined && deltaPct !== null) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '5px 10px',
            borderRadius: 999,
            background: `${tone}22`,
            border: `1px solid ${tone}44`,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 900, color: tone }}>{directionMark}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: tone }}>{pctText}</span>
        </div>
      )}
    </div>
  )
}

export const EconomicsYoYStrip = memo(EconomicsYoYStripInner)
