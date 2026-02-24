import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type CreateUserBody = {
  email?: string
  role?: 'admin' | 'user'
  tempPassword?: string
  storeId?: string
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
}

function randomPassword(length = 20) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_-+=' 
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (value) => charset[value % charset.length]).join('')
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function mapErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  const lower = message.toLowerCase()

  if (lower.includes('invalid login credentials') || lower.includes('jwt') || lower.includes('auth session missing')) {
    return { status: 401, message: 'Δεν υπάρχει ενεργή σύνδεση.' }
  }

  if (lower.includes('forbidden') || lower.includes('not allowed') || lower.includes('permission denied')) {
    return { status: 403, message: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' }
  }

  if (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('unique constraint')) {
    return { status: 409, message: 'Ο χρήστης υπάρχει ήδη στο κατάστημα.' }
  }

  if (lower.includes('invalid') && lower.includes('email')) {
    return { status: 400, message: 'Μη έγκυρο email.' }
  }

  return { status: 500, message: 'Αποτυχία δημιουργίας χρήστη.' }
}

async function getCallerClient() {
  const url = getSupabaseUrl()
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Missing Supabase public env vars on server')
  }

  const cookieStore = await cookies()

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie.name, cookie.value, cookie.options)
          } catch {
            break
          }
        }
      },
    },
  })
}

function getAdminClient() {
  const url = getSupabaseUrl()
  const serviceRoleKey = getServiceRoleKey()

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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

    const callerClient = await getCallerClient()
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser()

    if (callerError || !caller) {
      return NextResponse.json({ ok: false, error: 'Πρέπει να είστε συνδεδεμένος.' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    const { data: callerAccess, error: callerAccessError } = await adminClient
      .from('store_access')
      .select('role')
      .eq('user_id', caller.id)
      .eq('store_id', storeId)
      .maybeSingle()

    if (callerAccessError) {
      throw callerAccessError
    }

    if (!callerAccess || callerAccess.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' }, { status: 403 })
    }

    let userId = ''
    let existingUser = await findUserByEmail(adminClient, email)

    if (!existingUser) {
      const passwordToUse = tempPassword || randomPassword()
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: passwordToUse,
        email_confirm: true,
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
    }

    if (!userId) {
      throw new Error('Δεν εντοπίστηκε userId για σύνδεση με το κατάστημα.')
    }

    const { error: accessUpsertError } = await adminClient.from('store_access').upsert(
      {
        user_id: userId,
        store_id: storeId,
        role,
      },
      {
        onConflict: 'user_id,store_id',
      }
    )

    if (accessUpsertError) {
      throw accessUpsertError
    }

    return NextResponse.json({ ok: true, userId, storeId })
  } catch (error) {
    console.error('admin/create-user error:', error)
    const mapped = mapErrorMessage(error)
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status })
  }
}
