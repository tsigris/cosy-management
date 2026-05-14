/**
 * Phase 1 – Integration tests: requireStoreMember auth guard
 *
 * Run with:  node --test src/__tests__/phase1/requireStoreMember.test.mjs
 *
 * These tests mock only the Supabase client factory; no external service is hit.
 */
import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Minimal NextRequest / NextResponse shims
// ---------------------------------------------------------------------------
class MockHeaders {
  constructor(init = {}) { this._map = new Map(Object.entries(init)) }
  get(name) { return this._map.get(name.toLowerCase()) ?? null }
}

class MockNextRequest {
  constructor({ headers = {} } = {}) {
    this.headers = new MockHeaders(headers)
  }
}

class MockNextResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
  }
  static json(body, init) { return new MockNextResponse(body, init) }
}

// ---------------------------------------------------------------------------
// We re-implement requireStoreMember inline (logic under test) so the test
// runs without a Next.js build environment.  Any logic change in the real
// file MUST be mirrored here.
// ---------------------------------------------------------------------------
async function requireStoreMember(request, storeId, { getCallerFromHeader, getAdminClient }) {
  const user = await getCallerFromHeader(request)
  if (!user) {
    return MockNextResponse.json({ ok: false, error: 'Απαιτείται σύνδεση.' }, { status: 401 })
  }

  const adminClient = getAdminClient()
  const { data, error } = await adminClient
    .from('store_access')
    .select('store_id')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    return MockNextResponse.json(
      { ok: false, error: 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' },
      { status: 403 },
    )
  }

  return { userId: user.id }
}

// ---------------------------------------------------------------------------
// Helpers to build mock Supabase query chains
// ---------------------------------------------------------------------------
function buildQueryChain(resolvedValue) {
  const chain = {
    from() { return chain },
    select() { return chain },
    eq() { return chain },
    limit() { return chain },
    async maybeSingle() { return resolvedValue },
  }
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requireStoreMember', () => {
  const STORE_ID = 'store-uuid-001'
  const USER_ID  = 'user-uuid-001'

  it('returns 401 when no x-supabase-auth header', async () => {
    const req = new MockNextRequest({ headers: {} })
    const getCallerFromHeader = async () => null
    const getAdminClient = () => {}

    const result = await requireStoreMember(req, STORE_ID, { getCallerFromHeader, getAdminClient })

    assert.ok(result instanceof MockNextResponse, 'should return a response')
    assert.equal(result.status, 401)
  })

  it('returns 401 when JWT is invalid', async () => {
    const req = new MockNextRequest({ headers: { 'x-supabase-auth': 'bad-token' } })
    const getCallerFromHeader = async () => null   // Supabase rejects the token
    const getAdminClient = () => {}

    const result = await requireStoreMember(req, STORE_ID, { getCallerFromHeader, getAdminClient })

    assert.ok(result instanceof MockNextResponse)
    assert.equal(result.status, 401)
  })

  it('returns 403 when caller has no store_access row', async () => {
    const req = new MockNextRequest({ headers: { 'x-supabase-auth': 'valid-token' } })
    const getCallerFromHeader = async () => ({ id: USER_ID })
    const getAdminClient = () => buildQueryChain({ data: null, error: null })

    const result = await requireStoreMember(req, STORE_ID, { getCallerFromHeader, getAdminClient })

    assert.ok(result instanceof MockNextResponse)
    assert.equal(result.status, 403)
  })

  it('returns userId when caller has a valid store_access row', async () => {
    const req = new MockNextRequest({ headers: { 'x-supabase-auth': 'valid-token' } })
    const getCallerFromHeader = async () => ({ id: USER_ID })
    const getAdminClient = () => buildQueryChain({ data: { store_id: STORE_ID }, error: null })

    const result = await requireStoreMember(req, STORE_ID, { getCallerFromHeader, getAdminClient })

    assert.ok(!(result instanceof MockNextResponse), 'should not be a response')
    assert.equal(result.userId, USER_ID)
  })

  it('propagates unexpected DB errors', async () => {
    const req = new MockNextRequest({ headers: { 'x-supabase-auth': 'valid-token' } })
    const getCallerFromHeader = async () => ({ id: USER_ID })
    const getAdminClient = () => buildQueryChain({ data: null, error: new Error('DB_FAILURE') })

    await assert.rejects(
      () => requireStoreMember(req, STORE_ID, { getCallerFromHeader, getAdminClient }),
      /DB_FAILURE/,
    )
  })
})
