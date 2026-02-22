'use client'

import { ReactNode, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PermissionGuardRenderProps = {
  isAdmin: boolean
  isLoading: boolean
}

type PermissionGuardProps = {
  storeId: string | null
  children: (props: PermissionGuardRenderProps) => ReactNode
}

export default function PermissionGuard({ storeId, children }: PermissionGuardProps) {
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
