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

/**
 * Find the same weekday in the previous year within a reasonable window.
 * For retail/hospitality, traffic patterns are weekday-driven, not date-driven.
 * 
 * BUSINESS RULE: Use the CLOSEST same weekday to the original calendar date.
 * E.g., Friday 15/05/2026 should compare to Friday 16/05/2025 (1 day away), 
 * not Friday 02/05/2025 (13 days away).
 * 
 * If tie distance: prefer future date (forward is more conservative).
 */
function findSameWeekdayInPreviousYear(dateKey: string): {
  selectedDate: string
  candidates: Array<{ date: string; weekday: number; distanceDays: number }>
  selectedDistanceDays: number
} {
  const { year, month, day } = getParts(dateKey)
  
  // Get the UTC epoch day for the current date to determine weekday
  const currentEpochDay = toUtcEpochDay(dateKey)
  const currentWeekday = new Date(currentEpochDay * MS_PER_DAY).getUTCDay() // 0=Sunday, 6=Saturday
  
  // Shift by one year first (baseline)
  const previousYearDateKey = shiftDateKeyByYears(dateKey, -1)
  const previousEpochDay = toUtcEpochDay(previousYearDateKey)
  const previousWeekday = new Date(previousEpochDay * MS_PER_DAY).getUTCDay()
  
  // Collect all candidate dates with matching weekday within ±14 days
  const candidates: Array<{ date: string; weekday: number; distanceDays: number }> = []
  
  // Check baseline - if weekdays match exactly
  if (currentWeekday === previousWeekday) {
    candidates.push({
      date: previousYearDateKey,
      weekday: previousWeekday,
      distanceDays: 0,
    })
  }
  
  // Search ±14 days for all matching weekdays
  for (let daysOffset = -14; daysOffset <= 14; daysOffset++) {
    if (daysOffset === 0) continue // already checked baseline
    
    const candidateDate = addDaysToDateKey(previousYearDateKey, daysOffset)
    const candidateEpochDay = toUtcEpochDay(candidateDate)
    const candidateWeekday = new Date(candidateEpochDay * MS_PER_DAY).getUTCDay()
    
    if (candidateWeekday === currentWeekday) {
      candidates.push({
        date: candidateDate,
        weekday: candidateWeekday,
        distanceDays: Math.abs(daysOffset),
      })
    }
  }
  
  // Select the closest match
  // If tie: prefer future date (positive offset > negative offset)
  let selectedCandidate = candidates[0]
  for (const candidate of candidates) {
    if (candidate.distanceDays < selectedCandidate.distanceDays) {
      selectedCandidate = candidate
    } else if (
      candidate.distanceDays === selectedCandidate.distanceDays &&
      toUtcEpochDay(candidate.date) > toUtcEpochDay(selectedCandidate.date)
    ) {
      // Tie in distance: prefer future date
      selectedCandidate = candidate
    }
  }
  
  return {
    selectedDate: selectedCandidate.date,
    candidates,
    selectedDistanceDays: selectedCandidate.distanceDays,
  }
}

export type YearOverYearResult = {
  current: FinancialDateRange
  previous: FinancialDateRange
  days: number
  comparisonMapping: {
    currentDate: string
    comparisonDate: string
    comparisonWeekday: string
  }
}

export function getYearOverYearRanges(range: FinancialDateRange): YearOverYearResult {
  const current = normalizeRange(range)
  const days = countInclusiveDays(current)
  
  // Find same weekday in previous year for the current date (with detailed mapping info)
  const weekdayMapping = findSameWeekdayInPreviousYear(current.from)
  const comparisonFromDate = weekdayMapping.selectedDate
  const comparisonToDate = addDaysToDateKey(comparisonFromDate, Math.max(0, days - 1))

  return {
    current,
    previous: {
      from: comparisonFromDate,
      to: comparisonToDate,
    },
    days,
    comparisonMapping: {
      currentDate: current.from,
      comparisonDate: comparisonFromDate,
      comparisonWeekday: getWeekdayLabel(comparisonFromDate),
    },
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
