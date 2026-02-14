'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff'
};

function PayEmployeeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const empId = searchParams.get('id')
  const empName = searchParams.get('name')

  // STATES ΥΠΟΛΟΓΙΣΜΟΥ
  const [agreementType, setAgreementType] = useState('monthly') 
  const [agreementSalary, setAgreementSalary] = useState<number>(1000)
  const [agreementDays, setAgreementDays] = useState<number>(26)
  const [absences, setAbsences] = useState<number>(0)
  const [workedDays, setWorkedDays] = useState<number>(1) 
  const [dailyRateInput, setDailyRateInput] = useState<number>(50) 

  // EXTRA ΠΑΡΟΧΕΣ
  const [overtimeAmount, setOvertimeAmount] = useState<string>('')
  const [bonus, setBonus] = useState<string>('')
  const [gifts, setGifts] = useState<string>('')
  
  // ΚΑΡΤΕΛΑ ΥΠΕΡΩΡΙΩΝ
  const [overtimeList, setOvertimeList] = useState<any[]>([])
  const [pendingOtIds, setPendingOtIds] = useState<string[]>([])

  // ΛΟΓΙΣΤΙΚΑ STATES
  const [accountingPayroll, setAccountingPayroll] = useState<string>('') 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).maybeSingle()
      if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })

      if (empId) {
        const [empRes, otRes] = await Promise.all([
          supabase.from('employees').select('monthly_salary, monthly_days, pay_basis, daily_rate').eq('id', empId).maybeSingle(),
          supabase.from('employee_overtimes').select('*').eq('employee_id', empId).eq('is_paid', false).order('created_at', { ascending: false })
        ])

        if (empRes.data) {
          const emp = empRes.data;
          setAgreementType(emp.pay_basis || 'monthly');
          setAgreementSalary(emp.monthly_salary || 1000);
          setAgreementDays(emp.monthly_days || 26);
          setDailyRateInput(emp.daily_rate || 50);
        }

        if (otRes.data) {
          setOvertimeList(otRes.data);
          const totalHours = otRes.data.reduce((acc, curr) => acc + Number(curr.hours), 0);
          setOvertimeAmount(totalHours.toString()); 
          setPendingOtIds(otRes.data.map(ot => ot.id));
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId])

  useEffect(() => { loadData() }, [loadData])

  // 1. ΔΙΑΓΡΑΦΗ ΥΠΕΡΩΡΙΑΣ
  async function handleDeleteOvertime(id: string) {
    if (!confirm('Θέλετε να διαγράψετε αυτή την υπερωρία;')) return;
    const { error } = await supabase.from('employee_overtimes').delete().eq('id', id);
    if (!error) {
      toast.success('Διαγράφηκε επιτυχώς');
      loadData();
    }
  }

  // 2. ΠΛΗΡΩΜΗ ΜΕ ΧΕΙΡΟΚΙΝΗΤΟ ΠΟΣΟ
  async function handlePaySingleOvertime(ot: any) {
    const manualAmount = window.prompt(`Εισάγετε το ποσό πληρωμής για τις ${ot.hours} ώρες υπερωρίας:`, "0.00");

    if (manualAmount === null) return; // Ο χρήστης πάτησε άκυρο
    const finalAmount = Number(manualAmount);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      return toast.error('Παρακαλώ εισάγετε ένα έγκυρο ποσό.');
    }

    try {
      // Ενημέρωση υπερωρίας
      await supabase.from('employee_overtimes').update({ is_paid: true }).eq('id', ot.id);
      
      // Καταγραφή στα έξοδα
      await supabase.from('transactions').insert([{
        amount: finalAmount,
        type: 'expense',
        category: 'Προσωπικό',
        method: 'Μετρητά',
        notes: `Πληρωμή Υπερωρίας: ${empName} (${ot.hours} ώρες)`,
        store_id: userData.store_id,
        date: new Date().toISOString().split('T')[0]
      }]);

      toast.success(`Πληρώθηκαν ${finalAmount.toFixed(2)}€`);
      loadData();
    } catch (err) {
      toast.error('Σφάλμα κατά την πληρωμή');
    }
  }

  const calculateBase = () => {
    if (agreementType === 'monthly') {
      const rate = agreementSalary / agreementDays;
      return (agreementDays - absences) * rate;
    } else {
      return workedDays * dailyRateInput;
    }
  };

  const totalEarnings = calculateBase() + (Number(overtimeAmount) || 0) + (Number(bonus) || 0) + (Number(gifts) || 0);
  const bankAmount = Number(accountingPayroll) || 0;
  const autoCashAmount = totalEarnings - bankAmount;

  async function handlePayment() {
    if (totalEarnings <= 0) return toast.error('Υπολογίστε το ποσό πληρωμής.')
    setLoading(true)
    
    const breakdown = `Σύνολο: ${totalEarnings.toFixed(2)}€ (Τράπεζα: ${bankAmount}€, Μετρητά: ${autoCashAmount.toFixed(2)}€)`;
    const transactionBatch = [];
    
    if (bankAmount > 0) {
      transactionBatch.push({
        amount: bankAmount, type: 'expense', category: 'Προσωπικό', method: 'Τράπεζα',
        date, employee_id: empId, store_id: userData.store_id, created_by_name: userData.username,
        notes: `Μισθοδοσία ${empName} (Λογιστής) [${breakdown}]`
      });
    }
    if (autoCashAmount > 0) {
      transactionBatch.push({
        amount: autoCashAmount, type: 'expense', category: 'Προσωπικό', method: 'Μετρητά',
        date, employee_id: empId, store_id: userData.store_id, created_by_name: userData.username,
        notes: `Διαφορά Μισθού ${empName} (Μετρητά) [${breakdown}]`
      });
    }

    const { data: transData, error: transError } = await supabase.from('transactions').insert(transactionBatch).select();

    if (!transError) { 
      if (pendingOtIds.length > 0) {
        await supabase.from('employee_overtimes').update({ is_paid: true, transaction_id: transData[0].id }).in('id', pendingOtIds);
      }
      toast.success('Η πληρωμή ολοκληρώθηκε!');
      router.push('/employees');
    } else { 
      toast.error(transError.message); 
      setLoading(false); 
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '50px' }}>
        
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}>⚖️</div>
            <div>
              <h1 style={{ fontWeight: '800', fontSize: '18px', margin: 0 }}>Εκκαθάριση</h1>
              <p style={{ margin: 0, fontSize: '10px', color: colors.secondaryText, fontWeight: '700' }}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href="/employees" style={backBtnStyle}>✕</Link>
        </div>

        <div style={formCardStyle}>
          <div style={{ marginBottom: '20px' }}>
            <label style={subLabel}>ΤΥΠΟΣ ΑΠΑΣΧΟΛΗΣΗΣ</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAgreementType('monthly')} style={agreementType === 'monthly' ? activeTab : inactiveTab}>ΜΗΝΙΑΙΟΣ</button>
              <button onClick={() => setAgreementType('daily')} style={agreementType === 'daily' ? activeTab : inactiveTab}>ΗΜΕΡΟΜΙΣΘΙΟ</button>
            </div>
          </div>

          <div style={agreementGrid}>
            {agreementType === 'monthly' ? (
              <>
                <div style={inputGroup}>
                  <label style={subLabel}>ΣΥΜΦΩΝΙΑ (ΗΜΕΡΕΣ)</label>
                  <select value={agreementDays} onChange={e => setAgreementDays(Number(e.target.value))} style={selectStyle}>
                    <option value={26}>26 Ημέρες</option>
                    <option value={30}>30 Ημέρες</option>
                  </select>
                </div>
                <div style={inputGroup}>
                  <label style={subLabel}>ΑΠΟΥΣΙΕΣ (-)</label>
                  <input type="number" value={absences} onChange={e => setAbsences(Number(e.target.value))} style={smallInput} />
                </div>
              </>
            ) : (
              <>
                <div style={inputGroup}>
                  <label style={subLabel}>ΗΜΕΡΟΜΙΣΘΙΟ (€)</label>
                  <input type="number" value={dailyRateInput} onChange={e => setDailyRateInput(Number(e.target.value))} style={smallInput} />
                </div>
                <div style={inputGroup}>
                  <label style={subLabel}>ΗΜΕΡΕΣ ΕΡΓΑΣΙΑΣ</label>
                  <input type="number" value={workedDays} onChange={e => setWorkedDays(Number(e.target.value))} style={smallInput} />
                </div>
              </>
            )}
          </div>

          <p style={sectionTitle}>EXTRA ΠΑΡΟΧΕΣ (€)</p>
          <div style={extraGrid}>
            <div style={inputGroup}>
              <label style={subLabel}>ΥΠΕΡΩΡΙΕΣ (€)</label>
              <input type="number" value={overtimeAmount} onChange={e => setOvertimeAmount(e.target.value)} style={smallInput} />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>BONUS</label>
              <input type="number" value={bonus} onChange={e => setBonus(e.target.value)} style={smallInput} />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΔΩΡΑ</label>
              <input type="number" value={gifts} onChange={e => setGifts(e.target.value)} style={smallInput} />
            </div>
          </div>

          {/* ΚΑΡΤΕΛΑ ΥΠΕΡΩΡΙΩΝ (ΙΣΤΟΡΙΚΟ) */}
          <div style={overtimeCard}>
            <p style={{...sectionTitle, marginTop: 0}}>📋 ΕΚΚΡΕΜΕΙΣ ΥΠΕΡΩΡΙΕΣ ({overtimeList.length})</p>
            {overtimeList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overtimeList.map(ot => (
                  <div key={ot.id} style={otRow}>
                    <div>
                      <span style={otDate}>{new Date(ot.created_at).toLocaleDateString('el-GR')}</span>
                      <span style={otHours}>{ot.hours} Ώρες</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handlePaySingleOvertime(ot)} style={otPayBtn}>✅ ΠΛΗΡΩΜΗ</button>
                      <button onClick={() => handleDeleteOvertime(ot.id)} style={otDelBtn}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '11px', color: colors.secondaryText, textAlign: 'center', margin: '10px 0' }}>Καμία εκκρεμότητα</p>
            )}
          </div>

          <div style={accountingBox}>
            <label style={{ fontSize: '10px', fontWeight: '900', color: colors.accentBlue }}>📄 ΜΙΣΘΟΔΟΣΙΑ ΛΟΓΙΣΤΗ (ΤΡΑΠΕΖΑ)</label>
            <input type="number" value={accountingPayroll} onChange={e => setAccountingPayroll(e.target.value)} style={accountingInput} />
          </div>

          <div style={resultRow}>
            <div style={resultItem}>
                <label style={subLabel}>ΣΥΝΟΛΟ ΠΛΗΡΩΤΕΟ</label>
                <p style={amountLarge}>{totalEarnings.toFixed(2)}€</p>
            </div>
            <div style={resultItem}>
                <label style={subLabel}>ΥΠΟΛΟΙΠΟ ΜΕΤΡΗΤΑ</label>
                <p style={{ ...amountLarge, color: colors.accentGreen }}>{autoCashAmount.toFixed(2)}€</p>
            </div>
          </div>

          <button onClick={handlePayment} disabled={loading || totalEarnings <= 0} style={saveBtnStyle}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΜΗΝΙΑΙΑΣ ΠΛΗΡΩΜΗΣ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowY: 'auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#e0f2fe', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };
const formCardStyle: any = { backgroundColor: colors.white, padding: '24px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' };
const sectionTitle: any = { fontSize: '10px', fontWeight: '900', color: colors.primaryDark, margin: '20px 0 10px', letterSpacing: '0.5px' };
const subLabel: any = { fontSize: '9px', fontWeight: '800', color: colors.secondaryText, marginBottom: '5px', display: 'block' };
const activeTab: any = { flex: 1, padding: '10px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700' };
const inactiveTab: any = { flex: 1, padding: '10px', backgroundColor: '#f1f5f9', color: colors.secondaryText, border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700' };
const agreementGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' };
const extraGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' };
const inputGroup: any = { display: 'flex', flexDirection: 'column' };
const smallInput: any = { width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '14px', fontWeight: '700', outline: 'none' };
const selectStyle: any = { ...smallInput };
const accountingBox: any = { padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '15px', border: `1px solid #bae6fd`, margin: '15px 0' };
const accountingInput: any = { width: '100%', padding: '10px', marginTop: '5px', borderRadius: '8px', border: `2px solid ${colors.accentBlue}`, fontSize: '18px', fontWeight: '900' };
const resultRow: any = { display: 'flex', gap: '20px', marginTop: '10px' };
const resultItem: any = { flex: 1 };
const amountLarge: any = { margin: 0, fontSize: '20px', fontWeight: '900', color: colors.primaryDark };
const saveBtnStyle: any = { width: '100%', padding: '18px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '16px', fontWeight: '800', marginTop: '25px' };

const overtimeCard: any = { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '18px', border: `1px solid ${colors.border}`, marginTop: '15px' };
const otRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '10px', borderRadius: '12px', border: `1px solid ${colors.border}`, marginBottom: '5px' };
const otDate: any = { fontSize: '11px', fontWeight: '800', color: colors.primaryDark, marginRight: '8px' };
const otHours: any = { fontSize: '10px', fontWeight: '700', color: colors.accentBlue, backgroundColor: '#eff6ff', padding: '3px 6px', borderRadius: '6px' };
const otPayBtn: any = { border: 'none', backgroundColor: '#ecfdf5', color: '#059669', padding: '8px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' };
const otDelBtn: any = { border: 'none', backgroundColor: '#fef2f2', color: '#accentRed', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' };

export default function PayEmployeePage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
}