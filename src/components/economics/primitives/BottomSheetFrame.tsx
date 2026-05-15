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
        background: 'rgba(2,6,23,0.50)',
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
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: `1px solid ${economicsColorTokens.border}`,
          borderBottom: 'none',
          background: economicsColorTokens.surfaceSolid,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Drag handle — visual affordance */}
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 0 4px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: 'rgba(148,163,184,0.35)',
            }}
          />
        </div>

        {/* Sticky header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 12px',
            flexShrink: 0,
            borderBottom: `1px solid ${economicsColorTokens.border}`,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 900,
              color: economicsColorTokens.text,
              letterSpacing: '-0.01em',
            }}
          >
            {title || 'Details'}
          </div>
          <button
            type="button"
            onClick={() => {
              closeDrawer()
              onClose?.()
            }}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 800,
              background: 'rgba(148,163,184,0.15)',
              color: economicsColorTokens.muted,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '12px 16px 32px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
