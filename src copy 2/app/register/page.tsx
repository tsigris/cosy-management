'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const inviteCode = searchParams.get('invite') 

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || password.length < 6) {
      toast.error('Email και κωδικός τουλάχιστον 6 χαρακτήρων.')
      return
    }

    setLoading(true)

    try {
      // 1. ΕΓΓΡΑΦΗ ΣΤΟ AUTH
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: { username: username || email.split('@')[0] }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        let finalStoreId = '';

        // 2. ΑΝ ΕΙΝΑΙ ΝΕΟΣ ADMIN (ΟΧΙ ΑΠΟ ΠΡΟΣΚΛΗΣΗ)
        if (!inviteCode) {
          // Δημιουργούμε το πρώτο του κατάστημα αυτόματα
          const { data: newStore, error: storeErr } = await supabase
            .from('stores')
            .insert([{ 
              name: `ΚΑΤΑΣΤΗΜΑ ${username || 'ΜΟΥ'}`, 
              owner_id: authData.user.id 
            }])
            .select()
            .single()

          if (storeErr) throw storeErr
          finalStoreId = newStore.id

          // Δίνουμε πρόσβαση (store_access)
          await supabase.from('store_access').insert([{
            user_id: authData.user.id,
            store_id: finalStoreId,
            role: 'admin'
          }])

          // Δημιουργία Βασικών Παγίων
          const defaultAssets = [
            { name: 'ΕΝΟΙΚΙΟ', store_id: finalStoreId },
            { name: 'ΛΟΓΙΣΤΗΣ', store_id: finalStoreId },
            { name: 'ΔΕΗ / ΡΕΥΜΑ', store_id: finalStoreId }
          ]
          await supabase.from('fixed_assets').insert(defaultAssets)

        } else {
          // ΑΝ ΕΙΝΑΙ ΑΠΟ ΠΡΟΣΚΛΗΣΗ
          finalStoreId = inviteCode
          await supabase.from('store_access').insert([{
            user_id: authData.user.id,
            store_id: finalStoreId,
            role: 'user'
          }])
        }

        toast.success('Η εγγραφή ολοκληρώθηκε!')
        
        // Αποθήκευση στο localStorage και ανακατεύθυνση
        localStorage.setItem('active_store_id', finalStoreId)
        router.push(`/?store=${finalStoreId}`)
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error.message)
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
          {inviteCode ? 'ΑΠΟΔΟΧΗ ΠΡΟΣΚΛΗΣΗΣ' : 'ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ'}
        </p>
      </div>
      
      <form onSubmit={handleSignUp} style={formStyle}>
        <div>
          <label style={labelStyle}>ΟΝΟΜΑ ΧΡΗΣΤΗ</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            style={inputStyle} 
            placeholder="π.χ. Γιάννης" 
          />
        </div>

        <div>
          <label style={labelStyle}>EMAIL</label>
          <input 
            type="email" 
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
            type="password" 
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
          {loading ? 'ΓΙΝΕΤΑΙ ΕΓΓΡΑΦΗ...' : 'ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ'}
        </button>
      </form>

      <div style={footerStyle}>
        <Link href="/login" style={linkStyle}>← ΕΧΩ ΗΔΗ ΛΟΓΑΡΙΑΣΜΟ</Link>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <main style={containerStyle}>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

// --- STYLES (Ευθυγραμμισμένα με το globals.css) ---
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' };
const cardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '30px' };
const brandStyle = { fontSize: '26px', fontWeight: '900', color: '#0f172a', letterSpacing: '-1px' };
const dividerStyle = { height: '4px', width: '40px', backgroundColor: '#6366f1', margin: '12px auto', borderRadius: '10px' };
const instructionStyle = { fontSize: '11px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '1px' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', display: 'block' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const };
const submitBtnStyle = { color: '#ffffff', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '15px' };
const footerStyle = { marginTop: '25px', textAlign: 'center' as const, paddingTop: '20px', borderTop: '1px solid #f1f5f9' };
const linkStyle = { color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '12px' };