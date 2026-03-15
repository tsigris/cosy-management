'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (supabase) return supabase

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are not provided (e.g. CI, headless smoke tests), return
  // a lightweight no-op client that resolves queries with empty data instead
  // of performing network requests. This prevents client-side "Failed to fetch"
  // errors while keeping the UI functional for tests.
  if (!url || !anon) {
    // Minimal no-op implementation covering the patterns used in the app:
    // - supabase.from(...).select(...).eq(...)
    // - supabase.from(...).select(...)
    // - supabase.auth.getSession()
    // - supabase.from(...).select(...).limit / order (these will resolve to empty)
    // The shape is intentionally permissive and cast to SupabaseClient.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noop: any = {
      from: (_table: string) => ({
        select: (_cols?: string) => ({
          eq: async (_col: string, _val: any) => ({ data: [], error: null }),
          limit: async (_n: number) => ({ data: [], error: null }),
          order: async (_by: string, _dir?: string) => ({ data: [], error: null }),
          // allow awaiting select() directly
          then: async (resolve: any) => resolve({ data: [], error: null }),
        }),
      }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      // any other calls should be no-ops
    }

    supabase = noop as SupabaseClient
    // eslint-disable-next-line no-console
    console.warn('getSupabase: NEXT_PUBLIC_SUPABASE_URL or ANON key not set — using noop client')
    return supabase
  }

  supabase = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'cosy-management-auth'
    }
  })

  return supabase
}