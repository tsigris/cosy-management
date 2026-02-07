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
    
    // ΠΡΟΣΤΑΣΙΑ: Αν ήδη αποθηκεύει ή δεν έχει ποσό, σταμάτα
    if (loading || !amount) return
    
    setLoading(true)

    try {
      // 1. Εκτέλεση εγγραφής στη βάση
      const { error } = await supabase.from('transactions').insert([{
        amount: parseFloat(amount),
        type: 'income',
        method: method,
        notes: notes.trim(),
        date: dateParam
      }])

      if (error) throw error

      // 2. Μικρή καθυστέρηση (500ms) για να ολοκληρωθεί η σύνδεση πριν το redirect
      setTimeout(() => {
        router.push(`/?date=${dateParam}`)
        router.refresh()
      }, 500)

    } catch (err: any) {
      console.error('Submit error:', err)
      
      // Αν το σφάλμα είναι AbortError, δίνουμε πιο κατανοητό μήνυμα
      if (err.name === 'AbortError') {
        alert('Η σύνδεση διακόπηκε προσωρινά. Το αίτημα μπορεί να έχει ολοκληρωθεί, παρακαλώ ελέγξτε την αρχική σελίδα.')
      } else {
        alert('Σφάλμα: ' + (err.message || 'Αποτυχία σύνδεσης με τη βάση'))
      }
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
        
        <div style={fieldGroup}>
          <label style={labelStyle}>ΠΟΣΟ ΕΙΣΠΡΑΞΗΣ (€)</label>
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

        <div style={fieldGroup}>
          <label style={labelStyle}>ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
            <option value="Μετρητά">Μετρητά</option>
            <option value="Κάρτα">Κάρτα</option>
            <option value="Τράπεζα">Τράπεζα</option>
          </select>
        </div>

        <div style={fieldGroup}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ (Προαιρετικό)</label>
          <input 
            type="text" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            style={inputStyle} 
            placeholder="π.χ. Πρωινά είδη..." 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            ...submitBtn, 
            backgroundColor: loading ? '#94a3b8' : '#16a34a',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ ΣΕ ΕΞΕΛΙΞΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΣΟΔΟΥ'}
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
const backBtn = { border: 'none', background: '#f1f5f9', width: '45px', height: '45px', borderRadius: '15px', fontSize: '20px', cursor: 'pointer' };
const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const fieldGroup = { display: 'flex', flexDirection: 'column' as const };
const inputStyle = { width: '100%', padding: '16px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' as const };
const amountInput = { ...inputStyle, fontWeight: '900', fontSize: '22px', color: '#16a34a', textAlign: 'center' as const };
const submitBtn = { padding: '20px', borderRadius: '15px', border: 'none', color: 'white', fontWeight: '800', fontSize: '16px', marginTop: '10px' };