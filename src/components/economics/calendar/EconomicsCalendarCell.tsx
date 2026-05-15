'use client'

import React, { memo } from 'react'
import type { EconomicsCalendarDayDto } from '@/lib/economics/types/economicsDto'
import { economicsColorTokens } from '@/components/economics/primitives/tokens'

// Maps DTO status to visual tone.
// scan-first: color carries the signal without dense metrics.
const STATUS_PALETTE: Record<
  NonNullable<EconomicsCalendarDayDto['status']> | 'default',
  { background: string; border: string; indicator: string; label: string }
> = {
  strong:  {
    background: economicsColorTokens.dayStrongBg,
    border: economicsColorTokens.dayStrongBorder,
    indicator: economicsColorTokens.dayStrong,
    label: economicsColorTokens.dayStrong,
  },
  weak:    {
    background: economicsColorTokens.dayWeakBg,
    border: economicsColorTokens.dayWeakBorder,
    indicator: economicsColorTokens.dayWeak,
    label: economicsColorTokens.dayWeak,
  },
  neutral: {
    background: economicsColorTokens.dayNeutralBg,
    border: economicsColorTokens.dayNeutralBorder,
    indicator: economicsColorTokens.muted,
    label: economicsColorTokens.muted,
  },
  empty:   {
    background: economicsColorTokens.dayEmptyBg,
    border: 'transparent',
    indicator: 'transparent',
    label: 'transparent',
  },
  default: {
    background: economicsColorTokens.surface,
    border: economicsColorTokens.border,
    indicator: 'transparent',
    label: 'transparent',
  },
}

// Compact revenue label: 1.2k, 2.4k etc.
function fmtCompact(value?: number): string | null {
  if (value === undefined || value === null || value === 0) return null
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`
  }
  return value.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type EconomicsCalendarCellProps = {
  day: EconomicsCalendarDayDto
  isSelected: boolean
  onSelect: (date: string) => void
}

function EconomicsCalendarCellInner({ day, isSelected, onSelect }: EconomicsCalendarCellProps) {
  const statusKey = day.status ?? 'default'
  const palette = STATUS_PALETTE[statusKey]

  const background = isSelected ? 'rgba(59,130,246,0.16)' : palette.background
  const border     = isSelected
    ? '#3b82f6'
    : day.isToday && !isSelected
      ? `${economicsColorTokens.positive}`
      : palette.border

  const isDisabled = day.status === 'empty'
  const dayNumber = day.label ?? String(parseInt(day.date.slice(8, 10), 10))
  const revenueHint = fmtCompact(day.revenue)

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
        transition: 'border-color 100ms ease, background 100ms ease, transform 80ms ease',
        boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.30)' : day.isToday ? '0 0 0 2px rgba(5,150,105,0.25)' : 'none',
        transform: isSelected ? 'scale(0.97)' : 'scale(1)',
      }}
    >
      {/* Day number */}
      <span
        style={{
          position: 'absolute',
          top: 5,
          left: 6,
          fontSize: 12,
          fontWeight: day.isToday ? 900 : 700,
          color: isDisabled
            ? economicsColorTokens.muted
            : day.isToday
              ? economicsColorTokens.positive
              : economicsColorTokens.text,
          lineHeight: 1,
        }}
      >
        {dayNumber}
      </span>

      {/* Compact revenue label β€” bottom-left, scan signal */}
      {revenueHint && !isDisabled && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 6,
            left: 5,
            fontSize: 9,
            fontWeight: 800,
            color: palette.label !== 'transparent' ? palette.label : economicsColorTokens.muted,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {revenueHint}
        </span>
      )}

      {/* Anomaly signal β€” top-right dot */}
      {day.hasAnomaly && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: economicsColorTokens.warning,
          }}
        />
      )}

      {/* Status colour bar β€” bottom edge */}
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
            opacity: 0.7,
            borderRadius: '0 0 8px 8px',
          }}
        />
      )}
    </button>
  )
}

export const EconomicsCalendarCell = memo(EconomicsCalendarCellInner)
