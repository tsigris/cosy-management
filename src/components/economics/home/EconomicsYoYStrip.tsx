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
        gap: economicsSpacing.md,
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        borderRadius: 12,
        border: `1px solid ${economicsColorTokens.border}`,
        background: economicsColorTokens.surface,
        flexWrap: 'wrap',
      }}
    >
      {/* Period labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: economicsColorTokens.muted }}>
          Σύγκριση ΥoΥ
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: economicsColorTokens.text, marginTop: 2 }}>
          {comparison.periodLabel ?? '—'}
          {comparison.previousPeriodLabel
            ? <span style={{ color: economicsColorTokens.muted }}> vs {comparison.previousPeriodLabel}</span>
            : null}
        </div>
      </div>

      {/* Current total */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: economicsColorTokens.muted, fontWeight: 700, textTransform: 'uppercase' }}>
          Τρέχουσα
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: economicsColorTokens.text }}>
          {fmtAmount(comparison.currentTotal)}
        </div>
      </div>

      {/* Delta */}
      {(deltaPct !== undefined && deltaPct !== null) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: `3px ${economicsSpacing.xs}px`,
            borderRadius: 8,
            background: `${tone}18`,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 900, color: tone }}>{directionMark}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: tone }}>{pctText}</span>
        </div>
      )}
    </div>
  )
}

export const EconomicsYoYStrip = memo(EconomicsYoYStripInner)
