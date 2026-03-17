import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, getCallerFromHeader, assertAdminAccess } from '../_shared/auth'

export const runtime = 'nodejs'

type UpdateUserRoleBody = {
  storeId?: string
  userId?: string
  role?: 'admin' | 'user'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpdateUserRoleBody

    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const role = body?.role

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το userId.' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json({ ok: false, error: 'Μη έγκυρος ρόλος. Επιτρεπτά: admin, user.' }, { status: 400 })
    }

    const caller = await getCallerFromHeader(request)
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    const accessDenied = await assertAdminAccess(adminClient, caller.id, storeId)
    if (accessDenied) return accessDenied

    if (caller.id === userId && role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Δεν μπορείτε να αλλάξετε τον ρόλο του εαυτού σας.' },
        { status: 403 }
      )
    }

    const permissions =
      role === 'admin'
        ? {
            can_view_analysis: true,
            can_view_history: true,
            can_edit_transactions: true,
          }
        : {
            can_view_analysis: true,
            can_view_history: true,
            can_edit_transactions: false,
          }

    const { error: updateError } = await adminClient
      .from('store_access')
      .update({
        role,
        ...permissions,
      })
      .eq('store_id', storeId)
      .eq('user_id', userId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('admin/update-user-role error:', error)
    return NextResponse.json({ ok: false, error: 'Αποτυχία ενημέρωσης ρόλου.' }, { status: 500 })
  }
}
