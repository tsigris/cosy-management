'use client'

import { ReactNode, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { PermissionCheckProps } from '@/lib/clientPermissions'

/**
 * ✅ PermissionGuard component
 * Checks if current user is admin for the given store
 * Consolidates store_access lookup logic (no behavior changes)
 */
type PermissionGuardProps = {
  storeId: string | null
  children: (props: PermissionCheckProps) => ReactNode
}

export default function PermissionGuard({ storeId, children }: PermissionGuardProps) {
  const supabase = getSupabase()
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isCancelled = false

    async function checkAdminPermission() {
      if (!storeId) {
        if (!isCancelled) {
          setIsAdmin(false)
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!isCancelled) setIsAdmin(false)
          return
        }

        const { data, error } = await supabase
          .from('store_access')
          .select('role')
          .eq('store_id', storeId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        if (!isCancelled) {
          setIsAdmin(data?.role === 'admin')
        }
      } catch {
        if (!isCancelled) setIsAdmin(false)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    checkAdminPermission()

    return () => {
      isCancelled = true
    }
  }, [storeId])

  return <>{children({ isAdmin, isLoading })}</>
}
