'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b', // Slate 800
  secondaryText: '#64748b', // Slate 500
  accentBlue: '#2563eb',  // Blue 600
  accentGreen: '#059669', // Emerald 600
  accentRed: '#dc2626',   // Red 600
  bgLight: '#f8fafc',     // Slate 50
  border: '#e2e8f0',      // Slate 200
  white: '#ffffff'
};

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

  // 1. ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ (Με Wake-up)
  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      
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
  }, [])

  useEffect(() => { 
    fetchInitialData() 
    const handleWakeUp = () => { if (document.visibilityState === 'visible') fetchInitialData() }
    document.addEventListener('visibilitychange', handleWakeUp)
    return () => document.removeEventListener('visibilitychange', handleWakeUp)
  }, [fetchInitialData])

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
    // ΕΛΕΓΧΟΣ ΥΠΟΧΡΕΩΤΙΚΩΝ ΠΕΔΙΩΝ
    if (!formData.full_name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    if (!formData.monthly_salary || Number(formData.monthly_salary) <= 0) {
      return alert('Ο μισθός είναι υποχρεωτικός και πρέπει να είναι μεγαλύτερος από 0!')
    }

    setLoading(true)
    
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null,
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null,
      salary: Number(formData.monthly_salary), // Αποθήκευση ως salary (συμβατό με pay-employee)
      monthly_salary: Number(formData.monthly_salary), // Διατήρηση monthly_salary για συμβατότητα
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
    <div style={iphoneWrapper}>
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>👥</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0, color: colors.primaryDark }}>Υπάλληλοι</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700', letterSpacing: '1px' }}>ΔΙΑΧΕΙΡΙΣΗ ΠΡΟΣΩΠΙΚΟΥ</p>
            </div>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>

        <button onClick={() => { setIsAdding(!isAdding); if(isAdding) resetForm(); setEditingId(null); }} style={isAdding ? cancelBtn : addBtn}>
          {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ'}
        </button>

        {isAdding && (
          <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : colors.primaryDark }}>
            <label style={labelStyle}>Ονοματεπώνυμο *</label>
            <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} placeholder="π.χ. Ιωάννης Παπαδόπουλος" />
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Μισθός (€) *</label>
                <input type="number" inputMode="decimal" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} style={{...inputStyle, border: '2px solid #cbd5e1'}} placeholder="0.00" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ημ. Πληρωμής</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}><label style={labelStyle}>ΑΜΚΑ</label><input value={formData.amka} onChange={e => setFormData({...formData, amka: e.target.value})} style={inputStyle} placeholder="1122..." /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Θέση</label><input value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} style={inputStyle} placeholder="π.χ. Barista" /></div>
            </div>

            <label style={{...labelStyle, marginTop: '16px'}}>IBAN Λογαριασμού</label>
            <input value={formData.iban} onChange={e => setFormData({...formData, iban: e.target.value})} style={inputStyle} placeholder="GR..." />

            <button onClick={handleSave} disabled={loading} style={{...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : colors.primaryDark}}>
              {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΠΡΟΣΘΗΚΗ ΥΠΑΛΛΗΛΟΥ')}
            </button>
          </div>
        )}

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ΕΝΕΡΓΟ ΠΡΟΣΩΠΙΚΟ ({employees.length})</p>
          
          {loading ? <p style={{textAlign:'center', padding:'20px', color: colors.secondaryText}}>Φόρτωση...</p> : employees.map((emp) => {
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
                    <p style={{ fontWeight: '700', color: colors.primaryDark, fontSize: '16px', margin: 0 }}>{emp.full_name.toUpperCase()}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                       <span style={badgeStyle}>ΣΕ {daysLeft} ΗΜΕΡΕΣ 📅</span>
                       {emp.position && <span style={{...badgeStyle, backgroundColor: colors.bgLight, color: colors.secondaryText, border: `1px solid ${colors.border}`}}>{emp.position}</span>}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href={`/pay-employee?id=${emp.id}&name=${emp.full_name}`} onClick={(e) => e.stopPropagation()} style={payBtnStyle}>ΠΛΗΡΩΜΗ</Link>
                    <div>
                      <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: remaining > 0 ? colors.accentRed : colors.accentGreen }}>
                        {remaining.toFixed(2)}€
                      </p>
                      <p style={{ margin: 0, fontSize: '9px', color: colors.secondaryText, fontWeight: '700', textTransform: 'uppercase' }}>Υπόλοιπο</p>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ backgroundColor: '#fcfcfc', padding: '18px', borderTop: `1px solid ${colors.border}` }}>
                    <div style={allTimeCard}>
                       <p style={labelSmallLight}>ΣΥΝΟΛΙΚΕΣ ΠΛΗΡΩΜΕΣ (ALL-TIME)</p>
                       <h3 style={{ fontSize: '26px', margin: 0, fontWeight: '800', color: colors.accentGreen }}>{totalPaidAllTime.toFixed(2)}€</h3>
                    </div>
                    
                    {emp.iban && <p style={{fontSize: '11px', color: colors.secondaryText, marginBottom: '15px'}}><strong>IBAN:</strong> {emp.iban}</p>}

                    <div style={{ marginBottom: '20px' }}>
                       <p style={historyTitle}>ΠΡΟΣΦΑΤΕΣ ΠΛΗΡΩΜΕΣ</p>
                       <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                          {transactions.filter(t => t.employee_id === emp.id).map(t => (
                            <div key={t.id} style={historyItem}>
                               <span style={{ color: colors.secondaryText, fontWeight: '700' }}>{t.date}</span>
                               <span style={{ fontWeight: '700', color: colors.primaryDark }}>{Number(t.amount).toFixed(2)}€</span>
                            </div>
                          ))}
                       </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setFormData({...emp, monthly_salary: emp.monthly_salary.toString()}); setEditingId(emp.id); setIsAdding(true); window.scrollTo(0,0); }} style={editBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                      <button onClick={async () => { if(confirm('Διαγραφή υπαλλήλου;')) { await supabase.from('employees').delete().eq('id', emp.id); fetchInitialData(); } }} style={deleteBtn}>🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const payBtnStyle: any = { backgroundColor: colors.accentBlue, color: 'white', padding: '8px 14px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', textDecoration: 'none', boxShadow: '0 4px 8px rgba(37, 99, 235, 0.2)' };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', boxShadow: '0 4px 12px rgba(30, 41, 59, 0.2)' };
const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}`, boxShadow: 'none' };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: '2px solid', marginBottom: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none', color: colors.primaryDark };
const saveBtnStyle: any = { width: '100%', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '15px', marginTop: '20px', cursor: 'pointer' };
const employeeCard: any = { backgroundColor: colors.white, borderRadius: '22px', border: `1px solid ${colors.border}`, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '700', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '6px', color: colors.accentBlue };
const allTimeCard: any = { backgroundColor: colors.primaryDark, padding: '20px', borderRadius: '18px', color: 'white', marginBottom: '20px', textAlign: 'center' };
const labelSmallLight: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '8px', letterSpacing: '1px' };
const historyTitle: any = { fontSize: '10px', fontWeight: '800', color: colors.primaryDark, marginBottom: '10px', paddingBottom: '6px', borderBottom: `2px solid ${colors.bgLight}`, letterSpacing: '0.5px' };
const historyItem: any = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '10px 0', borderBottom: `1px solid ${colors.bgLight}` };
const editBtn: any = { flex: 2, background: '#fffbeb', border: `1px solid #fef3c7`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#92400e' };
const deleteBtn: any = { background: '#fef2f2', border: `1px solid #fee2e2`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: colors.accentRed };

export default function EmployeesPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><EmployeesContent /></Suspense></main>
}