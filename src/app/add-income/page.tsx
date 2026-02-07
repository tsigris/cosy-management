'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function AddIncomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return alert('Παρακαλώ συμπληρώστε το ποσό')
    
    setLoading(true)

    try {
      // Περιμένουμε την ολοκλήρωση της εγγραφής στη Supabase
      const { error } = await supabase.from('transactions').insert([{
        amount: parseFloat(amount),
        type: 'income',
        method,
        notes: notes.trim(),
        date: dateParam
      }])

      if (error) throw error

      // Αν όλα πήγαν καλά, επιστρέφουμε στην αρχική
      router.push(`/?date=${dateParam}`)
      router.refresh()

    } catch (err: any) {
      // Αν κοπεί η σύνδεση ή υπάρξει σφάλμα, το εμφανίζουμε εδώ
      alert('Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με τη βάση'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => router.back()} style={backBtn}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>Νέο Έσοδο</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div>
          <label style={labelStyle}>ΠΟΣΟ ΕΙΣΠΡΑΞΗΣ (€)</label>
          <input 
            type="number" 
            step="0.01" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            style={amountInput} 
            placeholder="0.00"
            autoFocus 
          />
        </div>

        <div>
          <label style={labelStyle}>ΤΡΟΠΟΣ</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
            <option value="Μετρητά">Μετρητά</option>
            <option value="Κάρτα">Κάρτα</option>
            <option value="Τράπεζα">Τράπεζα</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <input 
            type="text" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            style={inputStyle} 
            placeholder="π.χ. Πρωινά είδη..." 
          />
        </div>

        <button type="submit" disabled={loading} style={submitBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΣΟΔΟΥ'}
        </button>
      </form>
    </div>
  )
}

export default function AddIncomePage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <AddIncomeContent />
    </Suspense>
  )
}

// STYLES
const backBtn = { border: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer' };
const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' as const };
const amountInput = { ...inputStyle, fontWeight: '700', fontSize: '20px' };
const submitBtn = { padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#16a34a', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };