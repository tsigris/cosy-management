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
    .filter((line) => line.length >= 5)

  // Supports 1.20, 12,30, 17.380
  const numericLikeRegex = /\b\d{1,6}(?:[\.,]\d{1,4})?\b/g
  const dateRegex = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/
  const barcodeRegex = /\b\d{6,14}\b/

  for (let i = 0; i < lines.length; i += 1) {
    if (rows.length >= 30) break

    const line = lines[i]
    const numericTokens = line.match(numericLikeRegex) || []
    if (numericTokens.length === 0) continue

    const lastNumericToken = numericTokens[numericTokens.length - 1]
    const parsedPrice = parseSafeNumber(lastNumericToken)
    if (parsedPrice === null) continue

    const dateMatch = line.match(dateRegex)
    const barcodeMatch = line.match(barcodeRegex)

    const invoiceDate = parseSafeDate(dateMatch ? dateMatch[1] : null)
    const parsedBarcode = normalizeText(barcodeMatch ? barcodeMatch[0] : null)

    const parsedName = normalizeText(
      line
        .replace(lastNumericToken, ' ')
        .replace(dateMatch?.[1] || '', ' ')
        .replace(barcodeMatch?.[0] || '', ' ')
        .replace(/\s+/g, ' '),
    )

    rows.push({
      supplier_product_name: parsedName,
      barcode_raw: parsedBarcode,
      supplier_barcode_key: parsedBarcode,
      price: parsedPrice,
      quantity: null,
      invoice_date: invoiceDate,
      raw_data: {
        raw_line: line,
        line_index: i + 1,
        parsed_name: parsedName,
        parsed_price: parsedPrice,
        parsed_barcode: parsedBarcode,
      },
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
      previewRows: candidates.map((c) => ({
        parsed_name: c.supplier_product_name,
        parsed_price: c.price,
        parsed_barcode: c.barcode_raw,
        raw_line: typeof c.raw_data?.raw_line === 'string' ? c.raw_data.raw_line : '',
      })),
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
