'use client'

import React from 'react'
import { KpiCard } from './KpiCard'

export type SummaryStripItem = {
  id: string
  label: string
  value: string
  delta?: string
  tone?: 'positive' | 'negative' | 'neutral'
  hint?: string
}

type SummaryStripProps = {
  items: SummaryStripItem[]
  loading?: boolean
}

export function SummaryStrip({ items, loading = false }: SummaryStripProps) {
  return (
    <section
      aria-label="Summary strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
      }}
    >
      {items.map((item) => (
        <KpiCard
          key={item.id}
          label={item.label}
          value={item.value}
          delta={item.delta}
          tone={item.tone}
          hint={item.hint}
          loading={loading}
          size="secondary"
        />
      ))}
    </section>
  )
}
