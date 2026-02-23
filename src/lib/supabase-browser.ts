import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
  // Ποτέ μην προσπαθείς να φτιάξεις client στο server
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowser() called on the server')
  }

  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // ΣΗΜΑΝΤΙΚΟ: Όχι throw στο build. Αν λείπουν env, καλύτερα crash μόνο runtime στον browser.
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    // Ρίχνουμε error εδώ για να το δεις ξεκάθαρα στο browser, όχι στο build.
    throw new Error('Supabase env vars missing in browser')
  }

  browserClient = createClient(url, anon, {
    auth: {
      persistSession: true,
      storageKey: 'cosy-management-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: window.localStorage,
    },
  })

  return browserClient
}