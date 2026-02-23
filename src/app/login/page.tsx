'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import type { FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Optional: αν έχεις next param (π.χ. /login?next=/select-store)
  const nextUrl = searchParams.get('next') || '/select-store'

  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Συμπληρώστε τα στοιχεία σας.')

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) throw error

      // ✅ Σε browser client, το session αποθηκεύεται από μόνο του στα cookies (με @supabase/ssr setup)
      if (data?.session) {
        window.location.href = nextUrl
        return
      }

      toast.error('Δεν βρέθηκε ενεργό session μετά τη σύνδεση.')
    } catch (err: any) {
      toast.error(err?.message || 'Παρουσιάστηκε πρόβλημα κατά τη σύνδεση.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // ✅ ΠΡΕΠΕΙ να υπάρχει route handler στο /auth/callback για exchangeCodeForSession
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) throw error
      // Redirect γίνεται από τη Supabase
    } catch (err: any) {
      console.error('Google login error:', err)
      toast.error(err?.message || 'Σφάλμα σύνδεσης με Google.')
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
              autoComplete="current-password"
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

// --- Google Icon ---
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

// --- Styles ---
const containerStyle: any = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f8fafc',
  padding: '20px',
}

const loginCardStyle: any = {
  backgroundColor: '#ffffff',
  width: '100%',
  maxWidth: '400px',
  padding: '40px',
  borderRadius: '24px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
  borderTop: '6px solid #6366f1',
  textAlign: 'center',
}

const headerStyle: any = { marginBottom: '30px' }

const brandStyle: any = {
  fontSize: '28px',
  fontWeight: '900',
  color: '#0f172a',
  margin: '0 0 5px 0',
  letterSpacing: '-1px',
}

const dividerStyle: any = {
  height: '3px',
  width: '30px',
  backgroundColor: '#6366f1',
  margin: '0 auto 15px auto',
  borderRadius: '2px',
}

const instructionStyle: any = {
  fontSize: '14px',
  color: '#64748b',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const formStyle: any = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  textAlign: 'left',
}

const fieldGroup: any = { display: 'flex', flexDirection: 'column', gap: '6px' }

const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' }

const inputStyle: any = {
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '15px',
  outline: 'none',
  backgroundColor: '#f8fafc',
}

const submitBtnStyle: any = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '800',
  cursor: 'pointer',
  marginTop: '10px',
}

const orDividerStyle: any = { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }

const orLineStyle: any = { flex: 1, height: '1px', backgroundColor: '#e2e8f0' }

const orTextStyle: any = { fontSize: '12px', color: '#64748b', fontWeight: '700' }

const googleBtnStyle: any = {
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

const footerStyle: any = {
  marginTop: '30px',
  textAlign: 'center',
  borderTop: '1px solid #f1f5f9',
  paddingTop: '20px',
}

const footerLinkStyle: any = { color: '#6366f1', fontWeight: '800', textDecoration: 'none', fontSize: '14px' }