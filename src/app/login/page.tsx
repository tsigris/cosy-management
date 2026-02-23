'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, Suspense } from 'react'
import type { FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { getSupabase } from '@/lib/supabase'

function safeNextPath(nextUrl: string | null, fallback: string) {
  const raw = (nextUrl || '').trim()
  if (!raw) return fallback
  // allow only internal paths like "/select-store"
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) return raw
  return fallback
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextUrl = useMemo(() => {
    const nextParam = searchParams.get('next')
    return safeNextPath(nextParam, '/select-store')
  }, [searchParams])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()

    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (err: any) {
      toast.error('Σφάλμα: Λείπουν env variables της Supabase στο Vercel.')
      console.error(err)
      return
    }

    if (!email.trim() || !password.trim()) {
      toast.error('Συμπληρώστε email και κωδικό.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })
      if (error) throw error

      // mobile-friendly redirect
      if (data?.session) {
        await new Promise((r) => setTimeout(r, 150))
        window.location.href = nextUrl
      } else {
        router.push(nextUrl)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Παρουσιάστηκε πρόβλημα κατά τη σύνδεση.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (err: any) {
      toast.error('Σφάλμα: Λείπουν env variables της Supabase στο Vercel.')
      console.error(err)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
      // redirect handled by supabase provider flow
    } catch (err: any) {
      console.error('Google login error:', err)
      toast.error(err?.message || 'Αποτυχία σύνδεσης με Google.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <Toaster richColors position="top-center" />

      {/* soft background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-[700px] -translate-x-1/2 rounded-full bg-slate-900/10 blur-3xl" />
        <div className="absolute top-28 left-[-120px] h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-36 right-[-120px] h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white font-black">
                P
              </div>
              <div className="text-left leading-tight">
                <div className="text-lg font-black tracking-tight">Profitro</div>
                <div className="text-xs font-semibold text-slate-500">Sign in to your workspace</div>
              </div>
            </Link>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="mb-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Secure login
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight">Είσοδος</h1>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Συνδέσου για να δεις τα καταστήματά σου και τα reports σου.
              </p>
            </div>

            <form onSubmit={handleLogin} className="grid gap-4">
              <div>
                <label className="text-[11px] font-extrabold text-slate-500">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-500">ΚΩΔΙΚΟΣ</label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-slate-400">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="w-full bg-transparent px-1 py-1 text-sm font-semibold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? 'HIDE' : 'SHOW'}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-extrabold text-slate-700 hover:text-slate-900"
                  >
                    Ξέχασες κωδικό;
                  </Link>
                  <span className="text-xs font-semibold text-slate-400">Next: {nextUrl}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'ΤΑΥΤΟΠΟΙΗΣΗ...' : 'ΕΙΣΟΔΟΣ'}
              </button>

              <div className="my-1 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="text-xs font-extrabold text-slate-400">ή</div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <GoogleIcon />
                  Σύνδεση με Google
                </span>
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5 text-center">
              <Link href="/register" className="text-sm font-extrabold text-indigo-600 hover:text-indigo-700">
                Δημιουργία λογαριασμού →
              </Link>
              <div className="mt-2 text-xs font-semibold text-slate-500">
                Με το login αποδέχεσαι τους όρους χρήσης & την πολιτική απορρήτου.
              </div>
            </div>
          </div>

          {/* small footer */}
          <div className="mt-6 text-center text-xs font-semibold text-slate-500">
            © {new Date().getFullYear()} Profitro.app
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-6 text-sm font-semibold text-slate-600">Φόρτωση...</div>}>
      <LoginContent />
    </Suspense>
  )
}

// ----- UI -----
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.7-1.6 2.7-4 2.7-6.8 0-.7-.1-1.5-.2-2.2H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3-2.3c-.8.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2l-3.1 2.4C5.1 19.8 8.3 22 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.3 7.6C2.5 9.1 2 10.5 2 12s.5 2.9 1.3 4.4L6.4 14z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.8 14.6 2 12 2 8.3 2 5.1 4.2 3.3 7.6L6.4 10c.8-2.4 3-4.2 5.6-4.2z"
      />
    </svg>
  )
}