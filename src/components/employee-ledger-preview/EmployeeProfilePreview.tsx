'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { formatDateDMY } from '@/lib/formatters'
import { getEmployees } from '@/lib/employees'
import {
  getEmployeeLedgerPreviewSummary,
  type EmployeeLedgerPreviewEvent,
  type EmployeeLedgerPreviewEventType,
} from '@/lib/employeeLedgerPreviewMock'
import SimulationModal from '@/components/employee-ledger-preview/SimulationModal'

type ProfileProps = {
  employeeId: string
  storeId: string
}

type EmployeeRow = {
  id: string
  name?: string | null
  pay_basis?: string | null
  is_active?: boolean | null
  monthly_salary?: number | null
  agreed_extra_salary?: number | null
  daily_rate?: number | null
}

type SimulationAction = 'earning' | 'payment' | 'deduction' | null

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

function typeLabel(type: EmployeeLedgerPreviewEventType): string {
  if (type === 'earning') return 'Μεροκάματο'
  if (type === 'payment') return 'Πληρωμή'
  if (type === 'deduction') return 'Κράτηση'
  if (type === 'adjustment') return 'Διόρθωση'
  return 'Αντιστροφή'
}

function signedAmount(event: EmployeeLedgerPreviewEvent): string {
  const increase = event.type === 'earning' || event.type === 'reversal'
  return `${increase ? '+' : '-'}${money(event.amount)}`
}

function amountColor(event: EmployeeLedgerPreviewEvent): string {
  if (event.type === 'earning' || event.type === 'reversal') return '#047857'
  if (event.type === 'payment') return '#1d4ed8'
  if (event.type === 'deduction') return '#c2410c'
  return '#334155'
}

function getEmploymentType(employee: EmployeeRow | null): string {
  const basis = String(employee?.pay_basis || 'monthly').toLowerCase()
  if (basis === 'daily') return 'Ημερήσιος'
  if (basis === 'hourly') return 'Ωρομίσθιος'
  if (basis === 'seasonal') return 'Εποχικός'
  return 'Μηνιαίος'
}

export default function EmployeeProfilePreview({ employeeId, storeId }: ProfileProps) {
  const supabase = getSupabase()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [storeName, setStoreName] = useState('Κατάστημα')
  const [lastActivity, setLastActivity] = useState<string>('Καμία πρόσφατη κίνηση')
  const [simulationAction, setSimulationAction] = useState<SimulationAction>(null)

  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
      return
    }

    let alive = true

    const load = async () => {
      setLoading(true)
      try {
        const [employees, storeRes, activityRes] = await Promise.all([
          getEmployees(storeId),
          supabase.from('stores').select('name').eq('id', storeId).maybeSingle(),
          supabase
            .from('transactions')
            .select('date')
            .eq('store_id', storeId)
            .or(`employee_id.eq.${employeeId},fixed_asset_id.eq.${employeeId}`)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (!alive) return

        const found = (employees || []).find((row: any) => String(row.id) === String(employeeId)) || null
        setEmployee(found)
        setStoreName(String(storeRes.data?.name || '').trim() || 'Κατάστημα')

        const activityDate = String(activityRes.data?.date || '').slice(0, 10)
        setLastActivity(activityDate ? formatDateDMY(activityDate, activityDate) : 'Καμία πρόσφατη κίνηση')
      } catch {
        if (!alive) return
        setEmployee(null)
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [employeeId, storeId, router, supabase])

  const summary = useMemo(() => {
    if (!employee) {
      return getEmployeeLedgerPreviewSummary({ id: employeeId, name: 'Υπάλληλος' })
    }

    return getEmployeeLedgerPreviewSummary({
      id: String(employee.id),
      name: employee.name,
      monthly_salary: employee.monthly_salary,
      agreed_extra_salary: employee.agreed_extra_salary,
      daily_rate: employee.daily_rate,
      pay_basis: employee.pay_basis,
    })
  }, [employee, employeeId])

  if (loading) {
    return <div style={loadingWrapStyle}>Φόρτωση καρτέλας υπαλλήλου...</div>
  }

  if (!employee) {
    return (
      <div style={loadingWrapStyle}>
        <p style={{ margin: 0, fontWeight: 800 }}>Ο υπάλληλος δεν βρέθηκε.</p>
        <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
          Επιστροφή στη λίστα
        </Link>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={topRowStyle}>
          <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
            Επιστροφή
          </Link>
          <span style={metaChipStyle}>{storeName}</span>
        </div>

        <section style={walletCardStyle}>
          <p style={cardTitleStyle}>Καρτέλα Υπαλλήλου</p>
          <h1 style={employeeNameStyle}>{String(employee.name || 'Υπάλληλος')}</h1>

          <p style={balanceLabelStyle}>Υπόλοιπο</p>
          <p style={balanceValueStyle}>{money(summary.currentBalance)}</p>

          <div style={kpiGridStyle}>
            <Kpi label="Κερδισμένα" value={money(summary.totalEarned)} tone="#047857" />
            <Kpi label="Πληρωμένα" value={money(summary.totalPaid)} tone="#1d4ed8" />
            <Kpi label="Κρατήσεις" value={money(summary.totalDeductions)} tone="#c2410c" />
          </div>

          <div style={metaRowStyle}>
            <span style={metaChipStyle}>{employee.is_active === false ? 'Ανενεργός' : 'Ενεργός'}</span>
            <span style={metaChipStyle}>{getEmploymentType(employee)}</span>
            <span style={metaChipStyle}>Τελ. κίνηση: {lastActivity}</span>
          </div>
        </section>

        <section style={actionRowStyle}>
          <button type="button" style={actionBtnStyle} onClick={() => setSimulationAction('earning')}>+ Κέρδος</button>
          <button type="button" style={actionBtnStyle} onClick={() => setSimulationAction('payment')}>- Πληρωμή</button>
          <button type="button" style={actionBtnStyle} onClick={() => setSimulationAction('deduction')}>- Κράτηση</button>
        </section>

        <section style={historyWrapStyle}>
          <h2 style={historyTitleStyle}>Ιστορικό Κινήσεων</h2>
          <div style={historyListStyle}>
            {summary.events.map((event) => (
              <article key={event.id} style={historyRowStyle}>
                <div style={historyTopStyle}>
                  <span style={historyDateStyle}>{formatDateDMY(event.date, event.date)}</span>
                  <span style={historyTypeStyle}>{typeLabel(event.type)}</span>
                </div>
                <p style={{ ...historyAmountStyle, color: amountColor(event) }}>{signedAmount(event)}</p>
                <p style={historyBalanceStyle}>Υπόλοιπο: {money(event.balanceAfter)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <SimulationModal
        open={simulationAction !== null}
        action={(simulationAction || 'earning') as 'earning' | 'payment' | 'deduction'}
        currentBalance={summary.currentBalance}
        onClose={() => setSimulationAction(null)}
      />
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={kpiCardStyle}>
      <span style={kpiLabelStyle}>{label}</span>
      <span style={{ ...kpiValueStyle, color: tone }}>{value}</span>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(165deg, #f8fafc 0%, #e2e8f0 100%)',
  padding: '12px',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '680px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  paddingBottom: '20px',
}

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const backLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  padding: '8px 12px',
}

const walletCardStyle: React.CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: '18px',
  background: '#ffffff',
  padding: '14px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  color: '#1d4ed8',
  fontSize: '12px',
}

const employeeNameStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  fontWeight: 900,
  color: '#0f172a',
  fontSize: '24px',
  lineHeight: 1.15,
}

const balanceLabelStyle: React.CSSProperties = {
  margin: '12px 0 0 0',
  color: '#475569',
  fontWeight: 800,
  fontSize: '13px',
}

const balanceValueStyle: React.CSSProperties = {
  margin: '2px 0 0 0',
  fontWeight: 900,
  color: '#0f172a',
  fontSize: '36px',
}

const kpiGridStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
}

const kpiCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#f8fafc',
  padding: '8px',
}

const kpiLabelStyle: React.CSSProperties = {
  display: 'block',
  color: '#64748b',
  fontWeight: 800,
  fontSize: '11px',
}

const kpiValueStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '2px',
  fontWeight: 900,
  fontSize: '16px',
}

const metaRowStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
}

const metaChipStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  color: '#334155',
  backgroundColor: '#f1f5f9',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  padding: '4px 8px',
}

const actionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
}

const actionBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '12px',
  minHeight: '46px',
  backgroundColor: '#0f172a',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: '14px',
  cursor: 'pointer',
}

const historyWrapStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  padding: '12px',
}

const historyTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: '18px',
}

const historyListStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const historyRowStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  backgroundColor: '#f8fafc',
  padding: '10px',
}

const historyTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const historyDateStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#334155',
  fontWeight: 800,
}

const historyTypeStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#0f172a',
  fontWeight: 900,
}

const historyAmountStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  fontWeight: 900,
  fontSize: '18px',
}

const historyBalanceStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  color: '#334155',
  fontWeight: 800,
  fontSize: '13px',
}

const loadingWrapStyle: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  justifyContent: 'center',
  alignItems: 'center',
  background: '#f8fafc',
}
