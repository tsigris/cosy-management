'use client'

import React, { memo, useCallback } from 'react'
import type { EconomicsCalendarDayDto } from '@/lib/economics/types/economicsDto'
import { EconomicsCalendarCell } from './EconomicsCalendarCell'
import { economicsColorTokens } from '@/components/economics/primitives/tokens'

const WEEKDAY_LABELS = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σά', 'Κυ']

// Returns the ISO weekday index (0=Mon … 6=Sun) for a YYYY-MM-DD date string
function isoWeekdayIndex(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return (d.getDay() + 6) % 7 // shift so Monday=0
}

type CalendarRow = Array<EconomicsCalendarDayDto | null>

/**
 * Builds a 7-column row array for each week.
 * Null slots represent empty cells before/after the month.
 */
function buildCalendarRows(days: EconomicsCalendarDayDto[]): CalendarRow[] {
  if (days.length === 0) return []

  const firstDay = days[0]
  const startOffset = isoWeekdayIndex(firstDay.date)

  const cells: Array<EconomicsCalendarDayDto | null> = [
    ...Array<null>(startOffset).fill(null),
    ...days,
  ]

  const rows: CalendarRow[] = []
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7)
    // Pad final row to 7 columns
    while (row.length < 7) row.push(null)
    rows.push(row)
  }
  return rows
}

type CalendarRowProps = {
  row: CalendarRow
  selectedDay: string | null
  onSelect: (date: string) => void
}

const CalendarRow = memo(function CalendarRow({ row, selectedDay, onSelect }: CalendarRowProps) {
  return (
    <>
      {row.map((day, colIdx) => (
        <div key={day ? day.date : `empty-${colIdx}`} style={{ minWidth: 0 }}>
          {day ? (
            <EconomicsCalendarCell
              day={day}
              isSelected={day.date === selectedDay}
              onSelect={onSelect}
            />
          ) : (
            <div aria-hidden="true" />
          )}
        </div>
      ))}
    </>
  )
})

type EconomicsCalendarGridProps = {
  days: EconomicsCalendarDayDto[]
  selectedDay: string | null
  onSelectDay: (date: string) => void
}

function EconomicsCalendarGridInner({ days, selectedDay, onSelectDay }: EconomicsCalendarGridProps) {
  const rows = buildCalendarRows(days)

  const handleSelect = useCallback(
    (date: string) => onSelectDay(date),
    [onSelectDay],
  )

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
    width: '100%',
  }

  const headerCellStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: economicsColorTokens.muted,
    textAlign: 'center',
    paddingBottom: 4,
  }

  return (
    <div role="grid" aria-label="Ημερολόγιο">
      {/* Weekday headers */}
      <div style={gridStyle} role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={headerCellStyle} role="columnheader" aria-label={label}>
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} style={gridStyle} role="row">
          <CalendarRow row={row} selectedDay={selectedDay} onSelect={handleSelect} />
        </div>
      ))}
    </div>
  )
}

export const EconomicsCalendarGrid = memo(EconomicsCalendarGridInner)
