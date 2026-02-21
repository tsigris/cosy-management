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
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

/* ---------------- CONFIG / META ---------------- */

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
  amber: '#f59e0b',
  sky: '#0ea5e9',
}

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

/* ---------------- HELPERS ---------------- */

function safePctChange(curr: number, prev: number) {
  if (!isFinite(curr) || !isFinite(prev)) return null
  if (prev === 0) return curr === 0 ? 0 : null
  return ((curr - prev) / Math.abs(prev)) * 100
}
function fmtPct(p: number | null) {
  if (p === null) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(0)}%`
}

function moneyGR(n: any) {
  const v = Number(n || 0)
  return `${v.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  /* ---------------- STATE ---------------- */

  const [uiMode, setUiMode] = useState<UiMode>('simple')
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  const [transactions, setTransactions] = useState<any[]>([])
  const [prevTransactions, setPrevTransactions] = useState<any[]>([])
  const [monthTransactions, setMonthTransactions] = useState<any[]>([])

  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  const [drawer, setDrawer] = useState<any>(null)
  const [calcBalances, setCalcBalances] = useState<CalcBalances | null>(null)

  const [loading, setLoading] = useState(true)

  // Global period (used for KPI summary)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // Simple: drilldown filter
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  const [expectedOutflows30d, setExpectedOutflows30d] = useState<number>(0)

  // Simple/Pro: Transaction search (separate, to avoid loading thousands)
  const [searchFrom, setSearchFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTo, setSearchTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pageSize, setPageSize] = useState<number>(30)
  const [searchPage, setSearchPage] = useState<number>(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchHasMore, setSearchHasMore] = useState<boolean>(false)

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  const norm = useCallback((v: any) => String(v ?? '').trim().toLowerCase(), [])
  const getMethod = useCallback((t: any) => String(t?.method ?? t?.payment_method ?? '').trim(), [])

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
  const isBankMethod = useCallback((method: string) => ['κάρτα', 'τράπεζα'].includes(norm(method)), [norm])

  // signedAmount: deposits to “κουμπαρά” are outflow from cash
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

  /* ---------------- PRINT CSS ---------------- */

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
        [data-print-section="true"] { break-inside: avoid; page-break-inside: avoid; }
        .print-header { display: block !important; margin: 0 0 10mm 0 !important; padding-bottom: 6mm !important; border-bottom: 1px solid #e5e7eb !important; }
        .print-title { font-size: 18px !important; font-weight: 900 !important; margin: 0 !important; color: #000 !important; }
        .print-sub { margin: 4px 0 0 0 !important; font-size: 12px !important; font-weight: 700 !important; color: #374151 !important; }
        .print-meta { margin: 6px 0 0 0 !important; font-size: 12px !important; font-weight: 700 !important; color: #374151 !important; }
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

  /* ---------------- AUTH / STORE ---------------- */

  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  /* ---------------- DATA LOAD (summary dataset) ---------------- */

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      if (!storeId || storeId === 'null') return setLoading(false)

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session) return router.push('/login')

      const { prevStart, prevEnd } = getPrevRange()

      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const forecastTo = format(addDays(parseISO(endDate), 30), 'yyyy-MM-dd')

      const [
        txRes,
        prevRes,
        monthRes,
        staffRes,
        supRes,
        revRes,
        maintRes,
        drawerRes,
        expOutRes,
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

        supabase.from('suppliers').select('id, name').eq('store_id', storeId).order('name', { ascending: true }),

        supabase.from('revenue_sources').select('id, name').eq('store_id', storeId).order('name', { ascending: true }),

        supabase
          .from('fixed_assets')
          .select('id, name, sub_category')
          .eq('store_id', storeId)
          .in('sub_category', ['worker', 'Maintenance', 'maintenance', 'Maintenance'])
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
          .select('amount, type, is_credit, method, payment_method, category, date')
          .eq('store_id', storeId)
          .gt('date', endDate)
          .lte('date', forecastTo)
          .in('type', ['expense', 'debt_payment'])
          .order('date', { ascending: true }),
      ])

      if (txRes.error) throw txRes.error
      if (prevRes.error) throw prevRes.error
      if (monthRes.error) throw monthRes.error

      setTransactions(txRes.data || [])
      setPrevTransactions(prevRes.data || [])
      setMonthTransactions(monthRes.data || [])

      setStaff(staffRes.data || [])
      setSuppliers(supRes.data || [])
      setRevenueSources(revRes.data || [])
      setMaintenanceWorkers((maintRes.data || []).filter((x: any) => String(x?.name || '').trim().length > 0))
      setDrawer(drawerRes.data || null)

      const out = (expOutRes.data || [])
        .filter((t: any) => !isCreditTx(t))
        .reduce((a: number, t: any) => a + Math.abs(Number(t.amount) || 0), 0)
      setExpectedOutflows30d(out)
    } catch (err) {
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId, startDate, endDate, getPrevRange, isCreditTx])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* ---------------- FILTER MODE MAPPING ---------------- */

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

  const filterAToKey = useCallback((fa: FilterA) => {
    if (fa === 'Εμπορεύματα') return 'Εμπορεύματα'
    if (fa === 'Προσωπικό') return 'Staff'
    if (fa === 'Λογαριασμοί') return 'Utilities'
    if (fa === 'Συντήρηση') return 'Maintenance'
    if (fa === 'Λοιπά') return 'Other'
    return null
  }, [])

  const periodTx = useMemo(() => transactions.filter((t) => t.date >= startDate && t.date <= endDate), [transactions, startDate, endDate])

  const prevPeriodTx = useMemo(() => {
    const { prevStart, prevEnd } = getPrevRange()
    return prevTransactions.filter((t) => t.date >= prevStart && t.date <= prevEnd)
  }, [prevTransactions, getPrevRange])

  const filteredTx = useMemo(() => {
    const key = filterAToKey(filterA)
    return periodTx.filter((t) => {
      if (filterA === 'Έσοδα' && !['income', 'income_collection', 'debt_received'].includes(t.type)) return false
      if (filterA !== 'Όλες' && filterA !== 'Έσοδα' && normalizeExpenseCategory(t) !== key) return false

      if (detailMode === 'staff' && detailId !== 'all' && String(t.fixed_asset_id) !== String(detailId)) return false
      if (detailMode === 'supplier' && detailId !== 'all' && String(t.supplier_id) !== String(detailId)) return false
      if (detailMode === 'revenue_source' && detailId !== 'all' && String(t.revenue_source_id) !== String(detailId)) return false
      if (detailMode === 'maintenance' && detailId !== 'all' && String(t.fixed_asset_id) !== String(detailId)) return false

      return true
    })
  }, [periodTx, filterA, detailMode, detailId, filterAToKey, normalizeExpenseCategory])

  /* ---------------- KPI / BALANCES ---------------- */

  const computeKpis = useCallback(
    (rows: any[]): Kpis => {
      const rowsNoCredit = rows.filter((t) => !isCreditTx(t))

      const income = rowsNoCredit
        .filter((t) => t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received')
        .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

      const tips = rowsNoCredit
        .filter((t) => t.type === 'tip_entry')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const expenses = rowsNoCredit
        .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
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
      let cash = 0,
        bank = 0,
        creditOutstanding = 0,
        creditIncoming = 0

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

  /* ---------------- Z LOGIC (single day) ---------------- */

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
      .filter(
        (r) =>
          r.category === 'Εσοδα Ζ' &&
          (r.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || r.method === 'Μετρητά' || r.method === 'Χωρίς Απόδειξη') &&
          r.method !== 'Μετρητά (Z)'
      )
      .reduce((a, r) => a + r.amount, 0)

    const totalTurnover = zCash + zPos + blackCash
    return { zCash, zPos, blackCash, totalTurnover, blackPct: totalTurnover > 0 ? (blackCash / totalTurnover) * 100 : 0 }
  }, [isZReport, periodTx, getMethod])

  const cashExpensesToday = useMemo(() => {
    if (!isZReport) return 0
    return periodTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => getMethod(t) === 'Μετρητά')
      .filter((t) => !isCreditTx(t))
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
  }, [isZReport, periodTx, getMethod, isCreditTx])

  const bigKpiValue = useMemo(() => {
    return isZReport ? zBreakdown.zCash + zBreakdown.blackCash - cashExpensesToday : kpis.netProfit
  }, [isZReport, zBreakdown, cashExpensesToday, kpis.netProfit])

  const totalCashDisplay = useMemo(() => {
    if (isZReport) {
      const cashVaultDeposits = periodTx
        .filter((t) => t.type === 'savings_deposit' && getMethod(t) === 'Μετρητά')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      const cashVaultWithdrawals = periodTx
        .filter((t) => t.type === 'savings_withdrawal' && getMethod(t) === 'Μετρητά')
        .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

      return bigKpiValue - cashVaultDeposits + cashVaultWithdrawals
    }

    return Number(calcBalances?.cash_balance || 0)
  }, [isZReport, bigKpiValue, periodTx, getMethod, calcBalances])

  /* ---------------- SIMPLE: ENTITY SUMMARIES (no huge tx list) ---------------- */

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  const rangeText = useMemo(() => `${startDate} → ${endDate}`, [startDate, endDate])

  const entitySummary = useMemo(() => {
    // Build a list of entities (paid/credit totals) depending on filterA
    // This is the SIMPLE replacement for “show all movements”.
    const rows = periodTx.filter((t) => ['expense', 'debt_payment'].includes(t.type))

    const pickMode: DetailMode =
      filterA === 'Εμπορεύματα'
        ? 'supplier'
        : filterA === 'Προσωπικό'
        ? 'staff'
        : filterA === 'Συντήρηση'
        ? 'maintenance'
        : 'none'

    // If no entity filter chosen, show breakdown by category instead (top categories).
    if (pickMode === 'none') {
      const map: Record<string, { name: string; total: number; paid: number; credit: number }> = {}
      for (const t of rows) {
        if (filterA !== 'Όλες' && filterA !== 'Λογαριασμοί' && filterA !== 'Λοιπά' && filterA !== 'Έσοδα') {
          // for other filters we handle via pickMode above
        }
        // apply category filter if needed
        if (filterA === 'Λογαριασμοί' && normalizeExpenseCategory(t) !== 'Utilities') continue
        if (filterA === 'Λοιπά' && normalizeExpenseCategory(t) !== 'Other') continue
        if (filterA === 'Έσοδα') continue

        const key = normalizeExpenseCategory(t)
        const name = CATEGORY_META.find((c) => c.key === key)?.label || key
        const amt = Math.abs(Number(t.amount) || 0)
        const credit = isCreditTx(t)
        if (!map[key]) map[key] = { name, total: 0, paid: 0, credit: 0 }
        map[key].total += amt
        if (credit) map[key].credit += amt
        else map[key].paid += amt
      }
      return Object.entries(map)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12)
    }

    const map: Record<string, { name: string; total: number; paid: number; credit: number }> = {}

    for (const t of rows) {
      // category filtering first (so it matches the “tab”)
      if (filterA !== 'Όλες') {
        const key = filterAToKey(filterA)
        if (key && normalizeExpenseCategory(t) !== key) continue
      }

      let id = ''
      let name = '—'

      if (pickMode === 'supplier') {
        id = String(t.supplier_id || '')
        name =
          t.suppliers?.name ||
          suppliers.find((s) => String(s.id) === String(t.supplier_id))?.name ||
          'Προμηθευτής'
      } else if (pickMode === 'staff') {
        id = String(t.fixed_asset_id || '')
        name =
          t.fixed_assets?.name ||
          staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name ||
          'Υπάλληλος'
      } else if (pickMode === 'maintenance') {
        id = String(t.fixed_asset_id || '')
        name =
          t.fixed_assets?.name ||
          maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))?.name ||
          'Μάστορας'
      }

      if (!id) continue

      const amt = Math.abs(Number(t.amount) || 0)
      const credit = isCreditTx(t)

      if (!map[id]) map[id] = { name, total: 0, paid: 0, credit: 0 }
      map[id].total += amt
      if (credit) map[id].credit += amt
      else map[id].paid += amt
    }

    return Object.entries(map)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
  }, [
    periodTx,
    filterA,
    suppliers,
    staff,
    maintenanceWorkers,
    normalizeExpenseCategory,
    filterAToKey,
    isCreditTx,
  ])

  /* ---------------- PRO: DETAIL CARD (paid vs credit) ---------------- */

  const proDetailSummary = useMemo(() => {
    if (detailMode === 'none' || detailId === 'all') return null

    const rows = periodTx.filter((t) => {
      if (detailMode === 'staff') return String(t.fixed_asset_id) === String(detailId)
      if (detailMode === 'supplier') return String(t.supplier_id) === String(detailId)
      if (detailMode === 'revenue_source') return String(t.revenue_source_id) === String(detailId)
      if (detailMode === 'maintenance') return String(t.fixed_asset_id) === String(detailId)
      return false
    })

    const expenseRows = rows.filter((t) => ['expense', 'debt_payment'].includes(t.type))
    const paidRows = expenseRows.filter((t) => !isCreditTx(t))
    const creditRows = expenseRows.filter((t) => isCreditTx(t))

    const paidCash = paidRows
      .filter((t) => isCashMethod(getMethod(t)))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const paidBank = paidRows
      .filter((t) => isBankMethod(getMethod(t)))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const paidTotal = paidCash + paidBank
    const creditTotal = creditRows.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const name =
      detailMode === 'supplier'
        ? suppliers.find((s) => String(s.id) === String(detailId))?.name
        : detailMode === 'staff'
        ? staff.find((s) => String(s.id) === String(detailId))?.name
        : detailMode === 'maintenance'
        ? maintenanceWorkers.find((m) => String(m.id) === String(detailId))?.name
        : detailMode === 'revenue_source'
        ? revenueSources.find((r) => String(r.id) === String(detailId))?.name
        : '—'

    return {
      name: String(name || '').trim() || '—',
      paidCash,
      paidBank,
      paidTotal,
      creditTotal,
      countPaid: paidRows.length,
      countCredit: creditRows.length,
      totalAll: paidTotal + creditTotal,
      paidRows: [...paidRows].sort((a, b) => String(b.date).localeCompare(String(a.date))),
      creditRows: [...creditRows].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    }
  }, [
    detailMode,
    detailId,
    periodTx,
    suppliers,
    staff,
    maintenanceWorkers,
    revenueSources,
    isCreditTx,
    isCashMethod,
    isBankMethod,
    getMethod,
  ])

  /* ---------------- PRO: EXTRA “PRO” CARDS (Loans / Settlements) ---------------- */
  // Δεν αλλάζουμε βάση. Κάνουμε heuristics από category/notes.
  const proFinanceCards = useMemo(() => {
    const rows = periodTx.filter((t) => !isCreditTx(t))

    const cat = (t: any) => String(t.category || '').trim().toLowerCase()
    const notes = (t: any) => String(t.notes || '').trim().toLowerCase()

    const isLoan = (t: any) =>
      cat(t).includes('δάνει') || cat(t).includes('loan') || notes(t).includes('δάνει') || notes(t).includes('loan')

    const isSettlement = (t: any) =>
      cat(t).includes('ρύθμι') ||
      cat(t).includes('εφορία') ||
      cat(t).includes('tax') ||
      notes(t).includes('ρύθμι') ||
      notes(t).includes('εφορία')

    const loanOut = rows
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && isLoan(t))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const loanIn = rows
      .filter((t) => (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') && isLoan(t))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const settlementOut = rows
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && isSettlement(t))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    return { loanOut, loanIn, settlementOut }
  }, [periodTx, isCreditTx])

  /* ---------------- SIMPLE/PRO: TRANSACTION SEARCH (paged) ---------------- */

  const runTxSearch = useCallback(
    async (page: number) => {
      if (!storeId || storeId === 'null') return
      setSearchLoading(true)
      try {
        const from = searchFrom
        const to = searchTo

        const offset = page * pageSize
        const limit = pageSize

        // fetch 1 extra to detect "hasMore"
        const { data, error } = await supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
          .eq('store_id', storeId)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: false })
          .range(offset, offset + limit) // inclusive range; we’ll still detect hasMore via length === limit+1? (supabase range is inclusive)
        if (error) throw error

        // Supabase range is inclusive; to keep it simple, we just check if we got "limit+1" by asking range(offset, offset+limit)
        // That returns limit+1 rows. If > pageSize => hasMore.
        const rows = data || []
        const hasMore = rows.length > pageSize
        const sliced = rows.slice(0, pageSize)

        setSearchResults(sliced)
        setSearchHasMore(hasMore)
        setSearchPage(page)
      } catch (e) {
        toast.error('Σφάλμα αναζήτησης κινήσεων')
      } finally {
        setSearchLoading(false)
      }
    },
    [storeId, searchFrom, searchTo, pageSize]
  )

  /* ---------------- PARTY NAME FOR LISTS ---------------- */

  const getPartyName = useCallback(
    (t: any) => {
      if (t.type === 'savings_deposit') return 'ΚΑΤΑΘΕΣΗ ΣΕ ΚΟΥΜΠΑΡΑ'
      if (t.type === 'savings_withdrawal') return 'ΑΝΑΛΗΨΗ ΑΠΟ ΚΟΥΜΠΑΡΑ'

      if (t.revenue_source_id || t.revenue_sources?.name)
        return t.revenue_sources?.name || revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))?.name || 'Πηγή Εσόδων'

      if (String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff')
        return t.fixed_assets?.name || staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Υπάλληλος'

      if (t.suppliers?.name || t.supplier_id)
        return t.suppliers?.name || suppliers.find((s) => String(s.id) === String(t.supplier_id))?.name || 'Προμηθευτής'

      if (t.fixed_asset_id)
        return t.fixed_assets?.name || maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))?.name || '-'

      if (t.type === 'tip_entry') return staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Tips'

      return t.category || '-'
    },
    [staff, suppliers, revenueSources, maintenanceWorkers]
  )

  /* ---------------- PRO: COLLAPSE Z IN LIST ---------------- */

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
      let amount = 0,
        zCash = 0,
        zPos = 0,
        withoutMarking = 0

      for (const row of rows) {
        const rowAmount = Number(row.amount) || 0
        amount += rowAmount
        const method = getMethod(row)
        const notes = String(row.notes || '').trim()

        if (method === 'Μετρητά (Z)') zCash += rowAmount
        if (method === 'Κάρτα') zPos += rowAmount
        if (method !== 'Μετρητά (Z)' && (notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || method === 'Μετρητά' || method === 'Χωρίς Απόδειξη'))
          withoutMarking += rowAmount
      }

      return {
        id: `z-${date}`,
        date,
        type: 'income',
        category: 'Εσοδα Ζ',
        amount,
        payment_method: 'Z (Σύνολο)',
        notes: `Μετρητά (Z): ${moneyGR(zCash)} • Κάρτα (POS): ${moneyGR(zPos)} • Χωρίς Σήμανση: ${moneyGR(withoutMarking)}`,
        __collapsedZ: true,
      }
    })

    return [...others, ...collapsedZ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [filteredTx, getMethod])

  /* ---------------- CATEGORY BREAKDOWN ---------------- */

  const categoryBreakdown = useMemo(() => {
    const expenseTx = filteredTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => !isCreditTx(t))

    const result: Record<string, number> = {}
    let total = 0

    for (const t of expenseTx) {
      const catKey = normalizeExpenseCategory(t)
      const val = Math.abs(Number(t.amount) || 0)
      result[catKey] = (result[catKey] || 0) + val
      total += val
    }

    for (const c of CATEGORY_META) result[c.key] = result[c.key] || 0
    return { result, total }
  }, [filteredTx, normalizeExpenseCategory, isCreditTx])

  /* ---------------- STAFF PAYROLL (CURRENT MONTH) ---------------- */

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

  /* ---------------- UI ---------------- */

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />
      <style jsx>{`
        @media (max-width: 520px) {
          .analysis-filters-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .analysis-filter-tile {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            box-sizing: border-box;
            overflow: hidden;
          }

          .analysis-filter-icon {
            flex: 0 0 46px;
          }

          .analysis-filter-body {
            flex: 1;
            min-width: 0;
          }

          .analysis-filter-control {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
            font-size: 16px;
            overflow: hidden;
          }
        }
      `}</style>

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* PRINT HEADER */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{uiMode === 'simple' ? 'SIMPLE MODE' : 'PRO MODE'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση:{' '}
            {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* HEADER */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={headerIconBox}>📊</div>
            <div style={{ minWidth: 0 }}>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
              <div style={headerSub}>
                {uiMode === 'simple' ? 'SIMPLE (γρήγορη εικόνα)' : 'PRO (πλήρες dashboard)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setUiMode((m) => (m === 'simple' ? 'pro' : 'simple'))}
              style={headerCircleBtn}
              aria-label="toggle mode"
              title="Simple / Pro"
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

        {/* SIMPLE: TOP “ΑΠΟ/ΕΩΣ” PILL (όπως ζήτησες) */}
        <div style={rangePill} className="no-print">
          {startDate} → {endDate}
        </div>

        {/* FILTER CARD */}
        <div style={filterCard} className="no-print">
          <div style={filtersStack} className="analysis-filters-stack">
            <div style={tile} className="analysis-filter-tile">
              <div style={tileIcon} className="analysis-filter-icon">📅</div>
              <div style={tileBody} className="analysis-filter-body">
                <div style={tileLabel}>ΑΠΟ</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={tileControl}
                  className="analysis-filter-control"
                  inputMode="none"
                />
              </div>
            </div>

            <div style={tile} className="analysis-filter-tile">
              <div style={tileIcon} className="analysis-filter-icon">📅</div>
              <div style={tileBody} className="analysis-filter-body">
                <div style={tileLabel}>ΕΩΣ</div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={tileControl}
                  className="analysis-filter-control"
                  inputMode="none"
                />
              </div>
            </div>

            {/* SIMPLE + PRO: Category filter always visible */}
            <div style={tile} className="analysis-filter-tile">
              <div style={tileIcon} className="analysis-filter-icon">⛃</div>
              <div style={tileBody} className="analysis-filter-body">
                <div style={tileLabel}>ΦΙΛΤΡΟ</div>
                <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={tileControl} className="analysis-filter-control">
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

            {/* Drill-down detail */}
            {detailMode !== 'none' && (
              <div style={tile} className="analysis-filter-tile">
                <div style={tileIcon} className="analysis-filter-icon">≡</div>
                <div style={tileBody} className="analysis-filter-body">
                  <div style={tileLabel}>ΛΕΠΤΟΜΕΡΕΙΑ</div>
                  <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={tileControl} className="analysis-filter-control">
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

        {/* KPI GRID (always) */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, borderColor: '#d1fae5', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.success }}>
                Έσοδα <span style={kpiDelta}>{fmtPct(variance.income)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: colors.success }}>+</div>
            </div>
            <div style={{ ...kpiValue, color: colors.success }}>+ {moneyGR(kpis.income)}</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.success }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.danger }}>
                Έξοδα <span style={kpiDelta}>{fmtPct(variance.expenses)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: colors.danger }}>-</div>
            </div>
            <div style={{ ...kpiValue, color: colors.danger }}>- {moneyGR(kpis.expenses)}</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.danger }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#fde68a', background: 'linear-gradient(180deg, #fffbeb, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#b45309' }}>
                Tips <span style={kpiDelta}>{fmtPct(variance.tips)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: '#b45309' }}>+</div>
            </div>
            <div style={{ ...kpiValue, color: '#b45309' }}>+ {moneyGR(kpis.tips)}</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.amber }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#111827', background: 'linear-gradient(180deg, #0b1220, #111827)', color: '#fff' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#fff' }}>
                {isZReport ? 'Καθαρό Ταμείο Ημέρας' : 'Καθαρό Κέρδος'}{' '}
                <span style={{ ...kpiDelta, color: '#e5e7eb' }}>{fmtPct(variance.netProfit)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: '#fff' }}>{bigKpiValue >= 0 ? '▲' : '▼'}</div>
            </div>
            <div style={{ ...kpiValue, color: '#fff' }}>{moneyGR(bigKpiValue)}</div>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginTop: 6 }}>
              {isZReport ? 'Μετρητά (Z) + Χωρίς Σήμανση - Επιχειρ. Έξοδα Μετρητών' : 'Έσοδα - Έξοδα (χωρίς Πίστωση)'}
            </div>
          </div>
        </div>

        {/* BALANCES GRID */}
        <div style={balancesGrid} data-print-section="true">
          <div style={{ ...smallKpiCard, border: '1px solid rgba(139,92,246,0.30)', background: 'linear-gradient(180deg, #f5f3ff, #ffffff)' }}>
            <div style={smallKpiLabel}>Κινήσεις Κουμπαρά</div>
            <div style={{ ...smallKpiValue, color: colors.purple }}>
              {moneyGR(kpis.savingsDeposits - kpis.savingsWithdrawals)}
            </div>
            <div style={smallKpiHint}>
              IN: {moneyGR(kpis.savingsDeposits)} • OUT: {moneyGR(kpis.savingsWithdrawals)}
            </div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Μετρητών</div>
            <div style={smallKpiValue}>{moneyGR(totalCashDisplay)}</div>
            <div style={smallKpiHint}>{isZReport ? 'Συρτάρι ημέρας' : `As of: ${endDate} (χωρίς Πίστωση)`}</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Τράπεζας</div>
            <div style={smallKpiValue}>{moneyGR(calcBalances?.bank_balance || 0)}</div>
            <div style={smallKpiHint}>Κάρτα + Τράπεζα (χωρίς Πίστωση)</div>
          </div>

          <div style={{ ...smallKpiCard, border: '1px solid rgba(16,185,129,0.20)', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
            <div style={smallKpiLabel}>Σύνολο Ρευστό</div>
            <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(calcBalances?.total_balance || 0)}</div>
            <div style={smallKpiHint}>Cash + Bank (χωρίς Πίστωση)</div>
          </div>

          {/* PRO extras only */}
          {uiMode === 'pro' && (
            <>
              <div style={{ ...smallKpiCard, border: '1px solid rgba(244,63,94,0.25)', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
                <div style={smallKpiLabel}>Υπόλοιπο Πιστώσεων</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(calcBalances?.credit_outstanding || 0)}</div>
                <div style={smallKpiHint}>Έξοδα σε Πίστωση (δεν μειώνουν Cash/Bank)</div>
              </div>

              <div style={{ ...smallKpiCard, border: '1px solid rgba(99,102,241,0.20)', background: 'linear-gradient(180deg, #eef2ff, #ffffff)' }}>
                <div style={smallKpiLabel}>Expected Outflows (30d)</div>
                <div style={{ ...smallKpiValue, color: colors.indigo }}>{moneyGR(expectedOutflows30d)}</div>
                <div style={smallKpiHint}>Μελλοντικά έξοδα (future dated). Χωρίς Πίστωση.</div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>Ταμείο Ημέρας (Z View)</div>
                <div style={smallKpiValue}>{drawer ? moneyGR(drawer.total_cash_drawer) : '—'}</div>
                <div style={smallKpiHint}>{drawer ? `Ημερομηνία Ζ: ${drawer.date}` : `Δεν βρέθηκε Ζ έως: ${endDate}`}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>
                  {drawer ? `Z: ${moneyGR(drawer.z_cash)} • Χωρίς Σήμανση: ${moneyGR(drawer.extra_cash)}` : ''}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------------- SIMPLE MODE: “έξοδα ανά οντότητα” αντί για λίστα κινήσεων ---------------- */}
        {uiMode === 'simple' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>
                  {filterA === 'Εμπορεύματα'
                    ? 'Έξοδα ανά Προμηθευτή'
                    : filterA === 'Προσωπικό'
                    ? 'Έξοδα ανά Υπάλληλο'
                    : filterA === 'Συντήρηση'
                    ? 'Έξοδα ανά Μάστορα'
                    : 'Σύνοψη Εξόδων'}
                </h3>
                <div style={sectionSub}>Περίοδος: {rangeText} • Δεν φορτώνουμε χιλιάδες κινήσεις</div>
              </div>
              <div style={sectionPill}>{entitySummary.length} εγγραφές</div>
            </div>

            {loading ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : entitySummary.length === 0 ? (
              <div style={hintBox}>Δεν βρέθηκαν έξοδα για τα φίλτρα που επέλεξες.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {entitySummary.map((x: any) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      // Quick drill-down for simple:
                      if (filterA === 'Εμπορεύματα') {
                        setFilterA('Εμπορεύματα')
                        setDetailId(String(x.id))
                      } else if (filterA === 'Προσωπικό') {
                        setFilterA('Προσωπικό')
                        setDetailId(String(x.id))
                      } else if (filterA === 'Συντήρηση') {
                        setFilterA('Συντήρηση')
                        setDetailId(String(x.id))
                      }
                      // If it's category summary, just keep it.
                    }}
                    style={{
                      ...rowItem,
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(x.name || '').toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, marginTop: 6 }}>
                        Πληρωμένα: <b style={{ color: colors.success }}>{moneyGR(x.paid)}</b> • Πίστωση:{' '}
                        <b style={{ color: colors.danger }}>{moneyGR(x.credit)}</b>
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap' }}>
                      {moneyGR(x.total)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- PRO MODE: Detail card when selecting entity (π.χ. Τζηλιος) ---------------- */}
        {uiMode === 'pro' && proDetailSummary && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Καρτέλα: {proDetailSummary.name}</h3>
                <div style={sectionSub}>
                  Περίοδος: {rangeText} • Φίλτρο: {filterA} • Paid / Credit
                </div>
              </div>
              <div style={sectionPill}>Σύνολο: {moneyGR(proDetailSummary.totalAll)}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΠΛΗΡΩΜΕΝΑ (ΣΥΝΟΛΟ)</div>
                <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(proDetailSummary.paidTotal)}</div>
                <div style={smallKpiHint}>
                  Μετρητά: {moneyGR(proDetailSummary.paidCash)} • Τράπεζα: {moneyGR(proDetailSummary.paidBank)} • (
                  {proDetailSummary.countPaid} κινήσεις)
                </div>
              </div>

              <div style={{ ...smallKpiCard, border: '1px solid rgba(244,63,94,0.25)', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
                <div style={smallKpiLabel}>ΥΠΟΛΟΙΠΟ ΠΙΣΤΩΣΗΣ</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(proDetailSummary.creditTotal)}</div>
                <div style={smallKpiHint}>({proDetailSummary.countCredit} κινήσεις σε πίστωση)</div>
              </div>
            </div>

            {/* δείξε τις πιο πρόσφατες κινήσεις πίστωσης (και προαιρετικά paid) */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {proDetailSummary.creditRows.length === 0 ? (
                <div style={hintBox}>Δεν υπάρχουν κινήσεις σε πίστωση για την περίοδο.</div>
              ) : (
                <>
                  <div style={hintBox}>
                    <b>Πίστωση:</b> {proDetailSummary.creditRows.length} κινήσεις (δείχνω τις 10 πιο πρόσφατες)
                  </div>
                  {proDetailSummary.creditRows.slice(0, 10).map((t: any) => (
                    <div key={`cr-${t.id}`} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary }}>{t.date}</div>
                          <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, marginTop: 4 }}>
                            {String(t.notes || t.category || '').trim() || '—'}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: colors.danger }}>⚠️ ΠΙΣΤΩΣΗ</div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 950, color: colors.danger, whiteSpace: 'nowrap' }}>
                          {moneyGR(Math.abs(Number(t.amount) || 0))}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------------- PRO MODE: Extra PRO finance cards (Loans / Settlements) ---------------- */}
        {uiMode === 'pro' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>PRO Έλεγχοι</h3>
                <div style={sectionSub}>Δάνεια / Ρυθμίσεις (με βάση category/notes) • Περίοδος: {rangeText}</div>
              </div>
              <div style={sectionPill}>PRO</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΔΑΝΕΙΑ (ΠΛΗΡΩΜΕΣ)</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(proFinanceCards.loanOut)}</div>
                <div style={smallKpiHint}>Έξοδα που μοιάζουν με “δάνειο”</div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΔΑΝΕΙΑ (ΕΙΣΠΡΑΞΕΙΣ)</div>
                <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(proFinanceCards.loanIn)}</div>
                <div style={smallKpiHint}>Έσοδα που μοιάζουν με “δάνειο”</div>
              </div>

              <div style={{ ...smallKpiCard, gridColumn: 'span 2' }}>
                <div style={smallKpiLabel}>ΡΥΘΜΙΣΕΙΣ / ΕΦΟΡΙΑ (ΠΛΗΡΩΜΕΣ)</div>
                <div style={{ ...smallKpiValue, color: colors.indigo }}>{moneyGR(proFinanceCards.settlementOut)}</div>
                <div style={smallKpiHint}>Έξοδα που μοιάζουν με “ρύθμιση/εφορία”</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 850, color: colors.secondary }}>
              Αν θες 100% σωστό “Loans” και “Ρυθμίσεις”, πες μου ποιες <b>category</b> χρησιμοποιείς και θα το κάνω με αυστηρούς κανόνες.
            </div>
          </div>
        )}

        {/* ---------------- SIMPLE + PRO: “Αναζήτηση Κινήσεων” card (paged) ---------------- */}
        <div style={sectionCard} className="no-print">
          <div style={sectionTitleRow}>
            <div>
              <h3 style={sectionTitle}>Αναζήτηση Κινήσεων</h3>
              <div style={sectionSub}>Ψάξε συγκεκριμένη μέρα/περίοδο χωρίς να φορτώνουμε χιλιάδες κινήσεις</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={sectionPill}>{pageSize}/σελίδα</div>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setPageSize(v)
                  setSearchPage(0)
                }}
                style={{ ...tileControl, width: 120, height: 40, fontSize: 14 }}
              >
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={tile}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΑΠΟ</div>
                <input type="date" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} style={tileControl} />
              </div>
            </div>
            <div style={tile}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΕΩΣ</div>
                <input type="date" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} style={tileControl} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 50px 50px', gap: 10 }}>
            <button
              type="button"
              onClick={() => runTxSearch(0)}
              style={searchBtn}
              disabled={searchLoading}
            >
              <Search size={18} /> {searchLoading ? 'Ψάχνω...' : 'Αναζήτηση'}
            </button>

            <button
              type="button"
              onClick={() => runTxSearch(Math.max(0, searchPage - 1))}
              style={navBtn}
              disabled={searchLoading || searchPage === 0}
              aria-label="prev"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => runTxSearch(searchPage + 1)}
              style={navBtn}
              disabled={searchLoading || !searchHasMore}
              aria-label="next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {searchResults.length === 0 ? (
              <div style={hintBox}>Δεν έχεις τρέξει αναζήτηση ή δεν βρέθηκαν κινήσεις.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchResults.map((t: any) => {
                  const amt = Math.abs(Number(t.amount) || 0)
                  const isInc = ['income', 'income_collection', 'debt_received', 'savings_withdrawal', 'tip_entry'].includes(t.type)
                  const isExp = ['expense', 'debt_payment', 'savings_deposit'].includes(t.type)
                  const sign = isInc ? '+' : isExp ? '-' : ''
                  const color = isInc ? colors.success : isExp ? colors.danger : colors.primary

                  return (
                    <div key={t.id} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary }}>{t.date}</div>
                          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(getPartyName(t) || '').toUpperCase()}
                          </div>
                          {!!t.notes && (
                            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 850, color: colors.secondary }}>
                              {t.notes}
                            </div>
                          )}
                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 850, color: colors.secondary }}>
                            Μέθοδος: <b>{getMethod(t) || '—'}</b> {isCreditTx(t) ? ' • ⚠️ ΠΙΣΤΩΣΗ' : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 950, color, whiteSpace: 'nowrap' }}>
                          {sign}{moneyGR(amt)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- PRO MODE: Category Breakdown ---------------- */}
        {uiMode === 'pro' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
                <div style={sectionSub}>Κατανομή περιόδου (χωρίς έσοδα και χωρίς πιστώσεις)</div>
              </div>
              <div style={sectionPill}>Σύνολο: {moneyGR(categoryBreakdown.total)}</div>
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
                        <div style={catIconWrap}>
                          <Icon size={18} />
                        </div>
                        <div style={catLabelWrap}>
                          <div style={catLabel}>{c.label}</div>
                        </div>
                      </div>

                      <div style={catMid}>
                        <div style={catPct}>{pct.toFixed(0)}%</div>
                        <div style={catTrack}>
                          <div style={{ ...catFill, width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>

                      <div style={{ ...catValue, color: c.color }}>{moneyGR(val)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- PRO MODE: Staff Payroll (month) ---------------- */}
        {uiMode === 'pro' && printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</h3>
                <div style={sectionSub}>Τρέχων μήνας (γρήγορη εικόνα)</div>
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
                    <div style={{ fontSize: 16, fontWeight: 900, color: colors.sky }}>{moneyGR(s.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- PRO MODE: Movements (collapsed Z) ---------------- */}
        {uiMode === 'pro' && printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
                <div style={sectionSub}>Ζ ως 1 κίνηση/ημέρα + υπόλοιπες με όνομα</div>
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

                  const isInc =
                    t.type === 'income' ||
                    t.type === 'income_collection' ||
                    t.type === 'debt_received' ||
                    t.type === 'savings_withdrawal'
                  const isTip = t.type === 'tip_entry'
                  const isExp = t.type === 'expense' || t.type === 'debt_payment' || t.type === 'savings_deposit'

                  const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                  const pillBg = isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2'
                  const pillBr = isInc ? '#d1fae5' : isTip ? '#fde68a' : '#ffe4e6'
                  const pillTx = isInc ? colors.success : isTip ? '#92400e' : colors.danger

                  const pm = String((t.payment_method ?? t.method ?? '') || '').trim()
                  const credit = isCreditTx(t)
                  const verified = t?.is_verified === true

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow}>
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
        )}

        {/* PRINT MODE SWITCH */}
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

const filterCard: any = {
  marginTop: 12,
  padding: 14,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)',
}

const filtersStack: any = { display: 'flex', flexDirection: 'column', gap: 12 }

const tile: any = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 20,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
}

const tileIcon: any = {
  width: 46,
  height: 46,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#eef2ff',
  border: `1px solid ${colors.border}`,
  fontSize: 18,
  flex: '0 0 46px',
}

const tileBody: any = { flex: 1, minWidth: 0 }
const tileLabel: any = { fontSize: 12, fontWeight: 950, color: colors.secondary, letterSpacing: 0.7, marginBottom: 8, textTransform: 'uppercase' }

const tileControl: any = {
  width: '100%',
  height: 48,
  padding: '0 12px',
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  background: colors.background,
  fontSize: 16,
  fontWeight: 900,
  outline: 'none',
  color: colors.primary,
  appearance: 'none',
  WebkitAppearance: 'none',
}

const rangeHint: any = { marginTop: 2, fontSize: 13, fontWeight: 850, color: colors.secondary }

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

const searchBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  background: colors.indigo,
  color: '#fff',
  border: 'none',
  fontWeight: 950,
  fontSize: 16,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}

const navBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  background: '#fff',
  color: colors.primary,
  border: `1px solid ${colors.border}`,
  fontWeight: 950,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
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