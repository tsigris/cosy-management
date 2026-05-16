'use client'

import React from 'react'
import type { EconomicsHomeSummaryDto, EconomicsComparisonDto } from '@/lib/economics/types/economicsDto'
import type { EconomicsHomeDisplayDto } from '@/lib/economics/types/economicsDisplay'
import { EconomicsHomeSummarySection } from './EconomicsHomeSummarySection'
import { EconomicsYoYStrip } from './EconomicsYoYStrip'
import { AsyncBoundary } from '@/components/economics/primitives/AsyncBoundary'
import { economicsSpacing, economicsColorTokens } from '@/components/economics/primitives/tokens'

type EconomicsHomeScreenProps = {
  summary: EconomicsHomeSummaryDto | EconomicsHomeDisplayDto | null
  comparison: EconomicsComparisonDto | null
  summaryLoading?: boolean
  comparisonLoading?: boolean
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
}: EconomicsHomeScreenProps) {
  const display = summary as EconomicsHomeDisplayDto | null

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
      {/* Today vs Yesterday timeline context */}
      {!summaryLoading && display?.yesterdayRevenue !== undefined && (
        <div
          style={{
            padding: `${economicsSpacing.md}px ${economicsSpacing.md}px`,
            borderRadius: 14,
            background: economicsColorTokens.surface,
            border: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.07em', textTransform: 'uppercase', color: economicsColorTokens.muted, marginBottom: 8 }}>
            Σήμερα vs Χθες
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* Today revenue vs yesterday */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>Τζίρος</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color:
                    display.revenueVsYesterday === undefined
                      ? economicsColorTokens.muted
                      : display.revenueVsYesterday > 0
                        ? economicsColorTokens.positive
                        : display.revenueVsYesterday < 0
                          ? economicsColorTokens.negative
                          : economicsColorTokens.muted,
                }}
              >
                {display.revenueVsYesterday === undefined ? '—' : display.revenueVsYesterday > 0 ? '+' : ''}
                {display.revenueVsYesterday !== undefined
                  ? Math.abs(display.revenueVsYesterday).toLocaleString('el-GR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })
                  : ''}
              </span>
            </div>
            {/* Today profit vs yesterday */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: economicsColorTokens.muted, fontWeight: 600 }}>Κέρδος</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color:
                    display.profitVsYesterday === undefined
                      ? economicsColorTokens.muted
                      : display.profitVsYesterday > 0
                        ? economicsColorTokens.positive
                        : display.profitVsYesterday < 0
                          ? economicsColorTokens.negative
                          : economicsColorTokens.muted,
                }}
              >
                {display.profitVsYesterday === undefined ? '—' : display.profitVsYesterday > 0 ? '+' : ''}
                {display.profitVsYesterday !== undefined
                  ? Math.abs(display.profitVsYesterday).toLocaleString('el-GR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })
                  : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Priority 1 + 2: Today & Month summary — isolated boundary */}
      <AsyncBoundary area="summary">
        <EconomicsHomeSummarySection summary={display} loading={summaryLoading} />
      </AsyncBoundary>

      {/* Priority 3: YoY comparison strip — isolated boundary */}
      <AsyncBoundary area="comparison">
        <EconomicsYoYStrip comparison={comparison} loading={comparisonLoading} />
      </AsyncBoundary>
    </div>
  )
}
