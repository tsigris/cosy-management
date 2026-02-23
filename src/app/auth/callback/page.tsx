'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'

export default function AuthCallbackPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    let isCancelled = false

    const processOAuthCallback = async () => {
      const nextRaw = searchParams.get('next') || '/select-store'
      const next = decodeURIComponent(nextRaw)
      const safeNext = next.startsWith('/') ? next : '/select-store'

      // 1) Αν γυρίσει με error, να το δούμε καθαρά
      const errParam = searchParams.get('error')
      const errDesc = searchParams.get('error_description')
      if (errParam) {
        toast.error(decodeURIComponent(errDesc || errParam))
        if (!isCancelled) router.replace('/login')
        return
      }

      const code = searchParams.get('code')

      try {
        // 2) Αν έχουμε code (PKCE flow)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          await supabase.auth.getSession()
          await new Promise((resolve) => setTimeout(resolve, 250))

          if (!isCancelled) router.replace(safeNext)
          return
        }

        // 3) Αν ΔΕΝ έχουμε code, κάνουμε fallback:
        //    μήπως η Supabase έγραψε session με άλλο τρόπο (hash / implicit)
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          if (!isCancelled) router.replace(safeNext)
          return
        }

        // 4) Τίποτα -> πίσω στο login
        if (!isCancelled) router.replace('/login')
      } catch (err: any) {
        toast.error(err?.message || 'Αποτυχία σύνδεσης με Google.')
        if (!isCancelled) router.replace('/login')
      }
    }

    void processOAuthCallback()

    return () => {
      isCancelled = true
    }
  }, [router, searchParams, supabase])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Toaster richColors position="top-center" />
      <p>Σύνδεση...</p>
    </main>
  )
}