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
          userMetadata: authUser?.user_metadata ?? null,
          appMetadata: authUser?.app_metadata ?? null,
        },
        returnedError: userError ? serializeError(userError) : null,
        hasError: Boolean(userError),
        success: !userError && Boolean(authUser),
      })

      if (userError) {
        console.error('[api/analysis/comparison] [STEP 1 FAILED] bootstrap:auth-user', {
          stepName: 'bootstrap:auth-user',
          inputParams: { tokenTrimmed: token.substring(0, 20) + '...' },
          errorCode: (userError as any)?.code ?? null,
          errorMessage: userError.message ?? null,
          errorDetails: (userError as any)?.details ?? null,
          errorHint: (userError as any)?.hint ?? null,
          serializedError: serializeError(userError),
        })
        throw userError
      }

      if (!authUser) {
        const noUserError = new Error('No user returned from auth.getUser() despite no error')
        console.error('[api/analysis/comparison] [STEP 1 FAILED] bootstrap:auth-user - no-user', {
          stepName: 'bootstrap:auth-user',
          errorMessage: noUserError.message,
          serializedError: serializeError(noUserError),
        })
        throw noUserError
      }

      user = authUser
    } catch (authStepError) {
      console.error('[api/analysis/comparison] [STEP 1 EXCEPTION] bootstrap:auth-user', {
        stepName: 'bootstrap:auth-user',
        exceptionType: typeof authStepError,
        exceptionName: (authStepError as any)?.name ?? null,
        exceptionCode: (authStepError as any)?.code ?? null,
        exceptionMessage: (authStepError as any)?.message ?? String(authStepError),
        exceptionDetails: (authStepError as any)?.details ?? null,
        exceptionHint: (authStepError as any)?.hint ?? null,
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
        returnedObject: membershipResult.data ?? null,
        returnedError: membershipResult.error ? serializeError(membershipResult.error) : null,
        rawQueryResult: {
          status: membershipResult.status ?? null,
          statusText: membershipResult.statusText ?? null,
          count: membershipResult.count ?? null,
        },
        hasError: Boolean(membershipResult.error),
        hasRows: Boolean(membershipResult.data),
        success: !membershipResult.error && Boolean(membershipResult.data),
      })

      if (membershipResult.error) {
        console.error('[api/analysis/comparison] [STEP 2 FAILED] bootstrap:store-access', {
          stepName: 'bootstrap:store-access',
          inputParams: { userId: user.id, storeId },
          errorCode: membershipResult.error.code ?? null,
          errorMessage: membershipResult.error.message ?? null,
          errorDetails: (membershipResult.error as any)?.details ?? null,
          errorHint: (membershipResult.error as any)?.hint ?? null,
          serializedError: serializeError(membershipResult.error),
        })
        throw membershipResult.error
      }

      if (!membershipResult.data) {
        console.error('[api/analysis/comparison] [STEP 2 FAILED] bootstrap:store-access - no-row', {
          stepName: 'bootstrap:store-access',
          inputParams: { userId: user.id, storeId },
          errorMessage: 'User has no store_access membership for this storeId (RLS or no matching row)',
          returnedRows: 0,
          status: 403,
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
        inputParams: { userId: user.id, storeId },
        exceptionType: typeof storeAccessStepError,
        exceptionName: (storeAccessStepError as any)?.name ?? null,
        exceptionCode: (storeAccessStepError as any)?.code ?? null,
        exceptionMessage: (storeAccessStepError as any)?.message ?? String(storeAccessStepError),
        exceptionDetails: (storeAccessStepError as any)?.details ?? null,
        exceptionHint: (storeAccessStepError as any)?.hint ?? null,
        serializedError: serializeError(storeAccessStepError),
      })
      throw storeAccessStepError
    }

    // ================================================================
    // BOOTSTRAP STEP 3: Load store details
    // ================================================================
    stage = 'bootstrap:store-load'
    let storeRow: any = null
    try {
      const storeLookupResult = await callerClient
        .from('stores')
        .select('id, organization_id')
        .eq('id', storeId)
        .limit(1)
        .maybeSingle()

      console.info('[api/analysis/comparison] [STEP 3 AFTER] bootstrap:store-load', {
        stepName: 'bootstrap:store-load',
        inputParams: { storeId },
        returnedRows: storeLookupResult.data ? 1 : 0,
        returnedObject: storeLookupResult.data ?? null,
        returnedError: storeLookupResult.error ? serializeError(storeLookupResult.error) : null,
        rawQueryResult: {
          status: storeLookupResult.status ?? null,
          statusText: storeLookupResult.statusText ?? null,
          count: storeLookupResult.count ?? null,
        },
        hasError: Boolean(storeLookupResult.error),
        hasRows: Boolean(storeLookupResult.data),
        success: !storeLookupResult.error && Boolean(storeLookupResult.data),
      })

      if (storeLookupResult.error) {
        console.error('[api/analysis/comparison] [STEP 3 FAILED] bootstrap:store-load', {
          stepName: 'bootstrap:store-load',
          inputParams: { storeId },
          errorCode: storeLookupResult.error.code ?? null,
          errorMessage: storeLookupResult.error.message ?? null,
          errorDetails: (storeLookupResult.error as any)?.details ?? null,
          errorHint: (storeLookupResult.error as any)?.hint ?? null,
          serializedError: serializeError(storeLookupResult.error),
        })
        throw storeLookupResult.error
      }

      if (!storeLookupResult.data) {
        const noStoreError = new Error(
          `No store found with id: ${storeId} (may be RLS denied or missing row)`,
        )
        console.error('[api/analysis/comparison] [STEP 3 FAILED] bootstrap:store-load - no-row', {
          stepName: 'bootstrap:store-load',
          inputParams: { storeId },
          errorMessage: noStoreError.message,
          returnedRows: 0,
          serializedError: serializeError(noStoreError),
        })
        throw noStoreError
      }

      storeRow = storeLookupResult.data
    } catch (storeLoadStepError) {
      console.error('[api/analysis/comparison] [STEP 3 EXCEPTION] bootstrap:store-load', {
        stepName: 'bootstrap:store-load',
        inputParams: { storeId },
        exceptionType: typeof storeLoadStepError,
        exceptionName: (storeLoadStepError as any)?.name ?? null,
        exceptionCode: (storeLoadStepError as any)?.code ?? null,
        exceptionMessage: (storeLoadStepError as any)?.message ?? String(storeLoadStepError),
        exceptionDetails: (storeLoadStepError as any)?.details ?? null,
        exceptionHint: (storeLoadStepError as any)?.hint ?? null,
        serializedError: serializeError(storeLoadStepError),
      })
      throw storeLoadStepError
    }

    // ================================================================
    // BOOTSTRAP STEP 4: Extract organization_id from store and user metadata
    // ================================================================
    stage = 'bootstrap:organization-id-extraction'
    let selectedOrganizationId: string | null = null
    let userOrgFromMeta: string | null = null
    try {
      const storeOrgId = storeRow?.organization_id ?? null
      selectedOrganizationId =
        typeof storeOrgId === 'string' ? (storeOrgId.trim() || null) : null

      const userMetaOrgId =
        typeof (user.user_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.user_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

      const userAppMetaOrgId =
        typeof (user.app_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.app_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

      userOrgFromMeta = userMetaOrgId || userAppMetaOrgId

      console.info('[api/analysis/comparison] [STEP 4 AFTER] bootstrap:organization-id-extraction', {
        stepName: 'bootstrap:organization-id-extraction',
        inputParams: {
          storeId,
          storeRowOrganizationId: storeRow?.organization_id ?? null,
          userMetadataOrgId: (user.user_metadata as { organization_id?: unknown } | null)?.organization_id ?? null,
          userAppMetadataOrgId: (user.app_metadata as { organization_id?: unknown } | null)?.organization_id ?? null,
        },
        returnedValues: {
          extractedStoreOrgId: selectedOrganizationId,
          extractedUserOrgId: userOrgFromMeta,
        },
        hasStoreOrgId: Boolean(selectedOrganizationId),
        hasUserOrgId: Boolean(userOrgFromMeta),
        idsMatch: selectedOrganizationId === userOrgFromMeta,
        success: Boolean(selectedOrganizationId),
      })

      if (!selectedOrganizationId) {
        const noOrgError = new Error(
          `Store ${storeId} has no organization_id set in database row`,
        )
        console.error('[api/analysis/comparison] [STEP 4 FAILED] bootstrap:organization-id-extraction - no-org-id', {
          stepName: 'bootstrap:organization-id-extraction',
          inputParams: { storeId },
          errorMessage: noOrgError.message,
          storeRow: { id: storeRow?.id, organization_id: storeRow?.organization_id },
          serializedError: serializeError(noOrgError),
        })
        throw noOrgError
      }
    } catch (orgIdExtractionError) {
      console.error('[api/analysis/comparison] [STEP 4 EXCEPTION] bootstrap:organization-id-extraction', {
        stepName: 'bootstrap:organization-id-extraction',
        inputParams: { storeId },
        exceptionType: typeof orgIdExtractionError,
        exceptionName: (orgIdExtractionError as any)?.name ?? null,
        exceptionCode: (orgIdExtractionError as any)?.code ?? null,
        exceptionMessage: (orgIdExtractionError as any)?.message ?? String(orgIdExtractionError),
        exceptionDetails: (orgIdExtractionError as any)?.details ?? null,
        exceptionHint: (orgIdExtractionError as any)?.hint ?? null,
        serializedError: serializeError(orgIdExtractionError),
      })
      throw orgIdExtractionError
    }

    // ================================================================
    // BOOTSTRAP STEP 5: Validate organization membership
    // ================================================================
    stage = 'bootstrap:membership-validation'
    try {
      const mismatch = selectedOrganizationId && userOrgFromMeta && selectedOrganizationId !== userOrgFromMeta
      
      console.info('[api/analysis/comparison] [STEP 5 AFTER] bootstrap:membership-validation', {
        stepName: 'bootstrap:membership-validation',
        inputParams: {
          storeOrganizationId: selectedOrganizationId,
          userOrganizationId: userOrgFromMeta,
        },
        validationResult: {
          storeOrgIdPresent: Boolean(selectedOrganizationId),
          userOrgIdPresent: Boolean(userOrgFromMeta),
          idsMatch: !mismatch,
          mismatchDetected: mismatch,
        },
        success: !mismatch,
      })

      if (mismatch) {
        const mismatchError = new Error(
          `Organization mismatch: store org_id=${selectedOrganizationId} but user org_id=${userOrgFromMeta}`,
        )
        console.error('[api/analysis/comparison] [STEP 5 FAILED] bootstrap:membership-validation - mismatch', {
          stepName: 'bootstrap:membership-validation',
          inputParams: {
            storeOrganizationId: selectedOrganizationId,
            userOrganizationId: userOrgFromMeta,
          },
          errorMessage: mismatchError.message,
          serializedError: serializeError(mismatchError),
        })
        throw mismatchError
      }
    } catch (membershipValidationError) {
      console.error('[api/analysis/comparison] [STEP 5 EXCEPTION] bootstrap:membership-validation', {
        stepName: 'bootstrap:membership-validation',
        inputParams: {
          storeOrganizationId: selectedOrganizationId,
          userOrganizationId: userOrgFromMeta,
        },
        exceptionType: typeof membershipValidationError,
        exceptionName: (membershipValidationError as any)?.name ?? null,
        exceptionCode: (membershipValidationError as any)?.code ?? null,
        exceptionMessage: (membershipValidationError as any)?.message ?? String(membershipValidationError),
        exceptionDetails: (membershipValidationError as any)?.details ?? null,
        exceptionHint: (membershipValidationError as any)?.hint ?? null,
        serializedError: serializeError(membershipValidationError),
      })
      throw membershipValidationError
    }

    // ================================================================
    // BOOTSTRAP COMPLETE - Prepare for aggregation
    // ================================================================
    const mappedRanges = getYearOverYearRanges({ from: fromDate, to: toDate })
    requestContext = {
      ...requestContext,
      selectedOrganizationId,
      userOrganizationId: userOrgFromMeta,
      mappedComparisonFrom: mappedRanges.previous.from,
      mappedComparisonTo: mappedRanges.previous.to,
    }

    console.info('[api/analysis/comparison] [BOOTSTRAP COMPLETE] all-bootstrap-steps-passed', {
      userId: user.id,
      storeId,
      selectedOrganizationId,
      userOrganizationId: userOrgFromMeta,
      selectedPeriod: { from: fromDate, to: toDate },
      comparisonPeriod: mappedRanges.previous,
    })

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
