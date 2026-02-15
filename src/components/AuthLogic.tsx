'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export function AuthLogic() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 1. Παρακολούθηση Auth & Διαχείριση Session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        localStorage.removeItem('active_store_id') // Καθαρισμός επιλεγμένου καταστήματος
        window.location.href = '/login'
        return
      }

      // Αν γίνει Login ή Refresh, έλεγξε αν υπάρχει επιλεγμένο κατάστημα
      if (session && pathname !== '/select-store' && pathname !== '/login') {
        const activeStoreId = localStorage.getItem('active_store_id')
        if (!activeStoreId) {
          router.push('/select-store')
        }
      }
    })

    // 2. Μηχανισμός Αφύπνισης (Resilience): Έλεγχος κατά το focus ή visibility change
    const handleGlobalResilience = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          if (pathname !== '/login') {
            localStorage.clear()
            window.location.href = '/login'
          }
          return
        }

        // Έλεγχος καταστήματος κατά την "αφύπνιση"
        const activeStoreId = localStorage.getItem('active_store_id')
        if (!activeStoreId && pathname !== '/select-store' && pathname !== '/login') {
          router.push('/select-store')
        }
      }
    }

    // Πρώτος έλεγχος κατά το φόρτωμα
    handleGlobalResilience()

    document.addEventListener('visibilitychange', handleGlobalResilience)
    window.addEventListener('focus', handleGlobalResilience)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleGlobalResilience)
      window.removeEventListener('focus', handleGlobalResilience)
    }
  }, [router, pathname])

  return null; // Δουλεύει αόρατα στο παρασκήνιο
}