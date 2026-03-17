/**
 * ✅ Shared client-side permission utilities (UI-only, no behavior changes)
 * Safe to use across pages - does not change server auth model or API responses
 */

import type { CSSProperties } from 'react'

/**
 * Canonical read-only access banner styling
 * Replaces duplicated definitions across pages
 */
export const readOnlyBannerStyle: CSSProperties = {
  marginBottom: 12,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--muted)',
  fontSize: 12,
  fontWeight: 800,
  textAlign: 'center',
}

/**
 * Type-safe render props for permission checks
 * Used by PermissionGuard and any permission-aware components
 */
export type PermissionCheckProps = {
  isAdmin: boolean
  isLoading: boolean
}

/**
 * Helper to create standard permission guard render props
 * Consolidates the permission check state shape
 */
export function createPermissionProps(isAdmin: boolean, isLoading: boolean): PermissionCheckProps {
  return { isAdmin, isLoading }
}
