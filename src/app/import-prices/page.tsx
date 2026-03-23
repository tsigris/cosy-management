'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getCurrentStoreId, normalizeText, parseSafeDate, parseSafeNumber } from '@/lib/productsModule'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Upload } from 'lucide-react'

type ParsedRow = Record<string, unknown>

type PdfParsedRow = {
  parsed_name?: string
  parsed_price?: number | null
  parsed_barcode?: string | null
  raw_line?: string
}

type ProductSearchItem = {
  id: string
  name: string
  category: string | null
  brand: string | null
}

type ParseStatus = 'parsed' | 'manual_review' | 'failed'

type FileType = 'csv' | 'xlsx' | 'pdf' | 'unknown'

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
  const [uploadedFileType, setUploadedFileType] = useState<FileType>('unknown')
  const [isScannedPdf, setIsScannedPdf] = useState(false)
  const [parseStatus, setParseStatus] = useState<ParseStatus>('failed')
  const [warnings, setWarnings] = useState<string[]>([])
  const [rawText, setRawText] = useState('')
  const [activeFile, setActiveFile] = useState<File | null>(null)
  const [importSummary, setImportSummary] = useState<{
    matched: number
    unmatched: number
    failed: number
    increased: number
    decreased: number
  } | null>(null)
  const [matchModalRowIndex, setMatchModalRowIndex] = useState<number | null>(null)
  const [matchSearch, setMatchSearch] = useState('')
  const [debouncedMatchSearch, setDebouncedMatchSearch] = useState('')
  const [matchCandidates, setMatchCandidates] = useState<ProductSearchItem[]>([])
  const [matchSearchLoading, setMatchSearchLoading] = useState(false)
  const [savingMatchProductId, setSavingMatchProductId] = useState<string | null>(null)
  const [manualMatches, setManualMatches] = useState<Record<number, ProductSearchItem>>({})

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
        const next = (data || []).map((s: Record<string, unknown>) => ({
          id: String(s.id || ''),
          name: String(s.name || '—'),
        }))
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

  const activePdfRow = useMemo(() => {
    if (matchModalRowIndex === null) return null
    const row = rows[matchModalRowIndex] as PdfParsedRow | undefined
    return row || null
  }, [matchModalRowIndex, rows])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMatchSearch(matchSearch.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [matchSearch])

  useEffect(() => {
    if (matchModalRowIndex === null || !storeId) return

    const queryText = debouncedMatchSearch.trim()
    if (!queryText) {
      setMatchCandidates([])
      return
    }

    let cancelled = false
    const searchProducts = async () => {
      setMatchSearchLoading(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,category,brand')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .ilike('name', `%${queryText}%`)
          .order('name', { ascending: true })
          .limit(20)

        if (error) throw error

        if (!cancelled) {
          setMatchCandidates(
            (data || []).map((p: Record<string, unknown>) => ({
              id: String(p.id || ''),
              name: String(p.name || '—'),
              category: normalizeText(p.category),
              brand: normalizeText(p.brand),
            })),
          )
        }
      } catch (error) {
        console.error('[import-prices] product search failed', error)
        if (!cancelled) setMatchCandidates([])
      } finally {
        if (!cancelled) setMatchSearchLoading(false)
      }
    }

    void searchProducts()
    return () => {
      cancelled = true
    }
  }, [debouncedMatchSearch, matchModalRowIndex, storeId, supabase])

  if (!storeId) return null

  async function handleFile(file: File) {
    try {
      const lowerName = file.name.toLowerCase()
      const allowedExt = lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.pdf')
      if (!allowedExt) {
        toast.error('Μη υποστηριζόμενο format. Επιτρέπονται csv, xlsx, pdf.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Το αρχείο είναι πολύ μεγάλο (max 10MB).')
        return
      }

      setActiveFile(file)
      setFileName(file.name)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('store_id', String(storeId ?? ''))
      formData.append('supplier_id', String(supplierId ?? ''))

      const res = await fetch('/api/prices/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Αποτυχία parsing αρχείου')

      setUploadedFileType((data.fileType || 'unknown') as FileType)
      setIsScannedPdf(Boolean(data.isScannedPdf))
      setWarnings(Array.isArray(data.warnings) ? data.warnings : [])
      setRawText(typeof data.rawText === 'string' ? data.rawText : '')
      setParseStatus((data.parseStatus || 'failed') as ParseStatus)
      setRows(Array.isArray(data.previewRows) ? data.previewRows : [])
      setImportSummary(null)
      setManualMatches({})
    } catch (error) {
      console.error('[import-prices] parse failed', error)
      toast.error(error instanceof Error ? error.message : 'Αδυναμία ανάγνωσης αρχείου')
    }
  }

  function openMatchModal(rowIndex: number) {
    const row = rows[rowIndex] as PdfParsedRow | undefined
    setMatchModalRowIndex(rowIndex)
    setMatchCandidates([])
    setMatchSearch(normalizeText(row?.parsed_name) || '')
  }

  function closeMatchModal() {
    setMatchModalRowIndex(null)
    setMatchSearch('')
    setDebouncedMatchSearch('')
    setMatchCandidates([])
    setSavingMatchProductId(null)
  }

  async function saveMatchMemory(product: ProductSearchItem) {
    if (matchModalRowIndex === null || !storeId || !supplierId) return

    const row = rows[matchModalRowIndex] as PdfParsedRow | undefined
    const rawText = normalizeText(row?.parsed_name)
    const rawBarcode = normalizeText(row?.parsed_barcode)
    if (!rawText) {
      toast.error('Λείπει parsed_name για αποθήκευση match memory')
      return
    }

    setSavingMatchProductId(product.id)
    try {
      const res = await fetch('/api/products/match-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          supplier_id: supplierId,
          raw_text: rawText,
          raw_barcode: rawBarcode,
          matched_product_id: product.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Αποτυχία αποθήκευσης match')

      setManualMatches((prev) => ({ ...prev, [matchModalRowIndex]: product }))
      toast.success(`Αποθηκεύτηκε match memory (${data.action}) για ${product.name}`)
      closeMatchModal()
    } catch (error) {
      console.error('[import-prices] save match memory failed', error)
      toast.error(error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης match')
    } finally {
      setSavingMatchProductId(null)
    }
  }

  async function submitImport() {
    if (!supplierId) {
      toast.error('Επιλέξτε προμηθευτή')
      return
    }
    if (!activeFile) {
      toast.error('Ανεβάστε αρχείο')
      return
    }
    if (rows.length === 0) {
      if (uploadedFileType === 'pdf' && parseStatus === 'manual_review') {
        toast.error('Το PDF είναι σε manual review. Το OCR θα προστεθεί στο επόμενο βήμα.')
      } else {
        toast.error('Δεν υπάρχουν γραμμές προς εισαγωγή')
      }
      return
    }

    setSubmitting(true)
    try {
      const normalizedRows = uploadedFileType === 'pdf'
        ? rows.map((row) => {
            const parsedRow = row as PdfParsedRow & ParsedRow
            return {
              supplier_product_name: normalizeText(parsedRow.parsed_name ?? parsedRow.supplier_product_name),
              barcode_raw: normalizeText(parsedRow.parsed_barcode ?? parsedRow.barcode_raw),
              supplier_barcode_key: normalizeText(parsedRow.parsed_barcode ?? parsedRow.supplier_barcode_key),
              price: parseSafeNumber(parsedRow.parsed_price ?? parsedRow.price),
              quantity: parseSafeNumber(parsedRow.quantity),
              invoice_date: parseSafeDate(parsedRow.invoice_date),
              raw_data: row,
            }
          })
        : rows.map((row) => ({
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
        increased: data.increased,
        decreased: data.decreased,
      })

      setImportSummary({
        matched: Number(data.matched || 0),
        unmatched: Number(data.unmatched || 0),
        failed: Number(data.failed || 0),
        increased: Number(data.increased || 0),
        decreased: Number(data.decreased || 0),
      })

      toast.success(
        `matched=${data.matched} unmatched=${data.unmatched} failed=${data.failed} ↑${data.increased || 0} ↓${data.decreased || 0}`,
      )
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
            accept=".csv,.xlsx,.pdf"
            style={inputStyle}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          {fileName && <p style={hint}>Αρχείο: {fileName}</p>}
          {fileName && <p style={hint}>Τύπος: {uploadedFileType.toUpperCase()}</p>}
          {uploadedFileType === 'pdf' && <span style={pdfBadge}>PDF / Scan import</span>}
          {warnings.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {warnings.map((warning, idx) => (
                <p key={idx} style={warningText}>{warning}</p>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <>
            {(uploadedFileType === 'csv' || uploadedFileType === 'xlsx') && (
              <div style={card}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 900, fontSize: 14 }}>Column Mapping</p>
                <MappingSelect label="supplier_product_name" value={mapping.supplier_product_name} onChange={(v) => setMapping((m) => ({ ...m, supplier_product_name: v }))} options={headers} />
                <MappingSelect label="barcode_raw" value={mapping.barcode_raw} onChange={(v) => setMapping((m) => ({ ...m, barcode_raw: v }))} options={headers} />
                <MappingSelect label="supplier_barcode_key" value={mapping.supplier_barcode_key} onChange={(v) => setMapping((m) => ({ ...m, supplier_barcode_key: v }))} options={headers} />
                <MappingSelect label="price" value={mapping.price} onChange={(v) => setMapping((m) => ({ ...m, price: v }))} options={headers} />
                <MappingSelect label="quantity" value={mapping.quantity} onChange={(v) => setMapping((m) => ({ ...m, quantity: v }))} options={headers} />
                <MappingSelect label="invoice_date" value={mapping.invoice_date} onChange={(v) => setMapping((m) => ({ ...m, invoice_date: v }))} options={headers} />
              </div>
            )}

            <div style={card}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 900, fontSize: 14 }}>
                {uploadedFileType === 'pdf' ? 'Preview candidate rows από PDF' : 'Preview (20 rows)'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {uploadedFileType === 'pdf' ? (
                  rows.slice(0, 20).map((row, idx) => {
                    const pdfRow = row as PdfParsedRow
                    const parsedName = normalizeText(pdfRow.parsed_name)
                    const parsedPrice = parseSafeNumber(pdfRow.parsed_price)
                    const parsedBarcode = normalizeText(pdfRow.parsed_barcode)
                    const selectedProduct = manualMatches[idx]

                    return (
                      <div key={idx} style={pdfRowCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <p style={{ margin: 0, fontWeight: 900, fontSize: 13, color: colors.primaryDark }}>
                            {parsedName || '—'}
                          </p>
                          <button type="button" style={matchBtn} onClick={() => openMatchModal(idx)}>
                            Match προϊόν
                          </button>
                        </div>
                        <p style={miniText}>Τιμή: {parsedPrice !== null ? parsedPrice.toFixed(3) : '—'} €</p>
                        <p style={miniText}>Barcode: {parsedBarcode || '—'}</p>
                        <p style={rawLineText}>{normalizeText(pdfRow.raw_line) || '—'}</p>
                        {selectedProduct && (
                          <p style={manualMatchTag}>Manual match: {selectedProduct.name}</p>
                        )}
                      </div>
                    )
                  })
                ) : (
                  rows.slice(0, 20).map((row, idx) => (
                    <div key={idx} style={previewRow}>{JSON.stringify(row)}</div>
                  ))
                )}
              </div>
            </div>

            {importSummary && (
              <div style={card}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 14 }}>Import Summary</p>
                <p style={miniText}>matched={importSummary.matched} unmatched={importSummary.unmatched} failed={importSummary.failed}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={importSummary.increased > 0 ? increaseTag : neutralTag}>PRICE INCREASE: {importSummary.increased}</span>
                  <span style={importSummary.decreased > 0 ? decreaseTag : neutralTag}>PRICE DROP: {importSummary.decreased}</span>
                </div>
              </div>
            )}

            <button type="button" onClick={() => void submitImport()} disabled={submitting} style={submitBtn}>
              {submitting ? 'Γίνεται εισαγωγή...' : 'Επιβεβαίωση Import'}
            </button>
          </>
        )}

        {uploadedFileType === 'pdf' && parseStatus === 'manual_review' && (
          <div style={manualReviewCard}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 14 }}>PDF / Scan import</p>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>File: {fileName || '—'}</p>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
              detected as scanned: {isScannedPdf ? 'yes' : 'no'}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, fontWeight: 800, color: '#92400e' }}>
              Το PDF φαίνεται να είναι σκαναρισμένο και χρειάζεται OCR step στο επόμενο βήμα.
            </p>
          </div>
        )}

        {uploadedFileType === 'pdf' && parseStatus === 'parsed' && rawText && (
          <details style={card}>
            <summary style={{ fontWeight: 900, cursor: 'pointer' }}>Raw extracted text</summary>
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 11, color: colors.secondaryText }}>{rawText.slice(0, 4000)}</pre>
          </details>
        )}

        {matchModalRowIndex !== null && activePdfRow && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: colors.primaryDark }}>Manual Match Προϊόντος</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: 700, color: colors.secondaryText }}>
                Parsed: {normalizeText(activePdfRow.parsed_name) || '—'}
              </p>
              <input
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                placeholder="Αναζήτηση προϊόντος"
                style={{ ...inputStyle, marginTop: 10 }}
              />
              <div style={{ marginTop: 10, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matchSearchLoading && <p style={miniText}>Αναζήτηση...</p>}
                {!matchSearchLoading && matchCandidates.length === 0 && <p style={miniText}>Δεν βρέθηκαν αποτελέσματα</p>}
                {matchCandidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    onClick={() => void saveMatchMemory(candidate)}
                    disabled={savingMatchProductId === candidate.id}
                    style={matchCandidateBtn}
                  >
                    <span style={{ fontWeight: 900, fontSize: 13, color: colors.primaryDark }}>{candidate.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: colors.secondaryText }}>
                      {[candidate.category, candidate.brand].filter(Boolean).join(' • ') || '—'}
                    </span>
                    {savingMatchProductId === candidate.id && <span style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8' }}>Αποθήκευση...</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={closeMatchModal} style={{ ...submitBtn, marginTop: 10, backgroundColor: '#475569' }}>
                Κλείσιμο
              </button>
            </div>
          </div>
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
const pdfBadge: any = { marginTop: 8, display: 'inline-block', padding: '4px 8px', borderRadius: 999, backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 900, fontSize: 11 }
const warningText = { margin: 0, fontSize: 11, fontWeight: 800, color: '#92400e' }
const previewRow: any = { border: `1px solid ${colors.border}`, borderRadius: 10, padding: 8, backgroundColor: '#f8fafc', fontSize: 11, fontWeight: 700, color: colors.secondaryText, overflowX: 'auto' }
const pdfRowCard: any = { border: `1px solid ${colors.border}`, borderRadius: 12, padding: 10, backgroundColor: '#f8fafc' }
const miniText = { margin: '6px 0 0 0', fontSize: 11, fontWeight: 800, color: colors.secondaryText }
const rawLineText = { margin: '6px 0 0 0', fontSize: 11, fontWeight: 700, color: '#475569', backgroundColor: '#eef2ff', borderRadius: 8, padding: '6px 8px' }
const manualMatchTag = { margin: '8px 0 0 0', fontSize: 11, fontWeight: 900, color: '#065f46', backgroundColor: '#d1fae5', borderRadius: 999, padding: '4px 8px', display: 'inline-block' }
const matchBtn: any = { border: '1px solid #bfdbfe', borderRadius: 8, backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 900, fontSize: 11, padding: '6px 8px' }
const increaseTag: any = { display: 'inline-block', padding: '4px 8px', borderRadius: 999, backgroundColor: '#fee2e2', color: '#991b1b', fontSize: 11, fontWeight: 900 }
const decreaseTag: any = { display: 'inline-block', padding: '4px 8px', borderRadius: 999, backgroundColor: '#dcfce7', color: '#065f46', fontSize: 11, fontWeight: 900 }
const neutralTag: any = { display: 'inline-block', padding: '4px 8px', borderRadius: 999, backgroundColor: '#e2e8f0', color: '#334155', fontSize: 11, fontWeight: 900 }
const modalOverlay: any = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }
const modalCard: any = { width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto', backgroundColor: colors.white, borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14 }
const matchCandidateBtn: any = { width: '100%', textAlign: 'left', border: `1px solid ${colors.border}`, borderRadius: 10, backgroundColor: '#f8fafc', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }
const submitBtn: any = { width: '100%', border: 'none', borderRadius: 12, backgroundColor: colors.primaryDark, color: '#fff', padding: 14, fontSize: 15, fontWeight: 900 }
const manualReviewCard: any = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 12, marginBottom: 10 }
