"use client"

import React from 'react'

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

export default function EconomicsPeriodFilter({ period, onPeriodChange, selectedYear, onYearChange, yearOptions = [] }: Props) {
  const viewBtn: React.CSSProperties = { flex: 1, minWidth: 90, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900 }
  const wrap: React.CSSProperties = { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }
  const card: React.CSSProperties = { background: 'var(--surface)', padding: 12, borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }

  return (
    <div>
      <div style={wrap}>
        <button onClick={() => onPeriodChange('month')} style={{ ...viewBtn, background: period === 'month' ? 'var(--surface)' : 'transparent' }}>Μήνας</button>
        <button onClick={() => onPeriodChange('year')} style={{ ...viewBtn, background: period === 'year' ? 'var(--surface)' : 'transparent' }}>Έτος</button>
        <button onClick={() => onPeriodChange('30days')} style={{ ...viewBtn, background: period === '30days' ? 'var(--surface)' : 'transparent' }}>30 ημέρες</button>
        <button onClick={() => onPeriodChange('all')} style={{ ...viewBtn, background: period === 'all' ? 'var(--surface)' : 'transparent' }}>Όλα</button>
      </div>

      {period === 'year' && (
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>ΕΤΟΣ</div>
          <select value={String(selectedYear ?? '')} onChange={(e) => onYearChange && onYearChange(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}>
            {yearOptions.length ? yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>) : <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
          </select>
        </div>
      )}
    </div>
  )
}
