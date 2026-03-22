'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { formatBusinessDayDate, toBusinessDayDateNormalized } from '@/lib/businessDate'
import { getEmployees } from '@/lib/employees'
import { formatDateEl } from '@/lib/formatters'
import PermissionGuard from '@/components/PermissionGuard'
import ReadOnlyBanner from '@/components/ReadOnlyBanner'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { Eye, EyeOff, Coins, Pencil, Trash2 } from 'lucide-react'

// --- ΠΑΛΕΤΑ ΧΡΩΜΑΤΩΝ ---
const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentBlue: '#2563eb',
  accentGreen: '#059669',
  accentRed: '#dc2626',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  slate100: '#f1f5f9',
}

type PayBasis = 'monthly' | 'daily'

// ✅ safest date parser (handles ISO/date-only/timestamp)
const parseTxDate = (t: any): Date | null => {
  if (!t) return null
  const raw = t.date || t.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const getBusinessYear = (d: Date) => toBusinessDayDateNormalized(d).getFullYear()
const getBusinessMonth = (d: Date) => toBusinessDayDateNormalized(d).getMonth()

const getIncludedDaysOff = (workDaysPerMonth: number) => {
  if (workDaysPerMonth === 30) return 0
  if (workDaysPerMonth === 26) return 4
  if (workDaysPerMonth === 22) return 8
  return 0
}

const formatShortDayMonth = (dateInput: string) => {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function EmployeesContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store') // ✅ SaaS context from URL

  const [employees, setEmployees] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [allStoreTransactions, setAllStoreTransactions] = useState<any[]>([])
  const [overtimes, setOvertimes] = useState<any[]>([])
  const [employeeDaysOff, setEmployeeDaysOff] = useState<any[]>([])
  const [employeeDayOffDateColumn, setEmployeeDayOffDateColumn] = useState<'off_date' | 'date'>('date')
  const [payrollCardsByEmployeeId, setPayrollCardsByEmployeeId] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)

  const [payBasis, setPayBasis] = useState<PayBasis>('monthly')
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [kpiPeriod, setKpiPeriod] = useState<'today' | 'month'>('month')
  const [storeDisplayName, setStoreDisplayName] = useState('Κατάστημα')

  // Active / Inactive
  const [showInactive, setShowInactive] = useState(false)

  // States για overtime modal
  const [otModal, setOtModal] = useState<{ empId: string; name: string } | null>(null)
  const [otHours, setOtHours] = useState('')

  // States για days-off modal
  const [dayOffModal, setDayOffModal] = useState<{ empId: string; name: string } | null>(null)
  const [dayOffDates, setDayOffDates] = useState<string[]>([new Date().toISOString().split('T')[0]])

  // Quick Tips (create)
  const [tipModal, setTipModal] = useState<{ empId: string; name: string } | null>(null)
  const [tipAmount, setTipAmount] = useState('')

  // Tips Edit (edit existing tip)
  const [tipEditModal, setTipEditModal] = useState<{ id: string; name: string; amount: number } | null>(null)
  const [tipEditAmount, setTipEditAmount] = useState('')

  // Tips Analysis (current month + list)
  const [tipsStats, setTipsStats] = useState({
    monthlyTips: 0,
    lastTips: [] as Array<{ id: string; name: string; date: string; amount: number }>,
  })
  const [showTipsList, setShowTipsList] = useState(false)
  const [isAmountFocused, setIsAmountFocused] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)

  const availableYears: number[] = []
  for (let y = 2024; y <= new Date().getFullYear(); y++) availableYears.push(y)

  const monthlyDayOptions = [
    { value: '22', label: '22 (8 ρεπό)' },
    { value: '26', label: '26 (4 ρεπό)' },
    { value: '30', label: '30 (Όλες)' },
  ]

  // ✅ Form Data (includes monthly_days)
  const [formData, setFormData] = useState({
    full_name: '',
    position: '',
    amka: '',
    iban: '',
    bank_name: 'Εθνική Τράπεζα',
    monthly_salary: '',
    daily_rate: '',
    monthly_days: '26', // ✅ default
    start_date: new Date().toISOString().split('T')[0],
  })

  const getDayOffDateValue = useCallback(
    (row: any) => String(row?.[employeeDayOffDateColumn] ?? row?.off_date ?? row?.date ?? ''),
    [employeeDayOffDateColumn],
  )

  const detectDayOffDateColumn = useCallback(async (): Promise<'off_date' | 'date'> => {
    const offDateProbe = await supabase.from('employee_days_off').select('off_date').limit(1)
    if (!offDateProbe.error) return 'off_date'

    const dateProbe = await supabase.from('employee_days_off').select('date').limit(1)
    if (!dateProbe.error) return 'date'

    return 'date'
  }, [])

  // ✅ Redirect if storeId is missing/invalid
  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
    }
  }, [storeId, router])

  // ✅ Tips stats fetcher (CURRENT MONTH with BUSINESS MONTH logic + last 5)
  const getTipsStats = useCallback(async () => {
    try {
      if (!storeId || storeId === 'null') return

      const start = new Date()
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)

      const { data, error } = await supabase
        .from('transactions')
        .select('id,date,created_at,notes,employee_id,fixed_asset_id,amount,type')
        .eq('store_id', storeId)
        .eq('type', 'tip_entry')
        .gte('date', start.toISOString().slice(0, 10))
        .lt('date', end.toISOString().slice(0, 10))
        .order('date', { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      const now = new Date()
      const currentBusinessYear = getBusinessYear(now)
      const currentBusinessMonth = getBusinessMonth(now)
      const employeeNamesById = new Map(employees.map((e: any) => [String(e.id), String(e.name || '')]))

      let monthlyTips = 0

      const tipsThisBusinessMonth = (data || [])
        .map((t: any) => {
          const note = String(t.notes || '')
          const isTip = /tips/i.test(note) || String(t.type || '') === 'tip_entry'

          const d = parseTxDate(t)
          if (!d) {
            return {
              id: t.id,
              name: employeeNamesById.get(String(t.employee_id || '')) || employeeNamesById.get(String(t.fixed_asset_id || '')) || t?.fixed_assets?.name || '—',
              date: t.date,
              amount: 0,
              note,
              _d: null as Date | null,
              _isTip: isTip,
            }
          }

          // amount από DB (σωστό), fallback από notes για παλιές εγγραφές
          let amount = Number(t.amount) || 0
          if (isTip && amount === 0) {
            const m = note.replace(',', '.').match(/[\d.]+/)
            amount = m ? parseFloat(m[0]) : 0
          }

          return {
            id: t.id,
            name: employeeNamesById.get(String(t.employee_id || '')) || employeeNamesById.get(String(t.fixed_asset_id || '')) || t?.fixed_assets?.name || '—',
            date: t.date,
            amount,
            note,
            _d: d,
            _isTip: isTip,
          }
        })
        .filter((t: any) => {
          if (!t._isTip) return false
          if (!t._d) return false
          return getBusinessYear(t._d) === currentBusinessYear && getBusinessMonth(t._d) === currentBusinessMonth
        })
        // keep most recent by actual timestamp
        .sort((a: any, b: any) => (b._d?.getTime() || 0) - (a._d?.getTime() || 0))

      tipsThisBusinessMonth.forEach((t: any) => {
        monthlyTips += t.amount
      })

      setTipsStats({
        monthlyTips,
        lastTips: tipsThisBusinessMonth.slice(0, 5).map((t: any) => ({
          id: t.id,
          name: t.name,
          date: t.date,
          amount: t.amount,
        })),
      })
    } catch (e) {
      console.error(e)
    }
  }, [storeId, employees])

  const fetchInitialData = useCallback(async () => {
    setLoading(true)
    try {
      if (!storeId || storeId === 'null') {
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) return

      const dayOffDateColumn = await detectDayOffDateColumn()
      setEmployeeDayOffDateColumn(dayOffDateColumn)
      const dayOffSelect = dayOffDateColumn === 'off_date' ? 'id, employee_id, store_id, off_date' : 'id, employee_id, store_id, date'

      const businessAsOfDate = toBusinessDayDateNormalized(new Date()).toISOString().slice(0, 10)

      const [empsRes, transRes, otRes, dayOffRes, allStoreTransRes, payrollSummaryRes, storeRes] = await Promise.all([
        getEmployees(storeId),
        supabase
          .from('transactions')
          .select('*')
          .eq('store_id', storeId)
          .or('fixed_asset_id.not.is.null,employee_id.not.is.null')
          .order('date', { ascending: false }),
        supabase.from('employee_overtimes').select('*').eq('store_id', storeId).eq('is_paid', false),
        supabase.from('employee_days_off').select(dayOffSelect).eq('store_id', storeId).order(dayOffDateColumn, { ascending: true }),
        supabase.from('transactions').select('id,amount,date,created_at,category,type,notes,employee_id,fixed_asset_id').eq('store_id', storeId),
        supabase.rpc('get_employee_payroll_cards_summary', {
          p_store_id: storeId,
          p_as_of_date: businessAsOfDate,
        }),
        supabase.from('stores').select('name').eq('id', storeId).maybeSingle(),
      ])

      if (empsRes) setEmployees(empsRes)
      if (transRes.data) setTransactions(transRes.data)
      if (allStoreTransRes.data) setAllStoreTransactions(allStoreTransRes.data)
      if (otRes.data) setOvertimes(otRes.data)
      if (dayOffRes.data) setEmployeeDaysOff(dayOffRes.data)
      if (payrollSummaryRes.error) {
        console.error(payrollSummaryRes.error)
      }
      if (payrollSummaryRes.data) {
        const nextMap = (payrollSummaryRes.data as any[]).reduce((acc: Record<string, any>, row: any) => {
          const key = String(row?.employee_id || '')
          if (!key) return acc
          acc[key] = row
          return acc
        }, {})
        setPayrollCardsByEmployeeId(nextMap)
      }
      setStoreDisplayName(String(storeRes.data?.name || '').trim() || 'Κατάστημα')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [storeId, detectDayOffDateColumn])

  useEffect(() => {
    fetchInitialData()
  }, [fetchInitialData])

  useEffect(() => {
    if (storeId && storeId !== 'null') getTipsStats()
  }, [storeId, getTipsStats])

  const requireTenantStoreId = useCallback(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
      throw new Error('Missing store_id. Tenant scope required.')
    }
    return storeId
  }, [storeId, router])

  // Φιλτράρισμα λίστας βάσει showInactive
  // Tenant scoping is handled by getEmployees() at the DB layer (.or store_id/null)
  const visibleEmployees = employees.filter((emp) => {
    if (!showInactive && emp.is_active === false) return false
    return true
  })

  const daysOffByEmployee = useMemo(() => {
    return employeeDaysOff.reduce((acc: Record<string, any[]>, row: any) => {
      const employeeId = String(row.employee_id || '')
      if (!employeeId) return acc
      if (!acc[employeeId]) acc[employeeId] = []
      acc[employeeId].push(row)
      return acc
    }, {})
  }, [employeeDaysOff])

  // ✅ HERO KPI: Σύνολο πληρωμών υπαλλήλων τρέχοντος ΜΗΝΑ (BUSINESS MONTH) (EXCLUDES tips)
  const currentMonthPayrollTotal = useMemo(() => {
    const now = new Date()
    const todayBusinessDate = toBusinessDayDateNormalized(now)
    const y = todayBusinessDate.getFullYear()
    const m = todayBusinessDate.getMonth()
    const day = todayBusinessDate.getDate()

    // μόνο υπάλληλοι που υπάρχουν στον πίνακα fixed_assets staff (για ασφάλεια)
    const staffIds = new Set(employees.map((e: any) => String(e.id)))

    return transactions
      .filter((t: any) => {
        const txEmployeeId = String(t?.employee_id || '')
        const txFixedAssetId = String(t?.fixed_asset_id || '')
        if (!txEmployeeId && !txFixedAssetId) return false
        if (!staffIds.has(txEmployeeId) && !staffIds.has(txFixedAssetId)) return false

        const d = parseTxDate(t)
        if (!d) return false

        const businessDate = toBusinessDayDateNormalized(d)
        if (kpiPeriod === 'today') {
          if (businessDate.getFullYear() !== y || businessDate.getMonth() !== m || businessDate.getDate() !== day) return false
        } else {
          if (businessDate.getFullYear() !== y || businessDate.getMonth() !== m) return false
        }

        // exclude tips (και παλιές/νέες εγγραφές)
        const note = String(t.notes || '')
        const txType = String(t.type || '')
        const isTip = /tips/i.test(note) || txType === 'tip_entry'
        if (isTip) return false

        return true
      })
      .reduce((acc: number, t: any) => acc + (Math.abs(Number(t.amount)) || 0), 0)
  }, [transactions, employees, kpiPeriod])

  const kpiDateContext = useMemo(() => {
    const now = toBusinessDayDateNormalized(new Date())
    return {
      today: now,
      year: now.getFullYear(),
      month: now.getMonth(),
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    }
  }, [])

  const accruedPayrollMonthToDate = useMemo(() => {
    const msPerDay = 1000 * 60 * 60 * 24
    const isTodayPeriod = kpiPeriod === 'today'

    return employees.reduce((acc: number, emp: any) => {
      const startRaw = emp?.start_date
      if (!startRaw) return acc

      const startDate = toBusinessDayDateNormalized(new Date(startRaw))
      if (isNaN(startDate.getTime())) return acc
      if (startDate > kpiDateContext.today) return acc

      const periodStart = isTodayPeriod ? kpiDateContext.today : startDate < kpiDateContext.monthStart ? kpiDateContext.monthStart : startDate
      if (periodStart > kpiDateContext.today) return acc

      const elapsedDays = Math.floor((kpiDateContext.today.getTime() - periodStart.getTime()) / msPerDay) + 1
      if (elapsedDays <= 0) return acc

      const monthlyDays = Number(emp.work_days_per_month ?? emp.monthly_days ?? 0)
      const isMonthlyEmployee = (emp.pay_basis || 'monthly') === 'monthly'

      if (!isMonthlyEmployee) {
        const dailyRate = Number(emp.daily_rate ?? 0)
        if (!Number.isFinite(dailyRate) || dailyRate <= 0) return acc
        return acc + dailyRate * elapsedDays
      }

      const monthlySalary = Number(emp.monthly_salary ?? 0)
      if (!Number.isFinite(monthlySalary) || monthlySalary <= 0 || monthlyDays <= 0) return acc

      const dailyCost = monthlySalary / monthlyDays
      const includedDaysOff = getIncludedDaysOff(monthlyDays)
      const daysOffRowsUpToToday = (daysOffByEmployee[emp.id] || []).filter((row) => {
        const rowDate = toBusinessDayDateNormalized(new Date(getDayOffDateValue(row)))
        if (isNaN(rowDate.getTime())) return false
        if (rowDate.getFullYear() !== kpiDateContext.year || rowDate.getMonth() !== kpiDateContext.month) return false
        return rowDate <= kpiDateContext.today
      })

      const actualDaysOff = daysOffRowsUpToToday.length

      const extraDaysOff = Math.max(actualDaysOff - includedDaysOff, 0)
      const baseAccrued = dailyCost * elapsedDays
      const deduction = extraDaysOff * dailyCost

      if (isTodayPeriod) {
        const actualDaysOffBeforeToday = daysOffRowsUpToToday.filter((row) => {
          const rowDate = toBusinessDayDateNormalized(new Date(getDayOffDateValue(row)))
          return rowDate < kpiDateContext.today
        }).length

        const extraBeforeToday = Math.max(actualDaysOffBeforeToday - includedDaysOff, 0)
        const todayExtraDaysOff = Math.max(extraDaysOff - extraBeforeToday, 0)
        const todayAccrued = dailyCost - todayExtraDaysOff * dailyCost
        return acc + Math.max(todayAccrued, 0)
      }

      return acc + Math.max(baseAccrued - deduction, 0)
    }, 0)
  }, [employees, daysOffByEmployee, getDayOffDateValue, kpiDateContext, kpiPeriod])

  const revenueTotalForSelectedPeriod = useMemo(() => {
    return allStoreTransactions
      .filter((t: any) => {
        const d = parseTxDate(t)
        if (!d) return false

        const businessDate = toBusinessDayDateNormalized(d)
        if (kpiPeriod === 'today') {
          const isToday =
            businessDate.getFullYear() === kpiDateContext.year &&
            businessDate.getMonth() === kpiDateContext.month &&
            businessDate.getDate() === kpiDateContext.today.getDate()
          if (!isToday) return false
        } else {
          const sameMonth = businessDate.getFullYear() === kpiDateContext.year && businessDate.getMonth() === kpiDateContext.month
          if (!sameMonth) return false
          if (businessDate > kpiDateContext.today) return false
        }

        const amount = Number(t.amount) || 0
        if (amount <= 0) return false

        const note = String(t.notes || '')
        const txType = String(t.type || '')
        const category = String(t.category || '').toLowerCase()
        const isTip = /tips/i.test(note) || txType === 'tip_entry'
        if (isTip) return false
        if (category === 'staff') return false

        return true
      })
      .reduce((acc: number, t: any) => acc + (Number(t.amount) || 0), 0)
  }, [allStoreTransactions, kpiDateContext, kpiPeriod])

  const payrollPercentOfRevenue = useMemo(() => {
    if (revenueTotalForSelectedPeriod <= 0) return 0
    return (accruedPayrollMonthToDate / revenueTotalForSelectedPeriod) * 100
  }, [accruedPayrollMonthToDate, revenueTotalForSelectedPeriod])

  const payrollPctVisual = useMemo(() => {
    if (payrollPercentOfRevenue <= 30) {
      return {
        card: { border: '1px solid #86efac', backgroundColor: '#f0fdf4' },
        valueColor: '#15803d',
      }
    }

    if (payrollPercentOfRevenue <= 35) {
      return {
        card: { border: '1px solid #fecdd3', backgroundColor: '#fff1f2' },
        valueColor: '#e11d48',
      }
    }

    return {
      card: { border: '1px solid #ef4444', backgroundColor: '#fee2e2' },
      valueColor: '#b91c1c',
    }
  }, [payrollPercentOfRevenue])

  // ✅ Toggle Active/Inactive (Supabase)  (fixed_assets)
  async function toggleActive(empId: string, currentValue: boolean | null | undefined) {
    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      toast.error('Αποτυχία ενημέρωσης κατάστασης υπαλλήλου.')
      return
    }

    const nextValue = currentValue === false ? true : false

    // optimistic UI
    setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, is_active: nextValue } : e)))

    const { error } = await supabase
      .from('fixed_assets')
      .update({ is_active: nextValue })
      .eq('id', empId)
      .eq('store_id', tenantStoreId)

    if (error) {
      // rollback
      setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, is_active: currentValue } : e)))
      toast.error('Αποτυχία ενημέρωσης κατάστασης υπαλλήλου.')
      return
    }

    toast.success(nextValue ? 'Ο υπάλληλος ενεργοποιήθηκε ✅' : 'Ο υπάλληλος απενεργοποιήθηκε 🚫')
    fetchInitialData()
  }

  // ✅ Υπολογισμός εκκρεμών ωρών (uses employee_id)
  const getPendingOtHours = (empId: string) => {
    return overtimes.filter((ot) => ot.employee_id === empId).reduce((acc, curr) => acc + Number(curr.hours), 0)
  }

  const getDefaultOvertimeHourlyRate = (empId: string) => {
    const employee = employees.find((emp) => emp.id === empId)
    if (!employee) return 0

    const dailyRate = Number(employee.daily_rate)
    if (Number.isFinite(dailyRate) && dailyRate > 0) return dailyRate / 8

    const monthlySalary = Number(employee.monthly_salary)
    const monthlyDays = Number(employee.monthly_days) || 25
    if (Number.isFinite(monthlySalary) && monthlySalary > 0 && monthlyDays > 0) return monthlySalary / (monthlyDays * 8)

    return 0
  }

  // ✅ Καταγραφή νέας υπερωρίας (store_id from URL) - uses employee_id
  async function handleQuickOvertime() {
    if (!otHours || !otModal) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const isValidEmployeeId = employees.some((emp) => emp.id === otModal.empId)
    if (!isValidEmployeeId) {
      toast.error('Μη έγκυρος υπάλληλος για καταγραφή υπερωρίας.')
      return
    }

    try {
      const hoursNum = Number(otHours)
      if (Number.isNaN(hoursNum) || hoursNum <= 0) {
        toast.error('Βάλε έγκυρες ώρες υπερωρίας.')
        return
      }

      const payload = {
        employee_id: otModal.empId,
        store_id: tenantStoreId,
        hours: hoursNum,
        date: new Date().toISOString().split('T')[0],
        is_paid: false,
      }

      const { error } = await supabase.from('employee_overtimes').insert([payload])

      if (error) {
        console.error(error)
        toast.error('Αποτυχία καταγραφής υπερωρίας.')
        return
      }

      toast.success(`Προστέθηκαν ${hoursNum} ώρες στην ${otModal.name}`)
      setOtModal(null)
      setOtHours('')
      fetchInitialData()
    } catch (error) {
      console.error(error)
      toast.error('Αποτυχία καταγραφής υπερωρίας.')
    }
  }

  async function handleQuickOvertimeAndPayNow() {
    if (!otHours || !otModal) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const isValidEmployeeId = employees.some((emp) => emp.id === otModal.empId)
    if (!isValidEmployeeId) {
      toast.error('Μη έγκυρος υπάλληλος για καταγραφή υπερωρίας.')
      return
    }

    const hoursNum = Number(otHours)
    if (Number.isNaN(hoursNum) || hoursNum <= 0) {
      toast.error('Βάλε έγκυρες ώρες υπερωρίας.')
      return
    }

    const defaultRate = getDefaultOvertimeHourlyRate(otModal.empId)
    const suggestedAmount = Number((hoursNum * defaultRate).toFixed(2))

    const amountInput = prompt(`Ποσό άμεσης πληρωμής για ${hoursNum} ώρες:`, suggestedAmount > 0 ? String(suggestedAmount) : '')
    if (amountInput === null) return

    const amountNum = Number(String(amountInput).replace(',', '.'))
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό πληρωμής.')
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const { error: overtimePayErr } = await supabase.rpc('overtime_pay_now_atomic', {
        p_store_id: tenantStoreId,
        p_employee_id: otModal.empId,
        p_hours: hoursNum,
        p_payment_amount: amountNum,
        p_method: 'Μετρητά',
        p_date: today,
        p_notes: `Άμεση πληρωμή υπερωρίας: ${hoursNum} ώρες`,
        p_category: 'Staff',
      })

      if (overtimePayErr) throw overtimePayErr

      toast.success(`Καταχωρήθηκε και πληρώθηκε άμεσα υπερωρία ${hoursNum} ωρών.`)
      setOtModal(null)
      setOtHours('')
      fetchInitialData()
    } catch (error) {
      console.error(error)
      toast.error('Αποτυχία άμεσης πληρωμής υπερωρίας.')
    }
  }

  async function deleteOvertime(id: string) {
    if (!confirm('Διαγραφή αυτής της υπερωρίας;')) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const { error } = await supabase.from('employee_overtimes').delete().eq('id', id).eq('store_id', tenantStoreId)
    if (error) {
      console.error(error)
      toast.error('Αποτυχία διαγραφής υπερωρίας.')
      return
    }

    toast.success('Η υπερωρία διαγράφηκε ✅')
    fetchInitialData()
  }

  async function handleAddDayOff() {
    if (!dayOffModal) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const normalizedDates = Array.from(new Set(dayOffDates.map((d) => String(d || '').slice(0, 10)).filter(Boolean)))
    if (normalizedDates.length === 0) {
      toast.error('Πρόσθεσε τουλάχιστον μία ημερομηνία.')
      return
    }

    const existingDates = new Set(
      employeeDaysOff
        .filter((row) => row.employee_id === dayOffModal.empId)
        .map((row) => getDayOffDateValue(row).slice(0, 10))
        .filter(Boolean),
    )

    const datesToInsert = normalizedDates.filter((d) => !existingDates.has(d))
    if (datesToInsert.length === 0) {
      toast.error('Οι επιλεγμένες ημερομηνίες υπάρχουν ήδη.')
      return
    }

    const dayOffPayloads = datesToInsert.map((d) => ({
      employee_id: dayOffModal.empId,
      store_id: tenantStoreId,
      off_date: d,
    }))

    console.log('[handleAddDayOff] dayOffModal.empId', dayOffModal.empId)
    console.log('[handleAddDayOff] tenantStoreId', tenantStoreId)
    console.log('[handleAddDayOff] normalizedDates', normalizedDates)
    console.log('[handleAddDayOff] datesToInsert', datesToInsert)
    console.log('[handleAddDayOff] dayOffPayloads', dayOffPayloads)

    const authUserResult = await supabase.auth.getUser()
    console.log('[handleAddDayOff] auth.getUser() result', authUserResult)

    const { data: insertData, error } = await supabase.from('employee_days_off').insert(dayOffPayloads)

    console.log('[handleAddDayOff] insert data', insertData)
    console.log('[handleAddDayOff] insert error', error)
    console.log('[handleAddDayOff] insert error json', JSON.stringify(error, null, 2))

    if (error) {
      console.error('[handleAddDayOff] full insert error', error)
      console.error('[handleAddDayOff] full insert error json', JSON.stringify(error, null, 2))
      toast.error('Αποτυχία αποθήκευσης ρεπό.')
      return
    }

    const skippedCount = normalizedDates.length - datesToInsert.length
    toast.success(skippedCount > 0 ? `Καταχωρήθηκαν ${datesToInsert.length} ρεπό (${skippedCount} παραλείφθηκαν).` : `Καταχωρήθηκαν ${datesToInsert.length} ρεπό για ${dayOffModal.name}`)
    setDayOffModal(null)
    setDayOffDates([new Date().toISOString().split('T')[0]])
    fetchInitialData()
  }

  async function handleDeleteDayOff(dayOffId: string) {
    if (!confirm('Να διαγραφεί αυτό το ρεπό;')) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const { error } = await supabase.from('employee_days_off').delete().eq('id', dayOffId).eq('store_id', tenantStoreId)
    if (error) {
      console.error(error)
      toast.error('Αποτυχία διαγραφής ρεπό.')
      return
    }

    toast.success('Το ρεπό διαγράφηκε ✅')
    fetchInitialData()
  }

  // ✅ Καταγραφή νέων Tips σαν transaction
  async function handleQuickTip() {
    if (!tipAmount || !tipModal) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const amountNum = Number(tipAmount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό tips.')
      return
    }

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('transactions').insert([
      {
        store_id: tenantStoreId,
        employee_id: tipModal.empId,
        fixed_asset_id: tipModal.empId,
        amount: amountNum,
        type: 'tip_entry', // ✅ tips as dedicated type
        category: 'Tips',
        method: 'Μετρητά',
        date: today,
        notes: `Tips: ${amountNum}€ [${tipModal.name}]`,
      },
    ])

    if (error) {
      console.error(error)
      toast.error('Αποτυχία καταγραφής tips.')
      return
    }

    toast.success(`Καταγράφηκαν Tips ${amountNum}€ για ${tipModal.name}`)
    setTipModal(null)
    setTipAmount('')
    fetchInitialData()
    getTipsStats()
  }

  // ✅ Επεξεργασία υπάρχοντος Tip
  async function handleEditTipSave() {
    if (!tipEditModal) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const amountNum = Number(tipEditAmount)
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Βάλε έγκυρο ποσό tips.')
      return
    }

    const { error } = await supabase
      .from('transactions')
      .update({
        amount: amountNum,
        type: 'tip_entry',
        notes: `Tips: ${amountNum}€ [${tipEditModal.name}]`,
        store_id: tenantStoreId,
      })
      .eq('id', tipEditModal.id)
      .eq('store_id', tenantStoreId)

    if (error) {
      console.error(error)
      toast.error('Αποτυχία επεξεργασίας tips.')
      return
    }

    toast.success('Τα tips ενημερώθηκαν ✅')
    setTipEditModal(null)
    setTipEditAmount('')
    fetchInitialData()
    getTipsStats()
  }

  // ✅ Διαγραφή Tip entry
  async function deleteTipTransaction(id: string) {
    if (!confirm('Διαγραφή αυτής της καταγραφής Tips;')) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('store_id', tenantStoreId)
    if (error) {
      console.error(error)
      toast.error('Αποτυχία διαγραφής tips.')
      return
    }

    toast.success('Διαγράφηκε ✅')
    fetchInitialData()
    getTipsStats()
  }

  const getDaysUntilPayment = (hireDateStr: string) => {
    if (!hireDateStr) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const hireDate = new Date(hireDateStr)
    hireDate.setHours(0, 0, 0, 0)
    let nextPayDate = new Date(hireDate)
    nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    while (nextPayDate <= today) nextPayDate.setMonth(nextPayDate.getMonth() + 1)
    const diffTime = nextPayDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // ✅ UPDATED getYearlyStats (BUSINESS YEAR)
  // - tips υπολογίζονται στο stats.tips
  // - tips ΔΕΝ υπολογίζονται στο stats.total (ΣΥΝΟΛΟ ΕΤΟΥΣ)
  const getYearlyStats = (id: string) => {
    const yearTrans = transactions.filter((t) => {
      if (String(t.employee_id || '') !== id && String(t.fixed_asset_id || '') !== id) return false
      const d = parseTxDate(t)
      if (!d) return false
      return getBusinessYear(d) === viewYear
    })

    let stats = { base: 0, overtime: 0, bonus: 0, tips: 0, total: 0 }
    const processedDates = new Set<string>()

    yearTrans.forEach((t) => {
      const note = String(t.notes || '')
      const txType = String(t.type || '')
      const isTip = /tips/i.test(note) || txType === 'tip_entry'
      const isAdvance = txType === 'salary_advance'

      if (!isTip) {
        stats.total += Number(t.amount) || 0
      }

      const d = parseTxDate(t)
      const key = d ? getBusinessYear(d) + '-' + getBusinessMonth(d) + '-' + toBusinessDayDateNormalized(d).getDate() : String(t.date || '')
      if (!processedDates.has(key)) {
        // skip extracting base/overtime/bonus for tips or advances
        if (!isTip && !isAdvance) {
          const extract = (label: string) => {
            const regex = new RegExp(`${label}:\\s*(\\d+(\\.\\d+)?)`, 'i')
            const match = note.match(regex)
            return match ? parseFloat(match[1]) : 0
          }

          stats.base += extract('Βασικός')
          stats.overtime += extract('Υπερ.')
          stats.bonus += extract('Bonus')
        }

        if (isTip) {
          const amt = Number(t.amount) || 0
          if (amt > 0) {
            stats.tips += amt
          } else {
            const m = note.replace(',', '.').match(/[\d.]+/)
            stats.tips += m ? parseFloat(m[0]) : 0
          }
        }

        processedDates.add(key)
      }
    })

    return stats
  }

  // ✅ Clean, type-safe handleSave (fixed_assets only fields)
  type FixedAssetStaffPayload = {
    name: string
    sub_category: 'staff'
    store_id: string
    start_date: string | null
    pay_basis: PayBasis
    monthly_salary: number | null
    daily_rate: number | null
    monthly_days: number
    is_active: boolean
  }

  async function handleSave() {
    const isSalaryMissing = payBasis === 'monthly' ? !formData.monthly_salary : !formData.daily_rate
    if (!formData.full_name.trim() || isSalaryMissing) return alert('Συμπληρώστε τα υποχρεωτικά πεδία!')

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    setLoading(true)

    const monthlyDaysNum = Number(formData.monthly_days)
    if (!Number.isFinite(monthlyDaysNum) || monthlyDaysNum <= 0) {
      toast.error('Βάλε έγκυρες "Μέρες Μήνα".')
      setLoading(false)
      return
    }

    const monthlySalaryNum = Number(formData.monthly_salary)
    const dailyRateNum = Number(formData.daily_rate)

    const payload: FixedAssetStaffPayload = {
      name: formData.full_name.trim(),
      sub_category: 'staff',
      store_id: tenantStoreId,
      start_date: formData.start_date || null,
      pay_basis: payBasis,
      monthly_salary: payBasis === 'monthly' && Number.isFinite(monthlySalaryNum) ? monthlySalaryNum : null,
      daily_rate: payBasis === 'daily' && Number.isFinite(dailyRateNum) ? dailyRateNum : null,
      monthly_days: monthlyDaysNum,
      is_active: true,
    }

    const { error } = editingId
      ? await supabase.from('fixed_assets').update(payload).eq('id', editingId).eq('store_id', tenantStoreId)
      : await supabase.from('fixed_assets').insert([payload])

    if (error) {
      console.error(error)
      toast.error(error.code === '42501' ? 'Δεν έχετε δικαιώματα διαχειριστή για αυτή την ενέργεια' : 'Αποτυχία αποθήκευσης.')
      setLoading(false)
      return
    }

    toast.success('Αποθηκεύτηκε!')
    setEditingId(null)
    resetForm()
    setIsAdding(false)
    fetchInitialData()
    setLoading(false)
  }

  // ✅ Delete staff: transition cleanup by employee_id OR fixed_asset_id, then delete fixed_assets
  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`Οριστική διαγραφή του/της ${name}; Θα σβηστεί και το ιστορικό.`)) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    setLoading(true)

    const { error: transErr } = await supabase
      .from('transactions')
      .delete()
      .eq('store_id', tenantStoreId)
      .or(`employee_id.eq.${id},fixed_asset_id.eq.${id}`)
    if (transErr) {
      console.error(transErr)
      toast.error('Αποτυχία διαγραφής συναλλαγών.')
      setLoading(false)
      return
    }

    const { error: empErr } = await supabase.from('fixed_assets').delete().eq('id', id).eq('store_id', tenantStoreId)
    if (empErr) {
      console.error(empErr)
      toast.error('Αποτυχία διαγραφής υπαλλήλου.')
      setLoading(false)
      return
    }

    toast.success('Διαγράφηκε ✅')
    fetchInitialData()
    setLoading(false)
  }

  async function deleteTransaction(id: string) {
    if (!confirm('Διαγραφή αυτής της πληρωμής;')) return

    let tenantStoreId: string
    try {
      tenantStoreId = requireTenantStoreId()
    } catch (error) {
      console.error(error)
      return
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('store_id', tenantStoreId)
    if (!error) fetchInitialData()
    else {
      console.error(error)
      toast.error('Αποτυχία διαγραφής πληρωμής.')
    }
  }

  const resetForm = () => {
    setFormData({
      full_name: '',
      position: '',
      amka: '',
      iban: '',
      bank_name: 'Εθνική Τράπεζα',
      monthly_salary: '',
      daily_rate: '',
      monthly_days: '26',
      start_date: new Date().toISOString().split('T')[0],
    })
    setPayBasis('monthly')
    setEditingId(null)
  }

  // ✅ current month label (BUSINESS MONTH)
  const currentMonthLabel = useMemo(() => {
    const d = toBusinessDayDateNormalized(new Date())
    return d.toLocaleString('el-GR', { month: 'long', year: 'numeric' }).toUpperCase()
  }, [])

  const selectedBusinessMonth = useMemo(() => {
    const d = toBusinessDayDateNormalized(new Date())
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [])

  const isEditMode = Boolean(editingId)

  return (
    <PermissionGuard storeId={storeId}>
      {({ isAdmin, isLoading: checkingPermission }) => (
        <div style={iphoneWrapper}>
          <Toaster position="top-center" richColors />

          <div style={{ maxWidth: '500px', margin: '0 auto', paddingBottom: '100px' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={logoBoxStyle}>👥</div>
                <h1 style={{ fontWeight: '800', fontSize: '22px', margin: 0, color: 'var(--text)' }}>Προσωπικό</h1>

                {/* ✅ Back link preserves SaaS context */}
                <Link href={`/?store=${storeId}`} style={backBtnStyle}>
                  ✕
                </Link>
              </div>
            </div>

            <div style={headerFiltersRow}>
              <button type="button" onClick={() => setKpiPeriod('today')} style={kpiPeriod === 'today' ? headerFilterChipActive : headerFilterChip}>
                Today
              </button>
              <button type="button" onClick={() => setKpiPeriod('month')} style={kpiPeriod === 'month' ? headerFilterChipActive : headerFilterChip}>
                Month
              </button>
              <span style={{ ...headerFilterChip, cursor: 'default' }}>Store: {storeDisplayName.toUpperCase()}</span>
            </div>

            <ReadOnlyBanner isAdmin={isAdmin} isLoading={checkingPermission} />

            {/* ✅ CREATE TIPS MODAL */}
            {tipModal && (
              <div style={modalOverlay}>
                <div style={modalCard}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Καταγραφή Tips</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{tipModal.name}</p>
                  <input
                    type="number"
                    placeholder="Ποσό tips (π.χ. 10)"
                    value={tipAmount}
                    onFocus={(e) => {
                      if (e.target.value === '0') setTipAmount('')
                    }}
                    onChange={(e) => setTipAmount(e.target.value)}
                    style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      onClick={() => {
                        setTipModal(null)
                        setTipAmount('')
                      }}
                      style={cancelBtnSmall}
                    >
                      ΑΚΥΡΟ
                    </button>
                    <button onClick={handleQuickTip} style={saveBtnSmall}>
                      ΠΡΟΣΘΗΚΗ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ EDIT TIPS MODAL */}
            {tipEditModal && (
              <div style={modalOverlay}>
                <div style={modalCard}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Επεξεργασία Tips</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{tipEditModal.name}</p>
                  <input
                    type="number"
                    placeholder="Νέο ποσό tips"
                    value={tipEditAmount}
                    onChange={(e) => setTipEditAmount(e.target.value)}
                    style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      onClick={() => {
                        setTipEditModal(null)
                        setTipEditAmount('')
                      }}
                      style={cancelBtnSmall}
                    >
                      ΑΚΥΡΟ
                    </button>
                    <button onClick={handleEditTipSave} style={saveBtnSmall}>
                      ΑΠΟΘΗΚΕΥΣΗ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OT MODAL */}
            {otModal && (
              <div style={modalOverlay}>
                <div style={modalCard}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Καταγραφή Υπερωρίας</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{otModal.name}</p>
                  <input
                    type="number"
                    placeholder="Ώρες (π.χ. 1.5)"
                    value={otHours}
                    onFocus={(e) => {
                      if (e.target.value === '0') setOtHours('')
                    }}
                    onChange={(e) => setOtHours(e.target.value)}
                    style={{ ...inputStyle, marginTop: '15px', textAlign: 'center', fontSize: '24px' }}
                    autoFocus
                  />

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      onClick={() => {
                        setOtModal(null)
                        setOtHours('')
                      }}
                      style={cancelBtnSmall}
                    >
                      ΑΚΥΡΟ
                    </button>
                    <button onClick={handleQuickOvertime} style={saveBtnSmall}>
                      ΚΑΤΑΧΩΡΗΣΗ
                    </button>
                  </div>
                  <button onClick={handleQuickOvertimeAndPayNow} style={payNowBtnSmall}>
                    ΚΑΤΑΧΩΡΗΣΗ & ΠΛΗΡΩΜΗ ΤΩΡΑ
                  </button>
                </div>
              </div>
            )}

            {/* DAYS OFF MODAL */}
            {dayOffModal && (
              <div style={modalOverlay}>
                <div style={modalCard}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Καταγραφή Ρεπό</h3>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{dayOffModal.name}</p>

                  <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dayOffDates.map((dateValue, idx) => (
                      <div key={`${dateValue}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="date"
                          value={dateValue}
                          onChange={(e) => {
                            const next = [...dayOffDates]
                            next[idx] = e.target.value
                            setDayOffDates(next)
                          }}
                          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                          autoFocus={idx === 0}
                        />
                        {dayOffDates.length > 1 && (
                          <button
                            type="button"
                            style={miniIconBtnDanger}
                            title="Αφαίρεση ημερομηνίας"
                            onClick={() => setDayOffDates((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setDayOffDates((prev) => [...prev, new Date().toISOString().split('T')[0]])}
                    style={{ ...cancelBtnSmall, width: '100%', marginTop: '10px' }}
                  >
                    + ΠΡΟΣΘΗΚΗ ΗΜΕΡΟΜΗΝΙΑΣ
                  </button>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      onClick={() => {
                        setDayOffModal(null)
                        setDayOffDates([new Date().toISOString().split('T')[0]])
                      }}
                      style={cancelBtnSmall}
                    >
                      ΑΚΥΡΟ
                    </button>
                    <button onClick={handleAddDayOff} style={saveBtnSmall}>
                      ΑΠΟΘΗΚΕΥΣΗ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ HERO: Current month payroll + current month tips (BUSINESS MONTH) */}
            <div style={payrollHeroCard}>
              <div style={payrollHeroTopRow}>
                <div style={payrollHeroPill}>ΣΥΝΟΛΟ ΥΠΑΛΛΗΛΩΝ • {currentMonthLabel}</div>
              </div>

              <div style={payrollHeroAmount}>{currentMonthPayrollTotal.toFixed(2)}€</div>
              <div style={payrollHeroHint}>Σύνολο πληρωμών υπαλλήλων τρέχοντος μήνα (χωρίς tips)</div>

              <div style={payrollHeroDivider} />

              <div style={payrollHeroTipsRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Coins size={16} />
                  <span style={payrollHeroTipsLabel}>ΣΥΝΟΛΟ TIPS • ΤΡΕΧΩΝ ΜΗΝΑΣ</span>
                </div>
                <span style={payrollHeroTipsValue}>{tipsStats.monthlyTips.toFixed(2)}€</span>
              </div>

              <button onClick={() => setShowTipsList((v) => !v)} style={payrollHeroTipsBtn}>
                {showTipsList ? 'Απόκρυψη Λίστας Tips' : 'Προβολή Λίστας Tips'}
              </button>
            </div>

            {showTipsList && (
              <div style={tipsListWrap}>
                {tipsStats.lastTips.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>
                    Δεν υπάρχουν tips καταγραφές για αυτόν τον μήνα.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {tipsStats.lastTips.map((t) => {
                      const d = new Date(t.date)
                      return (
                        <div key={t.id} style={tipsListItem}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 900, color: 'var(--text)', fontSize: '12px' }}>{t.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 800 }}>
                                {/* ✅ display with business-day */}
                                {isNaN(d.getTime()) ? '—' : formatBusinessDayDate(d)}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 900 }}>Tips</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 900, color: 'var(--muted)', fontSize: '12px' }}>{t.amount.toFixed(2)}€</span>

                              {isAdmin && (
                                <button
                                  style={miniIconBtn}
                                  title="Επεξεργασία"
                                  onClick={() => {
                                    setTipEditModal({ id: t.id, name: t.name, amount: t.amount })
                                    setTipEditAmount(String(t.amount))
                                  }}
                                >
                                  <Pencil size={16} />
                                </button>
                              )}

                              {isAdmin && (
                                <button style={miniIconBtnDanger} title="Διαγραφή" onClick={() => deleteTipTransaction(t.id)}>
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={kpiGridWrap}>
              <div style={kpiCard}>
                <p style={kpiCardLabel}>ΔΕΔΟΥΛΕΥΜΕΝΟ ΠΡΟΣΩΠΙΚΟΥ</p>
                <p style={kpiCardValue}>{accruedPayrollMonthToDate.toFixed(2)}€</p>
              </div>

              <div style={{ ...kpiCard, ...payrollPctVisual.card }}>
                <p style={kpiCardLabel}>ΜΙΣΘΟΔΟΣΙΑ % ΤΖΙΡΟΥ</p>
                <p style={{ ...kpiCardValue, color: payrollPctVisual.valueColor }}>{payrollPercentOfRevenue.toFixed(1)}%</p>
              </div>

              <div style={kpiCard}>
                <p style={kpiCardLabel}>ΣΥΝΟΛΟ ΠΡΟΣΩΠΙΚΟΥ</p>
                <p style={kpiCardValue}>{employees.length}</p>
              </div>
            </div>

            {/* ADD + SHOW INACTIVE */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (isAdding) resetForm()
                    setIsAdding(!isAdding)
                  }}
                  style={{ ...(isAdding ? cancelBtn : addBtn), marginBottom: 0, flex: 1 }}
                >
                  {isAdding ? 'ΑΚΥΡΩΣΗ' : '+ ΝΕΟΣ ΥΠΑΛΛΗΛΟΣ'}
                </button>
              )}

              <button
                onClick={() => setShowInactive((v) => !v)}
                style={iconToggleBtn}
                title={showInactive ? 'Απόκρυψη ανενεργών' : 'Εμφάνιση ανενεργών'}
              >
                {showInactive ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* FORM */}
            {isAdding && isAdmin && (
              <div
                ref={formRef}
                style={{
                  ...formCard,
                  borderColor: isEditMode ? '#f59e0b' : colors.primaryDark,
                  boxShadow: isEditMode ? '0 8px 18px rgba(245, 158, 11, 0.18)' : formCard.boxShadow,
                }}
              >
                <label style={labelStyle}>Ονοματεπώνυμο *</label>
                <input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} style={inputStyle} />

                <label style={{ ...labelStyle, marginTop: '16px' }}>Τύπος Συμφωνίας</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button onClick={() => setPayBasis('monthly')} style={payBasis === 'monthly' ? activeToggle : inactiveToggle}>
                    ΜΗΝΙΑΙΟΣ
                  </button>
                  <button onClick={() => setPayBasis('daily')} style={payBasis === 'daily' ? activeToggle : inactiveToggle}>
                    ΗΜΕΡΟΜΙΣΘΙΟ
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  {/* Salary/Daily + Monthly Days (if monthly) */}
                  <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>{payBasis === 'monthly' ? 'Μισθός (€) *' : 'Ημερομίσθιο (€) *'}</label>
                      <div style={amountInputWrap}>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={payBasis === 'monthly' ? formData.monthly_salary : formData.daily_rate}
                          onFocus={(e) => {
                            setIsAmountFocused(true)
                            if (e.target.value === '0')
                              setFormData({ ...formData, [payBasis === 'monthly' ? 'monthly_salary' : 'daily_rate']: '' })
                          }}
                          onBlur={() => setIsAmountFocused(false)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [payBasis === 'monthly' ? 'monthly_salary' : 'daily_rate']: e.target.value,
                            })
                          }
                          style={{ ...amountInputStyle, ...(isAmountFocused ? amountInputFocusedStyle : null) }}
                          placeholder="0"
                        />
                        <span style={euroAdornmentStyle}>€</span>
                      </div>
                    </div>

                    {payBasis === 'monthly' && (
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Μέρες Μήνα</label>
                        <div style={daysSelectorRow}>
                          {monthlyDayOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, monthly_days: option.value })}
                              style={formData.monthly_days === option.value ? dayToggleActive : dayToggleInactive}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Ημ. Πρόσληψης</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Τράπεζα Υπαλλήλου</label>
                  <select value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} style={inputStyle}>
                    <option value="Εθνική Τράπεζα">Εθνική Τράπεζα</option>
                    <option value="Eurobank">Eurobank</option>
                    <option value="Alpha Bank">Alpha Bank</option>
                    <option value="Τράπεζα Πειραιώς">Τράπεζα Πειραιώς</option>
                    <option value="Viva Wallet">Viva Wallet</option>
                  </select>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>IBAN Υπαλλήλου</label>
                  <input
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                    placeholder="GR00 0000 0000..."
                    style={inputStyle}
                  />
                </div>

                <button onClick={handleSave} disabled={loading} style={{ ...saveBtnStyle, backgroundColor: isEditMode ? '#f59e0b' : colors.primaryDark }}>
                  {loading ? 'ΓΙΝΕΤΑΙ ΑΠΟΘΗΚΕΥΣΗ...' : isEditMode ? 'ΕΝΗΜΕΡΩΣΗ ΣΤΟΙΧΕΙΩΝ' : 'ΑΠΟΘΗΚΕΥΣΗ'}
                </button>
              </div>
            )}

            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {visibleEmployees.map((emp) => {
                const yearlyStats = getYearlyStats(emp.id)
                const isSelected = selectedEmpId === emp.id
                const daysLeft = getDaysUntilPayment(emp.start_date)
                const payrollSummary = payrollCardsByEmployeeId[emp.id]
                const pendingOt = Number(payrollSummary?.pending_overtime_hours ?? 0)
                const pendingOtItems = overtimes
                  .filter((ot) => ot.employee_id === emp.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                const isInactive = emp.is_active === false
                const monthlyDays = Number(emp.work_days_per_month ?? emp.monthly_days ?? 0)
                const includedDaysOff = Number(payrollSummary?.included_days_off ?? 0)
                const monthlySalary = Number(emp.monthly_salary ?? 0)
                const isMonthlyEmployee = (emp.pay_basis || 'monthly') === 'monthly'
                const dayOffRowsThisMonth = (daysOffByEmployee[emp.id] || [])
                  .filter((row) => {
                    const rowDate = getDayOffDateValue(row)
                    const d = new Date(rowDate)
                    if (isNaN(d.getTime())) return false
                    const businessDate = toBusinessDayDateNormalized(d)
                    return businessDate.getFullYear() === selectedBusinessMonth.year && businessDate.getMonth() === selectedBusinessMonth.month
                  })
                  .sort((a, b) => new Date(getDayOffDateValue(a)).getTime() - new Date(getDayOffDateValue(b)).getTime())
                const actualDaysOff = Number(payrollSummary?.actual_days_off_current_month ?? 0)
                const extraDaysOff = Number(payrollSummary?.extra_days_off_current_month ?? 0)
                const daysOffDeduction = Number(payrollSummary?.days_off_deduction ?? 0)
                const daysOffLabel = dayOffRowsThisMonth.map((row) => formatShortDayMonth(getDayOffDateValue(row))).join(', ')
                const dailyCost = Number(payrollSummary?.daily_cost ?? 0)
                const hourlyRate = Number(payrollSummary?.hourly_cost ?? 0)
                const totalAdvances = Number(payrollSummary?.total_advances ?? 0)
                const pendingOtHours = Number(payrollSummary?.pending_overtime_hours ?? 0)
                const pendingOtAmount = Number(payrollSummary?.pending_overtime_amount ?? 0)
                const remainingPay = Number(payrollSummary?.remaining_pay ?? 0)
                const yearDaysOffCount = (daysOffByEmployee[emp.id] || []).filter((row) => {
                  const d = new Date(getDayOffDateValue(row))
                  if (isNaN(d.getTime())) return false
                  const businessDate = toBusinessDayDateNormalized(d)
                  return businessDate.getFullYear() === selectedBusinessMonth.year
                }).length

                return (
                  <div key={emp.id} style={{ ...employeeCard, opacity: isInactive ? 0.6 : 1 }}>
                    <div
                      onClick={() => setSelectedEmpId(isSelected ? null : emp.id)}
                      style={{
                        padding: '18px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: '10px',
                      }}
                    >
                      <p style={{ fontWeight: '700', color: 'var(--text)', fontSize: '16px', margin: 0 }}>
                        {String(emp.name || '').toUpperCase()}
                      </p>

                      <div style={employeeMetaRow}>
                        <span style={employeeMetaPill}>
                          {isMonthlyEmployee ? `ΜΙΣΘΟΣ ${monthlySalary.toFixed(2)}€` : `ΗΜΕΡΟΜΙΣΘΙΟ ${Number(emp.daily_rate ?? 0).toFixed(2)}€`}
                        </span>
                        <span style={employeeMetaPill}>ΚΟΣΤΟΣ/ΗΜΕΡΑ {dailyCost.toFixed(2)}€</span>
                        {isMonthlyEmployee && <span style={employeeMetaPill}>ΜΕΡΕΣ {monthlyDays}</span>}
                      </div>

                      {!isInactive && (
                        <div style={employeeQuickActionsRow}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOtModal({ empId: emp.id, name: emp.name })
                            }}
                            style={{ ...quickOtBtn, flex: 1 }}
                          >
                            + ⏱️
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setTipModal({ empId: emp.id, name: emp.name })
                            }}
                            style={{ ...quickTipBtn, flex: 1 }}
                          >
                            +💰 Tips
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDayOffModal({ empId: emp.id, name: emp.name })
                              setDayOffDates([new Date().toISOString().split('T')[0]])
                            }}
                            style={{ ...quickDayOffBtn, flex: 1 }}
                          >
                            + Ρεπό
                          </button>
                        </div>
                      )}

                      <div style={employeePaymentsRow}>
                        <Link
                          href={`/pay-employee?id=${emp.id}&name=${encodeURIComponent(emp.name || '')}&store=${storeId}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...payBtnStyle, flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ΠΛΗΡΩΜΗ
                        </Link>

                        <Link
                          href={`/pay-employee?id=${emp.id}&name=${encodeURIComponent(emp.name || '')}&store=${storeId}&mode=advance`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ ...advanceBtnStyle, flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ΠΡΟΚΑΤΑΒΟΛΗ
                        </Link>
                      </div>

                      <div style={{ ...employeeMiniSummaryRow, marginTop: 0 }}>
                        <span
                          style={{
                            ...badgeStyle,
                            backgroundColor: 'var(--surface)',
                            color: 'var(--muted)',
                          }}
                        >
                          {daysLeft === null ? 'ΟΡΙΣΕ ΗΜ. ΠΡΟΣΛΗΨΗΣ' : daysLeft === 0 ? 'ΣΗΜΕΡΑ 💰' : `ΣΕ ${daysLeft} ΗΜΕΡΕΣ 📅`}
                        </span>

                        {pendingOt > 0 && <span style={{ ...badgeStyle, backgroundColor: 'var(--surface)', color: 'var(--muted)' }}>⏱️ {pendingOt} ΩΡΕΣ</span>}
                        <span style={{ ...badgeStyle, backgroundColor: '#eef2ff', color: '#3730a3' }}>ΡΕΠΟ {actualDaysOff}/{includedDaysOff}</span>
                        {isMonthlyEmployee && <span style={{ ...badgeStyle, backgroundColor: '#ecfdf5', color: '#047857' }}>ΥΠΟΛΟΙΠΟ {remainingPay.toFixed(2)}€</span>}
                        {isInactive && <span style={{ ...badgeStyle, backgroundColor: 'var(--surface)', color: 'var(--muted)' }}>ΑΝΕΝΕΡΓΟΣ</span>}
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderTop: '1px solid var(--border)' }}>
                        <div
                          style={{
                            marginBottom: '20px',
                            padding: '12px',
                            backgroundColor: 'var(--surface)',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}
                        >
                          <p style={{ margin: '0 0 5px 0', fontWeight: '800', color: 'var(--muted)' }}>ΣΤΟΙΧΕΙΑ ΠΛΗΡΩΜΗΣ</p>
                          <p style={{ margin: 0, fontWeight: '700' }}>🏦 {emp.bank_name || 'Δεν ορίστηκε'}</p>
                          <p style={{ margin: '3px 0 0 0', fontWeight: '600', color: 'var(--muted)', fontSize: '11px' }}>
                            {emp.iban || 'Δεν ορίστηκε IBAN'}
                          </p>
                          {pendingOt > 0 && (
                            <p style={{ margin: '8px 0 0 0', fontWeight: '800', color: 'var(--muted)', fontSize: '11px' }}>
                              ⚠️ ΕΚΚΡΕΜΟΥΝ: {pendingOt} ώρες υπερωρίας
                            </p>
                          )}
                        </div>

                        <div style={daysOffStatsWrap}>
                          <p style={{ margin: 0, fontWeight: '800', color: 'var(--muted)', fontSize: '11px' }}>
                            Ρεπό μήνα: {daysOffLabel || '—'}
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Σύνολο ρεπό: {actualDaysOff} / {includedDaysOff}
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Extra ρεπό: {extraDaysOff}
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Προκαταβολές: {totalAdvances.toFixed(2)}€
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Εκκρεμείς υπερωρίες: {pendingOtHours.toFixed(2)} ώρες / {pendingOtAmount.toFixed(2)}€
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Αφαίρεση extra ρεπό: {daysOffDeduction.toFixed(2)}€
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                            Ωριαίο κόστος: {hourlyRate.toFixed(2)}€
                          </p>
                          {isMonthlyEmployee && (
                            <p style={{ margin: '5px 0 0 0', fontWeight: 900, color: 'var(--text)', fontSize: '11px' }}>
                              Υπόλοιπο πληρωμής: {remainingPay.toFixed(2)}€
                            </p>
                          )}

                          <div style={daysOffTotalCard}>
                            <p style={daysOffTotalCardLabel}>ΣΥΝΟΛΟ ΡΕΠΟ</p>
                            <p style={daysOffTotalCardValue}>{yearDaysOffCount}</p>
                          </div>

                          {dayOffRowsThisMonth.length > 0 && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {dayOffRowsThisMonth.map((row) => (
                                <div
                                  key={row.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    backgroundColor: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    padding: '6px 8px',
                                  }}
                                >
                                  <span style={{ fontWeight: 800, color: 'var(--muted)', fontSize: '11px' }}>
                                    {formatShortDayMonth(getDayOffDateValue(row))}
                                  </span>
                                  {isAdmin && (
                                    <button style={miniIconBtnDanger} title="Διαγραφή ρεπό" onClick={() => handleDeleteDayOff(row.id)}>
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {pendingOtItems.length > 0 && (
                          <div style={pendingOtListWrap}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: 900, fontSize: '10px', color: 'var(--muted)' }}>ΕΚΚΡΕΜΕΙΣ ΥΠΕΡΩΡΙΕΣ</p>
                            {pendingOtItems.map((ot) => (
                              <div key={ot.id} style={pendingOtRow}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '11px', color: 'var(--muted)' }}>{Number(ot.hours).toFixed(2)} ώρες</span>
                                  <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>
                                    {formatDateEl(ot.date)}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isAdmin && (
                                    <button style={miniIconBtnDanger} title="Διαγραφή υπερωρίας" onClick={() => deleteOvertime(ot.id)}>
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={filterContainer}>
                          <label style={{ ...labelStyle, margin: 0, flex: 1, alignSelf: 'center' }}>ΕΤΗΣΙΑ ΑΝΑΛΥΣΗ</label>
                          <select value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value))} style={filterSelect}>
                            {availableYears.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={statsGrid}>
                          <div style={statBox}>
                            <p style={statLabel}>ΒΑΣΙΚΟΣ ({viewYear})</p>
                            <p style={statValue}>{yearlyStats.base.toFixed(2)}€</p>
                          </div>
                          <div style={statBox}>
                            <p style={statLabel}>BONUS ({viewYear})</p>
                            <p style={statValue}>{yearlyStats.bonus.toFixed(2)}€</p>
                          </div>
                          <div style={statBox}>
                            <p style={statLabel}>ΥΠΕΡΩΡΙΕΣ ({viewYear})</p>
                            <p style={statValue}>{yearlyStats.overtime.toFixed(2)}€</p>
                          </div>
                          <div style={statBox}>
                            <p style={statLabel}>TIPS ({viewYear})</p>
                            <p style={statValue}>{yearlyStats.tips.toFixed(2)}€</p>
                          </div>

                          <div style={{ ...statBox, backgroundColor: colors.primaryDark }}>
                            <p style={{ ...statLabel, color: '#94a3b8' }}>ΣΥΝΟΛΟ ΕΤΟΥΣ</p>
                            <p style={{ ...statValue, color: colors.accentGreen }}>{yearlyStats.total.toFixed(2)}€</p>
                          </div>
                        </div>

                        <p style={historyTitle}>ΙΣΤΟΡΙΚΟ ΠΛΗΡΩΜΩΝ {viewYear}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                          {transactions
                            .filter((t) => {
                              if (String(t.employee_id || '') !== emp.id && String(t.fixed_asset_id || '') !== emp.id) return false
                              const d = parseTxDate(t)
                              if (!d) return false
                              return getBusinessYear(d) === viewYear
                            })
                            .map((t) => {
                              const note = String(t.notes || '')
                              const txType = String(t.type || '')
                              const isTip = /tips/i.test(note) || txType === 'tip_entry'
                              const isAdvance = txType === 'salary_advance'
                              let noteLabel = 'Πληρωμή'
                              if (isAdvance) noteLabel = 'ΠΡΟΚΑΤΑΒΟΛΗ'
                              else if (isTip) noteLabel = note.split('[')[0]?.trim() || 'Tips'
                              else noteLabel = note.split('[')[1]?.replace(']', '') || 'Πληρωμή'

                              const d = parseTxDate(t)
                              const dateLabel = d ? formatBusinessDayDate(d) : formatDateEl(t.date)

                              const displayAmount = Math.abs(Number(t.amount) || 0)

                              return (
                                <div key={t.id} style={historyItemExtended}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: colors.secondaryText, fontWeight: '700', fontSize: '11px' }}>{dateLabel}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span>{t.method === 'Τράπεζα' ? '🏦' : '💵'}</span>
                                      <span style={{ fontWeight: '800', color: colors.primaryDark }}>{displayAmount.toFixed(2)}€</span>
                                      {isAdmin && (
                                        <button onClick={() => deleteTransaction(t.id)} style={transDeleteBtn}>
                                          🗑️
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <p
                                    style={{
                                      margin: '4px 0 0',
                                      fontSize: '10px',
                                      color: isTip ? '#b45309' : isAdvance ? '#f59e0b' : colors.secondaryText,
                                      fontStyle: 'italic',
                                      fontWeight: isTip ? 900 : isAdvance ? 800 : 600,
                                    }}
                                  >
                                    {noteLabel}
                                  </p>
                                </div>
                              )
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                const nextPayBasis: PayBasis = (emp.pay_basis as PayBasis) || 'monthly'
                                const monthlySalaryValue =
                                  nextPayBasis === 'monthly' ? (emp.monthly_salary != null ? String(emp.monthly_salary) : '') : ''
                                const dailyRateValue =
                                  nextPayBasis === 'daily' ? (emp.daily_rate != null ? String(emp.daily_rate) : '') : ''

                                setPayBasis(nextPayBasis)
                                setFormData({
                                  full_name: emp.name || '',
                                  position: emp.position || '',
                                  amka: emp.amka || '',
                                  iban: emp.iban || '',
                                  bank_name: emp.bank_name || 'Εθνική Τράπεζα',
                                  monthly_salary: monthlySalaryValue,
                                  daily_rate: dailyRateValue,
                                  monthly_days: emp.monthly_days != null ? String(emp.monthly_days) : '26',
                                  start_date: emp.start_date || new Date().toISOString().split('T')[0],
                                })
                                setEditingId(emp.id)
                                setIsAdding(true)
                                setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                              }}
                              style={editBtn}
                            >
                              ΕΠΕΞΕΡΓΑΣΙΑ ✎
                            </button>
                          )}

                          {isAdmin && (
                            <button onClick={() => deleteEmployee(emp.id, emp.name)} style={deleteBtn}>
                              ΔΙΑΓΡΑΦΗ 🗑️
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => toggleActive(emp.id, emp.is_active)}
                              style={emp.is_active === false ? activateBtn : deactivateBtn}
                              title={emp.is_active === false ? 'Ενεργοποίηση υπαλλήλου' : 'Απενεργοποίηση υπαλλήλου'}
                            >
                              {emp.is_active === false ? 'ΕΝΕΡΓΟΠΟΙΗΣΗ ✅' : 'ΑΠΕΝΕΡΓΟΠΙΗΣΗ 🚫'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {loading && (
              <p style={{ marginTop: '18px', fontSize: '12px', color: colors.secondaryText, fontWeight: 800, textAlign: 'center' }}>
                Φόρτωση...
              </p>
            )}
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

// --- STYLES ---
const iphoneWrapper: any = {
  background: 'var(--bg-grad)',
  minHeight: '100vh',
  padding: '20px',
  overflowY: 'auto',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

const logoBoxStyle: any = {
  width: '42px',
  height: '42px',
  backgroundColor: '#dbeafe',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
}

const backBtnStyle: any = {
  textDecoration: 'none',
  color: 'var(--muted)',
  fontSize: '18px',
  fontWeight: 'bold',
  width: '38px',
  height: '38px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
}

const headerFiltersRow: any = {
  display: 'flex',
  gap: '8px',
  marginBottom: '14px',
  flexWrap: 'wrap',
}

const headerFilterChip: any = {
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--muted)',
  padding: '7px 10px',
  borderRadius: '12px',
  fontWeight: 800,
  fontSize: '10px',
}

const headerFilterChipActive: any = {
  ...headerFilterChip,
  backgroundColor: colors.primaryDark,
  color: 'white',
  border: `1px solid ${colors.primaryDark}`,
}

const kpiGridWrap: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '10px',
  marginBottom: '14px',
}

const kpiCard: any = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '12px',
  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
}

const kpiCardLabel: any = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: '9px',
  fontWeight: 900,
}

const kpiCardValue: any = {
  margin: '6px 0 0 0',
  color: 'var(--text)',
  fontSize: '18px',
  fontWeight: 900,
}

const payBtnStyle: any = {
  backgroundColor: colors.accentBlue,
  color: 'white',
  padding: '8px 14px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '800',
  textDecoration: 'none',
  boxShadow: '0 4px 8px rgba(37, 99, 235, 0.2)',
}

const advanceBtnStyle: any = {
  backgroundColor: '#f59e0b',
  color: 'white',
  padding: '8px 14px',
  borderRadius: '10px',
  fontSize: '10px',
  fontWeight: '800',
  textDecoration: 'none',
  boxShadow: '0 4px 8px rgba(245, 158, 11, 0.18)',
}

const addBtn: any = {
  width: '100%',
  padding: '16px',
  backgroundColor: colors.primaryDark,
  color: 'white',
  border: 'none',
  borderRadius: '16px',
  fontWeight: '700',
  fontSize: '14px',
  marginBottom: '20px',
}

const cancelBtn: any = { ...addBtn, backgroundColor: colors.white, color: colors.secondaryText, border: `1px solid ${colors.border}` }

const formCard: any = {
  background: 'var(--surface)',
  padding: '24px',
  borderRadius: '24px',
  border: '1.5px solid var(--border)',
  marginBottom: '25px',
  boxShadow: 'var(--shadow)',
}

const labelStyle: any = {
  fontSize: '10px',
  fontWeight: '800',
  color: colors.secondaryText,
  display: 'block',
  marginBottom: '6px',
  textTransform: 'uppercase',
}

const inputStyle: any = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: `1px solid ${colors.border}`,
  fontSize: '15px',
  fontWeight: '700',
  backgroundColor: colors.bgLight,
  boxSizing: 'border-box',
  outline: 'none',
}

const amountInputWrap: any = {
  position: 'relative',
}

const amountInputStyle: any = {
  ...inputStyle,
  paddingRight: '38px',
}

const amountInputFocusedStyle: any = {
  border: `2px solid ${colors.primaryDark}`,
  fontSize: '18px',
}

const euroAdornmentStyle: any = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: '16px',
  fontWeight: 900,
  color: colors.secondaryText,
  pointerEvents: 'none',
}

const daysSelectorRow: any = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
}

const dayToggleBase: any = {
  flex: '1 1 120px',
  minHeight: '46px',
  borderRadius: '12px',
  fontWeight: 800,
  fontSize: '11px',
  cursor: 'pointer',
  padding: '8px 10px',
}

const dayToggleActive: any = {
  ...dayToggleBase,
  backgroundColor: colors.primaryDark,
  color: 'white',
  border: `1px solid ${colors.primaryDark}`,
}

const dayToggleInactive: any = {
  ...dayToggleBase,
  backgroundColor: colors.bgLight,
  color: colors.secondaryText,
  border: `1px solid ${colors.border}`,
}

const saveBtnStyle: any = {
  width: '100%',
  color: 'white',
  padding: '16px',
  borderRadius: '14px',
  border: 'none',
  fontWeight: '800',
  fontSize: '15px',
  marginTop: '20px',
}

const employeeCard: any = {
  background: 'var(--surface)',
  borderRadius: '22px',
  border: '1px solid var(--border)',
  overflow: 'hidden',
  marginBottom: '12px',
  boxShadow: 'var(--shadow)',
}

const badgeStyle: any = { fontSize: '9px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }

const employeeCostLine: any = {
  margin: '5px 0 0 0',
  color: 'var(--muted)',
  fontSize: '10px',
  fontWeight: 800,
}

const employeeMetaRow: any = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const employeeMetaPill: any = {
  fontSize: '10px',
  fontWeight: 800,
  color: 'var(--muted)',
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '5px 8px',
}

const employeeQuickActionsRow: any = {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
}

const employeePaymentsRow: any = {
  display: 'flex',
  gap: '8px',
  alignItems: 'stretch',
}

const employeeMiniSummaryRow: any = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const filterContainer: any = {
  display: 'flex',
  gap: '8px',
  marginBottom: '15px',
  padding: '8px',
  background: 'var(--surface)',
  borderRadius: '12px',
  boxShadow: 'var(--shadow)',
}

const filterSelect: any = {
  padding: '6px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontSize: '12px',
  fontWeight: '800',
}

const statsGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '25px' }
const statBox: any = { padding: '15px', background: 'var(--surface)', borderRadius: '16px', textAlign: 'center', boxShadow: 'var(--shadow)' }
const statLabel: any = { margin: 0, fontSize: '8px', fontWeight: '800', color: 'var(--muted)' }
const statValue: any = { margin: '4px 0 0', fontSize: '16px', fontWeight: '900', color: 'var(--text)' }

const historyTitle: any = { fontSize: '9px', fontWeight: '800', color: 'var(--muted)', marginBottom: '12px', textTransform: 'uppercase' }
const historyItemExtended: any = {
  padding: '12px',
  borderRadius: '14px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  marginBottom: '8px',
}
const transDeleteBtn: any = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.5 }

const editBtn: any = {
  flex: 3,
  background: '#fffbeb',
  border: `1px solid #fef3c7`,
  padding: '12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: '700',
  color: '#92400e',
}
const deleteBtn: any = {
  flex: 2,
  background: '#fef2f2',
  border: `1px solid #fee2e2`,
  padding: '12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: '700',
  color: colors.accentRed,
}

const deactivateBtn: any = {
  flex: 3,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  padding: '12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: '800',
  color: colors.accentRed,
}
const activateBtn: any = {
  flex: 3,
  background: '#ecfdf5',
  border: '1px solid #bbf7d0',
  padding: '12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: '800',
  color: colors.accentGreen,
}

const activeToggle: any = {
  flex: 1,
  padding: '12px',
  backgroundColor: colors.primaryDark,
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
}
const inactiveToggle: any = {
  flex: 1,
  padding: '12px',
  backgroundColor: '#f1f5f9',
  color: colors.secondaryText,
  border: 'none',
  borderRadius: '10px',
  fontWeight: 'bold',
  fontSize: '11px',
  cursor: 'pointer',
}

const quickOtBtn: any = {
  backgroundColor: '#fffbeb',
  color: '#92400e',
  border: '1px solid #fcd34d',
  padding: '10px 12px',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
}
const quickTipBtn: any = {
  backgroundColor: '#ecfeff',
  color: '#0e7490',
  border: '1px solid #67e8f9',
  padding: '10px 12px',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
}
const quickDayOffBtn: any = {
  backgroundColor: '#eef2ff',
  color: '#3730a3',
  border: '1px solid #c7d2fe',
  padding: '10px 12px',
  borderRadius: '10px',
  fontSize: '11px',
  fontWeight: '800',
  cursor: 'pointer',
}

const modalOverlay: any = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px',
}
const modalCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '25px', width: '100%', maxWidth: '350px', textAlign: 'center' }
const saveBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: colors.primaryDark, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700' }
const cancelBtnSmall: any = { flex: 1, padding: '14px', backgroundColor: 'white', color: colors.secondaryText, border: `1px solid ${colors.border}`, borderRadius: '12px', fontWeight: '700' }
const payNowBtnSmall: any = {
  width: '100%',
  padding: '14px',
  marginTop: '10px',
  backgroundColor: colors.accentGreen,
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontWeight: '800',
  cursor: 'pointer',
}

const iconToggleBtn: any = {
  width: '56px',
  borderRadius: '16px',
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
}

const tipsListWrap: any = { backgroundColor: colors.white, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '14px', marginBottom: '18px' }
const tipsListItem: any = { padding: '10px', borderRadius: '12px', border: `1px solid ${colors.border}`, backgroundColor: colors.bgLight }

const miniIconBtn: any = {
  width: '34px',
  height: '34px',
  borderRadius: '10px',
  border: `1px solid ${colors.border}`,
  backgroundColor: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.primaryDark,
}
const miniIconBtnDanger: any = { ...miniIconBtn, border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: colors.accentRed }
const daysOffStatsWrap: any = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '12px',
  marginBottom: '16px',
}
const daysOffTotalCard: any = {
  marginTop: '10px',
  padding: '10px',
  borderRadius: '12px',
  border: '1px solid #dbeafe',
  backgroundColor: '#eff6ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}
const daysOffTotalCardLabel: any = {
  margin: 0,
  fontWeight: 900,
  fontSize: '10px',
  color: '#1e3a8a',
}
const daysOffTotalCardValue: any = {
  margin: 0,
  fontWeight: 900,
  fontSize: '16px',
  color: '#1d4ed8',
}
const pendingOtListWrap: any = { backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px', padding: '12px', marginBottom: '16px' }
const pendingOtRow: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px',
  borderRadius: '10px',
  border: '1px solid #fdba74',
  backgroundColor: '#fffbeb',
  marginBottom: '8px',
}

// ✅ HERO Payroll card styles (Dashboard-like)
const payrollHeroCard: any = {
  backgroundColor: colors.primaryDark,
  padding: '18px',
  borderRadius: '22px',
  color: 'white',
  boxShadow: '0 16px 35px rgba(15, 23, 42, 0.18)',
  marginBottom: '14px',
}
const payrollHeroTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }
const payrollHeroPill: any = {
  fontSize: '10px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  opacity: 0.9,
  padding: '8px 10px',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
}
const payrollHeroAmount: any = { marginTop: '12px', fontSize: '28px', fontWeight: 900 }
const payrollHeroHint: any = { marginTop: '4px', fontSize: '11px', fontWeight: 800, color: '#cbd5e1', opacity: 0.9 }
const payrollHeroDivider: any = { height: '1px', backgroundColor: 'rgba(255,255,255,0.14)', marginTop: '14px', marginBottom: '12px' }
const payrollHeroTipsRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }
const payrollHeroTipsLabel: any = { fontSize: '10px', fontWeight: 900, letterSpacing: '0.08em', opacity: 0.95 }
const payrollHeroTipsValue: any = { fontSize: '14px', fontWeight: 900, color: '#fde68a' }
const payrollHeroTipsBtn: any = {
  marginTop: '12px',
  width: '100%',
  padding: '12px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.16)',
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'white',
  fontWeight: 900,
  fontSize: '12px',
  cursor: 'pointer',
}

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <div style={iphoneWrapper}>
          <p style={{ fontWeight: 800, color: colors.secondaryText, textAlign: 'center', marginTop: '30px' }}>Φόρτωση...</p>
        </div>
      }
    >
      <EmployeesContent />
    </Suspense>
  )
}