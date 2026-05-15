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
        padding: `${economicsSpacing.sm}px 0`,
        borderBottom: `1px solid ${economicsColorTokens.border}`,
      }}
    >
      <span
        style={{
          fontSize: primary ? 14 : 13,
          fontWeight: primary ? 800 : 600,
          color: economicsColorTokens.text,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: primary ? 15 : 13,
          fontWeight: primary ? 900 : 700,
          color,
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
        <TransactionList detail={detail} />
      </AsyncBoundary>
    </BottomSheetFrame>
  )
}

export const EconomicsDayDrawer = memo(EconomicsDayDrawerInner)
