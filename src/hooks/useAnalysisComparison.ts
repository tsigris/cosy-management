'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { FinancialComparisonResponse } from '@/types/analysisComparison'

type UseAnalysisComparisonArgs = {
  storeId: string | null
  fromDate: string
  toDate: string
  enabled: boolean
}

type ComparisonCacheEntry = {
  expiresAt: number
  payload: FinancialComparisonResponse
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, ComparisonCacheEntry>()

function getCacheKey(storeId: string, fromDate: string, toDate: string) {
  return `${storeId}::${fromDate}::${toDate}`
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

  useEffect(() => {
    if (!enabled || !storeId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const requestId = ++requestIdRef.current
    const cacheKey = getCacheKey(storeId, fromDate, toDate)
    const now = Date.now()
    const cached = cache.get(cacheKey)

    if (cached && cached.expiresAt > now) {
      setData(cached.payload)
      setLoading(false)
      setError(null)
      return
    }

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
        }

        if (!response.ok) {
          throw new Error(payload?.error || 'Αποτυχία φόρτωσης σύγκρισης.')
        }

        if (cancelled || requestId !== requestIdRef.current) return

        cache.set(cacheKey, {
          expiresAt: now + CACHE_TTL_MS,
          payload,
        })

        setData(payload)
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return
        const message = err instanceof Error ? err.message : 'Αποτυχία φόρτωσης σύγκρισης.'
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
  }, [enabled, storeId, fromDate, toDate])

  return {
    data,
    loading,
    error,
  }
}
