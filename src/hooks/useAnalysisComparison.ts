'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { FinancialComparisonResponse } from '@/types/analysisComparison'
import { normalizeDateKey } from '@/lib/financialPeriods'

type UseAnalysisComparisonArgs = {
  storeId: string | null
  fromDate: string
  toDate: string
  enabled: boolean
}

export function useAnalysisComparison({
  storeId,
  fromDate,
  toDate,
  enabled,
}: UseAnalysisComparisonArgs) {
  const [data, setData] = useState<FinancialComparisonResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const hasValidDates =
    Boolean(normalizeDateKey(fromDate) === fromDate) &&
    Boolean(normalizeDateKey(toDate) === toDate)

  useEffect(() => {
    if (!enabled || !storeId || !hasValidDates) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const requestId = ++requestIdRef.current
    let cancelled = false

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = getSupabase()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          throw new Error('Απαιτείται σύνδεση.')
        }

        // Debug: Log comparison query
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useAnalysisComparison] Fetching comparison data', {
            storeId,
            fromDate,
            toDate,
            timestamp: new Date().toISOString(),
          })
        }

        console.log('FINAL_QUERY_RANGE', {
          from: fromDate,
          to: toDate,
        })

        const response = await fetch('/api/analysis/comparison', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Supabase-Auth': session.access_token,
          },
          body: JSON.stringify({
            storeId,
            fromDate,
            toDate,
          }),
        })

        const payload = (await response.json()) as FinancialComparisonResponse & {
          error?: string
          failureReason?: string
          stage?: string
          details?: string
        }

        if (!response.ok) {
          const failureReason = payload?.failureReason || 'comparison_service_error'
          const failureStage = payload?.stage || 'unknown_stage'
          const failureDetails = payload?.details || payload?.error || 'Unknown comparison failure'

          throw new Error(
            `Comparison service error [reason=${failureReason}; stage=${failureStage}; details=${failureDetails}]`,
          )
        }

        if (!payload?.summary || !payload?.periods || !Array.isArray(payload?.daily)) {
          throw new Error(
            `[comparison] Invalid canonical payload shape (summary=${Boolean(payload?.summary)}, periods=${Boolean(payload?.periods)}, daily=${Array.isArray(payload?.daily)})`,
          )
        }

        if (cancelled || requestId !== requestIdRef.current) return

        // CRITICAL TRACE LOG: Adapter Mapping & UI Props
        console.info('[useAnalysisComparison] CANONICAL_PAYLOAD_TRACE - ADAPTER_MAPPING_AND_UI', {
          tracePhase: 'hook-adapter-complete',
          storeId,
          userId: 'unknown',
          requestPeriod: `${fromDate} to ${toDate}`,
          comparisonPeriod: `${payload.periods.previous.from} to ${payload.periods.previous.to}`,
          comparisonMapping: payload.comparisonMapping,
          adapter_mapped_dto: {
            periods: payload.periods,
            summary: {
              totalRevenue: payload.summary.totalRevenue,
              expenses: payload.summary.expenses,
              profit: payload.summary.profit,
            },
            daily_count: payload.daily.length,
            first_daily_row_props: payload.daily[0] || null,
          },
          ui_binding: {
            will_render_comparison: Boolean(payload?.summary),
            will_show_daily_rows: payload?.daily?.length > 0,
            metric_cards_available: {
              totalRevenue: Boolean(payload?.summary?.totalRevenue),
              expenses: Boolean(payload?.summary?.expenses),
              profit: Boolean(payload?.summary?.profit),
            },
          },
        })

        // Debug: Log successful comparison response
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useAnalysisComparison] Comparison data loaded', {
            storeId,
            fromDate,
            toDate,
            selectedComparisonDate: fromDate,
            mappedPreviousDate:
              payload.daily.find((row) => row.currentDate === fromDate)?.previousDate || null,
            hasSummary: Boolean(payload?.summary),
            totalRevenueComparison: payload?.summary?.totalRevenue,
            dailyRowsCount: payload?.daily?.length || 0,
            timestamp: new Date().toISOString(),
          })
        }

        setData(payload)
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return
        const message = err instanceof Error ? err.message : 'Αποτυχία φόρτωσης σύγκρισης.'

        // Debug: Log comparison error
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useAnalysisComparison] Comparison lookup failed', {
            storeId,
            fromDate,
            toDate,
            error: message,
            canonicalFailure: message.includes('Comparison service error'),
            timestamp: new Date().toISOString(),
          })
        }

        setError(message)
        setData(null)
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [enabled, storeId, fromDate, toDate, hasValidDates])

  return {
    data,
    loading,
    error,
  }
}
