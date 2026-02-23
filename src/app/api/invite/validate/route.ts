import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const inviteId = typeof body?.inviteId === 'string' ? body.inviteId.trim() : ''

    if (!inviteId) {
      return NextResponse.json({ valid: false, error: 'Missing invite id.' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase.from('stores').select('id').eq('id', inviteId).maybeSingle()

    if (error) {
      console.error('Invite validation failed:', error)
      return NextResponse.json({ valid: false, error: 'Invite validation failed.' }, { status: 500 })
    }

    return NextResponse.json({ valid: Boolean(data?.id), storeId: data?.id ?? null })
  } catch (error) {
    console.error('Invite validation request failed:', error)
    return NextResponse.json({ valid: false, error: 'Invalid request.' }, { status: 400 })
  }
}
