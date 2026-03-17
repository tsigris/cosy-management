'use client'

import { ReactNode } from 'react'
import { PermissionCheckProps } from '@/lib/clientPermissions'
import useStoreAccess from '@/hooks/useStoreAccess'

/**
 * ✅ PermissionGuard component
 * Checks if current user is admin for the given store
 * 
 * Now uses shared useStoreAccess hook to consolidate repeated
 * store_access queries across the application
 */
type PermissionGuardProps = {
  storeId: string | null
  children: (props: PermissionCheckProps) => ReactNode
}

export default function PermissionGuard({ storeId, children }: PermissionGuardProps) {
  // Use shared hook for store_access queries
  const { data, loading: isLoading } = useStoreAccess({
    storeId: storeId || undefined,
    fields: 'role',
    autoFetch: !!storeId,
  })

  const isAdmin = data?.role === 'admin'

  return <>{children({ isAdmin, isLoading })}</>
}
