import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
	},
})

let sessionCache:
	| Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
	| null
	| undefined
let sessionPromise: Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null> | null = null

export const getSessionCached = async () => {
	if (sessionCache !== undefined) return sessionCache

	if (!sessionPromise) {
		sessionPromise = supabase.auth.getSession().then(({ data }) => {
			sessionCache = data.session
			return data.session
		})
	}

	return sessionPromise
}

export const setSessionCache = (
	session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] | null
) => {
	sessionCache = session
	sessionPromise = null
}

export const clearSessionCache = () => {
	sessionCache = null
	sessionPromise = null
}