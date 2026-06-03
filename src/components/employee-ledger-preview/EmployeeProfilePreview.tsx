'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDateDMY } from '@/lib/formatters'
import { getEmployees } from '@/lib/employees'
import { getEmployeeLedgerPreviewSummary } from '@/lib/employeeLedgerPreviewMock'

type ProfileProps = {
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

function money(value: number) {
  return `${Number(value || 0).toLocaleString('el-GR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}€`
}

const ACTIONS = [
  '+ Μισθός / Ποσό',
  '+ Tips',
  '+ Υπερωρίες',
  '+ Πληρωμή τράπεζα',
  '+ Πληρωμή μετρητά',
  '+ Αφαίρεση / Διόρθωση',
]

export default function EmployeeProfilePreview({ employeeId, storeId }: ProfileProps) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRow | null>(null)

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
      start_date: employee.start_date,
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

        <p style={previewBadgeStyle}>Δοκιμαστική προβολή</p>

        <section style={topSectionStyle}>
          <h1 style={nameStyle}>{String(employee.name || 'Υπάλληλος')}</h1>
          <p style={metaLineStyle}>Ξεκίνησε: {formatDateDMY(summary.startedDate, summary.startedDate)}</p>
          <p style={metaLineStyle}>Μήνας: {summary.monthLabel}</p>
        </section>

        <section style={simpleSectionStyle}>
          <h2 style={sectionTitleStyle}>Τι δικαιούται</h2>
          <Row label="Μισθός / Συμφωνία" value={money(summary.salaryAgreement)} />
          <Row label="Tips" value={money(summary.tips)} />
          <Row label="Υπερωρίες" value={money(summary.overtime)} />
          <Row label="Σύνολο που δικαιούται" value={money(summary.entitledTotal)} strong />
        </section>

        <section style={simpleSectionStyle}>
          <h2 style={sectionTitleStyle}>Τι πληρώθηκε</h2>
          <Row label="Τράπεζα" value={money(summary.paidBank)} />
          <Row label="Μετρητά" value={money(summary.paidCash)} />
          <Row label="Σύνολο πληρωμών" value={money(summary.paidTotal)} strong />
        </section>

        <section style={balanceSectionStyle}>
          <p style={balanceLabelStyle}>Υπόλοιπο</p>
          <p style={balanceValueStyle}>{money(summary.remainingBalance)}</p>
        </section>

        <section style={actionsStyle}>
          {ACTIONS.map((label) => (
            <button key={label} type="button" style={disabledActionStyle} disabled>
              <span>{label}</span>
              <span style={soonPillStyle}>Σύντομα διαθέσιμο</span>
            </button>
          ))}
        </section>

        <section style={historyStyle}>
          {summary.history.map((item) => (
            <article key={item.id} style={historyRowStyle}>
              <p style={historyDateStyle}>{formatDateDMY(item.date, item.date).slice(0, 5)}</p>
              <p style={historyTextStyle}>{item.text}</p>
              {item.amountText ? <p style={historyAmountStyle}>{item.amountText}</p> : null}
            </article>
          ))}
          <p style={historyBalanceStyle}>Υπόλοιπο: {money(summary.remainingBalance)}</p>
        </section>
      </div>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={rowStyle}>
      <span style={{ ...rowLabelStyle, ...(strong ? strongTextStyle : null) }}>{label}:</span>
      <span style={{ ...rowValueStyle, ...(strong ? strongTextStyle : null) }}>{value}</span>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: '#f8fafc',
  padding: '12px 12px 24px',
}

const containerStyle: CSSProperties = {
  maxWidth: '460px',
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

const previewBadgeStyle: CSSProperties = {
  margin: 0,
  alignSelf: 'flex-start',
  borderRadius: '999px',
  background: '#fef3c7',
  color: '#92400e',
  fontSize: '12px',
  fontWeight: 800,
  padding: '5px 10px',
}

const topSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const nameStyle: CSSProperties = {
  margin: 0,
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  color: '#0f172a',
  textTransform: 'uppercase',
}

const metaLineStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  color: '#334155',
  fontWeight: 700,
}

const simpleSectionStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '10px',
  padding: '12px',
}

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: '20px',
  color: '#0f172a',
  fontWeight: 900,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '4px 0',
}

const rowLabelStyle: CSSProperties = {
  fontSize: '16px',
  color: '#334155',
}

const rowValueStyle: CSSProperties = {
  fontSize: '16px',
  color: '#0f172a',
  fontWeight: 700,
}

const strongTextStyle: CSSProperties = {
  fontWeight: 900,
}

const balanceSectionStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '10px',
  padding: '12px',
}

const balanceLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: '22px',
  fontWeight: 900,
  color: '#0f172a',
}

const balanceValueStyle: CSSProperties = {
  margin: '6px 0 0 0',
  fontSize: '54px',
  lineHeight: 1,
  fontWeight: 900,
  color: '#0f172a',
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const disabledActionStyle: CSSProperties = {
  width: '100%',
  minHeight: '50px',
  borderRadius: '12px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  padding: '10px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '16px',
  fontWeight: 800,
  opacity: 0.8,
}

const soonPillStyle: CSSProperties = {
  borderRadius: '999px',
  background: '#e2e8f0',
  color: '#334155',
  fontSize: '12px',
  fontWeight: 800,
  padding: '4px 8px',
}

const historyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const historyRowStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '10px',
  padding: '10px 12px',
}

const historyDateStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  color: '#0f172a',
  fontWeight: 900,
}

const historyTextStyle: CSSProperties = {
  margin: '3px 0 0 0',
  fontSize: '16px',
  color: '#334155',
  fontWeight: 700,
}

const historyAmountStyle: CSSProperties = {
  margin: '3px 0 0 0',
  fontSize: '20px',
  color: '#0f172a',
  fontWeight: 900,
}

const historyBalanceStyle: CSSProperties = {
  margin: '4px 0 0 0',
  fontSize: '20px',
  fontWeight: 900,
  color: '#0f172a',
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
