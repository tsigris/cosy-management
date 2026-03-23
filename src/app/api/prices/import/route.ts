import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin'
import { importSupplierPricesBatch } from '@/lib/productsModule'
import { parseImportFile, type ImportParseResult } from '@/lib/server/importFileParser'

export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
])

async function createPdfBatchLogs(
  storeId: string,
  supplierId: string,
  fileName: string,
  parseResult: ImportParseResult,
) {
  const supabase = getSupabaseAdmin()

  const status = parseResult.parseStatus === 'parsed' ? 'parsed' : 'manual_review'
  const notes = parseResult.warnings.join(' | ') || (status === 'parsed' ? 'PDF parsed successfully' : 'PDF needs OCR/manual review')

  const { data: batchData, error: batchError } = await supabase
    .from('import_batches')
    .insert([
      {
        store_id: storeId,
        supplier_id: supplierId,
        import_type: 'pdf_prices',
        file_name: fileName,
        status,
        total_rows: parseResult.previewRows.length,
        inserted_rows: 0,
        updated_rows: 0,
        failed_rows: parseResult.parseStatus === 'parsed' ? 0 : 1,
        notes,
      },
    ])
    .select('id')
    .single()

  if (batchError) throw batchError

  const batchId = String((batchData as { id: string | number }).id)
  const logs: Array<Record<string, unknown>> = []

  if (parseResult.previewRows.length > 0) {
    for (const row of parseResult.previewRows) {
      const parsedName =
        typeof row.parsed_name === 'string'
          ? row.parsed_name
          : typeof row.supplier_product_name === 'string'
            ? row.supplier_product_name
            : null
      const parsedBarcode =
        typeof row.parsed_barcode === 'string'
          ? row.parsed_barcode
          : typeof row.supplier_barcode_key === 'string'
            ? row.supplier_barcode_key
            : typeof row.barcode_raw === 'string'
              ? row.barcode_raw
              : null
      const parsedPrice =
        typeof row.parsed_price === 'number' ? row.parsed_price : typeof row.price === 'number' ? row.price : null
      const rawLine = typeof row.raw_line === 'string' ? row.raw_line.trim() : ''

      logs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row,
        parsed_name: parsedName,
        parsed_barcode: parsedBarcode,
        parsed_price: parsedPrice,
        matched_product_id: null,
        action: 'parsed_candidate',
        message: rawLine ? `Candidate row parsed from PDF text | ${rawLine.slice(0, 220)}` : 'Candidate row parsed from PDF text',
      })
    }
  } else {
    logs.push({
      batch_id: batchId,
      store_id: storeId,
      raw_data: { file_name: fileName },
      parsed_name: null,
      parsed_barcode: null,
      parsed_price: null,
      matched_product_id: null,
      action: 'manual_review',
      message: 'Το PDF φαίνεται να είναι σκαναρισμένο και χρειάζεται OCR step στο επόμενο βήμα.',
    })
  }

  const { error: rowsError } = await supabase.from('import_batch_rows').insert(logs)
  if (rowsError) throw rowsError

  return batchId
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      const store_id = typeof formData.get('store_id') === 'string' ? String(formData.get('store_id')).trim() : ''
      const supplier_id = typeof formData.get('supplier_id') === 'string' ? String(formData.get('supplier_id')).trim() : ''

      if (!store_id) {
        return NextResponse.json({ error: 'Missing store_id' }, { status: 400 })
      }
      if (!supplier_id) {
        return NextResponse.json({ error: 'Missing supplier_id' }, { status: 400 })
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Missing file' }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'Το αρχείο είναι πολύ μεγάλο (max 10MB).' }, { status: 400 })
      }

      const lowerName = file.name.toLowerCase()
      const isSupportedByExt = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.pdf')
      const isSupportedByMime = ACCEPTED_MIME.has(file.type)
      if (!isSupportedByExt && !isSupportedByMime) {
        return NextResponse.json({ error: 'Μη υποστηριζόμενο format. Επιτρέπονται csv, xlsx, pdf.' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const parseResult = await parseImportFile(file.name, file.type, buffer)

      let batchId: string | null = null
      if (parseResult.fileType === 'pdf') {
        batchId = await createPdfBatchLogs(store_id, supplier_id, file.name, parseResult)
      }

      return NextResponse.json({
        ok: true,
        batchId,
        ...parseResult,
      })
    }

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
