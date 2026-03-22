'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { toBusinessDayDateNormalized } from '@/lib/businessDate'
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
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const empId = searchParams.get('id') // fixed_asset_id
  const empName = searchParams.get('name')
  const storeId = searchParams.get('store')
  const mode = searchParams.get('mode')

  const [agreementType, setAgreementType] = useState('monthly') 
  const [baseAmount, setBaseAmount] = useState<number>(0)
  const [agreementDays, setAgreementDays] = useState<number>(26)
  const [absences, setAbsences] = useState<number>(0)
  const [workedDays, setWorkedDays] = useState<number>(1) 
  
  const [bonus, setBonus] = useState<string>('')
  const [extraOvertimeEuro, setExtraOvertimeEuro] = useState<string>('')
  const [pendingOvertimeHours, setPendingOvertimeHours] = useState<number>(0)
  const [advanceAmount, setAdvanceAmount] = useState<string>('')
  const [advanceTotal, setAdvanceTotal] = useState<number>(0)
  const [payrollSummaryRow, setPayrollSummaryRow] = useState<any | null>(null)
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
        .eq('store_id', storeId)
        .single();

      if (emp) {
        setAgreementType(emp.pay_basis || 'monthly');
        setBaseAmount(emp.pay_basis === 'monthly' ? (emp.monthly_salary || 0) : (emp.daily_rate || 0));
        setAgreementDays(emp.monthly_days || 26);
      }

      const businessAsOfDate = toBusinessDayDateNormalized(new Date()).toISOString().slice(0, 10)
      const { data: payrollRows, error: payrollRpcError } = await supabase.rpc('get_employee_payroll_cards_summary', {
        p_store_id: storeId,
        p_as_of_date: businessAsOfDate,
      })

      if (payrollRpcError) {
        console.error('[pay-employee] payroll RPC load failed', payrollRpcError)
      }

      const rpcRow = (payrollRows || []).find((row: any) => String(row.employee_id || '') === String(empId || '')) || null
      setPayrollSummaryRow(rpcRow)

      if (rpcRow) {
        const rpcMonthlySalary = Number(rpcRow.monthly_salary || 0)
        const rpcMonthlyDays = Number(rpcRow.monthly_days || 26)
        setBaseAmount(rpcMonthlySalary)
        setAgreementDays(rpcMonthlyDays)
        setAdvanceTotal(Number(rpcRow.total_advances || 0))
        setPendingOvertimeHours(Number(rpcRow.pending_overtime_hours || 0))
        setAbsences(Number(rpcRow.extra_days_off_current_month || 0))
        setExtraOvertimeEuro(Number(rpcRow.pending_overtime_amount || 0).toFixed(2))
      }

      const { data: overtimeRows, error: overtimeError } = await supabase
        .from('employee_overtimes')
        .select('hours')
        .eq('employee_id', empId)
        .eq('store_id', storeId)
        .eq('is_paid', false);

      if (!rpcRow && !overtimeError) {
        const totalPendingHours = (overtimeRows || []).reduce((sum, row) => sum + (Number(row.hours) || 0), 0);
        setPendingOvertimeHours(totalPendingHours);
      }

      // Fetch existing salary advances for this employee in this store
      const { data: advanceRows, error: advanceError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('store_id', storeId)
        .eq('type', 'salary_advance')
        .eq('is_settled', false)
        .or(`employee_id.eq.${empId},fixed_asset_id.eq.${empId}`);

      if (!rpcRow && !advanceError) {
        const totalAdvance = (advanceRows || []).reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0);
        setAdvanceTotal(totalAdvance);
      }
    } catch (_err) {
      // keep fallback behavior without failing the page
    } finally { setLoading(false) }
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

  const grossPayable = calculateCurrentBase() + (Number(bonus) || 0) + (Number(extraOvertimeEuro) || 0);
  const rawNetPayable = grossPayable - (advanceTotal || 0);
  const netPayable = Math.max(0, rawNetPayable);

  const hasRpcSummary = mode !== 'advance' && agreementType === 'monthly' && Boolean(payrollSummaryRow)
  const rpcMonthlySalary = Number(payrollSummaryRow?.monthly_salary || 0)
  const rpcTotalAdvances = Number(payrollSummaryRow?.total_advances || 0)
  const rpcPendingOvertimeHours = Number(payrollSummaryRow?.pending_overtime_hours || 0)
  const rpcPendingOvertimeAmount = Number(payrollSummaryRow?.pending_overtime_amount || 0)
  const rpcHourlyCost = Number(payrollSummaryRow?.hourly_cost || 0)
  const rpcIncludedDaysOff = Number(payrollSummaryRow?.included_days_off || 0)
  const rpcActualDaysOff = Number(payrollSummaryRow?.actual_days_off_current_month || 0)
  const rpcExtraDaysOff = Number(payrollSummaryRow?.extra_days_off_current_month || 0)
  const rpcDaysOffDeduction = Number(payrollSummaryRow?.days_off_deduction || 0)
  const rpcRemainingPay = Number(payrollSummaryRow?.remaining_pay || 0)
  const rpcComputedAmount = rpcMonthlySalary + rpcPendingOvertimeAmount - rpcDaysOffDeduction

  const effectiveGrossPayable = hasRpcSummary ? rpcComputedAmount : grossPayable
  const effectiveAdvanceTotal = hasRpcSummary ? rpcTotalAdvances : advanceTotal
  const effectiveRawNetPayable = hasRpcSummary ? rpcRemainingPay : rawNetPayable
  const effectiveNetPayable = hasRpcSummary ? rpcRemainingPay : netPayable

  async function handleFinalPayment() {
    if (!storeId) return toast.error('Σφάλμα καταστήματος');
    if (!empId) return toast.error('Σφάλμα υπαλλήλου');
    setLoading(true);

    try {
      if (mode === 'advance') {
        const amountNum = Number(advanceAmount)
        if (Number.isNaN(amountNum) || amountNum <= 0) {
          setLoading(false)
          return toast.error('Το ποσό πρέπει να είναι μεγαλύτερο από 0')
        }

        const notes = `Προκαταβολή μισθού | ${empName || ''}`

        const { error: transError } = await supabase.from('transactions').insert([{
          amount: -Math.abs(amountNum),
          type: 'salary_advance',
          category: 'Staff',
          method: paymentMethod,
          employee_id: empId,
          fixed_asset_id: empId,
          store_id: storeId,
          date: date,
          notes: notes,
          is_settled: false,
        }]);

        if (transError) throw transError;

        toast.success('Η προκαταβολή καταχωρήθηκε!');
        router.push(`/employees?store=${storeId}`);
        return;
      }

      // normal final payment (subtract advances)
      if (effectiveRawNetPayable < 0) {
        setLoading(false)
        return toast.error('Οι προκαταβολές είναι περισσότερες από το υπολογισμένο ποσό')
      }

      if (effectiveNetPayable <= 0) {
        setLoading(false)
        return toast.error('Το ποσό πληρωμής πρέπει να είναι μεγαλύτερο από 0')
      }

      const agreementLabel = agreementType === 'monthly' ? 'Μισθός' : 'Ημερομίσθιο';
      const daysOrAbsencesLabel = agreementType === 'monthly' ? `Απουσίες: ${absences}` : `Ημέρες: ${workedDays}`;
      const notes = `Εκκαθάριση ${empName || ''} | ${agreementLabel} | Ημέρες/Απουσίες: ${daysOrAbsencesLabel}`;

      const { error: payrollError } = await supabase.rpc('payroll_payment_atomic', {
        p_store_id: storeId,
        p_employee_id: empId,
        p_amount: effectiveNetPayable,
        p_method: paymentMethod,
        p_category: 'Staff',
        p_date: date,
        p_notes: notes,
        p_settle_advances: true,
        p_settle_overtimes: true,
        p_settle_tips: false,
      })

      if (payrollError) throw payrollError

      toast.success('Η πληρωμή καταχωρήθηκε και οι υπερωρίες εκκαθαρίστηκαν!');
      router.push(`/employees?store=${storeId}`);
    } catch (err: any) {
      console.error('[pay-employee] payment save failed', err)
      toast.error(err?.message || 'Αποτυχία πληρωμής');
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
              <h1 style={titleStyle}>{mode === 'advance' ? 'Προκαταβολή' : 'Εκκαθάριση'}</h1>
              <p style={subTitleStyle}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href={`/employees?store=${storeId}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </header>

          <div style={cardStyle}>
          {mode !== 'advance' && (
            <>
              <label style={labelStyle}>ΤΥΠΟΣ ΣΥΜΦΩΝΙΑΣ: <span style={{color: colors.accentBlue}}>{agreementType === 'monthly' ? 'ΜΗΝΙΑΙΟΣ' : 'ΗΜΕΡΟΜΙΣΘΙΟ'}</span></label>
              
              <div style={gridRow}>
                {agreementType === 'monthly' ? (
                  <>
                    <div style={inputGroup}>
                      <label style={smallLabel}>ΑΠΟΥΣΙΕΣ (ΗΜΕΡΕΣ)</label>
                      <input
                        type="number"
                        value={hasRpcSummary ? rpcExtraDaysOff : absences}
                        onChange={e => setAbsences(Number(e.target.value))}
                        style={inputStyle}
                        readOnly={hasRpcSummary}
                      />
                    </div>
                    <div style={inputGroup}>
                      <label style={smallLabel}>ΒΑΣΙΚΟΣ ΜΙΣΘΟΣ</label>
                      <div style={staticValue}>{(hasRpcSummary ? rpcMonthlySalary : baseAmount).toFixed(2)}€</div>
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
            </>
          )}

          {mode === 'advance' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={smallLabel}>ΠΟΣΟ ΠΡΟΚΑΤΑΒΟΛΗΣ (€)</label>
              <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
            </div>
          )}

          {mode !== 'advance' && (
            <>
              <div style={{...divider, margin: '20px 0'}} />

              <div style={inputGroup}>
                <label style={smallLabel}>BONUS / ΕΞΤΡΑ (€)</label>
                <input type="number" value={bonus} onChange={e => setBonus(e.target.value)} style={inputStyle} placeholder="0.00" />
              </div>

              <div style={{...inputGroup, marginTop: '15px'}}>
                <label style={smallLabel}>ΥΠΕΡΩΡΙΕΣ ΠΡΟΣ ΠΛΗΡΩΜΗ (€)</label>
                <input
                  type="number"
                  value={hasRpcSummary ? rpcPendingOvertimeAmount.toFixed(2) : extraOvertimeEuro}
                  onChange={e => setExtraOvertimeEuro(e.target.value)}
                  style={{...inputStyle, borderColor: colors.accentBlue}}
                  placeholder="0.00"
                  readOnly={hasRpcSummary}
                />
                <div style={overtimeHint}>
                  <Clock size={14} />
                  <span>Εκκρεμούν: {(hasRpcSummary ? rpcPendingOvertimeHours : pendingOvertimeHours).toFixed(2)} ώρες</span>
                </div>
              </div>

              {hasRpcSummary && (
                <div style={rpcSummaryBox}>
                  <p style={rpcSummaryTitle}>ΣΥΝΟΨΗ ΑΠΟ RPC</p>
                  <p style={rpcSummaryLine}>Ρεπό μήνα: {rpcActualDaysOff} / {rpcIncludedDaysOff}</p>
                  <p style={rpcSummaryLine}>Extra ρεπό: {rpcExtraDaysOff}</p>
                  <p style={rpcSummaryLine}>Αφαίρεση ρεπό: {rpcDaysOffDeduction.toFixed(2)}€</p>
                  <p style={rpcSummaryLine}>Εκκρεμείς υπερωρίες: {rpcPendingOvertimeHours.toFixed(2)} ώρες</p>
                  <p style={rpcSummaryLine}>Ωριαίο κόστος: {rpcHourlyCost.toFixed(2)}€</p>
                </div>
              )}
            </>
          )}

          <div style={resultBox}>
            {mode === 'advance' ? (
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={resultLabel}>ΠΟΣΟ ΠΡΟΚΑΤΑΒΟΛΗΣ</span>
                <span style={resultValue}>{(Number(advanceAmount) || 0).toFixed(2)}€</span>
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>ΥΠΟΛΟΓΙΣΜΕΝΟ ΠΟΣΟ</span>
                  <span style={resultValue}>{effectiveGrossPayable.toFixed(2)}€</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>ΠΡΟΚΑΤΑΒΟΛΕΣ</span>
                  <span style={resultValue}>{effectiveAdvanceTotal.toFixed(2)}€</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>ΤΕΛΙΚΟ ΠΛΗΡΩΤΕΟ</span>
                  <span style={resultValue}>{effectiveNetPayable.toFixed(2)}€</span>
                </div>
              </div>
            )}
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

          <button
            onClick={handleFinalPayment}
            disabled={loading || (mode === 'advance' ? Number(advanceAmount) <= 0 : effectiveRawNetPayable < 0)}
            style={payBtn}
          >
            {loading
              ? 'ΓΙΝΕΤΑΙ ΚΑΤΑΧΩΡΗΣΗ...'
              : mode === 'advance' ? <><Banknote size={18} /> ΚΑΤΑΧΩΡΗΣΗ ΠΡΟΚΑΤΑΒΟΛΗΣ</> : <><Banknote size={18} /> ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ</>}
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
const rpcSummaryBox: any = { marginTop: '12px', padding: '12px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight };
const rpcSummaryTitle: any = { margin: '0 0 8px 0', fontSize: '11px', fontWeight: '900', color: colors.primaryDark };
const rpcSummaryLine: any = { margin: '4px 0 0 0', fontSize: '11px', fontWeight: '700', color: colors.secondaryText };
const methodToggleWrap: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: colors.bgLight, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '4px' };
const methodToggleBtn: any = { border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '800', backgroundColor: 'transparent', color: colors.secondaryText, cursor: 'pointer' };
const methodToggleBtnActive: any = { backgroundColor: colors.white, color: colors.primaryDark, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' };

const inputGroup = { display: 'flex', flexDirection: 'column' as const };

export default function PayEmployeePage() {
  return <Suspense fallback={null}><PayEmployeeContent /></Suspense>
}