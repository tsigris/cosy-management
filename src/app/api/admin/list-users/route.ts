import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type StoreAccessRow = {
  id: string
  user_id: string
  store_id: string
  role: 'admin' | 'user'
  can_view_analysis: boolean
  can_view_history: boolean
  can_edit_transactions: boolean
  user_email: string | null
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
    const body = await request.json()
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const q = typeof body?.q === 'string' ? body.q.trim() : ''
    const rawPage = Number(body?.page)
    const rawPageSize = Number(body?.pageSize)
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 50) : 10

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
      return NextResponse.json({ ok: false, error: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' }, { status: 403 })
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    let query = adminClient
      .from('store_access')
      .select(
        `
          id,
          user_id,
          store_id,
          role,
          can_view_analysis,
          can_view_history,
          can_edit_transactions,
          user_email
        `,
        { count: 'exact' }
      )
      .eq('store_id', storeId)
      .order('role', { ascending: false })
      .order('user_email', { ascending: true })

    if (q) {
      query = query.ilike('user_email', `%${q}%`)
    }

    const { data, count, error } = await query.range(from, to)
    if (error) throw error

    const rows: StoreAccessRow[] = (data ?? []) as StoreAccessRow[]
    const total = count ?? rows.length

    return NextResponse.json({
      ok: true,
      items: rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (error) {
    console.error('admin/list-users error:', error)
    return NextResponse.json({ ok: false, error: 'Αποτυχία φόρτωσης χρηστών.' }, { status: 500 })
  }
}
