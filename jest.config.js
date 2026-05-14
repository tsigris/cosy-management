const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.ts'],
  collectCoverageFrom: [
    'src/lib/canonicalFinancialMetrics.ts',
    'src/lib/financialPeriods.ts',
    'src/hooks/useCanonicalFinancialPeriod.ts',
    'src/lib/server/analysisComparison.ts',
  ],
}

module.exports = createJestConfig(config)
