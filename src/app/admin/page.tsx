'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import useStoreAccess from '@/hooks/useStoreAccess'

function LegacyInviteRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  // ✅ Use shared hook to fetch first store for user (consolidates repeated query)
  const { data: firstStore } = useStoreAccess({
    fields: 'store_id',
    limit: 1,
    autoFetch: !storeIdFromUrl, // Only fetch if no storeId in URL
  })

  useEffect(() => {
    const redirect = async () => {
      if (storeIdFromUrl) {
        router.replace(`/manage-users?store=${storeIdFromUrl}`)
        return
      }

      if (firstStore?.store_id) {
        router.replace(`/manage-users?store=${firstStore.store_id}`)
        return
      }

      toast.error('Δεν βρέθηκε κατάστημα για διαχείριση χρηστών')
      router.replace('/select-store')
    }

    void redirect()
  }, [router, storeIdFromUrl, firstStore])

  return <div style={{ padding: '50px', textAlign: 'center' }}>Μετάβαση στη διαχείριση χρηστών...</div>
}

export default function InvitePage() {
  return <LegacyInviteRedirect />
}
