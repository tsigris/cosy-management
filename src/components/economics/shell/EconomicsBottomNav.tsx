'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { EconomicsNavItemViewModel } from '@/lib/economics/types/economicsViewModel'

type EconomicsBottomNavProps = {
  items: EconomicsNavItemViewModel[]
  visible?: boolean
}

export function EconomicsBottomNav({ items, visible = true }: EconomicsBottomNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (!visible) return null

  const withQuery = (href: string) => {
    const qs = searchParams?.toString()
    return qs ? `${href}?${qs}` : href
  }

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <nav
      aria-label="Economics navigation"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 12px) 0',
        paddingTop: 8,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          marginBottom: 8,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.94)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {items.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.id}
              href={withQuery(item.href)}
              style={{
                textDecoration: 'none',
                borderRadius: 999,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: active ? 900 : 700,
                background: active ? 'var(--text)' : 'transparent',
                color: active ? 'white' : 'var(--muted)',
                transition: 'all 120ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
