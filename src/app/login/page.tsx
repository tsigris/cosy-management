'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') 

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false)
  const [isFastMode, setIsFastMode] = useState(mode === 'fast')

  // Καθαρισμός τυχόν παλιών σκουπιδιών κατά τη φόρτωση της σελίδας
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
         router.replace('/select-store')
      }
    }
    checkSession()
  }, [router])

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

      if (data.user) {
        // Χρησιμοποιούμε replace για πιο γρήγορη μετάβαση χωρίς ιστορικό
        router.replace('/select-store')
      }
    } catch (err: any) {
      toast.error(err.message || 'Παρουσιάστηκε πρόβλημα κατά τη σύνδεση.')
    } finally {
      setLoading(false)
    }
  }

  const handlePinPress = (num: string) => {
    if (enteredPin.length < 4) {
      const newPin = enteredPin + num
      setEnteredPin(newPin)
      if (newPin.length === 4) {
        verifyPin(newPin)
      }
    }
  }

  const verifyPin = (pin: string) => {
    const savedPin = localStorage.getItem('cosy_app_pin')
    if (pin === savedPin) {
      localStorage.removeItem('active_store_id') // Καθαρισμός για σιγουριά
      router.replace('/select-store')
    } else {
      toast.error('Λάθος PIN')
      setEnteredPin('')
    }
  }

  if (isFastMode) {
    return (
      <main style={containerStyle}>
        <div style={loginCardStyle}>
          <div style={headerStyle}>
            <h1 style={brandStyle}>COSY APP</h1>
            <p style={instructionStyle}>Εισάγετε το PIN σας</p>
          </div>
          <div style={dotsContainer}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ 
                ...dotStyle, 
                backgroundColor: enteredPin.length >= i ? '#6366f1' : '#e2e8f0',
                transform: enteredPin.length >= i ? 'scale(1.2)' : 'scale(1)'
              }} />
            ))}
          </div>
          <div style={numpadGrid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => (
              <button 
                key={btn} 
                onClick={() => {
                  if (btn === 'C') setEnteredPin('')
                  else if (btn === '⌫') setEnteredPin(enteredPin.slice(0, -1))
                  else handlePinPress(btn)
                }}
                style={numBtnStyle}
              >
                {btn}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsFastMode(false)}
            style={{ ...footerLinkStyle, marginTop: '30px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Είσοδος με email →
          </button>
        </div>
      </main>
    )
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
        <form onSubmit={handleLogin} style={formStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>EMAIL</label>
            <input 
              type="email" 
              name="email" // Για αποθήκευση κωδικού
              autoComplete="username" // Για αποθήκευση κωδικού
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={inputStyle} 
              placeholder="email@example.com" 
              required
            />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>
            <input 
              type="password" 
              name="password" // Για αποθήκευση κωδικού
              autoComplete="current-password" // Για αποθήκευση κωδικού
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
        </form>
        <div style={footerStyle}>
          <p style={{fontSize:'13px', color:'#64748b', marginBottom:'10px'}}>Δεν έχετε λογαριασμό;</p>
          <Link href="/register" style={footerLinkStyle}>ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ →</Link>
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
const footerStyle = { marginTop: '30px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const footerLinkStyle = { color: '#6366f1', fontWeight: '800', textDecoration: 'none', fontSize: '14px' };
const dotsContainer = { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '40px' };
const dotStyle = { width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #e2e8f0', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' };
const numpadGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', width: '100%', maxWidth: '280px', margin: '0 auto' };
const numBtnStyle = { padding: '20px', fontSize: '22px', fontWeight: '800', backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '16px', cursor: 'pointer', color: '#0f172a', transition: 'all 0.1s' };
const confirmationWrapStyle = { marginBottom: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' };
const confirmationTextStyle = { margin: '0 0 10px 0', color: '#334155', fontSize: '13px', lineHeight: '1.5' };
const resendBtnStyle = { width: '100%', color: '#0f172a', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '12px', cursor: 'pointer' };