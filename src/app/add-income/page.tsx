'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 1. Το πραγματικό περιεχόμενο της φόρμας
function IncomeFormFields() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateFromUrl = searchParams.get('date') || new Date().toISOString().split('T')[0]
  
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [date, setDate] = useState(dateFromUrl)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([
      { 
        amount: parseFloat(amount), 
        method, 
        type: 'income', 
        date_recorded: date 
      }
    ])
    if (!error) router.push('/')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>ΗΜΕΡΟΜΗΝΙΑ</label>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          required 
          style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0' }} 
        />
      </div>
      <div>
        <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>ΠΟΣΟ (€)</label>
        <input 
          type="number" 
          step="0.01" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          required 
          placeholder="0.00" 
          style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '20px' }} 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading} 
        style={{ backgroundColor: '#16a34a', color: 'white', padding: '18px', borderRadius: '15px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
      >
        {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΣΟΔΟΥ'}
      </button>
    </form>
  )
}

// 2. Η σελίδα που τυλίγει τη φόρμα με το απαραίτητο Suspense
export default function AddIncomePage() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold' }}>← ΑΚΥΡΩΣΗ</Link>
        <h1 style={{ fontSize: '24px', fontWeight: '900', marginTop: '20px' }}>ΝΕΟ ΕΣΟΔΟ</h1>
        <Suspense fallback={<p style={{ textAlign: 'center' }}>Φόρτωση φόρμας...</p>}>
          <IncomeFormFields />
        </Suspense>
      </div>
    </main>
  )
}