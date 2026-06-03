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

type PreviewTab = 'overview' | 'ledger'

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

function labelFromType(type: EmployeeLedgerPreviewEventType): string {
  if (type === 'earning') return 'Earning'
  if (type === 'payment') return 'Payment'
  if (type === 'deduction') return 'Deduction'
  if (type === 'adjustment') return 'Adjustment'
  return 'Reversal'
}

function colorFromType(type: EmployeeLedgerPreviewEventType): string {
  if (type === 'earning') return '#065f46'
  if (type === 'payment') return '#1d4ed8'
  if (type === 'deduction') return '#9a3412'
  if (type === 'adjustment') return '#334155'
  return '#7c2d12'
}

function bgFromType(type: EmployeeLedgerPreviewEventType): string {
  if (type === 'earning') return '#ecfdf5'
  if (type === 'payment') return '#eff6ff'
  if (type === 'deduction') return '#fff7ed'
  if (type === 'adjustment') return '#f1f5f9'
  return '#fef3c7'
}

function getEmploymentType(employee: EmployeeRow | null): string {
  const basis = String(employee?.pay_basis || 'monthly').toLowerCase()
  if (basis === 'daily') return 'Daily'
  if (basis === 'hourly') return 'Hourly'
  if (basis === 'seasonal') return 'Seasonal'
  return 'Monthly'
}

function humanReason(event: EmployeeLedgerPreviewEvent): string {
  if (event.type === 'earning') return `Added earning ${money(event.amount)} due to ${event.reason.toLowerCase()}`
  if (event.type === 'payment') return `Recorded payment ${money(event.amount)} with reference ${event.reference}`
  if (event.type === 'deduction') return `Applied deduction ${money(event.amount)} for ${event.reason.toLowerCase()}`
  if (event.type === 'adjustment') return `Balance adjusted by ${money(event.amount)} (${event.reason.toLowerCase()})`
  return `Reversal entry ${money(event.amount)} linked to ${event.reference}`
}

export default function EmployeeProfilePreview({ employeeId, storeId }: ProfileProps) {
  const supabase = getSupabase()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
  const [storeName, setStoreName] = useState('Store')
  const [lastActivity, setLastActivity] = useState<string>('N/A')
  const [activeTab, setActiveTab] = useState<PreviewTab>('overview')
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
            .select('date,created_at')
            .eq('store_id', storeId)
            .or(`employee_id.eq.${employeeId},fixed_asset_id.eq.${employeeId}`)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (!alive) return

        const found = (employees || []).find((row: any) => String(row.id) === String(employeeId)) || null
        setEmployee(found)
        setStoreName(String(storeRes.data?.name || '').trim() || 'Store')

        const activityDate = String(activityRes.data?.date || '').slice(0, 10)
        setLastActivity(activityDate ? formatDateDMY(activityDate, activityDate) : 'No recent activity')
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
      return getEmployeeLedgerPreviewSummary({ id: employeeId, name: 'Employee' })
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

  const recentChanges = summary.events.slice(0, 3)

  if (loading) {
    return <div style={loadingWrapStyle}>Loading employee profile preview...</div>
  }

  if (!employee) {
    return (
      <div style={loadingWrapStyle}>
        <p style={{ margin: 0, fontWeight: 800 }}>Employee not found for this store.</p>
        <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
          Back to Employees
        </Link>
      </div>
    )
  }

  const currentBalance = summary.currentBalance

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <p style={badgeStyle}>Employee Profile Preview</p>
            <h1 style={nameStyle}>{String(employee.name || 'Employee')}</h1>
            <div style={metaWrapStyle}>
              <span style={metaPillStyle}>{employee.is_active === false ? 'Inactive' : 'Active'}</span>
              <span style={metaPillStyle}>{getEmploymentType(employee)}</span>
              <span style={metaPillStyle}>{storeName}</span>
              <span style={metaPillStyle}>Last Activity: {lastActivity}</span>
            </div>
          </div>
          <Link href={`/employees?store=${encodeURIComponent(storeId)}`} style={backLinkStyle}>
            Back
          </Link>
        </header>

        <section style={stickyBalanceStyle}>
          <p style={kpiLabelStyle}>Current Balance</p>
          <p style={kpiValueStyle}>{money(summary.currentBalance)}</p>
          <div style={balanceGridStyle}>
            <Kpi label="Total Earned" value={money(summary.totalEarned)} tone="#065f46" />
            <Kpi label="Total Paid" value={money(summary.totalPaid)} tone="#1d4ed8" />
            <Kpi label="Total Deductions" value={money(summary.totalDeductions)} tone="#9a3412" />
            <Kpi label="Net Change" value={money(summary.netChange)} tone="#0f172a" />
            <Kpi label="Last Updated" value={formatDateDMY(summary.lastUpdated, summary.lastUpdated)} tone="#334155" />
          </div>
        </section>

        <section style={tabRowStyle}>
          <button type="button" onClick={() => setActiveTab('overview')} style={{ ...tabBtnStyle, ...(activeTab === 'overview' ? tabBtnActiveStyle : null) }}>
            Overview
          </button>
          <button type="button" onClick={() => setActiveTab('ledger')} style={{ ...tabBtnStyle, ...(activeTab === 'ledger' ? tabBtnActiveStyle : null) }}>
            Ledger Preview
          </button>
        </section>

        {activeTab === 'overview' && (
          <section style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>Recent Changes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentChanges.map((event) => (
                <div key={event.id} style={recentChangeRowStyle}>
                  <p style={recentChangeTitleStyle}>{formatDateDMY(event.date, event.date)} - {labelFromType(event.type)}</p>
                  <p style={recentChangeTextStyle}>{humanReason(event)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={sectionCardStyle}>
          <h2 style={sectionTitleStyle}>Ledger Timeline (Read-only)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {summary.events.map((event) => (
              <TimelineRow key={event.id} event={event} />
            ))}
          </div>
        </section>
      </div>

      <div style={dockStyle}>
        <button type="button" style={dockBtnStyle} onClick={() => setSimulationAction('earning')}>Add Earning</button>
        <button type="button" style={dockBtnStyle} onClick={() => setSimulationAction('payment')}>Add Payment</button>
        <button type="button" style={dockBtnStyle} onClick={() => setSimulationAction('deduction')}>Add Deduction</button>
      </div>

      <SimulationModal
        open={simulationAction !== null}
        action={(simulationAction || 'earning') as 'earning' | 'payment' | 'deduction'}
        currentBalance={currentBalance}
        onClose={() => setSimulationAction(null)}
      />
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={kpiItemStyle}>
      <span style={kpiItemLabelStyle}>{label}</span>
      <span style={{ ...kpiItemValueStyle, color: tone }}>{value}</span>
    </div>
  )
}

function TimelineRow({ event }: { event: EmployeeLedgerPreviewEvent }) {
  return (
    <article style={timelineRowStyle}>
      <div style={timelineTopStyle}>
        <span style={{ ...typePillStyle, backgroundColor: bgFromType(event.type), color: colorFromType(event.type) }}>
          {labelFromType(event.type)}
        </span>
        <span style={timelineDateStyle}>{formatDateDMY(event.date, event.date)}</span>
      </div>

      <div style={timelineGridStyle}>
        <InfoLine label="Amount" value={money(event.amount)} />
        <InfoLine label="Reference" value={event.reference} />
        <InfoLine label="Source" value={event.source} />
        <InfoLine label="Balance Before" value={money(event.balanceBefore)} />
        <InfoLine label="Balance After" value={money(event.balanceAfter)} />
        <InfoLine label="Reason" value={event.reason} />
      </div>
    </article>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={infoLabelStyle}>{label}</span>
      <p style={infoValueStyle}>{value}</p>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)',
  padding: '12px 12px 88px 12px',
}

const containerStyle: React.CSSProperties = {
  maxWidth: '980px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  padding: '14px',
}

const badgeStyle: React.CSSProperties = {
  margin: 0,
  display: 'inline-block',
  fontWeight: 900,
  fontSize: '11px',
  color: '#1d4ed8',
  backgroundColor: '#eff6ff',
  borderRadius: '999px',
  padding: '4px 8px',
}

const nameStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: '24px',
  color: '#0f172a',
  lineHeight: 1.2,
}

const metaWrapStyle: React.CSSProperties = {
  marginTop: '8px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
}

const metaPillStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  color: '#334155',
  backgroundColor: '#f1f5f9',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  padding: '4px 8px',
}

const backLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  borderRadius: '10px',
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#0f172a',
  fontWeight: 800,
  padding: '8px 12px',
}

const stickyBalanceStyle: React.CSSProperties = {
  position: 'sticky',
  top: '8px',
  zIndex: 20,
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  padding: '14px',
}

const kpiLabelStyle: React.CSSProperties = {
  margin: 0,
  textTransform: 'uppercase',
  fontSize: '11px',
  fontWeight: 900,
  color: '#64748b',
}

const kpiValueStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '30px',
  fontWeight: 900,
  color: '#0f172a',
}

const balanceGridStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '8px',
}

const kpiItemStyle: React.CSSProperties = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  padding: '8px',
}

const kpiItemLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  textTransform: 'uppercase',
  color: '#64748b',
  fontWeight: 800,
}

const kpiItemValueStyle: React.CSSProperties = {
  display: 'block',
  marginTop: '2px',
  fontWeight: 900,
  fontSize: '15px',
}

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
}

const tabBtnStyle: React.CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontWeight: 800,
  padding: '8px 12px',
  cursor: 'pointer',
}

const tabBtnActiveStyle: React.CSSProperties = {
  border: '1px solid #1d4ed8',
  color: '#1d4ed8',
  background: '#eff6ff',
}

const sectionCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  backgroundColor: '#ffffff',
  padding: '14px',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: '17px',
}

const recentChangeRowStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  background: '#f8fafc',
  padding: '10px',
}

const recentChangeTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  color: '#0f172a',
  fontSize: '13px',
}

const recentChangeTextStyle: React.CSSProperties = {
  margin: '5px 0 0 0',
  color: '#334155',
  fontSize: '13px',
}

const timelineRowStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  backgroundColor: '#ffffff',
  padding: '10px',
}

const timelineTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const timelineDateStyle: React.CSSProperties = {
  fontWeight: 800,
  color: '#334155',
  fontSize: '12px',
}

const typePillStyle: React.CSSProperties = {
  fontWeight: 900,
  borderRadius: '999px',
  padding: '4px 8px',
  fontSize: '11px',
}

const timelineGridStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '8px',
}

const infoLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  textTransform: 'uppercase',
  color: '#64748b',
  fontWeight: 800,
}

const infoValueStyle: React.CSSProperties = {
  margin: '2px 0 0 0',
  fontSize: '13px',
  color: '#1e293b',
  fontWeight: 700,
}

const dockStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1100,
  borderTop: '1px solid #cbd5e1',
  background: 'rgba(255, 255, 255, 0.96)',
  backdropFilter: 'blur(6px)',
  padding: '10px 12px max(10px, env(safe-area-inset-bottom))',
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  maxWidth: '980px',
  margin: '0 auto',
}

const dockBtnStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '12px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: '13px',
  minHeight: '42px',
  cursor: 'pointer',
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
