'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function AddExpenseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Λήψη παραμέτρων από το URL (αν υπάρχουν)
  const supplierIdFromUrl = searchParams.get('supplier_id')
  const isPaymentParam = searchParams.get('type') === 'payment'
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [supplierId, setSupplierId] = useState(supplierIdFromUrl || '')
  const [method, setMethod] = useState('Μετρητά')
  const [isDebtPayment, setIsDebtPayment] = useState(isPaymentParam)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchSuppliers() {
      const { data } = await supabase.from('suppliers').select('*').order('name')
      if (data) setSuppliers(data)
    }
    fetchSuppliers()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !supplierId) return alert('Συμπληρώστε ποσό και προμηθευτή')
    
    setLoading(true)
    const { error } = await supabase.from('transactions').insert([{
      amount: parseFloat(amount),
      supplier_id: supplierId,
      type: 'expense',
      method,
      date: dateParam,
      is_debt_payment: isDebtPayment, // Εδώ αποθηκεύεται αν είναι έναντι χρέους
      is_credit: false // Μια πληρωμή χρέους δεν είναι η ίδια πίστωση
    }])

    if (error) alert(error.message)
    else router.push(`/?date=${dateParam}`)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button onClick={() => router.back()} style={backBtn}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>
          {isDebtPayment ? 'Εξόφληση Χρέους' : 'Νέο Έξοδο'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ΕΠΙΛΟΓΗ ΠΡΟΜΗΘΕΥΤΗ */}
        <div>
          <label style={labelStyle}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select 
            value={supplierId} 
            onChange={(e) => setSupplierId(e.target.value)} 
            style={inputStyle}
            disabled={!!supplierIdFromUrl} // Κλειδωμένο αν έρχεται από την καρτέλα
          >
            <option value="">Επιλέξτε...</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* ΠΟΣΟ */}
        <div>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
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

        {/* ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ */}
        <div>
          <label style={labelStyle}>ΤΡΟΠΟΣ ΠΛΗΡΩΜΗΣ</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['Μετρητά', 'Κάρτα', 'Τράπεζα'].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                style={{
                  ...methodBtn,
                  backgroundColor: method === m ? '#1e293b' : 'white',
                  color: method === m ? 'white' : '#1e293b'
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* ΕΠΙΛΟΓΗ ΕΝΑΝΤΙ ΧΡΕΟΥΣ - ΜΟΝΟ ΑΝ ΔΕΝ ΕΙΝΑΙ ΗΔΗ ΠΡΟΕΠΙΛΕΓΜΕΝΟ */}
        {!isPaymentParam && (
          <label style={checkboxContainer}>
            <input 
              type="checkbox" 
              checked={isDebtPayment} 
              onChange={(e) => setIsDebtPayment(e.target.checked)} 
            />
            <span style={{ fontSize: '14px', fontWeight: '700' }}>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥΣ</span>
          </label>
        )}

        {isDebtPayment && (
          <div style={infoNote}>
            ℹ️ Η κίνηση αυτή θα αφαιρεθεί από το υπόλοιπο της καρτέλας.
          </div>
        )}

        <button type="submit" disabled={loading} style={submitBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ'}
        </button>
      </form>
    </div>
  )
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <AddExpenseContent />
    </Suspense>
  )
}

// STYLES
const backBtn = { border: 'none', background: '#f1f5f9', width: '45px', height: '45px', borderRadius: '15px', fontSize: '20px', cursor: 'pointer' };
const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' };
const inputStyle = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none', appearance: 'none' as const };
const amountInput = { ...inputStyle, fontSize: '24px', fontWeight: '900', textAlign: 'center' as const, color: '#dc2626' };
const methodBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' };
const checkboxContainer = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', background: '#f8fafc', borderRadius: '15px', cursor: 'pointer' };
const submitBtn = { padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };
const infoNote = { padding: '12px', backgroundColor: '#f0f9ff', color: '#0369a1', borderRadius: '10px', fontSize: '12px', fontWeight: '600', textAlign: 'center' as const };