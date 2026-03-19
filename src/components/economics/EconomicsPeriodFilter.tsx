"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Period = 'month' | 'year' | '30days' | 'all'

type Props = {
  period: Period
  onPeriodChange: (p: Period) => void
  selectedYear?: number
  onYearChange?: (y: number) => void
  yearOptions?: number[]
}

export function getStartOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

export function getStartOfYear(year: number): Date {
  return new Date(year, 0, 1, 0, 0, 0, 0)
}

export function getLast30Days(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return d
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export default function EconomicsPeriodFilter({ period, onPeriodChange, selectedYear, onYearChange, yearOptions = [] }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const rawQueryStart = searchParams?.get('start') || ''
  const rawQueryEnd = searchParams?.get('end') || ''
  const queryStart = isValidDateKey(rawQueryStart) ? rawQueryStart : ''
  const queryEnd = isValidDateKey(rawQueryEnd) ? rawQueryEnd : ''

  const [start, setStart] = useState(queryStart)
  const [end, setEnd] = useState(queryEnd)

  const today = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const sevenDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const updateQueryRange = (nextStart: string, nextEnd: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (nextStart) params.set('start', nextStart)
    if (nextEnd) params.set('end', nextEnd)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  useEffect(() => {
    setStart(queryStart)
    setEnd(queryEnd)
  }, [queryStart, queryEnd])

  useEffect(() => {
    if (period !== 'all') return
    const defaultStart = start || queryStart || sevenDaysAgo
    const defaultEnd = end || queryEnd || today
    if (defaultStart !== queryStart || defaultEnd !== queryEnd) {
      updateQueryRange(defaultStart, defaultEnd)
    }
    if (!start) setStart(defaultStart)
    if (!end) setEnd(defaultEnd)
  }, [period, start, end, queryStart, queryEnd, sevenDaysAgo, today])

  const viewBtn: React.CSSProperties = { flex: 1, minWidth: 90, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900 }
  const wrap: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }
  const card: React.CSSProperties = { background: 'var(--surface)', padding: 12, borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }

  return (
    <div>
      <div style={wrap}>
        <button onClick={() => onPeriodChange('month')} style={{ ...viewBtn, background: period === 'month' ? 'var(--surface)' : 'transparent' }}>Μήνας</button>
        <button onClick={() => onPeriodChange('year')} style={{ ...viewBtn, background: period === 'year' ? 'var(--surface)' : 'transparent' }}>Έτος</button>
        <button onClick={() => onPeriodChange('30days')} style={{ ...viewBtn, background: period === '30days' ? 'var(--surface)' : 'transparent' }}>30 ημέρες</button>
        <button
          onClick={() => {
            onPeriodChange('all')
            const defaultStart = queryStart || start || sevenDaysAgo
            const defaultEnd = queryEnd || end || today
            setStart(defaultStart)
            setEnd(defaultEnd)
            updateQueryRange(defaultStart, defaultEnd)
          }}
          style={{ ...viewBtn, background: period === 'all' ? 'var(--surface)' : 'transparent' }}
        >
          Από – Έως
        </button>
      </div>

      {period === 'year' && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>ΕΤΟΣ</div>
          <select value={String(selectedYear ?? '')} onChange={(e) => onYearChange && onYearChange(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}>
            {yearOptions.length ? yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>) : <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
          </select>
        </div>
      )}

      {period === 'all' && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>ΕΠΙΛΟΓΗ ΕΥΡΟΥΣ ΗΜΕΡΟΜΗΝΙΩΝ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              type="date"
              value={start || sevenDaysAgo}
              onChange={(e) => {
                const nextStart = e.target.value
                setStart(nextStart)
                updateQueryRange(nextStart, end || today)
              }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}
            />
            <input
              type="date"
              value={end || today}
              onChange={(e) => {
                const nextEnd = e.target.value
                setEnd(nextEnd)
                updateQueryRange(start || sevenDaysAgo, nextEnd)
              }}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
