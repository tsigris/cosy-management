'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function AddExpenseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // 1. Παίρνουμε τα στοιχεία από το URL μόνο αν υπάρχουν (από το κουμπί ΕΞΟΦΛΗΣΗ)
  const supplierIdFromUrl = searchParams.get('supplier_id')
  const isAutoPayment = searchParams.get('type') === 'payment'
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [amount, setAmount] = useState('')
  const [supplierId, setSupplierId] = useState(supplierIdFromUrl || '')
  const [method, setMethod] = useState('Μετρητά')
  const [description, setDescription] = useState('')
  const [isDebtPayment, setIsDebtPayment] = useState(isAutoPayment) // TRUE μόνο αν έρχεται από καρτέλες
  const [isCredit, setIsCredit] = useState(false)
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
      description,
      date: dateParam,
      is_debt_payment: isDebtPayment,
      is_credit: isCredit
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
          {isAutoPayment ? 'Εξόφληση Καρτέλας' : 'Νέο Έξοδο'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ΗΜΕΡΟΜΗΝΙΑ (Πάντα ορατή όπως πριν) */}
        <div>
          <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</label>
          <input type="date" value={dateParam} disabled style={inputStyle} />
        </div>

        {/* ΠΡΟΜΗΘΕΥΤΗΣ - Αν έρχεται από Εξόφληση, είναι κλειδωμένο */}
        <div>
          <label style={labelStyle}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
          <select 
            value={supplierId} 
            onChange={(e) => setSupplierId(e.target.value)} 
            style={inputStyle}
            disabled={!!supplierIdFromUrl} 
          >
            <option value="">— Επιλέξτε —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ flex: 1 }}>
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
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              <option value="Μετρητά">Μετρητά</option>
              <option value="Κάρτα">Κάρτα</option>
              <option value="Τράπεζα">Τράπεζα</option>
            </select>
          </div>
        </div>

        {/* ΕΠΙΛΟΓΕΣ - Αν έρχεται από Εξόφληση, το "Έναντι Χρέους" είναι προεπιλεγμένο */}
        <div style={optionsBox}>
          {!isAutoPayment && (
            <label style={checkboxRow}>
              <input type="checkbox" checked={isCredit} onChange={e => { setIsCredit(e.target.checked); if(e.target.checked) setIsDebtPayment(false); }} />
              <span>ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)</span>
            </label>
          )}
          
          <label style={checkboxRow}>
            <input 
              type="checkbox" 
              checked={isDebtPayment} 
              onChange={e => { setIsDebtPayment(e.target.checked); if(e.target.checked) setIsCredit(false); }}
              disabled={isAutoPayment} // Κλειδωμένο αν έρχεται από καρτέλες
            />
            <span>ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥΣ</span>
          </label>
        </div>

        <div>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ / ΠΕΡΙΓΡΑΦΗ</label>
          <input 
            type="text" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            style={inputStyle} 
            placeholder="π.χ. Αρ. Τιμολογίου..." 
          />
        </div>

        <button type="submit" disabled={loading} style={submitBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ'}
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
const backBtn = { border: 'none', background: '#f1f5f9', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer' };
const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', display: 'block' };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', backgroundColor: '#fff' };
const amountInput = { ...inputStyle, fontWeight: '700' };
const optionsBox = { padding: '15px', backgroundColor: '#f8fafc', borderRadius: '15px', display: 'flex', flexDirection: 'column' as const, gap: '12px' };
const checkboxRow = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' };
const submitBtn = { padding: '16px', borderRadius: '15px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '800', fontSize: '16px', cursor: 'pointer', marginTop: '10px' };