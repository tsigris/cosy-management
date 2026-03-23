import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { matchProductCandidate, normalizeText } from '@/lib/productsModule'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const store_id = normalizeText(body?.store_id)
    const supplier_id = normalizeText(body?.supplier_id)
    const raw_text = normalizeText(body?.raw_text)
    const raw_barcode = normalizeText(body?.raw_barcode)
    const supplier_barcode_key = normalizeText(body?.supplier_barcode_key)

    if (!store_id) {
      return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const result = await matchProductCandidate(supabase, {
      store_id,
      supplier_id,
      raw_text,
      raw_barcode,
      supplier_barcode_key,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/products/match] failed', error)
    return NextResponse.json({ error: 'Match failed' }, { status: 500 })
  }
}
