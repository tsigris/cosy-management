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

  // Δύο ξεχωριστά ποσά
  const [bankAmount, setBankAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  async function handlePayment() {
    const total = (Number(bankAmount) || 0) + (Number(cashAmount) || 0)
    if (total <= 0) return alert('Πρέπει να βάλετε τουλάχιστον ένα ποσό.')
    
    setLoading(true)
    const transactions = []

    // Αν υπάρχει ποσό τράπεζας, φτιάξε μια συναλλαγή
    if (Number(bankAmount) > 0) {
      transactions.push({
        amount: Number(bankAmount),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Τράπεζα',
        date,
        employee_id: empId,
        notes: `Μισθοδοσία: ${empName} (Τράπεζα)`
      })
    }

    // Αν υπάρχει ποσό μετρητών, φτιάξε άλλη μια
    if (Number(cashAmount) > 0) {
      transactions.push({
        amount: Number(cashAmount),
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Μετρητά',
        date,
        employee_id: empId,
        notes: `Μισθοδοσία: ${empName} (Μετρητά)`
      })
    }

    const { error } = await supabase.from('transactions').insert(transactions)

    if (!error) {
      router.push('/employees')
      router.refresh()
    } else {
      alert('Σφάλμα: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: '500px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <Link href="/employees" style={{ textDecoration: 'none', fontSize: '24px', color: '#64748b', fontWeight: 'bold' }}>←</Link>
        <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Πληρωμή Υπαλλήλου</h1>
      </div>

      <div style={formCard}>
        <p style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</p>
        <div style={readOnlyInput}>{empName}</div>

        {/* ΠΟΣΟ ΤΡΑΠΕΖΑΣ */}
        <div style={{ marginTop: '25px' }}>
          <p style={{ ...labelStyle, color: '#3b82f6' }}>🏦 ΠΟΣΟ ΤΡΑΠΕΖΑΣ (€)</p>
          <input 
            type="number" 
            value={bankAmount} 
            onChange={e => setBankAmount(e.target.value)} 
            style={{ ...bigAmountInput, borderColor: '#3b82f6', backgroundColor: '#eff6ff' }} 
            placeholder="0.00" 
          />
        </div>

        {/* ΠΟΣΟ ΜΕΤΡΗΤΩΝ */}
        <div style={{ marginTop: '20px' }}>
          <p style={{ ...labelStyle, color: '#10b981' }}>💵 ΠΟΣΟ ΜΕΤΡΗΤΩΝ (€)</p>
          <input 
            type="number" 
            value={cashAmount} 
            onChange={e => setCashAmount(e.target.value)} 
            style={{ ...bigAmountInput, borderColor: '#10b981', backgroundColor: '#f0fdf4' }} 
            placeholder="0.00" 
          />
        </div>

        <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f1f5f9', borderRadius: '15px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: '900', color: '#64748b' }}>ΣΥΝΟΛΙΚΗ ΠΛΗΡΩΜΗ</p>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>
                {((Number(bankAmount) || 0) + (Number(cashAmount) || 0)).toFixed(2)}€
            </h2>
        </div>

        <div style={{ marginTop: '25px' }}>
          <p style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInput} />
        </div>

        <button onClick={handlePayment} disabled={loading} style={saveBtn}>
          {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΕΠΙΒΕΒΑΙΩΣΗ ΔΙΠΛΗΣ ΠΛΗΡΩΜΗΣ'}
        </button>
      </div>
    </main>
  )
}

export default function PayEmployeePage() {
  return (
    <Suspense fallback={<div style={{padding: '40px', textAlign: 'center'}}>Φόρτωση...</div>}>
      <PayEmployeeForm />
    </Suspense>
  )
}

// STYLES
const formCard = { backgroundColor: 'white', padding: '24px', borderRadius: '30px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' as const };
const readOnlyInput = { padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', fontWeight: '900', border: '1px solid #e2e8f0', fontSize: '17px' };
const bigAmountInput = { width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid', fontSize: '22px', fontWeight: '900', textAlign: 'center' as const, outline: 'none' };
const dateInput = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold' };
const saveBtn = { width: '100%', padding: '20px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '16px', marginTop: '30px', cursor: 'pointer' };