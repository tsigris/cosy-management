'use client'

import React from 'react'
import { economicsColorTokens } from './tokens'

type CalendarCellProps = {
  label: string
  value?: string
  state?: 'default' | 'selected' | 'today' | 'disabled'
  onClick?: () => void
}

export function CalendarCell({ label, value, state = 'default', onClick }: CalendarCellProps) {
  const palette = {
    default: {
      border: economicsColorTokens.border,
      background: economicsColorTokens.surface,
      color: economicsColorTokens.text,
    },
    selected: {
      border: economicsColorTokens.neutral,
      background: 'rgba(59,130,246,0.12)',
      color: economicsColorTokens.text,
    },
    today: {
      border: economicsColorTokens.positive,
      background: 'rgba(16,185,129,0.10)',
      color: economicsColorTokens.text,
    },
    disabled: {
      border: economicsColorTokens.border,
      background: 'rgba(148,163,184,0.12)',
      color: economicsColorTokens.muted,
    },
  }[state]

  return (
    <button
      type="button"
      disabled={state === 'disabled'}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: 10,
        background: palette.background,
        color: palette.color,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900 }}>{label}</div>
      {value ? <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800 }}>{value}</div> : null}
    </button>
  )
}
