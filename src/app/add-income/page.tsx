'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b', // Slate 800
  secondaryText: '#64748b', // Slate 500
  accentGreen: '#059669', // Emerald 600
  bgLight: '#f8fafc',     // Slate 50
  border: '#e2e8f0',      // Slate 200
  white: '#ffffff'
};

function AddIncomeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 1. ΥΠΟΛΟΓΙΣΜΟΣ ΗΜΕΡΟΜΗΝΙΑΣ (07:00 Logic - Τοπική Ώρα)
  const getBusinessDate = () => {
    const now = new Date()
    if (now.getHours() < 7) {
      now.setDate(now.getDate() - 1)
    }
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const selectedDate = searchParams.get('date') || getBusinessDate()
  
  // Form State
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [incomeType, setIncomeType] = useState('Είσπραξη')
  const [loading, setLoading] = useState(true)
  const [currentUsername, setCurrentUsername] = useState('Χρήστης')

  // 2. ΦΟΡΤΩΣΗ ΧΡΗΣΤΗ (Με Wake-up προστασία)
  const refreshSessionAndUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', session.user.id).maybeSingle()
      if (profile?.username) setCurrentUsername(profile.username)
    } catch (error) {
      console.error('Session refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSessionAndUser()

    const handleWakeUp = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionAndUser()
      }
    }

    document.addEventListener('visibilitychange', handleWakeUp)
    window.addEventListener('focus', handleWakeUp)

    return () => {
      document.removeEventListener('visibilitychange', handleWakeUp)
      window.removeEventListener('focus', handleWakeUp)
    }
  }, [refreshSessionAndUser])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !amount) return
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).maybeSingle()

      if (!profile?.store_id) throw new Error('Δεν βρέθηκε κατάστημα')

      const { error } = await supabase.from('transactions').insert([{
        amount: parseFloat(amount),
        type: 'income',
        category: incomeType === 'Είσπραξη' ? 'income' : 'other_income',
        method: method,
        notes: incomeType !== 'Είσπραξη' ? `[${incomeType.toUpperCase()}] ${notes}` : notes,
        date: selectedDate,
        store_id: profile.store_id,
        created_by_name: currentUsername
      }])

      if (error) throw error
      router.push(`/?date=${selectedDate}`)
      router.refresh()
    } catch (err: any) {
      alert('Σφάλμα: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh', padding: '16px' }}>
      <div style={formCardStyle}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>💰</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '20px', margin: 0, color: colors.primaryDark }}>Νέο Έσοδο</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.accentGreen, fontWeight: '700', letterSpacing: '0.5px' }}>
                {new Date(selectedDate).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }).toUpperCase()}
              </p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <div style={userIndicator}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText }}>👤 ΚΑΤΑΧΩΡΗΣΗ: {currentUsername.toUpperCase()}</span>
        </div>

        <form onSubmit={handleSubmit}>
          
          <label style={labelStyle}>ΤΥΠΟΣ ΕΣΟΔΟΥ</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {['Είσπραξη', 'Από Πελάτη', 'Επιστροφή', 'Κεφάλαιο'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setIncomeType(t)}
                style={{
                  ...typeBtnStyle,
                  backgroundColor: incomeType === t ? colors.accentGreen : colors.white,
                  color: incomeType === t ? colors.white : colors.secondaryText,
                  border: incomeType === t ? 'none' : `1px solid ${colors.border}`
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ flex: 1.5 }}>
              <label style={labelStyle}>ΠΟΣΟ (€)</label>
              <input 
                type="number" 
                inputMode="decimal"
                step="0.01" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                style={amountInput} 
                placeholder="0.00"
                autoFocus 
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>ΤΡΟΠΟΣ</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
                <option value="Μετρητά">Μετρητά</option>
                <option value="Κάρτα">Κάρτα</option>
                <option value="Τράπεζα">Τράπεζα</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΑΙΤΙΟΛΟΓΙΑ</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              style={{ ...inputStyle, height: '70px', paddingTop: '12px', fontWeight: '500' }} 
              placeholder="Περιγραφή εσόδου..." 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              ...submitBtn, 
              backgroundColor: loading ? colors.secondaryText : colors.accentGreen,
              boxShadow: loading ? 'none' : '0 4px 12px rgba(5, 150, 105, 0.2)'
            }}
          >
            {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΙΣΠΡΑΞΗΣ'}
          </button>
        </form>
      </div>
    </main>
  )
}

// --- STYLES ---
const formCardStyle = { maxWidth: '500px', margin: '0 auto', backgroundColor: colors.white, borderRadius: '24px', padding: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dcfce7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight, borderRadius: '10px', border: `1px solid ${colors.border}` };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box' as const, outline: 'none', color: colors.primaryDark };
const amountInput: any = { ...inputStyle, fontSize: '22px', color: colors.accentGreen };
const userIndicator = { marginBottom: '20px', padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '10px', textAlign: 'center' as any, border: '1px solid #dcfce7' };
const typeBtnStyle: any = { padding: '10px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' };
const submitBtn: any = { width: '100%', padding: '18px', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };

export default function AddIncomePage() {
  return <Suspense fallback={<div style={{padding:'40px', textAlign:'center', color: colors.secondaryText, fontWeight: '600'}}>Φόρτωση φόρμας...</div>}><AddIncomeForm /></Suspense>
}