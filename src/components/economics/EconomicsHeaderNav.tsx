'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import EconomicsTabs from '@/components/EconomicsTabs'
import { useSearchParams } from 'next/navigation'

type Props = {
  title: string
  subtitle?: string
  rightControl?: React.ReactNode
  businessDate?: string
  // allow pages to opt-out of rendering the shared tabs inside the header
  showTabs?: boolean
}

// Helper: format date from YYYY-MM-DD to DD-MM-YYYY
function formatDateGR(dateString: string) {
  try {
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return dateString
  }
}

// Helper: compute business date (7:00 AM cutoff)
function getBusinessDate() {
  const now = new Date()
  if (now.getHours() < 7) now.setDate(now.getDate() - 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function EconomicsHeaderNav({ title, subtitle, rightControl, businessDate, showTabs }: Props) {
  const searchParams = useSearchParams()
  const store = searchParams?.get('store') || ''
  const [isMobile, setIsMobile] = useState(false)

  // Compute or use provided business date
  const bDate = useMemo(() => businessDate || getBusinessDate(), [businessDate])

  // Detect mobile view
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const t = {
    border: 'var(--border)',
    solidCard: 'var(--surfaceSolid)',
    text: 'var(--text)',
    muted: 'var(--muted)',
  }

  const container: React.CSSProperties = { maxWidth: 920, margin: '0 auto' }
  const headerCard: React.CSSProperties = {
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: 'var(--bg-grad)',
    boxShadow: 'var(--shadow)',
    padding: 16,
    marginBottom: 12,
    backdropFilter: 'blur(10px)',
  }

  const titleStyle: React.CSSProperties = { margin: 0, color: t.text, fontSize: 24, fontWeight: 900 }
  const subtitleStyle: React.CSSProperties = { margin: '6px 0 0 0', color: t.muted, fontSize: 13, fontWeight: 800 }

  // Chip styling
  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
    whiteSpace: 'nowrap',
  }

  // Right panel styling
  const rightPanelStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: isMobile ? 'wrap' : 'nowrap',
  }

  return (
    <div style={container}>
      <div style={headerCard}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: 12 }}>
          <div>
            <h1 style={titleStyle}>{title}</h1>
            {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
          </div>

          <div style={rightPanelStyle}>
            {rightControl ? (
              rightControl
            ) : (
              <>
                <div style={chipStyle}>📅 {formatDateGR(bDate)}</div>
                <div style={chipStyle}>🏪 {store || '—'}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {showTabs !== false ? <EconomicsTabs /> : null}
    </div>
  )
}
