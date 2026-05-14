'use client'

import React from 'react'
import type { EconomicsNavItemViewModel } from '@/lib/economics/types/economicsViewModel'

type EconomicsBottomNavProps = {
  items: EconomicsNavItemViewModel[]
  onNavigate: (href: string) => void
  visible?: boolean
}

export function EconomicsBottomNav({ items, onNavigate, visible = true }: EconomicsBottomNavProps) {
  if (!visible) return null

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
        padding: 12,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          gap: 8,
          padding: 8,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.href)}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: item.active ? 900 : 800,
              background: item.active ? 'var(--text)' : 'transparent',
              color: item.active ? 'white' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
