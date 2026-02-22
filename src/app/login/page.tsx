'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense, useEffect, useRef } from 'react'
import { getSessionCached, setSessionCache, supabase } from '@/lib/supabase'
import { prefetchStoresForUser, readStoresCache } from '@/lib/stores'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const getEmailRedirectUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL

  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/login`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/login`
  }

  return '/login'
}

const getOAuthRedirectUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/login`
  }

  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/login`
  }

  return '/login'
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false)
  const [showDelayedAuthMessage, setShowDelayedAuthMessage] = useState(false)
  const googleLoadingToastRef = useRef<string | number | null>(null)

  const getSafeNextPath = (next: string | null) => {
    if (!next) return null
    if (!next.startsWith('/')) return null
    if (next.startsWith('//')) return null
    return next
  }

  const safeNextPath = getSafeNextPath(nextParam)
  const registerHref = safeNextPath ? `/register?next=${encodeURIComponent(safeNextPath)}` : '/register'

  const waitForStoresCacheWrite = async (userId: string, maxWaitMs = 6000) => {
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
      const cached = readStoresCache(userId)
      if (cached) return cached
      await new Promise((resolve) => window.setTimeout(resolve, 120))
    }

    return null
  }

  // Καθαρισμός τυχόν παλιών σκουπιδιών κατά τη φόρτωση της σελίδας
  useEffect(() => {
    const checkSession = async () => {
      const session = await getSessionCached()
      if (session) {
         const prefetched = await prefetchStoresForUser(session.user.id)
         const cached = prefetched ? await waitForStoresCacheWrite(session.user.id) : readStoresCache(session.user.id)
         router.refresh()

         if ((cached && cached.stores.length > 0) || (prefetched && prefetched.stores.length > 0)) {
           router.replace('/')
           return
         }

         if (prefetched && prefetched.stores.length === 0) {
           router.replace('/select-store')
           return
         }

         router.replace('/')
      }
    }
    checkSession()
  }, [router])

  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user?.id) return

      void (async () => {
        if (googleLoadingToastRef.current !== null) {
          toast.dismiss(googleLoadingToastRef.current)
          googleLoadingToastRef.current = null
        }

        setShowDelayedAuthMessage(false)

        const userId = session.user.id
        const prefetched = await prefetchStoresForUser(userId)
        const cached = prefetched ? await waitForStoresCacheWrite(userId) : readStoresCache(userId)

        setLoading(false)

        if ((cached && cached.stores.length > 0) || (prefetched && prefetched.stores.length > 0)) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push('/')
          await router.refresh()
          return
        }

        if (!prefetched) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push('/')
          await router.refresh()
          return
        }

        if (prefetched && prefetched.stores.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push('/select-store')
          router.refresh()
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 500))
        router.push('/')
        router.refresh()
      })()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (!loading) {
      setShowDelayedAuthMessage(false)
      return
    }

    const timeoutId = window.setTimeout(async () => {
      const session = await getSessionCached()
      if (!session) {
        setShowDelayedAuthMessage(true)
      }
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loading])

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast.error('Συμπληρώστε πρώτα το email σας.')
      return
    }

    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: getEmailRedirectUrl()
        }
      })

      if (error) throw error
      toast.success('Στάλθηκε νέο email επιβεβαίωσης. Ελέγξτε τα εισερχόμενα.')
    } catch (error: any) {
      toast.error(error.message || 'Αποτυχία επαναποστολής email επιβεβαίωσης.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Συμπληρώστε τα στοιχεία σας.')
    
    setLoading(true)
    
    try {
      // Καθαρίζουμε το παλιό ID καταστήματος πριν το νέο login για να αποφύγουμε το "μπέρδεμα"
      localStorage.removeItem('active_store_id')

      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: password.trim() 
      })
      
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          setEmailConfirmationPending(true)
          toast.error('Δεν έχει επιβεβαιωθεί το email σας. Ελέγξτε τα εισερχόμενα.', {
            action: {
              label: 'ΕΠΑΝΑΠΟΣΤΟΛΗ',
              onClick: () => {
                void handleResendConfirmationEmail()
              }
            }
          })
          return
        }

        throw error
      }

      setEmailConfirmationPending(false)
      setSessionCache(data.session ?? null)

      if (data.user) {
        const prefetchUserId = data.session?.user.id || data.user.id
        const prefetched = await prefetchStoresForUser(prefetchUserId)
        const cached = prefetched ? await waitForStoresCacheWrite(prefetchUserId) : readStoresCache(prefetchUserId)
        const nextAfterLogin = getSafeNextPath(searchParams.get('next'))

        if ((cached && cached.stores.length > 0) || (prefetched && prefetched.stores.length > 0)) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push(nextAfterLogin || '/')
          return
        }

        if (!prefetched) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push('/')
          return
        }

        if (prefetched && prefetched.stores.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          router.push('/select-store')
          return
        }

        await new Promise((resolve) => setTimeout(resolve, 500))
        router.push(nextAfterLogin || '/')
      }
    } catch (err: any) {
      toast.error(err.message || 'Παρουσιάστηκε πρόβλημα κατά τη σύνδεση.')
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = async () => {
    googleLoadingToastRef.current = toast.loading('Γίνεται ταυτοποίηση...')
    setShowDelayedAuthMessage(false)
    setLoading(true)

    try {
      localStorage.removeItem('active_store_id')

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl()
        }
      })

      if (error) throw error
    } catch (err: any) {
      if (googleLoadingToastRef.current !== null) {
        toast.dismiss(googleLoadingToastRef.current)
        googleLoadingToastRef.current = null
      }
      toast.error(err.message || 'Αποτυχία σύνδεσης με Google.')
      setLoading(false)
    }
  }

  return (
    <main style={containerStyle}>
      <Toaster richColors position="top-center" />
      <div style={loginCardStyle}>
        <div style={headerStyle}>
          <h1 style={brandStyle}>COSY APP</h1>
          <div style={dividerStyle} />
          <p style={instructionStyle}>Είσοδος στο Σύστημα</p>
        </div>
        {emailConfirmationPending && (
          <div style={confirmationWrapStyle}>
            <p style={confirmationTextStyle}>
              Δεν μπορείτε να συνδεθείτε ακόμα. Πρώτα επιβεβαιώστε το email σας από τα εισερχόμενα και μετά δοκιμάστε ξανά.
            </p>
            <button
              type="button"
              onClick={handleResendConfirmationEmail}
              disabled={resendLoading}
              style={{ ...resendBtnStyle, opacity: resendLoading ? 0.7 : 1 }}
            >
              {resendLoading ? 'ΓΙΝΕΤΑΙ ΑΠΟΣΤΟΛΗ...' : 'ΕΠΑΝΑΠΟΣΤΟΛΗ EMAIL'}
            </button>
          </div>
        )}
        {showDelayedAuthMessage && (
          <div style={confirmationWrapStyle}>
            <p style={confirmationTextStyle}>Η σύνδεση καθυστερεί...</p>
            <button
              type="button"
              onClick={() => {
                if (googleLoadingToastRef.current !== null) {
                  toast.dismiss(googleLoadingToastRef.current)
                  googleLoadingToastRef.current = null
                }
                setShowDelayedAuthMessage(false)
                setLoading(false)
              }}
              style={resendBtnStyle}
            >
              Επιστροφή
            </button>
          </div>
        )}
        <form onSubmit={handleLogin} action="javascript:void(0);" method="post" style={formStyle}>
          <div style={fieldGroup}>
            <label htmlFor="username" style={labelStyle}>EMAIL</label>
            <input 
              id="username"
              type="email" 
              name="email"
              autoComplete="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={inputStyle} 
              placeholder="email@example.com" 
              required
            />
          </div>
          <div style={fieldGroup}>
            <label htmlFor="password" style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>
            <input 
              id="password"
              type="password" 
              name="password"
              autoComplete="current-password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={inputStyle} 
              placeholder="••••••••" 
              required
            />
          </div>
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? 'ΤΑΥΤΟΠΟΙΗΣΗ...' : 'ΕΙΣΟΔΟΣ'}
          </button>
          <div style={orDividerStyle}>
            <span style={orLineStyle} />
            <span style={orTextStyle}>ή</span>
            <span style={orLineStyle} />
          </div>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            style={{ ...googleBtnStyle, opacity: loading ? 0.7 : 1 }}
          >
            <GoogleIcon />
            <span>Σύνδεση με Google</span>
          </button>
        </form>
        <div style={footerStyle}>
          <p style={{fontSize:'13px', color:'#64748b', marginBottom:'10px'}}>Δεν έχετε λογαριασμό;</p>
          <Link href={registerHref} style={footerLinkStyle}>ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ →</Link>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={containerStyle}>Φόρτωση...</div>}>
      <LoginContent />
    </Suspense>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.7-1.6 2.7-4 2.7-6.8 0-.7-.1-1.5-.2-2.2H12z" />
      <path fill="#34A853" d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3-2.3c-.8.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2l-3.1 2.4C5.1 19.8 8.3 22 12 22z" />
      <path fill="#4A90E2" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.3 7.6C2.5 9.1 2 10.5 2 12s.5 2.9 1.3 4.4L6.4 14z" />
      <path fill="#FBBC05" d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 2.8 14.6 2 12 2 8.3 2 5.1 4.2 3.3 7.6L6.4 10c.8-2.4 3-4.2 5.6-4.2z" />
    </svg>
  )
}

// --- STYLES ---
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' };
const loginCardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderTop: '6px solid #6366f1', textAlign: 'center' as const };
const headerStyle = { marginBottom: '30px' };
const brandStyle = { fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 5px 0', letterSpacing: '-1px' };
const dividerStyle = { height: '3px', width: '30px', backgroundColor: '#6366f1', margin: '0 auto 15px auto', borderRadius: '2px' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px', textAlign: 'left' as const };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' };
const inputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', backgroundColor: '#f8fafc' };
const submitBtnStyle = { backgroundColor: '#0f172a', color: '#ffffff', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', cursor: 'pointer', marginTop: '10px' };
const orDividerStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' };
const orLineStyle = { flex: 1, height: '1px', backgroundColor: '#e2e8f0' };
const orTextStyle = { fontSize: '12px', color: '#64748b', fontWeight: '700' };
const googleBtnStyle = { width: '100%', backgroundColor: '#ffffff', color: '#0f172a', padding: '14px 16px', borderRadius: '14px', border: '1px solid #d1d5db', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const footerStyle = { marginTop: '30px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const footerLinkStyle = { color: '#6366f1', fontWeight: '800', textDecoration: 'none', fontSize: '14px' };
const confirmationWrapStyle = { marginBottom: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' };
const confirmationTextStyle = { margin: '0 0 10px 0', color: '#334155', fontSize: '13px', lineHeight: '1.5' };
const resendBtnStyle = { width: '100%', color: '#0f172a', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };