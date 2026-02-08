'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AddIncomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [incomeType, setIncomeType] = useState('Είσπραξη') // Νέο state για τον τύπο εσόδου
  const [loading, setLoading] = useState(false)
  const [currentUsername, setCurrentUsername] = useState('Admin')

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single()
        if (data?.username) setCurrentUsername(data.username)
      }
    }
    fetchUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !amount) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user?.id).single()

      const { error } = await supabase.from('transactions').insert([{
        amount: parseFloat(amount),
        type: 'income',
        category: incomeType === 'Είσπραξη' ? 'income' : 'other_income',
        method: method,
        notes: incomeType !== 'Είσπραξη' ? `[${incomeType.toUpperCase()}] ${notes}` : notes,
        date: dateParam,
        store_id: profile?.store_id,
        created_by_name: currentUsername
      }])

      if (error) throw error
      router.push(`/?date=${dateParam}`)
    } catch (err: any) {
      alert('Σφάλμα: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={formCardStyle}>
        
        {/* ΕΠΑΓΓΕΛΜΑΤΙΚΟ ΓΡΑΦΙΚΟ HEADER (ΠΡΑΣΙΝΟ) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>
              <span style={{ fontSize: '20px' }}>💰</span>
            </div>
            <div>
              <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
                Νέο Έσοδο
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#16a34a', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ΕΝΙΣΧΥΣΗ ΤΑΜΕΙΟΥ
              </p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        {/* USER INDICATOR */}
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '12px', textAlign: 'center', border: '1px solid #bbf7d0' }}>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#166534' }}>👤 ΚΑΤΑΧΩΡΗΣΗ ΑΠΟ: {currentUsername.toUpperCase()}</span>
        </div>

        <form onSubmit={handleSubmit}>
          
          <label style={labelStyle}>ΤΥΠΟΣ ΕΣΟΔΟΥ</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {['Είσπραξη', 'Από Πελάτη', 'Επιστροφή', 'Κεφάλαιο'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setIncomeType(t)}
                style={{
                  ...typeBtnStyle,
                  backgroundColor: incomeType === t ? '#16a34a' : '#f1f5f9',
                  color: incomeType === t ? 'white' : '#64748b',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1.5 }}>
              <label style={labelStyle}>ΠΟΣΟ (€)</label>
              <input 
                type="number" 
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
              style={{ ...inputStyle, height: '60px', paddingTop: '10px' }} 
              placeholder="π.χ. Προκαταβολή για παραγγελία..." 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              ...submitBtn, 
              backgroundColor: loading ? '#94a3b8' : '#16a34a',
            }}
          >
            {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΕΙΣΠΡΑΞΗΣ'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function AddIncomePage() {
  return (
    <Suspense fallback={<div style={{padding: '20px', textAlign: 'center'}}>Φόρτωση...</div>}>
      <AddIncomeContent />
    </Suspense>
  )
}

// ΣΤΥΛ (Εναρμονισμένα με το νέο design)
const formCardStyle: any = { maxWidth: '500px', margin: '0 auto', backgroundColor: 'white', borderRadius: '28px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.02)' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dcfce7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '10px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const, outline: 'none' };
const amountInput: any = { ...inputStyle, fontSize: '20px', color: '#16a34a' };
const typeBtnStyle: any = { padding: '10px 15px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' };
const submitBtn: any = { width: '100%', padding: '18px', border: 'none', borderRadius: '16px', color: 'white', fontWeight: '900', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };