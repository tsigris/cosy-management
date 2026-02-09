'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// --- ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  slate100: '#f1f5f9'
};

const GREEK_MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"
];

function EmployeesContent() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  // Φίλτρα προβολής (Default: Τρέχων μήνας/έτος)
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  const [formData, setFormData] = useState({ 
    full_name: '', position: '', amka: '', iban: '', monthly_salary: '', 
    start_date: new Date().toISOString().split('T')[0] 
  })

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

  // --- ΣΥΝΑΡΤΗΣΕΙΣ ΥΠΟΛΟΓΙΣΜΟΥ ΜΕ ΦΙΛΤΡΑ ---

  const getMonthlyPaid = (id: string) => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.employee_id === id && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
      })
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  }

  const getDetailedStats = (id: string) => {
    const empTrans = transactions.filter(t => {
        const d = new Date(t.date);
        return t.employee_id === id && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });

    let stats = { base: 0, overtime: 0, bonus: 0, gift: 0, allowance: 0, total: 0 };

    empTrans.forEach(t => {
      const note = t.notes || "";
      stats.total += Number(t.amount) || 0;
      
      const extract = (label: string) => {
        const regex = new RegExp(`${label}:\\s*(\\d+(\\.\\d+)?)`, 'i');
        const match = note.match(regex);
        return match ? parseFloat(match[1]) : 0;
      };

      stats.base += extract('Βασικός');
      stats.overtime += extract('Υπερ.');
      stats.bonus += extract('Bonus');
      stats.gift += extract('Δώρο');
      stats.allowance += extract('Επίδ.');
    });

    return stats;
  }

  const getDaysUntilPayment = (startDateStr: string) => {
    if (!startDateStr) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const start = new Date(startDateStr); const payDay = start.getDate()
    let nextPayDate = new Date(today.getFullYear(), today.getMonth(), payDay)
    nextPayDate.setHours(0, 0, 0, 0)
    if (today > nextPayDate) nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, payDay)
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  async function handleSave() {
    if (!formData.full_name.trim()) return alert('Το όνομα είναι υποχρεωτικό!')
    if (!formData.monthly_salary || Number(formData.monthly_salary) <= 0) return alert('Ο μισθός είναι υποχρεωτικός!')

    setLoading(true)
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null,
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null,
      monthly_salary: Number(formData.monthly_salary),
      start_date: formData.start_date,
      store_id: storeId
    }

    try {
      const { error } = editingId 
        ? await supabase.from('employees').update(payload).eq('id', editingId)
        : await supabase.from('employees').insert([payload])

      if (!error) { setEditingId(null); resetForm(); setIsAdding(false); fetchInitialData(); }
      else { alert("Σφάλμα: " + error.message) }
    } catch (e: any) { alert(e.message) } finally { setLoading(false) }
  }

  const resetForm = () => setFormData({ full_name: '', position: '', amka: '', iban: '', monthly_salary: '', start_date: new Date().toISOString().split('T')[0] })

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
            <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} placeholder="Όνομα" />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Μισθός (€) *</label>
                <input type="number" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ημ. Πληρωμής</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <button onClick={handleSave} disabled={loading} style={{...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : colors.primaryDark}}>
              {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : 'ΑΠΟΘΗΚΕΥΣΗ ΣΤΟΙΧΕΙΩΝ'}
            </button>
          </div>
        )}

        {/* LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          {employees.map((emp) => {
            const stats = getDetailedStats(emp.id);
            const remaining = (Number(emp.monthly_salary) || 0) - getMonthlyPaid(emp.id);
            const isSelected = selectedEmpId === emp.id;
            const daysLeft = getDaysUntilPayment(emp.start_date);

            return (
              <div key={emp.id} style={employeeCard}>
                <div onClick={() => setSelectedEmpId(isSelected ? null : emp.id)} style={{ padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', color: colors.primaryDark, fontSize: '16px', margin: 0 }}>{emp.full_name.toUpperCase()}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                       <span style={{...badgeStyle, backgroundColor: daysLeft === 0 ? '#fef2f2' : '#eff6ff', color: daysLeft === 0 ? colors.accentRed : colors.accentBlue}}>
                         {daysLeft === 0 ? 'ΣΗΜΕΡΑ 💰' : `ΣΕ ${daysLeft} ΗΜΕΡΕΣ 📅`}
                       </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link href={`/pay-employee?id=${emp.id}&name=${emp.full_name}`} onClick={(e) => e.stopPropagation()} style={payBtnStyle}>ΠΛΗΡΩΜΗ</Link>
                    <div>
                        <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: remaining > 0 ? colors.accentRed : colors.accentGreen }}>{remaining.toFixed(2)}€</p>
                        <p style={{ margin: 0, fontSize: '8px', fontWeight: '800', color: colors.secondaryText }}>ΥΠΟΛΟΙΠΟ</p>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div style={{ backgroundColor: '#ffffff', padding: '18px', borderTop: `1px solid ${colors.border}` }}>
                    
                    {/* ΦΙΛΤΡΑ ΠΕΡΙΟΔΟΥ */}
                    <div style={filterContainer}>
                        <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))} style={filterSelect}>
                            {GREEK_MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                        </select>
                        <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))} style={filterSelect}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <p style={historyTitle}>ΑΝΑΛΥΣΗ ΜΗΝΑ</p>
                    <div style={statsGrid}>
                        <div style={statBox}><p style={statLabel}>ΒΑΣΙΚΟΣ</p><p style={statValue}>{stats.base.toFixed(2)}€</p></div>
                        <div style={statBox}><p style={statLabel}>BONUS/TIPS</p><p style={statValue}>{stats.bonus.toFixed(2)}€</p></div>
                        <div style={statBox}><p style={statLabel}>ΥΠΕΡΩΡΙΕΣ</p><p style={statValue}>{stats.overtime.toFixed(2)}€</p></div>
                        <div style={{...statBox, backgroundColor: colors.primaryDark}}><p style={{...statLabel, color: '#94a3b8'}}>ΣΥΝΟΛΟ</p><p style={{...statValue, color: colors.accentGreen}}>{stats.total.toFixed(2)}€</p></div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                       <p style={historyTitle}>ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ</p>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {transactions.filter(t => {
                              const d = new Date(t.date);
                              return t.employee_id === emp.id && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
                          }).length > 0 ? (
                            transactions.filter(t => {
                                const d = new Date(t.date);
                                return t.employee_id === emp.id && d.getMonth() === viewMonth && d.getFullYear() === viewYear;
                            }).map(t => (
                                <div key={t.id} style={historyItemExtended}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                      <span style={{ color: colors.secondaryText, fontWeight: '700', fontSize: '11px' }}>{new Date(t.date).toLocaleDateString('el-GR')}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                         <span>{t.method === 'Τράπεζα' ? '🏦' : '💵'}</span>
                                         <span style={{ fontWeight: '800', color: colors.primaryDark }}>{Number(t.amount).toFixed(2)}€</span>
                                      </div>
                                   </div>
                                   <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontStyle: 'italic' }}>{t.notes?.split('[')[1]?.replace(']', '') || 'Πληρωμή'}</p>
                                </div>
                            ))
                          ) : (
                            <p style={{textAlign:'center', fontSize:'11px', color: colors.secondaryText, padding:'10px'}}>Καμία πληρωμή για αυτή την περίοδο.</p>
                          )}
                       </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setFormData({...emp, monthly_salary: emp.monthly_salary.toString()}); setEditingId(emp.id); setIsAdding(true); window.scrollTo(0,0); }} style={editBtn}>ΕΠΕΞΕΡΓΑΣΙΑ ✎</button>
                      <button onClick={async () => { if(confirm('Διαγραφή;')) { await supabase.from('employees').delete().eq('id', emp.id); fetchInitialData(); } }} style={deleteBtn}>🗑️</button>
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
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const payBtnStyle: any = { backgroundColor: colors.accentBlue, color: 'white', padding: '8px 14px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', textDecoration: 'none' };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', marginBottom: '20px' };
const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: '2px solid', marginBottom: '25px' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'block', marginBottom: '6px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none' };
const saveBtnStyle: any = { width: '100%', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '15px', marginTop: '20px' };
const employeeCard: any = { backgroundColor: colors.white, borderRadius: '22px', border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' };

const filterContainer: any = { display: 'flex', gap: '8px', marginBottom: '15px' };
const filterSelect: any = { flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight, fontSize: '12px', fontWeight: '700', color: colors.primaryDark, outline: 'none' };

const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' };
const statBox: any = { padding: '15px', backgroundColor: colors.slate100, borderRadius: '16px', textAlign: 'center' };
const statLabel: any = { margin: 0, fontSize: '8px', fontWeight: '800', color: colors.secondaryText, letterSpacing: '0.5px' };
const statValue: any = { margin: '4px 0 0', fontSize: '16px', fontWeight: '900', color: colors.primaryDark };

const historyTitle: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '12px', letterSpacing: '1px', textTransform: 'uppercase' };
const historyItemExtended: any = { padding: '12px', borderRadius: '14px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight };
const editBtn: any = { flex: 2, background: '#fffbeb', border: `1px solid #fef3c7`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#92400e' };
const deleteBtn: any = { background: '#fef2f2', border: `1px solid #fee2e2`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: colors.accentRed };

export default function EmployeesPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><EmployeesContent /></Suspense></main>
}