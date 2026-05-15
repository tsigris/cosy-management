'use client'

import React, { memo } from 'react'
import type { EconomicsHomeSummaryDto } from '@/lib/economics/types/economicsDto'
import { KpiCard } from '@/components/economics/primitives/KpiCard'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { EmptyState } from '@/components/economics/primitives/EmptyState'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

// ─── Format helpers ────────────────────────────────────────────────────────

function fmtAmount(value?: number): string {
  if (value === undefined || value === null) return '—'
  return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function profitTone(value?: number): 'positive' | 'negative' | 'neutral' {
  if (value === undefined || value === null) return 'neutral'
  return value >= 0 ? 'positive' : 'negative'
}

// ─── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: economicsColorTokens.muted,
        marginBottom: economicsSpacing.xs,
      }}
    >
      {children}
    </div>
  )
}

// ─── Two-column KPI pair ────────────────────────────────────────────────────

function KpiPair({
  left,
  right,
  loading,
}: {
  left: React.ReactNode
  right: React.ReactNode
  loading?: boolean
}) {
  if (loading) return <LoadingSkeleton lines={2} label="Φόρτωση μετρικών" />

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: economicsSpacing.sm,
      }}
    >
      {left}
      {right}
    </div>
  )
}

// ─── Cash / Card row ────────────────────────────────────────────────────────

function CashCardRow({ cashRevenue, cardRevenue, loading }: {
  cashRevenue?: number
  cardRevenue?: number
  loading?: boolean
}) {
  if (cashRevenue === undefined && cardRevenue === undefined) return null

  return (
    <div style={{ marginTop: economicsSpacing.md }}>
      <SectionLabel>Τρόπος πληρωμής</SectionLabel>
      <KpiPair
        loading={loading}
        left={
          <KpiCard
            label="Μετρητά"
            value={fmtAmount(cashRevenue)}
            tone="neutral"
            size="secondary"
          />
        }
        right={
          <KpiCard
            label="Κάρτα"
            value={fmtAmount(cardRevenue)}
            tone="neutral"
            size="secondary"
          />
        }
      />
    </div>
  )
}

// ─── Strongest / Weakest day footnote ──────────────────────────────────────

function DayHighlights({ bestDayLabel, worstDayLabel }: {
  bestDayLabel?: string
  worstDayLabel?: string
}) {
  if (!bestDayLabel && !worstDayLabel) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: economicsSpacing.md,
        marginTop: economicsSpacing.md,
        flexWrap: 'wrap',
      }}
    >
      {bestDayLabel && (
        <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>
          <span style={{ color: economicsColorTokens.positive, fontWeight: 700 }}>↑ </span>
          {bestDayLabel}
        </div>
      )}
      {worstDayLabel && (
        <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>
          <span style={{ color: economicsColorTokens.negative, fontWeight: 700 }}>↓ </span>
          {worstDayLabel}
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

type EconomicsHomeSummarySectionProps = {
  summary: EconomicsHomeSummaryDto | null
  loading?: boolean
}

function EconomicsHomeSummarySectionInner({ summary, loading = false }: EconomicsHomeSummarySectionProps) {
  if (loading) {
    return <LoadingSkeleton lines={4} label="Φόρτωση σύνοψης" />
  }

  if (!summary) {
    return (
      <EmptyState
        title="Δεν υπάρχουν δεδομένα"
        description="Δεν βρέθηκαν οικονομικά στοιχεία για αυτή την περίοδο."
      />
    )
  }

  const hasMonthData =
    summary.monthRevenue !== undefined || summary.monthProfit !== undefined

  return (
    <div>
      {/* Priority 1: Today */}
      <SectionLabel>Σήμερα</SectionLabel>
      <KpiPair
        left={
          <KpiCard
            label={summary.todayLabel ?? 'Τζίρος σήμερα'}
            value={fmtAmount(summary.todayRevenue)}
            tone="positive"
            size="primary"
          />
        }
        right={
          <KpiCard
            label="Κέρδος σήμερα"
            value={fmtAmount(summary.todayProfit)}
            tone={profitTone(summary.todayProfit)}
            size="primary"
          />
        }
      />

      {/* Priority 2: Month-to-date */}
      {hasMonthData && (
        <div style={{ marginTop: economicsSpacing.lg }}>
          <SectionLabel>Μήνας</SectionLabel>
          <KpiPair
            left={
              <KpiCard
                label="Τζίρος μήνα"
                value={fmtAmount(summary.monthRevenue)}
                tone="positive"
                size="secondary"
              />
            }
            right={
              <KpiCard
                label="Κέρδος μήνα"
                value={fmtAmount(summary.monthProfit)}
                tone={profitTone(summary.monthProfit)}
                size="secondary"
              />
            }
          />
        </div>
      )}

      {/* Priority 4: Cash vs Card */}
      <CashCardRow
        cashRevenue={summary.cashRevenue}
        cardRevenue={summary.cardRevenue}
      />

      {/* Priority 5: Best/worst day footnote */}
      <DayHighlights
        bestDayLabel={summary.bestDayLabel}
        worstDayLabel={summary.worstDayLabel}
      />
    </div>
  )
}

export const EconomicsHomeSummarySection = memo(EconomicsHomeSummarySectionInner)
