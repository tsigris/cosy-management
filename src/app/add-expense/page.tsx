export const dynamic = 'force-dynamic'
'use client'
// Προσθήκη για την αποφυγή σφαλμάτων κατά το build στο Vercel

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AddExpensePage() {
  const router = useRouter()
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
      is_credit: formData.is_credit || false,
      is_debt_payment: formData.is_debt_payment || false,
      date: new Date().toISOString() 
    }

    if (formData.category === 'Μισθοδοσία') {
      payload.employee_id = formData.employee_id || null
      payload.supplier_id = null
    } else {
      payload.supplier_id = formData.supplier_id || null
      payload.employee_id = null
    }

    const { error } = await supabase.from('transactions').insert([payload])

    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      setFetching(false)
      alert('Σφάλμα: ' + error.message)
    }
  }

  return (
    <main style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}>←</button>
         <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>Νέο Έξοδο</h2>
      </div>
      
      {fetching ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Φόρτωση...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
            <label style={labelStyle}>ΠΟΣΟ (€)</label>
            <input 
              type="number" 
              inputMode="decimal"
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
              style={inputStyle} 
            />
          </div>

          <div>
            <label style={labelStyle}>ΚΑΤΗΓΟΡΙΑ</label>
            <select 
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value, employee_id: '', supplier_id: ''})} 
              style={inputStyle}
            >
              <option value="Αγορά Εμπορευμάτων">Αγορά Εμπορευμάτων</option>
              <option value="Μισθοδοσία">Μισθοδοσία</option>
              <option value="Ενοίκιο">Ενοίκιο</option>
              <option value="Λογαριασμοί">Λογαριασμοί</option>
            </select>
          </div>

          {formData.category === 'Μισθοδοσία' && (
            <div style={boxStyle('#f0f9ff', '#bae6fd')}>
              <label style={{...labelStyle, color: '#0369a1'}}>ΥΠΑΛΛΗΛΟΣ</label>
              <select 
                value={formData.employee_id} 
                onChange={e => setFormData({...formData, employee_id: e.target.value})} 
                style={inputStyle}
              >
                <option value="">— Επιλέξτε —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.category === 'Αγορά Εμπορευμάτων' && (
            <div style={boxStyle('#fff1f2', '#fecaca')}>
              <label style={{...labelStyle, color: '#991b1b'}}>ΠΡΟΜΗΘΕΥΤΗΣ</label>
              <select 
                value={formData.supplier_id} 
                onChange={e => setFormData({...formData, supplier_id: e.target.value})} 
                style={inputStyle}
              >
                <option value="">— Επιλέξτε —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>ΜΕΘΟΔΟΣ</label>
            <select 
              value={formData.method} 
              onChange={e => setFormData({...formData, method: e.target.value})} 
              style={inputStyle}
            >
              <option value="Μετρητά">Μετρητά</option>
              <option value="Κάρτα">Κάρτα</option>
              <option value="Τράπεζα">Τράπεζα</option>
            </select>
          </div>

          <button onClick={handleSave} disabled={fetching} style={saveBtnStyle}>
            {fetching ? 'ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΕΞΟΔΟΥ'}
          </button>
        </div>
      )}
    </main>
  )
}

const labelStyle = { fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '6px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '16px', outline: 'none' };
const saveBtnStyle = { backgroundColor: '#2563eb', color: 'white', padding: '18px', borderRadius: '14px', border: 'none', fontWeight: 'bold' as const, fontSize: '16px', cursor: 'pointer' };
const boxStyle = (bg: string, border: string) => ({ padding: '15px', backgroundColor: bg, borderRadius: '14px', border: `1px solid ${border}` });