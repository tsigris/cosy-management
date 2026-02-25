'use client'

import type { CSSProperties } from 'react'
import EconomicsTabs from '@/components/EconomicsTabs'

export default function EconomicsCreditsPage() {
  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={headerCard}>
          <h1 style={title}>Οικονομικό Κέντρο</h1>
          <p style={subtitle}>Πιστώσεις</p>
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
    'var(--bg-grad)',
  padding: 18,
}

const container: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  paddingBottom: 120,
}

const headerCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  marginBottom: 12,
}

const title: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 24,
  fontWeight: 900,
}

const subtitle: CSSProperties = {
  margin: '6px 0 0 0',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 800,
}

const card: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 18,
}

const cardTitle: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 900,
}