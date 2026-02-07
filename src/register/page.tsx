'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || password.length < 6) return alert('Ο κωδικός πρέπει να είναι τουλάχιστον 6 χαρακτήρες.')
    setLoading(true)
    
    const { data, error } = await supabase.auth.signUp({ 
      email: email.trim(), 
      password: password.trim()
    })
    
    if (error) {
      alert('Σφάλμα: ' + error.message)
    } else if (data.user) {
      alert('Επιτυχής εγγραφή! Τώρα μπορείτε να συνδεθείτε.')
      router.push('/login')
    }
    setLoading(false)
  }

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h1 style={brandStyle}>COSY APP</h1>
          <div style={dividerStyle} />
          <p style={instructionStyle}>Δημιουργία Νέου Λογαριασμού</p>
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
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? 'ΔΗΜΙΟΥΡΓΙΑ...' : 'ΕΓΓΡΑΦΗ'}
          </button>
        </form>

        <div style={footerStyle}>
          <Link href="/login" style={linkStyle}>← ΕΠΙΣΤΡΟΦΗ ΣΤΗ ΣΥΝΔΕΣΗ</Link>
        </div>
      </div>
    </main>
  )
}

// ΕΠΑΓΓΕΛΜΑΤΙΚΑ STYLES (ΣΥΜΒΑΤΑ ΜΕ ΤΟ LOGIN)
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px' };
const cardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '48px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '5px solid #10b981' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '32px' };
const brandStyle = { fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '0 0 12px 0', letterSpacing: '1px' };
const dividerStyle = { height: '2px', width: '40px', backgroundColor: '#e2e8f0', margin: '0 auto 16px auto' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '500' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '24px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '8px' };
const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' as const };
const inputStyle = { padding: '12px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '15px' };
const submitBtnStyle = { backgroundColor: '#10b981', color: '#ffffff', padding: '14px', borderRadius: '4px', border: 'none', fontWeight: '700', cursor: 'pointer' };
const footerStyle = { marginTop: '40px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const linkStyle = { color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '13px' };