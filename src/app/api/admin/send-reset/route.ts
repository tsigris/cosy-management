import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
}

function buildLoginRedirectUrl(request: NextRequest) {
  const base =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get('origin') ||
    ''

  const normalizedBase = base.trim().replace(/\/$/, '')
  if (!normalizedBase) return null

  return `${normalizedBase}/login`
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

async function getCallerFromHeader(request: NextRequest) {
  const url = getSupabaseUrl()
  const anon = getAnonKey()

  if (!url || !anon) {
    throw new Error('Missing Supabase public env vars on server')
  }

  const token = request.headers.get('x-supabase-auth')?.trim() || ''
  if (!token) return null

  const callerClient = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error,
  } = await callerClient.auth.getUser(token)

  if (error || !user) return null
  return user
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
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Δώσε email.' }, { status: 400 })
    }

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
    }

    const caller = await getCallerFromHeader(request)
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    const { data: adminAccess, error: adminAccessError } = await adminClient
      .from('store_access')
      .select('store_id')
      .eq('user_id', caller.id)
      .eq('store_id', storeId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (adminAccessError) {
      throw adminAccessError
    }

    if (!adminAccess) {
      return NextResponse.json({ ok: false, error: 'Δεν έχετε δικαιώματα admin.' }, { status: 403 })
    }

    const redirectTo = buildLoginRedirectUrl(request)
    if (!redirectTo) {
      return NextResponse.json(
        { ok: false, error: 'Missing SITE_URL/NEXT_PUBLIC_SITE_URL/origin for absolute redirect URL.' },
        { status: 500 }
      )
    }

    const { error } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo,
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
