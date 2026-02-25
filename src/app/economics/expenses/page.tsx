'use client'

import type { CSSProperties } from 'react'
import EconomicsTabs from '@/components/EconomicsTabs'

export default function EconomicsExpensesPage() {
  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={headerCard}>
          <h1 style={title}>Οικονομικό Κέντρο</h1>
          <p style={subtitle}>Έξοδα</p>
        </div>

        <EconomicsTabs />

        <section style={card}>
          <h2 style={cardTitle}>Σύντομα...</h2>
        </section>
      </div>
    </main>
  )
}

const pageWrap: CSSProperties = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  padding: 18,
}

const container: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  paddingBottom: 120,
}

const headerCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  padding: 16,
  marginBottom: 12,
}

const title: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 24,
  fontWeight: 900,
}

const subtitle: CSSProperties = {
  margin: '6px 0 0 0',
  color: '#64748b',
  fontSize: 13,
  fontWeight: 800,
}

const card: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  padding: 18,
}

const cardTitle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 18,
  fontWeight: 900,
}