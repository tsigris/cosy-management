'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Αυτό το κομμάτι διαβάζει το URL μέσα στο Suspense
function IncomeFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
        type: 'income', 
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
      <h1 style={{ fontSize: '24px', fontWeight: '900', marginTop: '20px', color: '#111827' }}>ΝΕΟ ΕΣΟΔΟ</h1>

      <form onSubmit={handleSubmit} style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ημερομηνία Είσπραξης</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ποσό (€)</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '20px', fontWeight: '900' }} />
        </div>
        <button type="submit" disabled={loading} style={{ backgroundColor: '#16a34a', color: 'white', padding: '18px', borderRadius: '15px', border: 'none', fontSize: '16px', fontWeight: 'bold' }}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΣΟΔΟΥ'}
        </button>
      </form>
    </div>
  )
}

export default function AddIncome() {
  return (
    <main style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px' }}>
      <Suspense fallback={<p style={{ textAlign: 'center' }}>Φόρτωση...</p>}>
        <IncomeFormContent />
      </Suspense>
    </main>
  )
}