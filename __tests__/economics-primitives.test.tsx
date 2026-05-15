import React from 'react'
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import {
  AsyncBoundary,
  BottomSheetFrame,
  CalendarCell,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingSkeleton,
  StickySummaryBar,
  SummaryStrip,
} from '@/components/economics/primitives'
import { DrawerProvider, useBottomSheet } from '@/components/economics/shell/DrawerProvider'
import { useResponsiveEconomicsLayout } from '@/components/economics/shell/useResponsiveEconomicsLayout'

function setMatchMedia(matchesByQuery: Record<string, boolean>) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: Boolean(matchesByQuery[query]),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  })
}

describe('economics primitives smoke', () => {
  beforeEach(() => {
    setMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    })
  })

  it('renders unified loading, empty and error states', () => {
    const onRetry = jest.fn()

    render(
      <div>
        <LoadingSkeleton label="loading-state" lines={2} />
        <EmptyState title="Δεν υπάρχουν δεδομένα" description="Δοκίμασε άλλο εύρος." />
        <ErrorState title="Σφάλμα" description="Αποτυχία φόρτωσης" onRetry={onRetry} />
      </div>,
    )

    expect(screen.getByLabelText('loading-state')).toBeInTheDocument()
    expect(screen.getByText('Δεν υπάρχουν δεδομένα')).toBeInTheDocument()
    expect(screen.getByText('Αποτυχία φόρτωσης')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Επανάληψη'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders KPI hierarchy and summary primitives', () => {
    render(
      <StickySummaryBar>
        <SummaryStrip
          items={[
            { id: 'revenue', label: 'Τζίρος', value: '1.200,00 €', delta: '+5.2%', tone: 'positive' },
            { id: 'expense', label: 'Έξοδα', value: '430,00 €', delta: '-1.1%', tone: 'negative' },
          ]}
        />
      </StickySummaryBar>,
    )

    expect(screen.getByText('Τζίρος')).toBeInTheDocument()
    expect(screen.getByText('+5.2%')).toBeInTheDocument()
    expect(screen.getByText('Έξοδα')).toBeInTheDocument()
    expect(screen.getByText('-1.1%')).toBeInTheDocument()

    render(<KpiCard label="Καθαρό" value="770,00 €" size="primary" />)
    expect(screen.getByText('Καθαρό')).toBeInTheDocument()
  })

  it('renders and interacts with CalendarCell', () => {
    const onClick = jest.fn()
    render(<CalendarCell label="15/05" value="320,00 €" state="today" onClick={onClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByText('15/05')).toBeInTheDocument()
  })

  it('renders BottomSheetFrame only for matching drawer id', () => {
    function OpenDrawerButton() {
      const { openDrawer } = useBottomSheet()
      return (
        <button type="button" onClick={() => openDrawer('expenses-detail')}>
          Open drawer
        </button>
      )
    }

    render(
      <DrawerProvider>
        <OpenDrawerButton />
        <BottomSheetFrame drawerId="expenses-detail" title="Λεπτομέρειες">
          <div>Drawer body</div>
        </BottomSheetFrame>
      </DrawerProvider>,
    )

    expect(screen.queryByText('Drawer body')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Open drawer'))
    expect(screen.getByText('Drawer body')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps async boundaries isolated per area', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowInSummary(): React.JSX.Element {
      throw new Error('summary failed')
    }

    render(
      <div>
        <AsyncBoundary area="summary">
          <ThrowInSummary />
        </AsyncBoundary>
        <AsyncBoundary area="calendar">
          <div>Calendar still rendered</div>
        </AsyncBoundary>
      </div>,
    )

    expect(screen.getByText('Calendar still rendered')).toBeInTheDocument()
    expect(screen.getByText('Προσωρινό σφάλμα ενότητας')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('reports mobile layout flags from responsive hook', async () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    const { result } = renderHook(() => useResponsiveEconomicsLayout())

    await waitFor(() => {
      expect(result.current.isCompact).toBe(true)
      expect(result.current.isTouch).toBe(true)
      expect(result.current.isDesktop).toBe(false)
    })
  })
})
