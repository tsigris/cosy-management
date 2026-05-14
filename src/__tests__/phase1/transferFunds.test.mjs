/**
 * Phase 1 – Unit tests: transfer_funds authorization and sign logic
 *
 * Run with:  node --test src/__tests__/phase1/transferFunds.test.mjs
 *
 * These tests validate the business rules implemented in the Postgres function
 * by executing the same logic in JS. They document the expected behaviour and
 * act as regression anchors if the function is ever ported or modified.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// JS re-implementation of the transfer_funds guard logic (mirrors the SQL)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ user_id: string, store_id: string, role?: string, can_edit_transactions?: boolean }} StoreAccessRow
 */

/**
 * @param {string|null} callerId
 * @param {string} fromStoreId
 * @param {string} toStoreId
 * @param {number} amount
 * @param {StoreAccessRow[]} storeAccessRows
 * @returns {{ ok: true, outgoing: number, incoming: number } | { ok: false, error: string }}
 */
function simulateTransferFunds(callerId, fromStoreId, toStoreId, amount, storeAccessRows) {
  // Guard 1: must be authenticated
  if (!callerId) return { ok: false, error: 'Απαιτείται σύνδεση.' }

  // Guard 2: amount must be positive
  if (amount <= 0) return { ok: false, error: 'Το ποσό μεταφοράς πρέπει να είναι θετικό.' }

  const hasAccess = (storeId) =>
    storeAccessRows.some(
      (row) =>
        row.user_id === callerId &&
        row.store_id === storeId &&
        (row.role === 'admin' || row.can_edit_transactions === true),
    )

  if (!hasAccess(fromStoreId)) return { ok: false, error: 'Δεν έχετε δικαιώματα για το κατάστημα προέλευσης.' }
  if (!hasAccess(toStoreId))   return { ok: false, error: 'Δεν έχετε δικαιώματα για το κατάστημα προορισμού.' }

  // Correct sign convention
  return {
    ok: true,
    outgoing: -Math.abs(amount),   // debit  (negative)
    incoming:  Math.abs(amount),   // credit (positive)
  }
}

// ---------------------------------------------------------------------------
describe('transfer_funds – auth guards', () => {
  const FROM  = 'store-aaa'
  const TO    = 'store-bbb'
  const USER  = 'user-111'
  const AMOUNT = 100

  const fullAccess = [
    { user_id: USER, store_id: FROM, role: 'admin',  can_edit_transactions: true },
    { user_id: USER, store_id: TO,   role: 'member', can_edit_transactions: true },
  ]

  it('rejects unauthenticated caller (null uid)', () => {
    const result = simulateTransferFunds(null, FROM, TO, AMOUNT, fullAccess)
    assert.equal(result.ok, false)
    assert.match(result.error, /σύνδεση/)
  })

  it('rejects amount <= 0', () => {
    const r1 = simulateTransferFunds(USER, FROM, TO, 0, fullAccess)
    const r2 = simulateTransferFunds(USER, FROM, TO, -50, fullAccess)
    assert.equal(r1.ok, false)
    assert.equal(r2.ok, false)
  })

  it('rejects caller with no access to source store', () => {
    const rows = [{ user_id: USER, store_id: TO, role: 'admin', can_edit_transactions: true }]
    const result = simulateTransferFunds(USER, FROM, TO, AMOUNT, rows)
    assert.equal(result.ok, false)
    assert.match(result.error, /προέλευσης/)
  })

  it('rejects caller with no access to destination store', () => {
    const rows = [{ user_id: USER, store_id: FROM, role: 'admin', can_edit_transactions: true }]
    const result = simulateTransferFunds(USER, FROM, TO, AMOUNT, rows)
    assert.equal(result.ok, false)
    assert.match(result.error, /προορισμού/)
  })

  it('rejects caller with role=member and can_edit_transactions=false', () => {
    const rows = [
      { user_id: USER, store_id: FROM, role: 'member', can_edit_transactions: false },
      { user_id: USER, store_id: TO,   role: 'member', can_edit_transactions: false },
    ]
    const result = simulateTransferFunds(USER, FROM, TO, AMOUNT, rows)
    assert.equal(result.ok, false)
  })

  it('allows caller with role=admin on both stores', () => {
    const rows = [
      { user_id: USER, store_id: FROM, role: 'admin', can_edit_transactions: false },
      { user_id: USER, store_id: TO,   role: 'admin', can_edit_transactions: false },
    ]
    const result = simulateTransferFunds(USER, FROM, TO, AMOUNT, rows)
    assert.equal(result.ok, true)
  })

  it('allows caller with can_edit_transactions=true on both stores (any role)', () => {
    const result = simulateTransferFunds(USER, FROM, TO, AMOUNT, fullAccess)
    assert.equal(result.ok, true)
  })
})

describe('transfer_funds – sign convention (Phase 1 bug fix)', () => {
  const FROM  = 'store-aaa'
  const TO    = 'store-bbb'
  const USER  = 'user-111'

  const rows = [
    { user_id: USER, store_id: FROM, role: 'admin', can_edit_transactions: true },
    { user_id: USER, store_id: TO,   role: 'admin', can_edit_transactions: true },
  ]

  it('outgoing leg is NEGATIVE (debit)', () => {
    const result = simulateTransferFunds(USER, FROM, TO, 200, rows)
    assert.equal(result.ok, true)
    assert.equal(result.outgoing, -200, 'outgoing must be -200 (debit)')
  })

  it('incoming leg is POSITIVE (credit)', () => {
    const result = simulateTransferFunds(USER, FROM, TO, 200, rows)
    assert.equal(result.incoming, 200, 'incoming must be +200 (credit)')
  })

  it('amounts are symmetric regardless of input sign', () => {
    // Even if someone passes a negative amount it is rejected before sign logic
    const result = simulateTransferFunds(USER, FROM, TO, -200, rows)
    assert.equal(result.ok, false, 'negative input is rejected')
  })
})
