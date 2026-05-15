'use client'

import { useEffect, useState } from 'react'

type ResponsiveEconomicsLayout = {
  isCompact: boolean
  isTouch: boolean
  isDesktop: boolean
}

export function useResponsiveEconomicsLayout(): ResponsiveEconomicsLayout {
  const [isCompact, setIsCompact] = useState(false)
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 767px)')
    const touchQuery = window.matchMedia('(pointer: coarse)')

    const update = () => {
      setIsCompact(compactQuery.matches)
      setIsTouch(touchQuery.matches)
    }

    update()

    compactQuery.addEventListener('change', update)
    touchQuery.addEventListener('change', update)

    return () => {
      compactQuery.removeEventListener('change', update)
      touchQuery.removeEventListener('change', update)
    }
  }, [])

  return {
    isCompact,
    isTouch,
    isDesktop: !isCompact,
  }
}
