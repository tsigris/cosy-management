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

  const getDaysUntilPayment = (startDateStr: string) => {
    if (!startDateStr) return null
    const today = new Date()
    const start = new Date(startDateStr)
    const payDay = start.getDate()
    let nextPayDate = new Date(today.getFullYear(), today.getMonth(), payDay)
    today.setHours(0, 0, 0, 0)
    nextPayDate.setHours(0, 0, 0, 0)
    if (today >= nextPayDate) nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, payDay)
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getMonthlyPaid = (id: string) => {
    const now = new Date()
    return transactions
      .filter(t => t.employee_id === id && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear())
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  const getPaymentIcon = (method: string) => {
    if (method === 'Μετρητά') return '💵'
    if (method === 'Τράπεζα') return '🏦'
    return '💰'
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
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Υπάλληλοι</h1>
          </div>
          <button onClick={() => { setIsAdding(!isAdding); setEditingId(null); }} style={isAdding ? cancelBtn : addBtn}>
            {isAdding ? 'ΑΚΥΡΟ' : '+ ΝΕΟΣ'}
          </button>
        </div>

        {isAdding && (
          <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : '#2563eb' }}>
            <p style={labelStyle}>ΟΝΟΜΑΤΕΠΩΝΥΜΟ *</p>
            <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <div style={{ flex: 1 }}><p style={labelStyle}>ΜΙΣΘΟΣ (€)</p><input type="number" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><p style={labelStyle}>ΕΝΑΡΞΗ</p><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} /></div>
            </div>
            <button onClick={handleSave} style={{...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : '#10b981'}}>
              {editingId ? 'ΕΝΗΜΕΡΩΣΗ' : 'ΑΠΟΘΗΚΕΥΣΗ'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {employees.map((emp) => {
            const monthlySalary = Number(emp.monthly_salary) || 0
            const monthlyPaid = getMonthlyPaid(emp.id)
            const totalPaidAllTime = transactions.filter(t => t.employee_id === emp.id).reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
            const remaining = monthlySalary - monthlyPaid
            const isSelected = selectedEmpId === emp.id
            const daysLeft = getDaysUntilPayment(emp.start_date)

            return (
              <div key={emp.id} style={employeeCard}>
                <div onClick={() => setSelectedEmpId(isSelected ? null : emp.id)} style={{ padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{emp.full_name}</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                       <span style={badgeStyle}>ΠΛΗΡΩΜΗ ΣΕ: {daysLeft} ΗΜΕΡΕΣ</span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* ΚΟΥΜΠΙ ΠΛΗΡΩΜΗΣ ΟΠΩΣ ΣΤΙΣ ΚΑΡΤΕΛΕΣ */}
                    <Link 
                      href={`/pay-employee?id=${emp.id}&name=${emp.full_name}`} 
                      onClick={(e) => e.stopPropagation()} 
                      style={payBtnStyle}
                    >
                      ΠΛΗΡΩΜΗ
                    </Link>

                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: remaining > 0 ? '#f59e0b' : '#16a34a' }}>
                        {remaining > 0 ? `${remaining.toFixed(2)}€` : 'ΕΞΟΦΛΗΘΗ'}
                      </p>
                      <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', fontWeight: '800' }}>ΥΠΟΛΟΙΠΟ</p>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ backgroundColor: '#fcfcfc', padding: '18px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={allTimeCard}>
                       <p style={labelSmallLight}>ΓΕΝΙΚΟ ΣΥΝΟΛΟ ΠΛΗΡΩΜΩΝ (ALL-TIME)</p>
                       <h3 style={{ fontSize: '28px', margin: 0, fontWeight: '900', color: '#4ade80' }}>{totalPaidAllTime.toFixed(2)}€</h3>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                       <p style={historyTitle}>ΠΛΗΡΕΣ ΙΣΤΟΡΙΚΟ ΣΥΝΑΛΛΑΓΩΝ</p>
                       <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {transactions.filter(t => t.employee_id === emp.id).map(t => (
                            <div key={t.id} style={historyItem}>
                               <span style={{ color: '#64748b', fontWeight: 'bold' }}>{t.date.split('T')[0]}</span>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{getPaymentIcon(t.method)}</span>
                                  <span style={{ fontWeight: '800' }}>{Number(t.amount).toFixed(2)}€</span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setFormData({...emp}); setEditingId(emp.id); setIsAdding(true); window.scrollTo(0,0); }} style={editBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                      <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('employees').delete().eq('id', emp.id); fetchInitialData(); } }} style={deleteBtn}>ΔΙΑΓΡΑΦΗ 🗑️</button>
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

// STYLES
const payBtnStyle = { backgroundColor: '#2563eb', color: 'white', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '900', textDecoration: 'none' };
const addBtn = { padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' };
const cancelBtn = { padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '12px' };
const formCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box' as const };
const saveBtnStyle = { width: '100%', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '15px', marginTop: '20px', cursor: 'pointer' };
const employeeCard = { backgroundColor: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const badgeStyle = { fontSize: '9px', fontWeight: '800', backgroundColor: '#eff6ff', padding: '4px 8px', borderRadius: '6px', color: '#2563eb' };
const allTimeCard = { backgroundColor: '#0f172a', padding: '20px', borderRadius: '18px', color: 'white', marginBottom: '20px' };
const labelSmallLight = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px' };
const historyTitle = { fontSize: '10px', fontWeight: '900', color: '#1e293b', marginBottom: '10px', paddingBottom: '5px', borderBottom: '2px solid #f1f5f9' };
const historyItem = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' };
const editBtn = { flex: 2, background: '#fef3c7', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: '#92400e' };
const deleteBtn = { flex: 1, background: '#fee2e2', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: '#ef4444' };