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

    stage = 'bootstrap:client-init'
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

    // ================================================================
    // BOOTSTRAP STEP 1: Load auth user
    // ================================================================
    stage = 'bootstrap:auth-user'
    let user: any = null
    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await callerClient.auth.getUser()

      console.info('[api/analysis/comparison] [STEP 1 AFTER] bootstrap:auth-user', {
        stepName: 'bootstrap:auth-user',
        inputParams: { tokenTrimmed: token.substring(0, 20) + '...' },
        returnedUser: {
          userId: authUser?.id ?? null,
          userEmail: authUser?.email ?? null,
        },
        returnedError: userError ? serializeError(userError) : null,
        hasError: Boolean(userError),
        success: !userError && Boolean(authUser),
      })

      if (userError) {
        throw userError
      }

      if (!authUser) {
        throw new Error('No user returned from auth.getUser() despite no error')
      }

      user = authUser
    } catch (authStepError) {
      console.error('[api/analysis/comparison] [STEP 1 EXCEPTION] bootstrap:auth-user', {
        stepName: 'bootstrap:auth-user',
        exceptionType: typeof authStepError,
        exceptionMessage: (authStepError as any)?.message ?? String(authStepError),
        serializedError: serializeError(authStepError),
      })
      throw authStepError
    }

    // ================================================================
    // BOOTSTRAP STEP 2: Check store_access membership
    // ================================================================
    stage = 'bootstrap:store-access'
    let membershipRow: any = null
    try {
      const membershipResult = await callerClient
        .from('store_access')
        .select('store_id, user_id')
        .eq('user_id', user.id)
        .eq('store_id', storeId)
        .limit(1)
        .maybeSingle()

      console.info('[api/analysis/comparison] [STEP 2 AFTER] bootstrap:store-access', {
        stepName: 'bootstrap:store-access',
        inputParams: { userId: user.id, storeId },
        returnedRows: membershipResult.data ? 1 : 0,
        success: !membershipResult.error && Boolean(membershipResult.data),
      })

      if (membershipResult.error) {
        throw membershipResult.error
      }

      if (!membershipResult.data) {
        console.error('[api/analysis/comparison] [STEP 2 FAILED] bootstrap:store-access - no-row', {
          stepName: 'bootstrap:store-access',
          inputParams: { userId: user.id, storeId },
          errorMessage: 'User has no store_access membership for this storeId',
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

      membershipRow = membershipResult.data
    } catch (storeAccessStepError) {
      console.error('[api/analysis/comparison] [STEP 2 EXCEPTION] bootstrap:store-access', {
        stepName: 'bootstrap:store-access',
        exceptionMessage: (storeAccessStepError as any)?.message ?? String(storeAccessStepError),
        serializedError: serializeError(storeAccessStepError),
      })
      throw storeAccessStepError
    }

    // ================================================================
    // BOOTSTRAP STEP 3: Load store details (WITH CANONICAL org_id)
    // ================================================================
    stage = 'bootstrap:store-load'
    let storeRow: any = null
    try {
      const storeLookupResult = await callerClient
        .from('stores')
        .select('id, organization_id, owner_id')
        .eq('id', storeId)
        .limit(1)
        .maybeSingle()

      console.info('[api/analysis/comparison] [STEP 3 AFTER] bootstrap:store-load', {
        stepName: 'bootstrap:store-load',
        inputParams: { storeId },
        returnedObject: storeLookupResult.data ? {
          id: storeLookupResult.data.id,
          organization_id: storeLookupResult.data.organization_id,
          owner_id: storeLookupResult.data.owner_id,
        } : null,
        success: !storeLookupResult.error && Boolean(storeLookupResult.data),
      })

      if (storeLookupResult.error) {
        throw storeLookupResult.error
      }

      if (!storeLookupResult.data) {
        throw new Error(`No store found with id: ${storeId}`)
      }

      storeRow = storeLookupResult.data
    } catch (storeLoadStepError) {
      console.error('[api/analysis/comparison] [STEP 3 EXCEPTION] bootstrap:store-load', {
        stepName: 'bootstrap:store-load',
        inputParams: { storeId },
        exceptionCode: (storeLoadStepError as any)?.code ?? null,
        exceptionMessage: (storeLoadStepError as any)?.message ?? String(storeLoadStepError),
        serializedError: serializeError(storeLoadStepError),
      })
      throw storeLoadStepError
    }

    // ================================================================
    // BOOTSTRAP STEP 4: Extract organization_id (CANONICAL PRIMARY SOURCE)
    //
    // Canonical hierarchy:
    //  1. stores.organization_id (PRIMARY - MUST USE THIS)
    //  2. auth user metadata.organization_id (FALLBACK ONLY - WITH WARNING)
    // ================================================================
    stage = 'bootstrap:organization-id-extraction'
    let selectedOrganizationId: string | null = null
    let userOrgFromMeta: string | null = null
    try {
      // PRIMARY SOURCE: stores.organization_id (canonical ownership)
      const storeOrgId = storeRow?.organization_id ?? null
      selectedOrganizationId =
        typeof storeOrgId === 'string' ? (storeOrgId.trim() || null) : null

      // FALLBACK SOURCE: user metadata organization_id
      const userMetaOrgId =
        typeof (user.user_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.user_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

      const userAppMetaOrgId =
        typeof (user.app_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.app_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

      userOrgFromMeta = userMetaOrgId || userAppMetaOrgId

      // Use fallback ONLY if stores.organization_id is NULL (temporary bootstrap protection)
      if (!selectedOrganizationId && userOrgFromMeta) {
        selectedOrganizationId = userOrgFromMeta
        console.warn('[api/analysis/comparison] [STEP 4 WARNING] bootstrap:organization-id-extraction - using fallback', {
          stepName: 'bootstrap:organization-id-extraction',
          storeId,
          reason: 'stores.organization_id is NULL, using auth user metadata as temporary fallback',
          storeOrganizationId: storeOrgId,
          userOrganizationIdUsed: userOrgFromMeta,
          recommendation: 'ensure stores.organization_id is backfilled from canonical source (organizations table)',
        })
      }

      console.info('[api/analysis/comparison] [STEP 4 AFTER] bootstrap:organization-id-extraction', {
        stepName: 'bootstrap:organization-id-extraction',
        canonicalSource: 'stores.organization_id',
        storeOrganizationId: storeOrgId,
        userOrganizationId: userOrgFromMeta,
        selectedOrganizationId,
        usedFallback: !storeOrgId && Boolean(userOrgFromMeta),
        success: Boolean(selectedOrganizationId),
      })

      if (!selectedOrganizationId) {
        throw new Error(
          `No organization_id found: stores.organization_id is NULL and user has no organization_id in metadata`
        )
      }
    } catch (orgIdExtractionError) {
      console.error('[api/analysis/comparison] [STEP 4 EXCEPTION] bootstrap:organization-id-extraction', {
        stepName: 'bootstrap:organization-id-extraction',
        exceptionMessage: (orgIdExtractionError as any)?.message ?? String(orgIdExtractionError),
        serializedError: serializeError(orgIdExtractionError),
      })
      throw orgIdExtractionError
    }

    // ================================================================
    // BOOTSTRAP STEP 5: Validate organization membership
    // ================================================================
    stage = 'bootstrap:membership-validation'
    try {
      const storeOrgFromColumn = storeRow?.organization_id
        ? String(storeRow.organization_id).trim() || null
        : null

      // Only validate mismatch if both sources have values (both present)
      const mismatch =
        storeOrgFromColumn && userOrgFromMeta && storeOrgFromColumn !== userOrgFromMeta

      console.info('[api/analysis/comparison] [STEP 5 AFTER] bootstrap:membership-validation', {
        stepName: 'bootstrap:membership-validation',
        storeOrganizationIdCanonical: storeOrgFromColumn,
        userOrganizationId: userOrgFromMeta,
        idsMatch: !mismatch,
        success: !mismatch,
      })

      if (mismatch) {
        console.warn('[api/analysis/comparison] organization mismatch detected', {
          store_id: storeId,
          'store.organization_id': storeOrgFromColumn,
          'user.organization_id': userOrgFromMeta,
          user_id: user.id,
          stepName: 'bootstrap:membership-validation',
        })

        throw new Error(
          `Organization mismatch: store org_id=${storeOrgFromColumn} but user org_id=${userOrgFromMeta}`
        )
      }
    } catch (membershipValidationError) {
      console.error('[api/analysis/comparison] [STEP 5 EXCEPTION] bootstrap:membership-validation', {
        stepName: 'bootstrap:membership-validation',
        exceptionMessage: (membershipValidationError as any)?.message ?? String(membershipValidationError),
        serializedError: serializeError(membershipValidationError),
      })
      throw membershipValidationError
    }

    // ================================================================
    // BOOTSTRAP COMPLETE - All steps passed
    // ================================================================
    const mappedRanges = getYearOverYearRanges({ from: fromDate, to: toDate })
    requestContext = {
      ...requestContext,
      selectedOrganizationId,
      mappedComparisonFrom: mappedRanges.previous.from,
      mappedComparisonTo: mappedRanges.previous.to,
    }

    console.info('[api/analysis/comparison] [BOOTSTRAP COMPLETE] all-bootstrap-steps-passed', {
      userId: user.id,
      storeId,
      selectedOrganizationId,
      selectedPeriod: { from: fromDate, to: toDate },
      comparisonPeriod: mappedRanges.previous,
    })

    stage = 'service:build-financial-comparison'
    const payload = await buildFinancialComparison(callerClient, storeId, {
      from: fromDate,
      to: toDate,
    })
    partialComparisonPayload = payload

    // CRITICAL TRACE LOG: API Response Serialization
    console.info('[api/analysis/comparison] CANONICAL_PAYLOAD_TRACE - RESPONSE_SERIALIZATION', {
      tracePhase: 'api-response-ready',
      storeId,
      userId: user.id,
      requestPeriod: `${fromDate} to ${toDate}`,
      comparisonPeriod: `${payload.periods.previous.from} to ${payload.periods.previous.to}`,
      payload: {
        periods: payload.periods,
        summary: {
          totalRevenue: payload.summary.totalRevenue,
          expenses: payload.summary.expenses,
          profit: payload.summary.profit,
          cashRevenue: payload.summary.cashRevenue,
          cardRevenue: payload.summary.cardRevenue,
        },
        daily: {
          count: payload.daily.length,
          first: payload.daily[0] || null,
          last: payload.daily[payload.daily.length - 1] || null,
        },
      },
    })

    stage = 'response:serialize-success'

    const response = NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })

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
      serializedError: serializedError,
    })

    const mapped = mapErrorMessage(errorMessage, 'Αποτυχία φόρτωσης σύγκρισης.')
    return NextResponse.json(
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
  }
}
