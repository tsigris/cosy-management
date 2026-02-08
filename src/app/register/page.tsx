'use client'
import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function RegisterForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. Πιάνουμε τις παραμέτρους από το Link Πρόσκλησης
  const inviteCode = searchParams.get('invite') // Το ID του καταστήματος (του Admin)
  const requestedRole = searchParams.get('role') // Ο ρόλος (admin ή user)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || password.length < 6) return alert('Ο κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.')
    setLoading(true)

    // DEBUG: Ελέγχουμε τι "βλέπει" ο κώδικας πριν την εγγραφή
    console.log("Registering with:", { inviteCode, requestedRole })
    
    // 2. Εγγραφή στο Auth του Supabase
    const { data, error } = await supabase.auth.signUp({ 
      email: email.trim(), 
      password: password.trim()
    })
    
    if (error) {
      alert('Σφάλμα Auth: ' + error.message)
    } else if (data.user) {
      
      // 3. Λογική Καθορισμού Ρόλου & Καταστήματος
      const isNewOwner = !inviteCode
      
      // Αν υπάρχει inviteCode, παίρνει τον ζητούμενο ρόλο, αλλιώς Admin
      const finalRole = isNewOwner ? 'admin' : (requestedRole || 'user')
      
      // Αν υπάρχει inviteCode, το store_id είναι ΤΟΥ ADMIN. Αλλιώς του νέου χρήστη.
      const finalStoreId = isNewOwner ? data.user.id : inviteCode
      
      // Δικαιώματα
      const hasFullAccess = finalRole === 'admin'

      // 4. Αποθήκευση Προφίλ (Χρησιμοποιούμε UPSERT για ασφάλεια)
      const { error: profileError } = await supabase.from('profiles').upsert([{
        id: data.user.id,
        email: email.trim(),
        username: email.split('@')[0],
        role: finalRole,
        store_id: finalStoreId, // Εδώ γίνεται η σύνδεση με εσένα
        can_view_analysis: hasFullAccess,
        can_view_history: hasFullAccess,
        can_edit_transactions: hasFullAccess
      }])

      if (!profileError) {
        // Επιτυχία!
        alert(`Επιτυχής εγγραφή! \nΡόλος: ${finalRole === 'admin' ? 'Διαχειριστής' : 'Υπάλληλος'}`)
        router.push('/login')
      } else {
        console.error("Profile Error:", profileError)
        alert('Σφάλμα κατά την αποθήκευση του προφίλ: ' + profileError.message)
      }
    }
    setLoading(false)
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h1 style={brandStyle}>COSY APP</h1>
        <div style={dividerStyle} />
        
        {/* Οπτική Επιβεβαίωση για τον χρήστη */}
        <div style={instructionStyle}>
          {inviteCode 
            ? <span style={{color: '#059669', fontWeight: 'bold'}}>✨ Πρόσκληση αποδεκτή! <br/>Εγγραφή ως {requestedRole === 'admin' ? 'Διαχειριστής' : 'Υπάλληλος'}</span>
            : 'Δημιουργία Νέου Λογαριασμού'}
        </div>
      </div>
      
      <form onSubmit={handleSignUp} style={formStyle}>
        <div style={fieldGroup}>
          <label style={labelStyle}>EMAIL ΕΡΓΑΣΙΑΣ</label>
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
        <button type="submit" disabled={loading} style={{...submitBtnStyle, backgroundColor: requestedRole === 'admin' ? '#f97316' : '#10b981'}}>
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
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <RegisterForm />
      </Suspense>
    </main>
  )
}

// STYLES
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px' };
const cardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '48px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '5px solid #10b981' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' };
const brandStyle = { fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '0 0 12px 0', letterSpacing: '1px' };
const dividerStyle = { height: '2px', width: '40px', backgroundColor: '#e2e8f0', margin: '0 auto 16px auto' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '500', lineHeight: '1.5' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '24px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '8px' };
const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' as const };
const inputStyle = { padding: '12px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '15px' };
const submitBtnStyle = { color: '#ffffff', padding: '14px', borderRadius: '4px', border: 'none', fontWeight: '700', cursor: 'pointer' };
const footerStyle = { marginTop: '40px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const linkStyle = { color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '13px' };