'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'

export default function EconomicsRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  useEffect(() => {
    // redirect to new primary home surface
    const nextPath = storeId
      ? `/economics/home?store=${encodeURIComponent(storeId)}`
      : '/economics/home'

    router.replace(nextPath)
  }, [router, storeId])

  // minimal fallback για να μην είναι blank screen
  return (
    <EconomicsShell showBottomNav={false}>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          color: '#64748b',
        }}
      >
        Φόρτωση Οικονομικού Κέντρου...
      </div>
    </EconomicsShell>
  )
}