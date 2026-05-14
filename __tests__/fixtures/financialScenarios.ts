/**
 * Financial test fixtures and scenario builders
 * Used across all financial engine tests to ensure consistency
 */

import type { CanonicalFinancialRow } from '@/lib/canonicalFinancialMetrics'

export type TestScenario = {
  name: string
  description: string
  rows: CanonicalFinancialRow[]
  expectedTotals: {
    totalRevenue: number
    totalExpenses: number
    profit: number
    credits: number
    transactionCount: number
    cashRevenue: number
    cardRevenue: number
    averageTicket: number
    transferIn: number
    transferOut: number
    zTotals: number
    cashTotals: number
    bankTotals: number
    savingsDeposits: number
    savingsWithdrawals: number
  }
}

// ============================================================
// SIMPLE FIXTURES
// ============================================================

export const SCENARIO_EMPTY_PERIOD: TestScenario = {
  name: 'Empty Period',
  description: 'No transactions in the period',
  rows: [],
  expectedTotals: {
    totalRevenue: 0,
    totalExpenses: 0,
    profit: 0,
    credits: 0,
    transactionCount: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    averageTicket: 0,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 0,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

export const SCENARIO_SINGLE_INCOME_CASH: TestScenario = {
  name: 'Single Cash Income',
  description: 'One cash income transaction',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 100,
    totalExpenses: 0,
    profit: 100,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 100,
    cardRevenue: 0,
    averageTicket: 100,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 100,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

export const SCENARIO_INCOME_EXPENSE_BASIC: TestScenario = {
  name: 'Basic Income and Expense',
  description: 'One income and one expense, cash only',
  rows: [
    {
      date: '2026-05-14',
      amount: 200,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -50,
      type: 'expense',
      category: 'Supplies',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 200,
    totalExpenses: 50,
    profit: 150,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 200,
    cardRevenue: 0,
    averageTicket: 200,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 150,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// PAYMENT METHOD CLASSIFICATION
// ============================================================

export const SCENARIO_CASH_CARD_MIX: TestScenario = {
  name: 'Cash and Card Mix',
  description: 'Multiple transactions across payment methods',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 200,
      type: 'income',
      category: 'Sales',
      method: 'Card',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 150,
      type: 'income',
      category: 'Sales',
      method: 'Bank Transfer',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -30,
      type: 'expense',
      category: 'Supplies',
      method: 'Μετρητά',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -40,
      type: 'expense',
      category: 'Supplies',
      method: 'Κάρτα',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 450,
    totalExpenses: 70,
    profit: 380,
    credits: 0,
    transactionCount: 3,
    cashRevenue: 100,
    cardRevenue: 350,
    averageTicket: 150,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 70,
    bankTotals: 310,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// CREDIT TRANSACTIONS
// ============================================================

export const SCENARIO_CREDIT_EXPENSES: TestScenario = {
  name: 'Credit Expenses',
  description: 'Expenses marked as credit (pending payment)',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -50,
      type: 'expense',
      category: 'Supplies',
      method: 'Unknown',
      is_credit: true,
    },
  ],
  expectedTotals: {
    totalRevenue: 100,
    totalExpenses: 0,
    profit: 100,
    credits: 50,
    transactionCount: 1,
    cashRevenue: 100,
    cardRevenue: 0,
    averageTicket: 100,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 100,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// TRANSFER MOVEMENTS
// ============================================================

export const SCENARIO_TRANSFERS: TestScenario = {
  name: 'Internal Transfers',
  description: 'Transfers between accounts (excluded from revenue/expense)',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 50,
      type: 'transfer',
      category: 'Μεταφορά Κεφαλαίου',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -30,
      type: 'transfer',
      category: 'Μεταφορά',
      method: 'Card',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 100,
    totalExpenses: 0,
    profit: 100,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 100,
    cardRevenue: 0,
    averageTicket: 100,
    transferIn: 50,
    transferOut: 30,
    zTotals: 0,
    cashTotals: 100,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// SAVINGS TRANSACTIONS
// ============================================================

export const SCENARIO_SAVINGS_DEPOSITS_WITHDRAWALS: TestScenario = {
  name: 'Savings Deposits and Withdrawals',
  description: 'Savings movements (excluded from revenue/expense/profit)',
  rows: [
    {
      date: '2026-05-14',
      amount: 200,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -50,
      type: 'savings_deposit',
      category: 'Savings',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 30,
      type: 'savings_withdrawal',
      category: 'Savings',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 200,
    totalExpenses: 0,
    profit: 200,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 200,
    cardRevenue: 0,
    averageTicket: 200,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 180,
    bankTotals: 0,
    savingsDeposits: 50,
    savingsWithdrawals: 30,
  },
}

// ============================================================
// DEBT PAYMENTS AND COLLECTIONS
// ============================================================

export const SCENARIO_DEBT_PAYMENTS: TestScenario = {
  name: 'Debt Payments',
  description: 'Debt payments (expense type, excluded from revenue)',
  rows: [
    {
      date: '2026-05-14',
      amount: 200,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -50,
      type: 'debt_payment',
      category: 'Debt',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 200,
    totalExpenses: 50,
    profit: 150,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 200,
    cardRevenue: 0,
    averageTicket: 200,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 150,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

export const SCENARIO_DEBT_COLLECTIONS: TestScenario = {
  name: 'Debt Collections',
  description: 'Debt collections (income_collection excluded from revenue/profit)',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 50,
      type: 'income_collection',
      category: 'Collections',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 100,
    totalExpenses: 0,
    profit: 100,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 100,
    cardRevenue: 0,
    averageTicket: 100,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 150,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// Z-INCOME (CASH REGISTER) TRANSACTIONS
// ============================================================

export const SCENARIO_Z_INCOME: TestScenario = {
  name: 'Z-Income Transactions',
  description: 'Z-income from cash register',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'income',
      category: 'Εσοδα Ζ',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: 50,
      type: 'income',
      category: 'Other Sales',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 150,
    totalExpenses: 0,
    profit: 150,
    credits: 0,
    transactionCount: 2,
    cashRevenue: 150,
    cardRevenue: 0,
    averageTicket: 75,
    transferIn: 0,
    transferOut: 0,
    zTotals: 100,
    cashTotals: 150,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// PAYROLL TRANSACTIONS
// ============================================================

export const SCENARIO_PAYROLL: TestScenario = {
  name: 'Payroll Transactions',
  description: 'Salary advance and payroll expenses',
  rows: [
    {
      date: '2026-05-14',
      amount: 500,
      type: 'income',
      category: 'Sales',
      method: 'Card',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -200,
      type: 'salary_advance',
      category: 'Payroll',
      method: 'Bank Transfer',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 500,
    totalExpenses: 200,
    profit: 300,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 0,
    cardRevenue: 500,
    averageTicket: 500,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 0,
    bankTotals: 300,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// COMPLEX SCENARIOS
// ============================================================

export const SCENARIO_COMPLEX_MONTH: TestScenario = {
  name: 'Complex Month',
  description: 'Multiple transaction types in a realistic month',
  rows: [
    // Week 1: Good sales week
    {
      date: '2026-05-01',
      amount: 150,
      type: 'income',
      category: 'Sales',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-01',
      amount: 200,
      type: 'income',
      category: 'Εσοδα Ζ',
      method: 'Μετρητά',
      is_credit: false,
    },
    {
      date: '2026-05-01',
      amount: 300,
      type: 'income',
      category: 'Sales',
      method: 'Card',
      is_credit: false,
    },
    {
      date: '2026-05-01',
      amount: -80,
      type: 'expense',
      category: 'Supplies',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-01',
      amount: -50,
      type: 'expense',
      category: 'Supplies',
      method: 'Card',
      is_credit: false,
    },
    // Mid-month: payroll
    {
      date: '2026-05-15',
      amount: -200,
      type: 'salary_advance',
      category: 'Payroll',
      method: 'Bank Transfer',
      is_credit: false,
    },
    // Week 3: Vendor payment
    {
      date: '2026-05-17',
      amount: -120,
      type: 'expense',
      category: 'Vendors',
      method: 'Bank Transfer',
      is_credit: false,
    },
    // Week 4: Credit purchase
    {
      date: '2026-05-25',
      amount: -100,
      type: 'expense',
      category: 'Equipment',
      method: 'Card',
      is_credit: true,
    },
    // End of month: savings
    {
      date: '2026-05-28',
      amount: -150,
      type: 'savings_deposit',
      category: 'Savings',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-28',
      amount: 50,
      type: 'savings_withdrawal',
      category: 'Savings',
      method: 'Card',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 650,
    totalExpenses: 450,
    profit: 200,
    credits: 100,
    transactionCount: 3,
    cashRevenue: 350,
    cardRevenue: 300,
    averageTicket: 216.67,
    transferIn: 0,
    transferOut: 0,
    zTotals: 200,
    cashTotals: 120,
    bankTotals: -20,
    savingsDeposits: 150,
    savingsWithdrawals: 50,
  },
}

// ============================================================
// EDGE CASES
// ============================================================

export const SCENARIO_ONLY_TRANSFERS: TestScenario = {
  name: 'Only Transfers',
  description: 'No organic revenue or expense, only transfers',
  rows: [
    {
      date: '2026-05-14',
      amount: 100,
      type: 'transfer',
      category: 'Μεταφορά Κεφαλαίου',
      method: 'Cash',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -50,
      type: 'transfer',
      category: 'Μεταφορά',
      method: 'Cash',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 0,
    totalExpenses: 0,
    profit: 0,
    credits: 0,
    transactionCount: 0,
    cashRevenue: 0,
    cardRevenue: 0,
    averageTicket: 0,
    transferIn: 100,
    transferOut: 50,
    zTotals: 0,
    cashTotals: 0,
    bankTotals: 0,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

export const SCENARIO_LARGE_TRANSACTIONS: TestScenario = {
  name: 'Large Transactions',
  description: 'Large amounts to test decimal precision',
  rows: [
    {
      date: '2026-05-14',
      amount: 12345.67,
      type: 'income',
      category: 'Sales',
      method: 'Card',
      is_credit: false,
    },
    {
      date: '2026-05-14',
      amount: -9876.54,
      type: 'expense',
      category: 'Supplies',
      method: 'Card',
      is_credit: false,
    },
  ],
  expectedTotals: {
    totalRevenue: 12345.67,
    totalExpenses: 9876.54,
    profit: 2469.13,
    credits: 0,
    transactionCount: 1,
    cashRevenue: 0,
    cardRevenue: 12345.67,
    averageTicket: 12345.67,
    transferIn: 0,
    transferOut: 0,
    zTotals: 0,
    cashTotals: 0,
    bankTotals: 2469.13,
    savingsDeposits: 0,
    savingsWithdrawals: 0,
  },
}

// ============================================================
// COLLECTION OF ALL SCENARIOS
// ============================================================

export const ALL_SCENARIOS = [
  SCENARIO_EMPTY_PERIOD,
  SCENARIO_SINGLE_INCOME_CASH,
  SCENARIO_INCOME_EXPENSE_BASIC,
  SCENARIO_CASH_CARD_MIX,
  SCENARIO_CREDIT_EXPENSES,
  SCENARIO_TRANSFERS,
  SCENARIO_SAVINGS_DEPOSITS_WITHDRAWALS,
  SCENARIO_DEBT_PAYMENTS,
  SCENARIO_DEBT_COLLECTIONS,
  SCENARIO_Z_INCOME,
  SCENARIO_PAYROLL,
  SCENARIO_COMPLEX_MONTH,
  SCENARIO_ONLY_TRANSFERS,
  SCENARIO_LARGE_TRANSACTIONS,
]
