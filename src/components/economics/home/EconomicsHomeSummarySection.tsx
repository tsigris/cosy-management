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

// ── Derived computations (pure, from existing DTO fields) ──────────────────

function marginPct(revenue?: number, profit?: number): number | null {
  if (!revenue || revenue === 0 || profit === undefined || profit === null) return null
  return Math.round((profit / revenue) * 100)
}

function expensePressurePct(revenue?: number, profit?: number): number | null {
  if (!revenue || revenue === 0 || profit === undefined || profit === null) return null
  const expenses = revenue - profit
  return Math.round((expenses / revenue) * 100)
}

// ── Margin badge — inline signal under hero card ─────────────────────────────

function MarginBadge({ revenue, profit }: { revenue?: number; profit?: number }) {
  const pct = marginPct(revenue, profit)
  if (pct === null) return null
  const good = pct >= 20
  const warn = pct >= 0 && pct < 20
  const bad  = pct < 0
  const color = bad ? economicsColorTokens.negative : warn ? economicsColorTokens.warning : economicsColorTokens.positive
  const bg    = bad ? economicsColorTokens.negativeLight : warn ? economicsColorTokens.warningLight : economicsColorTokens.positiveLight
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${color}30`,
        marginTop: 8,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 900, color }}>Περιθώριο {pct > 0 ? '+' : ''}{pct}%</span>
    </div>
  )
}

// ── Insight strip — compact row of secondary derived signals ─────────────────

type InsightPillProps = { label: string; value: string; tone?: string; bg?: string }

function InsightPill({ label, value, tone, bg }: InsightPillProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flex: 1,
        padding: '8px 4px',
        borderRadius: 10,
        background: bg ?? economicsColorTokens.surface,
        border: `1px solid ${economicsColorTokens.border}`,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 900, color: tone ?? economicsColorTokens.text, letterSpacing: '-0.02em' }}>
        {value}
      </span>
      <span style={{ fontSize: 9, fontWeight: 700, color: economicsColorTokens.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
        {label}
      </span>
    </div>
  )
}

function InsightStrip({ summary }: { summary: EconomicsHomeSummaryDto }) {
  const todayMargin = marginPct(summary.todayRevenue, summary.todayProfit)
  const monthPressure = expensePressurePct(summary.monthRevenue, summary.monthProfit)

  const pills: InsightPillProps[] = []

  if (todayMargin !== null) {
    const tone = todayMargin < 0 ? economicsColorTokens.negative : todayMargin < 20 ? economicsColorTokens.warning : economicsColorTokens.positive
    const bg   = todayMargin < 0 ? economicsColorTokens.negativeLight : todayMargin < 20 ? economicsColorTokens.warningLight : economicsColorTokens.positiveLight
    pills.push({ label: 'Μικτό σήμερα', value: `${todayMargin > 0 ? '+' : ''}${todayMargin}%`, tone, bg })
  }

  if (monthPressure !== null) {
    const tone = monthPressure > 80 ? economicsColorTokens.negative : monthPressure > 65 ? economicsColorTokens.warning : economicsColorTokens.muted
    pills.push({ label: 'Κόστος μήνα', value: `${monthPressure}%`, tone })
  }

  const cashTotal = (summary.cashRevenue ?? 0) + (summary.cardRevenue ?? 0)
  if (cashTotal > 0 && summary.cardRevenue !== undefined) {
    const cardPct = Math.round((summary.cardRevenue / cashTotal) * 100)
    pills.push({ label: 'Κάρτα %', value: `${cardPct}%`, tone: economicsColorTokens.card })
  }

  if (pills.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: economicsSpacing.md }}>
      {pills.map((p) => <InsightPill key={p.label} {...p} />)}
    </div>
  )
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

function DayHighlightCard({
  label, dayLabel, tone, bg, arrow,
}: { label: string; dayLabel: string; tone: string; bg: string; arrow: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '10px 12px',
        borderRadius: 12,
        background: bg,
        border: `1px solid ${tone}30`,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', color: tone, marginBottom: 4 }}>
        {arrow} {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: economicsColorTokens.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {dayLabel}
      </div>
    </div>
  )
}

function DayHighlights({ bestDayLabel, worstDayLabel }: { bestDayLabel?: string; worstDayLabel?: string }) {
  if (!bestDayLabel && !worstDayLabel) return null
  return (
    <div style={{ display: 'flex', gap: economicsSpacing.sm, marginTop: economicsSpacing.md }}>
      {bestDayLabel && (
        <DayHighlightCard
          label="Καλύτερη"
          dayLabel={bestDayLabel}
          tone={economicsColorTokens.positive}
          bg={economicsColorTokens.positiveLight}
          arrow="↑"
        />
      )}
      {worstDayLabel && (
        <DayHighlightCard
          label="Χειρότερη"
          dayLabel={worstDayLabel}
          tone={economicsColorTokens.negative}
          bg={economicsColorTokens.negativeLight}
          arrow="↓"
        />
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
      <MarginBadge revenue={summary.todayRevenue} profit={summary.todayProfit} />
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
      <InsightStrip summary={summary} />
      <DayHighlights bestDayLabel={summary.bestDayLabel} worstDayLabel={summary.worstDayLabel} />
    </div>
  )
}

export const EconomicsHomeSummarySection = memo(EconomicsHomeSummarySectionInner)