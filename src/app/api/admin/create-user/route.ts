import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient, getCallerFromHeader, assertAdminAccess, mapErrorMessage } from '../_shared/auth'

export const runtime = 'nodejs'

type CreateUserBody = {
  email?: string
  role?: 'admin' | 'user'
  tempPassword?: string
  storeId?: string
}


function randomPassword(length = 20) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_-+='
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (value) => charset[value % charset.length]).join('')
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}


async function findUserByEmail(adminClient: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase()
  const perPage = 200

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = Array.isArray(data?.users) ? data.users : []
    const user = users.find((item) => String(item.email || '').toLowerCase() === normalizedEmail)
    if (user) return user

    if (users.length < perPage) break
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateUserBody

    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body?.role
    const storeId = typeof body?.storeId === 'string' ? body.storeId.trim() : ''
    const tempPassword = typeof body?.tempPassword === 'string' ? body.tempPassword.trim() : ''

    if (!email || !isEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Δώσε έγκυρο email.' }, { status: 400 })
    }

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json({ ok: false, error: 'Μη έγκυρος ρόλος. Επιτρεπτά: admin, user.' }, { status: 400 })
    }

    if (!storeId) {
      return NextResponse.json({ ok: false, error: 'Λείπει το storeId.' }, { status: 400 })
    }

    const caller = await getCallerFromHeader(request)
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    const accessDenied = await assertAdminAccess(adminClient, caller.id, storeId)
    if (accessDenied) return accessDenied

    let userId = ''
    let existingUser = await findUserByEmail(adminClient, email)

    // ✅ IMPORTANT FIX:
    // Αν δημιουργούμε ΝΕΟ auth user από admin panel, βάζουμε metadata "invited_store_id"
    // ώστε ο DB trigger (handle_new_user) να ΜΗΝ φτιάξει νέο store για αυτόν.
    if (!existingUser) {
      const passwordToUse = tempPassword || randomPassword()

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: passwordToUse,
        email_confirm: true,

        // ✅ metadata για να ξεχωρίζει από normal signup
        user_metadata: {
          invited_store_id: storeId,
          role,
          invited_by: caller.id,
          invite_flow: true,
        },
      })

      if (createError) {
        const lower = String(createError.message || '').toLowerCase()
        const alreadyExists =
          lower.includes('already registered') ||
          lower.includes('already been registered') ||
          lower.includes('duplicate')

        if (!alreadyExists) {
          throw createError
        }

        existingUser = await findUserByEmail(adminClient, email)
        if (!existingUser) {
          throw new Error('Ο χρήστης υπάρχει ήδη αλλά δεν ήταν δυνατή η ανάκτησή του.')
        }
      }

      userId = created?.user?.id || existingUser?.id || ''
    } else {
      userId = existingUser.id

      // ✅ Optional: αν ο user υπήρχε ήδη, ενημερώνουμε metadata (δεν ξανατρέχει trigger, αλλά κρατάμε trace)
      // (Αν δεν το θες, μπορείς να το σβήσεις)
      try {
        await adminClient.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            invited_store_id: storeId,
            role,
            invited_by: caller.id,
            invite_flow: true,
          },
        })
      } catch {
        // ignore metadata update failures
      }
    }

    if (!userId) {
      throw new Error('Δεν εντοπίστηκε userId για σύνδεση με το κατάστημα.')
    }

    const defaultPermissions =
      role === 'admin'
        ? {
            can_view_analysis: true,
            can_view_history: true,
            can_edit_transactions: true,
          }
        : {
            can_view_analysis: true,
            can_view_history: true,
            can_edit_transactions: false,
          }

    const { error: accessUpsertError } = await adminClient.from('store_access').upsert(
      {
        user_id: userId,
        store_id: storeId,
        user_email: email,
        role,
        ...defaultPermissions,
      },
      { onConflict: 'user_id,store_id' }
    )

    if (accessUpsertError) throw accessUpsertError

    return NextResponse.json({ ok: true, userId, storeId })
  } catch (error) {
    console.error('admin/create-user error:', error)
    const mapped = mapErrorMessage(error, 'Αποτυχία δημιουργίας χρήστη.')
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }
}
