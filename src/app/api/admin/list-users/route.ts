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

function normalizeRole(value: unknown): 'admin' | 'user' | 'staff' {
  const role = String(value || '').toLowerCase()
  if (role === 'admin' || role === 'user' || role === 'staff') {
    return role
  }
  return 'user'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
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

    let rows: Array<Record<string, unknown>> = []

    const fullSelect = 'user_id, role, user_email, can_view_analysis, can_view_history, can_edit_transactions, created_at'
    const noCreatedAtSelect = 'user_id, role, user_email, can_view_analysis, can_view_history, can_edit_transactions'
    const noEmailSelect = 'user_id, role, can_view_analysis, can_view_history, can_edit_transactions, created_at'
    const minimalSelect = 'user_id, role, can_view_analysis, can_view_history, can_edit_transactions'

    const tryFull = await adminClient
      .from('store_access')
      .select(fullSelect)
      .eq('store_id', storeId)
      .order('role', { ascending: false })
      .order('user_email', { ascending: true })

    if (!tryFull.error) {
      rows = (tryFull.data as Array<Record<string, unknown>>) || []
    } else {
      const fullMessage = String(tryFull.error.message || '').toLowerCase()

      if (fullMessage.includes('created_at')) {
        const tryNoCreatedAt = await adminClient
          .from('store_access')
          .select(noCreatedAtSelect)
          .eq('store_id', storeId)
          .order('role', { ascending: false })
          .order('user_email', { ascending: true })

        if (!tryNoCreatedAt.error) {
          rows = (tryNoCreatedAt.data as Array<Record<string, unknown>>) || []
        } else {
          const noCreatedAtMessage = String(tryNoCreatedAt.error.message || '').toLowerCase()

          if (noCreatedAtMessage.includes('user_email')) {
            const tryMinimal = await adminClient
              .from('store_access')
              .select(minimalSelect)
              .eq('store_id', storeId)
              .order('role', { ascending: false })
              .order('user_id', { ascending: true })

            if (tryMinimal.error) throw tryMinimal.error
            rows = (tryMinimal.data as Array<Record<string, unknown>>) || []
          } else {
            throw tryNoCreatedAt.error
          }
        }
      } else if (fullMessage.includes('user_email')) {
        const tryNoEmail = await adminClient
          .from('store_access')
          .select(noEmailSelect)
          .eq('store_id', storeId)
          .order('role', { ascending: false })
          .order('user_id', { ascending: true })

        if (!tryNoEmail.error) {
          rows = (tryNoEmail.data as Array<Record<string, unknown>>) || []
        } else {
          const noEmailMessage = String(tryNoEmail.error.message || '').toLowerCase()

          if (noEmailMessage.includes('created_at')) {
            const tryMinimal = await adminClient
              .from('store_access')
              .select(minimalSelect)
              .eq('store_id', storeId)
              .order('role', { ascending: false })
              .order('user_id', { ascending: true })

            if (tryMinimal.error) throw tryMinimal.error
            rows = (tryMinimal.data as Array<Record<string, unknown>>) || []
          } else {
            throw tryNoEmail.error
          }
        }
      } else {
        throw tryFull.error
      }
    }

    const users = rows.map((row) => ({
      user_id: String(row.user_id || ''),
      user_email: typeof row.user_email === 'string' ? row.user_email : null,
      role: normalizeRole(row.role),
      can_view_analysis:
        typeof row.can_view_analysis === 'boolean' ? row.can_view_analysis : undefined,
      can_view_history:
        typeof row.can_view_history === 'boolean' ? row.can_view_history : undefined,
      can_edit_transactions:
        typeof row.can_edit_transactions === 'boolean' ? row.can_edit_transactions : undefined,
    }))

    return NextResponse.json({ ok: true, users })
  } catch (error) {
    console.error('admin/list-users error:', error)
    return NextResponse.json({ ok: false, error: 'Αποτυχία φόρτωσης χρηστών.' }, { status: 500 })
  }
}
