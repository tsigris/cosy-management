'use client'
import { Suspense, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

// Αυτό το κομμάτι περιέχει τη λογική της σελίδας
function AddIncomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { error } = await supabase.from('transactions').insert([
        { 
          user_id: user.id, 
          amount: parseFloat(amount), 
          description, 
          type: 'income',
          date: new Date().toISOString()
        }
      ])
      if (!error) router.push('/analysis')
      else alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Προσθήκη Εσόδου</h1>
      <form onSubmit={handleSubmit}>
        <input 
          type="number" 
          placeholder="Ποσό" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          required 
        />
        <input 
          type="text" 
          placeholder="Περιγραφή" 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          required 
        />
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#22c55e', color: 'white', border: 'none' }}>
          {loading ? 'Αποθήκευση...' : 'Προσθήκη'}
        </button>
      </form>
    </main>
  )
}

// Η κύρια σελίδα που "τυλίγει" το περιεχόμενο σε Suspense
export default function AddIncomePage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <AddIncomeContent />
    </Suspense>
  )
}