'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useCallback, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
  Settings,
  Landmark,
  BadgeEuro,
} from 'lucide-react'

/* ---------------- CONFIG ---------------- */

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  warning: '#f59e0b',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1',
  purple: '#7c3aed',
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

type UiMode = 'simple' | 'pro'
type FilterA = 'Όλες' | 'Έσοδα' | 'Εμπορεύματα' | 'Προσωπικό' | 'Λογαριασμοί' | 'Συντήρηση' | 'Λοιπά'
type DetailMode = 'none' | 'staff' | 'supplier' | 'revenue_source' | 'maintenance'

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
function moneyGR(n: any) {
  const v = Number(n || 0)
  return `${v.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

/* ---------------- PAGE ---------------- */

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  // core
  const [loading, setLoading] = useState(true)
  const [uiMode, setUiMode] = useState<UiMode>('simple')

  // period (SIMPLE & PRO share these)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // filter + drilldown
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  // data
  const [transactions, setTransactions] = useState<any[]>([])
  const [prevTransactions, setPrevTransactions] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])
  const [drawer, setDrawer] = useState<any>(null)
  const [calcBalances, setCalcBalances] = useState<CalcBalances | null>(null)
  const [expectedOutflows30d, setExpectedOutflows30d] = useState<number>(0)

  // PRO extras (optional settings fetch)
  const [bizSettings, setBizSettings] = useState<any[]>([])
  const [settingsLoading, setSettingsLoading] = useState(false)

  // movement search (separate from main period)
  const [searchFrom, setSearchFrom] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchTo, setSearchTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [searchRows, setSearchRows] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPage, setSearchPage] = useState(0)
  const SEARCH_PAGE_SIZE = 30

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])
  const rangeText = useMemo(() => `${startDate} → ${endDate}`, [startDate, endDate])

  const norm = useCallback((v: any) => String(v ?? '').trim().toLowerCase(), [])
  const getMethod = useCallback((t: any) => String(t?.method ?? t?.payment_method ?? '').trim(), [])
  const isCreditTx = useCallback(
    (t: any) => t?.is_credit === true || norm(getMethod(t)) === 'πίστωση',
    [getMethod, norm]
  )
  const isCashMethod = useCallback(
    (m: string) => ['μετρητά', 'μετρητά (z)', 'χωρίς απόδειξη'].includes(norm(m)),
    [norm]
  )
  const isBankMethod = useCallback((m: string) => ['κάρτα', 'τράπεζα'].includes(norm(m)), [norm])

  // signed amount for balances
  const signedAmount = useCallback((t: any) => {
    const raw = Number(t.amount) || 0
    if (raw < 0) return raw
    if (t.type === 'expense' || t.type === 'debt_payment' || t.type === 'savings_deposit') return -Math.abs(raw)
    return Math.abs(raw)
  }, [])

  // print css
  useEffect(() => {
    const STYLE_ID = 'analysis-print-css'
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
      @media print {
        @page { size: A4; margin: 12mm; }
        html, body { background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .no-print { display: none !important; }
        [data-print-root="true"] { position: static !important; overflow: visible !important; padding: 0 !important; background: #fff !important; }
        [data-print-root="true"] * { box-shadow: none !important; }
        [data-print-section="true"] { break-inside: avoid; page-break-inside: avoid; }
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

  // drilldown mode
  useEffect(() => {
    const modes: Record<string, DetailMode> = {
      Προσωπικό: 'staff',
      Εμπορεύματα: 'supplier',
      Έσοδα: 'revenue_source',
      Συντήρηση: 'maintenance',
    }
    setDetailMode(modes[filterA] || 'none')
    setDetailId('all')
  }, [filterA])

  // normalize expense category (for filters & breakdown)
  const normalizeExpenseCategory = useCallback((t: any) => {
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'
    const sub = String(t.fixed_assets?.sub_category || '').trim().toLowerCase()
    if (sub === 'staff') return 'Staff'
    if (sub === 'utility' || sub === 'utilities' || sub.includes('utility')) return 'Utilities'
    if (sub === 'worker' || sub === 'maintenance' || sub === 'maintenancE'.toLowerCase()) return 'Maintenance'
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

  const getPrevRange = useCallback(() => {
    const s = parseISO(startDate)
    const e = parseISO(endDate)
    const days = Math.max(0, differenceInCalendarDays(e, s))
    const prevEnd = subDays(s, 1)
    const prevStart = subDays(prevEnd, days)
    return { prevStart: format(prevStart, 'yyyy-MM-dd'), prevEnd: format(prevEnd, 'yyyy-MM-dd') }
  }, [startDate, endDate])

  // fetch main data
  const loadData = useCallback(async () => {
    if (!storeId || storeId === 'null') return

    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getSession()
      if (!auth?.session) {
        router.push('/login')
        return
      }

      const { prevStart, prevEnd } = getPrevRange()
      const forecastTo = format(addDays(parseISO(endDate), 30), 'yyyy-MM-dd')

      const [
        tx,
        prevTx,
        staffD,
        supD,
        revD,
        maintD,
        drawerD,
        expOut,
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
          .select('amount, type, is_credit, method, payment_method, category, notes, date, supplier_id, fixed_asset_id, revenue_source_id, suppliers(id,name), fixed_assets(id,name,sub_category), revenue_sources(id,name)')
          .eq('store_id', storeId)
          .gte('date', prevStart)
          .lte('date', prevEnd),

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
          .in('sub_category', ['worker', 'maintenance', 'Maintenance'])
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
          .select('amount, type, is_credit, method, payment_method, date, category, notes')
          .eq('store_id', storeId)
          .gt('date', endDate)
          .lte('date', forecastTo)
          .in('type', ['expense', 'debt_payment'])
          .order('date', { ascending: true }),
      ])

      const txRows = tx.data || []
      const prevRows = prevTx.data || []

      setTransactions(txRows)
      setPrevTransactions(prevRows)
      setStaff(staffD.data || [])
      setSuppliers(supD.data || [])
      setRevenueSources(revD.data || [])
      setMaintenanceWorkers((maintD.data || []).filter((x: any) => String(x?.name || '').trim().length > 0))
      setDrawer(drawerD.data || null)

      const out = (expOut.data || [])
        .filter((t: any) => !isCreditTx(t))
        .reduce((a: number, t: any) => a + Math.abs(Number(t.amount) || 0), 0)
      setExpectedOutflows30d(out)
    } catch (e) {
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [storeId, router, startDate, endDate, getPrevRange, isCreditTx])

  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
      return
    }
    loadData()
  }, [storeId, router, loadData])

  // optional settings (only for PRO display)
  const loadSettings = useCallback(async () => {
    if (!storeId || storeId === 'null') return
    setSettingsLoading(true)
    try {
      // if table doesn't exist, it will error; we just ignore
      const res = await supabase
        .from('business_settings')
        .select('key, value_json, updated_at')
        .eq('store_id', storeId)
        .order('updated_at', { ascending: false })
        .limit(30)

      if (res.error) throw res.error
      setBizSettings(res.data || [])
    } catch {
      setBizSettings([])
    } finally {
      setSettingsLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    if (uiMode === 'pro') loadSettings()
  }, [uiMode, loadSettings])

  // base period rows (already filtered by query, but keep safe)
  const periodTx = useMemo(
    () => transactions.filter((t) => String(t.date) >= startDate && String(t.date) <= endDate),
    [transactions, startDate, endDate]
  )

  // calc balances from rows (cash/bank/credit)
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

  // filtered rows for KPI & breakdown (respects filterA + detail)
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

  // KPIs (no credit)
  const computeKpis = useCallback(
    (rows: any[]): Kpis => {
      const rowsNoCredit = rows.filter((t) => !isCreditTx(t))

      const income = rowsNoCredit
        .filter((t) => ['income', 'income_collection', 'debt_received'].includes(t.type))
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

  const { prevStart, prevEnd } = useMemo(() => getPrevRange(), [getPrevRange])
  const prevPeriodTx = useMemo(
    () => prevTransactions.filter((t) => String(t.date) >= prevStart && String(t.date) <= prevEnd),
    [prevTransactions, prevStart, prevEnd]
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

  // -------- Z BREAKDOWN (Fix σύμφωνα με αυτά που ζήτησες) --------
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

    // Z CASH: method === 'Μετρητά (Z)'
    const zCash = rows.filter((r) => r.method === 'Μετρητά (Z)').reduce((a, r) => a + r.amount, 0)

    // Z POS: method === 'Κάρτα'
    const zPos = rows.filter((r) => r.method === 'Κάρτα').reduce((a, r) => a + r.amount, 0)

    // BLACK CASH: category === 'Εσοδα Ζ' AND (notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' OR method === 'Μετρητά' OR method === 'Χωρίς Απόδειξη') BUT NOT method === 'Μετρητά (Z)'
    const blackCash = rows
      .filter(
        (r) =>
          r.method !== 'Μετρητά (Z)' &&
          (r.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || r.method === 'Μετρητά' || r.method === 'Χωρίς Απόδειξη')
      )
      .reduce((a, r) => a + r.amount, 0)

    const totalTurnover = zCash + zPos + blackCash
    return { zCash, zPos, blackCash, totalTurnover, blackPct: totalTurnover > 0 ? (blackCash / totalTurnover) * 100 : 0 }
  }, [isZReport, periodTx, getMethod])

  const cashExpensesToday = useMemo(() => {
    if (!isZReport) return 0
    // cash expenses today = expense/debt_payment with method 'Μετρητά' (NOT credit)
    return periodTx
      .filter((t) => ['expense', 'debt_payment'].includes(t.type))
      .filter((t) => getMethod(t) === 'Μετρητά')
      .filter((t) => !isCreditTx(t))
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
  }, [isZReport, periodTx, getMethod, isCreditTx])

  // big KPI: Z day or netProfit for range
  const bigKpiValue = useMemo(() => {
    return isZReport ? (zBreakdown.zCash + zBreakdown.blackCash - cashExpensesToday) : kpis.netProfit
  }, [isZReport, zBreakdown, cashExpensesToday, kpis.netProfit])

  // total cash display: for Z = (zCash + blackCash) - cashExpenses - cash vault deposits + cash vault withdrawals
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
  }, [isZReport, periodTx, getMethod, calcBalances, bigKpiValue])

  // collapsed Z in list (for PRO list)
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
        payment_method: 'Z (Σύνολο)',
        notes: `Μετρητά (Z): ${moneyGR(zCash)} • Κάρτα (POS): ${moneyGR(zPos)} • Χωρίς Σήμανση: ${moneyGR(withoutMarking)}`,
        __collapsedZ: true,
      }
    })

    return [...others, ...collapsedZ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [filteredTx, getMethod])

  // drilldown options
  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  // party display
  const getPartyName = useCallback(
    (t: any) => {
      if (t.type === 'savings_deposit') return 'ΚΑΤΑΘΕΣΗ ΣΕ ΚΟΥΜΠΑΡΑ'
      if (t.type === 'savings_withdrawal') return 'ΑΝΑΛΗΨΗ ΑΠΟ ΚΟΥΜΠΑΡΑ'

      if (t.revenue_source_id || t.revenue_sources?.name) {
        return (
          t.revenue_sources?.name ||
          revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))?.name ||
          'Πηγή Εσόδων'
        )
      }
      if (String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff') {
        return t.fixed_assets?.name || staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Υπάλληλος'
      }
      if (t.suppliers?.name || t.supplier_id) {
        return t.suppliers?.name || suppliers.find((s) => String(s.id) === String(t.supplier_id))?.name || 'Προμηθευτής'
      }
      if (t.fixed_asset_id) {
        return (
          t.fixed_assets?.name ||
          maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))?.name ||
          t.category ||
          '-'
        )
      }
      if (t.type === 'tip_entry') {
        return staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Tips'
      }
      return t.category || t.notes || 'Κίνηση'
    },
    [staff, suppliers, revenueSources, maintenanceWorkers]
  )

  // ---------------- SIMPLE BREAKDOWN (αντί για χιλιάδες κινήσεις) ----------------
  const simpleBreakdown = useMemo(() => {
    // only expenses (and debt_payment) for expense categories, but for "Έσοδα" show incomes by revenue source
    const rowsNoCredit = filteredTx.filter((t) => !isCreditTx(t))

    // decide grouping label
    const groupMode: 'supplier' | 'staff' | 'maintenance' | 'utilities' | 'revenue' | 'other' | 'all' = (() => {
      if (filterA === 'Εμπορεύματα') return 'supplier'
      if (filterA === 'Προσωπικό') return 'staff'
      if (filterA === 'Συντήρηση') return 'maintenance'
      if (filterA === 'Λογαριασμοί') return 'utilities'
      if (filterA === 'Έσοδα') return 'revenue'
      if (filterA === 'Λοιπά') return 'other'
      return 'all'
    })()

    const map: Record<string, { label: string; amount: number; count: number }> = {}

    const add = (key: string, label: string, amount: number) => {
      if (!map[key]) map[key] = { label, amount: 0, count: 0 }
      map[key].amount += amount
      map[key].count += 1
    }

    for (const t of rowsNoCredit) {
      const amt = Math.abs(Number(t.amount) || 0)

      if (groupMode === 'revenue') {
        if (!['income', 'income_collection', 'debt_received'].includes(t.type)) continue
        const label = t.revenue_sources?.name || revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))?.name || 'Άλλη Πηγή'
        add(String(t.revenue_source_id || label), label, amt)
        continue
      }

      // expense side
      if (!['expense', 'debt_payment'].includes(t.type)) continue

      if (groupMode === 'supplier') {
        const label = t.suppliers?.name || suppliers.find((s) => String(s.id) === String(t.supplier_id))?.name || 'Άγνωστος Προμηθευτής'
        add(String(t.supplier_id || label), label, amt)
        continue
      }

      if (groupMode === 'staff') {
        const label = t.fixed_assets?.name || staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Άγνωστος Υπάλληλος'
        add(String(t.fixed_asset_id || label), label, amt)
        continue
      }

      if (groupMode === 'maintenance') {
        const label =
          t.fixed_assets?.name ||
          maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))?.name ||
          'Συντήρηση'
        add(String(t.fixed_asset_id || label), label, amt)
        continue
      }

      if (groupMode === 'utilities') {
        // prefer category/notes as utility label
        const label = String(t.category || '').trim() || String(t.notes || '').trim() || 'Λογαριασμός'
        add(label, label, amt)
        continue
      }

      if (groupMode === 'other') {
        const label = String(t.category || '').trim() || String(t.notes || '').trim() || 'Λοιπά'
        add(label, label, amt)
        continue
      }

      // all
      const catKey = normalizeExpenseCategory(t)
      const metaLabel = CATEGORY_META.find((c) => c.key === catKey)?.label || 'Λοιπά'
      add(catKey, metaLabel, amt)
    }

    const rows = Object.values(map).sort((a, b) => b.amount - a.amount)
    const total = rows.reduce((a, r) => a + r.amount, 0)
    return { rows, total, groupMode }
  }, [filteredTx, filterA, isCreditTx, suppliers, staff, maintenanceWorkers, revenueSources, normalizeExpenseCategory])

  // ---------------- PRO: category breakdown ----------------
  const categoryBreakdown = useMemo(() => {
    const expenseTx = filteredTx
      .filter((t) => ['expense', 'debt_payment'].includes(t.type))
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

  // ---------------- PRO: loans control (quick approach χωρίς νέους πίνακες) ----------------
  const loanControl = useMemo(() => {
    // Heuristic: loan payments recorded as expense/debt_payment with category or notes containing ΔΑΝΕ / LOAN / ΔΟΣΗ
    const rowsNoCredit = periodTx.filter((t) => !isCreditTx(t))
    const isLoan = (t: any) => {
      const cat = String(t.category || '').toLowerCase()
      const notes = String(t.notes || '').toLowerCase()
      return cat.includes('δάνει') || cat.includes('loan') || notes.includes('δάνει') || notes.includes('loan') || notes.includes('δόση')
    }

    const period = rowsNoCredit
      .filter((t) => ['expense', 'debt_payment'].includes(t.type))
      .filter(isLoan)

    const total = period.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    // next 30d loans from already-entered future expenses (expected outflows query already computed, but not categorized)
    // We'll compute upcoming loans using a lightweight query on demand is heavy; keep it simple: infer from current period only.
    // Show “Σύνολο Δόσεων Περιόδου” + “Top notes”.
    const byLabel: Record<string, number> = {}
    for (const t of period) {
      const label = String(t.notes || t.category || 'Δάνειο').trim() || 'Δάνειο'
      byLabel[label] = (byLabel[label] || 0) + Math.abs(Number(t.amount) || 0)
    }
    const rows = Object.entries(byLabel)
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)

    return { total, rows, count: period.length }
  }, [periodTx, isCreditTx])

  // ---------------- Movement Search (separate range) ----------------
  const runSearch = useCallback(
    async (page: number) => {
      if (!storeId || storeId === 'null') return
      setSearchLoading(true)
      try {
        const from = Math.max(0, page) * SEARCH_PAGE_SIZE
        const to = from + SEARCH_PAGE_SIZE - 1

        const res = await supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
          .eq('store_id', storeId)
          .gte('date', searchFrom)
          .lte('date', searchTo)
          .order('date', { ascending: false })
          .range(from, to)

        if (res.error) throw res.error

        setSearchRows(res.data || [])
        setSearchPage(page)
      } catch {
        toast.error('Σφάλμα αναζήτησης κινήσεων')
      } finally {
        setSearchLoading(false)
      }
    },
    [storeId, searchFrom, searchTo]
  )

  // Default search range = today (already set). Keep independent.

  /* ---------------- UI ---------------- */

  const drawerZCash = isZReport ? zBreakdown.zCash : Number(drawer?.z_cash || 0)
  const drawerWithoutMarking = isZReport ? zBreakdown.blackCash : Number(drawer?.extra_cash || 0)

  const simpleBreakdownTitle = useMemo(() => {
    if (filterA === 'Εμπορεύματα') return 'Έξοδα ανά Προμηθευτή'
    if (filterA === 'Προσωπικό') return 'Έξοδα ανά Υπάλληλο'
    if (filterA === 'Συντήρηση') return 'Έξοδα ανά Συντήρηση'
    if (filterA === 'Λογαριασμοί') return 'Έξοδα ανά Λογαριασμό'
    if (filterA === 'Έσοδα') return 'Έσοδα ανά Πηγή'
    if (filterA === 'Λοιπά') return 'Λοιπά έξοδα (ανά κατηγορία)'
    return 'Σύνοψη εξόδων (ανά κατηγορία)'
  }, [filterA])

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={headerIconBox}>📊</div>
            <div style={{ minWidth: 0 }}>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
              <div style={headerSub}>
                {uiMode === 'simple' ? 'SIMPLE (Καθαρή εικόνα)' : 'PRO (Πλήρες Dashboard)'} • {rangeText}
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

            <button type="button" onClick={handlePrint} style={headerCircleBtn} aria-label="print" title="Εκτύπωση">
              <Printer size={18} />
            </button>

            <Link href={`/?store=${storeId}`} style={headerCircleBtn as any} aria-label="close" title="Κλείσιμο">
              ✕
            </Link>
          </div>
        </div>

        {/* SIMPLE TOP: Από/Έως ΠΑΝΤΑ ΠΑΝΩ */}
        <div style={topDateCard} className="no-print">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={tile}>
              <div style={tileLabel}>ΑΠΟ</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={tileControl} />
            </div>
            <div style={tile}>
              <div style={tileLabel}>ΕΩΣ</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={tileControl} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={tileLabel}>ΦΙΛΤΡΟ</div>
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

          {detailMode !== 'none' && (
            <div style={{ marginTop: 12 }}>
              <div style={tileLabel}>ΛΕΠΤΟΜΕΡΕΙΑ</div>
              <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={tileControl}>
                <option value="all">Όλοι</option>
                {detailOptions.map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* KPI GRID (both modes, but PRO shows extra context cards below) */}
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
              <div style={{ ...kpiFill, width: '70%', background: colors.warning }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#111827', background: 'linear-gradient(180deg, #0b1220, #111827)', color: '#fff' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#fff' }}>
                {isZReport ? 'Καθαρό Ταμείο Ημέρας (Z)' : 'Καθαρό Κέρδος'}{' '}
                <span style={{ ...kpiDelta, color: '#e5e7eb' }}>{fmtPct(variance.netProfit)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: '#fff' }}>{bigKpiValue >= 0 ? '▲' : '▼'}</div>
            </div>
            <div style={{ ...kpiValue, color: '#fff' }}>{moneyGR(bigKpiValue)}</div>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginTop: 6 }}>
              {isZReport
                ? 'Μετρητά (Z) + Χωρίς Σήμανση - Έξοδα Μετρητών'
                : 'Έσοδα - Έξοδα (χωρίς Πίστωση)'}
            </div>
          </div>
        </div>

        {/* BALANCES GRID (both modes) */}
        <div style={balancesGrid} data-print-section="true">
          <div style={{ ...smallKpiCard, border: '1px solid rgba(139,92,246,0.30)', background: 'linear-gradient(180deg, #f5f3ff, #ffffff)' }}>
            <div style={smallKpiLabel}>Κουμπαράς</div>
            <div style={{ ...smallKpiValue, color: colors.purple }}>
              {moneyGR(kpis.savingsDeposits - kpis.savingsWithdrawals)}
            </div>
            <div style={smallKpiHint}>
              (+) {moneyGR(kpis.savingsDeposits)} • (-) {moneyGR(kpis.savingsWithdrawals)}
            </div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>{isZReport ? 'Μετρητά στο Συρτάρι' : 'Υπόλοιπο Μετρητών'}</div>
            <div style={smallKpiValue}>{moneyGR(totalCashDisplay)}</div>
            <div style={smallKpiHint}>{isZReport ? 'Business cash (σωστό)' : `As of: ${endDate} (χωρίς Πίστωση)`}</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Τράπεζα</div>
            <div style={smallKpiValue}>{moneyGR(calcBalances?.bank_balance || 0)}</div>
            <div style={smallKpiHint}>Κάρτα + Τράπεζα (χωρίς Πίστωση)</div>
          </div>

          <div style={{ ...smallKpiCard, border: '1px solid rgba(16,185,129,0.22)', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
            <div style={smallKpiLabel}>Σύνολο Ρευστό</div>
            <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(calcBalances?.total_balance || 0)}</div>
            <div style={smallKpiHint}>Cash + Bank (χωρίς Πίστωση)</div>
          </div>

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
                <div style={smallKpiHint}>Μελλοντικά έξοδα (future dated) • Χωρίς Πίστωση</div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>Ταμείο Ημέρας (Z view)</div>
                <div style={smallKpiValue}>{drawer ? moneyGR(drawer.total_cash_drawer) : '—'}</div>
                <div style={smallKpiHint}>{drawer ? `Ημερομηνία Ζ: ${drawer.date}` : `Δεν βρέθηκε Ζ έως: ${endDate}`}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginTop: 6 }}>
                  {drawer || isZReport ? `Z: ${moneyGR(drawerZCash)} • Χωρίς Σήμανση: ${moneyGR(drawerWithoutMarking)}` : ''}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SIMPLE MODE: Breakdown card (αντί για κινήσεις) */}
        {uiMode === 'simple' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>{simpleBreakdownTitle}</h3>
                <div style={sectionSub}>
                  Περίοδος: {rangeText} • Χωρίς Πίστωση
                </div>
              </div>
              <div style={sectionPill}>Σύνολο: {moneyGR(simpleBreakdown.total)}</div>
            </div>

            {loading ? (
              <div style={hintBox}>Φόρτωση…</div>
            ) : simpleBreakdown.rows.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν δεδομένα για το φίλτρο/περίοδο που επέλεξες.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {simpleBreakdown.rows.slice(0, 12).map((r) => (
                  <div key={r.label} style={rowItem}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {String(r.label || '').toUpperCase()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, marginTop: 4 }}>
                        {r.count} εγγραφές
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 950, color: colors.danger }}>{moneyGR(r.amount)}</div>
                  </div>
                ))}

                {simpleBreakdown.rows.length > 12 && (
                  <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, textAlign: 'center', marginTop: 6 }}>
                    Εμφανίζονται οι 12 μεγαλύτερες εγγραφές. (Στο PRO βλέπεις αναλυτικά τα πάντα.)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SIMPLE: Movement Search με δικό του Από/Έως + pagination */}
        <div style={sectionCard} className="no-print">
          <div style={sectionTitleRow}>
            <div>
              <h3 style={sectionTitle}>Αναζήτηση Κινήσεων</h3>
              <div style={sectionSub}>Ψάξε συγκεκριμένη μέρα/περίοδο χωρίς να φορτώνονται χιλιάδες κινήσεις</div>
            </div>
            <div style={sectionPill}>{SEARCH_PAGE_SIZE}/σελίδα</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={tile}>
              <div style={tileLabel}>ΑΠΟ</div>
              <input type="date" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} style={tileControl} />
            </div>
            <div style={tile}>
              <div style={tileLabel}>ΕΩΣ</div>
              <input type="date" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} style={tileControl} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => runSearch(0)}
              style={primaryBtn}
              disabled={searchLoading}
            >
              <Search size={18} />
              {searchLoading ? 'Αναζήτηση…' : 'Αναζήτηση'}
            </button>

            <button
              type="button"
              onClick={() => runSearch(Math.max(0, searchPage - 1))}
              style={ghostBtn}
              disabled={searchLoading || searchPage === 0}
              title="Προηγούμενη"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={() => runSearch(searchPage + 1)}
              style={ghostBtn}
              disabled={searchLoading}
              title="Επόμενη"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {searchLoading ? (
              <div style={hintBox}>Φόρτωση αποτελεσμάτων…</div>
            ) : searchRows.length === 0 ? (
              <div style={hintBox}>Δεν έχεις τρέξει αναζήτηση ή δεν βρέθηκαν κινήσεις.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {searchRows.map((t: any) => {
                  const amt = Math.abs(Number(t.amount) || 0)
                  const isInc = ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type)
                  const isTip = t.type === 'tip_entry'
                  const isExp = ['expense', 'debt_payment', 'savings_deposit'].includes(t.type)
                  const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                  const color = isInc ? colors.success : isTip ? colors.warning : colors.danger

                  return (
                    <div key={t.id} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary }}>
                            {t.date} • {getMethod(t) || '-'}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(getPartyName(t) || '').toUpperCase()}
                          </div>
                          {!!t.notes && (
                            <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 4 }}>
                              {t.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 950, color, whiteSpace: 'nowrap' }}>
                          {sign}
                          {moneyGR(amt)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- PRO MODE: “τα πάντα” ---------------- */}
        {uiMode === 'pro' && (
          <>
            {/* PRO: Expense category breakdown */}
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

            {/* PRO: Loans control */}
            <div style={sectionCard} data-print-section="true">
              <div style={sectionTitleRow}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={miniIconBubble}><Landmark size={18} /></div>
                  <div>
                    <h3 style={sectionTitle}>Έλεγχος Δανείων</h3>
                    <div style={sectionSub}>Γρήγορη παρακολούθηση (με βάση category/notes που περιέχουν “Δάνειο / Δόση / Loan”)</div>
                  </div>
                </div>
                <div style={sectionPill}>{loanControl.count} κινήσεις</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={smallKpiCard}>
                  <div style={smallKpiLabel}>Σύνολο Δόσεων Περιόδου</div>
                  <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(loanControl.total)}</div>
                  <div style={smallKpiHint}>Περίοδος: {rangeText}</div>
                </div>
                <div style={smallKpiCard}>
                  <div style={smallKpiLabel}>Expected Outflows (30d)</div>
                  <div style={{ ...smallKpiValue, color: colors.indigo }}>{moneyGR(expectedOutflows30d)}</div>
                  <div style={smallKpiHint}>Όλα τα future expenses/debt_payment (χωρίς πίστωση)</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {loanControl.rows.length === 0 ? (
                  <div style={hintBox}>Δεν βρέθηκαν δόσεις δανείου στην περίοδο (βάλε category/notes π.χ. “Δάνειο Scudo”, “Δόση δανείου”).</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loanControl.rows.slice(0, 10).map((r) => (
                      <div key={r.label} style={rowItem}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {String(r.label || '').toUpperCase()}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 950, color: colors.danger }}>{moneyGR(r.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* PRO: Settings card (optional from business_settings table) */}
            <div style={sectionCard} data-print-section="true">
              <div style={sectionTitleRow}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={miniIconBubble}><Settings size={18} /></div>
                  <div>
                    <h3 style={sectionTitle}>Ρυθμίσεις (PRO)</h3>
                    <div style={sectionSub}>Κανόνες που χρησιμοποιεί η αναφορά (Z, κουμπαράς, πίστωση, κ.λπ.)</div>
                  </div>
                </div>
                <div style={sectionPill}>{settingsLoading ? '…' : `${bizSettings.length} keys`}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={hintBox}>
                  <b>Κανόνες Z που εφαρμόζονται:</b>
                  <br />• Z Cash = method “Μετρητά (Z)”
                  <br />• Z POS = method “Κάρτα”
                  <br />• Black = category “Εσοδα Ζ” + (notes “ΧΩΡΙΣ ΣΗΜΑΝΣΗ” ή method “Μετρητά/Χωρίς Απόδειξη”) χωρίς “Μετρητά (Z)”
                  <br />• Ταμείο ημέρας = (Z Cash + Black) - Έξοδα Μετρητών
                  <br />• Συρτάρι = Ταμείο ημέρας - Καταθέσεις κουμπαρά (Μετρητά) + Αναλήψεις κουμπαρά (Μετρητά)
                </div>

                <div style={hintBox}>
                  <b>Κανόνας Πίστωσης:</b> Ό,τι έχει method “Πίστωση” ή is_credit=true δεν επηρεάζει Cash/Bank ισοζύγια και εμφανίζεται ξεχωριστά στο PRO.
                </div>

                {bizSettings.length > 0 ? (
                  <div style={{ padding: 14, borderRadius: 16, border: `1px solid ${colors.border}`, background: '#fff' }}>
                    <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary, marginBottom: 10 }}>Business Settings (από βάση)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {bizSettings.slice(0, 8).map((s: any, idx: number) => (
                        <div key={`${s.key}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: colors.secondary, minWidth: 120 }}>{s.key}</div>
                          <div style={{ fontSize: 12, fontWeight: 850, color: colors.primary, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {typeof s.value_json === 'string' ? s.value_json : JSON.stringify(s.value_json)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {bizSettings.length > 8 && (
                      <div style={{ fontSize: 12, fontWeight: 850, color: colors.secondary, marginTop: 10 }}>
                        (Εμφανίζονται τα 8 πρώτα)
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={hintBox}>
                    Δεν βρέθηκαν settings από πίνακα <b>business_settings</b>. (Αν δεν τον έχεις, είναι ΟΚ — το PRO δείχνει ήδη τους κανόνες που εφαρμόζονται.)
                  </div>
                )}
              </div>
            </div>

            {/* PRO: Full movements list (collapsed Z) */}
            <div style={sectionCard} data-print-section="true">
              <div style={sectionTitleRow}>
                <div>
                  <h3 style={sectionTitle}>Κινήσεις Περιόδου (PRO)</h3>
                  <div style={sectionSub}>Με collapse του Ζ σε 1 κίνηση ανά ημέρα</div>
                </div>
                <div style={sectionPill}>{collapsedPeriodList.length} εγγραφές</div>
              </div>

              {loading ? (
                <div style={hintBox}>Φόρτωση…</div>
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

                    const pm = String((t.payment_method ?? t.method ?? '') || '').trim()
                    const credit = isCreditTx(t)

                    return (
                      <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap' }}>{t.date}</div>
                            <div style={{ padding: '8px 12px', borderRadius: 999, backgroundColor: pillBg, border: `1px solid ${pillBr}`, fontSize: 16, fontWeight: 950, color: pillTx, whiteSpace: 'nowrap' }}>
                              {sign}
                              {moneyGR(absAmt)}
                            </div>
                          </div>

                          <div style={{ fontSize: 16, fontWeight: 950, color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {String(name || '').toUpperCase()}
                          </div>

                          {!!t.notes && <div style={{ fontSize: 13, fontWeight: 850, color: colors.secondary }}>{t.notes}</div>}
                          {!!pm && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 850, color: colors.secondary }}>
                              <span style={{ fontWeight: 950 }}>Μέθοδος:</span> {pm}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {credit && <span style={{ fontSize: 12, fontWeight: 950, color: colors.danger }}>⚠️ ΠΙΣΤΩΣΗ</span>}
                            {isCollapsedZ && <span style={{ fontSize: 12, fontWeight: 950, color: colors.indigo }}>📌 COLLAPSED Z</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* bottom print shortcut */}
        <div className="no-print" style={{ marginTop: 18 }}>
          <button type="button" onClick={handlePrint} style={printBtn}>
            <Printer size={18} /> Εκτύπωση Αναφοράς
          </button>
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
const headerSub: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, letterSpacing: 0.4, marginTop: 4 }

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

const topDateCard: any = {
  marginTop: 12,
  padding: 14,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)',
}

const tile: any = { display: 'flex', flexDirection: 'column', gap: 8 }
const tileLabel: any = { fontSize: 12, fontWeight: 950, color: colors.secondary, letterSpacing: 0.7, textTransform: 'uppercase' }
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

const rowItem: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }
const listRow: any = { padding: 14, borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }

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

const primaryBtn: any = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 950,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}

const ghostBtn: any = {
  width: 52,
  height: 52,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
}

const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 950,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}

const miniIconBubble: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

/* ---------------- EXPORT ---------------- */

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση…</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}