'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense, useRef, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { getSupabase } from '@/lib/supabase'

const REMEMBER_KEY = 'profitro_remember_email'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Optional: αν έρχεται next param (π.χ. /login?next=/select-store)
  const nextUrl = searchParams.get('next') || '/select-store'

  // Remember-me (μόνο email)
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return Boolean(window.localStorage.getItem(REMEMBER_KEY))
  })

  const [email, setEmail] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(REMEMBER_KEY) || ''
  })

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(REMEMBER_KEY) || ''
  })
  const [forgotLoading, setForgotLoading] = useState(false)

  // ✅ Focus management for modal input
  const forgotEmailRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (!forgotOpen) return
    const id = window.setTimeout(() => {
      forgotEmailRef.current?.focus()
      forgotEmailRef.current?.select()
    }, 50)
    return () => window.clearTimeout(id)
  }, [forgotOpen])

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

    // remember-me: αποθηκεύουμε/σβήνουμε email
    if (typeof window !== 'undefined') {
      if (rememberMe) window.localStorage.setItem(REMEMBER_KEY, email.trim())
      else window.localStorage.removeItem(REMEMBER_KEY)
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) throw error

      // Αν υπάρχει session, προχώρα
      if (data?.session) {
        // μικρό delay βοηθάει mobile browsers να γράψουν storage
        await new Promise((r) => setTimeout(r, 150))
        window.location.href = nextUrl
      } else {
        // fallback
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

    // remember-me: αποθηκεύουμε/σβήνουμε email (αν έχει γραφτεί)
    if (typeof window !== 'undefined') {
      if (rememberMe && email.trim()) window.localStorage.setItem(REMEMBER_KEY, email.trim())
      if (!rememberMe) window.localStorage.removeItem(REMEMBER_KEY)
    }

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
    } catch (err: any) {
      console.error('Google login error:', err)
      toast.error(err?.message || 'Αποτυχία σύνδεσης με Google.')
    }
  }

  const handleSendReset = async () => {
    const emailToSend = forgotEmail.trim()
    if (!emailToSend) return toast.error('Γράψτε το email σας.')

    let supabase: ReturnType<typeof getSupabase>
    try {
      supabase = getSupabase()
    } catch (err: any) {
      toast.error('Σφάλμα: Λείπουν env variables της Supabase στο Vercel.')
      console.error(err)
      return
    }

    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailToSend, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error

      toast.success('Στάλθηκε email επαναφοράς κωδικού.')
      setForgotOpen(false)

      if (typeof window !== 'undefined' && rememberMe) {
        window.localStorage.setItem(REMEMBER_KEY, emailToSend)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Αποτυχία αποστολής email επαναφοράς.')
    } finally {
      setForgotLoading(false)
    }
  }

  // ✅ Enter key στο modal -> submit
  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (forgotLoading) return
    await handleSendReset()
  }

  return (
    <main style={containerStyle}>
      <Toaster richColors position="top-center" />

      <div style={loginCardStyle}>
        <div style={headerStyle}>
          <h1 style={brandStyle}>PROFITRO</h1>
          <div style={dividerStyle} />
          <p style={instructionStyle}>Είσοδος στο Σύστημα</p>
        </div>

        <form onSubmit={handleLogin} style={formStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="email@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>

            <div style={passwordWrapStyle}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={passwordInputStyle}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={eyeBtnStyle}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={optionsRowStyle}>
            <label style={rememberLabelStyle}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={checkboxStyle}
              />
              <span>ΘΥΜΗΣΟΥ ΜΕ</span>
            </label>

            <button type="button" onClick={() => setForgotOpen(true)} style={forgotBtnStyle}>
              ΞΕΧΑΣΑ ΚΩΔΙΚΟ
            </button>
          </div>

          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? 'ΤΑΥΤΟΠΟΙΗΣΗ...' : 'ΕΙΣΟΔΟΣ'}
          </button>

          <div style={orDividerStyle}>
            <span style={orLineStyle} />
            <span style={orTextStyle}>ή</span>
            <span style={orLineStyle} />
          </div>

          <button type="button" onClick={handleGoogleLogin} disabled={loading} style={googleBtnStyle}>
            <GoogleIcon />
            <span>Σύνδεση με Google</span>
          </button>
        </form>

        <div style={footerStyle}>
          <Link href="/register" style={footerLinkStyle}>
            ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ →
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Επαναφορά Κωδικού</div>
                <div style={modalSubStyle}>Θα σου στείλουμε link στο email.</div>
              </div>
              <button type="button" onClick={() => setForgotOpen(false)} style={modalCloseStyle} aria-label="Close">
                ✕
              </button>
            </div>

            {/* ✅ Enter key works because it's a form */}
            <form onSubmit={handleForgotSubmit}>
              <div style={{ ...fieldGroup, marginTop: 14 }}>
                <label style={labelStyle}>EMAIL</label>
                <input
                  ref={forgotEmailRef}
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </div>

              <button type="submit" disabled={forgotLoading} style={resetBtnStyle}>
                {forgotLoading ? 'ΑΠΟΣΤΟΛΗ...' : 'ΣΤΕΙΛΕ ΜΟΥ LINK'}
              </button>

              <button type="button" onClick={() => setForgotOpen(false)} style={modalSecondaryStyle}>
                ΑΚΥΡΩΣΗ
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default function LoginPage() {
  // Δεν καλούμε getSupabase εδώ.
  return (
    <Suspense fallback={<div style={containerStyle}>Φόρτωση...</div>}>
      <LoginContent />
    </Suspense>
  )
}

// ----- UI -----
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
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

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f8fafc',
  padding: '20px',
}

const loginCardStyle = {
  backgroundColor: '#ffffff',
  width: '100%',
  maxWidth: '400px',
  padding: '40px',
  borderRadius: '24px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
  borderTop: '6px solid #6366f1',
  textAlign: 'center' as const,
}

const headerStyle = { marginBottom: '30px' }
const brandStyle = {
  fontSize: '28px',
  fontWeight: '900',
  color: '#0f172a',
  margin: '0 0 5px 0',
  letterSpacing: '-1px',
}
const dividerStyle = {
  height: '3px',
  width: '30px',
  backgroundColor: '#6366f1',
  margin: '0 auto 15px auto',
  borderRadius: '2px',
}
const instructionStyle = {
  fontSize: '14px',
  color: '#64748b',
  fontWeight: '700',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
}

const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px', textAlign: 'left' as const }
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' }
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' }
const inputStyle = {
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '15px',
  outline: 'none',
  backgroundColor: '#f8fafc',
  width: '100%',
  boxSizing: 'border-box' as const,
}

const passwordWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  overflow: 'hidden',
}

const passwordInputStyle = {
  flex: 1,
  padding: '14px',
  border: 'none',
  fontSize: '15px',
  outline: 'none',
  backgroundColor: 'transparent',
} as const

const eyeBtnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '0 12px',
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '16px',
} as const

const optionsRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '-6px',
} as const

const rememberLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: '900',
  color: '#64748b',
  letterSpacing: '0.3px',
  cursor: 'pointer',
  userSelect: 'none',
} as const

const checkboxStyle = { width: 16, height: 16 }

const forgotBtnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '900',
  color: '#6366f1',
  padding: 0,
} as const

const submitBtnStyle = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '800',
  cursor: 'pointer',
  marginTop: '10px',
}

const orDividerStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }
const orLineStyle = { flex: 1, height: '1px', backgroundColor: '#e2e8f0' }
const orTextStyle = { fontSize: '12px', color: '#64748b', fontWeight: '700' }

const googleBtnStyle = {
  width: '100%',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid #d1d5db',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
}

const footerStyle = {
  marginTop: '30px',
  textAlign: 'center' as const,
  borderTop: '1px solid #f1f5f9',
  paddingTop: '20px',
}
const footerLinkStyle = { color: '#6366f1', fontWeight: '800', textDecoration: 'none', fontSize: '14px' }

// Modal styles
const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  zIndex: 50,
} as const

const modalCardStyle = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: '#ffffff',
  borderRadius: 18,
  border: '1px solid #e2e8f0',
  boxShadow: '0 18px 50px rgba(0,0,0,0.20)',
  padding: 18,
} as const

const modalHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
} as const

const modalTitleStyle = { fontWeight: 900, color: '#0f172a', fontSize: 16 } as const
const modalSubStyle = { marginTop: 4, color: '#64748b', fontSize: 12, fontWeight: 700 } as const

const modalCloseStyle = {
  border: '1px solid #e2e8f0',
  background: '#fff',
  borderRadius: 12,
  width: 36,
  height: 36,
  cursor: 'pointer',
  fontWeight: 900,
  color: '#0f172a',
} as const

const resetBtnStyle = {
  marginTop: 14,
  width: '100%',
  padding: '12px 14px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  fontWeight: 900,
  cursor: 'pointer',
} as const

const modalSecondaryStyle = {
  marginTop: 10,
  width: '100%',
  padding: '12px 14px',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  fontWeight: 900,
  cursor: 'pointer',
} as const