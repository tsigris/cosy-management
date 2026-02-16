'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export function AuthLogic() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Λίστα σελίδων που επιτρέπονται ΧΩΡΙΣ επιλεγμένο κατάστημα
    const allowedPaths = ['/select-store', '/login', '/stores/new']

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        localStorage.removeItem('active_store_id')
        window.location.href = '/login'
        return
      }

      if (session && !allowedPaths.includes(pathname)) {
        const activeStoreId = localStorage.getItem('active_store_id')
        if (!activeStoreId) {
          router.push('/select-store')
        }
      }
    })

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

        const activeStoreId = localStorage.getItem('active_store_id')
        // Έλεγχος αν η τρέχουσα σελίδα είναι στις εξαιρέσεις
        if (!activeStoreId && !allowedPaths.includes(pathname)) {
          router.push('/select-store')
        }
      }
    }

    handleGlobalResilience()

    document.addEventListener('visibilitychange', handleGlobalResilience)
    window.addEventListener('focus', handleGlobalResilience)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleGlobalResilience)
      window.removeEventListener('focus', handleGlobalResilience)
    }
  }, [router, pathname])

  return null;
}