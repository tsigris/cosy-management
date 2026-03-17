import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, getCallerFromHeader, assertAdminAccess } from '../_shared/auth'

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

export async function POST(request: NextRequest) {
  let storeId = ''
  try {
    const body = await request.json()
    storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const q = typeof body?.q === 'string' ? body.q.trim() : ''
    const rawPage = Number(body?.page)
    const rawPageSize = Number(body?.pageSize)
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 50) : 10

    console.log('LIST_USERS_START', {
      storeId,
      hasAuthHeader: Boolean(request.headers.get('x-supabase-auth'))
    })

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
    }

    const caller = await getCallerFromHeader(request)
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    const accessDenied = await assertAdminAccess(adminClient, caller.id, storeId)
    if (accessDenied) return accessDenied

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
    console.error('LIST_USERS_FAIL', {
      storeId,
      tokenPresent: Boolean(request.headers.get('x-supabase-auth')),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null
    })

    return new Response(
      JSON.stringify({ error: 'LIST_USERS_FAILED' }),
      { status: 500 }
    )
  }
}
