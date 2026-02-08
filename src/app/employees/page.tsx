'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function EmployeesContent() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({ 
    full_name: '', position: '', amka: '', iban: '', monthly_salary: '', 
    start_date: new Date().toISOString().split('T')[0] 
  })

  useEffect(() => { fetchInitialData() }, [])

  async function fetchInitialData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
      
      if (profile?.store_id) {
        setStoreId(profile.store_id)
        const [empsRes, transRes] = await Promise.all([
          supabase.from('employees').select('*').eq('store_id', profile.store_id).order('full_name'),
          supabase.from('transactions').select('*').eq('store_id', profile.store_id).not('employee_id', 'is', null).order('date', { ascending: false })
        ])
        
        if (empsRes.data) setEmployees(empsRes.data)
        if (transRes.data) setTransactions(transRes.data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
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

  async function handleSave() {
    if (!formData.full_name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    setLoading(true)
    
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null,
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null,
      monthly_salary: Number(formData.monthly_salary) || 0,
      start_date: formData.start_date,
      store_id: storeId
    }

    const { error } = editingId 
      ? await supabase.from('employees').update(payload).eq('id', editingId)
      : await supabase.from('employees').insert([payload])

    if (!error) {
      setEditingId(null)
      resetForm()
      setIsAdding(false)
      fetchInitialData()
    } else {
      alert(error.message)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setFormData({ full_name: '', position: '', amka: '', iban: '', monthly_salary: '', start_date: new Date().toISOString().split('T')[0] })
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>👥</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Υπάλληλοι
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΩΠΙΚΟΥ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <button onClick={() => { setIsAdding(!isAdding); if(isAdding) resetForm(); setEditingId(null); }} style={isAdding ? cancelBtn : addBtn}>
        {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ'}
      </button>

      {isAdding && (
        <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : '#0f172a' }}>
          <p style={labelStyle}>Ονοματεπώνυμο *</p>
          <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} placeholder="π.χ. Ιωάννης Παπαδόπουλος" />
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <div style={{ flex: 1 }}><p style={labelStyle}>Μισθός (€)</p><input type="number" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} style={inputStyle} placeholder="0.00" /></div>
            <div style={{ flex: 1 }}><p style={labelStyle}>Ημ. Πληρωμής</p><input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} /></div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <div style={{ flex: 1 }}><p style={labelStyle}>ΑΜΚΑ</p><input value={formData.amka} onChange={e => setFormData({...formData, amka: e.target.value})} style={inputStyle} placeholder="11223344556" /></div>
            <div style={{ flex: 1 }}><p style={labelStyle}>Θέση</p><input value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} style={inputStyle} placeholder="π.χ. Barista" /></div>
          </div>

          <p style={{...labelStyle, marginTop: '15px'}}>IBAN Λογαριασμού</p>
          <input value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} style={inputStyle} placeholder="GR..." />

          <button onClick={handleSave} disabled={loading} style={{...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : '#0f172a'}}>
            {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΠΡΟΣΘΗΚΗ ΥΠΑΛΛΗΛΟΥ')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Ενεργό Προσωπικό ({employees.length})</p>
        
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
                  <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '16px' }}>{emp.full_name.toUpperCase()}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                     <span style={badgeStyle}>ΣΕ {daysLeft} ΗΜΕΡΕΣ 📅</span>
                     {emp.position && <span style={{...badgeStyle, backgroundColor: '#f1f5f9', color: '#64748b'}}>{emp.position}</span>}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Link href={`/pay-employee?id=${emp.id}&name=${emp.full_name}`} onClick={(e) => e.stopPropagation()} style={payBtnStyle}>ΠΛΗΡΩΜΗ</Link>
                  <div>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: remaining > 0 ? '#ea580c' : '#16a34a' }}>
                      {remaining.toFixed(2)}€
                    </p>
                    <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Υπόλοιπο</p>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div style={{ backgroundColor: '#fcfcfc', padding: '18px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={allTimeCard}>
                     <p style={labelSmallLight}>ΣΥΝΟΛΙΚΕΣ ΠΛΗΡΩΜΕΣ (ALL-TIME)</p>
                     <h3 style={{ fontSize: '26px', margin: 0, fontWeight: '900', color: '#4ade80' }}>{totalPaidAllTime.toFixed(2)}€</h3>
                  </div>
                  
                  {emp.iban && <p style={{fontSize: '11px', color: '#64748b', marginBottom: '15px'}}><strong>IBAN:</strong> {emp.iban}</p>}

                  <div style={{ marginBottom: '20px' }}>
                     <p style={historyTitle}>ΠΡΟΣΦΑΤΕΣ ΠΛΗΡΩΜΕΣ</p>
                     <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {transactions.filter(t => t.employee_id === emp.id).map(t => (
                          <div key={t.id} style={historyItem}>
                             <span style={{ color: '#64748b', fontWeight: 'bold' }}>{t.date.split('T')[0]}</span>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '800', color: '#1e293b' }}>{Number(t.amount).toFixed(2)}€</span>
                             </div>
                          </div>
                        ))}
                     </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setFormData({...emp}); setEditingId(emp.id); setIsAdding(true); window.scrollTo(0,0); }} style={editBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                    <button onClick={async () => { if(confirm('Διαγραφή υπαλλήλου;')) { await supabase.from('employees').delete().eq('id', emp.id); fetchInitialData(); } }} style={deleteBtn}>🗑️</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const payBtnStyle: any = { backgroundColor: '#2563eb', color: 'white', padding: '8px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', textDecoration: 'none' };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', marginBottom: '20px' };
const cancelBtn: any = { ...addBtn, backgroundColor: '#f1f5f9', color: '#64748b' };
const formCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '2px solid', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', display: 'block', marginBottom: '6px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 'bold', backgroundColor: '#f8fafc', boxSizing: 'border-box', outline: 'none' };
const saveBtnStyle: any = { width: '100%', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '15px', marginTop: '20px', cursor: 'pointer' };
const employeeCard: any = { backgroundColor: 'white', borderRadius: '22px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '800', backgroundColor: '#eff6ff', padding: '4px 8px', borderRadius: '6px', color: '#2563eb' };
const allTimeCard: any = { backgroundColor: '#0f172a', padding: '20px', borderRadius: '18px', color: 'white', marginBottom: '20px' };
const labelSmallLight: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px' };
const historyTitle: any = { fontSize: '10px', fontWeight: '900', color: '#1e293b', marginBottom: '10px', paddingBottom: '5px', borderBottom: '2px solid #f1f5f9' };
const historyItem: any = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 0', borderBottom: '1px solid #f8fafc' };
const editBtn: any = { flex: 2, background: '#fef3c7', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: '#92400e' };
const deleteBtn: any = { background: '#fee2e2', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: '800', color: '#ef4444' };

export default function EmployeesPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><EmployeesContent /></Suspense>
    </main>
  )
}