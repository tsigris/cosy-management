'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AddExpenseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const supplierIdFromUrl = searchParams.get('supplier_id')
  const isAutoPayment = searchParams.get('type') === 'payment'
  const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]

  // States για δεδομένα
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  
  // States για τη φόρμα
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Μετρητά')
  const [description, setDescription] = useState('')
  const [invoiceNum, setInvoiceNum] = useState('')
  const [isCredit, setIsCredit] = useState(isAutoPayment) 
  const [loading, setLoading] = useState(false)

  // States Επιλογής (Μόνο ένα μπορεί να είναι επιλεγμένο)
  const [selectedSup, setSelectedSup] = useState(supplierIdFromUrl || '')
  const [selectedEmp, setSelectedEmp] = useState('')
  const [selectedFixed, setSelectedFixed] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: s } = await supabase.from('suppliers').select('*').order('name')
      const { data: e } = await supabase.from('employees').select('*').order('full_name')
      if (s) setSuppliers(s)
      if (e) setEmployees(e)
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return alert('Συμπληρώστε το ποσό')

    setLoading(true)
    
    // Αυτόματη Κατηγοριοποίηση
    let finalCategory = 'Λοιπά'
    if (selectedSup) finalCategory = 'Εμπορεύματα'
    else if (selectedEmp) finalCategory = 'Προσωπικό'
    else if (selectedFixed) finalCategory = 'Πάγια'

    const payload = {
      amount: parseFloat(amount),
      type: 'expense',
      category: finalCategory,
      method,
      notes: description,
      invoice_number: invoiceNum,
      date: dateParam,
      supplier_id: selectedSup || null,
      employee_id: selectedEmp || null,
      is_credit: isCredit,
      is_debt_payment: isAutoPayment
    }

    const { error } = await supabase.from('transactions').insert([payload])

    if (error) alert(error.message)
    else router.push(`/?date=${dateParam}`)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
        <button onClick={() => router.back()} style={backBtn}>←</button>
        <h2 style={{ fontWeight: '900', margin: 0 }}>
          {isAutoPayment ? 'Εξόφληση Καρτέλας' : 'Νέο Έξοδο'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} style={formCard}>
        
        {/* ΠΟΣΟ & ΜΕΘΟΔΟΣ & ΠΑΡΑΣΤΑΤΙΚΟ (Σειρά όπως στη φωτό) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={labelStyle}>ΠΟΣΟ (€)</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={amountInput} placeholder="0.00" autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              <option value="Μετρητά">Μετρητά</option>
              <option value="Τράπεζα">Τράπεζα</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>ΠΑΡΑΣΤΑΤΙΚΟ</label>
            <input type="text" value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} style={inputStyle} placeholder="Αρ." />
          </div>
        </div>

        {/* ΕΚΚΡΕΜΗΣ / ΠΙΣΤΩΣΗ */}
        <label style={checkboxRow}>
          <input type="checkbox" checked={isCredit} onChange={e => setIsCredit(e.target.checked)} />
          <span style={{color: isCredit ? '#ef4444' : '#64748b'}}>ΕΚΚΡΕΜΗΣ (ΠΙΣΤΩΣΗ / ΧΡΕΟΣ)</span>
        </label>

        {/* ΕΠΙΛΟΓΗ ΟΝΤΟΤΗΤΑΣ (Μόνο ένα από τα τρία) */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
          
          <div style={selectRow}>
            <label style={labelStyle}>ΥΠΑΛΛΗΛΟΣ</label>
            <div style={{display: 'flex', gap: '8px'}}>
              <select value={selectedEmp} onChange={(e) => { setSelectedEmp(e.target.value); setSelectedSup(''); setSelectedFixed(''); }} style={inputStyle}>
                <option value="">— Επιλογή —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
              <Link href="/employees" style={addBtnIcon}>+</Link>
            </div>
          </div>

          <div style={selectRow}>
            <label style={labelStyle}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
            <div style={{display: 'flex', gap: '8px'}}>
              <select value={selectedSup} onChange={(e) => { setSelectedSup(e.target.value); setSelectedEmp(''); setSelectedFixed(''); }} style={inputStyle} disabled={!!supplierIdFromUrl}>
                <option value="">— Επιλογή —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Link href="/suppliers" style={addBtnIcon}>+</Link>
            </div>
          </div>

          <div style={selectRow}>
            <label style={labelStyle}>ΠΑΓΙΟ (ΔΕΗ, ΕΝΟΙΚΙΟ ΚΛΠ)</label>
            <select value={selectedFixed} onChange={(e) => { setSelectedFixed(e.target.value); setSelectedEmp(''); setSelectedSup(''); }} style={inputStyle}>
              <option value="">— Επιλογή —</option>
              <option value="ΔΕΗ">🔌 ΔΕΗ / Ρεύμα</option>
              <option value="ΕΥΔΑΠ">💧 ΕΥΔΑΠ / Νερό</option>
              <option value="Ενοίκιο">🏠 Ενοίκιο</option>
              <option value="Τηλεφωνία">📞 Τηλεφωνία / Internet</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{...inputStyle, height: '60px'}} placeholder="Λεπτομέρειες εξόδου..." />
        </div>

        <button type="submit" disabled={loading} style={submitBtn}>
          {loading ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΚΑΤΑΧΩΡΗΣΗΣ'}
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
const backBtn = { border: 'none', background: '#fff', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
const formCard = { backgroundColor: '#fff', padding: '20px', borderRadius: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '6px', display: 'block', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc', fontWeight: '700' as const };
const amountInput = { ...inputStyle, fontSize: '18px', color: '#1e293b', border: '1px solid #e2e8f0' };
const checkboxRow = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '900', cursor: 'pointer', marginBottom: '10px' };
const selectRow = { marginBottom: '15px' };
const addBtnIcon = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', height: '45px', backgroundColor: '#f1f5f9', color: '#2563eb', borderRadius: '12px', textDecoration: 'none', fontWeight: 'bold', fontSize: '20px' };
const submitBtn = { width: '100%', padding: '18px', borderRadius: '15px', border: 'none', backgroundColor: '#1e293b', color: 'white', fontWeight: '900', fontSize: '15px', cursor: 'pointer', marginTop: '20px' };