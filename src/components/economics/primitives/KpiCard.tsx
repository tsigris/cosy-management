'use client'

import React from 'react'
import { LoadingSkeleton } from './LoadingSkeleton'
import { economicsColorTokens, economicsSpacing } from './tokens'

type KpiTone = 'positive' | 'negative' | 'neutral' | 'cash' | 'card'
type KpiSize = 'primary' | 'secondary' | 'tertiary'

type KpiCardProps = {
  label: string
  value: string
  delta?: string
  tone?: KpiTone
  size?: KpiSize
  loading?: boolean
  hint?: string
  /** Full-width hero layout — single dominant metric */
  hero?: boolean
}

const toneBgMap: Record<KpiTone, string> = {
  positive: economicsColorTokens.positiveLight,
  negative: economicsColorTokens.negativeLight,
  neutral: economicsColorTokens.neutralLight,
  cash: economicsColorTokens.cashLight,
  card: economicsColorTokens.cardLight,
}

const toneColorMap: Record<KpiTone, string> = {
  positive: economicsColorTokens.positive,
  negative: economicsColorTokens.negative,
  neutral: economicsColorTokens.neutral,
  cash: economicsColorTokens.cash,
  card: economicsColorTokens.card,
}

const toneBorderMap: Record<KpiTone, string> = {
  positive: economicsColorTokens.positiveMid,
  negative: economicsColorTokens.negativeMid,
  neutral: economicsColorTokens.neutralLight,
  cash: economicsColorTokens.cashLight,
  card: economicsColorTokens.cardLight,
}

export function KpiCard({
  label,
  value,
  delta,
  tone = 'neutral',
  size = 'secondary',
  loading = false,
  hint,
  hero = false,
}: KpiCardProps) {
  if (loading) {
    return <LoadingSkeleton lines={2} compact={size !== 'primary'} label="Φόρτωση KPI" />
  }

  const valueSize = hero ? 42 : size === 'primary' ? 32 : size === 'tertiary' ? 18 : 24
  const padding = hero
    ? economicsSpacing.xl
    : size === 'primary'
      ? economicsSpacing.lg
      : economicsSpacing.md

  return (
    <article
      style={{
        border: `1px solid ${toneBorderMap[tone]}`,
        borderRadius: hero ? 20 : 16,
        padding,
        background: tone !== 'neutral' ? toneBgMap[tone] : economicsColorTokens.surface,
        width: hero ? '100%' : undefined,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: economicsColorTokens.muted,
          marginBottom: economicsSpacing.xs,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: valueSize,
          fontWeight: 900,
          color: economicsColorTokens.text,
          lineHeight: 1.1,
          letterSpacing: hero ? '-0.03em' : size === 'primary' ? '-0.02em' : '-0.01em',
        }}
      >
        {value}
      </div>
      {delta ? (
        <div
          style={{
            marginTop: economicsSpacing.xs,
            fontSize: 12,
            fontWeight: 800,
            color: toneColorMap[tone],
          }}
        >
          {delta}
        </div>
      ) : null}
      {hint ? (
        <div
          style={{
            marginTop: economicsSpacing.xs,
            fontSize: 11,
            fontWeight: 700,
            color: economicsColorTokens.muted,
          }}
        >
          {hint}
        </div>
      ) : null}
    </article>
  )
}
