'use client'

import React, { useState, Suspense } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Mail } from 'lucide-react'

const getEmailRedirectUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return `${envUrl.replace(/\/$/, '')}/login`
  if (typeof window !== 'undefined') return `${window.location.origin}/login`
  return '/login'
}

function RegisterForm() {
  const supabase = getSupabase()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  /* ---------------- HELPERS ---------------- */

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /* ---------------- RESEND EMAIL ---------------- */

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast.error('Συμπλήρωσε πρώτα το email.')
      return
    }

    try {
      setResendLoading(true)

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: getEmailRedirectUrl() },
      })

      if (error) throw error

      toast.success('Στάλθηκε νέο email επιβεβαίωσης.')
    } catch (e: any) {
      toast.error(e?.message || 'Σφάλμα επαναποστολής')
    } finally {
      setResendLoading(false)
    }
  }

  /* ---------------- SIGNUP ---------------- */

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || password.length < 6) {
      toast.error('Email και password τουλάχιστον 6 χαρακτήρες.')
      return
    }

    try {
      setLoading(true)

      // ✅ ΜΟΝΟ signup εδώ.
      // Τα stores / store_access / profiles δημιουργούνται από DB trigger (handle_new_user).
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password, // ⚠️ no trim
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          data: { username: username || email.split('@')[0] },
        },
      })

      if (signUpError) throw signUpError

      const user = authData.user
      if (!user) throw new Error('Signup failed')

      const isEmailConfirmed = !!user.email_confirmed_at || !!(user as any).confirmed_at
      let session = authData.session

      // ✅ Αν το email είναι ήδη confirmed αλλά δεν γύρισε session, κάνε auto-login
      if (!session && isEmailConfirmed) {
        const loginRes = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (loginRes.error) throw loginRes.error
        session = loginRes.data.session
      }

      // ✅ Αν χρειάζεται email confirmation: σταμάτα εδώ
      if (!session && !isEmailConfirmed) {
        setEmailConfirmationPending(true)
        toast.success('Η εγγραφή έγινε. Ελέγξτε το email για επιβεβαίωση.')
        return
      }

      // ✅ Τώρα ο χρήστης είναι logged in.
      // Περιμένουμε λίγο να ολοκληρώσει ο trigger τη δημιουργία profile/store_access
      // και μετά παίρνουμε store_id.
      let storeId: string | null = null

      // 1) προσπάθησε από profiles.store_id (το πιο σωστό)
      for (let i = 0; i < 10; i++) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('store_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!profileErr && profile?.store_id) {
          storeId = profile.store_id
          break
        }

        await wait(250)
      }

      // 2) fallback: πάρε store από stores.owner_id (σίγουρο με βάση το trigger)
      if (!storeId) {
        for (let i = 0; i < 10; i++) {
          const { data: store, error: storeErr } = await supabase
            .from('stores')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1)
            .maybeSingle()

          if (!storeErr && store?.id) {
            storeId = store.id
            break
          }

          await wait(250)
        }
      }

      if (!storeId) {
        toast.error('Ο λογαριασμός δημιουργήθηκε, αλλά δεν βρέθηκε κατάστημα. Κάνε login ξανά.')
        router.push('/login')
        return
      }

      toast.success('Η εγγραφή ολοκληρώθηκε!')

      localStorage.setItem('active_store_id', storeId)

      router.push(`/?store=${storeId}`)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Signup error')
    } finally {
      setLoading(false)
    }
  }

  /* ---------------- UI ---------------- */

  return (
    <div style={cardStyle}>
      <Toaster position="top-center" richColors />

      <div style={headerStyle}>
        <h1 style={brandStyle}>COSY APP</h1>
        <div style={dividerStyle} />
        <p style={instructionStyle}>ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ</p>
      </div>

      {emailConfirmationPending ? (
        <div style={confirmationWrapStyle}>
          <Mail size={28} />
          <p style={confirmationTextStyle}>Επιβεβαιώστε το email σας.</p>

          <button onClick={handleResendConfirmationEmail} disabled={resendLoading} style={resendBtnStyle}>
            {resendLoading ? 'Στέλνω...' : 'ΕΠΑΝΑΠΟΣΤΟΛΗ EMAIL'}
          </button>

          <Link href="/login" style={confirmLoginBtnStyle}>
            LOGIN
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSignUp} style={formStyle}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" style={inputStyle} />

          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} required />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
            required
          />

          <button disabled={loading} style={submitBtnStyle}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      <div style={footerStyle}>
        <Link href="/login">← LOGIN</Link>
      </div>
    </div>
  )
}

/* ---------------- PAGE ---------------- */

export default function RegisterPage() {
  return (
    <main style={containerStyle}>
      <Suspense fallback={<div>Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

/* ---------------- STYLES ---------------- */

const containerStyle: any = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const cardStyle: any = {
  width: 400,
  padding: 30,
  borderRadius: 20,
  background: '#fff',
}

const headerStyle: any = { textAlign: 'center' }

const brandStyle: any = { fontSize: 24, fontWeight: 900 }

const dividerStyle: any = {
  height: 4,
  width: 40,
  background: '#6366f1',
  margin: '10px auto',
}

const instructionStyle: any = {
  fontSize: 12,
  fontWeight: 700,
}

const formStyle: any = {
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
}

const inputStyle: any = {
  padding: 12,
  borderRadius: 10,
  border: '1px solid #ccc',
}

const submitBtnStyle: any = {
  padding: 14,
  borderRadius: 10,
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  fontWeight: 800,
}

const confirmationWrapStyle: any = {
  textAlign: 'center',
}

const confirmationTextStyle: any = {
  marginTop: 10,
}

const resendBtnStyle: any = {
  marginTop: 10,
  padding: 10,
  borderRadius: 10,
  border: '1px solid #e2e8f0',
  background: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const confirmLoginBtnStyle: any = {
  display: 'block',
  marginTop: 10,
  fontWeight: 800,
}

const footerStyle: any = {
  marginTop: 20,
  textAlign: 'center',
}