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

function isSupportedImportByExtension(fileName: string) {
  const lowerName = fileName.toLowerCase()
  return lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.pdf')
}

type PdfPreviewRow = Record<string, unknown> & {
  parsed_name?: string
  parsed_barcode?: string | null
  parsed_price?: number | null
  raw_line?: string
}

async function enrichPdfPreviewRowsWithMemory(
  storeId: string,
  supplierId: string,
  rows: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (rows.length === 0) return rows

  const supabase = getSupabaseAdmin()
  const parsedRows = rows as PdfPreviewRow[]

  const rawTexts = Array.from(
    new Set(
      parsedRows
        .map((row) => (typeof row.parsed_name === 'string' ? row.parsed_name.trim() : ''))
        .filter((value) => value.length > 0),
    ),
  )

  if (rawTexts.length === 0) {
    return parsedRows.map((row) => ({
      ...row,
      memory_match_found: false,
      memory_matched_product_id: null,
      memory_matched_product_name: null,
    }))
  }

  const { data: memoryRows, error: memoryError } = await supabase
    .from('product_match_memory')
    .select('raw_text, matched_product_id, usage_count, last_used_at')
    .eq('store_id', storeId)
    .eq('supplier_id', supplierId)
    .in('raw_text', rawTexts)
    .eq('is_confirmed', true)

  if (memoryError) throw memoryError

  const bestMemoryByRawText = new Map<string, { matched_product_id: string }>()
  for (const row of memoryRows || []) {
    const rawText = typeof row.raw_text === 'string' ? row.raw_text : ''
    const matchedProductId = typeof row.matched_product_id === 'string' ? row.matched_product_id : ''
    if (!rawText || !matchedProductId) continue

    const existing = bestMemoryByRawText.get(rawText)
    if (!existing) {
      bestMemoryByRawText.set(rawText, { matched_product_id: matchedProductId })
    }
  }

  const matchedProductIds = Array.from(new Set(Array.from(bestMemoryByRawText.values()).map((v) => v.matched_product_id)))
  const productNamesById = new Map<string, string>()

  if (matchedProductIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .eq('store_id', storeId)
      .in('id', matchedProductIds)

    if (productsError) throw productsError

    for (const product of products || []) {
      const id = typeof product.id === 'string' ? product.id : ''
      const name = typeof product.name === 'string' ? product.name : '—'
      if (id) productNamesById.set(id, name)
    }
  }

  return parsedRows.map((row) => {
    const raw_text = typeof row.parsed_name === 'string' ? row.parsed_name.trim() : ''
    const parsed_barcode = typeof row.parsed_barcode === 'string' ? row.parsed_barcode : null
    const memory = raw_text ? bestMemoryByRawText.get(raw_text) : undefined
    const memory_match_found = Boolean(memory?.matched_product_id)
    const memory_matched_product_id = memory?.matched_product_id || null
    const memory_matched_product_name =
      memory_matched_product_id && productNamesById.has(memory_matched_product_id)
        ? productNamesById.get(memory_matched_product_id) || null
        : null

    console.log('[pdf-preview-memory]', {
      raw_text,
      parsed_barcode,
      memory_match_found,
      memory_matched_product_name,
    })

    return {
      ...row,
      memory_match_found,
      memory_matched_product_id,
      memory_matched_product_name,
    }
  })
}

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

      const isSupportedByExt = isSupportedImportByExtension(file.name)
      const isSupportedByMime = ACCEPTED_MIME.has(file.type)
      if (!isSupportedByExt && !isSupportedByMime) {
        return NextResponse.json({ error: 'Μη υποστηριζόμενο format. Επιτρέπονται csv, xlsx, xls, pdf.' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const parseResult = await parseImportFile(file.name, file.type, buffer)

      console.log('[import-file]', {
        fileName: file.name,
        fileType: parseResult.fileType,
        size: file.size,
      })

      let previewRows = parseResult.previewRows
      if (parseResult.fileType === 'pdf' && parseResult.parseStatus === 'parsed' && parseResult.previewRows.length > 0) {
        previewRows = await enrichPdfPreviewRowsWithMemory(store_id, supplier_id, parseResult.previewRows)
      }

      const responseParseResult: ImportParseResult = {
        ...parseResult,
        previewRows,
      }

      let batchId: string | null = null
      if (parseResult.fileType === 'pdf') {
        batchId = await createPdfBatchLogs(store_id, supplier_id, file.name, responseParseResult)
      }

      return NextResponse.json({
        ok: true,
        batchId,
        ...responseParseResult,
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
