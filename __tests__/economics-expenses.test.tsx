import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  EconomicsExpenseSearchBar,
  EconomicsExpenseFilterChips,
  EconomicsExpenseTotalsStrip,
  EconomicsExpenseResultList,
  EconomicsExpensesScreen,
  DEFAULT_EXPENSE_FILTER_CHIPS,
} from '@/components/economics/expenses'
import { AsyncBoundary } from '@/components/economics/primitives'
import { SearchStateProvider } from '@/components/economics/shell/SearchStateProvider'
import { DrawerProvider } from '@/components/economics/shell/DrawerProvider'
import { SelectedDayProvider } from '@/components/economics/shell/SelectedDayProvider'
import type { EconomicsExpenseSearchDto } from '@/lib/economics/types/economicsDto'

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

/** Full provider wrapper for EconomicsExpensesScreen */
function ExpenseProviders({ children }: { children: React.ReactNode }) {
  return (
    <DrawerProvider>
      <SelectedDayProvider>
        <SearchStateProvider>{children}</SearchStateProvider>
      </SelectedDayProvider>
    </DrawerProvider>
  )
}

const MOCK_RESULTS: EconomicsExpenseSearchDto['results'] = [
  { id: 'e1', date: '2026-05-10', label: 'Coca Cola',   amount: 450.00, category: 'Αναψυκτικά', method: 'Κάρτα' },
  { id: 'e2', date: '2026-05-11', label: 'Nestlé',      amount: 220.50, category: 'Γαλακτοκομικά', method: 'Μετρητά' },
  { id: 'e3', date: '2026-05-12', label: 'Ηλεκτρισμός', amount: 180.00, category: 'Λειτουργικά', method: 'Κάρτα' },
]

const MOCK_SEARCH_DTO: EconomicsExpenseSearchDto = {
  query: '',
  results: MOCK_RESULTS,
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('economics expenses smoke', () => {
  beforeEach(() => {
    setMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    })
  })

  // 1. Search bar renders and fires onChange
  it('renders search bar and fires onChange', () => {
    const onChange = jest.fn()
    const onClear = jest.fn()

    render(
      <EconomicsExpenseSearchBar query="" onChange={onChange} onClear={onClear} />,
    )

    const input = screen.getByRole('searchbox', { name: /αναζήτηση εξόδων/i })
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Coca' } })
    expect(onChange).toHaveBeenCalledWith('Coca')
  })

  // 2. Clear button appears when query is non-empty and fires onClear
  it('shows clear button when query is non-empty and fires onClear', () => {
    const onClear = jest.fn()

    render(
      <EconomicsExpenseSearchBar query="Coca" onChange={jest.fn()} onClear={onClear} />,
    )

    const clearBtn = screen.getByRole('button', { name: /καθαρισμός/i })
    expect(clearBtn).toBeInTheDocument()

    fireEvent.click(clearBtn)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  // 3. Clear button absent when query is empty
  it('hides clear button when query is empty', () => {
    render(
      <EconomicsExpenseSearchBar query="" onChange={jest.fn()} onClear={jest.fn()} />,
    )

    expect(screen.queryByRole('button', { name: /καθαρισμός/i })).not.toBeInTheDocument()
  })

  // 4. Filter chips render and toggle
  it('renders filter chips and marks active chip', () => {
    const onSelect = jest.fn()

    render(
      <EconomicsExpenseFilterChips
        chips={DEFAULT_EXPENSE_FILTER_CHIPS}
        activeChip="all"
        onSelect={onSelect}
      />,
    )

    const group = screen.getByRole('group', { name: /φίλτρα εξόδων/i })
    expect(group).toBeInTheDocument()

    // All chip is active
    const allChip = screen.getByRole('button', { name: 'Όλα' })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')

    // Card chip is not active
    const cardChip = screen.getByRole('button', { name: 'Κάρτα' })
    expect(cardChip).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(cardChip)
    expect(onSelect).toHaveBeenCalledWith('card')
  })

  // 5. Totals strip renders count and total
  it('renders totals strip with count and amount', () => {
    render(
      <EconomicsExpenseTotalsStrip total={850.5} count={3} loading={false} />,
    )

    expect(screen.getByLabelText('Σύνολα εξόδων')).toBeInTheDocument()
    expect(screen.getByText('850,50 €')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // 6. Totals strip returns null when both total and count are undefined
  it('renders nothing for totals strip when no data', () => {
    const { container } = render(
      <EconomicsExpenseTotalsStrip loading={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  // 7. Totals strip shows loading skeleton
  it('shows loading skeleton for totals strip', () => {
    render(<EconomicsExpenseTotalsStrip total={100} loading={true} />)
    expect(screen.getByLabelText('Φόρτωση συνόλων')).toBeInTheDocument()
  })

  // 8. Result list renders expense rows
  it('renders expense result rows', () => {
    render(
      <EconomicsExpenseResultList results={MOCK_RESULTS} query="" loading={false} />,
    )

    expect(screen.getByRole('list', { name: /αποτελέσματα αναζήτησης/i })).toBeInTheDocument()
    expect(screen.getByText('Coca Cola')).toBeInTheDocument()
    expect(screen.getByText('Nestlé')).toBeInTheDocument()
    expect(screen.getByText('Ηλεκτρισμός')).toBeInTheDocument()
    expect(screen.getByText('450,00 €')).toBeInTheDocument()
  })

  // 9. Result list shows empty state with query context
  it('shows query-aware empty state when no results', () => {
    render(
      <EconomicsExpenseResultList results={[]} query="Coca Cola" loading={false} />,
    )

    expect(screen.getByText(/Δεν βρέθηκαν αποτελέσματα/i)).toBeInTheDocument()
    expect(screen.getByText(/Coca Cola/)).toBeInTheDocument()
  })

  // 10. Result list shows generic empty state when no query
  it('shows generic empty state when no query and no results', () => {
    render(
      <EconomicsExpenseResultList results={[]} query="" loading={false} />,
    )

    expect(screen.getByText(/Δεν βρέθηκαν αποτελέσματα/i)).toBeInTheDocument()
    expect(screen.getByText(/Δεν υπάρχουν έξοδα/i)).toBeInTheDocument()
  })

  // 11. Result list shows loading skeleton
  it('shows loading skeleton for result list', () => {
    render(
      <EconomicsExpenseResultList results={[]} query="" loading={true} />,
    )
    expect(screen.getByLabelText('Φόρτωση αποτελεσμάτων')).toBeInTheDocument()
  })

  // 12. Full EconomicsExpensesScreen renders search-first
  it('renders ExpensesScreen with search bar as primary element', () => {
    render(
      <ExpenseProviders>
        <EconomicsExpensesScreen
          searchData={MOCK_SEARCH_DTO}
          total={850.5}
          loading={false}
        />
      </ExpenseProviders>,
    )

    expect(screen.getByRole('searchbox', { name: /αναζήτηση εξόδων/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /φίλτρα εξόδων/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Σύνολα εξόδων')).toBeInTheDocument()
    expect(screen.getByText('Coca Cola')).toBeInTheDocument()
  })

  // 13. URL-synced query: typing in search bar updates via SearchStateProvider
  it('query driven by SearchStateProvider updates the search bar', () => {
    render(
      <ExpenseProviders>
        <EconomicsExpensesScreen
          searchData={MOCK_SEARCH_DTO}
          total={850.5}
          loading={false}
        />
      </ExpenseProviders>,
    )

    const input = screen.getByRole('searchbox', { name: /αναζήτηση εξόδων/i })
    fireEvent.change(input, { target: { value: 'Nestlé' } })
    // Input reflects the new value
    expect((input as HTMLInputElement).value).toBe('Nestlé')
  })

  // 14. Async boundary isolation: result list failure does not crash search bar
  it('isolates result boundary failure from search bar', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowInResults(): React.JSX.Element {
      throw new Error('expense results test failure')
    }

    render(
      <ExpenseProviders>
        <EconomicsExpenseSearchBar query="test" onChange={jest.fn()} onClear={jest.fn()} />
        <AsyncBoundary area="expenses">
          <ThrowInResults />
        </AsyncBoundary>
      </ExpenseProviders>,
    )

    // Search bar still present
    expect(screen.getByRole('searchbox', { name: /αναζήτηση εξόδων/i })).toBeInTheDocument()
    // Error boundary displayed
    expect(screen.getByText('Προσωρινό σφάλμα ενότητας')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  // 15. Mobile viewport smoke
  it('renders ExpensesScreen on mobile viewport without crashing', () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    render(
      <ExpenseProviders>
        <EconomicsExpensesScreen
          searchData={MOCK_SEARCH_DTO}
          total={850.5}
          loading={false}
        />
      </ExpenseProviders>,
    )

    expect(screen.getByRole('searchbox', { name: /αναζήτηση εξόδων/i })).toBeInTheDocument()
  })

  // 16. Expense screen loading state
  it('shows loading skeletons in screen when loading=true', () => {
    render(
      <ExpenseProviders>
        <EconomicsExpensesScreen
          searchData={null}
          loading={true}
        />
      </ExpenseProviders>,
    )

    expect(screen.getByLabelText('Φόρτωση αποτελεσμάτων')).toBeInTheDocument()
  })

  // 17. Date formatted correctly in result row
  it('formats dates as DD/MM/YY in result rows', () => {
    render(
      <EconomicsExpenseResultList results={MOCK_RESULTS} query="" loading={false} />,
    )

    expect(screen.getByText('10/05/26')).toBeInTheDocument()
  })

  // 18. Chip switching updates active state
  it('switches active chip on click', () => {
    const onSelect = jest.fn()

    const { rerender } = render(
      <EconomicsExpenseFilterChips
        activeChip="all"
        onSelect={onSelect}
      />,
    )

    const cashChip = screen.getByRole('button', { name: 'Μετρητά' })
    fireEvent.click(cashChip)
    expect(onSelect).toHaveBeenCalledWith('cash')

    // Simulate parent updating the activeChip prop
    rerender(
      <EconomicsExpenseFilterChips
        activeChip="cash"
        onSelect={onSelect}
      />,
    )

    expect(cashChip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Όλα' })).toHaveAttribute('aria-pressed', 'false')
  })
})
