'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL is missing. ' +
    'Add it to your .env.local file: NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co'
  )
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  throw new Error(
    '[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
    'Add it to your .env.local file: NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'cosy-management-auth'
  }
})

// Note: Runtime requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// to be set (e.g. in .env.local) for client requests to reach Supabase.

export function getSupabase() {
  return supabase
}