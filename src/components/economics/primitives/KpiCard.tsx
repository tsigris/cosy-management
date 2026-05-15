'use client'

import React from 'react'
import { LoadingSkeleton } from './LoadingSkeleton'
import { economicsColorTokens, economicsSpacing } from './tokens'

type KpiTone = 'positive' | 'negative' | 'neutral'
type KpiSize = 'primary' | 'secondary'

type KpiCardProps = {
  label: string
  value: string
  delta?: string
  tone?: KpiTone
  size?: KpiSize
  loading?: boolean
  hint?: string
}

const toneColorMap: Record<KpiTone, string> = {
  positive: economicsColorTokens.positive,
  negative: economicsColorTokens.negative,
  neutral: economicsColorTokens.neutral,
}

export function KpiCard({
  label,
  value,
  delta,
  tone = 'neutral',
  size = 'secondary',
  loading = false,
  hint,
}: KpiCardProps) {
  if (loading) {
    return <LoadingSkeleton lines={2} compact={size === 'secondary'} label="Φόρτωση KPI" />
  }

  return (
    <article
      style={{
        border: `1px solid ${economicsColorTokens.border}`,
        borderRadius: 16,
        padding: size === 'primary' ? economicsSpacing.lg : economicsSpacing.md,
        background: economicsColorTokens.surface,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', color: economicsColorTokens.muted }}>
        {label}
      </div>
      <div style={{ marginTop: economicsSpacing.sm, fontSize: size === 'primary' ? 28 : 22, fontWeight: 1000, color: economicsColorTokens.text }}>
        {value}
      </div>
      {delta ? (
        <div style={{ marginTop: economicsSpacing.xs, fontSize: 12, fontWeight: 900, color: toneColorMap[tone] }}>
          {delta}
        </div>
      ) : null}
      {hint ? (
        <div style={{ marginTop: economicsSpacing.xs, fontSize: 11, fontWeight: 700, color: economicsColorTokens.muted }}>
          {hint}
        </div>
      ) : null}
    </article>
  )
}
