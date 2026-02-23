import { createBrowserClient } from '@supabase/ssr'

function mustGetEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing Supabase environment variable: ${name}`)
  return v
}

// ✅ Single shared browser client
export const supabase = (() => {
  const url = mustGetEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anon = mustGetEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createBrowserClient(url, anon)
})()

// ✅ Optional helpers (αν τα χρησιμοποιείς αλλού)
let sessionCache: any = undefined

export const getSessionCached = async () => {
  if (sessionCache !== undefined) return sessionCache
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) {
    sessionCache = null
    return null
  }
  sessionCache = data.session
  return data.session
}

export const setSessionCache = (session: any) => {
  sessionCache = session
}

export const clearSessionCache = () => {
  sessionCache = null
}