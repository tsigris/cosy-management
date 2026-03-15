'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import { AnalysisContent } from '@/app/analysis/page'

export default function EconomicsAnalysisPage() {
  const searchParams = useSearchParams()
  const store = searchParams?.get('store') || ''

  return (
    <div>
      <EconomicsHeaderNav title="Ανάλυση" subtitle="KPIs και γρήγορη εικόνα" />
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <AnalysisContent />
      </div>
    </div>
  )
}
