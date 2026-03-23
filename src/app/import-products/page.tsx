'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { getCurrentStoreId, normalizeText } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Upload } from 'lucide-react'

type ParsedRow = Record<string, unknown>

type Mapping = {
  name: string
  category: string
  brand: string
  unit: string
  base_barcode: string
}

const colors = {
  primaryDark: '#0f172a',
  secondaryText: '#64748b',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

function ImportProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = getCurrentStoreId(searchParams)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [mapping, setMapping] = useState<Mapping>({
    name: 'name',
    category: 'category',
    brand: 'brand',
    unit: 'unit',
    base_barcode: 'base_barcode',
  })
  const [submitting, setSubmitting] = useState(false)

  if (!storeId) {
    router.replace('/select-store')
    return null
  }

  const headers = useMemo(() => {
    const first = rows[0]
    return first ? Object.keys(first) : []
  }, [rows])

  async function handleFile(file: File) {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const parsed = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null })
      setRows(parsed)
      setFileName(file.name)
      console.log('[import-products] preview rows', parsed.slice(0, 3))
    } catch (error) {
      console.error('[import-products] parse failed', error)
      toast.error('Αδυναμία ανάγνωσης αρχείου')
    }
  }

  async function submitImport() {
    if (rows.length === 0) {
      toast.error('Δεν υπάρχουν γραμμές προς εισαγωγή')
      return
    }

    setSubmitting(true)
    try {
      const normalizedRows = rows.map((row) => ({
        name: normalizeText(row[mapping.name]),
        category: normalizeText(row[mapping.category]),
        brand: normalizeText(row[mapping.brand]),
        unit: normalizeText(row[mapping.unit]),
        base_barcode: normalizeText(row[mapping.base_barcode]),
        raw_data: row,
      }))

      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          file_name: fileName,
          rows: normalizedRows,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Import failed')

      toast.success(`Επιτυχία: ${data.inserted} insert / ${data.updated} update / ${data.failed} failed`)
    } catch (error) {
      console.error('[import-products] submit failed', error)
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
            <h1 style={titleStyle}>Import Προϊόντων</h1>
            <p style={subtitleStyle}>CSV / XLSX με preview και mapping</p>
          </div>
          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            <ChevronLeft size={20} />
          </Link>
        </header>

        <div style={card}>
          <label style={labelStyle}><Upload size={14} /> Αρχείο</label>
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
              <MappingSelect label="name" value={mapping.name} onChange={(v) => setMapping((m) => ({ ...m, name: v }))} options={headers} />
              <MappingSelect label="category" value={mapping.category} onChange={(v) => setMapping((m) => ({ ...m, category: v }))} options={headers} />
              <MappingSelect label="brand" value={mapping.brand} onChange={(v) => setMapping((m) => ({ ...m, brand: v }))} options={headers} />
              <MappingSelect label="unit" value={mapping.unit} onChange={(v) => setMapping((m) => ({ ...m, unit: v }))} options={headers} />
              <MappingSelect label="base_barcode" value={mapping.base_barcode} onChange={(v) => setMapping((m) => ({ ...m, base_barcode: v }))} options={headers} />
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
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function ImportProductsPage() {
  return (
    <Suspense fallback={null}>
      <ImportProductsContent />
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
