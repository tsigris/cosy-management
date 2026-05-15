'use client'

import React, { useCallback, useRef } from 'react'
import { economicsColorTokens, economicsSpacing } from '@/components/economics/primitives/tokens'

type EconomicsExpenseSearchBarProps = {
  query: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
}

export function EconomicsExpenseSearchBar({
  query,
  onChange,
  onClear,
  placeholder = 'Αναζήτηση εξόδων…',
}: EconomicsExpenseSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  const handleClear = useCallback(() => {
    onClear()
    inputRef.current?.focus()
  }, [onClear])

  return (
    <div
      role="search"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: economicsSpacing.sm,
        border: `1.5px solid ${query ? economicsColorTokens.neutral : economicsColorTokens.border}`,
        borderRadius: 14,
        padding: `${economicsSpacing.sm}px ${economicsSpacing.md}px`,
        background: economicsColorTokens.surface,
        transition: 'border-color 120ms ease',
      }}
    >
      {/* Search icon */}
      <span aria-hidden="true" style={{ fontSize: 14, color: economicsColorTokens.muted, flexShrink: 0 }}>
        🔍
      </span>

      <input
        ref={inputRef}
        type="search"
        aria-label="Αναζήτηση εξόδων"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          fontWeight: 600,
          color: economicsColorTokens.text,
          minWidth: 0,
        }}
      />

      {query.length > 0 && (
        <button
          type="button"
          aria-label="Καθαρισμός αναζήτησης"
          onClick={handleClear}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: `2px ${economicsSpacing.xs}px`,
            background: 'rgba(148,163,184,0.18)',
            fontSize: 11,
            fontWeight: 900,
            color: economicsColorTokens.muted,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
