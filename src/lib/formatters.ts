import { toBusinessDayDate } from '@/lib/businessDate'

export type DateInput = string | Date | null | undefined

export const amountFormatterEl = new Intl.NumberFormat('el-GR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const currencyFormatterEUR = new Intl.NumberFormat('el-GR', {
  style: 'currency',
  currency: 'EUR',
})

function parseDateInput(input: DateInput): Date | null {
  if (!input) return null

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input)
  }

  const value = String(input).trim()
  if (!value) return null

  const yyyyMmDdMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (yyyyMmDdMatch) {
    const [, y, m, d] = yyyyMmDdMatch
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatAmount(value: number | null | undefined): string {
  return amountFormatterEl.format(Number(value || 0))
}

export function formatMoney(value: number | null | undefined): string {
  return `${formatAmount(value)}€`
}

export function formatMoneySpaced(value: number | null | undefined): string {
  return `${formatAmount(value)} €`
}

export function formatDateDdMmYyyy(input: DateInput, fallback = '—'): string {
  const date = parseDateInput(input)
  if (!date) return fallback

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export function formatDateEl(input: DateInput, fallback = '—'): string {
  const date = parseDateInput(input)
  if (!date) return fallback
  return date.toLocaleDateString('el-GR')
}

export function formatTimeEl(input: DateInput, fallback = '—'): string {
  const date = parseDateInput(input)
  if (!date) return fallback
  return date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
}

export function formatBusinessDateEl(input: DateInput, fallback = '—'): string {
  const date = parseDateInput(input)
  if (!date) return fallback
  return toBusinessDayDate(date, { normalizeToNoon: true }).toLocaleDateString('el-GR')
}
