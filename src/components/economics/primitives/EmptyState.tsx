'use client'

import React from 'react'
import { economicsColorTokens, economicsSpacing } from './tokens'

type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        border: `1px solid ${economicsColorTokens.border}`,
        borderRadius: 16,
        padding: economicsSpacing.xl,
        textAlign: 'center',
        background: economicsColorTokens.surface,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900, color: economicsColorTokens.text }}>{title}</div>
      {description ? (
        <div style={{ marginTop: economicsSpacing.sm, fontSize: 13, fontWeight: 700, color: economicsColorTokens.muted }}>
          {description}
        </div>
      ) : null}
      {action ? <div style={{ marginTop: economicsSpacing.md }}>{action}</div> : null}
    </div>
  )
}
