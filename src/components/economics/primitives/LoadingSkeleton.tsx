'use client'

import React from 'react'
import { economicsColorTokens, economicsSpacing } from './tokens'

type LoadingSkeletonProps = {
  lines?: number
  compact?: boolean
  label?: string
  /** 'default' = stacked lines | 'kpi' = hero number + label | 'kpipair' = two side-by-side */
  variant?: 'default' | 'kpi' | 'kpipair'
}

export function LoadingSkeleton({
  lines = 3,
  compact = false,
  label = 'Φόρτωση...',
  variant = 'default',
}: LoadingSkeletonProps) {
  const lineH = compact ? 10 : 14

  const inner =
    variant === 'kpi' ? (
      <div style={{ padding: `${economicsSpacing.md}px` }}>
        {/* big number placeholder */}
        <div className="economics-skeleton-line" style={{ height: 38, width: '60%', marginBottom: 8, borderRadius: 8 }} />
        {/* label placeholder */}
        <div className="economics-skeleton-line" style={{ height: 10, width: '40%', borderRadius: 4 }} />
      </div>
    ) : variant === 'kpipair' ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: economicsSpacing.sm }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${economicsColorTokens.border}`,
              borderRadius: 14,
              padding: economicsSpacing.md,
            }}
          >
            <div className="economics-skeleton-line" style={{ height: 24, width: '70%', marginBottom: 6, borderRadius: 6 }} />
            <div className="economics-skeleton-line" style={{ height: 9, width: '50%', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    ) : (
      <div
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
            className="economics-skeleton-line"
            style={{
              height: lineH,
              marginBottom: index === lines - 1 ? 0 : compact ? 8 : 10,
              width: index === 0 ? '75%' : index === lines - 1 ? '50%' : '90%',
            }}
          />
        ))}
      </div>
    )

  return (
    <div role="status" aria-live="polite" aria-label={label}>
      {inner}
    </div>
  )
}
