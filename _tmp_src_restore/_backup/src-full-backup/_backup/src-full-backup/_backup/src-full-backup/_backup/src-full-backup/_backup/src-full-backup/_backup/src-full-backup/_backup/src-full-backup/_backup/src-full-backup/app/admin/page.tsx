'use client'
import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

function LegacyInviteRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')
  const supabase = getSupabase()

  useEffect(() => {
    async function redirectToInvitePage() {
      if (storeIdFromUrl) {
        router.replace(`/manage-users?store=${storeIdFromUrl}`)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: access } = await supabase
        .from('store_access')
        .select('store_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (access?.store_id) {
        router.replace(`/manage-users?store=${access.store_id}`)
        return
      }

      toast.error('Δεν βρέθηκε κατάστημα για διαχείριση χρηστών')
      router.replace('/select-store')
    }

    void redirectToInvitePage()
  }, [router, storeIdFromUrl])

  return <div style={{ padding: '50px', textAlign: 'center' }}>Μετάβαση στη διαχείριση χρηστών...</div>
}

export default function InvitePage() {
  return <LegacyInviteRedirect />
}
