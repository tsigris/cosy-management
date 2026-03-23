'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getTodayDateISO } from '@/lib/businessDate'
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
  const [agreedExtraSalary, setAgreedExtraSalary] = useState<number>(0)
  const [pendingOvertimeHours, setPendingOvertimeHours] = useState<number>(0)
  const [advanceAmount, setAdvanceAmount] = useState<string>('')
  const [bankAmount, setBankAmount] = useState<string>('')
  const [cashAmount, setCashAmount] = useState<string>('')
  const [lastEditedField, setLastEditedField] = useState<'bank' | 'cash' | null>(null)
  const [advanceTotal, setAdvanceTotal] = useState<number>(0)
  const [payrollSummaryRow, setPayrollSummaryRow] = useState<any | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [date, setDate] = useState(getTodayDateISO())
  const [loading, setLoading] = useState(true)

  const loadEmployeeData = useCallback(async () => {
    if (!empId || !storeId) return;
    try {
      setLoading(true)
      const { data: empRows, error: empError } = await supabase
        .from('fixed_assets')
        .select('id, pay_basis, monthly_salary, daily_rate, monthly_days, agreed_extra_salary, store_id')
        .eq('id', empId)
        .or(`store_id.eq.${storeId},store_id.is.null`)
        .limit(1)

      const emp = empRows?.[0] ?? null

      console.log('[pay-employee] empError', empError)
      console.log('[pay-employee] empRows', empRows)
      console.log('[pay-employee] emp', emp)
      console.log('[pay-employee] emp monthly_salary', emp?.monthly_salary)
      console.log('[pay-employee] emp monthly_days', emp?.monthly_days)
      console.log('[pay-employee] emp agreed_extra_salary', emp?.agreed_extra_salary)

      if (emp) {
        const agreedExtraSalary = Number(emp?.agreed_extra_salary ?? 0)
        setAgreementType(emp.pay_basis || 'monthly')
        setBaseAmount(
          emp.pay_basis === 'monthly'
            ? Number(emp.monthly_salary ?? 0)
            : Number(emp.daily_rate ?? 0)
        )
        setAgreementDays(Number(emp.monthly_days ?? 26))
        setAgreedExtraSalary(agreedExtraSalary)
      }

      const businessAsOfDate = getTodayDateISO()
      const { data: rpcRowData, error: payrollRpcError } = await supabase.rpc('get_employee_payroll_card_for_employee', {
        p_store_id: storeId,
        p_employee_id: empId,
        p_as_of_date: businessAsOfDate,
      }).maybeSingle()
      const rpcRow = (rpcRowData as any) || null

      if (payrollRpcError) {
        console.error('[pay-employee] payroll RPC load failed', payrollRpcError)
      }
      console.log('[pay-employee] payrollSummaryRow', rpcRow)
      console.log('[pay-employee] rpcRow', rpcRow)

      setPayrollSummaryRow(rpcRow || null)

      if (rpcRow) {
        const rpcMonthlySalary = Number(rpcRow.monthly_salary || 0)
        const rpcMonthlyDays = Number(rpcRow.monthly_days || 26)
        setBaseAmount(rpcMonthlySalary)
        setAgreementDays(rpcMonthlyDays)
        setAdvanceTotal(Number(rpcRow.total_advances || 0))
        setPendingOvertimeHours(Number(rpcRow.pending_overtime_hours || 0))
        setAbsences(Number(rpcRow.extra_days_off_current_month || 0))
        setExtraOvertimeEuro(Number(rpcRow.pending_overtime_amount || 0).toFixed(2))
        setAgreedExtraSalary(Number(rpcRow.agreed_extra_salary ?? emp?.agreed_extra_salary ?? 0))
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
    } catch (err) {
      console.error('[pay-employee] loadEmployeeData failed', err)
    } finally {
      setLoading(false)
    }
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

  const manualBonus = Number(bonus || 0)
  const manualOvertime = Number(extraOvertimeEuro) || 0
  const computedGrossPayable = calculateCurrentBase() + manualOvertime
  const computedRawRemainingPayroll = computedGrossPayable - (advanceTotal || 0)

  const hasRpcSummary = mode !== 'advance' && agreementType === 'monthly' && Boolean(payrollSummaryRow)
  const rpcMonthlySalary = Number(payrollSummaryRow?.monthly_salary || 0)
  const rpcAgreedExtraSalary = Number(payrollSummaryRow?.agreed_extra_salary || 0)
  const rpcTotalAdvances = Number(payrollSummaryRow?.total_advances || 0)
  const rpcPendingOvertimeHours = Number(payrollSummaryRow?.pending_overtime_hours || 0)
  const rpcPendingOvertimeAmount = Number(payrollSummaryRow?.pending_overtime_amount || 0)
  const rpcHourlyCost = Number(payrollSummaryRow?.hourly_cost || 0)
  const rpcIncludedDaysOff = Number(payrollSummaryRow?.included_days_off || 0)
  const rpcActualDaysOff = Number(payrollSummaryRow?.actual_days_off_current_month || 0)
  const rpcExtraDaysOff = Number(payrollSummaryRow?.extra_days_off_current_month || 0)
  const rpcDaysOffDeduction = Number(payrollSummaryRow?.days_off_deduction || 0)
  const remainingPayrollOnly = Number(payrollSummaryRow?.remaining_payroll_only ?? 0)
  const agreedExtraSalaryFromRpc = Number(payrollSummaryRow?.agreed_extra_salary ?? 0)
  const rpcFinalPayable = Number(payrollSummaryRow?.final_payable ?? 0)

  const effectiveAgreedExtraSalary = hasRpcSummary ? agreedExtraSalaryFromRpc : agreedExtraSalary
  const effectivePayrollRemaining = hasRpcSummary ? remainingPayrollOnly : computedRawRemainingPayroll
  const effectiveRemainingPayroll = Math.max(0, effectivePayrollRemaining)
  const effectiveFinalPayable = hasRpcSummary ? rpcFinalPayable : Math.max(0, effectivePayrollRemaining + effectiveAgreedExtraSalary)
  const finalPayable = hasRpcSummary ? rpcFinalPayable + manualBonus : Math.max(0, effectiveFinalPayable + manualBonus)
  const finalPayableSafe = Math.max(0, finalPayable)
  const parseAmount = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const clampAmount = (value: number, maxValue: number) => Math.min(Math.max(value, 0), maxValue)

  const rpcDisplaySalaryBasis = rpcMonthlySalary + rpcAgreedExtraSalary
  console.log('[payroll-rpc-display-cost]', {
    monthly_salary: rpcMonthlySalary,
    agreed_extra_salary: rpcAgreedExtraSalary,
    display_salary_basis: rpcDisplaySalaryBasis,
    monthly_days: Number(payrollSummaryRow?.monthly_days || 0),
    daily_cost: Number(payrollSummaryRow?.daily_cost || 0),
    hourly_cost: Number(payrollSummaryRow?.hourly_cost || 0),
  })

  console.log('[pay-employee-rpc] payrollSummaryRow', payrollSummaryRow)
  console.log('[pay-employee-rpc] remaining_payroll_only', payrollSummaryRow?.remaining_payroll_only, 'agreed_extra_salary', payrollSummaryRow?.agreed_extra_salary, 'final_payable', payrollSummaryRow?.final_payable, 'bonus', Number(bonus || 0))
  const bankAmountNum = clampAmount(parseAmount(bankAmount), finalPayableSafe)
  const cashAmountNum = clampAmount(parseAmount(cashAmount), finalPayableSafe)
  console.log('[pay-employee-split-init-fix]', {
    finalPayable,
    bankAmount,
    cashAmount,
    lastEditedField,
  })

  const handleBankAmountChange = (value: string) => {
    const normalizedBank = clampAmount(parseAmount(value), finalPayableSafe)
    const normalizedCash = Math.max(0, finalPayableSafe - normalizedBank)
    setLastEditedField('bank')
    setBankAmount(value === '' ? '' : String(normalizedBank))
    setCashAmount(normalizedCash.toFixed(2))
  }

  const handleCashAmountChange = (value: string) => {
    const normalizedCash = clampAmount(parseAmount(value), finalPayableSafe)
    const normalizedBank = Math.max(0, finalPayableSafe - normalizedCash)
    setLastEditedField('cash')
    setCashAmount(value === '' ? '' : String(normalizedCash))
    setBankAmount(normalizedBank.toFixed(2))
  }

  useEffect(() => {
    if (mode === 'advance') return
    if (lastEditedField === null) return

    if (lastEditedField === 'cash') {
      const nextCash = clampAmount(parseAmount(cashAmount), finalPayableSafe)
      const nextBank = Math.max(0, finalPayableSafe - nextCash)
      const nextCashText = nextCash.toFixed(2)
      const nextBankText = nextBank.toFixed(2)
      if (cashAmount !== '' && cashAmount !== nextCashText) setCashAmount(nextCashText)
      if (bankAmount !== nextBankText) setBankAmount(nextBankText)
      return
    }

    const nextBank = clampAmount(parseAmount(bankAmount), finalPayableSafe)
    const nextCash = Math.max(0, finalPayableSafe - nextBank)
    const nextBankText = bankAmount === '' ? '' : nextBank.toFixed(2)
    const nextCashText = nextCash.toFixed(2)
    if (bankAmount !== nextBankText) setBankAmount(nextBankText)
    if (cashAmount !== nextCashText) setCashAmount(nextCashText)
  }, [finalPayableSafe, mode, lastEditedField])

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

      // normal final payment (remaining payroll + agreed extra + manual bonus)
      if (effectivePayrollRemaining < 0) {
        setLoading(false)
        return toast.error('Οι προκαταβολές είναι περισσότερες από το υπολογισμένο ποσό')
      }

      if (finalPayable <= 0) {
        setLoading(false)
        return toast.error('Το ποσό πληρωμής πρέπει να είναι μεγαλύτερο από 0')
      }

      const agreementLabel = agreementType === 'monthly' ? 'Βασικός Μισθός' : 'Ημερομίσθιο';
      const daysOrAbsencesLabel = agreementType === 'monthly' ? `Απουσίες: ${absences}` : `Ημέρες: ${workedDays}`;
      const notes = `Εκκαθάριση ${empName || ''} | ${agreementLabel} | Ημέρες/Απουσίες: ${daysOrAbsencesLabel}`;

      const isBankEmpty = bankAmount.trim() === ''
      const isCashEmpty = cashAmount.trim() === ''
      const epsilon = 0.01

      let normalizedBank = 0
      let normalizedCash = 0

      // Fallback when both fields are empty: use selected payment method for full amount.
      if (isBankEmpty && isCashEmpty) {
        if (paymentMethod === 'Τράπεζα') {
          normalizedBank = finalPayableSafe
          normalizedCash = 0
        } else {
          normalizedBank = 0
          normalizedCash = finalPayableSafe
        }
      } else if (!isBankEmpty && isCashEmpty) {
        normalizedBank = clampAmount(bankAmountNum, finalPayableSafe)
        normalizedCash = Math.max(0, finalPayableSafe - normalizedBank)
      } else if (isBankEmpty && !isCashEmpty) {
        normalizedCash = clampAmount(cashAmountNum, finalPayableSafe)
        normalizedBank = Math.max(0, finalPayableSafe - normalizedCash)
      } else {
        normalizedBank = clampAmount(bankAmountNum, finalPayableSafe)
        normalizedCash = clampAmount(cashAmountNum, finalPayableSafe)

        const total = normalizedBank + normalizedCash
        const diff = finalPayableSafe - total

        if (Math.abs(diff) <= epsilon) {
          if (lastEditedField === 'cash') {
            normalizedBank = Math.max(0, Math.min(finalPayableSafe, normalizedBank + diff))
          } else {
            normalizedCash = Math.max(0, Math.min(finalPayableSafe, normalizedCash + diff))
          }
        }
      }

      if (normalizedBank < 0 || normalizedCash < 0) {
        setLoading(false)
        return toast.error('Τα ποσά πληρωμής δεν μπορεί να είναι αρνητικά.')
      }

      if (normalizedBank > finalPayableSafe || normalizedCash > finalPayableSafe) {
        setLoading(false)
        return toast.error('Κάποιο ποσό είναι μεγαλύτερο από το τελικό πληρωτέο.')
      }

      const normalizedTotal = normalizedBank + normalizedCash
      if (Math.abs(normalizedTotal - finalPayableSafe) > 0.01) {
        setLoading(false)
        return toast.error('Το split πληρωμής πρέπει να ισούται με το τελικό πληρωτέο.')
      }

      const inserts: Array<any> = []

      if (normalizedBank > 0) {
        inserts.push({
          amount: -Math.abs(normalizedBank),
          type: 'expense',
          category: 'Staff',
          method: 'Τράπεζα',
          employee_id: empId,
          fixed_asset_id: empId,
          store_id: storeId,
          date,
          notes,
        })
      }

      if (normalizedCash > 0) {
        inserts.push({
          amount: -Math.abs(normalizedCash),
          type: 'expense',
          category: 'Staff',
          method: 'Μετρητά',
          employee_id: empId,
          fixed_asset_id: empId,
          store_id: storeId,
          date,
          notes,
        })
      }

      if (inserts.length === 0) {
        setLoading(false)
        return toast.error('Βάλε ποσό πληρωμής σε Τράπεζα ή Μετρητά.')
      }

      const { error: splitInsertError } = await supabase.from('transactions').insert(inserts)
      if (splitInsertError) throw splitInsertError

      const { error: settleAdvancesError } = await supabase
        .from('transactions')
        .update({ is_settled: true })
        .eq('store_id', storeId)
        .eq('type', 'salary_advance')
        .eq('is_settled', false)
        .or(`employee_id.eq.${empId},fixed_asset_id.eq.${empId}`)
      if (settleAdvancesError) throw settleAdvancesError

      const { error: settleOvertimeError } = await supabase
        .from('employee_overtimes')
        .update({ is_paid: true })
        .eq('store_id', storeId)
        .eq('employee_id', empId)
        .eq('is_paid', false)
      if (settleOvertimeError) throw settleOvertimeError

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
                      <label style={smallLabel}>Βασικός Μισθός</label>
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
                <label style={smallLabel}>Συμφωνημένο Extra</label>
                <div style={staticValue}>{effectiveAgreedExtraSalary.toFixed(2)}€</div>
              </div>

              <div style={inputGroup}>
                <label style={smallLabel}>Bonus</label>
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
                  <span style={resultLabel}>ΥΠΟΛΟΙΠΟ ΜΙΣΘΟΔΟΣΙΑΣ</span>
                  <span style={resultValue}>{effectiveRemainingPayroll.toFixed(2)}€</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>Συμφωνημένο Extra</span>
                  <span style={resultValue}>{effectiveAgreedExtraSalary.toFixed(2)}€</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>Bonus</span>
                  <span style={resultValue}>{manualBonus.toFixed(2)}€</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={resultLabel}>ΤΕΛΙΚΟ ΠΛΗΡΩΤΕΟ</span>
                  <span style={resultValue}>{finalPayable.toFixed(2)}€</span>
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

          {mode !== 'advance' && (
            <>
              <div style={{ marginTop: '15px' }}>
                <label style={smallLabel}>ΠΟΣΟ ΤΡΑΠΕΖΑΣ (€)</label>
                <input
                  type="number"
                  value={bankAmount}
                  onChange={e => handleBankAmountChange(e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
              </div>

              <div style={{ marginTop: '10px' }}>
                <label style={smallLabel}>ΠΟΣΟ ΜΕΤΡΗΤΩΝ (€)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={e => handleCashAmountChange(e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
              </div>
            </>
          )}

          <button
            onClick={handleFinalPayment}
            disabled={loading || (mode === 'advance' ? Number(advanceAmount) <= 0 : effectivePayrollRemaining < 0)}
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