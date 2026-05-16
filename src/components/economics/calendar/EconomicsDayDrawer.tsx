'use client'

import React, { memo } from 'react'
import type { EconomicsDayDetailDto } from '@/lib/economics/types/economicsDto'
import { BottomSheetFrame } from '@/components/economics/primitives/BottomSheetFrame'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { LoadingSkeleton } from '@/components/economics/primitives/LoadingSkeleton'
import { EmptyState } from '@/components/economics/primitives/EmptyState'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

export const DAY_DRAWER_ID = 'day-detail'

// ─── Summary row (Revenue / Profit / Expenses / Cash / Card) ───────────────

type SummaryRowProps = {
  label: string
  value: string
  tone?: 'positive' | 'negative' | 'muted'
  primary?: boolean
}

function SummaryRow({ label, value, tone = 'muted', primary = false }: SummaryRowProps) {
  const color =
    tone === 'positive'
      ? economicsColorTokens.positive
      : tone === 'negative'
        ? economicsColorTokens.negative
        : economicsColorTokens.muted

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${primary ? 14 : 10}px 0`,
        borderBottom: `1px solid ${economicsColorTokens.border}`,
      }}
    >
      <span
        style={{
          fontSize: primary ? 15 : 13,
          fontWeight: primary ? 800 : 600,
          color: economicsColorTokens.text,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: primary ? 20 : 14,
          fontWeight: 900,
          color: primary && tone !== 'muted' ? color : color,
          letterSpacing: primary ? '-0.02em' : 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Format helpers (no import — isolated from canonical finance) ───────────

function formatAmount(value?: number): string {
  if (value === undefined || value === null) return '—'
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

// ─── Context derivations (pure — from existing DTO fields) ─────────────────

type DayContext = {
  txCount: number
  topIncomeTx: { amount: number; category: string | null } | null
  topExpenseCategory: string | null
}

function deriveDayContext(detail: EconomicsDayDetailDto): DayContext {
  const txs = detail.transactions
  const incomes  = txs.filter((t) => t.isCredit === true)
  const expenses = txs.filter((t) => t.isCredit !== true)

  // Biggest income transaction
  const topIncome = incomes.reduce<typeof incomes[0] | null>((best, t) =>
    best === null || t.amount > best.amount ? t : best, null)

  // Most frequent expense category
  const catCounts: Record<string, number> = {}
  for (const t of expenses) {
    const cat = t.category ?? t.type ?? 'Άλλο'
    catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const topExpenseCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    txCount: txs.length,
    topIncomeTx: topIncome ? { amount: topIncome.amount, category: topIncome.category ?? null } : null,
    topExpenseCategory: topExpenseCat,
  }
}

// ─── Comparisons section — timeline context (why this day matters) ────────────

type DayComparison = {
  label: string
  value?: number
  pct?: number
  tone?: 'positive' | 'negative' | 'neutral'
}

function ComparisonRow({ label, value, pct, tone = 'neutral' }: DayComparison) {
  const color = tone === 'positive'
    ? economicsColorTokens.positive
    : tone === 'negative'
      ? economicsColorTokens.negative
      : economicsColorTokens.muted

  const signal = pct === undefined ? null : pct > 0 ? '↑' : pct < 0 ? '↓' : '—'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${economicsColorTokens.border}` }}>
      <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {value !== undefined && (
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{formatAmount(value)}</span>
        )}
        {pct !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 800, color }}>
            {signal} {Math.abs(pct).toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%
          </span>
        )}
      </div>
    </div>
  )
}

function ComparisonsSection({ detail }: { detail: EconomicsDayDetailDto | null }) {
  if (!detail) return null

  // Stub comparisons — in production these would be computed from historical data
  // For now, show the structure so the narrative is clear
  const comparisons: DayComparison[] = [
    { label: 'vs Χθες (Τζίρος)', value: undefined, pct: undefined },
    { label: 'vs Χθες (Κέρδος)', value: undefined, pct: undefined },
    { label: 'vs Πέρυσι Σήμερα', value: undefined, pct: undefined },
  ]

  const anyComparison = comparisons.some((c) => c.value !== undefined || c.pct !== undefined)
  if (!anyComparison) return null

  return (
    <div
      style={{
        margin: `${economicsSpacing.md}px 0`,
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        borderRadius: 12,
        background: economicsColorTokens.surface,
        border: `1px solid ${economicsColorTokens.border}`,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 6 }}>
        Σχέση με προηγούμενα
      </div>
      {comparisons.map((c, i) => (
        <ComparisonRow key={i} {...c} />
      ))}
    </div>
  )
}

// ─── Context section ─────────────────────────────────────────────────────────

function DayContextSection({ detail }: { detail: EconomicsDayDetailDto }) {
  const ctx = deriveDayContext(detail)
  if (ctx.txCount === 0) return null

  return (
    <div
      style={{
        margin: `${economicsSpacing.md}px 0`,
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        borderRadius: 12,
        background: economicsColorTokens.surface,
        border: `1px solid ${economicsColorTokens.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 4 }}>
        Ανάλυση ημέρας
      </div>

      {/* Transaction count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>Αριθμός συναλλαγών</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: economicsColorTokens.text }}>{ctx.txCount}</span>
      </div>

      {/* Biggest income transaction */}
      {ctx.topIncomeTx && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>Μεγαλύτερη είσπραξη</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: economicsColorTokens.positive }}>{formatAmount(ctx.topIncomeTx.amount)}</span>
        </div>
      )}

      {/* Top expense category */}
      {ctx.topExpenseCategory && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>Κύρια κατηγορία εξόδων</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: economicsColorTokens.warning }}>{ctx.topExpenseCategory}</span>
        </div>
      )}
    </div>
  )
}

// ─── Day summary section ────────────────────────────────────────────────────

type DaySummaryContentProps = {
  detail: EconomicsDayDetailDto | null
  loading: boolean
}

function DaySummaryContent({ detail, loading }: DaySummaryContentProps) {
  if (loading) {
    return <LoadingSkeleton lines={4} label="Φόρτωση ημέρας" />
  }

  if (!detail) {
    return <EmptyState title="Δεν βρέθηκαν δεδομένα" description="Δεν υπάρχουν δεδομένα για αυτή την ημέρα." />
  }

  const s = detail.summary

  const cashRevenue = s?.cashRevenue
  const cardRevenue = s?.cardRevenue

  return (
    <div>
      {/* Priority 1: Revenue */}
      <SummaryRow
        label="Έσοδα"
        value={formatAmount(s?.todayRevenue)}
        tone="positive"
        primary
      />
      {/* Priority 2: Profit */}
      <SummaryRow
        label="Κέρδος"
        value={formatAmount(s?.todayProfit)}
        tone={(s?.todayProfit ?? 0) >= 0 ? 'positive' : 'negative'}
        primary
      />
      {/* Priority 3: Expenses */}
      <SummaryRow
        label="Έξοδα"
        value={formatAmount(
          s?.todayRevenue !== undefined && s?.todayProfit !== undefined
            ? s.todayRevenue - s.todayProfit
            : undefined,
        )}
        tone="negative"
      />
      {/* Priority 4: Cash vs Card */}
      {(cashRevenue !== undefined || cardRevenue !== undefined) && (
        <>
          <SummaryRow
            label="Μετρητά"
            value={formatAmount(cashRevenue)}
            tone="muted"
          />
          <SummaryRow
            label="Κάρτα"
            value={formatAmount(cardRevenue)}
            tone="muted"
          />
        </>
      )}
    </div>
  )
}

// ─── Transaction list — detail layer (secondary, below summary) ─────────────

function TransactionList({ detail }: { detail: EconomicsDayDetailDto | null }) {
  if (!detail || detail.transactions.length === 0) return null

  return (
    <div style={{ marginTop: economicsSpacing.md }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: economicsColorTokens.muted,
          marginBottom: economicsSpacing.xs,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Συναλλαγές
      </div>
      {detail.transactions.map((tx) => (
        <div
          key={tx.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${economicsSpacing.xs}px 0`,
            borderBottom: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: economicsColorTokens.text }}>
              {tx.category ?? tx.type}
            </div>
            {tx.method && (
              <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>{tx.method}</div>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: tx.isCredit ? economicsColorTokens.positive : economicsColorTokens.negative,
            }}
          >
            {formatAmount(tx.amount)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

type EconomicsDayDrawerProps = {
  selectedDay: string | null
  detail: EconomicsDayDetailDto | null
  loading?: boolean
}

function EconomicsDayDrawerInner({ selectedDay, detail, loading = false }: EconomicsDayDrawerProps) {
  const drawerTitle = detail?.label ?? selectedDay ?? 'Ημέρα'

  return (
    <BottomSheetFrame drawerId={DAY_DRAWER_ID} title={drawerTitle}>
      {/* Summary is isolated — async failures here do NOT crash the calendar */}
      <AsyncBoundary area="drawer">
        <DaySummaryContent detail={detail} loading={loading} />
        {detail && <ComparisonsSection detail={detail} />}
        {detail && <DayContextSection detail={detail} />}
        <TransactionList detail={detail} />
      </AsyncBoundary>
    </BottomSheetFrame>
  )
}

export const EconomicsDayDrawer = memo(EconomicsDayDrawerInner)
