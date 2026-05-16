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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ComparisonRequestBody
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const fromDate = typeof body?.fromDate === 'string' ? body.fromDate.trim() : ''
    const toDate = typeof body?.toDate === 'string' ? body.toDate.trim() : ''

    if (!storeId || !fromDate || !toDate) {
      return NextResponse.json(
        { error: 'Missing storeId, fromDate, or toDate.' },
        { status: 400 },
      )
    }

    const token = request.headers.get('x-supabase-auth')?.trim() || ''
    if (!token) {
      return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 })
    }

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

    if (userError || !user) {
      return NextResponse.json({ error: 'Απαιτείται σύνδεση.' }, { status: 401 })
    }

    const { data: membershipRow, error: membershipError } = await callerClient
      .from('store_access')
      .select('store_id')
      .eq('user_id', user.id)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle()

    if (membershipError) throw membershipError
    if (!membershipRow) {
      return NextResponse.json({ error: 'Δεν έχετε πρόσβαση σε αυτό το κατάστημα.' }, { status: 403 })
    }

    const { data: storeRow, error: storeError } = await callerClient
      .from('stores')
      .select('id, organization_id')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle()

    if (storeError) throw storeError

    const selectedOrganizationId =
      typeof storeRow?.organization_id === 'string' ? storeRow.organization_id.trim() || null : null

    const userOrgFromMeta =
      typeof (user.user_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
        ? String((user.user_metadata as { organization_id?: unknown }).organization_id).trim() || null
        : typeof (user.app_metadata as { organization_id?: unknown } | null)?.organization_id === 'string'
          ? String((user.app_metadata as { organization_id?: unknown }).organization_id).trim() || null
          : null

    const mappedRanges = getYearOverYearRanges({ from: fromDate, to: toDate })

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

    const payload = await buildFinancialComparison(callerClient, storeId, {
      from: fromDate,
      to: toDate,
    })

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
      })
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[api/analysis/comparison] FAILED:', errorMessage)
    if (errorStack) console.error(errorStack)
    const mapped = mapErrorMessage(error, 'Αποτυχία φόρτωσης σύγκρισης.')
    return NextResponse.json(
      {
        error: mapped.message,
        ...(process.env.NODE_ENV !== 'production' && { _debug: errorMessage }),
      },
      { status: mapped.status },
    )
  }
}
