'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    let isCancelled = false

    const processOAuthCallback = async () => {
      const code = searchParams.get('code')
      const next = searchParams.get('next') || '/select-store'

      if (!code) {
        router.replace('/login')
        return
      }

      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error

        await new Promise((resolve) => setTimeout(resolve, 200))

        if (!isCancelled) {
          router.replace(next)
        }
      } catch (err: any) {
        toast.error(err?.message || 'Αποτυχία σύνδεσης με Google.')
        if (!isCancelled) {
          router.replace('/login')
        }
      }
    }

    void processOAuthCallback()

    return () => {
      isCancelled = true
    }
  }, [router, searchParams])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Toaster richColors position="top-center" />
      <p>Σύνδεση...</p>
    </main>
  )
}