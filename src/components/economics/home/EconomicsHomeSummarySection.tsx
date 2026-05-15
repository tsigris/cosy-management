'use client'

import React, { memo } from 'react'
import type { EconomicsHomeSummaryDto } from '@/lib/economics/types/economicsDto'
import { KpiCard } from '@/components/economics/primitives/KpiCard'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { EmptyState } from '@/components/economics/primitives/EmptyState'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

function fmtAmount(value?: number): string {
  if (value === undefined || value === null) return '--'
  return `${value < 0 ? '-' : ''}${Math.abs(value).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

function profitTone(value?: number): 'positive' | 'negative' | 'neutral' {
  if (value === undefined || value === null) return 'neutral'
  return value >= 0 ? 'positive' : 'negative'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: economicsColorTokens.muted,
        marginBottom: economicsSpacing.sm,
        paddingTop: economicsSpacing.lg,
      }}
    >
      {children}
    </div>
  )
}

function KpiPair({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: economicsSpacing.sm }}>
      {left}
      {right}
    </div>
  )
}

function CashCardRow({ cashRevenue, cardRevenue, loading }: {
  cashRevenue?: number
  cardRevenue?: number
  loading?: boolean
}) {
  if (cashRevenue === undefined && cardRevenue === undefined) return null
  if (loading) return <LoadingSkeleton lines={1} compact label="Loading" />
  return (
    <>
      <SectionLabel>Τρόπος πληρωμής</SectionLabel>
      <KpiPair
        left={<KpiCard label="Μετρητά" value={fmtAmount(cashRevenue)} tone="cash" size="tertiary" />}
        right={<KpiCard label="Κάρτα" value={fmtAmount(cardRevenue)} tone="card" size="tertiary" />}
      />
    </>
  )
}

function DayHighlights({ bestDayLabel, worstDayLabel }: { bestDayLabel?: string; worstDayLabel?: string }) {
  if (!bestDayLabel && !worstDayLabel) return null
  return (
    <div
      style={{
        display: 'flex',
        gap: economicsSpacing.md,
        marginTop: economicsSpacing.md,
        flexWrap: 'wrap',
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        borderRadius: 12,
        background: economicsColorTokens.neutralLight,
        border: `1px solid ${economicsColorTokens.border}`,
      }}
    >
      {bestDayLabel && (
        <div style={{ fontSize: 12, color: economicsColorTokens.text, fontWeight: 600 }}>
          <span style={{ color: economicsColorTokens.positive, fontWeight: 800 }}>↑ </span>
          <span style={{ color: economicsColorTokens.muted }}>Καλύτερη: </span>
          {bestDayLabel}
        </div>
      )}
      {worstDayLabel && (
        <div style={{ fontSize: 12, color: economicsColorTokens.text, fontWeight: 600 }}>
          <span style={{ color: economicsColorTokens.negative, fontWeight: 800 }}>↓ </span>
          <span style={{ color: economicsColorTokens.muted }}>Χειρότερη: </span>
          {worstDayLabel}
        </div>
      )}
    </div>
  )
}

type EconomicsHomeSummarySectionProps = {
  summary: EconomicsHomeSummaryDto | null
  loading?: boolean
}

function EconomicsHomeSummarySectionInner({ summary, loading = false }: EconomicsHomeSummarySectionProps) {
  if (loading) {
    return (
      <LoadingSkeleton lines={3} label="Φόρτωση σύνοψης" />
    )
  }

  if (!summary) {
    return (
      <EmptyState
        title="Δεν υπάρχουν δεδομένα"
        description="Δεν βρέθηκαν οικονομικά στοιχεία για αυτήν την περίοδο."
      />
    )
  }

  const hasMonthData = summary.monthRevenue !== undefined || summary.monthProfit !== undefined

  return (
    <div>
      <KpiCard
        label={summary.todayLabel ?? 'Σήμερα'}
        value={fmtAmount(summary.todayRevenue)}
        tone="positive"
        size="primary"
        hero
      />
      <div style={{ marginTop: economicsSpacing.sm }}>
        <KpiCard
          label="Κέρδος σήμερα"
          value={fmtAmount(summary.todayProfit)}
          tone={profitTone(summary.todayProfit)}
          size="primary"
        />
      </div>
      {hasMonthData && (
        <>
          <SectionLabel>Μήνας</SectionLabel>
          <KpiPair
            left={<KpiCard label="Τζίρος μήνα" value={fmtAmount(summary.monthRevenue)} tone="positive" size="secondary" />}
            right={<KpiCard label="Κέρδος μήνα" value={fmtAmount(summary.monthProfit)} tone={profitTone(summary.monthProfit)} size="secondary" />}
          />
        </>
      )}
      <CashCardRow cashRevenue={summary.cashRevenue} cardRevenue={summary.cardRevenue} />
      <DayHighlights bestDayLabel={summary.bestDayLabel} worstDayLabel={summary.worstDayLabel} />
    </div>
  )
}

export const EconomicsHomeSummarySection = memo(EconomicsHomeSummarySectionInner)