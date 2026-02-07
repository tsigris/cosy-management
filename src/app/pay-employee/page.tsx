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
  const [method, setMethod] = useState('Τράπεζα') // Εδώ ορίζεις την προεπιλογή (Τράπεζα ή Μετρητά)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  async function handlePayment() {
    if (!amount || Number(amount) <= 0) return alert('Παρακαλώ δώστε ένα έγκυρο ποσό πληρωμής.')
    setLoading(true)
    
    const { error } = await supabase.from('transactions').insert([{
      amount: Number(amount),
      type: 'expense',
      category: 'Προσωπικό',
      method,
      date,
      employee_id: empId,
      notes: `Πληρωμή μισθοδοσίας: ${empName} μέσω ${method}`
    }])

    if (!error) {
      router.push('/employees')
      router.refresh()
    } else {
      alert('Σφάλμα κατά την αποθήκευση: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <Link href="/employees" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b', fontWeight: 'bold' }}>←</Link>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Πληρωμή Υπαλλήλου</h1>
      </div>

      <div style={formCard}>
        <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
        <div style={readOnlyInput}>{empName}</div>

        <div style={{ marginTop: '25px' }}>
          <p style={labelStyle}>ΠΟΣΟ ΠΛΗΡΩΜΗΣ (€)</p>
          <input 
            type="number" 
            value={amount} 
            onChange={e => setAmount(e.target.value)} 
            style={bigAmountInput} 
            placeholder="0.00" 
            autoFocus 
          />
        </div>

        {/* ΕΠΙΛΟΓΗ ΜΕΘΟΔΟΥ ΜΕ 2 ΚΟΥΜΠΙΑ */}
        <div style={{ marginTop: '25px' }}>
          <p style={labelStyle}>ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              type="button"
              onClick={() => setMethod('Τράπεζα')}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Τράπεζα' ? '#3b82f6' : 'white',
                color: method === 'Τράπεζα' ? 'white' : '#64748b',
                borderColor: method === 'Τράπεζα' ? '#2563eb' : '#e2e8f0',
                boxShadow: method === 'Τράπεζα' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
              }}
            >
              <span style={{fontSize: '22px'}}>🏦</span>
              <span style={{marginTop: '4px'}}>Τράπεζα</span>
            </button>

            <button 
              type="button"
              onClick={() => setMethod('Μετρητά')}
              style={{
                ...methodBtn,
                backgroundColor: method === 'Μετρητά' ? '#10b981' : 'white',
                color: method === 'Μετρητά' ? 'white' : '#64748b',
                borderColor: method === 'Μετρητά' ? '#059669' : '#e2e8f0',
                boxShadow: method === 'Μετρητά' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              <span style={{fontSize: '22px'}}>💵</span>
              <span style={{marginTop: '4px'}}>Μετρητά</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: '25px' }}>
          <p style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInput} />
        </div>

        <button 
          onClick={handlePayment} 
          disabled={loading} 
          style={{
            ...saveBtn,
            backgroundColor: loading ? '#94a3b8' : '#1e293b'
          }}
        >
          {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : `ΕΠΙΒΕΒΑΙΩΣΗ (${method.toUpperCase()})`}
        </button>
      </div>
    </main>
  )
}

export default function PayEmployeePage() {
  return (
    <Suspense fallback={<div style={{padding: '40px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση φόρμας...</div>}>
      <PayEmployeeForm />
    </Suspense>
  )
}

// STYLES
const formCard = { backgroundColor: 'white', padding: '24px', borderRadius: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const readOnlyInput = { padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', fontWeight: '900', border: '1px solid #e2e8f0', fontSize: '17px', color: '#1e293b' };
const bigAmountInput = { width: '100%', padding: '20px', borderRadius: '20px', border: '2px solid #3b82f6', fontSize: '28px', fontWeight: '900', textAlign: 'center' as const, color: '#1e293b', outline: 'none', backgroundColor: '#eff6ff' };
const dateInput = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc' };
const methodBtn = { flex: 1, padding: '18px', borderRadius: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px', border: '2px solid', transition: 'all 0.2s ease' };
const saveBtn = { width: '100%', padding: '20px', color: 'white', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '16px', marginTop: '30px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };