import { createBrowserClient } from '@supabase/ssr'

function mustGetEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export function createSupabaseBrowserClient() {
  const url = mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anon = mustGetEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createBrowserClient(url, anon)
}