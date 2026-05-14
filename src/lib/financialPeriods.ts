import { formatIsoDate, formatBusinessDayDate, isDateOnlyString, parseLocalDateOnly } from '@/lib/businessDate'

export type FinancialDateRange = {
  from: string
  to: string
}

function assertDateKey(value: string): string {
  const next = String(value || '').trim()
  if (!isDateOnlyString(next)) {
    throw new Error(`Invalid date key: ${value}`)
  }
  return next
}

function getParts(dateKey: string) {
  const [year, month, day] = assertDateKey(dateKey).split('-').map(Number)
  return {
    year,
    month,
    day,
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0, 12, 0, 0, 0).getDate()
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const base = parseLocalDateOnly(assertDateKey(dateKey))
  base.setDate(base.getDate() + days)
  return formatIsoDate(base)
}

export function shiftDateKeyByYears(dateKey: string, yearDelta: number): string {
  const { year, month, day } = getParts(dateKey)
  const nextYear = year + yearDelta
  const nextDay = Math.min(day, getDaysInMonth(nextYear, month))
  const shifted = new Date(nextYear, month - 1, nextDay, 12, 0, 0, 0)
  return formatIsoDate(shifted)
}

export function countInclusiveDays(range: FinancialDateRange): number {
  const start = parseLocalDateOnly(assertDateKey(range.from))
  const end = parseLocalDateOnly(assertDateKey(range.to))
  if (end.getTime() < start.getTime()) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
}

export function normalizeRange(range: FinancialDateRange): FinancialDateRange {
  const from = assertDateKey(range.from)
  const to = assertDateKey(range.to)
  return from <= to ? { from, to } : { from: to, to: from }
}

export function getYearOverYearRanges(range: FinancialDateRange) {
  const current = normalizeRange(range)
  const days = countInclusiveDays(current)
  const previousFrom = shiftDateKeyByYears(current.from, -1)
  const previousTo = addDaysToDateKey(previousFrom, Math.max(0, days - 1))

  return {
    current,
    previous: {
      from: previousFrom,
      to: previousTo,
    },
    days,
  }
}

export function enumerateDateKeys(range: FinancialDateRange): string[] {
  const normalized = normalizeRange(range)
  const days = countInclusiveDays(normalized)
  return Array.from({ length: days }, (_, index) => addDaysToDateKey(normalized.from, index))
}

export function formatRangeLabel(range: FinancialDateRange): string {
  const normalized = normalizeRange(range)
  const start = parseLocalDateOnly(normalized.from)
  const end = parseLocalDateOnly(normalized.to)
  return `${formatBusinessDayDate(start)} - ${formatBusinessDayDate(end)}`
}

export function formatShortDateKey(dateKey: string): string {
  const date = parseLocalDateOnly(assertDateKey(dateKey))
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

export function getWeekdayLabel(dateKey: string, locale = 'el-GR'): string {
  const date = parseLocalDateOnly(assertDateKey(dateKey))
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}
