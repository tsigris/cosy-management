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

  // 1. ΔΙΑΒΑΣΜΑ ΠΑΡΑΜΕΤΡΩΝ
  const inviteCode = searchParams.get('invite') 
  const requestedRole = searchParams.get('role') // 'admin' ή 'user'

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || password.length < 6) {
      alert('Συμπληρώστε το email και έναν κωδικό τουλάχιστον 6 χαρακτήρων.')
      return
    }

    setLoading(true)

    try {
      // 2. ΕΓΓΡΑΦΗ ΣΤΟ SUPABASE AUTH
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      })

      if (authError) throw authError

      if (authData.user) {
        // 3. ΥΠΟΛΟΓΙΣΜΟΣ ΣΤΟΙΧΕΙΩΝ
        // Αν έχεις invite, μπαίνεις στο μαγαζί του άλλου. Αν όχι, φτιάχνεις δικό σου.
        const targetStoreId = inviteCode ? inviteCode : authData.user.id
        const targetRole = inviteCode ? (requestedRole || 'user') : 'admin'
        
        // Ο admin έχει πρόσβαση παντού
        const hasFullAccess = targetRole === 'admin'

        // 4. ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΦΙΛ (PROFILES)
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
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

        if (profileError) throw profileError

        // ---[ Η ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΕΔΩ ]---
        
        // 4.5. ΔΗΜΙΟΥΡΓΙΑ ΒΑΣΙΚΩΝ ΠΑΓΙΩΝ
        // Το εκτελούμε ΜΟΝΟ αν ΔΕΝ υπάρχει inviteCode (δηλαδή είναι νέο κατάστημα/Admin).
        // Οι υπάλληλοι (inviteCode exists) δεν επιτρέπεται να φτιάξουν πάγια, γι' αυτό το προσπερνούν.
        if (!inviteCode) {
            const defaultAssets = [
                { name: 'Ενοίκιο', type: 'expense', store_id: targetStoreId },
                { name: 'Ρεύμα', type: 'expense', store_id: targetStoreId },
                { name: 'Τηλεφωνία/Internet', type: 'expense', store_id: targetStoreId },
                { name: 'Νερό', type: 'expense', store_id: targetStoreId },
                { name: 'Μισθοδοσία', type: 'expense', store_id: targetStoreId },
            ]

            const { error: assetError } = await supabase
                .from('fixed_assets')
                .insert(defaultAssets)
            
            // Δεν κάνουμε throw error εδώ, για να μην κολλήσει η εγγραφή αν κάτι πάει στραβά στα πάγια
            if (assetError) console.error('Error creating default assets:', assetError)
        }

        // 5. ΕΠΙΤΥΧΙΑ
        alert(`Η εγγραφή ολοκληρώθηκε επιτυχώς!\nΡόλος: ${targetRole === 'admin' ? 'Διαχειριστής' : 'Υπάλληλος'}`)
        
        router.push('/') 
        router.refresh()
      }
    } catch (error: any) {
      console.error('Registration Error:', error)
      alert('Σφάλμα κατά την εγγραφή: ' + (error.message || error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h1 style={brandStyle}>COSY APP</h1>
        <div style={dividerStyle} />
        
        <div style={instructionStyle}>
          {inviteCode ? (
            <div style={inviteBox}>
              <span style={{fontSize: '18px'}}>📩</span>
              <div>
                <span style={{display: 'block', fontWeight: 'bold', color: '#059669'}}>
                  Πρόσκληση Αποδεκτή!
                </span>
                <span style={{fontSize: '12px'}}>
                  Εγγραφή ως <b>{requestedRole === 'admin' ? 'ΔΙΑΧΕΙΡΙΣΤΗΣ' : 'ΥΠΑΛΛΗΛΟΣ'}</b>
                </span>
              </div>
            </div>
          ) : (
            'Δημιουργία Νέου Λογαριασμού'
          )}
        </div>
      </div>
      
      <form onSubmit={handleSignUp} style={formStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle}>ΟΝΟΜΑ ΧΡΗΣΤΗ (Προαιρετικό)</label>
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
          style={{
            ...submitBtnStyle, 
            backgroundColor: inviteCode ? (requestedRole === 'admin' ? '#f97316' : '#10b981') : '#3b82f6'
          }}
        >
          {loading ? 'ΔΗΜΙΟΥΡΓΙΑ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΓΓΡΑΦΗΣ'}
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
      <Suspense fallback={<div style={{textAlign:'center', marginTop:'50px'}}>Φόρτωση φόρμας...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

// --- STYLES ---
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'sans-serif', padding: '20px' };
const cardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' };
const brandStyle = { fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0', letterSpacing: '-0.5px' };
const dividerStyle = { height: '3px', width: '40px', backgroundColor: '#cbd5e1', margin: '0 auto 20px auto', borderRadius: '2px' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '500', minHeight: '40px' };
const inviteBox = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0', color: '#065f46' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const inputStyle = { padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' };
const submitBtnStyle = { color: '#ffffff', padding: '14px', borderRadius: '10px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '15px', marginTop: '10px', transition: 'opacity 0.2s' };
const footerStyle = { marginTop: '30px', textAlign: 'center' as const, paddingTop: '20px', borderTop: '1px solid #f1f5f9' };
const linkStyle = { color: '#64748b', fontWeight: '600', textDecoration: 'none', fontSize: '13px' };