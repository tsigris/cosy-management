'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ full_name: '', position: '', amka: '', iban: '' })

  useEffect(() => { fetchInitialData() }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: emps } = await supabase.from('employees').select('*').order('full_name')
    const { data: trans } = await supabase.from('transactions').select('*').not('employee_id', 'is', null)
    if (emps) setEmployees(emps)
    if (trans) setTransactions(trans)
    setLoading(false)
  }

  // Υπολογισμός πληρωμών βάσει employee_id
  const getEmployeePayments = (id: string) => {
    return transactions
      .filter(t => t.employee_id === id)
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!formData.full_name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null,
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null
    }

    const { error } = editingId 
      ? await supabase.from('employees').update(payload).eq('id', editingId)
      : await supabase.from('employees').insert([payload])

    if (!error) {
      setEditingId(null)
      setFormData({ full_name: '', position: '', amka: '', iban: '' })
      setIsAdding(false)
      fetchInitialData()
    }
    setLoading(false)
  }

  return (
    <main style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold', fontSize: '20px' }}>←</Link>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Υπάλληλοι</h1>
          </div>
          <button 
            onClick={() => { setIsAdding(!isAdding); setSelectedEmpId(null); }}
            style={{ backgroundColor: isAdding ? '#94a3b8' : '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}
          >
            {isAdding ? 'Άκυρο' : '+ Νέος'}
          </button>
        </div>

        {isAdding && (
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '18px', marginBottom: '25px', border: '2px solid #2563eb' }}>
             <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>ΟΝΟΜΑΤΕΠΩΝΥΜΟ *</label>
              <input value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>ΘΕΣΗ</label>
              <input value={formData.position || ''} onChange={e => setFormData({...formData, position: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>AMKA</label><input value={formData.amka || ''} onChange={e => setFormData({...formData, amka: e.target.value})} style={inputStyle} /></div>
              <div><label style={labelStyle}>IBAN</label><input value={formData.iban || ''} onChange={e => setFormData({...formData, iban: e.target.value})} style={inputStyle} /></div>
            </div>
            <button onClick={handleSave} style={saveBtnStyle}>{editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ'}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {employees.map((emp) => {
            const totalPaid = getEmployeePayments(emp.id)
            const isSelected = selectedEmpId === emp.id

            return (
              <div key={emp.id} style={{ border: '1px solid #f1f5f9', borderRadius: '20px', overflow: 'hidden' }}>
                <div 
                  onClick={() => setSelectedEmpId(isSelected ? null : emp.id)}
                  style={{ backgroundColor: 'white', padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '16px' }}>{emp.full_name}</span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>{emp.position || 'Προσωπικό'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#16a34a' }}>{totalPaid.toFixed(2)}€</p>
                    <p style={{ margin: 0, fontSize: '9px', color: '#cbd5e0' }}>ΣΥΝ. ΠΛΗΡΩΜΩΝ</p>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ backgroundColor: '#fdfdfd', padding: '18px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ marginBottom: '15px', fontSize: '13px', color: '#475569' }}>
                       <p style={{margin: '5px 0'}}><strong>AMKA:</strong> {emp.amka || '-'}</p>
                       <p style={{margin: '5px 0'}}><strong>IBAN:</strong> {emp.iban || '-'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setFormData({...emp}); setEditingId(emp.id); setIsAdding(true); }} style={actionBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                      <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('employees').delete().eq('id', emp.id); fetchInitialData(); } }} style={{...actionBtn, color: '#ef4444'}}>ΔΙΑΓΡΑΦΗ 🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

const labelStyle = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' };
const saveBtnStyle = { width: '100%', backgroundColor: '#16a34a', color: 'white', padding: '16px', borderRadius: '12px', border: 'none', fontWeight: 'bold' as const, fontSize: '15px', marginTop: '20px' };
const actionBtn = { flex: 1, background: 'white', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' as const };