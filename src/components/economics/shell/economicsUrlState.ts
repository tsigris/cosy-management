'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type UrlSyncedStateOptions<T> = {
  key: string
  defaultValue: T
  parse: (rawValue: string | null) => T
  serialize: (value: T) => string | null
  isEqual?: (left: T, right: T) => boolean
}

type DateRangeValue = {
  from: string
  to: string
}

type UrlSyncedDateRangeOptions = {
  fromKey: string
  toKey: string
  defaultFrom: string
  defaultTo: string
  parse: (rawValue: string | null, fallback: string) => string
  serialize: (value: string) => string | null
}

const sameValue = <T,>(left: T, right: T) => Object.is(left, right)

/**
 * Bidirectional URL ↔ state sync hook.
 *
 * Stability contract:
 *   - parse/serialize/isEqual are stored in refs — new function identities do NOT cause
 *     effect re-runs (safe for inline arrow functions in provider bodies).
 *   - Effect 1 (URL → state): only fires when searchParamsString changes.
 *     Skips echo-backs of writes we made ourselves via lastWrittenQueryRef.
 *   - Effect 2 (state → URL): only fires when value, pathname, or searchParamsString changes.
 *     Exits early if URL already matches the desired state.
 *   - router.replace is only called when the URL actually needs to change.
 */
export function useEconomicsUrlSyncedState<T>({
  key,
  defaultValue,
  parse,
  serialize,
  isEqual = sameValue,
}: UrlSyncedStateOptions<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams?.toString() ?? ''

  // Store callbacks in refs so effects don't list them as deps.
  // Effects will always use the latest version via ref.current.
  const parseRef = useRef(parse)
  const serializeRef = useRef(serialize)
  const isEqualRef = useRef(isEqual)
  parseRef.current = parse
  serializeRef.current = serialize
  isEqualRef.current = isEqual

  // Initialize state from URL on mount only.
  const [value, setValue] = useState<T>(() =>
    parse(searchParams?.get(key) ?? null),
  )

  // Track the query string we last wrote so Effect 1 does not echo it back.
  const lastWrittenQueryRef = useRef<string | null>(null)

  // Effect 1: URL → state
  // Fires only when the URL search params actually change.
  useEffect(() => {
    // If this URL change was caused by our own router.replace, skip to avoid echo.
    if (lastWrittenQueryRef.current !== null && lastWrittenQueryRef.current === searchParamsString) {
      lastWrittenQueryRef.current = null
      return
    }

    const rawValue = new URLSearchParams(searchParamsString).get(key)
    const urlValue = parseRef.current(rawValue)
    setValue((prev) => (isEqualRef.current(prev, urlValue) ? prev : urlValue))
  }, [key, searchParamsString])

  // Effect 2: state → URL
  // Fires when the value changes (or when URL/pathname changes so we can re-validate).
  useEffect(() => {
    const rawValue = new URLSearchParams(searchParamsString).get(key)
    const urlValue = parseRef.current(rawValue)

    // State already reflected in URL — nothing to do.
    if (isEqualRef.current(value, urlValue)) return

    const nextParams = new URLSearchParams(searchParamsString)
    const serialized = serializeRef.current(value)

    if (serialized == null || isEqualRef.current(value, defaultValue)) {
      nextParams.delete(key)
    } else {
      nextParams.set(key, serialized)
    }

    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

    if (nextUrl === currentUrl) return

    // Record what we wrote before calling replace, so Effect 1 ignores the echo.
    lastWrittenQueryRef.current = nextQuery
    router.replace(nextUrl, { scroll: false })
  }, [key, defaultValue, value, pathname, router, searchParamsString])

  return [value, setValue] as const
}

/**
 * Atomic URL ↔ date range sync for from/to pairs.
 *
 * Both keys are updated in a single router.replace so stale pair merges cannot occur.
 */
export function useEconomicsUrlSyncedDateRangeState({
  fromKey,
  toKey,
  defaultFrom,
  defaultTo,
  parse,
  serialize,
}: UrlSyncedDateRangeOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams?.toString() ?? ''

  const parseRef = useRef(parse)
  const serializeRef = useRef(serialize)
  parseRef.current = parse
  serializeRef.current = serialize

  const [value, setValue] = useState<DateRangeValue>(() => ({
    from: parse(searchParams?.get(fromKey) ?? null, defaultFrom),
    to: parse(searchParams?.get(toKey) ?? null, defaultTo),
  }))

  const lastWrittenQueryRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastWrittenQueryRef.current !== null && lastWrittenQueryRef.current === searchParamsString) {
      lastWrittenQueryRef.current = null
      return
    }

    const params = new URLSearchParams(searchParamsString)
    const from = parseRef.current(params.get(fromKey), defaultFrom)
    const to = parseRef.current(params.get(toKey), defaultTo)

    setValue((prev) => (prev.from === from && prev.to === to ? prev : { from, to }))
  }, [searchParamsString, fromKey, toKey, defaultFrom, defaultTo])

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const currentFrom = parseRef.current(params.get(fromKey), defaultFrom)
    const currentTo = parseRef.current(params.get(toKey), defaultTo)

    if (currentFrom === value.from && currentTo === value.to) return

    const nextParams = new URLSearchParams(searchParamsString)
    const serializedFrom = serializeRef.current(value.from)
    const serializedTo = serializeRef.current(value.to)

    if (serializedFrom == null || value.from === defaultFrom) {
      nextParams.delete(fromKey)
    } else {
      nextParams.set(fromKey, serializedFrom)
    }

    if (serializedTo == null || value.to === defaultTo) {
      nextParams.delete(toKey)
    } else {
      nextParams.set(toKey, serializedTo)
    }

    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

    if (nextUrl === currentUrl) return

    lastWrittenQueryRef.current = nextQuery
    router.replace(nextUrl, { scroll: false })
  }, [
    value.from,
    value.to,
    pathname,
    router,
    searchParamsString,
    fromKey,
    toKey,
    defaultFrom,
    defaultTo,
  ])

  return [value, setValue] as const
}
