'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { AnalysisContent } from '@/app/analysis/page'

export default function EconomicsAnalysisPage() {
  const searchParams = useSearchParams()
  const store = searchParams?.get('store') || ''

  return (
    <main style={{ background: 'var(--bg-grad)', minHeight: '100vh', padding: 20 }}>
      <EconomicsContainer>
        <EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Ανάλυση" />
        <div style={{ marginTop: 6, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>KPIs και γρήγορη εικόνα οικονομικών</p>
        </div>

        <AnalysisContent embeddedInEconomics />
      </EconomicsContainer>
    </main>
  )
}
