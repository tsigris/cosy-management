'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  monthly_salary?: number | null
  agreed_extra_salary?: number | null
  daily_rate?: number | null
  pay_basis?: string | null
}

type SimulationAction = 'earning' | 'payment' | 'deduction' | null

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`
}

function historyTypeLabel(type: EmployeeLedgerPreviewEventType): string {
  if (type === 'earning') return 'Του χρωστάμε'
  if (type === 'payment') return 'Πληρωμή'
  if (type === 'deduction') return 'Αφαίρεση'
  if (type === 'adjustment') return 'Αφαίρεση'
  return 'Του χρωστάμε'
}

function signedAmount(event: EmployeeLedgerPreviewEvent): string {
  const isPositive = event.type === 'earning' || event.type === 'reversal'
  return `${isPositive ? '+' : '-'}${money(event.amount)}`
}

export default function EmployeeProfilePreview({ employeeId, storeId }: ProfileProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)
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
        const employees = await getEmployees(storeId)

        if (!alive) return

        const found = (employees || []).find((row: any) => String(row.id) === String(employeeId)) || null
        setEmployee(found)
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
  }, [employeeId, router, storeId])

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
    return <div style={loadingWrapStyle}>Φόρτωση...</div>
  }

  if (!employee) {
    return (
      <div style={loadingWrapStyle}>
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

        <section style={summaryStyle}>
          <h1 style={nameStyle}>{String(employee.name || 'Υπάλληλος')}</h1>
          <p style={balanceLabelStyle}>Υπόλοιπο που του χρωστάμε:</p>
          <p style={balanceValueStyle}>{money(summary.currentBalance)}</p>

          <div style={totalsGridStyle}>
            <MiniStat label="Του χρωστάμε" value={money(summary.totalEarned)} />
            <MiniStat label="Του πληρώσαμε" value={money(summary.totalPaid)} />
            <MiniStat label="Αφαιρέσεις" value={money(summary.totalDeductions)} />
          </div>
        </section>

        <section style={actionsStyle}>
          <button type="button" style={primaryActionStyle} onClick={() => setSimulationAction('earning')}>
            + Του χρωστάμε
          </button>
          <button type="button" style={secondaryActionStyle} onClick={() => setSimulationAction('payment')}>
            - Του πλήρωσα
          </button>
          <button type="button" style={secondaryActionStyle} onClick={() => setSimulationAction('deduction')}>
            - Αφαίρεση
          </button>
        </section>

        <section style={historyStyle}>
          {summary.events.map((event) => (
            <article key={event.id} style={historyRowStyle}>
              <p style={historyDateStyle}>{formatDateDMY(event.date, event.date).slice(0, 5)}</p>
              <p style={historyTypeStyle}>{historyTypeLabel(event.type)}</p>
              <p style={historyAmountStyle}>{signedAmount(event)}</p>
              <p style={historyBalanceStyle}>Υπόλοιπο: {money(event.balanceAfter)}</p>
            </article>
          ))}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatStyle}>
      <span style={miniLabelStyle}>{label}</span>
      <span style={miniValueStyle}>{value}</span>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#f8fafc',
  padding: '12px 12px 24px',
}

const containerStyle: CSSProperties = {
  maxWidth: '420px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const backLinkStyle: CSSProperties = {
  alignSelf: 'flex-start',
  textDecoration: 'none',
  color: '#334155',
  fontWeight: 700,
  fontSize: '14px',
  padding: '4px 0',
}

const summaryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const nameStyle: CSSProperties = {
  margin: 0,
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  color: '#0f172a',
  textTransform: 'uppercase',
}

const balanceLabelStyle: CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: '18px',
  lineHeight: 1.2,
  fontWeight: 800,
  color: '#334155',
}

const balanceValueStyle: CSSProperties = {
  margin: 0,
  fontSize: '42px',
  lineHeight: 1,
  fontWeight: 900,
  color: '#0f172a',
}

const totalsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '8px',
  marginTop: '8px',
}

const miniStatStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '10px',
}

const miniLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: '12px',
  lineHeight: 1.2,
  fontWeight: 700,
  color: '#475569',
}

const miniValueStyle: CSSProperties = {
  display: 'block',
  marginTop: '6px',
  fontSize: '18px',
  lineHeight: 1.1,
  fontWeight: 900,
  color: '#0f172a',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const baseActionStyle: CSSProperties = {
  width: '100%',
  minHeight: '52px',
  borderRadius: '14px',
  border: 'none',
  fontSize: '18px',
  fontWeight: 900,
  cursor: 'pointer',
}

const primaryActionStyle: CSSProperties = {
  ...baseActionStyle,
  background: '#0f172a',
  color: '#ffffff',
}

const secondaryActionStyle: CSSProperties = {
  ...baseActionStyle,
  background: '#e2e8f0',
  color: '#0f172a',
}

const historyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const historyRowStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '12px',
}

const historyDateStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 900,
  color: '#0f172a',
}

const historyTypeStyle: CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '17px',
  fontWeight: 700,
  color: '#334155',
}

const historyAmountStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '28px',
  fontWeight: 900,
  color: '#0f172a',
}

const historyBalanceStyle: CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '15px',
  fontWeight: 700,
  color: '#475569',
}

const loadingWrapStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  background: '#f8fafc',
}

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 800,
  color: '#0f172a',
}
