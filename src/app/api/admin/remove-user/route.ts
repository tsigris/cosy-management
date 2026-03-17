import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, getCallerFromHeader, assertAdminAccess } from '../_shared/auth'

export const runtime = 'nodejs'

type RemoveUserBody = {
  storeId?: string
  userId?: string
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

    const accessDenied = await assertAdminAccess(adminClient, caller.id, storeId)
    if (accessDenied) return accessDenied

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
