/**
 * ✅ Shared client-side hook for store_access permission queries
 * Consolidates repeated authentication/permission lookups
 * 
 * Handles:
 * - User session fetching
 * - store_access table queries with configurable field selection
 * - Loading and error states
 * 
 * Safe: No behavior changes, purely consolidates repeated query logic
 */

'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export type StoreAccessData = {
  role?: string | null
  can_view_analysis?: boolean | null
  can_view_history?: boolean | null
  can_edit_transactions?: boolean | null
  store_id?: string | null
  [key: string]: any
}

export type UseStoreAccessOptions = {
  /** Comma-separated field list to select (e.g. 'role' or 'role, can_view_analysis') */
  fields?: string
  /** Store ID to filter by; if omitted, only filters by user_id */
  storeId?: string | null
  /** Max results to fetch (default 1) */
  limit?: number
  /** Whether to fetch data automatically */
  autoFetch?: boolean
}

export type UseStoreAccessResult = {
  data: StoreAccessData | null
  loading: boolean
  error: Error | null
}

/**
 * Hook to fetch store_access permissions for current user
 * 
 * @param options Configuration for the query
 * @returns { data, loading, error }
 * 
 * @example
 * // Get admin role
 * const { data, loading } = useStoreAccess({ storeId, fields: 'role' })
 * const isAdmin = data?.role === 'admin'
 * 
 * @example
 * // Get analysis + history permissions
 * const { data } = useStoreAccess({
 *   storeId,
 *   fields: 'role, can_view_analysis, can_view_history'
 * })
 * 
 * @example
 * // Get user's first store (for redirect)
 * const { data } = useStoreAccess({ fields: 'store_id', limit: 1 })
 */
export default function useStoreAccess(options: UseStoreAccessOptions = {}): UseStoreAccessResult {
  const supabase = getSupabase()
  const { fields = 'role', storeId, limit = 1, autoFetch = true } = options

  const [data, setData] = useState<StoreAccessData | null>(null)
  const [loading, setLoading] = useState(autoFetch)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!autoFetch) return

    let isCancelled = false

    async function fetchStoreAccess() {
      try {
        setLoading(true)
        setError(null)

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!isCancelled) {
            setData(null)
            setLoading(false)
          }
          return
        }

        // Build query
        let query = supabase.from('store_access').select(fields).eq('user_id', user.id)

        // Filter by store if provided
        if (storeId) {
          query = query.eq('store_id', storeId)
        }

        // Set limit
        query = query.limit(limit)

        // Execute query
        const { data: result, error: queryError } = await query.maybeSingle()

        if (queryError) throw queryError

        if (!isCancelled) {
          setData(result as StoreAccessData | null)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setData(null)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchStoreAccess()

    return () => {
      isCancelled = true
    }
  }, [storeId, fields, limit, autoFetch])

  return { data, loading, error }
}
