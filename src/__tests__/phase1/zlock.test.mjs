/**
 * Phase 1 – Unit tests: Z-lock condition in add-expense
 *
 * Run with:  node --test src/__tests__/phase1/zlock.test.mjs
 *
 * The bug: `if (!isExpense && isDateLockedByZ)` was always false because
 * isExpense is always true (txType is always 'expense' | 'debt_payment').
 *
 * The fix: `if (isDateLockedByZ)` — remove the !isExpense guard entirely.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Mirrors the exact logic in add-expense/page.tsx handleSubmit
// ---------------------------------------------------------------------------

/** @param {'expense'|'debt_payment'} txType */
function buildLockState(txType, expenseDate, lastZ) {
  const isExpense = txType === 'expense' || txType === 'debt_payment'
  const isDateLockedByZ = !!(lastZ && expenseDate <= lastZ)
  return { isExpense, isDateLockedByZ }
}

/** OLD (buggy) guard */
function oldGuard(isExpense, isDateLockedByZ) {
  return !isExpense && isDateLockedByZ
}

/** NEW (fixed) guard */
function newGuard(_isExpense, isDateLockedByZ) {
  return isDateLockedByZ
}

// ---------------------------------------------------------------------------
describe('Z-lock guard', () => {
  const LOCKED_DATE = '2026-05-01'
  const LAST_Z      = '2026-05-02'   // any date >= expense date → locked
  const FUTURE_DATE = '2026-05-10'

  it('OLD guard: never blocks expense entries (the bug)', () => {
    // With txType='expense', isExpense is always true → !isExpense is false → guard never fires
    const { isExpense, isDateLockedByZ } = buildLockState('expense', LOCKED_DATE, LAST_Z)
    assert.equal(isExpense, true)
    assert.equal(isDateLockedByZ, true)
    assert.equal(oldGuard(isExpense, isDateLockedByZ), false, 'OLD guard silently passes — BUG confirmed')
  })

  it('OLD guard: never blocks debt_payment entries (the bug)', () => {
    const { isExpense, isDateLockedByZ } = buildLockState('debt_payment', LOCKED_DATE, LAST_Z)
    assert.equal(isExpense, true)
    assert.equal(oldGuard(isExpense, isDateLockedByZ), false, 'OLD guard silently passes — BUG confirmed')
  })

  it('NEW guard: blocks expense on a locked date', () => {
    const { isExpense, isDateLockedByZ } = buildLockState('expense', LOCKED_DATE, LAST_Z)
    assert.equal(newGuard(isExpense, isDateLockedByZ), true, 'NEW guard blocks as expected')
  })

  it('NEW guard: blocks debt_payment on a locked date', () => {
    const { isExpense, isDateLockedByZ } = buildLockState('debt_payment', LOCKED_DATE, LAST_Z)
    assert.equal(newGuard(isExpense, isDateLockedByZ), true, 'NEW guard blocks as expected')
  })

  it('NEW guard: allows expense on an unlocked (future) date', () => {
    const { isExpense, isDateLockedByZ } = buildLockState('expense', FUTURE_DATE, LAST_Z)
    assert.equal(isDateLockedByZ, false)
    assert.equal(newGuard(isExpense, isDateLockedByZ), false, 'NEW guard passes future date')
  })

  it('NEW guard: allows when lastZ is null (no Z closed)', () => {
    const { isExpense, isDateLockedByZ } = buildLockState('expense', LOCKED_DATE, null)
    assert.equal(isDateLockedByZ, false)
    assert.equal(newGuard(isExpense, isDateLockedByZ), false, 'NEW guard passes when no Z exists')
  })
})
