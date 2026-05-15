'use client'

import React, { Suspense } from 'react'
import { LoadingSkeleton } from './LoadingSkeleton'
import { ErrorState } from './ErrorState'

export type EconomicsAsyncArea =
  | 'shell'
  | 'summary'
  | 'calendar'
  | 'drawer'
  | 'comparison'
  | 'expenses'
  | 'advanced'

type AsyncBoundaryProps = {
  area: EconomicsAsyncArea
  loadingFallback?: React.ReactNode
  errorFallback?: React.ReactNode
  children: React.ReactNode
}

type AsyncBoundaryState = {
  hasError: boolean
}

class AsyncBoundaryInner extends React.Component<AsyncBoundaryProps, AsyncBoundaryState> {
  constructor(props: AsyncBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): AsyncBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[economics][${this.props.area}] render failure`, error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.errorFallback ?? (
        <ErrorState
          title="Προσωρινό σφάλμα ενότητας"
          description={`Η ενότητα ${this.props.area} δεν ήταν διαθέσιμη.`}
        />
      )
    }

    return this.props.children
  }
}

export function AsyncBoundary({ area, loadingFallback, errorFallback, children }: AsyncBoundaryProps) {
  return (
    <AsyncBoundaryInner area={area} loadingFallback={loadingFallback} errorFallback={errorFallback}>
      <Suspense fallback={loadingFallback ?? <LoadingSkeleton lines={3} label={`Φόρτωση ${area}`} />}>
        {children}
      </Suspense>
    </AsyncBoundaryInner>
  )
}
