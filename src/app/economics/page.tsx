'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function EconomicsRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  useEffect(() => {
    // ασφαλές redirect στο default tab (cashflow)
    const nextPath = storeId
      ? `/economics/cashflow?store=${encodeURIComponent(storeId)}`
      : '/economics/cashflow'

    router.replace(nextPath)
  }, [router, storeId])

  // minimal fallback για να μην είναι blank screen
  return (
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
  )
}