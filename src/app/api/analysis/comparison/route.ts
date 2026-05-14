import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, mapErrorMessage, requireStoreMember } from '@/app/api/admin/_shared/auth'
import { buildFinancialComparison } from '@/lib/server/analysisComparison'

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

    const authResult = await requireStoreMember(request, storeId)
    if (authResult instanceof NextResponse) return authResult

    const adminClient = getAdminClient()
    const payload = await buildFinancialComparison(adminClient, storeId, {
      from: fromDate,
      to: toDate,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[api/analysis/comparison] failed', error)
    const mapped = mapErrorMessage(error, 'Αποτυχία φόρτωσης σύγκρισης.')
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
