'use client'

import React from 'react'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsHistoryRowDto, EconomicsHomeDisplayDto } from '@/lib/economics/types/economicsDisplay'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { economicsSpacing, economicsColorTokens } from '@/components/economics/primitives/tokens'
import { formatShortDateKey, normalizeDateKey } from '@/lib/financialPeriods'

type EconomicsHomeScreenProps = {
  summary: EconomicsHomeSummaryDto | EconomicsHomeDisplayDto | null
  comparison: EconomicsComparisonDto | null
  summaryLoading?: boolean
  comparisonLoading?: boolean
  fromDate?: string
  toDate?: string
  onFromDateCommit?: (date: string) => void
  onToDateCommit?: (date: string) => void
  comparisonError?: string | null
}

/**
 * Home screen — operator landing.
 *
 * Primary questions answered here:
 * 1. How is today vs yesterday?
 * 2. How is this month vs last year?
 * 3. What days stood out?
 *
 * Focus: Timeline context, not abstract KPIs.
 */
export function EconomicsHomeScreen({
  summary,
  comparison,
  summaryLoading = false,
  comparisonLoading = false,
  fromDate = '',
  toDate = '',
  onFromDateCommit,
  onToDateCommit,
  comparisonError = null,
}: EconomicsHomeScreenProps) {
  const display = summary as EconomicsHomeDisplayDto | null
  const historyRows = display?.historyRows ?? []

  // ✅ GUARD: Date inputs MUST be operational dates, never comparison dates
  const fromDateNormalized = normalizeDateKey(fromDate) || ''
  const toDateNormalized = normalizeDateKey(toDate) || ''

  // ✅ DEFENSIVE: Warn if date values are invalid  
  if (fromDate && !fromDateNormalized) {
    console.warn('[EconomicsHomeScreen] Invalid fromDate:', fromDate)
  }
  if (toDate && !toDateNormalized) {
    console.warn('[EconomicsHomeScreen] Invalid toDate:', toDate)
  }

  // Keep raw typing isolated from committed query state.
  const [draftFrom, setDraftFrom] = React.useState(fromDateNormalized)
  const [draftTo, setDraftTo] = React.useState(toDateNormalized)

  React.useEffect(() => {
    setDraftFrom((prev) => (prev === fromDateNormalized ? prev : fromDateNormalized))
  }, [fromDateNormalized])

  React.useEffect(() => {
    setDraftTo((prev) => (prev === toDateNormalized ? prev : toDateNormalized))
  }, [toDateNormalized])

  const commitDraftDate = React.useCallback(
    (
      draftValue: string,
      committedValue: string,
      onCommit?: (date: string) => void,
    ) => {
      if (!onCommit) return

      const normalized = normalizeDateKey(draftValue)
      if (!normalized || normalized !== draftValue) {
        return
      }

      if (normalized !== committedValue) {
        onCommit(normalized)
      }
    },
    [],
  )

  const rangeRevenue = display?.rangeRevenue
  const rangeExpenses = display?.rangeExpenses
  const rangeProfit = display?.rangeProfit
  const prevYearRevenue = display?.rangeRevenuePrevYear
  const prevYearExpenses = display?.rangeExpensesPrevYear
  const prevYearProfit = display?.rangeProfitPrevYear
  const noComparisonData = display?.noComparisonData ?? false

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: economicsSpacing.lg,
        padding: `${economicsSpacing.md}px 0`,
        width: '100%',
      }}
    >
      <div
        style={{
          padding: economicsSpacing.md,
          borderRadius: 14,
          border: `1px solid ${economicsColorTokens.border}`,
          background: economicsColorTokens.surface,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 8 }}>
          Περίοδος
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            type="date"
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
            onBlur={() => commitDraftDate(draftFrom, fromDateNormalized, onFromDateCommit)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraftDate(draftFrom, fromDateNormalized, onFromDateCommit)
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setDraftFrom(fromDateNormalized)
                event.currentTarget.blur()
              }
            }}
            aria-label="Από ημερομηνία"
            style={dateInputStyle}
          />
          <input
            type="date"
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
            onBlur={() => commitDraftDate(draftTo, toDateNormalized, onToDateCommit)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitDraftDate(draftTo, toDateNormalized, onToDateCommit)
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setDraftTo(toDateNormalized)
                event.currentTarget.blur()
              }
            }}
            aria-label="Έως ημερομηνία"
            style={dateInputStyle}
          />
        </div>
      </div>

      <AsyncBoundary area="summary">
        <div
          style={{
            padding: economicsSpacing.md,
            borderRadius: 14,
            background: economicsColorTokens.surface,
            border: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 8 }}>
            Ιστορικό επιχειρησιακής περιόδου
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: economicsColorTokens.text, marginBottom: 10 }}>
            {display?.rangeLabel || formatRangeLabel(fromDate, toDate)}
          </div>

          {!summaryLoading && (
            <div style={{ display: 'grid', gap: 8 }}>
              <SummaryRow
                label="Τζίρος"
                value={rangeRevenue}
                prevYearValue={prevYearRevenue}
                deltaPct={display?.rangeRevenueDeltaPct}
                tone="positive"
                noComparisonData={noComparisonData}
              />
              <SummaryRow
                label="Έξοδα"
                value={rangeExpenses}
                prevYearValue={prevYearExpenses}
                deltaPct={display?.rangeExpensesDeltaPct}
                tone="warning"
                noComparisonData={noComparisonData}
              />
              <SummaryRow
                label="Καθαρό"
                value={rangeProfit}
                prevYearValue={prevYearProfit}
                deltaPct={display?.rangeProfitDeltaPct}
                tone="neutral"
                noComparisonData={noComparisonData}
              />
            </div>
          )}
        </div>
      </AsyncBoundary>

      <AsyncBoundary area="comparison">
        <div
          aria-label="Σύγκριση περιόδου"
          style={{
            padding: economicsSpacing.md,
            borderRadius: 14,
            background: economicsColorTokens.surface,
            border: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 8 }}>
            Σύγκριση με προηγούμενο έτος
          </div>
          {comparisonLoading ? (
            <div style={{ fontSize: 12, color: economicsColorTokens.muted }}>Φόρτωση σύγκρισης...</div>
          ) : comparisonError ? (
            <div style={{ fontSize: 12, color: economicsColorTokens.muted }}>
              Comparison service error
            </div>
          ) : noComparisonData ? (
            <div style={{ fontSize: 12, color: economicsColorTokens.muted }}>
              Δεν υπάρχουν δεδομένα σύγκρισης για την προηγούμενη περίοδο
            </div>
          ) : !comparison ? (
            <div style={{ fontSize: 12, color: economicsColorTokens.muted }}>
              Δεν υπάρχουν δεδομένα σύγκρισης
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              <ComparisonLine
                label={comparison?.periodLabel || 'Τρέχουσα περίοδος'}
                current={comparison?.currentTotal}
                previous={comparison?.previousTotal}
                deltaPct={comparison?.deltaPct}
              />
            </div>
          )}
        </div>
      </AsyncBoundary>

      <AsyncBoundary area="advanced">
        <div
          style={{
            padding: economicsSpacing.md,
            borderRadius: 14,
            background: economicsColorTokens.surface,
            border: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 8 }}>
            Ημερήσιο ιστορικό
          </div>
          {historyRows.length === 0 ? (
            <div style={{ fontSize: 12, color: economicsColorTokens.muted }}>
              Δεν υπάρχουν ημερήσια δεδομένα για την επιλεγμένη περίοδο.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {historyRows.map((row) => (
                <HistoryRow key={row.date} row={row} />
              ))}
            </div>
          )}
        </div>
      </AsyncBoundary>
    </div>
  )
}

const dateInputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: `1px solid ${economicsColorTokens.border}`,
  background: economicsColorTokens.surface,
  color: economicsColorTokens.text,
  fontSize: 13,
  fontWeight: 700,
  padding: '8px 10px',
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return '—'
  return `${value.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatRangeLabel(fromDate: string, toDate: string) {
  const safeFrom = normalizeDateKey(fromDate)
  const safeTo = normalizeDateKey(toDate)
  if (!safeFrom || !safeTo) return 'Δεν επιλέχθηκε περίοδος'
  try {
    return `${formatShortDateKey(safeFrom)} - ${formatShortDateKey(safeTo)}`
  } catch {
    return 'Δεν επιλέχθηκε περίοδος'
  }
}

function formatShortDateKeySafe(value?: string | null, fallback = 'πέρυσι') {
  const safeValue = normalizeDateKey(value)
  if (!safeValue) return fallback
  try {
    return formatShortDateKey(safeValue)
  } catch {
    return fallback
  }
}

function formatPct(value?: number | null) {
  if (value === null || value === undefined) return 'No comparison data'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('el-GR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function pickTone(tone: 'positive' | 'warning' | 'neutral') {
  if (tone === 'positive') return economicsColorTokens.positive
  if (tone === 'warning') return economicsColorTokens.warning
  return economicsColorTokens.text
}

function SummaryRow({
  label,
  value,
  prevYearValue,
  deltaPct,
  tone,
  noComparisonData,
}: {
  label: string
  value?: number
  prevYearValue?: number
  deltaPct?: number | null
  tone: 'positive' | 'warning' | 'neutral'
  noComparisonData?: boolean
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(78px, 90px) 1fr auto',
        gap: 8,
        alignItems: 'center',
        borderRadius: 10,
        padding: '9px 10px',
        border: `1px solid ${economicsColorTokens.border}`,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: economicsColorTokens.muted }}>{label}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: pickTone(tone) }}>{formatAmount(value)}</div>
        <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>
          {noComparisonData ? 'No previous-year data' : `Πέρυσι: ${formatAmount(prevYearValue)}`}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color:
            deltaPct === null || deltaPct === undefined
              ? economicsColorTokens.muted
              : deltaPct > 0
                ? economicsColorTokens.positive
                : deltaPct < 0
                  ? economicsColorTokens.negative
                  : economicsColorTokens.muted,
        }}
      >
        {noComparisonData ? 'No comparison data' : formatPct(deltaPct)}
      </div>
    </div>
  )
}

function ComparisonLine({
  label,
  current,
  previous,
  deltaPct,
}: {
  label: string
  current?: number
  previous?: number
  deltaPct?: number | null
}) {
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${economicsColorTokens.border}`, padding: '9px 10px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: economicsColorTokens.text }}>{label}</div>
      <div style={{ fontSize: 11, color: economicsColorTokens.muted, marginTop: 2 }}>
        Τρέχον: {formatAmount(current)} | Πέρυσι: {formatAmount(previous)}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          marginTop: 4,
          color:
            deltaPct === undefined || deltaPct === null
              ? economicsColorTokens.muted
              : deltaPct > 0
                ? economicsColorTokens.positive
                : deltaPct < 0
                  ? economicsColorTokens.negative
                  : economicsColorTokens.muted,
        }}
      >
        Μεταβολή: {formatPct(deltaPct)}
      </div>
    </div>
  )
}

function HistoryRow({ row }: { row: EconomicsHistoryRowDto }) {
  const hasComparison = row.hasPreviousYearData === true

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${economicsColorTokens.border}`,
        padding: '9px 10px',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: economicsColorTokens.text }}>{row.label || formatShortDateKey(row.date)}</div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color:
              !hasComparison
                ? economicsColorTokens.muted
                : (row.revenueDeltaPct || 0) >= 0
                  ? economicsColorTokens.positive
                  : economicsColorTokens.negative,
          }}
        >
          {hasComparison
            ? `vs ${formatShortDateKeySafe(row.previousYearDate, 'πέρυσι')}`
            : 'No previous-year data'}
        </div>
      </div>

      <div style={{ fontSize: 12, color: economicsColorTokens.text }}>Τζίρος: {formatAmount(row.revenue)}</div>
      <div style={{ fontSize: 12, color: economicsColorTokens.text }}>Έξοδα: {formatAmount(row.expenses)}</div>
      <div style={{ fontSize: 12, color: economicsColorTokens.text }}>Καθαρό: {formatAmount(row.profit)}</div>

      {hasComparison ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: economicsColorTokens.muted, marginTop: 2 }}>
            vs {formatShortDateKeySafe(row.previousYearDate, 'πέρυσι')}
          </div>
          <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>
            Τζίρος: {formatAmount(row.revenuePrevYear)} | Έξοδα: {formatAmount(row.expensesPrevYear)} | Καθαρό:{' '}
            {formatAmount(row.profitPrevYear)}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color:
                row.revenueDeltaPct === null || row.revenueDeltaPct === undefined
                  ? economicsColorTokens.muted
                  : row.revenueDeltaPct >= 0
                    ? economicsColorTokens.positive
                    : economicsColorTokens.negative,
            }}
          >
            Μεταβολή: {formatPct(row.revenueDeltaPct)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: economicsColorTokens.muted, marginTop: 2 }}>No previous-year data</div>
      )}

      <div style={{ fontSize: 11, color: economicsColorTokens.muted }}>
        Μετρητά {formatAmount(row.cashRevenue)} | Κάρτα {formatAmount(row.cardRevenue)}
      </div>
    </div>
  )
}
