'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const inviteCode = searchParams.get('invite') 
  const requestedRole = searchParams.get('role')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || password.length < 6) {
      alert('Συμπληρώστε το email και έναν κωδικό τουλάχιστον 6 χαρακτήρων.')
      return
    }

    setLoading(true)

    try {
      // 1. ΕΓΓΡΑΦΗ ΣΤΟ AUTH ΜΕ METADATA (Για να τα διαβάζει ο SQL Trigger)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            username: username || email.split('@')[0],
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // 2. ΥΠΟΛΟΓΙΣΜΟΣ ΣΤΟΙΧΕΙΩΝ
        const targetStoreId = inviteCode ? inviteCode : authData.user.id
        const targetRole = inviteCode ? (requestedRole || 'user') : 'admin'
        const hasFullAccess = targetRole === 'admin'

        // 3. ΔΗΜΙΟΥΡΓΙΑ/ΕΝΗΜΕΡΩΣΗ ΠΡΟΦΙΛ (PROFILES)
        // Χρησιμοποιούμε upsert για να μην κολλήσει αν ο Trigger πρόλαβε να φτιάξει το row
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: email.trim(),
            username: username || email.split('@')[0],
            role: targetRole,
            store_id: targetStoreId, 
            can_view_analysis: hasFullAccess,
            can_view_history: hasFullAccess,
            can_edit_transactions: hasFullAccess,
            subscription_status: 'active',
            subscription_expires_at: '2026-12-31',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

        if (profileError) throw profileError

        // 4. ΔΗΜΙΟΥΡΓΙΑ ΒΑΣΙΚΩΝ ΠΑΓΙΩΝ (Μόνο για νέους Admin)
        if (!inviteCode) {
            const defaultAssets = [
                { name: 'Ενοίκιο', store_id: targetStoreId },
                { name: 'ΔΕΗ / Ρεύμα', store_id: targetStoreId },
                { name: 'Λογιστής', store_id: targetStoreId },
                { name: 'Νερό / ΕΥΔΑΠ', store_id: targetStoreId },
                { name: 'Τηλεφωνία / Internet', store_id: targetStoreId }
            ]

            await supabase.from('fixed_assets').insert(defaultAssets)
        }

        alert('Η εγγραφή ολοκληρώθηκε επιτυχώς!')
        router.push('/') 
        router.refresh()
      }
    } catch (error: any) {
      console.error('Registration Error:', error)
      alert('Σφάλμα: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h1 style={brandStyle}>COSY APP</h1>
        <div style={dividerStyle} />
        <p style={instructionStyle}>
          {inviteCode ? 'Αποδοχή Πρόσκλησης Συνεργάτη' : 'Δημιουργία Νέου Λογαριασμού'}
        </p>
      </div>
      
      <form onSubmit={handleSignUp} style={formStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle}>ΟΝΟΜΑ ΧΡΗΣΤΗ</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            style={inputStyle} 
            placeholder="Π.χ. Γιώργος" 
          />
        </div>

        <div style={fieldGroup}>
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

        <div style={fieldGroup}>
          <label style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={inputStyle} 
            placeholder="Τουλάχιστον 6 χαρακτήρες" 
            required 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{...submitBtnStyle, backgroundColor: loading ? '#94a3b8' : '#3b82f6'}}
        >
          {loading ? 'ΠΑΡΑΚΑΛΩ ΠΕΡΙΜΕΝΕΤΕ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΓΓΡΑΦΗΣ'}
        </button>
      </form>

      <div style={footerStyle}>
        <Link href="/login" style={linkStyle}>← ΕΠΙΣΤΡΟΦΗ ΣΤΗ ΣΥΝΔΕΣΗ</Link>
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
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px' };
const cardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' };
const brandStyle = { fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: '0' };
const dividerStyle = { height: '3px', width: '30px', backgroundColor: '#3b82f6', margin: '10px auto 20px auto', borderRadius: '2px' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '600' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '18px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' };
const inputStyle = { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', backgroundColor: '#f8fafc' };
const submitBtnStyle = { color: '#ffffff', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '15px', marginTop: '10px' };
const footerStyle = { marginTop: '25px', textAlign: 'center' as const, paddingTop: '20px', borderTop: '1px solid #f1f5f9' };
const linkStyle = { color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '12px' };