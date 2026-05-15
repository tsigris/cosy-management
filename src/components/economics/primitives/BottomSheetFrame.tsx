'use client'

import React from 'react'
import { useBottomSheet } from '@/components/economics/shell/DrawerProvider'
import { economicsColorTokens } from './tokens'

type BottomSheetFrameProps = {
  drawerId: string
  title?: string
  children: React.ReactNode
  onClose?: () => void
}

export function BottomSheetFrame({ drawerId, title, children, onClose }: BottomSheetFrameProps) {
  const { drawerId: activeDrawerId, closeDrawer } = useBottomSheet()
  const isOpen = activeDrawerId === drawerId

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.45)',
        zIndex: 45,
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={() => {
        closeDrawer()
        onClose?.()
      }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '88dvh',
          overflowY: 'auto',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          border: `1px solid ${economicsColorTokens.border}`,
          background: economicsColorTokens.surfaceSolid,
          padding: 16,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: economicsColorTokens.text }}>{title || 'Λεπτομέρειες'}</div>
          <button
            type="button"
            onClick={() => {
              closeDrawer()
              onClose?.()
            }}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 11,
              fontWeight: 900,
              background: 'rgba(148,163,184,0.18)',
              color: economicsColorTokens.text,
            }}
          >
            Κλείσιμο
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
