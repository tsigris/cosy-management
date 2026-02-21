'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInCalendarDays,
  subDays,
  addDays,
} from 'date-fns'
import { toast, Toaster } from 'sonner'
import {
  Coins,
  Users,
  ShoppingBag,
  Lightbulb,
  Wrench,
  Printer,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1',
  purple: '#7c3aed',
}

// --- CATEGORY META ---
const CATEGORY_META: Array<{
  key: 'Εμπορεύματα' | 'Staff' | 'Utilities' | 'Maintenance' | 'Other'
  label: string
  color: string
  Icon: any
}> = [
  { key: 'Εμπορεύματα', label: 'Εμπορεύματα', color: '#6366f1', Icon: ShoppingBag },
  { key: 'Staff', label: 'Προσωπικό', color: '#0ea5e9', Icon: Users },
  { key: 'Utilities', label: 'Λογαριασμοί', color: '#f59e0b', Icon: Lightbulb },
  { key: 'Maintenance', label: 'Συντήρηση', color: '#10b981', Icon: Wrench },
  { key: 'Other', label: 'Λοιπά', color: '#64748b', Icon: Coins },
]

type FilterA =
  | 'Όλες'
  | 'Έσοδα'
  | 'Εμπορεύματα'
  | 'Προσωπικό'
  | 'Λογαριασμοί'
  | 'Συντήρηση'
  | 'Λοιπά'

type DetailMode = 'none' | 'staff' | 'supplier' | 'revenue_source' | 'maintenance'
type PrintMode = 'summary' | 'full'
type UiMode = 'simple' | 'pro'

type CalcBalances = {
  cash_balance: number
  bank_balance: number
  total_balance: number
  credit_outstanding: number
  credit_incoming: number
  as_of_date: string
}

type Kpis = {
  income: number
  expenses: number
  tips: number
  netProfit: number
  savingsDeposits: number
  savingsWithdrawals: number
}

function safePctChange(curr: number, prev: number) {
  if (!isFinite(curr) || !isFinite(prev)) return null
  if (prev === 0) return curr === 0 ? 0 : null
  return ((curr - prev) / Math.abs(prev)) * 100
}

function fmtPct(p: number | null) {
  if (p === null) return '—'
  return `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`
}

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [uiMode, setUiMode] = useState<UiMode>('simple')
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  const [transactions, setTransactions] = useState<any[]>([])
  const [prevTransactions, setPrevTransactions] = useState<any[]>([])
  const [monthTransactions, setMonthTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  const [drawer, setDrawer] = useState<any>(null)
  const [calcBalances, setCalcBalances] = useState<CalcBalances | null>(null)

  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [expectedOutflows30d, setExpectedOutflows30d] = useState<number>(0)

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])
  const rangeText = useMemo(() => `${startDate} → ${endDate}`, [startDate, endDate])

  const norm = useCallback((v: any) => String(v ?? '').trim().toLowerCase(), [])

  // ✅ PRINT CSS
  useEffect(() => {
    const STYLE_ID = 'analysis-print-css'
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
  a { text-decoration: none !important; color: #000 !important; }
  [data-print-root="true"] { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
  [data-print-root="true"] * { box-shadow: none !important; }
  [data-print-section="true"]{ break-inside: avoid; page-break-inside: avoid; }
  .print-header { display: block !important; margin: 0 0 10mm 0 !important; padding-bottom: 6mm !important; border-bottom: 1px solid #e5e7eb !important; }
  .print-title { font-size: 18px !important; font-weight: 900 !important; margin: 0 !important; color: #000 !important; }
  .print-sub { margin: 4px 0 0 0 !important; font-size: 12px !important; font-weight: 700 !important; color: #374151 !important; }
  .print-meta { margin: 6px 0 0 0 !important; font-size: 12px !important; font-weight: 700 !important; color: #374151 !important; }
  [data-print-root="true"] [data-print-row="true"]{ border: 1px solid #e5e7eb !important; background: #fff !important; }
}
`
    document.head.appendChild(style)
  }, [])

  const handlePrint = useCallback(() => {
    try {
      window.print()
    } catch {
      toast.error('Δεν ήταν δυνατή η εκτύπωση')
    }
  }, [])

  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  // ✅ method ONLY (NO payment_method)
  const getMethod = useCallback((t: any) => String(t?.method ?? '').trim(), [])

  const isCreditTx = useCallback(
    (t: any) => {
      if (t?.is_credit === true) return true
      return norm(getMethod(t)) === 'πίστωση'
    },
    [getMethod, norm]
  )

  const isCashMethod = useCallback(
    (method: string) => ['μετρητά', 'μετρητά (z)', 'χωρίς απόδειξη'].includes(norm(method)),
    [norm]
  )

  const isBankMethod = useCallback(
    (method: string) => ['κάρτα', 'τράπεζα'].includes(norm(method)),
    [norm]
  )

  // ✅ signedAmount: savings_deposit μειώνει cash, savings_withdrawal αυξάνει cash
  const signedAmount = useCallback((t: any) => {
    const raw = Number(t.amount) || 0
    if (raw < 0) return raw
    if (t.type === 'expense' || t.type === 'debt_payment' || t.type === 'savings_deposit') return -Math.abs(raw)
    return Math.abs(raw)
  }, [])

  const getPrevRange = useCallback(() => {
    const s = parseISO(startDate)
    const e = parseISO(endDate)
    const days = Math.max(0, differenceInCalendarDays(e, s))
    const prevEnd = subDays(s, 1)
    const prevStart = subDays(prevEnd, days)
    return { prevStart: format(prevStart, 'yyyy-MM-dd'), prevEnd: format(prevEnd, 'yyyy-MM-dd') }
  }, [startDate, endDate])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      if (!storeId || storeId === 'null') return setLoading(false)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { prevStart, prevEnd } = getPrevRange()

      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const forecastTo = format(addDays(parseISO(endDate), 30), 'yyyy-MM-dd')

      const [
        txRes,
        prevRes,
        monthRes,
        staffRes,
        suppliersRes,
        revenueRes,
        maintRes,
        drawerRes,
        outflowsRes,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
          .eq('store_id', storeId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),

        supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
          .eq('store_id', storeId)
          .gte('date', prevStart)
          .lte('date', prevEnd)
          .order('date', { ascending: false }),

        supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
          .eq('store_id', storeId)
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .order('date', { ascending: false }),

        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', storeId)
          .eq('sub_category', 'staff')
          .order('name', { ascending: true }),

        supabase
          .from('suppliers')
          .select('id, name')
          .eq('store_id', storeId)
          .order('name', { ascending: true }),

        supabase
          .from('revenue_sources')
          .select('id, name')
          .eq('store_id', storeId)
          .order('name', { ascending: true }),

        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', storeId)
          .in('sub_category', ['worker', 'Maintenance', 'maintenance'])
          .order('name', { ascending: true }),

        supabase
          .from('v_cash_drawer_today')
          .select('*')
          .eq('store_id', storeId)
          .lte('date', endDate)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('transactions')
          .select('amount, type, is_credit, method, category, date') // ✅ NO payment_method
          .eq('store_id', storeId)
          .gt('date', endDate)
          .lte('date', forecastTo)
          .in('type', ['expense', 'debt_payment'])
          .order('date', { ascending: true }),
      ])

      const tx = txRes.data || []
      const prevTx = prevRes.data || []
      const monthTx = monthRes.data || []

      setTransactions(tx)
      setPrevTransactions(prevTx)
      setMonthTransactions(monthTx)

      setStaff(staffRes.data || [])
      setSuppliers(suppliersRes.data || [])
      setRevenueSources(revenueRes.data || [])
      setMaintenanceWorkers((maintRes.data || []).filter((x: any) => String(x?.name || '').trim().length > 0))

      setDrawer(drawerRes.data || null)

      const out = (outflowsRes.data || [])
        .filter((t: any) => !isCreditTx(t))
        .reduce((a: number, t: any) => a + Math.abs(Number(t.amount) || 0), 0)

      setExpectedOutflows30d(out)
    } catch {
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId, startDate, endDate, getPrevRange, isCreditTx])

  useEffect(() => { loadData() }, [loadData])

  // modes for detail selector
  useEffect(() => {
    let nextMode: DetailMode = 'none'
    if (filterA === 'Προσωπικό') nextMode = 'staff'
    if (filterA === 'Εμπορεύματα') nextMode = 'supplier'
    if (filterA === 'Έσοδα') nextMode = 'revenue_source'
    if (filterA === 'Συντήρηση') nextMode = 'maintenance'
    setDetailMode(nextMode)
    setDetailId('all')
  }, [filterA])

  const normalizeExpenseCategory = useCallback((t: any) => {
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'
    const sub = String(t.fixed_assets?.sub_category || '').trim().toLowerCase()
    if (sub === 'staff') return 'Staff'
    if (sub === 'utility' || sub === 'utilities') return 'Utilities'
    if (sub === 'worker' || sub === 'maintenance') return 'Maintenance'
    return 'Other'
  }, [])

  const getPartyName = useCallback(
    (t: any) => {
      // savings labels
      if (t.type === 'savings_deposit') return 'ΚΑΤΑΘΕΣΗ ΣΕ ΚΟΥΜΠΑΡΑ'
      if (t.type === 'savings_withdrawal') return 'ΑΝΑΛΗΨΗ ΑΠΟ ΚΟΥΜΠΑΡΑ'

      if (t.revenue_source_id || t.revenue_sources?.name) {
        return (
          t.revenue_sources?.name ||
          revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))?.name ||
          'Πηγή Εσόδων'
        )
      }

      const sub = String(t.fixed_assets?.sub_category || '').toLowerCase()
      if (sub === 'staff') {
        return (
          t.fixed_assets?.name ||
          staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name ||
          'Άγνωστος Υπάλληλος'
        )
      }

      if (t.suppliers?.name || t.supplier_id) {
        return (
          t.suppliers?.name ||
          suppliers.find((s) => String(s.id) === String(t.supplier_id))?.name ||
          'Προμηθευτής'
        )
      }

      if (t.fixed_asset_id) {
        return (
          t.fixed_assets?.name ||
          maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))?.name ||
          '-'
        )
      }

      if (t.type === 'tip_entry') {
        return staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Tips'
      }

      return t.notes || t.category || '-'
    },
    [staff, suppliers, revenueSources, maintenanceWorkers]
  )

  const filterAToKey = useCallback((fa: FilterA) => {
    if (fa === 'Εμπορεύματα') return 'Εμπορεύματα'
    if (fa === 'Προσωπικό') return 'Staff'
    if (fa === 'Λογαριασμοί') return 'Utilities'
    if (fa === 'Συντήρηση') return 'Maintenance'
    if (fa === 'Λοιπά') return 'Other'
    return null
  }, [])

  const periodTx = useMemo(
    () => transactions.filter((t) => String(t.date) >= startDate && String(t.date) <= endDate),
    [transactions, startDate, endDate]
  )

  const prevPeriodTx = useMemo(() => {
    const { prevStart, prevEnd } = getPrevRange()
    return prevTransactions.filter((t) => String(t.date) >= prevStart && String(t.date) <= prevEnd)
  }, [prevTransactions, getPrevRange])

  const filteredTx = useMemo(() => {
    const key = filterAToKey(filterA)
    return periodTx.filter((t) => {
      if (filterA === 'Έσοδα' && !['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type)) return false
      if (filterA !== 'Όλες' && filterA !== 'Έσοδα' && normalizeExpenseCategory(t) !== key) return false

      if (detailMode === 'staff' && detailId !== 'all' && String(t.fixed_asset_id) !== String(detailId)) return false
      if (detailMode === 'supplier' && detailId !== 'all' && String(t.supplier_id) !== String(detailId)) return false
      if (detailMode === 'revenue_source' && detailId !== 'all' && String(t.revenue_source_id) !== String(detailId)) return false
      if (detailMode === 'maintenance' && detailId !== 'all' && String(t.fixed_asset_id) !== String(detailId)) return false
      return true
    })
  }, [periodTx, filterA, detailMode, detailId, filterAToKey, normalizeExpenseCategory])

  const computeKpis = useCallback(
    (rows: any[]): Kpis => {
      const rowsNoCredit = rows.filter((t) => !isCreditTx(t))

      // ✅ income includes savings_withdrawal (ρευστό που μπήκε)
      const income = rowsNoCredit
        .filter((t) => ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type))
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

      const tips = rowsNoCredit
        .filter((t) => t.type === 'tip_entry')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const expenses = rowsNoCredit
        .filter((t) => ['expense', 'debt_payment'].includes(t.type))
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const savingsDeposits = rowsNoCredit
        .filter((t) => t.type === 'savings_deposit')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const savingsWithdrawals = rowsNoCredit
        .filter((t) => t.type === 'savings_withdrawal')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      return { income, expenses, tips, netProfit: income - expenses, savingsDeposits, savingsWithdrawals }
    },
    [isCreditTx]
  )

  const kpis = useMemo(() => computeKpis(filteredTx), [filteredTx, computeKpis])
  const kpisPrev = useMemo(() => computeKpis(prevPeriodTx), [prevPeriodTx, computeKpis])

  const variance = useMemo(
    () => ({
      income: safePctChange(kpis.income, kpisPrev.income),
      expenses: safePctChange(kpis.expenses, kpisPrev.expenses),
      tips: safePctChange(kpis.tips, kpisPrev.tips),
      netProfit: safePctChange(kpis.netProfit, kpisPrev.netProfit),
    }),
    [kpis, kpisPrev]
  )

  const calcBalancesFromRows = useCallback(
    (rows: any[]) => {
      let cash = 0
      let bank = 0
      let creditOutstanding = 0
      let creditIncoming = 0

      for (const t of rows) {
        const method = getMethod(t)
        const credit = isCreditTx(t)
        const amt = signedAmount(t)

        if (credit) {
          if (t.type === 'expense' || t.type === 'debt_payment') creditOutstanding += Math.abs(amt)
          if (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') creditIncoming += Math.abs(amt)
          continue
        }

        if (isCashMethod(method)) cash += amt
        else if (isBankMethod(method)) bank += amt
      }

      return {
        cash_balance: cash,
        bank_balance: bank,
        total_balance: cash + bank,
        credit_outstanding: creditOutstanding,
        credit_incoming: creditIncoming,
      }
    },
    [getMethod, isCreditTx, signedAmount, isCashMethod, isBankMethod]
  )

  useEffect(() => {
    setCalcBalances({ ...calcBalancesFromRows(periodTx), as_of_date: endDate })
  }, [periodTx, endDate, calcBalancesFromRows])

  // ✅ Z breakdown (only when day report)
  const zBreakdown = useMemo(() => {
    if (!isZReport) return { zCash: 0, zPos: 0, blackCash: 0, totalTurnover: 0, blackPct: 0 }

    const rows = periodTx
      .filter((t) => t.type === 'income')
      .map((t) => ({
        method: getMethod(t),
        notes: String(t.notes || '').trim(),
        category: String(t.category || '').trim(),
        amount: Number(t.amount) || 0,
      }))
      .filter((r) => r.category === 'Εσοδα Ζ')

    const zCash = rows.filter((r) => r.method === 'Μετρητά (Z)').reduce((a, r) => a + r.amount, 0)
    const zPos = rows.filter((r) => r.method === 'Κάρτα').reduce((a, r) => a + r.amount, 0)
    const blackCash = rows
      .filter((r) => (r.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || r.method === 'Μετρητά' || r.method === 'Χωρίς Απόδειξη') && r.method !== 'Μετρητά (Z)')
      .reduce((a, r) => a + r.amount, 0)

    const totalTurnover = zCash + zPos + blackCash
    return { zCash, zPos, blackCash, totalTurnover, blackPct: totalTurnover > 0 ? (blackCash / totalTurnover) * 100 : 0 }
  }, [isZReport, periodTx, getMethod])

  // ✅ cash expenses today uses isCashMethod
  const cashExpensesToday = useMemo(() => {
    if (!isZReport) return 0
    return periodTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => isCashMethod(getMethod(t)))
      .filter((t) => !isCreditTx(t))
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
  }, [isZReport, periodTx, getMethod, isCreditTx, isCashMethod])

  const bigKpiValue = useMemo(() => {
    // Z report: business cash (zCash + blackCash) - cash expenses
    if (isZReport) return zBreakdown.zCash + zBreakdown.blackCash - cashExpensesToday
    return kpis.netProfit
  }, [isZReport, zBreakdown, cashExpensesToday, kpis.netProfit])

  // ✅ drawer cash display: business - (vault deposits) + (vault withdrawals) [cash only]
  const totalCashDisplay = useMemo(() => {
    if (isZReport) {
      const cashVaultDeposits = periodTx
        .filter((t) => t.type === 'savings_deposit')
        .filter((t) => isCashMethod(getMethod(t)))
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const cashVaultWithdrawals = periodTx
        .filter((t) => t.type === 'savings_withdrawal')
        .filter((t) => isCashMethod(getMethod(t)))
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      return bigKpiValue - cashVaultDeposits + cashVaultWithdrawals
    }
    return Number(calcBalances?.cash_balance || 0)
  }, [isZReport, bigKpiValue, periodTx, getMethod, calcBalances, isCashMethod])

  const categoryBreakdown = useMemo(() => {
    const expenseTx = filteredTx
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment'))
      .filter((t) => !isCreditTx(t))

    const result: Record<string, number> = {}
    let total = 0
    for (const t of expenseTx) {
      const cat = normalizeExpenseCategory(t)
      const val = Math.abs(Number(t.amount) || 0)
      result[cat] = (result[cat] || 0) + val
      total += val
    }
    for (const c of CATEGORY_META) result[c.key] = result[c.key] || 0
    return { result, total }
  }, [filteredTx, normalizeExpenseCategory, isCreditTx])

  const staffDetailsThisMonth = useMemo(() => {
    const staffTxs = monthTransactions
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => !isCreditTx(t))
      .filter((t) => normalizeExpenseCategory(t) === 'Staff')

    const byStaff: Record<string, number> = {}
    for (const t of staffTxs) {
      const name =
        t.fixed_assets?.name ||
        staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name ||
        'Άγνωστος'
      byStaff[name] = (byStaff[name] || 0) + Math.abs(Number(t.amount) || 0)
    }

    return Object.entries(byStaff)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthTransactions, normalizeExpenseCategory, staff, isCreditTx])

  // ✅ Collapse Z rows into one per date
  const collapsedPeriodList = useMemo(() => {
    const sortedTx = [...filteredTx].sort((a, b) => String(b.date).localeCompare(String(a.date)))

    const zByDate: Record<string, any[]> = {}
    const others: any[] = []

    for (const t of sortedTx) {
      if (t.category === 'Εσοδα Ζ' && t.type === 'income') {
        const date = String(t.date || '')
        if (!zByDate[date]) zByDate[date] = []
        zByDate[date].push(t)
      } else {
        others.push(t)
      }
    }

    const collapsedZ = Object.entries(zByDate).map(([date, rows]) => {
      let amount = 0
      let zCash = 0
      let zPos = 0
      let withoutMarking = 0

      for (const row of rows) {
        const rowAmount = Number(row.amount) || 0
        amount += rowAmount

        const method = getMethod(row)
        const notes = String(row.notes || '').trim()

        if (method === 'Μετρητά (Z)') zCash += rowAmount
        if (method === 'Κάρτα') zPos += rowAmount
        if (method !== 'Μετρητά (Z)' && (notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || method === 'Μετρητά' || method === 'Χωρίς Απόδειξη')) {
          withoutMarking += rowAmount
        }
      }

      return {
        id: `z-${date}`,
        date,
        type: 'income',
        category: 'Εσοδα Ζ',
        amount,
        method: 'Z (Σύνολο)', // ✅ method, NOT payment_method
        notes: `Μετρητά (Z): ${zCash.toFixed(2)}€ • Κάρτα (POS): ${zPos.toFixed(2)}€ • Χωρίς Σήμανση: ${withoutMarking.toFixed(2)}€`,
        __collapsedZ: true,
      }
    })

    return [...others, ...collapsedZ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [filteredTx, getMethod])

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  const money = useCallback(
    (n: any) => `${Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`,
    []
  )

  // --- Simple UI blocks ---
  const SimpleHeader = (
    <div style={headerCard} className="no-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={headerIconBox}>📊</div>
        <div style={{ minWidth: 0 }}>
          <div style={headerTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
          <div style={headerSub}>Simple mode</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => setUiMode((m) => (m === 'simple' ? 'pro' : 'simple'))}
          style={headerCircleBtn}
          aria-label="toggle mode"
        >
          {uiMode === 'simple' ? <SlidersHorizontal size={18} /> : <Sparkles size={18} />}
        </button>

        <button type="button" onClick={handlePrint} style={headerCircleBtn} aria-label="print">
          <Printer size={18} />
        </button>

        <Link href={`/?store=${storeId}`} style={headerCircleBtn as any} aria-label="close">
          ✕
        </Link>
      </div>
    </div>
  )

  const SimpleKpiCard = (
    <div style={{ ...simpleBigCard, background: 'linear-gradient(180deg, #0b1220, #111827)' }}>
      <div style={simpleBigTitle}>ΚΑΘΑΡΟ ΚΕΡΔΟΣ ΠΕΡΙΟΔΟΥ</div>
      <div style={simpleBigValue}>{money(bigKpiValue)}</div>

      <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        <div style={simplePill}>
          <span style={simplePillLabel}>Έσοδα:</span>
          <span style={simplePillValue}>{money(kpis.income)}</span>
        </div>
        <div style={simplePill}>
          <span style={simplePillLabel}>Έξοδα:</span>
          <span style={simplePillValue}>{money(kpis.expenses)}</span>
        </div>
      </div>
    </div>
  )

  const SimpleBalances = (
    <div style={balancesGrid}>
      <div style={{ ...smallKpiCard, border: '1px solid rgba(124,58,237,0.45)', background: 'linear-gradient(180deg, #f5f3ff, #ffffff)' }}>
        <div style={{ ...smallKpiLabel, color: colors.purple }}>ΚΟΥΜΠΑΡΑΣ</div>
        <div style={{ ...smallKpiValue, color: colors.purple }}>{money(kpis.savingsDeposits - kpis.savingsWithdrawals)}</div>
        <div style={smallKpiHint}>(+): μπήκαν • (-): βγήκαν</div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>ΜΕΤΡΗΤΑ</div>
        <div style={smallKpiValue}>{money(totalCashDisplay)}</div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>ΤΡΑΠΕΖΑ</div>
        <div style={smallKpiValue}>{money(calcBalances?.bank_balance || 0)}</div>
      </div>

      <div style={{ ...smallKpiCard, background: 'linear-gradient(180deg, #0b1220, #111827)', color: '#fff', border: '1px solid rgba(15,23,42,0.2)' }}>
        <div style={{ ...smallKpiLabel, color: '#cbd5e1' }}>ΣΥΝΟΛΟ ΡΕΥΣΤΟ</div>
        <div style={{ ...smallKpiValue, color: '#fff' }}>{money((calcBalances?.total_balance || 0))}</div>
      </div>
    </div>
  )

  // ✅ Simple filter panel like your 2nd photo (ΑΠΟ/ΕΩΣ + ΦΙΛΤΡΟ)
  const SimpleFilterPanel = (
    <div style={simpleFiltersCard} className="no-print">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={simpleFilterLabel}>ΑΠΟ</div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={simpleDateInput} />
        </div>
        <div>
          <div style={simpleFilterLabel}>ΕΩΣ</div>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={simpleDateInput} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={simpleFilterLabel}>ΦΙΛΤΡΟ</div>
        <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={simpleSelect}>
          <option value="Όλες">Όλες</option>
          <option value="Έσοδα">Έσοδα</option>
          <option value="Εμπορεύματα">Εμπορεύματα</option>
          <option value="Προσωπικό">Προσωπικό</option>
          <option value="Λογαριασμοί">Λογαριασμοί</option>
          <option value="Συντήρηση">Συντήρηση</option>
          <option value="Λοιπά">Λοιπά</option>
        </select>
      </div>
    </div>
  )

  // --- Pro UI blocks ---
  const ProFilters = (
    <div style={filterCard} className="no-print">
      <div style={filterHeaderRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={filterIconBubble}>⛃</div>
          <div>
            <div style={filterTitle}>Φίλτρα (Pro)</div>
            <div style={filterSub}>Περίοδος, κατηγορία, drill-down</div>
          </div>
        </div>
      </div>

      <div style={filtersStack}>
        <div style={tile}>
          <div style={tileIcon}>📅</div>
          <div style={tileBody}>
            <div style={tileLabel}>ΑΠΟ</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={tileControl} />
          </div>
        </div>

        <div style={tile}>
          <div style={tileIcon}>📅</div>
          <div style={tileBody}>
            <div style={tileLabel}>ΕΩΣ</div>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={tileControl} />
          </div>
        </div>

        <div style={tile}>
          <div style={tileIcon}>⛃</div>
          <div style={tileBody}>
            <div style={tileLabel}>ΦΙΛΤΡΟ ΚΑΤΗΓΟΡΙΑΣ</div>
            <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={tileControl}>
              <option value="Όλες">Όλες</option>
              <option value="Έσοδα">Έσοδα</option>
              <option value="Εμπορεύματα">Εμπορεύματα</option>
              <option value="Προσωπικό">Προσωπικό</option>
              <option value="Λογαριασμοί">Λογαριασμοί</option>
              <option value="Συντήρηση">Συντήρηση</option>
              <option value="Λοιπά">Λοιπά</option>
            </select>
          </div>
        </div>

        {detailMode !== 'none' && (
          <div style={tile}>
            <div style={tileIcon}>≡</div>
            <div style={tileBody}>
              <div style={tileLabel}>ΛΕΠΤΟΜΕΡΕΙΑ (DRILL-DOWN)</div>
              <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={tileControl}>
                <option value="all">Όλοι</option>
                {detailOptions.map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div style={rangeHint}>Περίοδος: {rangeText}</div>
      </div>
    </div>
  )

  const ProKpis = (
    <div style={kpiGrid} data-print-section="true">
      <div style={{ ...kpiCard, borderColor: '#d1fae5', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
        <div style={kpiTopRow}>
          <div style={{ ...kpiLabel, color: colors.success }}>
            Έσοδα <span style={kpiDelta}>{fmtPct(variance.income)} vs prev</span>
          </div>
          <div style={{ ...kpiSign, color: colors.success }}>+</div>
        </div>
        <div style={{ ...kpiValue, color: colors.success }}>+ {Number(kpis.income || 0).toLocaleString('el-GR')}€</div>
        <div style={kpiTrack}><div style={{ ...kpiFill, width: '70%', background: colors.success }} /></div>
      </div>

      <div style={{ ...kpiCard, borderColor: '#ffe4e6', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
        <div style={kpiTopRow}>
          <div style={{ ...kpiLabel, color: colors.danger }}>
            Έξοδα <span style={kpiDelta}>{fmtPct(variance.expenses)} vs prev</span>
          </div>
          <div style={{ ...kpiSign, color: colors.danger }}>-</div>
        </div>
        <div style={{ ...kpiValue, color: colors.danger }}>- {Number(kpis.expenses || 0).toLocaleString('el-GR')}€</div>
        <div style={kpiTrack}><div style={{ ...kpiFill, width: '70%', background: colors.danger }} /></div>
      </div>

      <div style={{ ...kpiCard, borderColor: '#fde68a', background: 'linear-gradient(180deg, #fffbeb, #ffffff)' }}>
        <div style={kpiTopRow}>
          <div style={{ ...kpiLabel, color: '#b45309' }}>
            Tips <span style={kpiDelta}>{fmtPct(variance.tips)} vs prev</span>
          </div>
          <div style={{ ...kpiSign, color: '#b45309' }}>+</div>
        </div>
        <div style={{ ...kpiValue, color: '#b45309' }}>+ {Number(kpis.tips || 0).toLocaleString('el-GR')}€</div>
        <div style={kpiTrack}><div style={{ ...kpiFill, width: '70%', background: '#f59e0b' }} /></div>
      </div>

      <div style={{ ...kpiCard, borderColor: '#111827', background: 'linear-gradient(180deg, #0b1220, #111827)', color: '#fff' }}>
        <div style={kpiTopRow}>
          <div style={{ ...kpiLabel, color: '#fff' }}>
            {isZReport ? 'Business (Z)' : 'Καθαρό Κέρδος'}{' '}
            <span style={{ ...kpiDelta, color: '#e5e7eb' }}>{fmtPct(variance.netProfit)} vs prev</span>
          </div>
          <div style={{ ...kpiSign, color: '#fff' }}>{bigKpiValue >= 0 ? '▲' : '▼'}</div>
        </div>
        <div style={{ ...kpiValue, color: '#fff' }}>{Number(bigKpiValue || 0).toLocaleString('el-GR')}€</div>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginTop: 6 }}>
          {isZReport ? 'Μετρητά (Z) + Χωρίς Σήμανση - Έξοδα Μετρητών' : 'Έσοδα - Έξοδα (χωρίς Πίστωση)'}
        </div>
      </div>
    </div>
  )

  const breakEven = useMemo(() => {
    const rowsNoCredit = periodTx.filter((t) => !isCreditTx(t))
    const expenses = rowsNoCredit.filter((t) => t.type === 'expense' || t.type === 'debt_payment')

    const fixed = expenses.filter((t) => {
      const cat = normalizeExpenseCategory(t)
      const rawCat = String(t.category || '').trim()
      return cat === 'Staff' || cat === 'Utilities' || rawCat === 'Ενοίκιο' || rawCat === 'Rent'
    })

    const fixedTotal = fixed.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)
    const incomeTotal = rowsNoCredit
      .filter((t) => ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type))
      .reduce((a, t) => a + (Number(t.amount) || 0), 0)

    const remaining = Math.max(0, fixedTotal - incomeTotal)
    return { fixedTotal, incomeTotal, remaining }
  }, [periodTx, isCreditTx, normalizeExpenseCategory])

  const drawerZCash = isZReport ? zBreakdown.zCash : Number(drawer?.z_cash || 0)
  const drawerWithoutMarking = isZReport ? zBreakdown.blackCash : Number(drawer?.extra_cash || 0)

  const ProBalances = (
    <div style={balancesGrid} data-print-section="true">
      <div style={{ ...smallKpiCard, border: '1px solid rgba(139,92,246,0.30)', background: 'linear-gradient(180deg, #f5f3ff, #ffffff)' }}>
        <div style={smallKpiLabel}>Κινήσεις Κουμπαρά</div>
        <div style={{ ...smallKpiValue, color: '#7c3aed' }}>{money(kpis.savingsDeposits - kpis.savingsWithdrawals)}</div>
        <div style={smallKpiHint}>IN: {money(kpis.savingsDeposits)} • OUT: {money(kpis.savingsWithdrawals)}</div>
      </div>

      <div style={{ ...smallKpiCard, border: '1px solid rgba(99,102,241,0.20)', background: 'linear-gradient(180deg, #eef2ff, #ffffff)' }}>
        <div style={smallKpiLabel}>Expected Outflows (30d)</div>
        <div style={{ ...smallKpiValue, color: colors.indigo }}>{money(expectedOutflows30d)}</div>
        <div style={smallKpiHint}>Future-dated έξοδα στο σύστημα (χωρίς Πίστωση).</div>
      </div>

      <div style={{ ...smallKpiCard, border: '1px solid rgba(16,185,129,0.20)', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
        <div style={smallKpiLabel}>Break-even (Fixed Costs)</div>
        <div style={{ ...smallKpiValue, color: colors.success }}>{money(breakEven.remaining)}</div>
        <div style={smallKpiHint}>Fixed: {money(breakEven.fixedTotal)} • Έσοδα: {money(breakEven.incomeTotal)}</div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>Υπόλοιπο Μετρητών (Συρτάρι)</div>
        <div style={smallKpiValue}>{money(totalCashDisplay)}</div>
        <div style={smallKpiHint}>
          {isZReport ? 'Business - (Καταθέσεις Κουμπαρά) + (Αναλήψεις Κουμπαρά) [cash]' : `As of: ${endDate} (χωρίς Πίστωση)`}
        </div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>Υπόλοιπο Τράπεζας</div>
        <div style={smallKpiValue}>{money(calcBalances?.bank_balance || 0)}</div>
        <div style={smallKpiHint}>Κάρτα + Τράπεζα (χωρίς Πίστωση)</div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>Σύνολο Καθαρό</div>
        <div style={smallKpiValue}>{money(calcBalances?.total_balance || 0)}</div>
        <div style={smallKpiHint}>Cash + Bank (χωρίς Πίστωση)</div>
      </div>

      <div style={{ ...smallKpiCard, border: '1px solid rgba(244,63,94,0.25)', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
        <div style={smallKpiLabel}>Υπόλοιπο Πιστώσεων</div>
        <div style={{ ...smallKpiValue, color: colors.danger }}>{money(calcBalances?.credit_outstanding || 0)}</div>
        <div style={smallKpiHint}>Έξοδα σε Πίστωση (δεν μειώνουν Cash/Bank)</div>
      </div>

      <div style={smallKpiCard}>
        <div style={smallKpiLabel}>Ταμείο Ημέρας (Z)</div>
        <div style={smallKpiValue}>{drawer ? money(drawer.total_cash_drawer) : '—'}</div>
        <div style={smallKpiHint}>{drawer ? `Ημερομηνία Ζ: ${drawer.date}` : `Δεν βρέθηκε Ζ έως: ${endDate}`}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>
          {drawer || isZReport ? `Z: ${money(drawerZCash)} • Χωρίς Σήμανση: ${money(drawerWithoutMarking)}` : ''}
        </div>
      </div>
    </div>
  )

  const ProCategoryBreakdown = (
    <div style={sectionCard} data-print-section="true">
      <div style={sectionTitleRow}>
        <div>
          <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
          <div style={sectionSub}>Κατανομή της περιόδου (χωρίς έσοδα και χωρίς πιστώσεις)</div>
        </div>
        <div style={sectionPill}>Σύνολο: {Number(categoryBreakdown.total || 0).toLocaleString('el-GR')}€</div>
      </div>

      {categoryBreakdown.total <= 0 ? (
        <div style={hintBox}>Δεν υπάρχουν έξοδα στην επιλεγμένη περίοδο.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CATEGORY_META.map((c) => {
            const val = categoryBreakdown.result[c.key] || 0
            const pct = categoryBreakdown.total > 0 ? (val / categoryBreakdown.total) * 100 : 0
            const Icon = c.Icon
            return (
              <div key={c.key} style={catRow}>
                <div style={catLeft}>
                  <div style={catIconWrap}><Icon size={18} /></div>
                  <div style={catLabelWrap}>
                    <div style={catLabel}>{c.label}</div>
                  </div>
                </div>
                <div style={catMid}>
                  <div style={catPct}>{pct.toFixed(0)}%</div>
                  <div style={catTrack}><div style={{ ...catFill, width: `${pct}%`, background: c.color }} /></div>
                </div>
                <div style={{ ...catValue, color: c.color }}>{Number(val || 0).toLocaleString('el-GR')}€</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const ProStaffMonth = (
    <div style={sectionCard} data-print-section="true">
      <div style={sectionTitleRow}>
        <div>
          <h3 style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</h3>
          <div style={sectionSub}>Τρέχων μήνας (για γρήγορη εικόνα)</div>
        </div>
        <div style={sectionPill}>{format(new Date(), 'MMMM yyyy')}</div>
      </div>

      {staffDetailsThisMonth.length === 0 ? (
        <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staffDetailsThisMonth.map((s) => (
            <div key={s.name} style={rowItem}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {String(s.name || '').toUpperCase()}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: colors.secondary }}>Καταβλήθηκε</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>
                {Number(s.amount || 0).toLocaleString('el-GR')}€
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const ProMoves = (
    <div style={sectionCard} data-print-section="true">
      <div style={sectionTitleRow}>
        <div>
          <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
          <div style={sectionSub}>Λίστα κινήσεων (Z σε 1 γραμμή/ημέρα)</div>
        </div>
        <div style={sectionPill}>{collapsedPeriodList.length} εγγραφές</div>
      </div>

      {loading ? (
        <div style={hintBox}>Φόρτωση...</div>
      ) : collapsedPeriodList.length === 0 ? (
        <div style={hintBox}>Δεν υπάρχουν κινήσεις για το φίλτρο που επέλεξες.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {collapsedPeriodList.map((t: any) => {
            const isCollapsedZ = !!t.__collapsedZ
            const name = isCollapsedZ ? 'Z REPORT (ΣΥΝΟΛΟ)' : getPartyName(t)

            const amt = Number(t.amount) || 0
            const absAmt = Math.abs(amt)

            const isInc = ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type)
            const isTip = t.type === 'tip_entry'
            const isExp = ['expense', 'debt_payment', 'savings_deposit'].includes(t.type)

            const sign = isInc || isTip ? '+' : isExp ? '-' : ''
            const pillBg = isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2'
            const pillBr = isInc ? '#d1fae5' : isTip ? '#fde68a' : '#ffe4e6'
            const pillTx = isInc ? colors.success : isTip ? '#92400e' : colors.danger

            const pm = String(t.method || '').trim()
            const credit = isCreditTx(t)
            const verified = t?.is_verified === true

            return (
              <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap' }}>{t.date}</div>
                    <div style={{ padding: '8px 12px', borderRadius: 999, backgroundColor: pillBg, border: `1px solid ${pillBr}`, fontSize: 16, fontWeight: 900, color: pillTx, whiteSpace: 'nowrap' }}>
                      {sign}{absAmt.toLocaleString('el-GR')}€
                    </div>
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 900, color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(name || '').toUpperCase()}
                  </div>

                  {!!t.notes && <div style={{ fontSize: 14, fontWeight: 800, color: colors.secondary }}>{t.notes}</div>}

                  {!!pm && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: colors.secondary }}>
                      <span style={{ fontWeight: 900 }}>Μέθοδος:</span> {pm}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {credit && <span style={{ fontSize: 12, fontWeight: 900, color: colors.danger }}>⚠️ ΠΙΣΤΩΣΗ</span>}
                    {typeof t.is_verified !== 'undefined' && (
                      <span style={{ fontSize: 12, fontWeight: 900, color: verified ? colors.success : colors.secondary }}>
                        {verified ? '✅ VERIFIED' : '⏳ NOT VERIFIED'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const PrintPanel = (
    <div className="no-print" style={printWrap}>
      <div style={printModeSwitchWrap}>
        <button type="button" onClick={() => setPrintMode('summary')} style={{ ...printModeBtn, ...(printMode === 'summary' ? printModeBtnActive : {}) }}>
          Σύνοψη
        </button>
        <button type="button" onClick={() => setPrintMode('full')} style={{ ...printModeBtn, ...(printMode === 'full' ? printModeBtnActive : {}) }}>
          Πλήρες
        </button>
      </div>

      <button type="button" onClick={handlePrint} style={printBtn}>
        <Printer size={18} /> Εκτύπωση Αναφοράς
      </button>

      <div style={printHint}>
        Εκτύπωση: <b>{printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}</b> • Θα ανοίξει το παράθυρο εκτύπωσης για αποθήκευση σε PDF.
      </div>
    </div>
  )

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />

      {/* PRINT HEADER */}
      <div className="print-header" style={{ display: 'none' }}>
        <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
        <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
        <p className="print-meta">Περίοδος: {rangeText} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}</p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {SimpleHeader}

        {uiMode === 'simple' ? (
          <>
            <div style={rangePill} className="no-print">{rangeText}</div>
            {SimpleKpiCard}
            {SimpleBalances}
            {SimpleFilterPanel}

            {/* Optional mini list in simple (δείχνει τι “φιλτράρεις”) */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: colors.secondary, letterSpacing: 0.6, marginBottom: 10 }}>
                ΚΙΝΗΣΕΙΣ ({collapsedPeriodList.length})
              </div>
              {loading ? (
                <div style={hintBox}>Φόρτωση...</div>
              ) : collapsedPeriodList.length === 0 ? (
                <div style={hintBox}>Δεν υπάρχουν κινήσεις.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {collapsedPeriodList.slice(0, 8).map((t: any) => {
                    const isCollapsedZ = !!t.__collapsedZ
                    const title = isCollapsedZ ? 'Z REPORT (ΣΥΝΟΛΟ)' : getPartyName(t)
                    const amt = Math.abs(Number(t.amount) || 0)

                    const isInc = ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type)
                    const isTip = t.type === 'tip_entry'
                    const isExp = ['expense', 'debt_payment', 'savings_deposit'].includes(t.type)

                    const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                    const c = isInc ? colors.success : isTip ? '#92400e' : colors.danger

                    return (
                      <div key={t.id ?? `${t.date}-${amt}`} style={{ padding: 14, borderRadius: 18, background: '#fff', border: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(title || '').toUpperCase()}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 4 }}>
                            {t.date} • {String(t.method || '').trim()}
                          </div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 1000, color: c, whiteSpace: 'nowrap' }}>
                          {sign}{amt.toLocaleString('el-GR')}€
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {PrintPanel}
          </>
        ) : (
          <>
            <div style={rangePill} className="no-print">{rangeText} • PRO</div>
            {ProFilters}
            {ProKpis}
            {ProBalances}
            {ProCategoryBreakdown}

            {printMode === 'full' && ProStaffMonth}
            {printMode === 'full' && ProMoves}

            {PrintPanel}
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */

const iphoneWrapper: any = {
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  minHeight: '100%',
  padding: 18,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
  fontSize: 16,
  touchAction: 'pan-y',
  display: 'block',
}

const headerCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 18px 34px rgba(15,23,42,0.08)',
}

const headerIconBox: any = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background: 'linear-gradient(180deg, #111827, #0b1220)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 22,
  color: '#fff',
  boxShadow: '0 16px 26px rgba(2,6,23,0.25)',
}

const headerTitle: any = { fontSize: 22, fontWeight: 950, color: colors.primary, lineHeight: 1.1 }
const headerSub: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, letterSpacing: 0.8, marginTop: 4 }

const headerCircleBtn: any = {
  width: 46,
  height: 46,
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  color: colors.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
}

const rangePill: any = {
  marginTop: 12,
  padding: '12px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.85)',
  fontWeight: 950,
  fontSize: 18,
  color: colors.primary,
  boxShadow: '0 10px 20px rgba(15,23,42,0.06)',
}

const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }
const kpiCard: any = { borderRadius: 22, border: `1px solid ${colors.border}`, padding: 14, background: '#fff', boxShadow: '0 12px 22px rgba(15,23,42,0.06)', overflow: 'hidden' }
const kpiTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const kpiLabel: any = { fontSize: 14, fontWeight: 950 }
const kpiSign: any = { fontSize: 16, fontWeight: 950 }
const kpiValue: any = { marginTop: 10, fontSize: 24, fontWeight: 950 }
const kpiDelta: any = { marginLeft: 8, fontSize: 11, fontWeight: 900, color: colors.secondary }
const kpiTrack: any = { marginTop: 12, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const kpiFill: any = { height: 8, borderRadius: 999 }

const balancesGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }
const smallKpiCard: any = { background: '#ffffff', border: '1px solid rgba(15, 23, 42, 0.08)', borderRadius: 18, padding: 14, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }
const smallKpiLabel: any = { fontSize: 12, fontWeight: 900, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase' }
const smallKpiValue: any = { fontSize: 20, fontWeight: 1000, color: '#0f172a', marginTop: 8 }
const smallKpiHint: any = { fontSize: 12, color: '#94a3b8', marginTop: 6, fontWeight: 700 }

const filterCard: any = { marginTop: 12, padding: 14, borderRadius: 26, border: `1px solid ${colors.border}`, background: 'rgba(255,255,255,0.9)', boxShadow: '0 14px 26px rgba(15,23,42,0.06)' }
const filterHeaderRow: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }
const filterIconBubble: any = { width: 44, height: 44, borderRadius: 16, border: `1px solid ${colors.border}`, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.indigo, fontWeight: 900 }
const filterTitle: any = { fontSize: 18, fontWeight: 950, color: colors.primary }
const filterSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }
const filtersStack: any = { display: 'flex', flexDirection: 'column', gap: 12 }
const tile: any = { display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, background: '#fff', border: `1px solid ${colors.border}`, boxShadow: '0 2px 10px rgba(15,23,42,0.04)' }
const tileIcon: any = { width: 46, height: 46, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef2ff', border: `1px solid ${colors.border}`, fontSize: 18, flex: '0 0 46px' }
const tileBody: any = { flex: 1, minWidth: 0 }
const tileLabel: any = { fontSize: 12, fontWeight: 950, color: colors.secondary, letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' }
const tileControl: any = { width: '100%', height: 48, padding: '0 12px', borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.background, fontSize: 16, fontWeight: 900, outline: 'none', color: colors.primary, appearance: 'none', WebkitAppearance: 'none' }
const rangeHint: any = { marginTop: 2, fontSize: 13, fontWeight: 850, color: colors.secondary }

const sectionCard: any = { marginTop: 14, borderRadius: 26, border: `1px solid ${colors.border}`, padding: 16, background: 'rgba(255,255,255,0.92)', boxShadow: '0 14px 26px rgba(15,23,42,0.06)' }
const sectionTitleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }
const sectionTitle: any = { margin: 0, fontSize: 18, fontWeight: 950, color: colors.primary }
const sectionSub: any = { marginTop: 4, fontSize: 12, fontWeight: 850, color: colors.secondary }
const sectionPill: any = { padding: '10px 14px', borderRadius: 999, border: `1px solid ${colors.border}`, background: '#fff', fontSize: 13, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap' }

const hintBox: any = { padding: 14, borderRadius: 16, backgroundColor: colors.background, border: `1px solid ${colors.border}`, fontSize: 14, fontWeight: 850, color: colors.secondary }

const catRow: any = { display: 'grid', gridTemplateColumns: '1fr 120px 110px', alignItems: 'center', gap: 12 }
const catLeft: any = { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }
const catIconWrap: any = { width: 44, height: 44, borderRadius: 16, background: '#f1f5f9', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, flex: '0 0 44px' }
const catLabelWrap: any = { minWidth: 0 }
const catLabel: any = { fontSize: 16, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const catMid: any = { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }
const catPct: any = { width: 44, textAlign: 'right', fontSize: 14, fontWeight: 950, color: colors.secondary }
const catTrack: any = { flex: 1, height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const catFill: any = { height: 10, borderRadius: 999 }
const catValue: any = { textAlign: 'right', fontSize: 16, fontWeight: 950, whiteSpace: 'nowrap' }

const rowItem: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }
const listRow: any = { padding: 14, borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }

const printWrap: any = { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: colors.surface, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: 10 }
const printModeSwitchWrap: any = { display: 'flex', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 14, gap: 6 }
const printModeBtn: any = { flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 950, fontSize: 16, cursor: 'pointer', backgroundColor: 'transparent', color: colors.primary }
const printModeBtnActive: any = { backgroundColor: colors.indigo, color: '#fff' }
const printBtn: any = { width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 950, backgroundColor: colors.indigo, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }
const printHint: any = { fontSize: 13, fontWeight: 850, color: colors.secondary, textAlign: 'center' }

// --- SIMPLE big card styles (photo-like) ---
const simpleBigCard: any = {
  marginTop: 14,
  borderRadius: 30,
  padding: 18,
  color: '#fff',
  boxShadow: '0 18px 36px rgba(2,6,23,0.20)',
}
const simpleBigTitle: any = {
  fontSize: 14,
  fontWeight: 950,
  color: '#cbd5e1',
  letterSpacing: 1,
}
const simpleBigValue: any = {
  marginTop: 10,
  fontSize: 56,
  fontWeight: 1000,
  lineHeight: 1,
}
const simplePill: any = {
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.18)',
  display: 'flex',
  gap: 10,
  alignItems: 'center',
}
const simplePillLabel: any = { fontSize: 16, fontWeight: 900, color: '#e2e8f0' }
const simplePillValue: any = { fontSize: 18, fontWeight: 1000, color: '#fff' }

// --- SIMPLE filter panel (2nd photo) ---
const simpleFiltersCard: any = {
  marginTop: 14,
  padding: 18,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)',
}
const simpleFilterLabel: any = { fontSize: 12, fontWeight: 950, color: colors.secondary, letterSpacing: 0.8, marginBottom: 8 }
const simpleDateInput: any = {
  width: '100%',
  height: 64,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: '0 14px',
  fontSize: 24,
  fontWeight: 1000,
  outline: 'none',
}
const simpleSelect: any = {
  width: '100%',
  height: 64,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: '0 14px',
  fontSize: 28,
  fontWeight: 1000,
  outline: 'none',
}

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}