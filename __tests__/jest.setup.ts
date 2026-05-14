/**
 * Jest test setup
 * Configure test environment and global mocks
 */

import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  useServerInsertedHTML() {
    return jest.fn()
  },
}))

// Mock Supabase client
jest.mock('@/lib/supabase-browser', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      data: [],
      error: null,
    }),
    rpc: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  },
}))

// Mock server Supabase
jest.mock('@/lib/supabase', () => ({
  getSupabase: jest.fn(() => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      data: [],
      error: null,
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  supabaseServer: jest.fn(() => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      data: [],
      error: null,
    }),
    rpc: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  })),
}))

// Increase timeout for financial tests
jest.setTimeout(10000)

// Suppress console errors in test output (optional)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
