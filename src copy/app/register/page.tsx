'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { Mail } from 'lucide-react'

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

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextParam = searchParams.get('next')
  const tokenParam = searchParams.get('token')

  const getSafeNextPath = (next: string | null) => {
    if (!next) return null
    if (!next.startsWith('/')) return null
    if (next.startsWith('//')) return null
    return next
  }

  const safeNextPath = getSafeNextPath(nextParam)
  const inviteNextPath =
    safeNextPath && safeNextPath.startsWith('/accept-invite?token=')
      ? safeNextPath
      : tokenParam
        ? `/accept-invite?token=${encodeURIComponent(tokenParam)}`
        : null

  const isInviteRegistration = Boolean(inviteNextPath)
  const loginHref = inviteNextPath ? `/login?next=${encodeURIComponent(inviteNextPath)}` : '/login'

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      toast.error('Συμπλήρωσε πρώτα το email σου.')
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
      toast.success('Στάλθηκε νέο email επιβεβαίωσης.')
    } catch (error: any) {
      toast.error(error.message || 'Αποτυχία επαναποστολής email.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || password.length < 6) {
      toast.error('Email και κωδικός τουλάχιστον 6 χαρακτήρων.')
      return
    }

    setLoading(true)

    try {
      // 1. ΕΓΓΡΑΦΗ ΧΡΗΣΤΗ ΣΤΟ AUTH
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
          data: { username: username || email.split('@')[0] }
        }
      })

      if (authError) {
        if (/user already registered/i.test(authError.message)) {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: {
              emailRedirectTo: getEmailRedirectUrl()
            }
          })

          if (!resendError) {
            setEmailConfirmationPending(true)
            toast.success('Ο λογαριασμός υπάρχει ήδη αλλά δεν έχει επιβεβαιωθεί. Στείλαμε νέο email επιβεβαίωσης.')
            return
          }
        }

        throw authError
      }
      
      const user = authData.user
      if (!user) throw new Error('Η εγγραφή απέτυχε. Δοκιμάστε ξανά.')

      let finalStoreId = ''

      // 2. ΝΕΟΣ ΙΔΙΟΚΤΗΤΗΣ (χωρίς πρόσκληση)
      if (!isInviteRegistration) {
        // --- ΣΕΝΑΡΙΟ Β: ΝΕΟΣ ΙΔΙΟΚΤΗΤΗΣ (ADMIN) ---
        
        // Δημιουργία νέου καταστήματος
        const { data: newStore, error: storeErr } = await supabase
          .from('stores')
          .insert([{ 
            name: `ΚΑΤΑΣΤΗΜΑ ${username.toUpperCase() || 'ΜΟΥ'}`, 
            owner_id: user.id 
          }])
          .select()
          .single()

        if (storeErr) throw storeErr
        finalStoreId = newStore.id

        // Δίνουμε ρόλο admin στον ιδιοκτήτη
        const { error: adminAccessError } = await supabase.from('store_access').insert([{
          user_id: user.id,
          store_id: finalStoreId,
          role: 'admin'
        }])
        if (adminAccessError) throw adminAccessError

        // Δημιουργία Βασικών Παγίων για το νέο κατάστημα
        const defaultAssets = [
          { name: 'ΕΝΟΙΚΙΟ', store_id: finalStoreId },
          { name: 'ΛΟΓΙΣΤΗΣ', store_id: finalStoreId },
          { name: 'ΔΕΗ / ΡΕΥΜΑ', store_id: finalStoreId }
        ]
        const { error: assetsError } = await supabase.from('fixed_assets').insert(defaultAssets)
        if (assetsError) throw assetsError
      } else if (tokenParam) {
        const { data: inviteData, error: inviteError } = await supabase.rpc('accept_store_invite', {
          p_token: tokenParam
        })

        if (inviteError) {
          const msg = (inviteError.message || '').toLowerCase()
          const mappedMessage = msg.includes('expired')
            ? 'Η πρόσκληση έχει λήξει.'
            : msg.includes('already used') || msg.includes('used')
              ? 'Η πρόσκληση έχει ήδη χρησιμοποιηθεί.'
              : 'Το link είναι άκυρο ή έληξε ή έχει ήδη χρησιμοποιηθεί.'
          throw new Error(mappedMessage)
        }

        finalStoreId =
          typeof inviteData === 'string' || typeof inviteData === 'number'
            ? String(inviteData)
            : (inviteData as { storeId?: string; store_id?: string } | null)?.storeId ||
              (inviteData as { storeId?: string; store_id?: string } | null)?.store_id ||
              ''

        if (!finalStoreId) {
          throw new Error('Το link είναι άκυρο ή έληξε ή έχει ήδη χρησιμοποιηθεί.')
        }
      }

      // 3. ΕΛΕΓΧΟΣ EMAIL CONFIRMATION
      const requiresEmailConfirmation = authData.session === null

      if (requiresEmailConfirmation) {
        setEmailConfirmationPending(true)
        toast.success(
          isInviteRegistration
            ? 'Η εγγραφή έγινε! Επιβεβαιώστε πρώτα το email σας και μετά συνδεθείτε για να ολοκληρωθεί η αποδοχή πρόσκλησης.'
            : 'Η εγγραφή έγινε! Παρακαλώ ελέγξτε το email σας για να ενεργοποιήσετε το λογαριασμό σας.'
        )
        return
      }

      // 4. ΟΛΟΚΛΗΡΩΣΗ & REDIRECT
      toast.success('Η εγγραφή ολοκληρώθηκε!')

      if (isInviteRegistration && finalStoreId) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('active_store_id', finalStoreId)
        }
        router.replace(`/?store=${finalStoreId}`)
        router.refresh()
        return
      }
      
      // Αποθηκεύουμε το active store για να ξέρει το dashboard τι να δείξει
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_store_id', finalStoreId)
      }

      // Ανακατεύθυνση στο Dashboard
      router.push(`/?store=${finalStoreId}`)
      router.refresh()

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Σφάλμα κατά την εγγραφή')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <Toaster richColors position="top-center" />
      <div style={headerStyle}>
        <h1 style={brandStyle}>COSY APP</h1>
        <div style={dividerStyle} />
        <p style={instructionStyle}>
          {isInviteRegistration ? 'ΕΓΓΡΑΦΗ ΓΙΑ ΠΡΟΣΚΛΗΣΗ' : 'ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ'}
        </p>
      </div>
      
      {emailConfirmationPending ? (
        <div style={confirmationWrapStyle}>
          <div style={confirmationIconWrapStyle}>
            <Mail size={26} color="#0f172a" strokeWidth={2.2} />
          </div>
          <p style={confirmationTextStyle}>
            Η εγγραφή ολοκληρώθηκε. Επιβεβαιώστε το email σας και μετά συνδεθείτε για να συνεχιστεί η πρόσκληση.
          </p>
          <button
            type="button"
            onClick={handleResendConfirmationEmail}
            disabled={resendLoading}
            style={{ ...resendBtnStyle, opacity: resendLoading ? 0.7 : 1 }}
          >
            {resendLoading ? 'ΓΙΝΕΤΑΙ ΑΠΟΣΤΟΛΗ...' : 'ΕΠΑΝΑΠΟΣΤΟΛΗ EMAIL'}
          </button>
          <Link href={loginHref} style={confirmLoginBtnStyle}>ΜΕΤΑΒΑΣΗ ΣΤΟ LOGIN</Link>
        </div>
      ) : (
        <form onSubmit={handleSignUp} style={formStyle}>
          <div>
            <label style={labelStyle}>ΟΝΟΜΑ ΧΡΗΣΤΗ</label>
            <input 
              id="register-username"
              type="text" 
              name="username"
              autoComplete="username"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              style={inputStyle} 
              placeholder="π.χ. Γιάννης" 
            />
          </div>

          <div>
            <label style={labelStyle}>EMAIL</label>
            <input 
              id="register-email"
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

          <div>
            <label style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>
            <input 
              id="register-password"
              type="password" 
              name="password"
              autoComplete="new-password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={inputStyle} 
              placeholder="6+ χαρακτήρες" 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{...submitBtnStyle, backgroundColor: loading ? '#94a3b8' : '#0f172a'}}
          >
            {loading ? 'ΓΙΝΕΤΑΙ ΕΓΓΡΑΦΗ...' : (isInviteRegistration ? 'ΣΥΝΕΧΕΙΑ ΠΡΟΣΚΛΗΣΗΣ' : 'ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ')}
          </button>
        </form>
      )}

      <div style={footerStyle}>
        <Link href={loginHref} style={linkStyle}>← ΕΧΩ ΗΔΗ ΛΟΓΑΡΙΑΣΜΟ</Link>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <main style={containerStyle}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

// --- STYLES ---
const containerStyle: any = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' };
const cardStyle: any = { backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const headerStyle: any = { textAlign: 'center', marginBottom: '30px' };
const brandStyle: any = { fontSize: '26px', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px', margin: 0 };
const dividerStyle: any = { height: '4px', width: '40px', backgroundColor: '#6366f1', margin: '12px auto', borderRadius: '10px' };
const instructionStyle: any = { fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 };
const formStyle: any = { display: 'flex', flexDirection: 'column', gap: '20px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' };
const submitBtnStyle: any = { color: '#ffffff', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '15px' };
const confirmationWrapStyle: any = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', textAlign: 'center' };
const confirmationIconWrapStyle: any = { width: '52px', height: '52px', margin: '0 auto 10px auto', borderRadius: '999px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const confirmationTextStyle: any = { margin: '0 0 14px 0', color: '#334155', fontSize: '14px', lineHeight: '1.5' };
const resendBtnStyle: any = { display: 'block', width: '100%', margin: '0 0 10px 0', color: '#0f172a', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '13px', cursor: 'pointer' };
const confirmLoginBtnStyle: any = { display: 'inline-block', color: '#ffffff', backgroundColor: '#0f172a', padding: '12px 16px', borderRadius: '12px', textDecoration: 'none', fontWeight: '800', fontSize: '13px' };
const footerStyle: any = { marginTop: '25px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #f1f5f9' };
const linkStyle: any = { color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '12px' };