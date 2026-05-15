'use client'

import React from 'react'
import { economicsColorTokens, economicsSpacing } from './tokens'

type LoadingSkeletonProps = {
  lines?: number
  compact?: boolean
  label?: string
}

export function LoadingSkeleton({ lines = 3, compact = false, label = 'Φόρτωση...' }: LoadingSkeletonProps) {
  const lineHeight = compact ? 10 : 14
  const gap = compact ? 8 : 10

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{
        border: `1px solid ${economicsColorTokens.border}`,
        borderRadius: 16,
        padding: economicsSpacing.md,
        background: economicsColorTokens.surface,
      }}
    >
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          style={{
            height: lineHeight,
            marginBottom: index === lines - 1 ? 0 : gap,
            borderRadius: 8,
            background:
              'linear-gradient(90deg, rgba(148,163,184,0.15) 0%, rgba(148,163,184,0.28) 45%, rgba(148,163,184,0.15) 100%)',
          }}
        />
      ))}
    </div>
  )
}
