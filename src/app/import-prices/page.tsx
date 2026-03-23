'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { getSupabase } from '@/lib/supabase'
import { getCurrentStoreId, normalizeText, parseSafeDate, parseSafeNumber } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Upload } from 'lucide-react'

type ParsedRow = Record<string, unknown>

type Mapping = {
  supplier_product_name: string
  barcode_raw: string
  supplier_barcode_key: string
  price: string
  quantity: string
  invoice_date: string
}

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

function ImportPricesContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = getCurrentStoreId(searchParams)

  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [supplierId, setSupplierId] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Mapping>({
    supplier_product_name: 'supplier_product_name',
    barcode_raw: 'barcode_raw',
    supplier_barcode_key: 'supplier_barcode_key',
    price: 'price',
    quantity: 'quantity',
    invoice_date: 'invoice_date',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!storeId) {
      router.replace('/select-store')
      return
    }

    const loadSuppliers = async () => {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('id,name')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) throw error
        const next = (data || []).map((s: any) => ({ id: String(s.id || ''), name: String(s.name || '—') }))
        setSuppliers(next)
        if (next.length > 0) setSupplierId(next[0].id)
      } catch (error) {
        console.error('[import-prices] suppliers load failed', error)
      }
    }

    void loadSuppliers()
  }, [storeId, router, supabase])

  const headers = useMemo(() => {
    const first = rows[0]
    return first ? Object.keys(first) : []
  }, [rows])

  if (!storeId) return null

  async function handleFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const parsed = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null })
      setRows(parsed)
      setFileName(file.name)
    } catch (error) {
      console.error('[import-prices] parse failed', error)
      toast.error('Αδυναμία ανάγνωσης αρχείου')
    }
  }

  async function submitImport() {
    if (!supplierId) {
      toast.error('Επιλέξτε προμηθευτή')
      return
    }
    if (rows.length === 0) {
      toast.error('Δεν υπάρχουν γραμμές προς εισαγωγή')
      return
    }

    setSubmitting(true)
    try {
      const normalizedRows = rows.map((row) => ({
        supplier_product_name: normalizeText(row[mapping.supplier_product_name]),
        barcode_raw: normalizeText(row[mapping.barcode_raw]),
        supplier_barcode_key: normalizeText(row[mapping.supplier_barcode_key]),
        price: parseSafeNumber(row[mapping.price]),
        quantity: parseSafeNumber(row[mapping.quantity]),
        invoice_date: parseSafeDate(row[mapping.invoice_date]),
        raw_data: row,
      }))

      const res = await fetch('/api/prices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          supplier_id: supplierId,
          file_name: fileName,
          rows: normalizedRows,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Import failed')

      console.log('[import-prices] matched/unmatched summary', {
        matched: data.matched,
        unmatched: data.unmatched,
        failed: data.failed,
      })

      toast.success(`matched=${data.matched} unmatched=${data.unmatched} failed=${data.failed}`)
    } catch (error) {
      console.error('[import-prices] submit failed', error)
      toast.error(error instanceof Error ? error.message : 'Αποτυχία import')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={wrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
        <header style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Import Τιμών Προμηθευτή</h1>
            <p style={subtitleStyle}>CSV / XLSX με ασφαλές matching</p>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        <div style={card}>
          <label style={labelStyle}>Προμηθευτής</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={inputStyle}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label style={{ ...labelStyle, marginTop: 10 }}><Upload size={14} /> Αρχείο</label>
          <input
            type="file"
            accept=".csv,.xlsx"
            style={inputStyle}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          {fileName && <p style={hint}>Αρχείο: {fileName}</p>}
        </div>

        {rows.length > 0 && (
          <>
            <div style={card}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 900, fontSize: 14 }}>Column Mapping</p>
              <MappingSelect label="supplier_product_name" value={mapping.supplier_product_name} onChange={(v) => setMapping((m) => ({ ...m, supplier_product_name: v }))} options={headers} />
              <MappingSelect label="barcode_raw" value={mapping.barcode_raw} onChange={(v) => setMapping((m) => ({ ...m, barcode_raw: v }))} options={headers} />
              <MappingSelect label="supplier_barcode_key" value={mapping.supplier_barcode_key} onChange={(v) => setMapping((m) => ({ ...m, supplier_barcode_key: v }))} options={headers} />
              <MappingSelect label="price" value={mapping.price} onChange={(v) => setMapping((m) => ({ ...m, price: v }))} options={headers} />
              <MappingSelect label="quantity" value={mapping.quantity} onChange={(v) => setMapping((m) => ({ ...m, quantity: v }))} options={headers} />
              <MappingSelect label="invoice_date" value={mapping.invoice_date} onChange={(v) => setMapping((m) => ({ ...m, invoice_date: v }))} options={headers} />
            </div>

            <div style={card}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 900, fontSize: 14 }}>Preview (20 rows)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.slice(0, 20).map((row, idx) => (
                  <div key={idx} style={previewRow}>{JSON.stringify(row)}</div>
                ))}
              </div>
            </div>

            <button type="button" onClick={() => void submitImport()} disabled={submitting} style={submitBtn}>
              {submitting ? 'Γίνεται εισαγωγή...' : 'Επιβεβαίωση Import'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MappingSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  )
}

export default function ImportPricesPage() {
  return (
    <Suspense fallback={null}>
      <ImportPricesContent />
    </Suspense>
  )
}

const wrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: 20 }
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }
const titleStyle = { margin: 0, fontWeight: 900, fontSize: 24, color: colors.primaryDark }
const subtitleStyle = { margin: '4px 0 0 0', fontWeight: 700, fontSize: 12, color: colors.secondaryText }
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${colors.border}`, borderRadius: 12, backgroundColor: colors.white }
const card: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 12, marginBottom: 10 }
const labelStyle: any = { display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 900, color: colors.secondaryText }
const inputStyle: any = { width: '100%', padding: 14, border: `1px solid ${colors.border}`, borderRadius: 12, fontSize: 16, fontWeight: 700, backgroundColor: '#f8fafc' }
const hint = { margin: '8px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }
const previewRow: any = { border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, backgroundColor: '#f8fafc', fontSize: 11, fontWeight: 700, color: colors.secondaryText, overflowX: 'auto' }
const submitBtn: any = { width: '100%', border: 'none', borderRadius: 12, backgroundColor: colors.primaryDark, color: '#fff', padding: 14, fontSize: 15, fontWeight: 900 }
