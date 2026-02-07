'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function IncomeFormFields() {
  const router = useRouter()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!amount || Number(amount) <= 0) return alert('Βάλτε ποσό')
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([
      { amount: parseFloat(amount), type: 'income', method, date_recorded: new Date().toISOString() }
    ])
    if (!error) { router.push('/'); router.refresh(); }
    else { setLoading(false); alert('Σφάλμα: ' + error.message); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>ΠΟΣΟ ΕΙΣΠΡΑΞΗΣ (€)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
      </div>
      <div>
        <label style={labelStyle}>ΤΡΟΠΟΣ</label>
        <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
          <option value="Μετρητά">Μετρητά</option>
          <option value="Κάρτα">Κάρτα</option>
        </select>
      </div>
      <button onClick={handleSave} disabled={loading} style={{...saveBtnStyle, backgroundColor: '#16a34a'}}>
        {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΚΑΤΑΧΩΡΗΣΗ ΕΣΟΔΟΥ'}
      </button>
    </div>
  )
}

export default function AddIncomePage() {
  const router = useRouter()
  return (
    <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <button onClick={() => router.push('/')} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>←</button>
         <h2 style={{ fontWeight: '800', margin: 0 }}>Νέο Έσοδο</h2>
      </div>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <IncomeFormFields />
      </Suspense>
    </main>
  )
}

const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px' };
const saveBtnStyle = { color: 'white', padding: '18px', borderRadius: '14px', border: 'none', fontWeight: 'bold' as const, width: '100%', cursor: 'pointer' };