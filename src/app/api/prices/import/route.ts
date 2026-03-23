import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { importSupplierPricesBatch } from '@/lib/productsModule'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const store_id = typeof body?.store_id === 'string' ? body.store_id.trim() : ''
    const supplier_id = typeof body?.supplier_id === 'string' ? body.supplier_id.trim() : ''
    const file_name = typeof body?.file_name === 'string' ? body.file_name.trim() : null
    const rows = Array.isArray(body?.rows) ? body.rows : []

    if (!store_id) {
      return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })
    }
    if (!supplier_id) {
      return NextResponse.json({ error: 'Missing supplier_id' }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const result = await importSupplierPricesBatch(supabase, {
      store_id,
      supplier_id,
      file_name,
      rows,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[api/prices/import] failed', error)
    return NextResponse.json({ error: 'Prices import failed' }, { status: 500 })
  }
}
