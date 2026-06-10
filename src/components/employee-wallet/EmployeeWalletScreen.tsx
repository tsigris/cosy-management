'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { formatDateDMY } from '@/lib/formatters'
import { getTodayDateISO } from '@/lib/businessDate'
import { getEmployees } from '@/lib/employees'
import useStoreAccess from '@/hooks/useStoreAccess'
import {
  computeWalletBalanceTotals,
  EMPLOYEE_WALLET_ENTRY_CONFIG,
  getWalletEntryDirection,
  getWalletEntryKind,
  requiresWalletPeriod,
  type EmployeeWalletDirection,
  type EmployeeWalletEntrySubtype,
} from '@/lib/employeeWallet'

type Props = {
  employeeId: string
  storeId: string
}

type EmployeeRow = {
  id: string
  name?: string | null
  start_date?: string | null
  monthly_salary?: number | null
  agreed_extra_salary?: number | null
  daily_rate?: number | null
  pay_basis?: string | null
}

type AgreementRow = {
  agreement_type?: string | null
  monthly_amount?: number | null
  daily_rate?: number | null
  effective_from?: string | null
}

type LedgerRow = {
  id: string
  entry_kind: 'earning' | 'payment' | 'deduction' | 'adjustment'
  entry_subtype: string
  direction: 'increase_balance' | 'decrease_balance'
  amount: number
  occurred_on: string
  period_start?: string | null
  period_end?: string | null
  payment_method?: string | null
  notes?: string | null
  description?: string | null
  created_at: string
  created_by?: string | null
}

const QUICK_ACTIONS: EmployeeWalletEntrySubtype[] = [
  'salary',
  'salary_payment',
  'previous_period_payment',
  'partial_payment',
  'tip',
  'bonus',
  'gift',
  'advance',
  'deduction',
  'correction',
]

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`
}

function formatEntryDate(value: string | null | undefined) {
  if (!value) return '—'
  return formatDateDMY(value, value)
}

export default function EmployeeWalletScreen({ employeeId, storeId }: Props) {
  const supabase = getSupabase()
  const router = useRouter()
  const { data: accessData } = useStoreAccess({
    storeId: storeId || undefined,
    fields: 'role, can_edit_transactions',
    autoFetch: !!storeId,
  })

  const canEdit = accessData?.role === 'admin' || accessData?.can_edit_transactions === true

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [walletUnavailable, setWalletUnavailable] = useState<string | null>(null)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [agreement, setAgreement] = useState<AgreementRow | null>(null)
  const [entries, setEntries] = useState<LedgerRow[]>([])
  const [subtype, setSubtype] = useState<EmployeeWalletEntrySubtype>('salary_payment')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(getTodayDateISO())
  const [periodStart, setPeriodStart] = useState(getTodayDateISO())
  const [periodEnd, setPeriodEnd] = useState(getTodayDateISO())
  const [paymentMethod, setPaymentMethod] = useState('Μετρητά')
  const [notes, setNotes] = useState('')
  const [correctionDirection, setCorrectionDirection] = useState<EmployeeWalletDirection>('increase_balance')

  const loadWallet = useCallback(async () => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
      return
    }

    setLoading(true)
    setWalletUnavailable(null)

    try {
      const [employees, agreementRes, entriesRes] = await Promise.all([
        getEmployees(storeId),
        supabase
          .from('employee_agreements')
          .select('agreement_type, monthly_amount, daily_rate, effective_from')
          .eq('store_id', storeId)
          .eq('employee_id', employeeId)
          .is('voided_at', null)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('employee_ledger_entries')
          .select('id, entry_kind, entry_subtype, direction, amount, occurred_on, period_start, period_end, payment_method, notes, description, created_at, created_by')
          .eq('store_id', storeId)
          .eq('employee_id', employeeId)
          .is('voided_at', null)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      const foundEmployee = (employees || []).find((row: any) => String(row.id) === String(employeeId)) || null
      setEmployee(foundEmployee)

      if (agreementRes.error) {
        const msg = String(agreementRes.error.message || '')
        if (msg) console.error('Employee wallet agreement query failed:', agreementRes.error)
      } else {
        setAgreement((agreementRes.data || null) as AgreementRow | null)
      }

      if (entriesRes.error) {
        const message = String(entriesRes.error.message || 'Το wallet δεν είναι διαθέσιμο ακόμα. Εφάρμοσε πρώτα τα migrations.')
        console.error('Employee wallet entries query failed:', entriesRes.error)
        setWalletUnavailable(message)
        setEntries([])
      } else {
        setEntries((entriesRes.data || []) as LedgerRow[])
      }
    } catch (error) {
      console.error(error)
      setWalletUnavailable('Το wallet δεν είναι διαθέσιμο ακόμα. Εφάρμοσε πρώτα τα migrations.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [employeeId, router, storeId, supabase])

  useEffect(() => {
    void loadWallet()
  }, [loadWallet])

  useEffect(() => {
    if (!requiresWalletPeriod(subtype)) {
      setPeriodStart(paymentDate)
      setPeriodEnd(paymentDate)
    }
  }, [paymentDate, subtype])

  const summary = useMemo(
    () =>
      computeWalletBalanceTotals(
        entries.map((row) => ({
          kind: row.entry_kind,
          subtype: row.entry_subtype,
          direction: row.direction,
          amount: row.amount,
        })),
      ),
    [entries],
  )

  const headerRateLabel = useMemo(() => {
    const payBasis = String(agreement?.agreement_type || employee?.pay_basis || 'monthly')
    if (payBasis === 'daily') {
      const value = Number(agreement?.daily_rate ?? employee?.daily_rate ?? 0)
      return `${money(value)} / ημέρα`
    }

    const monthlyBase = Number(agreement?.monthly_amount ?? employee?.monthly_salary ?? 0)
    const monthlyExtra = Number(employee?.agreed_extra_salary ?? 0)
    const total = monthlyBase + monthlyExtra
    return `${money(total)} / μήνα`
  }, [agreement?.agreement_type, agreement?.daily_rate, agreement?.monthly_amount, employee?.agreed_extra_salary, employee?.daily_rate, employee?.monthly_salary, employee?.pay_basis])

  const timelineRows = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.occurred_on !== b.occurred_on) return String(b.occurred_on).localeCompare(String(a.occurred_on))
      return String(b.created_at).localeCompare(String(a.created_at))
    })
  }, [entries])

  async function handleCreateEntry() {
    if (!canEdit) return
    if (!employee) return

    const amountNumber = Number(String(amount).replace(',', '.'))
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      alert('Το ποσό πρέπει να είναι μεγαλύτερο από 0')
      return
    }

    if (!paymentDate) {
      alert('Το Payment Date είναι υποχρεωτικό')
      return
    }

    if (!periodStart || !periodEnd) {
      alert('Το Period Start και το Period End είναι υποχρεωτικά')
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('employee_wallet_record_entry_atomic', {
      p_store_id: storeId,
      p_employee_id: employeeId,
      p_entry_kind: getWalletEntryKind(subtype),
      p_entry_subtype: subtype === 'previous_period_payment' ? 'salary_payment' : subtype,
      p_amount: amountNumber,
      p_occurred_on: paymentDate,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_payment_method: paymentMethod,
      p_notes: notes.trim() || EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].defaultNotesLabel,
      p_direction: getWalletEntryDirection(subtype, correctionDirection),
    })

    if (error) {
      console.error('Employee wallet create failed:', error)
      alert(error.message || 'Αποτυχία καταχώρησης wallet entry')
      setSaving(false)
      return
    }

    setAmount('')
    setNotes('')
    setSubtype('salary_payment')
    setPaymentDate(getTodayDateISO())
    setPeriodStart(getTodayDateISO())
    setPeriodEnd(getTodayDateISO())
    setPaymentMethod('Μετρητά')
    setCorrectionDirection('increase_balance')
    setSaving(false)
    await loadWallet()
  }

  if (loading) {
    return <div style={centerWrapStyle}>Φόρτωση wallet...</div>
  }

  if (!employee) {
    return (
      <div style={centerWrapStyle}>
        <p style={emptyTitleStyle}>Ο υπάλληλος δεν βρέθηκε.</p>
        <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
          Επιστροφή
        </Link>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
          Επιστροφή
        </Link>

        <section style={headerCardStyle}>
          <div>
            <p style={kickerStyle}>EMPLOYEE WALLET</p>
            <h1 style={nameStyle}>{String(employee.name || 'Υπάλληλος')}</h1>
            <p style={metaLineStyle}>Start Date: {formatEntryDate(employee.start_date)}</p>
            <p style={metaLineStyle}>Pay Basis: {String(agreement?.agreement_type || employee?.pay_basis || 'monthly')}</p>
            <p style={metaLineStyle}>Salary Rate: {headerRateLabel}</p>
          </div>
          <div style={balanceBadgeStyle}>
            <span style={balanceBadgeLabel}>Current Balance</span>
            <span style={balanceBadgeValue}>{money(summary.currentBalance)}</span>
          </div>
        </section>

        {walletUnavailable && <div style={warningStyle}>{walletUnavailable}</div>}

        <section style={summaryGridStyle}>
          <SummaryCard label="Total Earned" value={money(summary.totalEarned)} tone="positive" />
          <SummaryCard label="Total Paid" value={money(summary.totalPaid)} tone="neutral" />
          <SummaryCard label="Total Tips" value={money(summary.totalTips)} tone="positive" />
          <SummaryCard label="Total Bonuses" value={money(summary.totalBonuses)} tone="positive" />
          <SummaryCard label="Total Advances" value={money(summary.totalAdvances)} tone="neutral" />
          <SummaryCard label="Total Deductions" value={money(summary.totalDeductions)} tone="negative" />
        </section>

        <section style={actionsWrapStyle}>
          {QUICK_ACTIONS.map((actionSubtype) => {
            const config = EMPLOYEE_WALLET_ENTRY_CONFIG[actionSubtype]
            const active = subtype === actionSubtype
            return (
              <button
                key={actionSubtype}
                type="button"
                onClick={() => setSubtype(actionSubtype)}
                style={{ ...actionBtnStyle, ...(active ? actionBtnActiveStyle : null) }}
              >
                {config.label}
              </button>
            )
          })}
        </section>

        <section style={formCardStyle}>
          <p style={sectionTitleStyle}>Manual Wallet Entry</p>
          <div style={fieldGridStyle}>
            <Field label="Employee">
              <input value={String(employee.name || '')} readOnly style={inputStyle} />
            </Field>
            <Field label="Amount">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" style={inputStyle} placeholder="0.00" />
            </Field>
            <Field label="Payment Date">
              <input value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} type="date" style={inputStyle} />
            </Field>
            <Field label="Period Start">
              <input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} type="date" style={inputStyle} />
            </Field>
            <Field label="Period End">
              <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} type="date" style={inputStyle} />
            </Field>
            <Field label="Method">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle}>
                <option value="Μετρητά">Μετρητά</option>
                <option value="Τράπεζα">Τράπεζα</option>
                <option value="Άλλο">Άλλο</option>
              </select>
            </Field>
            {(subtype === 'correction' || subtype === 'adjustment') && (
              <Field label="Direction">
                <select value={correctionDirection} onChange={(e) => setCorrectionDirection(e.target.value as EmployeeWalletDirection)} style={inputStyle}>
                  <option value="increase_balance">Increase Balance</option>
                  <option value="decrease_balance">Decrease Balance</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={textareaStyle} rows={4} placeholder={EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].defaultNotesLabel} />
          </Field>

          {!canEdit && <p style={mutedStyle}>Read-only access. Απαιτείται admin ή can_edit_transactions για manual entries.</p>}

          <button type="button" onClick={handleCreateEntry} disabled={!canEdit || saving || !!walletUnavailable} style={saveBtnStyle}>
            {saving ? 'Αποθήκευση...' : `Καταχώρηση ${EMPLOYEE_WALLET_ENTRY_CONFIG[subtype].label}`}
          </button>
        </section>

        <section style={timelineCardStyle}>
          <div style={timelineHeaderStyle}>
            <p style={sectionTitleStyle}>Full Timeline</p>
            <span style={timelineCountStyle}>{timelineRows.length} entries</span>
          </div>
          {timelineRows.length === 0 ? (
            <p style={mutedStyle}>Δεν υπάρχουν wallet entries για αυτόν τον υπάλληλο.</p>
          ) : (
            timelineRows.map((row) => {
              const config = EMPLOYEE_WALLET_ENTRY_CONFIG[row.entry_subtype as EmployeeWalletEntrySubtype]
              const label = config?.label || row.entry_subtype
              const amountColor = row.direction === 'increase_balance' ? '#047857' : '#b91c1c'
              return (
                <article key={row.id} style={timelineRowStyle}>
                  <div style={timelineTopRowStyle}>
                    <span style={timelineLabelStyle}>{label}</span>
                    <span style={{ ...timelineAmountStyle, color: amountColor }}>
                      {row.direction === 'increase_balance' ? '+' : '-'}{money(Math.abs(Number(row.amount || 0)))}
                    </span>
                  </div>
                  <p style={timelineMetaStyle}>Payment Date: {formatEntryDate(row.occurred_on)}</p>
                  <p style={timelineMetaStyle}>Period: {formatEntryDate(row.period_start)} - {formatEntryDate(row.period_end)}</p>
                  <p style={timelineMetaStyle}>Method: {row.payment_method || '—'}</p>
                  <p style={timelineNotesStyle}>{row.notes || row.description || 'Χωρίς σημειώσεις'}</p>
                  <p style={timelineMetaStyle}>Created: {formatEntryDate(row.created_at)} • {String(row.created_by || '').slice(0, 8) || '—'}</p>
                </article>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldWrapStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'neutral' | 'negative' }) {
  const toneMap = {
    positive: { bg: '#ecfdf5', text: '#065f46' },
    neutral: { bg: '#f8fafc', text: '#0f172a' },
    negative: { bg: '#fff1f2', text: '#9f1239' },
  } as const

  return (
    <div style={{ ...summaryCardStyle, backgroundColor: toneMap[tone].bg }}>
      <p style={summaryLabelStyle}>{label}</p>
      <p style={{ ...summaryValueStyle, color: toneMap[tone].text }}>{value}</p>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#f8fafc',
  padding: '14px',
}

const containerStyle: CSSProperties = {
  maxWidth: '760px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const centerWrapStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  background: '#f8fafc',
}

const backLinkStyle: CSSProperties = {
  alignSelf: 'flex-start',
  textDecoration: 'none',
  color: '#334155',
  fontWeight: 700,
  fontSize: '14px',
}

const headerCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  background: '#ffffff',
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid #e2e8f0',
}

const kickerStyle: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: '#64748b',
}

const nameStyle: CSSProperties = {
  margin: '4px 0 6px 0',
  fontSize: '32px',
  fontWeight: 900,
  lineHeight: 1,
  color: '#0f172a',
}

const metaLineStyle: CSSProperties = {
  margin: '3px 0',
  fontSize: '14px',
  fontWeight: 700,
  color: '#334155',
}

const balanceBadgeStyle: CSSProperties = {
  minWidth: '180px',
  borderRadius: '16px',
  background: '#0f172a',
  color: '#ffffff',
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const balanceBadgeLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.05em',
  color: '#cbd5e1',
}

const balanceBadgeValue: CSSProperties = {
  fontSize: '24px',
  fontWeight: 900,
}

const warningStyle: CSSProperties = {
  background: '#fff7ed',
  color: '#9a3412',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid #fed7aa',
  fontWeight: 700,
}

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
}

const summaryCardStyle: CSSProperties = {
  borderRadius: '14px',
  padding: '14px',
  border: '1px solid #e2e8f0',
}

const summaryLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.05em',
  color: '#64748b',
}

const summaryValueStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '20px',
  fontWeight: 900,
}

const actionsWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const actionBtnStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  background: '#ffffff',
  color: '#334155',
  fontWeight: 800,
  fontSize: '12px',
  padding: '8px 12px',
  cursor: 'pointer',
}

const actionBtnActiveStyle: CSSProperties = {
  background: '#0f172a',
  color: '#ffffff',
  borderColor: '#0f172a',
}

const formCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid #e2e8f0',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 900,
  color: '#0f172a',
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
  marginTop: '14px',
}

const fieldWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 900,
  color: '#64748b',
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  padding: '11px 12px',
  fontSize: '14px',
  fontWeight: 700,
  background: '#fff',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  padding: '12px',
  fontSize: '14px',
  fontWeight: 700,
  marginTop: '6px',
  resize: 'vertical',
}

const mutedStyle: CSSProperties = {
  margin: '12px 0 0 0',
  color: '#64748b',
  fontWeight: 700,
  fontSize: '12px',
}

const saveBtnStyle: CSSProperties = {
  marginTop: '14px',
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: '14px',
  padding: '14px 16px',
  cursor: 'pointer',
}

const timelineCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const timelineHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const timelineCountStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  color: '#64748b',
}

const timelineRowStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
  background: '#fff',
}

const timelineTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '8px',
  alignItems: 'center',
}

const timelineLabelStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  color: '#0f172a',
}

const timelineAmountStyle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
}

const timelineMetaStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '12px',
  fontWeight: 700,
  color: '#64748b',
}

const timelineNotesStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '13px',
  fontWeight: 700,
  color: '#334155',
  whiteSpace: 'pre-wrap',
}

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 800,
  color: '#0f172a',
}
