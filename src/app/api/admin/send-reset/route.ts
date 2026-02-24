import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
}

function normalizeSiteUrl() {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!siteUrl) return null
  return siteUrl.replace(/\/$/, '')
}

async function getCallerClient() {
  const url = getSupabaseUrl()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Missing Supabase public env vars on server')
  }

  const cookieStore = await cookies()

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          } catch {
            break
          }
        }
      },
    },
  })
}

function getAdminClient() {
  const url = getSupabaseUrl()
  const serviceRoleKey = getServiceRoleKey()

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Δώσε email.' }, { status: 400 })
    }

    const callerClient = await getCallerClient()
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    const { data: adminAccess, error: adminAccessError } = await adminClient
      .from('store_access')
      .select('store_id')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (adminAccessError) {
      throw adminAccessError
    }

    if (!adminAccess) {
      return NextResponse.json({ ok: false, error: 'Δεν έχετε δικαιώματα admin.' }, { status: 403 })
    }

    const siteUrl = normalizeSiteUrl()
    const { error } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl || ''}/login`,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    const lower = message.toLowerCase()

    if (lower.includes('invalid') && lower.includes('email')) {
      return NextResponse.json({ ok: false, error: 'Μη έγκυρο email.' }, { status: 400 })
    }

    if (lower.includes('auth') && lower.includes('session')) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    console.error('admin/send-reset error:', error)
    return NextResponse.json({ ok: false, error: 'Αποτυχία αποστολής reset password.' }, { status: 500 })
  }
}
