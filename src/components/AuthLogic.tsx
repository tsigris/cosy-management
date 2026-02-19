'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function AuthLogic() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Σελίδες που ΔΕΝ απαιτούν store_id στο URL
    const publicPaths = ['/login', '/register', '/signup', '/select-store', '/stores/new', '/accept-invite']
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
    
    const storeInUrl = searchParams.get('store')

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // 1. ΑΝ ΔΕΝ ΥΠΑΡΧΕΙ SESSION -> LOGIN
      if (!session) {
        if (!isPublicPath) {
          window.location.href = '/login'
        }
        return
      }

      // 2. ΑΝ ΥΠΑΡΧΕΙ SESSION ΑΛΛΑ ΟΧΙ STORE ID ΣΤΟ URL (Και δεν είμαστε σε public path)
      if (!isPublicPath && !storeInUrl) {
        console.log("No store ID in URL, redirecting to select-store...")
        router.push('/select-store')
        return
      }

      // 3. ΣΥΓΧΡΟΝΙΣΜΟΣ LOCAL STORAGE (Προαιρετικό αλλά βοηθητικό)
      if (storeInUrl) {
        localStorage.setItem('active_store_id', storeInUrl)
      }
    }

    // Listener για αλλαγές στο Auth state (π.χ. Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('active_store_id')
        window.location.href = '/login'
      } else if (event === 'SIGNED_IN' && pathname === '/login') {
        router.push('/select-store')
      }
    })

    checkAuth()

    // Επανέλεγχος όταν ο χρήστης επιστρέφει στο tab
    const handleFocus = () => checkAuth()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [router, pathname, searchParams])

  return null;
}