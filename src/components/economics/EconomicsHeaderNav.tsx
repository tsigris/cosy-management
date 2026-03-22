'use client'

import React, { useEffect, useMemo, useState } from 'react'
import EconomicsTabs from '@/components/EconomicsTabs'
import { useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getTodayDateISO } from '@/lib/businessDate'
import { formatDateDMY } from '@/lib/formatters'

type StoreHeaderRow = {
  name?: string | null
  company_name?: string | null
}

type Props = {
  title: string
  subtitle?: string
  rightControl?: React.ReactNode
  businessDate?: string
  // allow pages to opt-out of rendering the shared tabs inside the header
  showTabs?: boolean
}

function formatDateGR(dateString: string) {
  return formatDateDMY(dateString, dateString)
}

export default function EconomicsHeaderNav({ title, subtitle, rightControl, businessDate, showTabs }: Props) {
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const storeId = searchParams?.get('store') || ''
  const [isMobile, setIsMobile] = useState(false)
  const [storeDisplayTitle, setStoreDisplayTitle] = useState('')

  // Compute or use provided business date
  const bDate = useMemo(() => businessDate || getTodayDateISO(), [businessDate])

  // Detect mobile view
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    let cancelled = false

    const pickStoreTitle = (row: StoreHeaderRow | null | undefined) => {
      const displayTitle = String(row?.name ?? '').trim()
      if (displayTitle) return displayTitle

      const companyName = String(row?.company_name ?? '').trim()
      if (companyName) return companyName

      return storeId
    }

    const loadStoreTitle = async () => {
      if (!storeId) {
        setStoreDisplayTitle('')
        return
      }

      try {
        const { data, error } = await supabase
          .from('stores')
          .select('name, company_name')
          .eq('id', storeId)
          .maybeSingle<StoreHeaderRow>()

        if (error) throw error
        if (!cancelled) setStoreDisplayTitle(pickStoreTitle(data))
      } catch {
        if (!cancelled) setStoreDisplayTitle(storeId)
      }
    }

    void loadStoreTitle()

    return () => {
      cancelled = true
    }
  }, [storeId, supabase])

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
                <div style={chipStyle}>🏪 {storeDisplayTitle || storeId || '—'}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {showTabs !== false ? <EconomicsTabs /> : null}
    </div>
  )
}
