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

  // EXTRA ΠΑΡΟΧΕΣ (Κοινά και για τους δύο τύπους)
  const [overtime, setOvertime] = useState<string>('')
  const [bonus, setBonus] = useState<string>('')
  const [gifts, setGifts] = useState<string>('')

  // ΛΟΓΙΣΤΙΚΑ STATES
  const [accountingPayroll, setAccountingPayroll] = useState<string>('') 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState({ store_id: '', username: '' })

  // ΔΥΝΑΜΙΚΟΙ ΥΠΟΛΟΓΙΣΜΟΙ
  const calculateBase = () => {
    if (agreementType === 'monthly') {
      const rate = agreementSalary / agreementDays;
      return (agreementDays - absences) * rate;
    } else {
      return workedDays * dailyRateInput;
    }
  };

  const totalEarnings = calculateBase() + (Number(overtime) || 0) + (Number(bonus) || 0) + (Number(gifts) || 0);
  const bankAmount = Number(accountingPayroll) || 0;
  const autoCashAmount = totalEarnings - bankAmount;

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase.from('profiles').select('store_id, username').eq('id', session.user.id).maybeSingle()
      if (profile) setUserData({ store_id: profile.store_id, username: profile.username || 'Admin' })

      if (empId) {
        const { data: employee } = await supabase.from('employees').select('monthly_salary, monthly_days').eq('id', empId).maybeSingle()
        if (employee) {
          setAgreementSalary(employee.monthly_salary || 1000)
          setAgreementDays(employee.monthly_days || 26)
        }
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId])

  useEffect(() => { loadData() }, [loadData])

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

    const { error } = await supabase.from('transactions').insert(transactionBatch)
    if (!error) { 
      toast.success('Η πληρωμή καταχωρήθηκε!');
      router.push('/employees');
    } else { 
      toast.error(error.message); 
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
          {/* ΤΥΠΟΣ ΑΠΑΣΧΟΛΗΣΗΣ */}
          <div style={{ marginBottom: '20px' }}>
            <label style={subLabel}>ΤΥΠΟΣ ΑΠΑΣΧΟΛΗΣΗΣ</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAgreementType('monthly')} style={agreementType === 'monthly' ? activeTab : inactiveTab}>ΜΗΝΙΑΙΟΣ</button>
              <button onClick={() => setAgreementType('daily')} style={agreementType === 'daily' ? activeTab : inactiveTab}>ΗΜΕΡΟΜΙΣΘΙΟ</button>
            </div>
          </div>

          {/* ΡΥΘΜΙΣΕΙΣ ΒΑΣΙΚΟΥ */}
          <div style={agreementGrid}>
            {agreementType === 'monthly' ? (
              <>
                <div style={inputGroup}>
                  <label style={subLabel}>ΣΥΜΦΩΝΙΑ (ΗΜΕΡΕΣ)</label>
                  <select value={agreementDays} onChange={e => setAgreementDays(Number(e.target.value))} style={selectStyle}>
                    <option value={30}>30 Ημέρες (0 Ρεπό)</option>
                    <option value={26}>26 Ημέρες (1 Ρεπό)</option>
                    <option value={22}>22 Ημέρες (2 Ρεπό)</option>
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

          {/* EXTRA ΠΑΡΟΧΕΣ */}
          <p style={sectionTitle}>EXTRA ΠΑΡΟΧΕΣ (€)</p>
          <div style={extraGrid}>
            <div style={inputGroup}>
              <label style={subLabel}>ΥΠΕΡΩΡΙΕΣ</label>
              <input type="number" value={overtime} onChange={e => setOvertime(e.target.value)} style={smallInput} placeholder="0" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>BONUS</label>
              <input type="number" value={bonus} onChange={e => setBonus(e.target.value)} style={smallInput} placeholder="0" />
            </div>
            <div style={inputGroup}>
              <label style={subLabel}>ΔΩΡΑ</label>
              <input type="number" value={gifts} onChange={e => setGifts(e.target.value)} style={smallInput} placeholder="0" />
            </div>
          </div>

          {/* ΜΙΣΘΟΔΟΣΙΑ ΛΟΓΙΣΤΗ */}
          <div style={accountingBox}>
            <label style={{ fontSize: '10px', fontWeight: '900', color: colors.accentBlue }}>📄 ΜΙΣΘΟΔΟΣΙΑ ΛΟΓΙΣΤΗ (ΤΡΑΠΕΖΑ)</label>
            <input 
              type="number" 
              value={accountingPayroll} 
              onChange={e => setAccountingPayroll(e.target.value)} 
              placeholder="Ποσό τράπεζας"
              style={accountingInput}
            />
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

          <div style={{ marginTop: '20px' }}>
            <label style={subLabel}>ΗΜΕΡΟΜΗΝΙΑ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={smallInput} />
          </div>

          <button onClick={handlePayment} disabled={loading || totalEarnings <= 0} style={saveBtnStyle}>
            {loading ? 'ΚΑΤΑΧΩΡΗΣΗ...' : 'ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ'}
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

export default function PayEmployeePage() {
  return <main><Suspense fallback={<div>Φόρτωση...</div>}><PayEmployeeContent /></Suspense></main>
}