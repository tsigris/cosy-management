'use client'

import React from 'react'
import { economicsColorTokens } from './tokens'

type StickySummaryBarProps = {
  children: React.ReactNode
  top?: number
}

export function StickySummaryBar({ children, top = 76 }: StickySummaryBarProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top,
        zIndex: 15,
        marginBottom: 12,
        padding: 8,
        borderRadius: 14,
        border: `1px solid ${economicsColorTokens.border}`,
        background: economicsColorTokens.surface,
        backdropFilter: 'blur(6px)',
      }}
    >
      {children}
    </div>
  )
}
