import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type RemoveUserBody = {
  storeId?: string
  userId?: string
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
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
    const body = (await request.json()) as RemoveUserBody

    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το userId.' }, { status: 400 })
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
      return NextResponse.json({ ok: false, error: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' }, { status: 403 })
    }

    if (caller.id === userId) {
      return NextResponse.json({ ok: false, error: 'Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.' }, { status: 403 })
    }

    const { error: deleteError } = await adminClient
      .from('store_access')
      .delete()
      .eq('store_id', storeId)
      .eq('user_id', userId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin/remove-user error:', error)
    return NextResponse.json({ ok: false, error: 'Αποτυχία αφαίρεσης χρήστη.' }, { status: 500 })
  }
}
