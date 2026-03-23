import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { normalizeText } from '@/lib/productsModule'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const store_id = typeof body?.store_id === 'string' ? body.store_id.trim() : ''
    const supplier_id = typeof body?.supplier_id === 'string' ? body.supplier_id.trim() : null
    const raw_text = normalizeText(body?.raw_text)
    const raw_barcode = normalizeText(body?.raw_barcode)
    const matched_product_id = typeof body?.matched_product_id === 'string' ? body.matched_product_id.trim() : ''

    if (!store_id) {
      return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })
    }
    if (!raw_text) {
      return NextResponse.json({ error: 'Missing raw_text' }, { status: 400 })
    }
    if (!matched_product_id) {
      return NextResponse.json({ error: 'Missing matched_product_id' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing, error: findError } = await supabase
      .from('product_match_memory')
      .select('id, usage_count')
      .eq('store_id', store_id)
      .eq('raw_text', raw_text)
      .order('usage_count', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      throw findError
    }

    if (existing?.id) {
      const nextUsage = Number(existing.usage_count ?? 0) + 1
      const { error: updateError } = await supabase
        .from('product_match_memory')
        .update({
          matched_product_id,
          supplier_id,
          raw_barcode,
          usage_count: nextUsage,
          is_confirmed: true,
          confidence: 100,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', String(existing.id))

      if (updateError) {
        throw updateError
      }

      return NextResponse.json({ ok: true, action: 'updated', usage_count: nextUsage })
    }

    const { error: insertError } = await supabase.from('product_match_memory').insert([
      {
        store_id,
        supplier_id,
        raw_text,
        raw_barcode,
        matched_product_id,
        confidence: 100,
        is_confirmed: true,
        usage_count: 1,
      },
    ])

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ ok: true, action: 'inserted', usage_count: 1 })
  } catch (error) {
    console.error('[api/products/match-memory] failed', error)
    return NextResponse.json({ error: 'Match memory save failed' }, { status: 500 })
  }
}
