import type { SupabaseClient } from '@supabase/supabase-js'

export type StoreSearchParams = { get(key: string): string | null }

export type ProductListItem = {
  id: string
  name: string
  category: string | null
  brand: string | null
  unit: string | null
  baseBarcode: string | null
  latestPrice: number | null
  latestPriceDate: string | null
  supplierCount: number
}

export type ProductsListResult = {
  items: ProductListItem[]
  total: number
}

export type SupplierListItem = {
  id: string
  name: string
  supplierCode: string | null
  barcodePrefix: string | null
  isActive: boolean
  supplierProductsCount: number
}

export type ProductSupplierPriceRow = {
  supplierId: string
  supplierName: string
  supplierProductId: string
  supplierProductName: string | null
  supplierBarcodeKey: string | null
  barcodeRaw: string | null
  lastPrice: number | null
  lastPriceDate: string | null
}

export type ProductPriceHistoryRow = {
  id: string
  invoiceDate: string
  supplierName: string
  price: number
  previousPrice: number | null
  priceDiff: number | null
  source: string
}

export type ProductMatchMemoryRow = {
  id: string
  rawText: string
  rawBarcode: string | null
  usageCount: number
  confidence: number | null
  matchedProductName: string | null
}

export type ProductDetailsResult = {
  product: {
    id: string
    name: string
    category: string | null
    brand: string | null
    unit: string | null
    baseBarcode: string | null
  }
  currentSupplierPrices: ProductSupplierPriceRow[]
  priceHistory: ProductPriceHistoryRow[]
  matchMemory: ProductMatchMemoryRow[]
}

export type ProductImportInputRow = {
  name: string | null
  category: string | null
  brand: string | null
  unit: string | null
  base_barcode: string | null
  raw_data: Record<string, unknown>
}

export type SupplierPriceImportInputRow = {
  supplier_product_name: string | null
  barcode_raw: string | null
  supplier_barcode_key: string | null
  price: number | null
  quantity: number | null
  invoice_date: string | null
  raw_data: Record<string, unknown>
}

export type MatchCandidateResult = {
  matched: boolean
  strategy: 'barcode_key' | 'barcode_raw' | 'memory' | 'name' | 'none'
  product: { id: string; name: string; category: string | null; brand: string | null } | null
  supplier_product: {
    id: string
    supplier_id: string
    product_id: string
    supplier_product_name: string | null
    supplier_barcode_key: string | null
    barcode_raw: string | null
    last_price: number | null
    last_price_date: string | null
  } | null
  candidates: Array<{ id: string; name: string; category: string | null; brand: string | null }>
}

export function getCurrentStoreId(searchParams: StoreSearchParams): string | null {
  const id = searchParams.get('store')
  if (!id) return null
  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeUpper(value: unknown): string | null {
  const text = normalizeText(value)
  return text ? text.toUpperCase() : null
}

export function parseSafeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

export function parseSafeDate(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const parsed = new Date(v)
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear()
      const m = String(parsed.getMonth() + 1).padStart(2, '0')
      const d = String(parsed.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000))
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear()
      const m = String(parsed.getMonth() + 1).padStart(2, '0')
      const d = String(parsed.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  return null
}

export async function fetchProductsByStore(
  supabase: SupabaseClient,
  storeId: string,
  options: { search?: string; category?: string; limit?: number; offset?: number } = {},
): Promise<ProductsListResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 30, 100))
  const offset = Math.max(0, options.offset ?? 0)

  let query = supabase
    .from('products')
    .select('id,name,category,brand,unit,base_barcode', { count: 'exact' })
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const search = normalizeText(options.search)
  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const category = normalizeText(options.category)
  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data: products, count, error } = await query.range(offset, offset + limit - 1)
  if (error) throw error

  const productIds = (products || []).map((p: any) => String(p.id))

  const latestPriceByProduct = new Map<string, { price: number | null; invoiceDate: string | null }>()
  const supplierCountByProduct = new Map<string, number>()

  if (productIds.length > 0) {
    const { data: historyRows, error: historyError } = await supabase
      .from('product_price_history')
      .select('product_id,price,invoice_date')
      .eq('store_id', storeId)
      .in('product_id', productIds)
      .order('invoice_date', { ascending: false })
      .limit(5000)

    if (historyError) throw historyError

    for (const row of historyRows || []) {
      const key = String((row as any).product_id || '')
      if (!key || latestPriceByProduct.has(key)) continue
      latestPriceByProduct.set(key, {
        price: parseSafeNumber((row as any).price),
        invoiceDate: normalizeText((row as any).invoice_date),
      })
    }

    const { data: supplierRows, error: supplierError } = await supabase
      .from('supplier_products')
      .select('product_id')
      .eq('store_id', storeId)
      .in('product_id', productIds)

    if (supplierError) throw supplierError

    for (const row of supplierRows || []) {
      const key = String((row as any).product_id || '')
      if (!key) continue
      supplierCountByProduct.set(key, (supplierCountByProduct.get(key) || 0) + 1)
    }
  }

  const items: ProductListItem[] = (products || []).map((p: any) => {
    const id = String(p.id)
    const latest = latestPriceByProduct.get(id)
    return {
      id,
      name: String(p.name || '—'),
      category: normalizeText(p.category),
      brand: normalizeText(p.brand),
      unit: normalizeText(p.unit),
      baseBarcode: normalizeText(p.base_barcode),
      latestPrice: latest?.price ?? null,
      latestPriceDate: latest?.invoiceDate ?? null,
      supplierCount: supplierCountByProduct.get(id) || 0,
    }
  })

  return { items, total: count || 0 }
}

export async function fetchSuppliersByStore(supabase: SupabaseClient, storeId: string): Promise<SupplierListItem[]> {
  const [{ data: suppliers, error: supplierError }, { data: links, error: linksError }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id,name,supplier_code,barcode_prefix,is_active')
      .eq('store_id', storeId)
      .order('name', { ascending: true }),
    supabase.from('supplier_products').select('supplier_id').eq('store_id', storeId),
  ])

  if (supplierError) throw supplierError
  if (linksError) throw linksError

  const counts = new Map<string, number>()
  for (const row of links || []) {
    const supplierId = String((row as any).supplier_id || '')
    if (!supplierId) continue
    counts.set(supplierId, (counts.get(supplierId) || 0) + 1)
  }

  return (suppliers || []).map((s: any) => ({
    id: String(s.id),
    name: String(s.name || '—'),
    supplierCode: normalizeText(s.supplier_code),
    barcodePrefix: normalizeText(s.barcode_prefix),
    isActive: Boolean(s.is_active),
    supplierProductsCount: counts.get(String(s.id)) || 0,
  }))
}

export async function fetchProductDetails(
  supabase: SupabaseClient,
  storeId: string,
  productId: string,
): Promise<ProductDetailsResult | null> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,name,category,brand,unit,base_barcode')
    .eq('store_id', storeId)
    .eq('id', productId)
    .maybeSingle()

  if (productError) throw productError
  if (!product) return null

  const { data: supplierProducts, error: supplierProductsError } = await supabase
    .from('supplier_products')
    .select('id,supplier_id,product_id,supplier_product_name,supplier_barcode_key,barcode_raw,last_price,last_price_date')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('last_price_date', { ascending: false })

  if (supplierProductsError) throw supplierProductsError

  const supplierIds = Array.from(new Set((supplierProducts || []).map((sp: any) => String(sp.supplier_id || '')).filter(Boolean)))
  const suppliersById = new Map<string, string>()

  if (supplierIds.length > 0) {
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id,name')
      .eq('store_id', storeId)
      .in('id', supplierIds)
    if (suppliersError) throw suppliersError
    for (const s of suppliers || []) suppliersById.set(String((s as any).id), String((s as any).name || '—'))
  }

  const { data: priceHistory, error: historyError } = await supabase
    .from('product_price_history')
    .select('id,invoice_date,supplier_id,price,previous_price,price_diff,source')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .order('invoice_date', { ascending: false })
    .limit(200)

  if (historyError) throw historyError

  const historySupplierIds = Array.from(new Set((priceHistory || []).map((h: any) => String(h.supplier_id || '')).filter(Boolean)))
  if (historySupplierIds.length > 0) {
    const missing = historySupplierIds.filter((id) => !suppliersById.has(id))
    if (missing.length > 0) {
      const { data: moreSuppliers, error: moreSuppliersError } = await supabase
        .from('suppliers')
        .select('id,name')
        .eq('store_id', storeId)
        .in('id', missing)
      if (moreSuppliersError) throw moreSuppliersError
      for (const s of moreSuppliers || []) suppliersById.set(String((s as any).id), String((s as any).name || '—'))
    }
  }

  const { data: memoryRows, error: memoryError } = await supabase
    .from('product_match_memory')
    .select('id,raw_text,raw_barcode,usage_count,confidence,matched_product_id')
    .eq('store_id', storeId)
    .eq('matched_product_id', productId)
    .order('usage_count', { ascending: false })
    .limit(100)

  if (memoryError) throw memoryError

  return {
    product: {
      id: String((product as any).id),
      name: String((product as any).name || '—'),
      category: normalizeText((product as any).category),
      brand: normalizeText((product as any).brand),
      unit: normalizeText((product as any).unit),
      baseBarcode: normalizeText((product as any).base_barcode),
    },
    currentSupplierPrices: (supplierProducts || []).map((sp: any) => ({
      supplierId: String(sp.supplier_id || ''),
      supplierName: suppliersById.get(String(sp.supplier_id || '')) || '—',
      supplierProductId: String(sp.id || ''),
      supplierProductName: normalizeText(sp.supplier_product_name),
      supplierBarcodeKey: normalizeText(sp.supplier_barcode_key),
      barcodeRaw: normalizeText(sp.barcode_raw),
      lastPrice: parseSafeNumber(sp.last_price),
      lastPriceDate: normalizeText(sp.last_price_date),
    })),
    priceHistory: (priceHistory || []).map((h: any) => ({
      id: String(h.id || ''),
      invoiceDate: String(h.invoice_date || ''),
      supplierName: suppliersById.get(String(h.supplier_id || '')) || '—',
      price: Number(h.price || 0),
      previousPrice: parseSafeNumber(h.previous_price),
      priceDiff: parseSafeNumber(h.price_diff),
      source: String(h.source || 'manual'),
    })),
    matchMemory: (memoryRows || []).map((m: any) => ({
      id: String(m.id || ''),
      rawText: String(m.raw_text || ''),
      rawBarcode: normalizeText(m.raw_barcode),
      usageCount: Number(m.usage_count || 0),
      confidence: parseSafeNumber(m.confidence),
      matchedProductName: String((product as any).name || '—'),
    })),
  }
}

export async function matchProductCandidate(
  supabase: SupabaseClient,
  payload: {
    store_id: string
    supplier_id?: string | null
    raw_text?: string | null
    raw_barcode?: string | null
    supplier_barcode_key?: string | null
  },
): Promise<MatchCandidateResult> {
  const storeId = payload.store_id
  const supplierId = normalizeText(payload.supplier_id)
  const rawText = normalizeText(payload.raw_text)
  const rawBarcode = normalizeText(payload.raw_barcode)
  const barcodeKey = normalizeText(payload.supplier_barcode_key)

  const emptyResult: MatchCandidateResult = {
    matched: false,
    strategy: 'none',
    product: null,
    supplier_product: null,
    candidates: [],
  }

  if (!storeId) return emptyResult

  if (supplierId && barcodeKey) {
    const { data, error } = await supabase
      .from('supplier_products')
      .select('id,supplier_id,product_id,supplier_product_name,supplier_barcode_key,barcode_raw,last_price,last_price_date,products(id,name,category,brand)')
      .eq('store_id', storeId)
      .eq('supplier_id', supplierId)
      .eq('supplier_barcode_key', barcodeKey)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const product = (data as any).products
      return {
        matched: true,
        strategy: 'barcode_key',
        product: product
          ? {
              id: String(product.id || ''),
              name: String(product.name || '—'),
              category: normalizeText(product.category),
              brand: normalizeText(product.brand),
            }
          : null,
        supplier_product: {
          id: String((data as any).id || ''),
          supplier_id: String((data as any).supplier_id || ''),
          product_id: String((data as any).product_id || ''),
          supplier_product_name: normalizeText((data as any).supplier_product_name),
          supplier_barcode_key: normalizeText((data as any).supplier_barcode_key),
          barcode_raw: normalizeText((data as any).barcode_raw),
          last_price: parseSafeNumber((data as any).last_price),
          last_price_date: normalizeText((data as any).last_price_date),
        },
        candidates: [],
      }
    }
  }

  if (supplierId && rawBarcode) {
    const { data, error } = await supabase
      .from('supplier_products')
      .select('id,supplier_id,product_id,supplier_product_name,supplier_barcode_key,barcode_raw,last_price,last_price_date,products(id,name,category,brand)')
      .eq('store_id', storeId)
      .eq('supplier_id', supplierId)
      .eq('barcode_raw', rawBarcode)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      const product = (data as any).products
      return {
        matched: true,
        strategy: 'barcode_raw',
        product: product
          ? {
              id: String(product.id || ''),
              name: String(product.name || '—'),
              category: normalizeText(product.category),
              brand: normalizeText(product.brand),
            }
          : null,
        supplier_product: {
          id: String((data as any).id || ''),
          supplier_id: String((data as any).supplier_id || ''),
          product_id: String((data as any).product_id || ''),
          supplier_product_name: normalizeText((data as any).supplier_product_name),
          supplier_barcode_key: normalizeText((data as any).supplier_barcode_key),
          barcode_raw: normalizeText((data as any).barcode_raw),
          last_price: parseSafeNumber((data as any).last_price),
          last_price_date: normalizeText((data as any).last_price_date),
        },
        candidates: [],
      }
    }
  }

  if (rawText) {
    let memoryQuery = supabase
      .from('product_match_memory')
      .select('matched_product_id,products(id,name,category,brand)')
      .eq('store_id', storeId)
      .eq('raw_text', rawText)
      .order('usage_count', { ascending: false })
      .limit(1)

    if (supplierId) {
      memoryQuery = memoryQuery.eq('supplier_id', supplierId)
    }

    const { data, error } = await memoryQuery.maybeSingle()
    if (error) throw error
    if (data && (data as any).products) {
      const product = (data as any).products
      return {
        matched: true,
        strategy: 'memory',
        product: {
          id: String(product.id || ''),
          name: String(product.name || '—'),
          category: normalizeText(product.category),
          brand: normalizeText(product.brand),
        },
        supplier_product: null,
        candidates: [],
      }
    }
  }

  if (rawText) {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,category,brand')
      .eq('store_id', storeId)
      .eq('name', rawText)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      return {
        matched: true,
        strategy: 'name',
        product: {
          id: String((data as any).id || ''),
          name: String((data as any).name || '—'),
          category: normalizeText((data as any).category),
          brand: normalizeText((data as any).brand),
        },
        supplier_product: null,
        candidates: [],
      }
    }

    const { data: candidates, error: candidatesError } = await supabase
      .from('products')
      .select('id,name,category,brand')
      .eq('store_id', storeId)
      .ilike('name', `%${rawText}%`)
      .limit(8)

    if (candidatesError) throw candidatesError

    return {
      matched: false,
      strategy: 'none',
      product: null,
      supplier_product: null,
      candidates: (candidates || []).map((c: any) => ({
        id: String(c.id || ''),
        name: String(c.name || '—'),
        category: normalizeText(c.category),
        brand: normalizeText(c.brand),
      })),
    }
  }

  return emptyResult
}

export async function importProductsBatch(
  supabase: SupabaseClient,
  payload: {
    store_id: string
    file_name?: string | null
    rows: ProductImportInputRow[]
  },
) {
  const storeId = payload.store_id
  const rows = payload.rows || []
  const fileName = normalizeText(payload.file_name)

  if (!storeId) throw new Error('Missing store_id')

  const { data: batchData, error: batchError } = await supabase
    .from('import_batches')
    .insert([
      {
        store_id: storeId,
        import_type: 'products',
        file_name: fileName,
        status: 'processing',
        total_rows: rows.length,
      },
    ])
    .select('id')
    .single()

  if (batchError) throw batchError

  const batchId = String((batchData as any).id)
  let inserted = 0
  let updated = 0
  let failed = 0

  const rowLogs: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const name = normalizeUpper(row.name)
    const category = normalizeText(row.category)
    const brand = normalizeText(row.brand)
    const unit = normalizeText(row.unit)
    const baseBarcode = normalizeText(row.base_barcode)

    if (!name) {
      failed += 1
      rowLogs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row.raw_data,
        parsed_name: null,
        parsed_barcode: baseBarcode,
        parsed_price: null,
        matched_product_id: null,
        action: 'failed',
        message: 'Missing product name',
      })
      continue
    }

    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId)
      .eq('name', name)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ category, brand, unit, base_barcode: baseBarcode, is_active: true })
        .eq('store_id', storeId)
        .eq('id', (existing as any).id)
      if (updateError) {
        failed += 1
        rowLogs.push({
          batch_id: batchId,
          store_id: storeId,
          raw_data: row.raw_data,
          parsed_name: name,
          parsed_barcode: baseBarcode,
          parsed_price: null,
          matched_product_id: null,
          action: 'failed',
          message: updateError.message,
        })
      } else {
        updated += 1
        rowLogs.push({
          batch_id: batchId,
          store_id: storeId,
          raw_data: row.raw_data,
          parsed_name: name,
          parsed_barcode: baseBarcode,
          parsed_price: null,
          matched_product_id: String((existing as any).id),
          action: 'updated',
          message: 'Updated existing product by name',
        })
      }
      continue
    }

    const { data: insertedRow, error: insertError } = await supabase
      .from('products')
      .insert([
        {
          store_id: storeId,
          name,
          category,
          brand,
          unit,
          base_barcode: baseBarcode,
          is_active: true,
        },
      ])
      .select('id')
      .single()

    if (insertError) {
      failed += 1
      rowLogs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row.raw_data,
        parsed_name: name,
        parsed_barcode: baseBarcode,
        parsed_price: null,
        matched_product_id: null,
        action: 'failed',
        message: insertError.message,
      })
    } else {
      inserted += 1
      rowLogs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row.raw_data,
        parsed_name: name,
        parsed_barcode: baseBarcode,
        parsed_price: null,
        matched_product_id: String((insertedRow as any).id),
        action: 'inserted',
        message: 'Inserted new product',
      })
    }
  }

  if (rowLogs.length > 0) {
    const { error: rowsError } = await supabase.from('import_batch_rows').insert(rowLogs)
    if (rowsError) throw rowsError
  }

  const finalStatus = failed > 0 ? 'completed_with_errors' : 'completed'
  const { error: updateBatchError } = await supabase
    .from('import_batches')
    .update({
      status: finalStatus,
      inserted_rows: inserted,
      updated_rows: updated,
      failed_rows: failed,
    })
    .eq('id', batchId)

  if (updateBatchError) throw updateBatchError

  return { batchId, inserted, updated, failed }
}

export async function importSupplierPricesBatch(
  supabase: SupabaseClient,
  payload: {
    store_id: string
    supplier_id: string
    file_name?: string | null
    rows: SupplierPriceImportInputRow[]
  },
) {
  const storeId = payload.store_id
  const supplierId = payload.supplier_id
  const rows = payload.rows || []
  const fileName = normalizeText(payload.file_name)

  if (!storeId) throw new Error('Missing store_id')
  if (!supplierId) throw new Error('Missing supplier_id')

  const { data: batchData, error: batchError } = await supabase
    .from('import_batches')
    .insert([
      {
        store_id: storeId,
        supplier_id: supplierId,
        import_type: 'prices',
        file_name: fileName,
        status: 'processing',
        total_rows: rows.length,
      },
    ])
    .select('id')
    .single()

  if (batchError) throw batchError

  const batchId = String((batchData as any).id)
  let inserted = 0
  let updated = 0
  let failed = 0
  let matched = 0
  let unmatched = 0
  let increased = 0
  let decreased = 0

  const rowLogs: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const candidate = await matchProductCandidate(supabase, {
      store_id: storeId,
      supplier_id: supplierId,
      raw_text: row.supplier_product_name,
      raw_barcode: row.barcode_raw,
      supplier_barcode_key: row.supplier_barcode_key,
    })

    const price = parseSafeNumber(row.price)
    const quantity = parseSafeNumber(row.quantity)
    const invoiceDate = parseSafeDate(row.invoice_date)

    if (!candidate.matched || !candidate.product || !invoiceDate || price === null) {
      failed += 1
      unmatched += 1
      rowLogs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row.raw_data,
        parsed_name: normalizeText(row.supplier_product_name),
        parsed_barcode: normalizeText(row.supplier_barcode_key) || normalizeText(row.barcode_raw),
        parsed_price: price,
        matched_product_id: null,
        action: 'unmatched',
        message: !candidate.matched
          ? 'needs manual match'
          : !invoiceDate
            ? 'invalid invoice_date'
            : 'invalid price',
      })
      continue
    }

    matched += 1

    let supplierProductId = candidate.supplier_product?.id || null
    let previousPrice: number | null = null

    if (supplierProductId) {
      previousPrice = parseSafeNumber(candidate.supplier_product?.last_price)
      const { error: updateSupplierProductError } = await supabase
        .from('supplier_products')
        .update({
          last_price: price,
          last_price_date: invoiceDate,
          supplier_product_name: normalizeText(row.supplier_product_name),
          supplier_barcode_key: normalizeText(row.supplier_barcode_key),
          barcode_raw: normalizeText(row.barcode_raw),
          is_active: true,
        })
        .eq('id', supplierProductId)
        .eq('store_id', storeId)

      if (updateSupplierProductError) {
        failed += 1
        rowLogs.push({
          batch_id: batchId,
          store_id: storeId,
          raw_data: row.raw_data,
          parsed_name: normalizeText(row.supplier_product_name),
          parsed_barcode: normalizeText(row.supplier_barcode_key) || normalizeText(row.barcode_raw),
          parsed_price: price,
          matched_product_id: candidate.product.id,
          action: 'failed',
          message: updateSupplierProductError.message,
        })
        continue
      }

      updated += 1
    } else {
      const { data: newSupplierProduct, error: createSupplierProductError } = await supabase
        .from('supplier_products')
        .insert([
          {
            store_id: storeId,
            supplier_id: supplierId,
            product_id: candidate.product.id,
            supplier_product_name: normalizeText(row.supplier_product_name),
            supplier_barcode_key: normalizeText(row.supplier_barcode_key),
            barcode_raw: normalizeText(row.barcode_raw),
            last_price: price,
            last_price_date: invoiceDate,
            is_active: true,
          },
        ])
        .select('id')
        .single()

      if (createSupplierProductError) {
        failed += 1
        rowLogs.push({
          batch_id: batchId,
          store_id: storeId,
          raw_data: row.raw_data,
          parsed_name: normalizeText(row.supplier_product_name),
          parsed_barcode: normalizeText(row.supplier_barcode_key) || normalizeText(row.barcode_raw),
          parsed_price: price,
          matched_product_id: candidate.product.id,
          action: 'failed',
          message: createSupplierProductError.message,
        })
        continue
      }

      supplierProductId = String((newSupplierProduct as any).id)
      inserted += 1
    }

    const priceDiff = previousPrice === null ? null : price - previousPrice
    const trendLabel =
      priceDiff === null || priceDiff === 0
        ? null
        : priceDiff > 0
          ? 'PRICE INCREASE'
          : 'PRICE DROP'

    if (trendLabel === 'PRICE INCREASE') increased += 1
    if (trendLabel === 'PRICE DROP') decreased += 1

    const { error: historyInsertError } = await supabase.from('product_price_history').insert([
      {
        store_id: storeId,
        supplier_id: supplierId,
        product_id: candidate.product.id,
        supplier_product_id: supplierProductId,
        invoice_date: invoiceDate,
        price,
        previous_price: previousPrice,
        price_diff: priceDiff,
        quantity,
        source: 'import',
        source_file_name: fileName,
        notes: trendLabel,
      },
    ])

    if (historyInsertError) {
      failed += 1
      rowLogs.push({
        batch_id: batchId,
        store_id: storeId,
        raw_data: row.raw_data,
        parsed_name: normalizeText(row.supplier_product_name),
        parsed_barcode: normalizeText(row.supplier_barcode_key) || normalizeText(row.barcode_raw),
        parsed_price: price,
        matched_product_id: candidate.product.id,
        action: 'failed',
        message: historyInsertError.message,
      })
      continue
    }

    rowLogs.push({
      batch_id: batchId,
      store_id: storeId,
      raw_data: row.raw_data,
      parsed_name: normalizeText(row.supplier_product_name),
      parsed_barcode: normalizeText(row.supplier_barcode_key) || normalizeText(row.barcode_raw),
      parsed_price: price,
      matched_product_id: candidate.product.id,
      action: 'matched',
      message: trendLabel
        ? `matched by ${candidate.strategy} | ${trendLabel} (${priceDiff?.toFixed(3)})`
        : `matched by ${candidate.strategy}`,
    })
  }

  if (rowLogs.length > 0) {
    const { error: rowsError } = await supabase.from('import_batch_rows').insert(rowLogs)
    if (rowsError) throw rowsError
  }

  const finalStatus = failed > 0 ? 'completed_with_errors' : 'completed'
  const notes = `matched=${matched} unmatched=${unmatched} price_increase=${increased} price_drop=${decreased}`

  const { error: updateBatchError } = await supabase
    .from('import_batches')
    .update({
      status: finalStatus,
      inserted_rows: inserted,
      updated_rows: updated,
      failed_rows: failed,
      notes,
    })
    .eq('id', batchId)

  if (updateBatchError) throw updateBatchError

  return { batchId, inserted, updated, failed, matched, unmatched, increased, decreased }
}
