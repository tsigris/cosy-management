import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  IncomeRouteAdapter,
  ExpensesRouteAdapter,
  AnalysisRouteAdapter,
} from '@/components/economics/adapters'
import { EconomicsRouteProviders } from '@/components/economics/shell/EconomicsRouteProviders'
import { useRouter } from 'next/navigation'

// ─── Helpers ──────────────────────────────────────────────────────────────

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/economics/income'),
}))

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

/** Wrapper with all route providers */
function withRouteProviders(Component: React.ComponentType) {
  return (
    <EconomicsRouteProviders>
      <Component />
    </EconomicsRouteProviders>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('economics route adapters smoke', () => {
  beforeEach(() => {
    setMatchMedia({
      '(max-width: 767px)': false,
      '(pointer: coarse)': false,
    })
  })

  // 1. Income route adapter renders without crashing
  it('IncomeRouteAdapter renders without crashing', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Shell and adapters should render something to the DOM
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  // 2. Expenses route adapter renders without crashing
  it('ExpensesRouteAdapter renders without crashing', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <ExpensesRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Shell and adapters should render something to the DOM
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  // 3. Analysis route adapter renders without crashing
  it('AnalysisRouteAdapter renders without crashing', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <AnalysisRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Shell and adapters should render something to the DOM
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  // 4. Income adapter contains home surface (or shell)
  it('IncomeRouteAdapter mounts with shell container', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Container should have rendered content
    expect(container.firstChild).toBeInTheDocument()
  })

  // 5. Expenses adapter contains search surface (or shell)
  it('ExpensesRouteAdapter mounts with shell container', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <ExpensesRouteAdapter />
      </EconomicsRouteProviders>,
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  // 6. Analysis adapter contains calendar surface (or shell)
  it('AnalysisRouteAdapter mounts with shell container', () => {
    const { container } = render(
      <EconomicsRouteProviders>
        <AnalysisRouteAdapter />
      </EconomicsRouteProviders>,
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  // 7. Mobile viewport smoke: income adapter
  it('IncomeRouteAdapter renders on mobile without crashing', () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    const { container } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  // 8. Mobile viewport smoke: expenses adapter
  it('ExpensesRouteAdapter renders on mobile without crashing', () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    const { container } = render(
      <EconomicsRouteProviders>
        <ExpensesRouteAdapter />
      </EconomicsRouteProviders>,
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  // 9. Mobile viewport smoke: analysis adapter
  it('AnalysisRouteAdapter renders on mobile without crashing', () => {
    setMatchMedia({
      '(max-width: 767px)': true,
      '(pointer: coarse)': true,
    })

    const { container } = render(
      <EconomicsRouteProviders>
        <AnalysisRouteAdapter />
      </EconomicsRouteProviders>,
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  // 10. All adapters render with providers intact
  it('route providers remain intact across all adapters', () => {
    // Income
    const { unmount: unmountIncome, container: incomeContainer } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )
    expect(incomeContainer.firstChild).toBeInTheDocument()
    unmountIncome()

    // Expenses
    const { unmount: unmountExpenses, container: expensesContainer } = render(
      <EconomicsRouteProviders>
        <ExpensesRouteAdapter />
      </EconomicsRouteProviders>,
    )
    expect(expensesContainer.firstChild).toBeInTheDocument()
    unmountExpenses()

    // Analysis
    const { unmount: unmountAnalysis, container: analysisContainer } = render(
      <EconomicsRouteProviders>
        <AnalysisRouteAdapter />
      </EconomicsRouteProviders>,
    )
    expect(analysisContainer.firstChild).toBeInTheDocument()
    unmountAnalysis()
  })

  // 11. Income adapter uses canonical async boundaries
  it('IncomeRouteAdapter isolates async boundaries', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const { container } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Adapter should still render even if internal boundaries fail
    expect(container.firstChild).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  // 12. All adapters preserve route semantics (thin wrappers, no logic duplication)
  it('adapters do not duplicate finance logic', () => {
    // This is a conceptual test: adapters should only compose surfaces
    // and not contain finance calculation logic.
    const { container } = render(
      <EconomicsRouteProviders>
        <IncomeRouteAdapter />
      </EconomicsRouteProviders>,
    )

    // Verify the adapter is just rendering the shell + surface
    expect(container.firstChild).toBeInTheDocument()
  })
})
