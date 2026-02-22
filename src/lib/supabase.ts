import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		storageKey: 'cosy-management-auth',
		storage: typeof window !== 'undefined' ? window.localStorage : undefined,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		flowType: 'pkce',
	},
})

// Απλοποιημένο cache χωρίς Promises που "κολλάνε"
let sessionCache: any = undefined

export const getSessionCached = async () => {
	// Αν υπάρχει ήδη session στη μνήμη, δώσε το ακαριαία
	if (sessionCache) return sessionCache

	// Αν δεν υπάρχει, ρώτα ΤΩΡΑ τη Supabase (απαραίτητο για Safari/Mobile)
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