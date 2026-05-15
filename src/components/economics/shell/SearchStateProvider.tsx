'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useEconomicsUrlSyncedState } from './economicsUrlState'

type SearchStateContextValue = {
  query: string
  setQuery: (query: string) => void
  clearQuery: () => void
}

const SearchStateContext = createContext<SearchStateContextValue | null>(null)

type SearchStateProviderProps = {
  children: React.ReactNode
  initialQuery?: string
}

export function SearchStateProvider({
  children,
  initialQuery = '',
}: SearchStateProviderProps) {
  const [query, setQuery] = useEconomicsUrlSyncedState<string>({
    key: 'q',
    defaultValue: '',
    parse: (rawValue) => rawValue?.trim() || '',
    serialize: (value) => value.trim() || null,
    isEqual: (left, right) => left === right,
  })

  const value = useMemo<SearchStateContextValue>(
    () => ({
      query,
      setQuery,
      clearQuery: () => setQuery(''),
    }),
    [query, setQuery],
  )

  return <SearchStateContext.Provider value={value}>{children}</SearchStateContext.Provider>
}

export function useSearchState() {
  const context = useContext(SearchStateContext)
  if (!context) {
    throw new Error('useSearchState must be used within SearchStateProvider')
  }
  return context
}
