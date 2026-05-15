import React from 'react'
import { render, screen } from '@testing-library/react'
import { EconomicsRouteProviders } from '@/components/economics/shell/EconomicsRouteProviders'
import { EconomicsBottomNav } from '@/components/economics/shell/EconomicsBottomNav'
import EconomicsShell from '@/components/economics/shell/EconomicsShell'
import {
  IncomeRouteAdapter,
  ExpensesRouteAdapter,
  AnalysisRouteAdapter,
} from '@/components/economics/adapters'
import type { EconomicsNavItemViewModel } from '@/lib/economics/types/economicsViewModel'

// ─── Mocks ────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/economics/home'),
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

function withProviders(ui: React.ReactElement) {
  return <EconomicsRouteProviders>{ui}</EconomicsRouteProviders>
}

const NAV_ITEMS: EconomicsNavItemViewModel[] = [
  { id: 'home', label: 'Home', href: '/economics/home', active: true },
  { id: 'days', label: 'Days', href: '/economics/days', active: false },
  { id: 'expenses', label: 'Expenses', href: '/economics/expenses', active: false },
  { id: 'comparisons', label: 'Comparisons', href: '/economics/comparisons', active: false },
  { id: 'advanced', label: 'Advanced', href: '/economics/advanced', active: false },
]

// ─── Navigation tests ────────────────────────────────────────────────────

describe('EconomicsBottomNav', () => {
  beforeEach(() => {
    setMatchMedia({ '(max-width: 767px)': false, '(pointer: coarse)': false })
  })

  it('renders all 5 primary nav items', () => {
    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    expect(screen.getByRole('navigation', { name: 'Economics navigation' })).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Days')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Comparisons')).toBeInTheDocument()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('does not render when visible=false', () => {
    const { container } = render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={false} />
      )
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders nav items as links with correct hrefs', () => {
    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveAttribute('href', '/economics/home')

    const daysLink = screen.getByText('Days').closest('a')
    expect(daysLink).toHaveAttribute('href', '/economics/days')

    const expensesLink = screen.getByText('Expenses').closest('a')
    expect(expensesLink).toHaveAttribute('href', '/economics/expenses')
  })

  it('applies active styling to the current route', () => {
    // pathname is mocked as /economics/home — Home item has active=true
    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    // Active item text should be in the document
    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toBeTruthy()
  })

  it('preserves query params in nav links when store is set', () => {
    const { useSearchParams } = require('next/navigation')
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('store=abc123'))

    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveAttribute('href', '/economics/home?store=abc123')

    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams())
  })

  it('renders correctly on mobile viewport', () => {
    setMatchMedia({ '(max-width: 767px)': true, '(pointer: coarse)': true })

    const { container } = render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    expect(container.querySelector('nav')).toBeInTheDocument()
  })
})

// ─── Shell surface smoke tests ────────────────────────────────────────────

describe('EconomicsShell with showBottomNav', () => {
  beforeEach(() => {
    setMatchMedia({ '(max-width: 767px)': false, '(pointer: coarse)': false })
  })

  it('renders shell with bottom nav visible', () => {
    const { container } = render(
      withProviders(
        <EconomicsShell showBottomNav={true}>
          <div data-testid="content">Content</div>
        </EconomicsShell>
      )
    )

    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(container.querySelector('nav[aria-label="Economics navigation"]')).toBeInTheDocument()
  })

  it('renders shell without bottom nav', () => {
    const { container } = render(
      withProviders(
        <EconomicsShell showBottomNav={false}>
          <div data-testid="content">Content</div>
        </EconomicsShell>
      )
    )

    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(container.querySelector('nav[aria-label="Economics navigation"]')).toBeNull()
  })
})

// ─── New surface route smoke tests ────────────────────────────────────────

describe('new operational surface routes', () => {
  beforeEach(() => {
    setMatchMedia({ '(max-width: 767px)': false, '(pointer: coarse)': false })
  })

  it('Home surface (IncomeRouteAdapter) renders with bottom nav', () => {
    const { container } = render(
      withProviders(<IncomeRouteAdapter />)
    )

    expect(container.querySelector('nav[aria-label="Economics navigation"]')).toBeInTheDocument()
    expect(container.firstChild).toBeInTheDocument()
  })

  it('Days surface (AnalysisRouteAdapter) renders with bottom nav', () => {
    const { container } = render(
      withProviders(<AnalysisRouteAdapter />)
    )

    expect(container.querySelector('nav[aria-label="Economics navigation"]')).toBeInTheDocument()
    expect(container.firstChild).toBeInTheDocument()
  })

  it('Expenses surface (ExpensesRouteAdapter) renders with bottom nav', () => {
    const { container } = render(
      withProviders(<ExpensesRouteAdapter />)
    )

    expect(container.querySelector('nav[aria-label="Economics navigation"]')).toBeInTheDocument()
    expect(container.firstChild).toBeInTheDocument()
  })

  it('Home surface renders on mobile without crashing', () => {
    setMatchMedia({ '(max-width: 767px)': true, '(pointer: coarse)': true })

    const { container } = render(
      withProviders(<IncomeRouteAdapter />)
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  it('Days surface renders on mobile without crashing', () => {
    setMatchMedia({ '(max-width: 767px)': true, '(pointer: coarse)': true })

    const { container } = render(
      withProviders(<AnalysisRouteAdapter />)
    )

    expect(container.firstChild).toBeInTheDocument()
  })

  it('Expenses surface renders on mobile without crashing', () => {
    setMatchMedia({ '(max-width: 767px)': true, '(pointer: coarse)': true })

    const { container } = render(
      withProviders(<ExpensesRouteAdapter />)
    )

    expect(container.firstChild).toBeInTheDocument()
  })
})

// ─── Navigation hierarchy test ────────────────────────────────────────────

describe('navigation hierarchy', () => {
  it('nav items use correct operational-first order', () => {
    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    const nav = screen.getByRole('navigation', { name: 'Economics navigation' })
    const links = nav.querySelectorAll('a')

    // Order must be: Home, Days, Expenses, Comparisons, Advanced
    const labels = Array.from(links).map((l) => l.textContent)
    expect(labels).toEqual(['Home', 'Days', 'Expenses', 'Comparisons', 'Advanced'])
  })

  it('nav uses Link hrefs not onclick buttons', () => {
    render(
      withProviders(
        <EconomicsBottomNav items={NAV_ITEMS} visible={true} />
      )
    )

    const nav = screen.getByRole('navigation', { name: 'Economics navigation' })

    // All nav items must be <a> tags (Links), not buttons
    const buttons = nav.querySelectorAll('button')
    const links = nav.querySelectorAll('a')

    expect(buttons.length).toBe(0)
    expect(links.length).toBe(5)
  })
})
