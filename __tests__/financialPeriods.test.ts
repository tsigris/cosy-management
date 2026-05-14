/**
 * Financial periods and date math tests
 * Tests DST-safe date calculations and period range generation
 */

import {
  countInclusiveDays,
  addDaysToDateKey,
  getTodayDateKey,
  getMonthRange,
  getYearRange,
  getRollingDayRange,
  getCanonicalPeriodRange,
  enumerateDateKeys,
} from '@/lib/financialPeriods'

describe('financialPeriods - Date Math', () => {

  describe('countInclusiveDays', () => {
    it('should count single day as 1', () => {
      const count = countInclusiveDays({ from: '2026-05-14', to: '2026-05-14' })
      expect(count).toBe(1)
    })

    it('should count consecutive days correctly', () => {
      const count = countInclusiveDays({ from: '2026-05-01', to: '2026-05-10' })
      expect(count).toBe(10)
    })

    it('should count full month of May correctly (31 days)', () => {
      const count = countInclusiveDays({ from: '2026-05-01', to: '2026-05-31' })
      expect(count).toBe(31)
    })

    it('should count full month of February correctly (non-leap year, 28 days)', () => {
      const count = countInclusiveDays({ from: '2026-02-01', to: '2026-02-28' })
      expect(count).toBe(28)
    })

    it('should count full month of February correctly (leap year, 29 days)', () => {
      const count = countInclusiveDays({ from: '2024-02-01', to: '2024-02-29' })
      expect(count).toBe(29)
    })

    it('should handle year boundary', () => {
      const count = countInclusiveDays({ from: '2025-12-31', to: '2026-01-01' })
      expect(count).toBe(2)
    })

    it('should be DST-safe', () => {
      const count1 = countInclusiveDays({ from: '2026-03-29', to: '2026-03-30' })
      const count2 = countInclusiveDays({ from: '2026-03-30', to: '2026-03-31' })

      expect(count1).toBe(2)
      expect(count2).toBe(2)
    })
  })

  describe('addDaysToDateKey', () => {
    it('should add positive days', () => {
      const result = addDaysToDateKey('2026-05-14', 5)
      expect(result).toBe('2026-05-19')
    })

    it('should add zero days', () => {
      const result = addDaysToDateKey('2026-05-14', 0)
      expect(result).toBe('2026-05-14')
    })

    it('should subtract days (negative)', () => {
      const result = addDaysToDateKey('2026-05-14', -5)
      expect(result).toBe('2026-05-09')
    })

    it('should handle month boundaries', () => {
      const result = addDaysToDateKey('2026-05-31', 1)
      expect(result).toBe('2026-06-01')
    })

    it('should handle year boundaries', () => {
      const result = addDaysToDateKey('2025-12-31', 1)
      expect(result).toBe('2026-01-01')
    })

    it('should handle leap year February', () => {
      const result = addDaysToDateKey('2024-02-28', 1)
      expect(result).toBe('2024-02-29')
    })
  })

  describe('getMonthRange', () => {
    it('should get May 2026 range correctly (31 days)', () => {
      const range = getMonthRange('2026-05-14')

      expect(range.from).toBe('2026-05-01')
      expect(range.to).toBe('2026-05-31')
      expect(countInclusiveDays(range)).toBe(31)
    })

    it('should get February 2026 range correctly (28 days)', () => {
      const range = getMonthRange('2026-02-14')

      expect(range.from).toBe('2026-02-01')
      expect(range.to).toBe('2026-02-28')
      expect(countInclusiveDays(range)).toBe(28)
    })

    it('should get February 2024 range correctly (leap year, 29 days)', () => {
      const range = getMonthRange('2024-02-14')

      expect(range.from).toBe('2024-02-01')
      expect(range.to).toBe('2024-02-29')
      expect(countInclusiveDays(range)).toBe(29)
    })

    it('should handle first day of month', () => {
      const range = getMonthRange('2026-05-01')

      expect(range.from).toBe('2026-05-01')
      expect(range.to).toBe('2026-05-31')
    })

    it('should handle last day of month', () => {
      const range = getMonthRange('2026-05-31')

      expect(range.from).toBe('2026-05-01')
      expect(range.to).toBe('2026-05-31')
    })
  })

  describe('getYearRange', () => {
    it('should get 2026 range correctly (365 days)', () => {
      const range = getYearRange(2026)

      expect(range.from).toBe('2026-01-01')
      expect(range.to).toBe('2026-12-31')
      expect(countInclusiveDays(range)).toBe(365)
    })

    it('should get leap year range correctly (366 days)', () => {
      const range = getYearRange(2024)

      expect(range.from).toBe('2024-01-01')
      expect(range.to).toBe('2024-12-31')
      expect(countInclusiveDays(range)).toBe(366)
    })

    it('should get 2000 leap year range correctly', () => {
      const range = getYearRange(2000)

      expect(countInclusiveDays(range)).toBe(366)
    })

    it('should get 1900 non-leap year range correctly', () => {
      const range = getYearRange(1900)

      expect(countInclusiveDays(range)).toBe(365)
    })
  })

  describe('getRollingDayRange', () => {
    it('should generate exactly 30 inclusive days', () => {
      const range = getRollingDayRange('2026-05-14', 30)

      const dayCount = countInclusiveDays(range)
      expect(dayCount).toBe(30)
    })

    it('should end on the specified date', () => {
      const range = getRollingDayRange('2026-05-14', 30)

      expect(range.to).toBe('2026-05-14')
    })

    it('should start 29 days before the end date', () => {
      const range = getRollingDayRange('2026-05-14', 30)

      expect(range.from).toBe('2026-04-15')
    })

    it('should handle 7-day range (week)', () => {
      const range = getRollingDayRange('2026-05-14', 7)

      expect(range.to).toBe('2026-05-14')
      expect(countInclusiveDays(range)).toBe(7)
    })

    it('should handle single day range', () => {
      const range = getRollingDayRange('2026-05-14', 1)

      expect(range.from).toBe('2026-05-14')
      expect(range.to).toBe('2026-05-14')
      expect(countInclusiveDays(range)).toBe(1)
    })

    it('should handle year boundary', () => {
      const range = getRollingDayRange('2026-01-10', 30)

      expect(range.to).toBe('2026-01-10')
      expect(countInclusiveDays(range)).toBe(30)
      expect(range.from.startsWith('2025')).toBe(true)
    })
  })

  describe('getCanonicalPeriodRange', () => {
    it('should generate month range for "month" period', () => {
      const range = getCanonicalPeriodRange({
        period: 'month',
        todayKey: '2026-05-14',
      })

      expect(range.from).toBe('2026-05-01')
      expect(range.to).toBe('2026-05-31')
    })

    it('should generate year range for "year" period', () => {
      const range = getCanonicalPeriodRange({
        period: 'year',
        selectedYear: 2026,
      })

      expect(range.from).toBe('2026-01-01')
      expect(range.to).toBe('2026-12-31')
    })

    it('should generate 30-day range for "30days" period', () => {
      const range = getCanonicalPeriodRange({
        period: '30days',
        todayKey: '2026-05-14',
      })

      expect(range.to).toBe('2026-05-14')
      expect(countInclusiveDays(range)).toBe(30)
    })

    it('should handle custom range', () => {
      const customRange = { from: '2026-05-01', to: '2026-05-15' }
      const range = getCanonicalPeriodRange({
        period: 'all',
        customRange,
      })

      expect(range.from).toBe(customRange.from)
      expect(range.to).toBe(customRange.to)
    })
  })

  describe('enumerateDateKeys', () => {
    it('should enumerate single day', () => {
      const keys = enumerateDateKeys({ from: '2026-05-14', to: '2026-05-14' })

      expect(keys).toEqual(['2026-05-14'])
    })

    it('should enumerate consecutive days', () => {
      const keys = enumerateDateKeys({ from: '2026-05-14', to: '2026-05-16' })

      expect(keys).toEqual(['2026-05-14', '2026-05-15', '2026-05-16'])
    })

    it('should enumerate month with correct count', () => {
      const keys = enumerateDateKeys({ from: '2026-05-01', to: '2026-05-31' })

      expect(keys.length).toBe(31)
      expect(keys[0]).toBe('2026-05-01')
      expect(keys[30]).toBe('2026-05-31')
    })

    it('should enumerate across month boundary', () => {
      const keys = enumerateDateKeys({ from: '2026-05-30', to: '2026-06-02' })

      expect(keys).toEqual([
        '2026-05-30',
        '2026-05-31',
        '2026-06-01',
        '2026-06-02',
      ])
    })
  })

  describe('Integration Tests', () => {

    it('should maintain consistency across operations', () => {
      const dateKey = '2026-05-14'

      const plusMinus = addDaysToDateKey(addDaysToDateKey(dateKey, 10), -10)
      expect(plusMinus).toBe(dateKey)

      const minusPlus = addDaysToDateKey(addDaysToDateKey(dateKey, -10), 10)
      expect(minusPlus).toBe(dateKey)
    })

    it('rolling 30 days always have exactly 30 inclusive days', () => {
      const testDates = [
        '2026-01-15',
        '2026-02-28',
        '2026-03-01',
        '2026-05-14',
        '2026-12-31',
      ]

      testDates.forEach((endDate) => {
        const range = getRollingDayRange(endDate, 30)
        const dayCount = countInclusiveDays(range)
        expect(dayCount).toBe(30)
      })
    })

    it('month ranges always have correct day counts', () => {
      const months = [
        { month: '2026-01-15', expectedDays: 31 },
        { month: '2026-02-15', expectedDays: 28 },
        { month: '2026-03-15', expectedDays: 31 },
        { month: '2026-04-15', expectedDays: 30 },
        { month: '2024-02-15', expectedDays: 29 },
      ]

      months.forEach(({ month, expectedDays }) => {
        const range = getMonthRange(month)
        const dayCount = countInclusiveDays(range)
        expect(dayCount).toBe(expectedDays)
      })
    })
  })
})
