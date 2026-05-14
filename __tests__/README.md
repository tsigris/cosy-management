## Financial Regression Test Suite

Comprehensive test suite for the canonical financial metrics engine to prevent metric drift across all pages.

### 🎯 Purpose

This test suite ensures that financial metrics remain consistent across all pages (dashboard, reports, profit, analysis, cashflow, comparison) by:

1. **Fixture-based Testing**: Defining 14+ realistic financial scenarios with known outcomes
2. **Unit Tests**: Testing each classifier and aggregation function in isolation
3. **Integration Tests**: Verifying cross-page consistency using the same fixtures
4. **Invariant Tests**: Detecting financial metric leakage or double-counting
5. **Date Math Tests**: Ensuring DST-safe and leap-year-safe date calculations

### 📁 File Structure

```
__tests__/
├── jest.setup.ts                    # Jest configuration and mocks
├── jest.config.ts                   # Jest configuration file
├── fixtures/
│   └── financialScenarios.ts        # 14+ test scenarios with expected outcomes
├── helpers/
│   └── assertions.ts                # Test assertion utilities
├── canonicalFinancialMetrics.test.ts # Classifier & aggregator unit tests
├── financialPeriods.test.ts         # Date math & period generation tests
├── financial-invariants.test.ts     # Cross-page consistency tests
└── analysisComparison.test.ts       # Server-side YoY comparison tests
```

### 🧪 Test Categories

#### 1. Classifier Tests (`canonicalFinancialMetrics.test.ts`)

Tests for transaction type detection:
- `isRevenueTransaction()` - Identifies income transactions
- `isExpenseTransaction()` - Identifies expense/payroll/debt transactions
- `isCreditExpenseTransaction()` - Flags pending credit expenses
- `isTransferMovement()` - Identifies internal transfers
- `isZTransaction()` - Identifies cash register Z-income
- `isSavingsDepositTransaction()` - Identifies savings deposits
- `isSavingsWithdrawalTransaction()` - Identifies savings withdrawals
- `isDebtPaymentTransaction()` - Identifies debt payments
- `isDebtCollectionTransaction()` - Identifies collections
- `isCashLikeMethod()` - Identifies cash payment methods
- `isCardLikeMethod()` - Identifies card payment methods

#### 2. Aggregation Tests (`canonicalFinancialMetrics.test.ts`)

Tests for `aggregateCanonicalFinancialMetrics()`:
- Empty period handling
- Single transaction aggregation
- Multiple transaction aggregation
- Credit expense handling (excluded from expenses, tracked separately)
- Transfer exclusion from profit
- Savings exclusion from profit
- Payment method classification (cash vs. card)
- Date range filtering
- All 14 fixture scenarios

#### 3. Date Math Tests (`financialPeriods.test.ts`)

Tests for DST-safe date calculations:
- UTC epoch day conversion and round-tripping
- Inclusive day counting (DST boundaries, leap years)
- Date arithmetic (add/subtract days)
- Month range generation (handles 28/29/30/31 day months)
- Year range generation (handles leap years)
- Rolling 30-day window generation
- Canonical period range generation
- Date key enumeration

#### 4. Cross-Page Consistency Tests (`financial-invariants.test.ts`)

Ensures all pages produce identical metrics for the same data:
- Dashboard vs. Reports consistency
- Reports vs. Profit consistency
- Analysis vs. Comparison consistency
- Cashflow consistency
- Period filter consistency (month, year, 30-day)
- No double-counting across classifications
- Metric drift detection
- Rolling 30-day semantics validation

#### 5. Server-side Comparison Tests (`analysisComparison.test.ts`)

Tests for YoY comparison logic:
- Comparison structure validation
- YoY growth calculations
- Zero-division handling
- Cumulative total consistency
- Profit calculation in comparisons

### 📊 Test Fixtures

The test suite includes 14 comprehensive scenarios:

1. **Empty Period** - No transactions
2. **Single Cash Income** - Single income transaction
3. **Basic Income and Expense** - Simple profit calculation
4. **Cash and Card Mix** - Multiple payment methods
5. **Credit Expenses** - Pending credit transactions
6. **Transfers** - Internal account transfers
7. **Savings** - Deposit/withdrawal movements
8. **Debt Payments** - Debt payment transactions
9. **Debt Collections** - Collection transactions
10. **Z-Income** - Cash register Z-income
11. **Payroll** - Salary advance transactions
12. **Complex Month** - Mixed realistic scenario
13. **Only Transfers** - Transfer-only period
14. **Large Transactions** - Decimal precision testing

Each fixture includes:
- Transaction rows with dates, amounts, types, categories, methods, credit flags
- Expected totals for all metrics (revenue, expenses, profit, credits, etc.)
- Cash/card breakdown expectations
- Transfer and savings movement expectations

### 🚀 Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only financial tests
npm run test:financial

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- canonicalFinancialMetrics.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Rolling 30-day"
```

### 📋 Key Assertions

#### Numeric Equality with Epsilon
```typescript
assertNumericEqual(actual, expected, message)
// Allows 0.01 tolerance for floating-point arithmetic
```

#### Summary Comparison
```typescript
assertSummaryEqual(actual, expected, context)
// Compares multiple financial summary fields
```

#### Financial Invariants
```typescript
assertFinancialInvariant(summary, 'profit-calculation')
assertFinancialInvariant(summary, 'total-revenue-cash-card')
assertFinancialInvariant(summary, 'credits-separate')
assertFinancialInvariant(summary, 'transfers-excluded')
assertFinancialInvariant(summary, 'savings-excluded')
```

#### Cross-Page Consistency
```typescript
assertCrossPageConsistency(
  dashboardSummary,
  reportsSummary,
  profitSummary,
  analysisSummary,
  comparisonSummary
)
```

#### Profit Leakage Detection
```typescript
assertNoProfitLeakage(summary)
// Ensures transfers and savings don't leak into profit
```

### 🔍 What Gets Tested

**Metrics Tested:**
- Total Revenue (income only)
- Total Expenses (expenses only, excluding credits)
- Profit (revenue - expenses)
- Credits (pending payment expenses)
- Cash Revenue / Card Revenue (method classification)
- Average Ticket (revenue / transaction count)
- Transfer In / Transfer Out (excluded from profit)
- Z-Totals (cash register income)
- Cash Totals / Bank Totals (method classification)
- Savings Deposits / Withdrawals (excluded from profit)
- Total Balance (profit + transfers - savings)
- Transaction Count (for revenue only, excluding transfers/savings)

**Edge Cases:**
- Empty periods (zero transactions)
- Single transactions
- Mixed payment methods
- Multiple transaction types
- DST boundaries
- Leap year February
- Year boundaries
- Large decimal values
- Negative balances
- Zero-division scenarios

### ✅ Coverage Goals

The test suite targets 100% coverage of:
- `src/lib/canonicalFinancialMetrics.ts` - Core aggregator and classifiers
- `src/lib/financialPeriods.ts` - Date math and period generation
- `src/hooks/useCanonicalFinancialPeriod.ts` - Client-side fetching
- `src/lib/server/analysisComparison.ts` - Server-side comparison logic

### 🛡️ Preventing Metric Drift

The test suite prevents drift by:

1. **Single Source of Truth**: All pages use `aggregateCanonicalFinancialMetrics()`
2. **Fixture-Based**: Same fixtures always produce same results (deterministic)
3. **Cross-Page Validation**: Tests verify all pages produce identical metrics
4. **Invariant Checking**: Detects logical errors (transfers in profit, double-counting, etc.)
5. **Regression Detection**: Catches changes that affect financial calculations
6. **DST Safety**: Date calculations use UTC epoch math, not local timestamps

### 🔧 Integration with CI/CD

```yaml
# Example GitHub Actions step
- name: Run Financial Tests
  run: npm run test:financial -- --coverage
  
- name: Check Coverage
  run: npm test:coverage | grep -E "^PASS|^FAIL"
```

### 📝 Adding New Tests

To add a new scenario:

1. **Create fixture** in `financialScenarios.ts`:
   ```typescript
   export const SCENARIO_MY_TEST: TestScenario = {
     name: 'My Test',
     description: 'Test description',
     rows: [/* transaction rows */],
     expectedTotals: {
       totalRevenue: 100,
       // ... other fields
     }
   }
   ```

2. **Add to ALL_SCENARIOS** at end of file
3. **Create test** in appropriate test file
4. **Verify** using:
   ```bash
   npm test -- --testNamePattern="My Test"
   ```

### 🐛 Debugging Failing Tests

1. **Enable verbose output**:
   ```bash
   npm test -- --verbose
   ```

2. **Run single test**:
   ```bash
   npm test -- canonicalFinancialMetrics.test.ts --testNamePattern="specific test"
   ```

3. **Check fixture data**:
   - Verify dates are in YYYY-MM-DD format
   - Ensure amounts match expected totals
   - Validate transaction types are recognized

4. **Test the aggregator directly**:
   ```typescript
   const summary = aggregateCanonicalFinancialMetrics(rows);
   console.log(JSON.stringify(summary, null, 2));
   ```

### 📚 Related Files

- **Core Engine**: `src/lib/canonicalFinancialMetrics.ts`
- **Date Math**: `src/lib/financialPeriods.ts`
- **React Hook**: `src/hooks/useCanonicalFinancialPeriod.ts`
- **Server API**: `src/lib/server/analysisComparison.ts`
- **Pages Using Engine**: 
  - `src/app/page.tsx` (dashboard)
  - `src/app/analysis/page.tsx`
  - `src/app/economics/reports/page.tsx`
  - `src/app/economics/profit/page.tsx`
  - `src/app/economics/cashflow/page.tsx`

### 🎓 Test Philosophy

This test suite implements **deterministic financial testing**:
- Fixtures define exact input → output mappings
- All classifiers are pure functions (no side effects)
- Date math is UTC-based (timezone independent)
- Aggregation is mathematically composable
- Cross-page consistency is guaranteed by shared functions

The philosophy ensures that:
1. Tests are reproducible (same input = same output always)
2. Metric drift is detectable (tests fail when logic changes)
3. Financial correctness is verifiable (invariants catch errors)
4. New features don't introduce regressions (fixture coverage expands)
