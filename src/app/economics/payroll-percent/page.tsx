"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
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
  payroll_pct_of_turnover?: number | null
}

type RpcPayload = {
  date?: string | null
  days_in_month?: number | null
  daily_turnover?: number | null
  total_daily_payroll?: number | null
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
  payrollPctOfTurnover: number
}

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const eur = (n: number) =>
  Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'

const pct = (n: number) => `${Number(n || 0).toFixed(2)}%`

function PayrollPercentContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [dailyTurnover, setDailyTurnover] = useState(0)
  const [dailyPayrollCost, setDailyPayrollCost] = useState(0)
  const [payrollPct, setPayrollPct] = useState(0)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<EmployeePayrollRow[]>([])

  const businessDate = useMemo(() => getBusinessDate(), [])
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!storeId || !isValidUUID(storeId)) router.replace('/select-store')
  }, [storeId, router])

  const load = useCallback(async () => {
    if (!storeId || !isValidUUID(storeId)) return
    const requestId = ++requestIdRef.current

    try {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_staff_payroll_pressure_summary', {
        p_store_id: storeId,
        p_date: businessDate,
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
        payrollPctOfTurnover: Number(r.payroll_pct_of_turnover || 0),
      }))

      setRows(mappedRows)
      setEffectiveDate(String(payload.date || businessDate))
      setDailyTurnover(Number(payload.daily_turnover || 0))
      setDailyPayrollCost(Number(payload.total_daily_payroll || 0))
      setPayrollPct(Number(payload.payroll_pct || 0))
      setStatus(String(payload.status || ''))
    } catch (err) {
      console.error('Payroll % load error', err)
      toast.error('Σφάλμα φόρτωσης μισθοδοσίας % τζίρου')
      setRows([])
      setEffectiveDate(businessDate)
      setDailyPayrollCost(0)
      setDailyTurnover(0)
      setPayrollPct(0)
      setStatus('')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [storeId, supabase, businessDate])

  useEffect(() => {
    void load()
  }, [load])

  const statusMeta = useMemo(() => {
    const label = status || (payrollPct <= 25 ? 'OK' : payrollPct <= 35 ? 'WARNING' : 'DANGER')
    if (payrollPct <= 25) return { label, bg: '#ecfdf5', color: '#166534', border: '#86efac' }
    if (payrollPct <= 35) return { label, bg: '#fff7ed', color: '#c2410c', border: '#fdba74' }
    return { label, bg: '#fef2f2', color: '#b91c1c', border: '#fca5a5' }
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
        <EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Μισθοδοσία % Τζίρου" businessDate={businessDate} />

        <div style={{ ...card, marginBottom: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} />
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>ΗΜΕΡΑ</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 900 }}>{loading ? businessDate : (effectiveDate || businessDate)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>
                <TrendingUp size={15} /> Τζίρος Ημέρας
              </div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{loading ? '—' : eur(dailyTurnover)}</div>
            </div>

            <div style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>
                <Users size={15} /> Συνολικό Ημερήσιο Κόστος Μισθοδοσίας
              </div>
              <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{loading ? '—' : eur(dailyPayrollCost)}</div>
            </div>

            <div style={{ ...card, padding: 12 }}>
              <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 12 }}>Μισθοδοσία % Τζίρου</div>
              <div style={{ marginTop: 6, fontSize: 28, fontWeight: 900, color: 'var(--text)' }}>{loading ? '—' : pct(payrollPct)}</div>
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
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 800 }}>Φόρτωση...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontWeight: 800 }}>Δεν βρέθηκαν εργαζόμενοι.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((r) => (
                <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'var(--surface)' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>{r.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Metric label="Μηνιαίος Μισθός" value={eur(r.monthlySalary)} />
                    <Metric label={`Ασφάλιση ${pct(r.insurancePct)}`} value={eur(r.insuranceAmount)} icon={<Shield size={13} />} />
                    <Metric label="Συνολικό Μηνιαίο Κόστος" value={eur(r.totalMonthlyCost)} />
                    <Metric label="Ημερήσιο Κόστος" value={eur(r.dailyCost)} />
                    <Metric label="% επί σημερινού τζίρου" value={pct(r.payrollPctOfTurnover)} span2 />
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

function Metric({ label, value, icon, span2 = false }: { label: string; value: string; icon?: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, gridColumn: span2 ? 'span 2' : 'span 1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11, fontWeight: 900 }}>
        {icon}
        <span>{label}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
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
