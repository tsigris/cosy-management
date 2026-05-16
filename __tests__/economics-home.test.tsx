import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  EconomicsHomeSummarySection,
  EconomicsYoYStrip,
  EconomicsHomeScreen,
} from '@/components/economics/home'
import { AsyncBoundary } from '@/components/economics/primitives'
import type {
  EconomicsHomeSummaryDto,
  EconomicsComparisonDto,
} from '@/lib/economics/types/economicsDto'

// ─── Helpers ──────────────────────────────────────────────────────────────

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

const MOCK_SUMMARY: EconomicsHomeSummaryDto = {
  todayLabel: 'Σήμερα',
  todayRevenue: 1500,
  todayProfit: 420,
  monthRevenue: 38000,
  monthProfit: 9800,
  cashRevenue: 600,
  cardRevenue: 900,
  bestDayLabel: 'Τετάρτη 13/05',
  worstDayLabel: 'Δευτέρα 11/05',
}

const MOCK_COMPARISON: EconomicsComparisonDto = {
  periodLabel: 'Μάιος 2026',
  previousPeriodLabel: 'Μάιος 2025',
  currentTotal: 38000,
  previousTotal: 34000,
  delta: 4000,
  deltaPct: 11.8,
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('economics home smoke', () => {
  beforeEach(() => {
    setMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    })
  })

  // 1. Home screen renders without crashing
  it('renders EconomicsHomeScreen without crashing', () => {
    render(
      <EconomicsHomeScreen
        summary={MOCK_SUMMARY}
        comparison={MOCK_COMPARISON}
        summaryLoading={false}
        comparisonLoading={false}
      />,
    )

    expect(screen.getByText('Περίοδος')).toBeInTheDocument()
    expect(screen.getByText('Ιστορικό επιχειρησιακής περιόδου')).toBeInTheDocument()
    expect(screen.getByText('Ημερήσιο ιστορικό')).toBeInTheDocument()
  })

  // 2. Today section shows primary KPIs
  it('renders today revenue and profit as primary KPIs', () => {
    render(<EconomicsHomeSummarySection summary={MOCK_SUMMARY} loading={false} />)

    // Revenue: 1500 → 1.500,00 €
    expect(screen.getByText('1.500,00 €')).toBeInTheDocument()
    // Profit: 420 → 420,00 €
    expect(screen.getByText('420,00 €')).toBeInTheDocument()
  })

  // 3. Month section renders
  it('renders month-to-date KPIs', () => {
    render(<EconomicsHomeSummarySection summary={MOCK_SUMMARY} loading={false} />)

    expect(screen.getByText('Τζίρος μήνα')).toBeInTheDocument()
    expect(screen.getByText('Κέρδος μήνα')).toBeInTheDocument()
    expect(screen.getByText('38.000,00 €')).toBeInTheDocument()
    expect(screen.getByText('9.800,00 €')).toBeInTheDocument()
  })

  // 4. Cash vs card renders
  it('renders cash and card breakdown', () => {
    render(<EconomicsHomeSummarySection summary={MOCK_SUMMARY} loading={false} />)

    expect(screen.getByText('Μετρητά')).toBeInTheDocument()
    expect(screen.getByText('Κάρτα')).toBeInTheDocument()
    expect(screen.getByText('600,00 €')).toBeInTheDocument()
    expect(screen.getByText('900,00 €')).toBeInTheDocument()
  })

  // 5. Best/worst day footnote
  it('renders best and worst day highlights', () => {
    render(<EconomicsHomeSummarySection summary={MOCK_SUMMARY} loading={false} />)

    expect(screen.getByText('Τετάρτη 13/05')).toBeInTheDocument()
    expect(screen.getByText('Δευτέρα 11/05')).toBeInTheDocument()
  })

  // 6. YoY strip renders period labels and delta
  it('renders YoY comparison strip with period and delta', () => {
    render(<EconomicsYoYStrip comparison={MOCK_COMPARISON} loading={false} />)

    expect(screen.getByText('Μάιος 2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Σύγκριση προηγούμενης περιόδου')).toBeInTheDocument()
    // delta pct: +11.8%
    expect(screen.getByText('+11,8%')).toBeInTheDocument()
  })

  // 7. YoY strip shows positive tone for positive delta
  it('renders positive direction for positive delta', () => {
    render(<EconomicsYoYStrip comparison={MOCK_COMPARISON} loading={false} />)
    // Up arrow for positive delta
    expect(screen.getByText('↑')).toBeInTheDocument()
  })

  // 8. YoY strip shows negative tone for negative delta
  it('renders negative direction for negative delta', () => {
    const negative: EconomicsComparisonDto = {
      ...MOCK_COMPARISON,
      delta: -2000,
      deltaPct: -5.9,
    }
    render(<EconomicsYoYStrip comparison={negative} loading={false} />)
    expect(screen.getByText('↓')).toBeInTheDocument()
    expect(screen.getByText('-5,9%')).toBeInTheDocument()
  })

  // 9. YoY strip returns null when comparison is null
  it('renders nothing for null comparison', () => {
    const { container } = render(<EconomicsYoYStrip comparison={null} loading={false} />)
    expect(container.firstChild).toBeNull()
  })

  // 10. Loading states
  it('shows loading skeleton for summary when loading=true', () => {
    render(<EconomicsHomeSummarySection summary={null} loading={true} />)
    expect(screen.getByLabelText('Φόρτωση σύνοψης')).toBeInTheDocument()
  })

  it('shows loading skeleton for YoY strip when loading=true', () => {
    render(<EconomicsYoYStrip comparison={null} loading={true} />)
    expect(screen.getByLabelText('Φόρτωση σύγκρισης')).toBeInTheDocument()
  })

  // 11. Empty state when no summary
  it('shows empty state for null summary when not loading', () => {
    render(<EconomicsHomeSummarySection summary={null} loading={false} />)
    expect(screen.getByText('Δεν υπάρχουν δεδομένα')).toBeInTheDocument()
  })

  // 12. Async boundary isolation: comparison failure does NOT crash summary
  it('isolates comparison boundary failure from summary', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowInComparison(): React.JSX.Element {
      throw new Error('comparison boundary test failure')
    }

    render(
      <div>
        <AsyncBoundary area="summary">
          <EconomicsHomeSummarySection summary={MOCK_SUMMARY} loading={false} />
        </AsyncBoundary>
        <AsyncBoundary area="comparison">
          <ThrowInComparison />
        </AsyncBoundary>
      </div>,
    )

    // Summary must still render — revenue is a unique value here
    expect(screen.getByText('1.500,00 €')).toBeInTheDocument()
    // Error boundary message for the comparison area
    expect(screen.getByText('Προσωρινό σφάλμα ενότητας')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  // 13. Mobile viewport smoke
  it('renders HomeScreen on mobile viewport without crashing', () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    render(
      <EconomicsHomeScreen
        summary={MOCK_SUMMARY}
        comparison={MOCK_COMPARISON}
        summaryLoading={false}
        comparisonLoading={false}
      />,
    )

    expect(screen.getByText('Περίοδος')).toBeInTheDocument()
    expect(screen.getByText('Ημερήσιο ιστορικό')).toBeInTheDocument()
  })

  // 14. EconomicsHomeScreen passes comparison loading to section
  it('shows comparison loading text when HomeScreen is in loading state', () => {
    render(
      <EconomicsHomeScreen
        summary={null}
        comparison={null}
        summaryLoading={true}
        comparisonLoading={true}
      />,
    )

    expect(screen.getByText('Φόρτωση σύγκρισης...')).toBeInTheDocument()
  })

  // 15. Summary without cash/card does not render payment row
  it('does not render cash/card section when values are absent', () => {
    const noPayment: EconomicsHomeSummaryDto = {
      todayRevenue: 1000,
      todayProfit: 200,
    }
    render(<EconomicsHomeSummarySection summary={noPayment} loading={false} />)

    expect(screen.queryByText('Μετρητά')).not.toBeInTheDocument()
    expect(screen.queryByText('Κάρτα')).not.toBeInTheDocument()
  })
})
