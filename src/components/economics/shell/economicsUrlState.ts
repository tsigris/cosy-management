'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type UrlSyncedStateOptions<T> = {
  key: string
  defaultValue: T
  parse: (rawValue: string | null) => T
  serialize: (value: T) => string | null
  isEqual?: (left: T, right: T) => boolean
}

const sameValue = <T,>(left: T, right: T) => Object.is(left, right)

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
  const searchParamsString = searchParams?.toString() || ''

  // Track state of URL to prevent bidirectional sync loops
  const lastProcessedUrlRef = useRef<string>('')
  const syncFromUrlRef = useRef(false)

  const getValueFromSearchParams = (source: string) => {
    const parsedParams = new URLSearchParams(source)
    return parse(parsedParams.get(key))
  }

  const initialValue = useMemo(
    () => getValueFromSearchParams(searchParamsString),
    // Only recompute on mount or if this key/parse/defaultValue changes (not on every URL update)
    [key, parse, defaultValue],
  )
  const [value, setValue] = useState<T>(initialValue)

  // Effect 1: Read from URL when it changes (and sync to state)
  useEffect(() => {
    if (lastProcessedUrlRef.current === searchParamsString) return

    lastProcessedUrlRef.current = searchParamsString
    syncFromUrlRef.current = true

    const nextValue = getValueFromSearchParams(searchParamsString)
    if (!isEqual(value, nextValue)) {
      setValue(nextValue)
    }

    // Reset flag after microtask
    queueMicrotask(() => {
      syncFromUrlRef.current = false
    })
  }, [key, parse, searchParamsString, isEqual, value])

  // Effect 2: Write to URL when state changes (but not if we just synced FROM URL)
  useEffect(() => {
    // If we just synced FROM URL, don't immediately write back to URL
    if (syncFromUrlRef.current) return

    const currentValue = getValueFromSearchParams(searchParamsString)
    if (isEqual(value, currentValue)) return

    const nextParams = new URLSearchParams(searchParamsString)
    const serializedValue = serialize(value)

    if (serializedValue == null || isEqual(value, defaultValue)) {
      nextParams.delete(key)
    } else {
      nextParams.set(key, serializedValue)
    }

    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    const currentUrl = searchParamsString ? `${pathname}?${searchParamsString}` : pathname

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false })
    }
  }, [defaultValue, isEqual, key, pathname, router, searchParamsString, serialize, value])

  return [value, setValue] as const
}
