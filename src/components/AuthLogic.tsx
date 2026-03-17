'use client'
import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getUrlStoreId, syncStoreToStorage, clearStoredActiveStoreId } from '@/lib/storeResolution'

export function AuthLogic() {
  const supabase = getSupabase()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // 1. ΑΠΟΛΥΤΗ ΠΡΟΤΕΡΑΙΟΤΗΤΑ: Αν είμαστε σε σελίδα auth, σταματάμε κάθε έλεγχο
    if (pathname?.includes('reset-password') || pathname?.startsWith('/auth')) {
      return 
    }

    const publicPaths = ['/login', '/register', '/signup', '/select-store', '/stores/new']
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path))
    
    const storeInUrl = getUrlStoreId(searchParams)
    const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    const loginWithNext = `/login?next=${encodeURIComponent(currentPath || '/')}`

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        if (!isPublicPath) {
          window.location.href = loginWithNext
        }
        return
      }

      if (!isPublicPath && !storeInUrl) {
        router.push('/select-store')
        return
      }

      if (storeInUrl) {
        syncStoreToStorage(storeInUrl)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearStoredActiveStoreId()
        window.location.href = '/login'
      } 
      // Αφαιρέσαμε το αυτόματο redirect στο SIGNED_IN για να μην σε πετάει από το reset-password
    })

    checkAuth()

    const handleFocus = () => checkAuth()
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleFocus)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleFocus)
    }
  }, [router, pathname, searchParams, supabase])

  return null;
}