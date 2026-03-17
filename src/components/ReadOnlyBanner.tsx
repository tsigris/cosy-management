'use client'

import { readOnlyBannerStyle } from '@/lib/clientPermissions'

/**
 * ✅ ReadOnlyBanner component
 * Consolidates repeated "read-only access" UI pattern from multiple pages
 * 
 * Safe: Pure UI component, no logic changes
 * Usage: <ReadOnlyBanner isAdmin={isAdmin} isLoading={isLoading} />
 */
type ReadOnlyBannerProps = {
  isAdmin: boolean
  isLoading: boolean
}

export default function ReadOnlyBanner({ isAdmin, isLoading }: ReadOnlyBannerProps) {
  if (isLoading || isAdmin) {
    return null
  }

  return <div style={readOnlyBannerStyle}>Read-only access</div>
}
