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
    else {
      router.push('/')
      router.refresh()
    }
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
    if (error) alert('Σφάλμα Εγγραφής: ' + error.message)
    else if (data.user) alert('Ο λογαριασμός δημιουργήθηκε! Κάντε τώρα Είσοδο.')
    setLoading(false)
  }

  return (
    <main style={containerStyle}>
      <div style={glassCardStyle}>
        {/* ICON & TITLE */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={logoCircleStyle}>✨</div>
          <h1 style={titleStyle}>Cosy App</h1>
          <p style={subtitleStyle}>Καλώς ορίσατε στο ταμείο σας</p>
        </div>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={inputGroup}>
            <label style={labelStyle}>EMAIL</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              style={inputStyle} 
            />
          </div>
          
          <div style={inputGroup}>
            <label style={labelStyle}>ΚΩΔΙΚΟΣ</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={inputStyle} 
            />
          </div>
          
          <button type="submit" disabled={loading} style={mainBtn}>
            {loading ? 'ΓΙΝΕΤΑΙ ΣΥΝΔΕΣΗ...' : 'Είσοδος στο Σύστημα'}
          </button>
          
          <button type="button" onClick={handleSignUp} disabled={loading} style={secBtn}>
            Δεν έχετε λογαριασμό; <span style={{ color: '#2563eb' }}>Εγγραφή</span>
          </button>
        </form>
      </div>
    </main>
  )
}

// ΜΟΝΤΕΡΝΑ STYLES (PURE CSS)
const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  padding: '20px',
  fontFamily: 'sans-serif'
};

const glassCardStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  padding: '40px 30px',
  borderRadius: '32px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
  width: '100%',
  maxWidth: '420px',
  backdropFilter: 'blur(10px)',
  border: '1px solid white'
};

const logoCircleStyle = {
  width: '70px',
  height: '70px',
  backgroundColor: '#f1f5f9',
  borderRadius: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '32px',
  margin: '0 auto 15px auto',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
};

const titleStyle = { fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0' };
const subtitleStyle = { fontSize: '14px', color: '#64748b', marginTop: '8px', fontWeight: '500' };

const inputGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px', paddingLeft: '4px' };

const inputStyle = {
  padding: '16px',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  fontSize: '16px',
  outline: 'none',
  transition: 'border-color 0.2s',
  backgroundColor: '#fcfcfc'
};

const mainBtn = {
  backgroundColor: '#0f172a', // Σκούρο μπλε/μαύρο για πιο premium αίσθηση
  color: 'white',
  padding: '18px',
  borderRadius: '18px',
  border: 'none',
  fontWeight: 'bold' as const,
  fontSize: '16px',
  cursor: 'pointer',
  marginTop: '10px',
  boxShadow: '0 10px 20px rgba(15, 23, 42, 0.2)',
  transition: 'transform 0.1s'
};

const secBtn = {
  backgroundColor: 'transparent',
  color: '#64748b',
  padding: '10px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '600' as const,
  marginTop: '10px'
};