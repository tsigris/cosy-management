import { formatIsoDate, formatBusinessDayDate, isDateOnlyString, parseLocalDateOnly } from '@/lib/businessDate'

export type FinancialDateRange = {
  from: string
  to: string
}

export type CanonicalPeriod = 'month' | 'year' | '30days' | 'all'

const MS_PER_DAY = 24 * 60 * 60 * 1000

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

function toUtcEpochDay(dateKey: string): number {
  const { year, month, day } = getParts(dateKey)
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY)
}

function fromUtcEpochDay(epochDay: number): string {
  const date = new Date(epochDay * MS_PER_DAY)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayDateKey(now: Date = new Date()): string {
  return formatIsoDate(now)
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return fromUtcEpochDay(toUtcEpochDay(assertDateKey(dateKey)) + days)
}

export function shiftDateKeyByYears(dateKey: string, yearDelta: number): string {
  const { year, month, day } = getParts(dateKey)
  const nextYear = year + yearDelta
  const nextDay = Math.min(day, getDaysInMonth(nextYear, month))
  const shifted = new Date(nextYear, month - 1, nextDay, 12, 0, 0, 0)
  return formatIsoDate(shifted)
}

export function countInclusiveDays(range: FinancialDateRange): number {
  const start = toUtcEpochDay(assertDateKey(range.from))
  const end = toUtcEpochDay(assertDateKey(range.to))
  if (end < start) return 0
  return end - start + 1
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
  const { year, month, day } = getParts(dateKey)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date)
}

export function getMonthRange(dateKey: string): FinancialDateRange {
  const { year, month } = getParts(dateKey)
  const lastDay = getDaysInMonth(year, month)
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function getYearRange(year: number): FinancialDateRange {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  }
}

export function getRollingDayRange(endDateKey: string, days: number): FinancialDateRange {
  const safeDays = Math.max(1, Math.floor(days))
  const to = assertDateKey(endDateKey)
  return {
    from: addDaysToDateKey(to, -(safeDays - 1)),
    to,
  }
}

export function getCanonicalPeriodRange(options: {
  period: CanonicalPeriod
  selectedYear?: number
  customRange?: FinancialDateRange
  todayKey?: string
}): FinancialDateRange {
  const todayKey = options.todayKey ? assertDateKey(options.todayKey) : getTodayDateKey()

  if (options.period === 'month') {
    return getMonthRange(todayKey)
  }

  if (options.period === 'year') {
    return getYearRange(options.selectedYear || Number(todayKey.slice(0, 4)))
  }

  if (options.period === '30days') {
    return getRollingDayRange(todayKey, 30)
  }

  return normalizeRange(options.customRange || { from: addDaysToDateKey(todayKey, -6), to: todayKey })
}
