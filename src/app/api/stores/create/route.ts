import { getAdminClient, getCallerFromHeader, mapErrorMessage } from '../../admin/_shared/auth'

export const runtime = 'nodejs'

type CreateStoreBody = {
  name?: string
}

export async function POST(req: Request) {
  try {
    const user = await getCallerFromHeader(req as any)
    if (!user) {
      return Response.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const body = (await req.json()) as CreateStoreBody
    const name = typeof body?.name === 'string' ? body.name.trim().toUpperCase() : ''

    if (!name) {
      return Response.json({ ok: false, error: 'Δώσε όνομα καταστήματος.' }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    console.log('[create-store] inserting store with:', {
      name,
      user_id: user.id,
    })

    const { data: newStore, error: storeError } = await supabaseAdmin
      .from('stores')
      .insert({
        name: name.trim().toUpperCase(),
        owner_id: user.id,
      })
      .select()
      .single()

    if (storeError || !newStore) {
      console.error('[create-store] STORE INSERT ERROR:', storeError)
      return Response.json(
        {
          error: 'STORE_INSERT_FAILED',
          details: storeError,
        },
        { status: 500 },
      )
    }

    console.log('[create-store] STORE CREATED:', newStore)

    const { error: accessError } = await supabaseAdmin.from('store_access').upsert(
      {
        user_id: user.id,
        store_id: String((newStore as Record<string, unknown>).id || ''),
        user_email: user.email ?? null,
        role: 'admin',
        can_view_analysis: true,
        can_view_history: true,
        can_edit_transactions: true,
      },
      { onConflict: 'user_id,store_id' },
    )

    if (accessError) {
      console.error('[create-store] STORE_ACCESS INSERT ERROR:', accessError)
      return Response.json(
        {
          error: 'STORE_ACCESS_INSERT_FAILED',
          details: accessError,
        },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, store: newStore })
  } catch (error) {
    const mapped = mapErrorMessage(error, 'Αποτυχία δημιουργίας καταστήματος.')
    return Response.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }
}
