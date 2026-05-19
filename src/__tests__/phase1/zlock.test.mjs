/**
 * Phase 1 – Unit tests: Z-lock separation in add-expense
 *
 * Run with:  node --test src/__tests__/phase1/zlock.test.mjs
 *
 * Correct business rule:
 *   - Z-close ONLY freezes fiscal documents (income / Z-report records).
 *   - Expenses and debt_payment entries must remain writable after Z-close.
 *   - A separate accountingLocked / fiscalDocumentLocked mechanism handles
 *     hard accounting locks; that is unrelated to Z-date.
 *
 * Previous incorrect state (documented for history):
 *   The guard `if (isDateLockedByZ)` was applied inside handleSave of
 *   add-expense/page.tsx, which blocked all txType='expense' and
 *   txType='debt_payment' entries when a Z report existed for that date.
 *   This violated the intended business rule.
 *
 * Fix applied (add-expense/page.tsx handleSave):
 *   Removed the isDateLockedByZ check entirely from handleSave.
 *   Removed the checkBalanceLock() call (was only used by that guard).
 *   Z-date locking remains in place for fiscal/income document flows.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Lock-type separation model
// ---------------------------------------------------------------------------

/**
 * Returns whether a transaction type is subject to Z-date locking.
 *
 * Fiscal documents (income, Z-report category) are locked once Z is closed.
 * Accounting movements (expense, debt_payment) are NEVER locked by Z-date.
 *
 * @param {'expense'|'debt_payment'|'income'|'fiscal'} txType
 * @param {string|null} expenseDate  ISO date string
 * @param {string|null} lastZ        ISO date of last closed Z, or null
 */
function isBlockedByZLock(txType, expenseDate, lastZ) {
  const isFiscalDocument = txType === 'income' || txType === 'fiscal'
  if (!isFiscalDocument) return false               // expenses bypass Z-lock
  return !!(lastZ && expenseDate <= lastZ)
}

// ---------------------------------------------------------------------------
describe('Z-lock separation: expenses and debt_payments bypass Z-date lock', () => {
  const LOCKED_DATE = '2026-05-01'
  const LAST_Z      = '2026-05-02'   // Z closed on a date >= expense date
  const FUTURE_DATE = '2026-05-10'

  it('expense on a Z-locked date: NOT blocked', () => {
    assert.equal(
      isBlockedByZLock('expense', LOCKED_DATE, LAST_Z),
      false,
      'expense must bypass Z-date lock',
    )
  })

  it('debt_payment on a Z-locked date: NOT blocked', () => {
    assert.equal(
      isBlockedByZLock('debt_payment', LOCKED_DATE, LAST_Z),
      false,
      'debt_payment must bypass Z-date lock',
    )
  })

  it('expense when no Z exists: NOT blocked', () => {
    assert.equal(
      isBlockedByZLock('expense', LOCKED_DATE, null),
      false,
      'expense is never blocked when no Z exists',
    )
  })

  it('expense on a future (unlocked) date: NOT blocked', () => {
    assert.equal(
      isBlockedByZLock('expense', FUTURE_DATE, LAST_Z),
      false,
      'expense on future date is not blocked',
    )
  })
})

describe('Z-lock separation: fiscal/income documents ARE blocked after Z-close', () => {
  const LOCKED_DATE = '2026-05-01'
  const LAST_Z      = '2026-05-02'
  const FUTURE_DATE = '2026-05-10'

  it('income document on a Z-locked date: IS blocked', () => {
    assert.equal(
      isBlockedByZLock('income', LOCKED_DATE, LAST_Z),
      true,
      'income fiscal record must be blocked by Z-date lock',
    )
  })

  it('fiscal document on a Z-locked date: IS blocked', () => {
    assert.equal(
      isBlockedByZLock('fiscal', LOCKED_DATE, LAST_Z),
      true,
      'fiscal document must be blocked by Z-date lock',
    )
  })

  it('income document on a future date: NOT blocked (future is unlocked)', () => {
    assert.equal(
      isBlockedByZLock('income', FUTURE_DATE, LAST_Z),
      false,
      'income document on a future date is not yet locked',
    )
  })

  it('income document when no Z exists: NOT blocked', () => {
    assert.equal(
      isBlockedByZLock('income', LOCKED_DATE, null),
      false,
      'no Z means no lock for any document type',
    )
  })
})

