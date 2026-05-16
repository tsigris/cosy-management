'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  aggregateCanonicalFinancialMetrics,
  type CanonicalFinancialRow,
  type CanonicalFinancialSummary,
} from '@/lib/canonicalFinancialMetrics'
import { normalizeRange, type FinancialDateRange } from '@/lib/financialPeriods'

type PayrollPayload = {
  payroll_pct?: number | null
}

type UseCanonicalFinancialPeriodArgs = {
  storeId: string | null
  range: FinancialDateRange
  enabled: boolean
}

const SELECT_FIELDS = 'id, date, amount, type, category, method, notes, is_credit'

export function useCanonicalFinancialPeriod({
  storeId,
  range,
  enabled,
}: UseCanonicalFinancialPeriodArgs) {
  const [summary, setSummary] = useState<CanonicalFinancialSummary | null>(null)
  const [rows, setRows] = useState<CanonicalFinancialRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  // Use primitive string deps — the range object identity changes on every render
  // even when the date strings are unchanged, so [range] would re-trigger on every render.
  const normalizedRange = useMemo(() => normalizeRange(range), [range.from, range.to])

  useEffect(() => {
    if (!enabled || !storeId) {
      setSummary(null)
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    const requestId = ++requestIdRef.current
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const supabase = getSupabase()
        const [{ data, error: txError }, payrollRes] = await Promise.all([
          supabase
            .from('transactions')
            .select(SELECT_FIELDS)
            .eq('store_id', storeId)
            .gte('date', normalizedRange.from)
            .lte('date', normalizedRange.to)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase.rpc('get_staff_payroll_pressure_period_summary', {
            p_store_id: storeId,
            p_start_date: normalizedRange.from,
            p_end_date: normalizedRange.to,
          }),
        ])

        if (txError) throw txError
        if (payrollRes.error) throw payrollRes.error
        if (cancelled || requestId !== requestIdRef.current) return

        const nextRows = Array.isArray(data) ? (data as CanonicalFinancialRow[]) : []
        const rawPayroll = Array.isArray(payrollRes.data) ? payrollRes.data[0] : payrollRes.data
        const payrollPct = Number((rawPayroll as PayrollPayload | null)?.payroll_pct || 0)

        setRows(nextRows)
        setSummary(
          aggregateCanonicalFinancialMetrics(nextRows, {
            range: normalizedRange,
            payrollPct,
          }),
        )
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return
        setSummary(null)
        setRows([])
        setError(err instanceof Error ? err.message : 'Αποτυχία φόρτωσης οικονομικών μετρικών.')
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [enabled, storeId, normalizedRange.from, normalizedRange.to])

  return {
    summary,
    rows,
    loading,
    error,
  }
}
