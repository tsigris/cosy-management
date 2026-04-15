'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { getTodayDateISO } from '@/lib/businessDate'
import Link from 'next/link'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Calculator, Banknote } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
}

function PayEmployeeContent() {
  const supabase = getSupabase()
  const searchParams = useSearchParams()
  const router = useRouter()

  const empId = searchParams.get('id')
  const empName = searchParams.get('name')
  const storeId = searchParams.get('store')
  const mode = searchParams.get('mode')

  const [advanceAmount, setAdvanceAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'Μετρητά' | 'Τράπεζα'>('Μετρητά')
  const [loading, setLoading] = useState(true)
  const [isPaying, setIsPaying] = useState(false)
  const [snapshot, setSnapshot] = useState<any | null>(null)

  const loadSnapshot = useCallback(async () => {
    if (!empId || !storeId) return
    try {
      setLoading(true)
      const businessAsOfDate = getTodayDateISO()
      const { data, error } = await supabase
        .rpc('get_employee_payroll_snapshot', {
          p_store_id: storeId,
          p_employee_id: empId,
          p_as_of_date: businessAsOfDate,
        })
        .maybeSingle()

      if (error) {
        console.error('[pay-employee] snapshot load failed', error)
        setSnapshot(null)
      } else {
        console.log('PAYROLL SNAPSHOT', data)
        setSnapshot(data || null)
      }
    } catch (err) {
      console.error('[pay-employee] snapshot load failed', err)
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [empId, storeId, supabase])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  const currentCyclePayable = Number(snapshot?.current_cycle_payable ?? 0)
  const carryoverPayable = Number(snapshot?.carryover_payable ?? 0)
  const totalPayable = Number(snapshot?.total_payable ?? 0)
  const hasCurrentCyclePayable = Boolean(snapshot?.has_current_cycle_payable)
  const hasCarryover = Boolean(snapshot?.has_carryover)
  const canPayFull = hasCurrentCyclePayable || hasCarryover

  async function handleAdvance() {
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    if (!empId) return toast.error('Σφάλμα υπαλλήλου')

    const amountNum = Number(advanceAmount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      return toast.error('Το ποσό πρέπει να είναι μεγαλύτερο από 0')
    }

    setIsPaying(true)
    try {
      const notes = `Προκαταβολή μισθού | ${empName || ''}`
      const { error } = await supabase.from('transactions').insert([
        {
          amount: -Math.abs(amountNum),
          type: 'salary_advance',
          category: 'Staff',
          method: paymentMethod,
          employee_id: empId,
          fixed_asset_id: empId,
          store_id: storeId,
          date: getTodayDateISO(),
          notes,
          source_context: 'payroll_advance',
        },
      ])

      if (error) throw error

      toast.success('Η προκαταβολή καταχωρήθηκε!')
      router.push(`/employees?store=${storeId}`)
    } catch (err: any) {
      console.error('[pay-employee] ADVANCE ERROR', err)
      toast.error(err?.message || 'Αποτυχία προκαταβολής')
    } finally {
      setIsPaying(false)
    }
  }

  async function handlePayCurrentCycle() {
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    if (!empId) return toast.error('Σφάλμα υπαλλήλου')
    if (!hasCurrentCyclePayable) return

    setIsPaying(true)
    try {
      const notes = `Πληρωμή τρέχοντος κύκλου | ${empName || ''}`
      const { error } = await supabase.rpc('payroll_pay_current_cycle_atomic', {
        p_store_id: storeId,
        p_employee_id: empId,
        p_method: paymentMethod,
        p_notes: notes,
      })

      if (error) throw error

      toast.success('Η πληρωμή τρέχοντος κύκλου καταχωρήθηκε!')
      await loadSnapshot()
    } catch (err: any) {
      console.error('[pay-employee] CURRENT CYCLE ERROR', err)
      toast.error(err?.message || 'Αποτυχία πληρωμής')
    } finally {
      setIsPaying(false)
    }
  }

  async function handlePayCarryover() {
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    if (!empId) return toast.error('Σφάλμα υπαλλήλου')
    if (!hasCarryover) return

    setIsPaying(true)
    try {
      const notes = `Εξόφληση προηγούμενου κύκλου | ${empName || ''}`
      const { error } = await supabase.rpc('payroll_pay_carryover_atomic', {
        p_store_id: storeId,
        p_employee_id: empId,
        p_method: paymentMethod,
        p_notes: notes,
      })

      if (error) throw error

      toast.success('Η οφειλή προηγούμενου κύκλου εξοφλήθηκε!')
      await loadSnapshot()
    } catch (err: any) {
      console.error('[pay-employee] CARRYOVER ERROR', err)
      toast.error(err?.message || 'Αποτυχία εξόφλησης προηγ. κύκλου')
    } finally {
      setIsPaying(false)
    }
  }

  async function handlePayFull() {
    if (!storeId) return toast.error('Σφάλμα καταστήματος')
    if (!empId) return toast.error('Σφάλμα υπαλλήλου')
    if (!canPayFull) return

    setIsPaying(true)
    try {
      const notes = `Πλήρης εξόφληση μισθοδοσίας | ${empName || ''}`
      const { error } = await supabase.rpc('payroll_pay_full_atomic', {
        p_store_id: storeId,
        p_employee_id: empId,
        p_method: paymentMethod,
        p_notes: notes,
      })

      if (error) throw error

      toast.success('Η πλήρης πληρωμή καταχωρήθηκε!')
      await loadSnapshot()
    } catch (err: any) {
      console.error('[pay-employee] FULL PAYMENT ERROR', err)
      toast.error(err?.message || 'Αποτυχία πλήρους πληρωμής')
    } finally {
      setIsPaying(false)
    }
  }

  const isCurrentCycleDisabled = loading || isPaying || !hasCurrentCyclePayable
  const isCarryoverDisabled = loading || isPaying || !hasCarryover
  const isFullDisabled = loading || isPaying || !canPayFull
  const isAdvanceDisabled = loading || isPaying || Number(advanceAmount) <= 0

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
        <header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={logoBoxStyle}><Calculator size={20} color="#2563eb" /></div>
            <div>
              <h1 style={titleStyle}>{mode === 'advance' ? 'Προκαταβολή' : 'Πληρωμή'}</h1>
              <p style={subTitleStyle}>{empName?.toUpperCase()}</p>
            </div>
          </div>
          <Link href={`/employees?store=${storeId}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </header>

        <div style={cardStyle}>
          {mode === 'advance' ? (
            <div style={{ marginBottom: '14px' }}>
              <label style={smallLabel}>ΠΟΣΟ ΠΡΟΚΑΤΑΒΟΛΗΣ (€)</label>
              <input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />

              <button
                onClick={handleAdvance}
                disabled={isAdvanceDisabled}
                style={{
                  ...payBtn,
                  marginTop: '16px',
                  opacity: isAdvanceDisabled ? 0.6 : 1,
                  cursor: isAdvanceDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <Banknote size={18} /> ΚΑΤΑΧΩΡΗΣΗ ΠΡΟΚΑΤΑΒΟΛΗΣ
              </button>
            </div>
          ) : (
            <>
              <div style={resultBox}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {carryoverPayable > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={resultLabel}>Χρωστάς από προηγούμενο μήνα</span>
                      <span style={resultValue}>{carryoverPayable.toFixed(2)}€</span>
                    </div>
                  )}
                  {currentCyclePayable > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={resultLabel}>Τρέχων μισθός</span>
                      <span style={resultValue}>{currentCyclePayable.toFixed(2)}€</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ ...resultLabel, color: '#fef3c7' }}>ΣΥΝΟΛΟ</span>
                    <span style={{ ...resultValue, color: '#fef3c7' }}>{totalPayable.toFixed(2)}€</span>
                  </div>
                </div>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                <button
                  onClick={handlePayFull}
                  disabled={isFullDisabled}
                  style={{
                    ...payBtn,
                    backgroundColor: colors.accentGreen,
                    opacity: isFullDisabled ? 0.6 : 1,
                    cursor: isFullDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Banknote size={18} /> ΠΛΗΡΩΜΗ ΣΥΝΟΛΟΥ
                </button>

                <button
                  onClick={handlePayCurrentCycle}
                  disabled={isCurrentCycleDisabled}
                  style={{
                    ...payBtn,
                    backgroundColor: colors.accentBlue,
                    opacity: isCurrentCycleDisabled ? 0.6 : 1,
                    cursor: isCurrentCycleDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  ΠΛΗΡΩΜΗ ΤΡΕΧΟΝΤΟΣ ΚΥΚΛΟΥ
                </button>

                <button
                  onClick={handlePayCarryover}
                  disabled={isCarryoverDisabled}
                  style={{
                    ...payBtn,
                    backgroundColor: '#ea580c',
                    opacity: isCarryoverDisabled ? 0.6 : 1,
                    cursor: isCarryoverDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  ΕΞΟΦΛΗΣΗ ΠΡΟΗΓΟΥΜΕΝΟΥ ΚΥΚΛΟΥ
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// STYLES
const iphoneWrapper: any = { backgroundColor: colors.bgLight, minHeight: '100dvh', padding: '20px', overflowY: 'auto' }
const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }
const titleStyle = { fontWeight: '900', fontSize: '20px', margin: 0, color: colors.primaryDark }
const subTitleStyle = { margin: 0, fontSize: '12px', fontWeight: '800', color: colors.secondaryText }
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#eef2ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const backBtnStyle: any = { textDecoration: 'none', color: colors.secondaryText, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: '12px', border: `1px solid ${colors.border}` }

const cardStyle: any = { backgroundColor: colors.white, padding: '25px', borderRadius: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }
const smallLabel: any = { fontSize: '11px', fontWeight: '800', color: colors.secondaryText, marginBottom: '6px', display: 'block' }
const inputStyle: any = { width: '100%', padding: '14px', borderRadius: '12px', border: `1px solid ${colors.border}`, fontSize: '16px', fontWeight: '700', backgroundColor: colors.bgLight, outline: 'none' }

const resultBox: any = { marginTop: '5px', padding: '20px', backgroundColor: colors.primaryDark, borderRadius: '18px', color: 'white' }
const resultLabel = { fontSize: '12px', fontWeight: '800', opacity: 0.8 }
const resultValue = { fontSize: '22px', fontWeight: '900' }

const payBtn: any = { width: '100%', padding: '16px', backgroundColor: colors.accentGreen, color: 'white', border: 'none', borderRadius: '16px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }
const methodToggleWrap: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: colors.bgLight, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '4px' }
const methodToggleBtn: any = { border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontWeight: '800', backgroundColor: 'transparent', color: colors.secondaryText, cursor: 'pointer' }
const methodToggleBtnActive: any = { backgroundColor: colors.white, color: colors.primaryDark, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }

export default function PayEmployeePage() {
  return (
    <Suspense fallback={null}>
      <PayEmployeeContent />
    </Suspense>
  )
}