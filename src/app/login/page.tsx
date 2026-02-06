'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('Συμπληρώστε email και κωδικό')
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password: password.trim() 
    })
    
    if (error) alert('Σφάλμα Εισόδου: ' + error.message)
    else router.push('/')
    setLoading(false)
  }

  const handleSignUp = async () => {
    if (!email || !password || password.length < 6) {
      return alert('Βάλτε έγκυρο email και κωδικό τουλάχιστον 6 χαρακτήρων')
    }
    setLoading(true)
    
    const { data, error } = await supabase.auth.signUp({ 
      email: email.trim(), 
      password: password.trim()
    })
    
    if (error) {
      alert('Σφάλμα Εγγραφής: ' + error.message)
    } else if (data.user) {
      alert('Ο λογαριασμός δημιουργήθηκε! Κάντε τώρα Είσοδο.')
    }
    setLoading(false)
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', fontWeight: '900', marginBottom: '30px', color: '#0f172a' }}>Cosy Login</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            style={inputStyle} 
          />
          <input 
            type="password" 
            placeholder="Κωδικός" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            style={inputStyle} 
          />
          
          <button onClick={handleLogin} disabled={loading} style={mainBtn}>
            {loading ? 'ΠΑΡΑΚΑΛΩ ΠΕΡΙΜΕΝΕΤΕ...' : 'ΕΙΣΟΔΟΣ'}
          </button>
          
          <button onClick={handleSignUp} disabled={loading} style={secBtn}>
            ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ
          </button>
        </div>
      </div>
    </main>
  )
}

const inputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none' };
const mainBtn = { backgroundColor: '#2563eb', color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer' };
const secBtn = { backgroundColor: 'transparent', color: '#64748b', padding: '10px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' as const };