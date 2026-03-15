'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import EconomicsTabs from '@/components/EconomicsTabs'
import { useSearchParams } from 'next/navigation'

type Props = {
  title: string
  subtitle?: string
  rightControl?: React.ReactNode
  // optional theme control from parent pages (cashflow passes its theme state)
  theme?: 'light' | 'dark'
  setTheme?: (v: 'light' | 'dark') => void
}

export default function EconomicsHeaderNav({ title, subtitle, rightControl, theme, setTheme }: Props) {
  const searchParams = useSearchParams()
  const store = searchParams?.get('store') || ''

  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(theme ?? 'light')

  useEffect(() => {
    if (theme) setLocalTheme(theme)
  }, [theme])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cosy_theme')
      if (!theme && (saved === 'light' || saved === 'dark')) setLocalTheme(saved)
    } catch {
      // ignore
    }
  }, [theme])

  const toggle = () => {
    const next = localTheme === 'dark' ? 'light' : 'dark'
    if (setTheme) setTheme(next)
    setLocalTheme(next)
    try {
      window.localStorage.setItem('cosy_theme', next)
    } catch {
      // ignore
    }
  }

  const t = {
    border: 'var(--border)',
    solidCard: 'var(--surfaceSolid)',
    text: 'var(--text)',
    muted: 'var(--muted)',
    isDark: localTheme === 'dark',
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

  const themeBtn: React.CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.solidCard,
    color: t.text,
    fontWeight: 900,
    fontSize: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    boxShadow: t.isDark ? 'none' : '0 8px 14px rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={container}>
      <div style={headerCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h1 style={titleStyle}>{title}</h1>
            {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
          </div>

          <div>
            {rightControl ? (
              rightControl
            ) : (
              <button type="button" onClick={toggle} style={themeBtn} aria-label="toggle theme">
                {localTheme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
            )}
          </div>
        </div>
      </div>

      <EconomicsTabs />
    </div>
  )
}
