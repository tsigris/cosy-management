'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function ExpenseFormFields() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateFromUrl = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const [employees, setEmployees] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [fetching, setFetching] = useState(true)
  
  const [formData, setFormData] = useState({
    amount: '',
    category: 'Αγορά Εμπορευμάτων', 
    method: 'Μετρητά',
    description: '',
    supplier_id: '',
    employee_id: '',
    date: dateFromUrl,
    is_credit: false,
    is_debt_payment: false
  })

  useEffect(() => {
    async function loadData() {
      setFetching(true)
      const [empRes, supRes] = await Promise.all([
        supabase.from('employees').select('id, full_name').order('full_name'),
        supabase.from('suppliers').select('id, name').order('name')
      ])
      if (empRes.data) setEmployees(empRes.data)
      if (supRes.data) setSuppliers(supRes.data)
      setFetching(false)
    }
    loadData()
  }, [])

  async function handleSave() {
    if (!formData.amount || Number(formData.amount) <= 0) return alert('Παρακαλώ βάλτε ποσό')
    setFetching(true)
    
    const payload: any = {
      type: 'expense',
      amount: parseFloat(formData.amount),
      category: formData.category,
      method: formData.method,
      description: formData.description || '',
      is_credit: formData.is_credit,
      is_debt_payment: formData.is_debt_payment,
      date: formData.date
    }

    if (formData.category === 'Μισθοδοσία') {
      payload.employee_id = formData.employee_id || null
    } else {
      payload.supplier_id = formData.supplier_id || null
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (!error) {
      router.push(`/?date=${formData.date}`)
      router.refresh()
    } else {
      setFetching(false)
      alert('Σφάλμα: ' + error.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>ΗΜΕΡΟΜΗΝΙΑ</label>
        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={inputStyle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>ΠΟΣΟ (€)</label>
          <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} style={inputStyle} placeholder="0.00" />
        </div>
        <div>
          <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
          <select value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})} style={inputStyle}>
            <option value="Μετρητά">Μετρητά</option>
            <option value="Κάρτα">Κάρτα</option>
            <option value="Τράπεζα">Τράπεζα</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '14px' }}>
          <input type="checkbox" checked={formData.is_credit} onChange={e => setFormData({...formData, is_credit: e.target.checked})} /> ΕΠΙ ΠΙΣΤΩΣΕΙ (ΝΕΟ ΧΡΕΟΣ)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '14px' }}>
          <input type="checkbox" checked={formData.is_debt_payment} onChange={e => setFormData({...formData, is_debt_payment: e.target.checked})} /> ΕΝΑΝΤΙ ΠΑΛΑΙΟΥ ΧΡΕΟΥ
        </label>
      </div>

      <div>
        <label style={labelStyle}>ΣΗΜΕΙΩΣΕΙΣ</label>
        <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={inputStyle} placeholder="π.χ. Αρ. Τιμολογίου..." />
      </div>

      <div>
        <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, employee_id: '', supplier_id: ''})} style={inputStyle}>
          <option value="Αγορά Εμπορευμάτων">Αγορά Εμπορευμάτων</option>
          <option value="Μισθοδοσία">Μισθοδοσία</option>
          <option value="Ενοίκιο">Ενοίκιο</option>
          <option value="Λογαριασμοί">Λογαριασμοί</option>
        </select>
      </div>

      {formData.category === 'Αγορά Εμπορευμάτων' && (
        <div style={boxStyle('#fff1f2', '#fecaca')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <label style={{...labelStyle, color: '#991b1b'}}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
            <Link href="/suppliers" style={{ color: '#991b1b', fontWeight: 'bold', textDecoration: 'none' }}>[ + ]</Link>
          </div>
          <select value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})} style={inputStyle}>
            <option value="">— Επιλέξτε —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <button onClick={handleSave} disabled={fetching} style={saveBtnStyle}>
        {fetching ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ'}
      </button>
    </div>
  )
}

export default function AddExpensePage() {
  const router = useRouter()
  return (
    <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>←</button>
         <h2 style={{ fontWeight: '800', margin: 0 }}>Νέο Έξοδο</h2>
      </div>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <ExpenseFormFields />
      </Suspense>
    </main>
  )
}

const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', boxSizing: 'border-box' as const };
const saveBtnStyle = { backgroundColor: '#2563eb', color: 'white', padding: '18px', borderRadius: '14px', border: 'none', fontWeight: 'bold' as const, width: '100%', cursor: 'pointer' };
const boxStyle = (bg: string, border: string) => ({ padding: '15px', backgroundColor: bg, borderRadius: '14px', border: `1px solid ${border}` });