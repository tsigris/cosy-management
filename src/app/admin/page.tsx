'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

function LegacyInviteRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  useEffect(() => {
    async function redirectToInvitePage() {
      if (storeIdFromUrl) {
        router.replace(`/admin/invite?store=${storeIdFromUrl}`)
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
        router.replace(`/admin/invite?store=${access.store_id}`)
        return
      }

      toast.error('Δεν βρέθηκε κατάστημα για πρόσκληση')
      router.replace('/select-store')
    }

    void redirectToInvitePage()
  }, [router, storeIdFromUrl])

  return <div style={{ padding: '50px', textAlign: 'center' }}>Μετάβαση στη νέα ροή προσκλήσεων...</div>
}

export default function InvitePage() {
  return <LegacyInviteRedirect />
}
