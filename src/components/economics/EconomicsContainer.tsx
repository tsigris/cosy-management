"use client"

import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function EconomicsContainer({ children, className, style }: Props) {
  const base: React.CSSProperties = {
    maxWidth: 600,       // mobile-first: single-column comfortable width
    margin: '0 auto',
    padding: '0 16px 120px',
    width: '100%',
    boxSizing: 'border-box',
  }
  return (
    <div className={className} style={{ ...base, ...style }}>
      {children}
    </div>
  )
}
