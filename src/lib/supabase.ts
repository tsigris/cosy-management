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

let sessionCache:
	| Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
	| null
	| undefined

export const getSessionCached = async () => {
	if (sessionCache === undefined || sessionCache === null) {
		const { data } = await supabase.auth.getSession()
		sessionCache = data.session
	}

	return sessionCache
}

export const setSessionCache = (
	session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null
) => {
	sessionCache = session
}

export const clearSessionCache = () => {
	sessionCache = null
}