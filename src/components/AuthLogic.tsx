'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function AuthLogic() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const allowedPaths = ['/select-store', '/login', '/stores/new']
    
    // Ελέγχουμε αν υπάρχει το store ID στο URL ή στο localStorage
    const storeInUrl = searchParams.get('store')
    const storeInStorage = localStorage.getItem('active_store_id')
    const activeStoreId = storeInUrl || storeInStorage

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        localStorage.removeItem('active_store_id')
        window.location.href = '/login'
        return
      }

      if (session && !allowedPaths.includes(pathname)) {
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

        // Αν δεν είμαστε σε allowed path και δεν έχουμε ID πουθενά, στείλε τον χρήστη στην επιλογή
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
  }, [router, pathname, searchParams]) // Προστέθηκε το searchParams στα dependencies

  return null;
}