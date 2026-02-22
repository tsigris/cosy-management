'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Calculator, Clock, Banknote } from 'lucide-react'

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
  
  const empId = searchParams.get('id') // fixed_asset_id
  const empName = searchParams.get('name')
  const storeId = searchParams.get('store')

  const [agreementType, setAgreementType] = useState('monthly') 
  const [baseAmount, setBaseAmount] = useState<number>(0)
  const [agreementDays, setAgreementDays] = useState<number>(26)
  const [absences, setAbsences] = useState<number>(0)
  const [workedDays, setWorkedDays] = useState<number>(1) 
  
  const [bonus, setBonus] = useState<string>('')
  const [extraOvertimeEuro, setExtraOvertimeEuro] = useState<string>('')
  const [pendingOvertimeHours, setPendingOvertimeHours] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  const loadEmployeeData = useCallback(async () => {
    if (!empId || !storeId) return;
    try {
      setLoading(true)
      const { data: emp, error } = await supabase
        .from('fixed_assets')
        .select('pay_basis, monthly_salary, daily_rate, monthly_days')
        .eq('id', empId)
        .single();

      if (emp) {
        setAgreementType(emp.pay_basis || 'monthly');
        setBaseAmount(emp.pay_basis === 'monthly' ? (emp.monthly_salary || 0) : (emp.daily_rate || 0));
        setAgreementDays(emp.monthly_days || 26);
      }

      const { data: overtimeRows, error: overtimeError } = await supabase
        .from('employee_overtimes')
        .select('hours')
        .eq('employee_id', empId)
        .eq('is_paid', false);

      if (overtimeError) throw overtimeError;
      const totalPendingHours = (overtimeRows || []).reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
      setPendingOvertimeHours(totalPendingHours);
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [empId, storeId])

  useEffect(() => { loadEmployeeData() }, [loadEmployeeData])

  // Υπολογισμός Βασικού Ποσού βάσει ημερών
  const calculateCurrentBase = () => {
    if (agreementType === 'monthly') {
      const ratePerDay = baseAmount / agreementDays;
      return Math.max(0, (agreementDays - absences) * ratePerDay);
    }
    return workedDays * baseAmount;
  };

  const totalPayable = calculateCurrentBase() + (Number(bonus) || 0) + (Number(extraOvertimeEuro) || 0);

  async function handleFinalPayment() {
    if (totalPayable <= 0) return toast.error('Το ποσό πρέπει να είναι μεγαλύτερο από 0');
    if (!storeId) return toast.error('Σφάλμα καταστήματος');
    if (!empId) return toast.error('Σφάλμα υπαλλήλου');
    setLoading(true);

    try {
      const agreementLabel = agreementType === 'monthly' ? 'Μισθός' : 'Ημερομίσθιο';
      const daysOrAbsencesLabel = agreementType === 'monthly' ? `Απουσίες: ${absences}` : `Ημέρες: ${workedDays}`;
      const notes = `Εκκαθάριση ${empName || ''} | ${agreementLabel} | Ημέρες/Απουσίες: ${daysOrAbsencesLabel}`;

      // 1. Καταγραφή στα Transactions
      const { error: transError } = await supabase.from('transactions').insert([{
        amount: -Math.abs(totalPayable),
        type: 'expense',
        category: 'Staff',
        method: paymentMethod,
        fixed_asset_id: empId,
        store_id: storeId,
        date: date,
        notes: notes
      }]);

      if (transError) throw transError;

      // 2. Μηδενισμός υπερωριών (Mark as paid)
      await supabase
        .from('employee_overtimes')
        .update({ is_paid: true })
        .eq('employee_id', empId)
        .eq('store_id', storeId)
        .eq('is_paid', false);

      toast.success('Η πληρωμή καταχωρήθηκε και οι υπερωρίες εκκαθαρίστηκαν!');
      router.push(`/employees?store=${storeId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><Calculator size={20} color="#2563eb" /></div>
            <div>
              <h1 style={titleStyle}>Εκκαθάριση</h1>
              <p style={subTitleStyle}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href={`/employees?store=${storeId}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </header>

        <div style={cardStyle}>
          <label style={labelStyle}>ΤΥΠΟΣ ΣΥΜΦΩΝΙΑΣ: <span style={{color: colors.accentBlue}}>{agreementType === 'monthly' ? 'ΜΗΝΙΑΙΟΣ' : 'ΗΜΕΡΟΜΙΣΘΙΟ'}</span></label>
          
          <div style={gridRow}>
            {agreementType === 'monthly' ? (
              <>
                <div style={inputGroup}>
                  <label style={smallLabel}>ΑΠΟΥΣΙΕΣ (ΗΜΕΡΕΣ)</label>
                  <input type="number" value={absences} onChange={e => setAbsences(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={inputGroup}>
                  <label style={smallLabel}>ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ</label>
                  <div style={staticValue}>{baseAmount}€</div>
                </div>
              </>
            ) : (
              <>
                <div style={inputGroup}>
                  <label style={smallLabel}>ΗΜΕΡΕΣ ΕΡΓΑΣΙΑΣ</label>
                  <input type="number" value={workedDays} onChange={e => setWorkedDays(Number(e.target.value))} style={inputStyle} />
                </div>
                <div style={inputGroup}>
                  <label style={smallLabel}>ΗΜΕΡΟΜΙΣΘΙΟ</label>
                  <div style={staticValue}>{baseAmount}€ / ημ.</div>
                </div>
              </>
            )}
          </div>

          <div style={{...divider, margin: '20px 0'}} />

          <div style={inputGroup}>
            <label style={smallLabel}>BONUS / ΕΞΤΡΑ (€)</label>
            <input type="number" value={bonus} onChange={e => setBonus(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>

          <div style={{...inputGroup, marginTop: '15px'}}>
            <label style={smallLabel}>ΥΠΕΡΩΡΙΕΣ ΠΡΟΣ ΠΛΗΡΩΜΗ (€)</label>
            <input type="number" value={extraOvertimeEuro} onChange={e => setExtraOvertimeEuro(e.target.value)} style={{...inputStyle, borderColor: colors.accentBlue}} placeholder="0.00" />
            <div style={overtimeHint}>
              <Clock size={14} />
              <span>Εκκρεμούν: {pendingOvertimeHours.toFixed(2)} ώρες</span>
            </div>
          </div>

          <div style={resultBox}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={resultLabel}>ΣΥΝΟΛΟ ΠΛΗΡΩΤΕΟ</span>
              <span style={resultValue}>{totalPayable.toFixed(2)}€</span>
            </div>
          </div>

          <div style={{marginTop: '20px'}}>
            <label style={smallLabel}>ΗΜΕΡΟΜΗΝΙΑ ΠΛΗΡΩΜΗΣ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ marginTop: '15px' }}>
            <label style={smallLabel}>ΜΕΘΟΔΟΣ ΠΛΗΡΩΜΗΣ</label>
            <div style={methodToggleWrap}>
              <button type="button" onClick={() => setPaymentMethod('Μετρητά')} style={{ ...methodToggleBtn, ...(paymentMethod === 'Μετρητά' ? methodToggleBtnActive : {}) }}>
                Μετρητά
              </button>
              <button type="button" onClick={() => setPaymentMethod('Τράπεζα')} style={{ ...methodToggleBtn, ...(paymentMethod === 'Τράπεζα' ? methodToggleBtnActive : {}) }}>
                Τράπεζα
              </button>
            </div>
          </div>

          <button onClick={handleFinalPayment} disabled={loading || totalPayable <= 0} style={payBtn}>
            {loading ? 'ΓΙΝΕΤΑΙ ΚΑΤΑΧΩΡΗΣΗ...' : <><Banknote size={18} /> ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// STYLES (✅ 16px Optimized)
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto' };
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const titleStyle = { fontWeight: '900', fontSize: '20px', margin: 0, color: colors.primaryDark };
const subTitleStyle = { margin: 0, fontSize: '12px', fontWeight: '800', color: colors.secondaryText };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#eef2ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` };

const cardStyle: any = { backgroundColor: colors.white, padding: '25px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' };
const labelStyle: any = { fontSize: '12px', fontWeight: '900', color: colors.secondaryText, display: 'block', marginBottom: '15px' };
const smallLabel: any = { fontSize: '11px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' };
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none' };
const staticValue: any = { padding: '14px', fontSize: '16px', fontWeight: '800', color: colors.primaryDark };
const gridRow: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const divider = { height: '1px', backgroundColor: colors.border };

const resultBox: any = { marginTop: '25px', padding: '20px', backgroundColor: colors.primaryDark, borderRadius: '18px', color: 'white' };
const resultLabel = { fontSize: '12px', fontWeight: '800', opacity: 0.8 };
const resultValue = { fontSize: '24px', fontWeight: '900' };

const payBtn: any = { width: '100%', marginTop: '25px', padding: '18px', backgroundColor: colors.accentGreen, color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const overtimeHint: any = { marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: colors.secondaryText };
const methodToggleWrap: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: colors.bgLight, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '4px' };
const methodToggleBtn: any = { border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '800', backgroundColor: 'transparent', color: colors.secondaryText, cursor: 'pointer' };
const methodToggleBtnActive: any = { backgroundColor: colors.white, color: colors.primaryDark, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' };

const inputGroup = { display: 'flex', flexDirection: 'column' as const };

export default function PayEmployeePage() {
  return <Suspense fallback={null}><PayEmployeeContent /></Suspense>
}