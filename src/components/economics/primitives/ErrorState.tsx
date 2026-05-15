'use client'

import React from 'react'
import { economicsColorTokens, economicsSpacing } from './tokens'

type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Κάτι πήγε στραβά',
  description = 'Δοκίμασε ξανά σε λίγο.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        border: `1px solid rgba(239,68,68,0.35)`,
        borderRadius: 16,
        padding: economicsSpacing.xl,
        background: economicsColorTokens.surface,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900, color: economicsColorTokens.negative }}>{title}</div>
      <div style={{ marginTop: economicsSpacing.sm, fontSize: 13, fontWeight: 700, color: economicsColorTokens.muted }}>
        {description}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: economicsSpacing.md,
            border: 'none',
            borderRadius: 10,
            padding: '10px 12px',
            background: economicsColorTokens.negative,
            color: '#fff',
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Επανάληψη
        </button>
      ) : null}
    </div>
  )
}
