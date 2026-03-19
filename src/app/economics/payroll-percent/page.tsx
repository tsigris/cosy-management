"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import EconomicsPeriodFilter, { getStartOfMonth, getStartOfYear, getLast30Days } from '@/components/economics/EconomicsPeriodFilter'
import { getBusinessDate } from '@/lib/businessDate'
import { toast, Toaster } from 'sonner'
import { Users, TrendingUp, Shield, CalendarDays } from 'lucide-react'

type RpcEmployeeRow = {
  employee_id?: string | null
  name?: string | null
  monthly_salary?: number | null
  insurance_pct?: number | null
  insurance_amount?: number | null
  total_monthly_cost?: number | null
  daily_cost?: number | null
  period_cost?: number | null
  payroll_pct_of_turnover?: number | null
}

type RpcPayload = {
  start_date?: string | null
  end_date?: string | null
  days_in_period?: number | null
  period_turnover?: number | null
  total_period_payroll?: number | null
  payroll_pct?: number | null
  status?: string | null
  rows?: RpcEmployeeRow[] | null
}

type EmployeePayrollRow = {
  id: string
  name: string
  monthlySalary: number
  insurancePct: number
  insuranceAmount: number
  totalMonthlyCost: number
  dailyCost: number
  periodCost: number
  payrollPctOfTurnover: number
}

type Period = 'month' | 'year' | '30days' | 'all'

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const eur = (n: number) =>
  Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'

const pct = (n: number) => `${Number(n || 0).toFixed(2)}%`

function formatDateGR(dateString: string) {
  if (!dateString) return dateString
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return dateString
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTodayKey() {
  return toDateKey(new Date())
}

function getSevenDaysAgoKey() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toDateKey(d)
}

const statusLabelMap: Record<string, string> = {
  perfect: 'Ιδανικό',
  warning: 'Οριακό',
  danger: 'Υψηλό κόστος',
  no_turnover: 'Χωρίς τζίρο',
}

function PayrollPercentContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [periodTurnover, setPeriodTurnover] = useState(0)
  const [totalPeriodPayroll, setTotalPeriodPayroll] = useState(0)
  const [payrollPct, setPayrollPct] = useState(0)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<EmployeePayrollRow[]>([])

  const businessDate = useMemo(() => getBusinessDate(), [])
  const requestIdRef = useRef(0)
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 8 }, (_, i) => current - i)
  }, [])

  useEffect(() => {
    if (!storeId || !isValidUUID(storeId)) router.replace('/select-store')
  }, [storeId, router])

  useEffect(() => {
    const now = new Date()
    const queryStart = searchParams.get('start') || ''
    const queryEnd = searchParams.get('end') || ''
    const safeEnd = isValidDateKey(queryEnd) ? queryEnd : getTodayKey()
    const safeStart = isValidDateKey(queryStart) ? queryStart : getSevenDaysAgoKey()
    const end = businessDate

    if (period === 'month') {
      setStartDate(toDateKey(getStartOfMonth()))
      setEndDate(end)
      return
    }

    if (period === 'year') {
      setStartDate(toDateKey(getStartOfYear(selectedYear)))
      setEndDate(selectedYear === now.getFullYear() ? end : `${selectedYear}-12-31`)
      return
    }

    if (period === '30days') {
      setStartDate(toDateKey(getLast30Days()))
      setEndDate(end)
      return
    }

    setStartDate(safeStart)
    setEndDate(safeEnd)
  }, [period, selectedYear, businessDate, searchParams])

  const load = useCallback(async () => {
    if (!storeId || !isValidUUID(storeId) || !startDate || !endDate) return
    const requestId = ++requestIdRef.current

    try {
      setLoading(true)

      const { data, error } = await supabase.rpc('get_staff_payroll_pressure_period_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (requestId !== requestIdRef.current) return
      if (error) throw error

      const rawPayload = Array.isArray(data) ? data[0] : data
      const payload = (rawPayload || {}) as RpcPayload
      const payloadRows = Array.isArray(payload.rows) ? payload.rows : []

      const mappedRows: EmployeePayrollRow[] = payloadRows.map((r) => ({
        id: String(r.employee_id || crypto.randomUUID()),
        name: String(r.name || 'Άγνωστος'),
        monthlySalary: Number(r.monthly_salary || 0),
        insurancePct: Number(r.insurance_pct || 0),
        insuranceAmount: Number(r.insurance_amount || 0),
        totalMonthlyCost: Number(r.total_monthly_cost || 0),
        dailyCost: Number(r.daily_cost || 0),
        periodCost: Number(r.period_cost || 0),
        payrollPctOfTurnover: Number(r.payroll_pct_of_turnover || 0),
      }))

      setRows(mappedRows)
      setStartDate(String(payload.start_date || startDate))
      setEndDate(String(payload.end_date || endDate))
      setPeriodTurnover(Number(payload.period_turnover || 0))
      setTotalPeriodPayroll(Number(payload.total_period_payroll || 0))
      setPayrollPct(Number(payload.payroll_pct || 0))
      setStatus(String(payload.status || ''))
    } catch (err) {
      console.error('Payroll % load error', err)
      toast.error('Σφάλμα φόρτωσης μισθοδοσίας % τζίρου')
      setRows([])
      setTotalPeriodPayroll(0)
      setPeriodTurnover(0)
      setPayrollPct(0)
      setStatus('')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [storeId, supabase, startDate, endDate])

  useEffect(() => {
    void load()
  }, [load])

  const statusMeta = useMemo(() => {
    const rawLabel = status || (payrollPct <= 25 ? 'perfect' : payrollPct <= 35 ? 'warning' : 'danger')
    const displayLabel = statusLabelMap[rawLabel] || rawLabel

    if (rawLabel === 'no_turnover') {
      return { label: displayLabel, bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' }
    }
    if (payrollPct <= 25) {
      return { label: displayLabel, bg: '#ecfdf5', color: '#166534', border: '#86efac' }
    }
    if (payrollPct <= 35) {
      return { label: displayLabel, bg: '#fff7ed', color: '#c2410c', border: '#fdba74' }
    }
    return { label: displayLabel, bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' }
  }, [payrollPct, status])

  if (!storeId || !isValidUUID(storeId)) return null

  const card: any = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 14,
    boxShadow: 'var(--shadow)',
  }

  return (
    <div style={{ background: 'var(--bg-grad)', minHeight: '100vh', padding: 20 }}>
      <Toaster position="top-center" richColors />

      <EconomicsContainer>
        <EconomicsHeaderNav
          title="Οικονομικό Κέντρο"
          subtitle="Μισθοδοσία % Τζίρου"
          businessDate={businessDate}
        />

        <EconomicsPeriodFilter
          period={period}
          onPeriodChange={(p) => setPeriod(p)}
          selectedYear={selectedYear}
          onYearChange={(y) => setSelectedYear(y)}
          yearOptions={yearOptions}
        />

        <div style={{ ...card, marginTop: 6, marginBottom: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} />
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>ΠΕΡΙΟΔΟΣ</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 900 }}>
              {`${formatDateGR(startDate)} - ${formatDateGR(endDate)}`}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>
                <TrendingUp size={15} /> Τζίρος Περιόδου
              </div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
                {loading ? '—' : eur(periodTurnover)}
              </div>
            </div>

            <div style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>
                <Users size={15} /> Συνολικό Κόστος Μισθοδοσίας Περιόδου
              </div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>
                {loading ? '—' : eur(totalPeriodPayroll)}
              </div>
            </div>

            <div style={{ ...card, padding: 12 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>Μισθοδοσία % Τζίρου</div>
              <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>
                {loading ? '—' : pct(payrollPct)}
              </div>

              {!loading && (
                <span
                  style={{
                    marginTop: 8,
                    display: 'inline-flex',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontWeight: 900,
                    fontSize: 11,
                    background: statusMeta.bg,
                    color: statusMeta.color,
                    border: `1px solid ${statusMeta.border}`,
                  }}
                >
                  {statusMeta.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>Ανά Εργαζόμενο</div>

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 800 }}>
              Φόρτωση...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 800 }}>
              Δεν βρέθηκαν εργαζόμενοι.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 12,
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
                    {r.name}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Metric label="Μηνιαίος Μισθός" value={eur(r.monthlySalary)} />
                    <Metric
                      label={`Ασφάλιση ${pct(r.insurancePct)}`}
                      value={eur(r.insuranceAmount)}
                      icon={<Shield size={13} />}
                    />
                    <Metric label="Συνολικό Μηνιαίο Κόστος" value={eur(r.totalMonthlyCost)} />
                    <Metric label="Ημερήσιο Κόστος" value={eur(r.dailyCost)} />
                    <Metric label="Κόστος Περιόδου" value={eur(r.periodCost)} />
                    <Metric label="% επί τζίρου περιόδου" value={pct(r.payrollPctOfTurnover)} span2 />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </EconomicsContainer>
    </div>
  )
}

function Metric({
  label,
  value,
  icon,
  span2 = false,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  span2?: boolean
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 10,
        gridColumn: span2 ? 'span 2' : 'span 1',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--muted)',
          fontSize: 11,
          fontWeight: 900,
        }}
      >
        {icon}
        <span>{label}</span>
      </div>

      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  )
}

export default function EconomicsPayrollPercentPage() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: 50, textAlign: 'center' }}>Φόρτωση...</div>}>
        <PayrollPercentContent />
      </Suspense>
    </main>
  )
}