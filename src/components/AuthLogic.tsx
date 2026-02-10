'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function AuthLogic() {
  const router = useRouter()

  useEffect(() => {
    // 1. Παρακολούθηση Auth (Ανανέωση κλειδιού)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        window.location.href = '/login'
      }
    })

    // 2. Μηχανισμός Αφύπνισης: Μόλις ανοίγεις το κινητό, ελέγχει τη σύνδεση αόρατα
    const handleGlobalResilience = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error || !session) {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }

    document.addEventListener('visibilitychange', handleGlobalResilience)
    window.addEventListener('focus', handleGlobalResilience)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleGlobalResilience)
      window.removeEventListener('focus', handleGlobalResilience)
    }
  }, [router])

  return null; // Δουλεύει αόρατα στο παρασκήνιο
}