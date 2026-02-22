import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId.trim() : ''

    if (!inviteId) {
      return NextResponse.json({ valid: false, error: 'Missing invite id.' }, { status: 400 })
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(inviteId)) {
      return NextResponse.json({ valid: false, error: 'Invalid invite format.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl) {
      return NextResponse.json({ valid: false, error: 'Server configuration missing.' }, { status: 500 })
    }

    if (!serviceRoleKey) {
      return NextResponse.json(
        { valid: false, error: 'Server invite validation is not configured.' },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data, error } = await adminSupabase.from('stores').select('id').eq('id', inviteId).maybeSingle()

    if (error) {
      console.error('Invite validation failed:', error)
      return NextResponse.json({ valid: false, error: 'Validation failed.' }, { status: 500 })
    }

    return NextResponse.json({ valid: Boolean(data?.id), storeId: data?.id ?? null })
  } catch (error) {
    console.error('Invite validation request failed:', error)
    return NextResponse.json({ valid: false, error: 'Invalid request.' }, { status: 400 })
  }
}
