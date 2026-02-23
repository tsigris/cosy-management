'use client'
import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function AuthLogic() {
  const supabase = getSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // ✅ Προσθέσαμε το '/auth' στη λίστα για να επιτρέπεται η σελίδα reset-password
    const publicPaths = [
      '/login', 
      '/register', 
      '/signup', 
      '/select-store', 
      '/stores/new', 
      '/accept-invite',
      '/auth'
    ]
    
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
    
    const storeInUrl = searchParams.get('store')
    const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const loginWithNext = `/login?next=${encodeURIComponent(currentPath || '/')}`

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      // 1. ΑΝ ΔΕΝ ΥΠΑΡΧΕΙ SESSION -> LOGIN
      if (!session) {
        if (!isPublicPath) {
          window.location.href = loginWithNext
        }
        return
      }

      // 2. ΑΝ ΥΠΑΡΧΕΙ SESSION ΑΛΛΑ ΟΧΙ STORE ID ΣΤΟ URL 
      // Αν είμαστε σε public path (όπως το /auth/reset-password), ΔΕΝ κάνει redirect
      if (!isPublicPath && !storeInUrl) {
        router.push('/select-store')
        return
      }

      // 3. ΣΥΓΧΡΟΝΙΣΜΟΣ LOCAL STORAGE
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
  }, [router, pathname, searchParams, supabase]) // Προσθήκη supabase στα dependencies για τυπικούς λόγους

  return null;
}