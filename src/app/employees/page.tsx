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
  
  const [formData, setFormData] = useState({ 
    full_name: '', position: '', amka: '', iban: '', monthly_salary: '', 
    start_date: new Date().toISOString().split('T')[0] 
  })

  useEffect(() => { fetchInitialData() }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: emps } = await supabase.from('employees').select('*').order('full_name')
    const { data: trans } = await supabase.from('transactions').select('*').not('employee_id', 'is', null).order('date', { ascending: false })
    if (emps) setEmployees(emps)
    if (trans) setTransactions(trans)
    setLoading(false)
  }

  const getPaymentIcon = (method: string) => {
    if (method === 'Μετρητά') return '💵'
    if (method === 'Κάρτα' || method === 'POS') return '💳'
    if (method === 'Τράπεζα') return '🏦'
    return '💰'
  }

  const getDaysUntilPayment = (startDateStr: string) => {
    if (!startDateStr) return null
    const today = new Date()
    const start = new Date(startDateStr)
    const payDay = start.getDate()
    let nextPayDate = new Date(today.getFullYear(), today.getMonth(), payDay)
    today.setHours(0, 0, 0, 0)
    nextPayDate.setHours(0, 0, 0, 0)
    if (today >= nextPayDate) {
      nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, payDay)
    }
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getMonthlyPaid = (id: string) => {
    const now = new Date()
    return transactions
      .filter(t => t.employee_id === id && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  async function handleSave() {
    if (!formData.full_name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null,
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null,
      monthly_salary: Number(formData.monthly_salary) || 0,
      start_date: formData.start_date
    }
    const { error } = editingId 
      ? await supabase.from('employees').update(payload).eq('id', editingId)
      : await supabase.from('employees').insert([payload])
    if (!error) {
      setEditingId(null)
      setFormData({ full_name: '', position: '', amka: '', iban: '', monthly_salary: '', start_date: new Date().toISOString().split('T')[0] })
      setIsAdding(false)
      fetchInitialData()
    }
    setLoading(false)
  }

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>← ΠΙΣΩ</Link>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Προσωπικό</h1>
          </div>
          <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); }} style={isAdding ? cancelBtn : addBtn}>
            {isAdding ? 'ΑΚΥΡΟ' : '+ ΝΕΟΣ'}
          </button>
        </div>

        {isAdding && (
          <div style={formCard}>
            <p style={labelStyle}>ΟΝΟΜΑΤΕΠΩΝΥΜΟ *</p>
            <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <div style={{ flex: 1 }}><p style={labelStyle}>ΜΗΝΙΑΙΟΣ ΜΙΣΘΟΣ</p><input type="number" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><p style={labelStyle}>ΗΜ/ΝΙΑ ΕΝΑΡΞΗΣ</p><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} /></div>
            </div>
            <button onClick={handleSave} style={saveBtnStyle}>{editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ'}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {employees.map((emp) => {
            const monthlyPaid = getMonthlyPaid(emp.id)
            const totalPaidAllTime = transactions.filter(t => t.employee_id === emp.id).reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
            const remaining = (Number(emp.monthly_salary) || 0) - monthlyPaid
            const isSelected = selectedEmpId === emp.id
            const daysLeft = getDaysUntilPayment(emp.start_date)

            return (
              <div key={emp.id} style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                <div onClick={() => setSelectedEmpId(isSelected ? null : emp.id)} style={{ padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: '800', color: '#1e293b' }}>{emp.full_name}</span>
                    <div style={{ marginTop: '4px' }}><span style={badgeStyle}>ΠΛΗΡΩΜΗ ΣΕ: {daysLeft} ΗΜΕΡΕΣ</span></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: remaining > 0 ? '#f59e0b' : '#16a34a' }}>{remaining > 0 ? `${remaining.toFixed(2)}€` : 'ΕΞΟΦΛΗΘΗ'}</p>
                    <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', fontWeight: '800' }}>ΥΠΟΛΟΙΠΟ ΜΗΝΑ</p>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ padding: '18px', backgroundColor: '#fcfcfc', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '15px', color: 'white', marginBottom: '20px' }}>
                       <p style={{ fontSize: '10px', fontWeight: '800', margin: '0 0 5px 0', opacity: 0.7 }}>ΣΥΝΟΛΙΚΕΣ ΑΠΟΛΑΒΕΣ (ALL-TIME)</p>
                       <h3 style={{ fontSize: '26px', margin: 0, fontWeight: '900', color: '#4ade80' }}>{totalPaidAllTime.toFixed(2)}€</h3>
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                       <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', borderBottom: '1px solid #eee' }}>ΠΛΗΡΕΣ ΙΣΤΟΡΙΚΟ</p>
                       <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {transactions.filter(t => t.employee_id === emp.id).map(t => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dotted #eee', fontSize: '13px' }}>
                             <span style={{color: '#64748b'}}>{t.date.split('T')[0]}</span>
                             <div style={{display: 'flex', gap: '6px'}}><span>{getPaymentIcon(t.method)}</span><span style={{fontWeight: '800'}}>{Number(t.amount).toFixed(2)}€</span></div>
                          </div>
                        ))}
                       </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setFormData({...emp}); setEditingId(emp.id); setIsAdding(true); }} style={editBtn}>✎ ΕΠΕΞΕΡΓΑΣΙΑ</button>
                      <button onClick={() => { if(confirm('Διαγραφή;')) supabase.from('employees').delete().eq('id', emp.id).then(() => fetchInitialData()) }} style={deleteBtn}>🗑️ ΔΙΑΓΡΑΦΗ</button>
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

const addBtn = { padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' };
const cancelBtn = { padding: '10px 20px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: '900' };
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '25px', marginBottom: '20px', border: '2px solid #2563eb' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '10px', boxSizing: 'border-box' as const, fontWeight: 'bold' };
const saveBtnStyle = { width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '15px' };
const badgeStyle = { fontSize: '9px', fontWeight: '900', backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px' };
const editBtn = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '900' };
const deleteBtn = { padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: '900' };