'use client'

import { createClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowser() {
  // Σε περίπτωση που γίνει import κατά λάθος σε server, να μην σκάσει όλο το app
  if (typeof window === 'undefined') return null as any

  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Μην κάνεις throw εδώ (ρίχνει όλο το site στο Vercel)
  if (!url || !anon) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    // Επιστρέφουμε “dummy” για να μην σκάσει η σελίδα
    return null as any
  }

  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      storageKey: 'cosy-management-auth',
      storage: window.localStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  return client
}