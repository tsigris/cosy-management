'use client'

import React, { memo } from 'react'
import type { EconomicsCalendarDayDto } from '@/lib/economics/types/economicsDto'
import { economicsColorTokens } from '@/components/economics/primitives/tokens'

// Maps DTO status to visual tone.
// scan-first: color carries the signal, no dense metrics, no charts.
const STATUS_PALETTE: Record<
  NonNullable<EconomicsCalendarDayDto['status']> | 'default',
  { background: string; border: string; indicator: string }
> = {
  strong:  { background: 'rgba(16,185,129,0.10)',  border: '#10b981', indicator: '#10b981' },
  weak:    { background: 'rgba(239,68,68,0.09)',   border: '#ef4444', indicator: '#ef4444' },
  neutral: { background: 'rgba(148,163,184,0.08)', border: economicsColorTokens.border, indicator: economicsColorTokens.muted },
  empty:   { background: 'rgba(148,163,184,0.04)', border: 'transparent', indicator: 'transparent' },
  default: { background: economicsColorTokens.surface, border: economicsColorTokens.border, indicator: 'transparent' },
}

type EconomicsCalendarCellProps = {
  day: EconomicsCalendarDayDto
  isSelected: boolean
  onSelect: (date: string) => void
}

function EconomicsCalendarCellInner({ day, isSelected, onSelect }: EconomicsCalendarCellProps) {
  const statusKey = day.status ?? 'default'
  const palette = STATUS_PALETTE[statusKey]

  const background = isSelected ? 'rgba(59,130,246,0.14)' : palette.background
  const border     = isSelected ? economicsColorTokens.neutral : palette.border

  const isDisabled = day.status === 'empty'

  // Parse label from date (DD) if no explicit label provided
  const dayNumber = day.label ?? String(parseInt(day.date.slice(8, 10), 10))

  return (
    <button
      type="button"
      aria-label={`Ημέρα ${day.date}${isSelected ? ', επιλεγμένη' : ''}`}
      aria-pressed={isSelected}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) onSelect(day.date)
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        border: `1.5px solid ${border}`,
        borderRadius: 10,
        padding: 0,
        background,
        cursor: isDisabled ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        transition: 'border-color 120ms ease, background 120ms ease',
      }}
    >
      {/* Day number — primary label */}
      <span
        style={{
          position: 'absolute',
          top: 5,
          left: 6,
          fontSize: 12,
          fontWeight: day.isToday ? 900 : 700,
          color: isDisabled ? economicsColorTokens.muted : economicsColorTokens.text,
          lineHeight: 1,
        }}
      >
        {dayNumber}
      </span>

      {/* Today indicator dot */}
      {day.isToday && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: economicsColorTokens.positive,
          }}
        />
      )}

      {/* Anomaly signal */}
      {day.hasAnomaly && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 5,
            right: 5,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: economicsColorTokens.warning,
          }}
        />
      )}

      {/* Status colour bar — bottom edge */}
      {palette.indicator !== 'transparent' && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: palette.indicator,
            borderRadius: '0 0 8px 8px',
          }}
        />
      )}
    </button>
  )
}

export const EconomicsCalendarCell = memo(EconomicsCalendarCellInner)
