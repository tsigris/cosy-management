import * as XLSX from 'xlsx'
import pdfParse from 'pdf-parse'
import { normalizeText, parseSafeDate, parseSafeNumber, type SupplierPriceImportInputRow } from '@/lib/productsModule'

export type SupportedImportFileType = 'csv' | 'xlsx' | 'pdf' | 'unknown'

export type ImportParseStatus = 'parsed' | 'manual_review' | 'failed'

export type ImportParseResult = {
  fileType: SupportedImportFileType
  isScannedPdf: boolean
  previewRows: Array<Record<string, unknown>>
  warnings: string[]
  rawText: string
  parseStatus: ImportParseStatus
}

function detectFileType(fileName: string, mimeType: string): SupportedImportFileType {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv') || mimeType.includes('csv')) return 'csv'
  if (lower.endsWith('.xlsx') || mimeType.includes('spreadsheetml')) return 'xlsx'
  if (lower.endsWith('.pdf') || mimeType.includes('pdf')) return 'pdf'
  return 'unknown'
}

function sheetRowsFromBuffer(buffer: Buffer): Array<Record<string, unknown>> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Array<Record<string, unknown>>>(firstSheet, { defval: null }) as unknown as Array<Record<string, unknown>>
}

export function parseCsvFile(buffer: Buffer): ImportParseResult {
  const rows = sheetRowsFromBuffer(buffer)
  return {
    fileType: 'csv',
    isScannedPdf: false,
    previewRows: rows,
    warnings: [],
    rawText: '',
    parseStatus: rows.length > 0 ? 'parsed' : 'failed',
  }
}

export function parseXlsxFile(buffer: Buffer): ImportParseResult {
  const rows = sheetRowsFromBuffer(buffer)
  return {
    fileType: 'xlsx',
    isScannedPdf: false,
    previewRows: rows,
    warnings: [],
    rawText: '',
    parseStatus: rows.length > 0 ? 'parsed' : 'failed',
  }
}

function extractCandidateRowsFromPdfText(rawText: string): SupplierPriceImportInputRow[] {
  const rows: SupplierPriceImportInputRow[] = []
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const priceRegex = /(\d+[\.,]\d{2,4})/
  const dateRegex = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/
  const barcodeRegex = /\b\d{8,14}\b/

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const priceMatch = line.match(priceRegex)
    if (!priceMatch) continue

    const dateMatch = line.match(dateRegex)
    const barcodeMatch = line.match(barcodeRegex)

    const price = parseSafeNumber(priceMatch[1])
    const invoiceDate = parseSafeDate(dateMatch ? dateMatch[1] : null)
    const barcode = normalizeText(barcodeMatch ? barcodeMatch[0] : null)

    const supplierProductName = normalizeText(
      line
        .replace(priceMatch[1], ' ')
        .replace(dateMatch?.[1] || '', ' ')
        .replace(barcodeMatch?.[0] || '', ' '),
    )

    rows.push({
      supplier_product_name: supplierProductName,
      barcode_raw: barcode,
      supplier_barcode_key: barcode,
      price,
      quantity: null,
      invoice_date: invoiceDate,
      raw_data: { line, line_index: i + 1 },
    })
  }

  return rows
}

export function detectScannedPdf(rawText: string): boolean {
  const compact = rawText.replace(/\s+/g, '')
  return compact.length < 40
}

export async function parsePdfTextFile(buffer: Buffer): Promise<ImportParseResult> {
  try {
    const parsed = await pdfParse(buffer)
    const rawText = String(parsed.text || '').trim()
    const isScanned = detectScannedPdf(rawText)

    if (isScanned) {
      return {
        fileType: 'pdf',
        isScannedPdf: true,
        previewRows: [],
        warnings: ['Το PDF φαίνεται να είναι image-only/scanned. Απαιτείται OCR στο επόμενο βήμα.'],
        rawText,
        parseStatus: 'manual_review',
      }
    }

    const candidates = extractCandidateRowsFromPdfText(rawText)

    if (candidates.length === 0) {
      return {
        fileType: 'pdf',
        isScannedPdf: false,
        previewRows: [],
        warnings: ['Βρέθηκε text αλλά δεν εντοπίστηκαν γραμμές τιμολόγησης με ασφάλεια.'],
        rawText,
        parseStatus: 'manual_review',
      }
    }

    return {
      fileType: 'pdf',
      isScannedPdf: false,
      previewRows: candidates as unknown as Array<Record<string, unknown>>,
      warnings: [],
      rawText,
      parseStatus: 'parsed',
    }
  } catch {
    return {
      fileType: 'pdf',
      isScannedPdf: false,
      previewRows: [],
      warnings: ['Αποτυχία ανάγνωσης PDF. Το αρχείο μπήκε σε manual review.'],
      rawText: '',
      parseStatus: 'manual_review',
    }
  }
}

export async function parseImportFile(fileName: string, mimeType: string, buffer: Buffer): Promise<ImportParseResult> {
  const fileType = detectFileType(fileName, mimeType)

  if (fileType === 'csv') return parseCsvFile(buffer)
  if (fileType === 'xlsx') return parseXlsxFile(buffer)
  if (fileType === 'pdf') return parsePdfTextFile(buffer)

  return {
    fileType: 'unknown',
    isScannedPdf: false,
    previewRows: [],
    warnings: ['Μη υποστηριζόμενος τύπος αρχείου. Επιτρέπονται csv, xlsx, pdf.'],
    rawText: '',
    parseStatus: 'failed',
  }
}
