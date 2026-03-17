import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, getCallerFromHeader, assertAdminAccess } from '../_shared/auth'

export const runtime = 'nodejs'

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
    const accessDenied = await assertAdminAccess(adminClient, caller.id, storeId)
    if (accessDenied) {
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
