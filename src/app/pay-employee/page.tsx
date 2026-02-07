'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function PayEmployeeForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const empId = searchParams.get('id')
  const empName = searchParams.get('name')

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  async function handlePayment() {
    if (!amount || Number(amount) <= 0) return alert('Δώσε έγκυρο ποσό')
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([{
      amount: Number(amount),
      type: 'expense',
      category: 'Προσωπικό',
      method,
      date,
      employee_id: empId,
      notes: `Πληρωμή μισθοδοσίας: ${empName}`
    }])
    if (!error) {
      router.push('/employees')
      router.refresh()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <Link href="/employees" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b' }}>←</Link>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b' }}>Πληρωμή Υπαλλήλου</h1>
      </div>

      <div style={formCard}>
        <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
        <div style={readOnlyInput}>{empName}</div>

        <div style={{ marginTop: '15px' }}>
          <p style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>ΠΟΣΟ (€)</p>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <p style={labelStyle}>ΜΕΘΟΔΟΣ</p>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
              <option value="Μετρητά">💵 Μετρητά</option>
              <option value="Τράπεζα">🏦 Τράπεζα</option>
            </select>
          </div>
        </div>

        <button onClick={handlePayment} disabled={loading} style={saveBtn}>
          {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΕΠΙΒΕΒΑΙΩΣΗ ΠΛΗΡΩΜΗΣ'}
        </button>
      </div>
    </main>
  )
}

export default function PayEmployeePage() {
  return (
    <Suspense fallback={<div style={{padding: '20px'}}>Φόρτωση...</div>}>
      <PayEmployeeForm />
    </Suspense>
  )
}

const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #e2e8f0' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '5px' };
const readOnlyInput = { padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', fontWeight: '800', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' as const };
const saveBtn = { width: '100%', padding: '16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', marginTop: '25px', cursor: 'pointer' };