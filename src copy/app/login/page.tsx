'use client'

// 1. ΕΞΑΣΦΑΛΙΣΗ ΔΥΝΑΜΙΚΗΣ ΛΕΙΤΟΥΡΓΙΑΣ ΓΙΑ ΤΟ BUILD
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 2. ΤΟ ΕΣΩΤΕΡΙΚΟ COMPONENT ΜΕ ΟΛΗ ΤΗ ΛΟΓΙΚΗ
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') // 'fast' για PIN/Biometrics

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enteredPin, setEnteredPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFastMode, setIsFastMode] = useState(mode === 'fast')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('Παρακαλώ συμπληρώστε τα στοιχεία σας.')
    setLoading(true)
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password: password.trim() 
    })
    
    if (error) {
      alert('Σφάλμα: ' + error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
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
    const savedPin = localStorage.getItem('fleet_track_pin')
    if (pin === savedPin) {
      router.push('/')
      router.refresh()
    } else {
      alert('Λάθος PIN')
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
                backgroundColor: enteredPin.length >= i ? '#1e40af' : '#e2e8f0' 
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
            Είσοδος με κωδικό πρόσβασης →
          </button>
        </div>
      </main>
    )
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
          <Link href="/register" style={footerLinkStyle}>ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ →</Link>
        </div>
      </div>
    </main>
  )
}

// 3. ΤΟ ΚΕΝΤΡΙΚΟ EXPORT ΠΟΥ ΠΕΡΙΒΑΛΛΕΙ ΜΕ SUSPENSE
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={containerStyle}>Φόρτωση...</div>}>
      <LoginContent />
    </Suspense>
  )
}

// --- STYLES (Πλήρη) ---
const containerStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', padding: '20px' };
const loginCardStyle = { backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderTop: '5px solid #1e40af', textAlign: 'center' as const };
const headerStyle = { marginBottom: '30px' };
const brandStyle = { fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0' };
const dividerStyle = { height: '2px', width: '30px', backgroundColor: '#e2e8f0', margin: '0 auto 15px auto' };
const instructionStyle = { fontSize: '14px', color: '#64748b', fontWeight: '600' };
const formStyle = { display: 'flex', flexDirection: 'column' as const, gap: '20px', textAlign: 'left' as const };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const, gap: '6px' };
const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#475569', letterSpacing: '0.5px' };
const inputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none' };
const submitBtnStyle = { backgroundColor: '#1e40af', color: '#ffffff', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer', marginTop: '10px' };
const footerStyle = { marginTop: '30px', textAlign: 'center' as const, borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const footerLinkStyle = { color: '#1e40af', fontWeight: '700', textDecoration: 'none', fontSize: '14px' };
const dotsContainer = { display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' };
const dotStyle = { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid #e2e8f0', transition: 'all 0.2s' };
const numpadGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', width: '100%', maxWidth: '280px', margin: '0 auto' };
const numBtnStyle = { padding: '20px', fontSize: '22px', fontWeight: '800', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', color: '#1e293b' };