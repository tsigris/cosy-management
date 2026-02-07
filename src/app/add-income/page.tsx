'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 1. Το Component με την πλήρη λειτουργία της φόρμας
function IncomeFormFields() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Παίρνει την ημερομηνία από το URL ή βάζει τη σημερινή
  const dateFromUrl = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [date, setDate] = useState(dateFromUrl)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return alert('Παρακαλώ βάλτε έγκυρο ποσό')
    
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([
      { 
        amount: parseFloat(amount), 
        method, 
        type: 'income', 
        date_recorded: date,
        notes 
      }
    ])
    
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      setLoading(false)
      alert('Σφάλμα: ' + error.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '25px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΠΡΑΞΗΣ</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input 
            type="number" 
            step="0.01" 
            inputMode="decimal"
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
            style={{ ...inputStyle, fontSize: '20px', fontWeight: '900' }}
          />
        </div>

        <div>
          <label style={labelStyle}>ΤΡΟΠΟΣ ΕΙΣΠΡΑΞΗΣ</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['Μετρητά', 'Κάρτα', 'Τράπεζα'].map(m => (
              <button 
                key={m} 
                type="button"
                onClick={() => setMethod(m)}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  borderRadius: '12px', 
                  border: method === m ? '2px solid #16a34a' : '1px solid #e2e8f0', 
                  backgroundColor: method === m ? '#f0fdf4' : 'white', 
                  color: method === m ? '#16a34a' : '#64748b', 
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {m === 'Κάρτα' ? '💳 ΚΑΡΤΑ' : m === 'Τράπεζα' ? '🏦 ΤΡΑΠΕΖΑ' : '💰 ΜΕΤΡΗΤΑ'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ (ΠΡΟΑΙΡΕΤΙΚΑ)</label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Περιγραφή εσόδου..."
            style={{ ...inputStyle, height: '80px', resize: 'none' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={saveBtnStyle}
        >
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΣΟΔΟΥ'}
        </button>
      </form>
    </div>
  )
}

// 2. Η κύρια σελίδα με το Suspense Boundary
export default function AddIncomePage() {
  const router = useRouter()
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '450px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}>←</button>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111827', margin: 0 }}>Νέο Έσοδο</h1>
        </div>
        
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>Φόρτωση φόρμας...</div>}>
          <IncomeFormFields />
        </Suspense>
      </div>
    </main>
  )
}

const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none', backgroundColor: 'white' };
const saveBtnStyle = { backgroundColor: '#16a34a', color: 'white', padding: '18px', borderRadius: '15px', border: 'none', fontSize: '16px', fontWeight: 'bold' as const, marginTop: '10px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)' };