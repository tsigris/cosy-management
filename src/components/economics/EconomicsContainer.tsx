"use client"

import React from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function EconomicsContainer({ children, className, style }: Props) {
  const base: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', paddingBottom: 120 }
  return (
    <div className={className} style={{ ...base, ...style }}>
      {children}
    </div>
  )
}
