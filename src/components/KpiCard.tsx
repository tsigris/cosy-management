"use client"

import React from 'react'

type Props = {
  label: string
  value?: number | null
  loading?: boolean
  hint?: string
  color?: string
  dashed?: boolean
  style?: React.CSSProperties
}

export default function KpiCard({ label, value, loading, hint, color, dashed, style }: Props) {
  const formatter = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  let parts: Intl.NumberFormatPart[] | null = null
  let numberStr = ''
  let currency = ''
  if (value != null && !Number.isNaN(Number(value))) {
    parts = formatter.formatToParts(value)
    currency = parts.find((p) => p.type === 'currency')?.value ?? ''
    numberStr = parts.filter((p) => p.type !== 'currency').map((p) => p.value).join('')
  }

  // compact fallback for very long numbers on narrow viewports
  const isCompact = typeof window !== 'undefined' && window.innerWidth < 420 && numberStr.replace(/[^0-9]/g, '').length > 10

  const outer: React.CSSProperties = {
    borderRadius: 22,
    border: dashed ? `2px dashed rgba(99,102,241,0.6)` : undefined,
    padding: 16,
    minHeight: 108,
    background: 'transparent',
    minWidth: 0,
    ...style,
  }

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 900, color: 'var(--muted)', letterSpacing: 0.6, textTransform: 'uppercase' }

  const amountWrapper: React.CSSProperties = {
    marginTop: 12,
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  }

  const amountBase: React.CSSProperties = {
    fontWeight: 900,
    lineHeight: 0.95,
    overflow: 'hidden',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    maxWidth: '100%',
  }

  const amountStyle: React.CSSProperties = {
    ...amountBase,
    fontSize: isCompact ? 'clamp(1.4rem, 6vw, 2.4rem)' : 'clamp(1.9rem, 5.5vw, 3.2rem)',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  }

  const currencyStyle: React.CSSProperties = {
    ...amountBase,
    fontSize: isCompact ? '0.82em' : '0.9em',
    opacity: 0.95,
    display: 'inline-block',
    flexShrink: 0,
  }

  const hintStyle: React.CSSProperties = { marginTop: 8, fontSize: 11, fontWeight: 800, color: 'var(--muted)' }

  return (
    <div style={outer}>
      <div style={{ minWidth: 0 }}>
        <div style={labelStyle}>{label}</div>

        <div style={amountWrapper} className="min-w-0 max-w-full overflow-hidden">
          {loading ? (
            <div style={amountStyle}>—</div>
          ) : (
            <>
              {currency ? <span style={{ ...currencyStyle, color: color ?? 'var(--text)' }} className="font-black tracking-tight leading-[0.95] break-words whitespace-normal tabular-nums">{currency}</span> : null}
              <span style={{ ...amountStyle, color: color ?? 'var(--text)' }} className={isCompact ? 'font-black tracking-tight leading-[0.95] break-words whitespace-normal tabular-nums compact-amount' : 'font-black tracking-tight leading-[0.95] break-words whitespace-normal tabular-nums'}>
                {numberStr || (value != null ? formatter.format(value) : '—')}
              </span>
            </>
          )}
        </div>

        {hint ? <div style={hintStyle}>{hint}</div> : null}
      </div>
    </div>
  )
}
