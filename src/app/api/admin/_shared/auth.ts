import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('[admin] Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL env var')
  return url
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY
  if (!key) throw new Error('[admin] Missing SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY env var')
  return key
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) throw new Error('[admin] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY env var')
  return key
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

/**
 * Returns a Supabase client authenticated with the service-role key.
 * Only call from server-side API routes — never expose to the browser.
 */
export function getAdminClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Reads the `x-supabase-auth` header and validates the JWT against Supabase.
 * Returns the authenticated User or null if absent/invalid.
 */
export async function getCallerFromHeader(request: NextRequest) {
  const token = request.headers.get('x-supabase-auth')?.trim() || ''
  if (!token) return null

  const callerClient = createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error,
  } = await callerClient.auth.getUser(token)

  if (error || !user) return null
  return user
}

// ---------------------------------------------------------------------------
// Permission guard
// ---------------------------------------------------------------------------

/**
 * Verifies that `callerId` holds the 'admin' role for `storeId` in store_access.
 * Returns a 403 NextResponse if the check fails, or null if the caller is authorised.
 * Throws on unexpected DB errors so the route's catch block can handle them uniformly.
 */
export async function assertAdminAccess(
  adminClient: SupabaseClient,
  callerId: string,
  storeId: string,
): Promise<NextResponse | null> {
  const { data, error } = await adminClient
    .from('store_access')
    .select('store_id')
    .eq('user_id', callerId)
    .eq('store_id', storeId)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' },
      { status: 403 },
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps a caught error to a deterministic HTTP status + Greek UI message.
 * Used by routes that need consistent error responses for Supabase/auth errors.
 */
export function mapErrorMessage(
  error: unknown,
  fallbackMessage = 'Αποτυχία λειτουργίας.',
): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  const lower = message.toLowerCase()

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('jwt') ||
    lower.includes('auth session missing')
  ) {
    return { status: 401, message: 'Δεν υπάρχει ενεργή σύνδεση.' }
  }

  if (
    lower.includes('forbidden') ||
    lower.includes('not allowed') ||
    lower.includes('permission denied')
  ) {
    return { status: 403, message: 'Δεν έχετε δικαιώματα admin για αυτό το κατάστημα.' }
  }

  if (
    lower.includes('duplicate') ||
    lower.includes('already exists') ||
    lower.includes('unique constraint')
  ) {
    return { status: 409, message: 'Ο χρήστης υπάρχει ήδη στο κατάστημα.' }
  }

  if (lower.includes('invalid') && lower.includes('email')) {
    return { status: 400, message: 'Μη έγκυρο email.' }
  }

  return { status: 500, message: fallbackMessage }
}
