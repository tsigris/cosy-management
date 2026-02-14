'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { Eye, EyeOff, Power } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner' // Προσθήκη για ειδοποιήσεις

// --- ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
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

function EmployeesContent() {
  const router = useRouter()
  const [employees, setEmployees] = useState<any[]>([])
    const [showInactive, setShowInactive] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [overtimes, setOvertimes] = useState<any[]>([]) // Νέο state για υπερωρίες
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(null)
  
  const [payBasis, setPayBasis] = useState<'monthly' | 'daily'>('monthly')
  const [viewYear, setViewYear] = useState(new Date().getFullYear())

  // States για το modal υπερωρίας
  const [otModal, setOtModal] = useState<{empId: string, name: string} | null>(null)
  const [otHours, setOtHours] = useState('')

  const availableYears: number[] = [];
  for (let y = 2024; y <= new Date().getFullYear(); y++) {
    availableYears.push(y);
  }

  const [formData, setFormData] = useState({ 
    full_name: '', position: '', amka: '', iban: '', 
    bank_name: 'Εθνική Τράπεζα',
    monthly_salary: '', 
    daily_rate: '',
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
        const [empsRes, transRes, otRes] = await Promise.all([
          supabase.from('employees').select('*').eq('store_id', profile.store_id).order('full_name'),
          supabase.from('transactions').select('*').eq('store_id', profile.store_id).not('employee_id', 'is', null).order('date', { ascending: false }),
          supabase.from('employee_overtimes').select('*').eq('store_id', profile.store_id).eq('is_paid', false) // Μόνο απλήρωτες
        ])
        if (empsRes.data) setEmployees(empsRes.data)
        if (transRes.data) setTransactions(transRes.data)
        if (otRes.data) setOvertimes(otRes.data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInitialData() }, [fetchInitialData])

  // Υπολογισμός εκκρεμών ωρών
  const getPendingOtHours = (empId: string) => {
    return overtimes
      .filter(ot => ot.employee_id === empId)
      .reduce((acc, curr) => acc + Number(curr.hours), 0)
  }

  // Καταγραφή νέας υπερωρίας
  async function handleQuickOvertime() {
    if (!otHours || !otModal) return
    const { error } = await supabase.from('employee_overtimes').insert([{
      employee_id: otModal.empId,
      store_id: storeId,
      hours: Number(otHours),
      date: new Date().toISOString().split('T')[0],
      is_paid: false
    }])
    if (!error) {
      toast.success(`Προστέθηκαν ${otHours} ώρες στην ${otModal.name}`)
      setOtModal(null); setOtHours(''); fetchInitialData()
    }
  }

  const getCurrentMonthRemaining = (emp: any) => {
    const now = new Date();
    const currentMonthTrans = transactions.filter(t => 
      t.employee_id === emp.id && 
      new Date(t.date).getMonth() === now.getMonth() && 
      new Date(t.date).getFullYear() === now.getFullYear()
    );

    let totalPaid = 0;
    let extraEarnings = 0;
    const processedDates = new Set();

    currentMonthTrans.forEach(t => {
      totalPaid += Number(t.amount) || 0;
      if (!processedDates.has(t.date)) {
        const note = t.notes || "";
        const extract = (label: string) => {
          const regex = new RegExp(`${label}:\\s*(\\d+(\\.\\d+)?)`, 'i');
          const match = note.match(regex);
          return match ? parseFloat(match[1]) : 0;
        };
        extraEarnings += extract('Υπερ.') + extract('Bonus') + extract('Δώρο') + extract('Επίδ.');
        processedDates.add(t.date);
      }
    });

    const baseSalary = emp.pay_basis === 'daily' ? (Number(emp.daily_rate) || 0) : (Number(emp.monthly_salary) || 0);
    return (baseSalary + extraEarnings) - totalPaid;
  }

  const getDaysUntilPayment = (hireDateStr: string) => {
    if (!hireDateStr) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const hireDate = new Date(hireDateStr); hireDate.setHours(0, 0, 0, 0)
    let nextPayDate = new Date(hireDate)
    nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    while (nextPayDate <= today) {
      nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    }
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const getYearlyStats = (id: string) => {
    const yearTrans = transactions.filter(t => t.employee_id === id && new Date(t.date).getFullYear() === viewYear);
    let stats = { base: 0, overtime: 0, bonus: 0, total: 0 };
    const processedDates = new Set(); 

    yearTrans.forEach(t => {
      stats.total += Number(t.amount) || 0;
      if (!processedDates.has(t.date)) {
          const note = t.notes || "";
          const extract = (label: string) => {
            const regex = new RegExp(`${label}:\\s*(\\d+(\\.\\d+)?)`, 'i');
            const match = note.match(regex);
            return match ? parseFloat(match[1]) : 0;
          };
          stats.base += extract('Βασικός');
          stats.overtime += extract('Υπερ.');
          stats.bonus += extract('Bonus');
          processedDates.add(t.date);
      }
    });
    return stats;
  }

  async function handleSave() {
    const isSalaryMissing = payBasis === 'monthly' ? !formData.monthly_salary : !formData.daily_rate;
    if (!formData.full_name.trim() || isSalaryMissing) return alert('Συμπληρώστε τα υποχρεωτικά πεδία!')
    
    setLoading(true)
    const payload = {
      full_name: formData.full_name.trim(),
      position: formData.position.trim() || null, 
      amka: formData.amka.trim() || null,
      iban: formData.iban.trim() || null, 
      bank_name: formData.bank_name,
      pay_basis: payBasis,
      monthly_salary: payBasis === 'monthly' ? Number(formData.monthly_salary) : null,
      daily_rate: payBasis === 'daily' ? Number(formData.daily_rate) : null,
      start_date: formData.start_date, 
      store_id: storeId,
      is_active: true
    }
    const { error } = editingId ? await supabase.from('employees').update(payload).eq('id', editingId) : await supabase.from('employees').insert([payload])
    if (!error) { setEditingId(null); resetForm(); setIsAdding(false); fetchInitialData(); }
    else { alert(error.message); setLoading(false); }
  }

  async function deleteEmployee(id: string, name: string) {
    if(!confirm(`Οριστική διαγραφή του/της ${name}; Θα σβηστεί και το ιστορικό.`)) return;
    setLoading(true);
    await supabase.from('transactions').delete().eq('employee_id', id);
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if(!error) fetchInitialData(); else alert(error.message);
    setLoading(false);
  }

  async function deleteTransaction(id: string) {
    if(!confirm('Διαγραφή αυτής της πληρωμής;')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if(!error) fetchInitialData(); else alert(error.message);
  }

  const resetForm = () => {
    setFormData({ full_name: '', position: '', amka: '', iban: '', bank_name: 'Εθνική Τράπεζα', monthly_salary: '', daily_rate: '', start_date: new Date().toISOString().split('T')[0] });
    setPayBasis('monthly');
    setEditingId(null);
  }

  // Toggle is_active for employee
  async function toggleActive(id: string, currentActive: boolean) {
    setLoading(true);
    const { error } = await supabase.from('employees').update({ is_active: !currentActive }).eq('id', id);
    if (!error) {
      toast.success('Η κατάσταση ενημερώθηκε!');
      fetchInitialData();
    } else {
      toast.error('Σφάλμα ενημέρωσης');
      setLoading(false);
    }
  }

  // Filter employees based on showInactive
    const visibleEmployees = employees.filter(emp => showInactive ? true : emp.is_active !== false);

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={logoBoxStyle}>👥</div>
            <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0, color: colors.primaryDark }}>Υπάλληλοι</h1>
          </div>
          <Link href="/" style={backBtnStyle}>✕</Link>
        </div>
        <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowInactive(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: colors.secondaryText
            }}
            aria-label={showInactive ? 'Κρύψε ανενεργούς' : 'Εμφάνισε ανενεργούς'}
          >
            {showInactive ? <EyeOff size={20} /> : <Eye size={20} />}
            <span>{showInactive ? 'Κρύψε ανενεργούς' : 'Εμφάνισε ανενεργούς'}</span>
          </button>
        </div>
        {/* MODAL ΓΙΑ ΓΡΗΓΟΡΗ ΥΠΕΡΩΡΙΑ */}
        {otModal && (
          <div style={modalOverlay}>
            <div style={modalCard}>
              <h3 style={{margin:0, fontSize: '16px'}}>Καταγραφή Υπερωρίας</h3>
              <p style={{fontSize: '12px', color: colors.secondaryText}}>{otModal.name}</p>
              <input 
                type="number" 
                placeholder="Ώρες (π.χ. 1.5)" 
                value={otHours}
                onFocus={(e) => { if(e.target.value === "0") setOtHours('') }}
                onChange={e => setOtHours(e.target.value)}
                style={{...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px'}}
                autoFocus
              />
              <div style={{display:'flex', gap: '10px', marginTop: '20px'}}>
                <button onClick={() => setOtModal(null)} style={cancelBtnSmall}>ΑΚΥΡΟ</button>
                <button onClick={handleQuickOvertime} style={saveBtnSmall}>ΠΡΟΣΘΗΚΗ</button>
              </div>
            </div>
          </div>
        )}
        <button onClick={() => { if(isAdding) resetForm(); setIsAdding(!isAdding); }} style={isAdding ? cancelBtn : addBtn}>
          {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ'}
        </button>
        {isAdding && (
          <div style={{ ...formCard, borderColor: editingId ? '#f59e0b' : colors.primaryDark }}>
            <label style={labelStyle}>Ονοματεπώνυμο *</label>
            <input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={inputStyle} />
            <label style={{...labelStyle, marginTop: '16px'}}>Τύπος Συμφωνίας</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button onClick={() => setPayBasis('monthly')} style={payBasis === 'monthly' ? activeToggle : inactiveToggle}>ΜΗΝΙΑΙΟΣ</button>
              <button onClick={() => setPayBasis('daily')} style={payBasis === 'daily' ? activeToggle : inactiveToggle}>ΗΜΕΡΟΜΙΣΘΙΟ</button>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{payBasis === 'monthly' ? 'Μισθός (€) *' : 'Ημερομίσθιο (€) *'}</label>
                <input 
                  type="number" 
                  inputMode="decimal"
                  value={payBasis === 'monthly' ? formData.monthly_salary : formData.daily_rate} 
                  onFocus={(e) => { if(e.target.value === "0") setFormData({...formData, [payBasis === 'monthly' ? 'monthly_salary' : 'daily_rate']: ''}) }}
                  onChange={e => setFormData({
                    ...formData, 
                    [payBasis === 'monthly' ? 'monthly_salary' : 'daily_rate']: e.target.value
                  })} 
                  style={inputStyle} 
                  placeholder="0"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Ημ. Πρόσληψης</label>
                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>Τράπεζα Υπαλλήλου</label>
                <select 
                    value={formData.bank_name} 
                    onChange={e => setFormData({...formData, bank_name: e.target.value})} 
                    style={inputStyle}
                >
                    <option value="Εθνική Τράπεζα">Εθνική Τράπεζα</option>
                    <option value="Eurobank">Eurobank</option>
                    <option value="Alpha Bank">Alpha Bank</option>
                    <option value="Τράπεζα Πειραιώς">Τράπεζα Πειραιώς</option>
                    <option value="Viva Wallet">Viva Wallet</option>
                </select>
            </div>
            <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>IBAN Υπαλλήλου</label>
                <input 
                    value={formData.iban} 
                    onChange={e => setFormData({...formData, iban: e.target.value.toUpperCase()})} 
                    placeholder="GR00 0000 0000..." 
                    style={inputStyle} 
                />
            </div>
            <button onClick={handleSave} disabled={loading} style={{...saveBtnStyle, backgroundColor: editingId ? '#f59e0b' : colors.primaryDark}}>
              {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : (editingId ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΑΠΟΘΗΚΕΥΣΗ')}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
          {visibleEmployees.map((emp) => {
            const yearlyStats = getYearlyStats(emp.id);
            const monthlyRem = getCurrentMonthRemaining(emp);
            const isSelected = selectedEmpId === emp.id;
            const daysLeft = getDaysUntilPayment(emp.start_date);
            const pendingOt = getPendingOtHours(emp.id);
            const inactive = emp.is_active === false;
            return (
              <div key={emp.id} style={{ ...employeeCard, opacity: inactive ? 0.6 : 1 }}>
                <div onClick={() => setSelectedEmpId(selectedEmpId === emp.id ? null : emp.id)} style={{ padding: '18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '700', color: colors.primaryDark, fontSize: '16px', margin: 0 }}>{emp.full_name.toUpperCase()}</p>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{...badgeStyle, backgroundColor: (daysLeft === 0 || daysLeft === null) ? '#fef2f2' : '#eff6ff', color: (daysLeft === 0 || daysLeft === null) ? colors.accentRed : colors.accentBlue}}>
                        {daysLeft === 0 ? 'ΣΗΜΕΡΑ 💰' : `ΣΕ ${daysLeft} ΗΜΕΡΕΣ 📅`}
                      </span>
                      {pendingOt > 0 && (
                        <span style={{...badgeStyle, backgroundColor: '#fff7ed', color: '#c2410c'}}>
                          ⏱️ {pendingOt} ΩΡΕΣ
                        </span>
                      )}
                      {inactive && (
                        <span style={{...badgeStyle, backgroundColor: '#fee2e2', color: colors.accentRed}}>ΑΝΕΝΕΡΓΟΣ</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleActive(emp.id, emp.is_active !== false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      aria-label={inactive ? 'Ενεργοποίηση' : 'Απενεργοποίηση'}
                    >
                      <Power size={22} color={inactive ? colors.accentRed : colors.accentGreen} />
                    </button>
                    {!inactive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setOtModal({ empId: emp.id, name: emp.full_name }) }}
                        style={quickOtBtn}
                      >
                        + ⏱️
                      </button>
                    )}
                    <Link href={`/pay-employee?id=${emp.id}&name=${emp.full_name}`} onClick={(e) => e.stopPropagation()} style={payBtnStyle}>ΠΛΗΡΩΜΗ</Link>
                  </div>
                </div>
                {isSelected && (
                  <div style={{ backgroundColor: '#ffffff', padding: '18px', borderTop: `1px solid ${colors.border}` }}>
                    {/* ...employee details... */}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#dbeafe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, fontSize: '18px', fontWeight: 'bold', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const payBtnStyle: any = { backgroundColor: colors.accentBlue, color: 'white', padding: '8px 14px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', textDecoration: 'none', boxShadow: '0 4px 8px rgba(37, 99, 235, 0.2)' };
const addBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '14px', marginBottom: '20px' };
const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` };
const formCard: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: '2px solid', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' };
const labelStyle: any = { fontSize: '10px', fontWeight: '800', color: colors.secondaryText, display: 'block', marginBottom: '6px', textTransform: 'uppercase' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '15px', fontWeight: '700', backgroundColor: colors.bgLight, boxSizing: 'border-box', outline: 'none' };
const saveBtnStyle: any = { width: '100%', color: 'white', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: '800', fontSize: '15px', marginTop: '20px' };
const employeeCard: any = { backgroundColor: colors.white, borderRadius: '22px', border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: '12px' };
const badgeStyle: any = { fontSize: '9px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' };
const filterContainer: any = { display: 'flex', gap: '8px', marginBottom: '15px', padding: '8px', backgroundColor: colors.slate100, borderRadius: '12px' };
const filterSelect: any = { padding: '6px', borderRadius: '8px', border: `1px solid ${colors.border}`, backgroundColor: colors.white, fontSize: '12px', fontWeight: '800' };
const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' };
const statBox: any = { padding: '15px', backgroundColor: colors.slate100, borderRadius: '16px', textAlign: 'center' };
const statLabel: any = { margin: 0, fontSize: '8px', fontWeight: '800', color: colors.secondaryText };
const statValue: any = { margin: '4px 0 0', fontSize: '16px', fontWeight: '900', color: colors.primaryDark };
const historyTitle: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '12px', textTransform: 'uppercase' };
const historyItemExtended: any = { padding: '12px', borderRadius: '14px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight, marginBottom: '8px' };
const transDeleteBtn: any = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.5 };
const editBtn: any = { flex: 3, background: '#fffbeb', border: `1px solid #fef3c7`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: '#92400e' };
const deleteBtn: any = { flex: 2, background: '#fef2f2', border: `1px solid #fee2e2`, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: colors.accentRed };
const activeToggle: any = { flex: 1, padding: '12px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' };
const inactiveToggle: any = { flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: colors.secondaryText, border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' };

// ΝΕΑ STYLES ΓΙΑ ΤΟ TRACKER
const quickOtBtn: any = { backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d', padding: '10px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' };
const modalOverlay: any = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modalCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' };
const saveBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700' };
const cancelBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: 'white', color: colors.secondaryText, border: `1px solid ${colors.border}`, borderRadius: '12px', fontWeight: '700' };

export default function EmployeesPage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><EmployeesContent /></Suspense></main>
}