import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { mapErrorMessage } from '@/app/api/admin/_shared/auth'
import { buildFinancialComparison } from '@/lib/server/analysisComparison'
import { getYearOverYearRanges } from '@/lib/financialPeriods'

export const runtime = 'nodejs'

type ComparisonRequestBody = {
  storeId?: string
  fromDate?: string
  toDate?: string
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[unserializable]'
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const withExtras = error as Error & {
      code?: unknown
      details?: unknown
      hint?: unknown
    }

    return {
      type: 'Error',
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
      code: withExtras.code ?? null,
      details: withExtras.details ?? null,
      hint: withExtras.hint ?? null,
      raw: safeStringify(error),
    }
  }

  const objectLike = (error && typeof error === 'object' ? error : null) as
    | {
        name?: unknown
        message?: unknown
        stack?: unknown
        code?: unknown
        details?: unknown
        hint?: unknown
      }
    | null

  return {
    type: typeof error,
    name: typeof objectLike?.name === 'string' ? objectLike.name : null,
    message: typeof objectLike?.message === 'string' ? objectLike.message : null,
    stack: typeof objectLike?.stack === 'string' ? objectLike.stack : null,
    code: objectLike?.code ?? null,
    details: objectLike?.details ?? null,
    hint: objectLike?.hint ?? null,
    raw: safeStringify(error),
  }
}

export async function POST(request: NextRequest) {
  let stage = 'request:parse'
  let requestContext: Record<string, unknown> = {}
  let partialComparisonPayload: unknown = null

  try {
    const body = (await request.json()) as ComparisonRequestBody
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const fromDate = typeof body?.fromDate === 'string' ? body.fromDate.trim() : ''
    const toDate = typeof body?.toDate === 'string' ? body.toDate.trim() : ''

    requestContext = {
      storeId,
      fromDate,
      toDate,
    }

    if (!storeId || !fromDate || !toDate) {
      console.error('[api/analysis/comparison] invalid-request-payload', requestContext)
      return NextResponse.json(
        {
          error: 'Comparison service error',
          failureReason: 'invalid_request_payload',
          details: 'Missing storeId, fromDate, or toDate.',
        },
        { status: 400 },
      )
    }

    stage = 'request:validated'

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[api/analysis/comparison] incoming-request-payload', requestContext)
    }

    const token = request.headers.get('x-supabase-auth')?.trim() || ''
    if (!token) {
      console.error('[api/analysis/comparison] missing-auth-token', requestContext)
      return NextResponse.json(
        {
          error: 'Comparison service error',
          failureReason: 'missing_auth_token',
          details: 'Απαιτείται σύνδεση.',
        },
        { status: 401 },
      )
    }

    stage = 'auth:client-init'
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      throw new Error('[analysis/comparison] Missing Supabase URL or anon key env vars')
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser()

    stage = 'auth:user-resolved'

    console.info('[api/analysis/comparison] auth-user-result', {
      ...requestContext,
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      userMetadata: user?.user_metadata ?? null,
      appMetadata: user?.app_metadata ?? null,
      userError: userError ? serializeError(userError) : null,
    })

    if (userError || !user) {
      console.error('[api/analysis/comparison] auth-user-failed', {
        ...requestContext,
        hasUser: Boolean(user),
        userError: userError ? serializeError(userError) : null,
      })
      return NextResponse.json(
        {
          error: 'Comparison service error',
          failureReason: 'auth_user_failed',
          details: 'Απαιτείται σύνδεση.',
        },
        { status: 401 },
      )
    }

    stage = 'auth:store-access-check'
    const membershipResult = await callerClient
      .from('store_access')
      .select('store_id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle()

    const { data: membershipRow, error: membershipError } = membershipResult

    console.info('[api/analysis/comparison] membership-lookup-result', {
      ...requestContext,
      userId: user.id,
      membershipRow,
      membershipError: membershipError ? serializeError(membershipError) : null,
      rawMembershipResult: {
        status: membershipResult.status,
        statusText: membershipResult.statusText,
        count: membershipResult.count,
        data: membershipResult.data,
        error: membershipResult.error ? serializeError(membershipResult.error) : null,
      },
    })

    if (membershipError) {
      console.error('[api/analysis/comparison] membership-lookup-error', {
        ...requestContext,
        userId: user.id,
        membershipError: serializeError(membershipError),
        rawMembershipResult: {
          status: membershipResult.status,
          statusText: membershipResult.statusText,
          count: membershipResult.count,
          data: membershipResult.data,
          error: membershipResult.error ? serializeError(membershipResult.error) : null,
        },
      })
      throw membershipError
    }

    if (!membershipRow) {
      console.error('[api/analysis/comparison] store-access-denied', {
        ...requestContext,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: 'Comparison service error',
          failureReason: 'store_access_denied',
          details: 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.',
        },
        { status: 403 },
      )
    }

    stage = 'request:store-organization-load'
    const storeLookupResult = await callerClient
      .from('stores')
      .select('id, organization_id')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle()

    const { data: storeRow, error: storeError } = storeLookupResult

    console.info('[api/analysis/comparison] store-organization-lookup-result', {
      ...requestContext,
      storeRow,
      storeError: storeError ? serializeError(storeError) : null,
      rawStoreLookupResult: {
        status: storeLookupResult.status,
        statusText: storeLookupResult.statusText,
        count: storeLookupResult.count,
        data: storeLookupResult.data,
        error: storeLookupResult.error ? serializeError(storeLookupResult.error) : null,
      },
    })

    if (storeError) {
      console.error('[api/analysis/comparison] store-organization-lookup-error', {
        ...requestContext,
        storeError: serializeError(storeError),
        rawStoreLookupResult: {
          status: storeLookupResult.status,
          statusText: storeLookupResult.statusText,
          count: storeLookupResult.count,
          data: storeLookupResult.data,
          error: storeLookupResult.error ? serializeError(storeLookupResult.error) : null,
        },
      })
      throw storeError
    }

    const selectedOrganizationId =
      typeof storeRow?.organization_id === 'string' ? storeRow.organization_id.trim() || null : null

    const userOrgFromMeta =
      typeof (user.user_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
        ? String((user.user_metadata as { organization_id?: unknown }).organization_id).trim() || null
        : typeof (user.app_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.app_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

    console.info('[api/analysis/comparison] organization-mapping-result', {
      ...requestContext,
      storeLookupResult: {
        id: storeRow?.id ?? null,
        organization_id: storeRow?.organization_id ?? null,
      },
      selectedOrganizationId,
      userOrganizationIdFromMetadata: userOrgFromMeta,
      hasStoreRow: Boolean(storeRow),
      hasStoreOrganizationId: Boolean(selectedOrganizationId),
    })

    const mappedRanges = getYearOverYearRanges({ from: fromDate, to: toDate })
    requestContext = {
      ...requestContext,
      selectedOrganizationId,
      userOrganizationId: userOrgFromMeta,
      mappedComparisonFrom: mappedRanges.previous.from,
      mappedComparisonTo: mappedRanges.previous.to,
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[api/analysis/comparison] request-context', {
        userId: user.id,
        selectedStoreId: storeId,
        selectedOrganizationId,
        userOrganizationId: userOrgFromMeta,
        selectedPeriod: { from: fromDate, to: toDate },
        comparisonPeriod: mappedRanges.previous,
        selectedComparisonDate: mappedRanges.current.from,
        mappedComparisonDate: mappedRanges.previous.from,
      })
    }

    stage = 'service:build-financial-comparison'
    const payload = await buildFinancialComparison(callerClient, storeId, {
      from: fromDate,
      to: toDate,
    })
    partialComparisonPayload = payload

    stage = 'response:serialize-success'

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[api/analysis/comparison] response-summary', {
        selectedStoreId: storeId,
        selectedOrganizationId,
        selectedPeriod: payload.periods.current,
        comparisonPeriod: payload.periods.previous,
        totalRevenue: payload.summary.totalRevenue,
        expenses: payload.summary.expenses,
        profit: payload.summary.profit,
        dailyRows: payload.daily.length,
        serializedPayload: JSON.stringify(payload),
      })
    }

    const response = NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[api/analysis/comparison] response-http-status', {
        status: response.status,
        stage,
      })
    }

    return response
  } catch (error) {
    stage = `failed:${stage}`
    const serializedError = serializeError(error)
    const errorMessage =
      typeof serializedError.message === 'string' && serializedError.message.length > 0
        ? serializedError.message
        : String(serializedError.raw)

    console.error('[api/analysis/comparison] FAILED:', {
      stage,
      requestContext,
      errorMessage,
      errorName: serializedError.name,
      errorCode: serializedError.code,
      errorDetails: serializedError.details,
      errorHint: serializedError.hint,
      errorStack: serializedError.stack,
      errorRawObject: serializedError.raw,
      partialComparisonPayload,
    })

    const mapped = mapErrorMessage(errorMessage, 'Αποτυχία φόρτωσης σύγκρισης.')
    const failureResponse = NextResponse.json(
      {
        error: 'Comparison service error',
        failureReason: 'comparison_service_error',
        stage,
        details: mapped.message,
        ...(process.env.NODE_ENV !== 'production' && {
          _debug: {
            request: requestContext,
            error: serializedError,
            partialComparisonPayload,
          },
        }),
      },
      { status: mapped.status },
    )

    console.error('[api/analysis/comparison] response-http-status', {
      status: failureResponse.status,
      stage,
      failureReason: 'comparison_service_error',
    })

    return failureResponse
  }
}
