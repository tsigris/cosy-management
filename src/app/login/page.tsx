'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('Παρακαλώ συμπληρώστε τα στοιχεία σας.')
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password: password.trim() 
    })
    
    if (error) alert('Σφάλμα: ' + error.message)
    else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <main style={containerStyle}>
      <div style={loginCardStyle}>
        <div style={headerStyle}>
          <h1 style={brandStyle}>COSY APP</h1>
          <div style={dividerStyle} />
          <p style={instructionStyle}>Είσοδος στο Σύστημα</p>
        </div>
        
        <form onSubmit={handleLogin} style={formStyle}>
          <div style={fieldGroup}>
            <label style={labelStyle}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="email@example.com" />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>ΚΩΔΙΚΟΣ ΠΡΟΣΒΑΣΗΣ</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? 'ΤΑΥΤΟΠΟΙΗΣΗ...' : 'ΕΙΣΟΔΟΣ'}
          </button>
        </form>

        <div style={footerStyle}>
          <p style={{fontSize:'13px', color:'#64748b', marginBottom:'10px'}}>Δεν έχετε λογαριασμό;</p>
          <Link href="/register" style={{color:'#1e40af', fontWeight:'700', textDecoration:'none', fontSize:'14px'}}>ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ →</Link>
        </div>
      </div>
    </main>
  )
}

// STYLES (Όπως τα συμφωνήσαμε πριν)
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px' };
const loginCardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderTop: '5px solid #1e40af' };
const headerStyle = { textAlign: 'center' as const, marginBottom: '30px' };
const brandStyle = { fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0' };
const dividerStyle = { height: '2px', width: '30px', backgroundColor: '#e2e8f0', margin: '0 auto 15px auto' };
const instructionStyle = { fontSize: '14px', color: '#64748b' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#475569' };
const inputStyle = { padding: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '15px' };
const submitBtnStyle = { backgroundColor: '#1e40af', color: '#ffffff', padding: '14px', borderRadius: '4px', border: 'none', fontWeight: '700', cursor: 'pointer' };
const footerStyle = { marginTop: '30px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };