'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 1. Δημιουργούμε ένα εσωτερικό component για τη φόρμα εξόδων
function ExpenseFormContent() {
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
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([
      { 
        amount: parseFloat(amount), 
        method, 
        type: 'expense', // Εδώ είναι η διαφορά για τα έξοδα
        date_recorded: date,
        notes 
      }
    ])
    if (!error) router.push('/')
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>← ΑΚΥΡΩΣΗ</Link>
      <h1 style={{ fontSize: '24px', fontWeight: '900', marginTop: '20px', color: '#dc2626' }}>ΝΕΟ ΕΞΟΔΟ</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ημερομηνία</label>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            required
            style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px' }}
          />
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ποσό (€)</label>
          <input 
            type="number" 
            step="0.01" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
            style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '20px', fontWeight: '900' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ backgroundColor: '#dc2626', color: 'white', padding: '18px', borderRadius: '15px', border: 'none', fontSize: '16px', fontWeight: 'bold' }}
        >
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΞΟΔΟΥ'}
        </button>
      </form>
    </div>
  )
}

// 2. Η κύρια σελίδα που τυλίγει τη φόρμα σε Suspense για να περάσει το build του Vercel
export default function AddExpense() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <Suspense fallback={<p style={{ textAlign: 'center' }}>Φόρτωση...</p>}>
        <ExpenseFormContent />
      </Suspense>
    </main>
  )
}