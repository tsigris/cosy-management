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

type FilterA = 'Όλες' | 'Έσοδα' | 'Εμπορεύματα' | 'Προσωπικό' | 'Λογαριασμοί' | 'Συντήρηση' | 'Λοιπά'
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

// --- HELPERS ---
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

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  // States
  const [transactions, setTransactions] = useState<any[]>([])
  const [prevTransactions, setPrevTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [monthTransactions, setMonthTransactions] = useState<any[]>([])
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

  const [printMode, setPrintMode] = useState<PrintMode>('full')
  const [uiMode, setUiMode] = useState<UiMode>('simple')

  const [expectedOutflows30d, setExpectedOutflows30d] = useState<number>(0)

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])
  const norm = useCallback((v: any) => String(v ?? '').trim().toLowerCase(), [])

  // Guard
  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  // Print CSS injection (once)
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
        .print-header { display: block !important; margin-bottom: 10mm; border-bottom: 1px solid #eee; padding-bottom: 5mm; }
        [data-print-section="true"] { break-inside: avoid; page-break-inside: avoid; }
      }
    `
    document.head.appendChild(style)
  }, [])

  const handlePrint = useCallback(() => {
    try {
      window.print()
    } catch (e) {
      console.error(e)
      toast.error('Δεν ήταν δυνατή η εκτύπωση')
    }
  }, [])

  // ✅ Method (bulletproof: supports multiple column names)
  const getMethod = useCallback((t: any) => {
    const m =
      t?.method ??
      t?.payment_method ??
      t?.paymentMethod ??
      t?.payment_method ??
      t?.paymentMethod ??
      ''
    return String(m || '').trim()
  }, [])

  // ✅ Credit detection (canonical)
  const isCreditTx = useCallback(
    (t: any) => {
      if (t?.is_credit === true) return true
      const m = norm(getMethod(t))
      return m === 'πίστωση'
    },
    [getMethod, norm]
  )

  const isCashMethod = useCallback(
    (method: string) => {
      const m = norm(method)
      return m === 'μετρητά' || m === 'μετρητά (z)' || m === 'χωρίς απόδειξη'
    },
    [norm]
  )

  const isBankMethod = useCallback(
    (method: string) => {
      const m = norm(method)
      return m === 'κάρτα' || m === 'τράπεζα'
    },
    [norm]
  )

  // ✅ Signed amount robust
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

  // ✅ Data Loading (with proper ordering + forecast credit filtering)
  const loadData = useCallback(async () => {
    if (!storeId || storeId === 'null') return
    setLoading(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { prevStart, prevEnd } = getPrevRange()

      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const forecastTo = format(addDays(parseISO(endDate), 30), 'yyyy-MM-dd')

      const [
        txRes,
        prevTxRes,
        monthTxRes,
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

        // ✅ Forecast outflows: bring enough fields to exclude credit
        supabase
          .from('transactions')
          .select('amount, type, is_credit, method, payment_method, paymentMethod, date')
          .eq('store_id', storeId)
          .gt('date', endDate)
          .lte('date', forecastTo)
          .in('type', ['expense', 'debt_payment'])
          .order('date', { ascending: true }),
      ])

      if (txRes.error) throw txRes.error
      if (prevTxRes.error) throw prevTxRes.error
      if (monthTxRes.error) throw monthTxRes.error
      if (staffRes.error) throw staffRes.error
      if (supRes.error) throw supRes.error
      if (revRes.error) throw revRes.error
      if (maintRes.error) throw maintRes.error
      if (drawerRes.error) console.warn('v_cash_drawer_today:', drawerRes.error)
      if (expOutRes.error) console.warn('forecast query:', expOutRes.error)

      const tx = txRes.data || []
      const prevTx = prevTxRes.data || []
      const mTx = monthTxRes.data || []

      setTransactions(tx)
      setPrevTransactions(prevTx)
      setMonthTransactions(mTx)
      setStaff(staffRes.data || [])
      setSuppliers(supRes.data || [])
      setRevenueSources(revRes.data || [])
      setMaintenanceWorkers((maintRes.data || []).filter((x: any) => String(x?.name || '').trim().length > 0))
      setDrawer(drawerRes.data || null)

      // ✅ Expected outflows excluding credit
      const out = (expOutRes.data || [])
        .filter((t: any) => !isCreditTx(t))
        .reduce((a: number, t: any) => a + Math.abs(Number(t.amount) || 0), 0)
      setExpectedOutflows30d(out)
    } catch (e) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [storeId, startDate, endDate, getPrevRange, router, isCreditTx])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- FILTER MODE (kept for future expansion) ---
  useEffect(() => {
    let nextMode: DetailMode = 'none'
    if (filterA === 'Προσωπικό') nextMode = 'staff'
    if (filterA === 'Εμπορεύματα') nextMode = 'supplier'
    if (filterA === 'Έσοδα') nextMode = 'revenue_source'
    if (filterA === 'Συντήρηση') nextMode = 'maintenance'
    setDetailMode(nextMode)
    setDetailId('all')
  }, [filterA])

  // --- CATEGORY NORMALIZATION ---
  const normalizeExpenseCategory = useCallback((t: any) => {
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'
    const sub = String(t.fixed_assets?.sub_category || '').toLowerCase()
    if (sub === 'staff') return 'Staff'
    if (sub === 'utility' || sub === 'utilities') return 'Utilities'
    if (sub === 'worker' || sub === 'maintenance') return 'Maintenance'
    return 'Other'
  }, [])

  // ✅ Period rows
  const periodTx = useMemo(
    () => (storeId && storeId !== 'null' ? transactions.filter((t) => t.date >= startDate && t.date <= endDate) : []),
    [transactions, startDate, endDate, storeId]
  )

  // ✅ Previous period rows (safe even if query changes later)
  const prevPeriodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    const { prevStart, prevEnd } = getPrevRange()
    return prevTransactions.filter((t) => t.date >= prevStart && t.date <= prevEnd)
  }, [prevTransactions, storeId, getPrevRange])

  // ✅ Balances calc (cash/bank/credit)
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
          if (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received')
            creditIncoming += Math.abs(amt)
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
    const b = calcBalancesFromRows(periodTx)
    setCalcBalances({ ...b, as_of_date: endDate })
  }, [periodTx, endDate, calcBalancesFromRows])

  // ✅ KPIs (fixed netProfit)
  const computeKpis = useCallback(
    (rows: any[]): Kpis => {
      const rowsNoCredit = rows.filter((t) => !isCreditTx(t))

      const income = rowsNoCredit
        .filter((t) => ['income', 'income_collection', 'debt_received'].includes(t.type))
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)

      const expenses = rowsNoCredit
        .filter((t) => ['expense', 'debt_payment'].includes(t.type))
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      const tips = rowsNoCredit
        .filter((t) => t.type === 'tip_entry')
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      const savingsDeposits = rowsNoCredit
        .filter((t) => t.type === 'savings_deposit')
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      const savingsWithdrawals = rowsNoCredit
        .filter((t) => t.type === 'savings_withdrawal')
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      const netProfit = income - expenses
      return { income, expenses, tips, netProfit, savingsDeposits, savingsWithdrawals }
    },
    [isCreditTx]
  )

  const kpis = useMemo(() => computeKpis(periodTx), [periodTx, computeKpis])
  const kpisPrev = useMemo(() => computeKpis(prevPeriodTx), [prevPeriodTx, computeKpis])

  const variance = useMemo(() => {
    return {
      income: safePctChange(kpis.income, kpisPrev.income),
      expenses: safePctChange(kpis.expenses, kpisPrev.expenses),
      tips: safePctChange(kpis.tips, kpisPrev.tips),
      netProfit: safePctChange(kpis.netProfit, kpisPrev.netProfit),
    }
  }, [kpis, kpisPrev])

  // ✅ Z Breakdown (fixed: only income + category Z, includes POS)
  const zBreakdown = useMemo(() => {
    if (!isZReport) return { zCash: 0, zPos: 0, blackCash: 0, cashExpenses: 0 }

    const rows = periodTx
      .filter((t) => t.type === 'income' && String(t.category || '').trim() === 'Εσοδα Ζ')
      .map((t) => ({
        method: getMethod(t),
        notes: String(t.notes || '').trim(),
        amount: Number(t.amount) || 0,
      }))

    const zCash = rows.filter((r) => r.method === 'Μετρητά (Z)').reduce((a, r) => a + r.amount, 0)
    const zPos = rows.filter((r) => r.method === 'Κάρτα').reduce((a, r) => a + r.amount, 0)

    const blackCash = rows
      .filter(
        (r) =>
          (r.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || r.method === 'Μετρητά' || r.method === 'Χωρίς Απόδειξη') &&
          r.method !== 'Μετρητά (Z)'
      )
      .reduce((a, r) => a + r.amount, 0)

    const cashExpenses = periodTx
      .filter((t) => ['expense', 'debt_payment'].includes(t.type))
      .filter((t) => getMethod(t) === 'Μετρητά')
      .filter((t) => !isCreditTx(t))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    return { zCash, zPos, blackCash, cashExpenses }
  }, [isZReport, periodTx, getMethod, isCreditTx])

  // ✅ Big KPI = business performance (NOT affected by vault)
  const bigKpiValue = useMemo(() => {
    if (isZReport) return zBreakdown.zCash + zBreakdown.blackCash - zBreakdown.cashExpenses
    return kpis.netProfit
  }, [isZReport, zBreakdown, kpis.netProfit])

  // ✅ Physical drawer cash (affected by vault IN/OUT on Z day)
  const totalCashDisplay = useMemo(() => {
    if (isZReport) {
      const vaultIn = periodTx
        .filter((t) => t.type === 'savings_deposit' && getMethod(t) === 'Μετρητά')
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      const vaultOut = periodTx
        .filter((t) => t.type === 'savings_withdrawal' && getMethod(t) === 'Μετρητά')
        .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

      return bigKpiValue - vaultIn + vaultOut
    }

    // For date range: computed cash balance (no credit)
    return Number(calcBalances?.cash_balance || 0)
  }, [isZReport, periodTx, getMethod, bigKpiValue, calcBalances])

  const money = useCallback(
    (n: number) => `${Number(n || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`,
    []
  )

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* PRINT HEADER */}
        <div className="print-header" style={{ display: 'none' }}>
          <div style={{ fontSize: 18, fontWeight: 950, color: '#000' }}>
            {isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: '#374151' }}>
            Περίοδος: {startDate} → {endDate} • Mode: {uiMode === 'simple' ? 'Simple' : 'Pro'}
          </div>
        </div>

        {/* HEADER */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={headerIconBox}>📊</div>
            <div>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ζ' : 'Ανάλυση'}</div>
              <div style={headerSub}>{uiMode === 'simple' ? 'Απλή Εικόνα' : 'Αναλυτικό Dashboard'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setUiMode((m) => (m === 'simple' ? 'pro' : 'simple'))}
              style={headerCircleBtn}
              aria-label="toggle ui mode"
              title="Αλλαγή προβολής"
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

        {/* DATE PICKERS */}
        <div style={filterCard} className="no-print">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={tile}>
              <div style={tileLabel}>ΑΠΟ</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={tileControl} />
            </div>
            <div style={tile}>
              <div style={tileLabel}>ΕΩΣ</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={tileControl} />
            </div>
          </div>

          {/* Optional category filter (kept, but not noisy) */}
          {uiMode === 'pro' && (
            <div style={{ marginTop: 10 }}>
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
          )}
        </div>

        {/* MAIN KPIs */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, borderLeft: `6px solid ${colors.success}` }}>
            <div style={kpiLabel}>
              Έσοδα {uiMode === 'pro' && <span style={kpiDelta}>{fmtPct(variance.income)} vs prev</span>}
            </div>
            <div style={{ ...kpiValue, color: colors.success }}>+{money(kpis.income)}</div>
          </div>

          <div style={{ ...kpiCard, borderLeft: `6px solid ${colors.danger}` }}>
            <div style={kpiLabel}>
              Έξοδα {uiMode === 'pro' && <span style={kpiDelta}>{fmtPct(variance.expenses)} vs prev</span>}
            </div>
            <div style={{ ...kpiValue, color: colors.danger }}>-{money(kpis.expenses)}</div>
          </div>

          <div style={{ ...kpiCard, gridColumn: 'span 2', background: colors.primary, color: '#fff' }}>
            <div style={{ ...kpiLabel, color: '#94a3b8' }}>
              {isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΚΑΘΑΡΟ ΚΕΡΔΟΣ ΠΕΡΙΟΔΟΥ'}{' '}
              {uiMode === 'pro' && <span style={{ ...kpiDelta, color: '#cbd5e1' }}>{fmtPct(variance.netProfit)} vs prev</span>}
            </div>
            <div style={{ ...kpiValue, fontSize: 32, color: '#fff' }}>{money(bigKpiValue)}</div>
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: '#cbd5e1' }}>
              {isZReport ? 'Z + Χωρίς Σήμανση − Έξοδα Μετρητών (χωρίς κουμπαρά)' : 'Έσοδα − Έξοδα (χωρίς Πίστωση)'}
            </div>
          </div>
        </div>

        {/* ✅ OWNER SIMPLE PANEL (Updated with Bank) */}
        {uiMode === 'simple' && (
          <div style={balancesGrid} data-print-section="true">
            <div style={{ ...smallKpiCard, border: '1px solid rgba(139,92,246,0.30)', background: 'linear-gradient(180deg, #f5f3ff, #ffffff)' }}>
              <div style={smallKpiLabel}>Κινήσεις Κουμπαρά</div>
              <div style={{ ...smallKpiValue, color: colors.purple }}>{money(kpis.savingsDeposits - kpis.savingsWithdrawals)}</div>
              <div style={smallKpiHint}>IN: {money(kpis.savingsDeposits)} • OUT: {money(kpis.savingsWithdrawals)}</div>
            </div>

            <div style={smallKpiCard}>
              <div style={smallKpiLabel}>{isZReport ? 'Μετρητά στο Συρτάρι' : 'Υπόλοιπο Μετρητών'}</div>
              <div style={smallKpiValue}>{money(totalCashDisplay)}</div>
              <div style={smallKpiHint}>{isZReport ? 'Φυσικό ποσό (με κουμπαρά)' : `Έως: ${endDate}`}</div>
            </div>

            <div style={smallKpiCard}>
              <div style={smallKpiLabel}>Υπόλοιπο Τράπεζας</div>
              <div style={smallKpiValue}>{money(calcBalances?.bank_balance || 0)}</div>
              <div style={smallKpiHint}>Κάρτα + Τράπεζα (χωρίς Πίστωση)</div>
            </div>

            <div style={{ ...smallKpiCard, border: '1px solid rgba(16,185,129,0.20)', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
              <div style={smallKpiLabel}>Συνολικό Ρευστό</div>
              <div style={{ ...smallKpiValue, color: colors.success }}>{money((calcBalances?.bank_balance || 0) + Number(totalCashDisplay || 0))}</div>
              <div style={smallKpiHint}>Μετρητά + Τράπεζα</div>
            </div>
          </div>
        )}

        {/* CATEGORY BREAKDOWN (PRO ONLY) */}
        {uiMode === 'pro' && (
          <div style={sectionCard} data-print-section="true">
            <h3 style={sectionTitle}>Κατανομή Εξόδων</h3>

            {CATEGORY_META.map((c) => {
              const val = periodTx
                .filter((t) => normalizeExpenseCategory(t) === c.key && ['expense', 'debt_payment'].includes(t.type))
                .filter((t) => !isCreditTx(t))
                .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

              if (val === 0) return null

              return (
                <div
                  key={c.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: c.color,
                        display: 'inline-block',
                      }}
                    />
                    {c.label}
                  </span>
                  <span style={{ color: c.color, fontWeight: 950 }}>{money(val)}</span>
                </div>
              )
            })}

            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: colors.secondary }}>
              * Δεν περιλαμβάνει πιστώσεις.
            </div>
          </div>
        )}

        {/* PRINT ACTIONS */}
        <div className="no-print" style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handlePrint} style={printBtn}>
            <Printer size={18} /> Εκτύπωση Αναφοράς
          </button>

          {uiMode === 'pro' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPrintMode('summary')}
                style={{ ...printModeBtn, ...(printMode === 'summary' ? printModeBtnActive : {}) }}
              >
                Σύνοψη
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('full')}
                style={{ ...printModeBtn, ...(printMode === 'full' ? printModeBtnActive : {}) }}
              >
                Πλήρες
              </button>
            </div>
          )}

          {loading && <div style={{ fontSize: 12, fontWeight: 800, color: colors.secondary }}>Φόρτωση...</div>}
        </div>
      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */

const iphoneWrapper: any = {
  background: '#f8fafc',
  minHeight: '100vh',
  padding: 16,
}

const headerCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderRadius: 24,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
}

const headerIconBox: any = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: colors.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  color: '#fff',
}

const headerTitle: any = { fontSize: 20, fontWeight: 900, color: colors.primary }
const headerSub: any = { fontSize: 12, color: colors.secondary, fontWeight: 700 }

const headerCircleBtn: any = {
  width: 40,
  height: 40,
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  textDecoration: 'none',
  color: colors.primary,
}

const filterCard: any = {
  marginTop: 12,
  padding: 12,
  background: '#fff',
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
}

const tile: any = { display: 'flex', flexDirection: 'column', gap: 4 }

const tileLabel: any = { fontSize: 10, fontWeight: 900, color: colors.secondary, letterSpacing: 0.6 }

const tileControl: any = {
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: 10,
  fontSize: 14,
  fontWeight: 800,
  outline: 'none',
  background: colors.background,
  color: colors.primary,
}

const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }

const kpiCard: any = {
  background: '#fff',
  padding: 16,
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
}

const kpiLabel: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, textTransform: 'uppercase' }
const kpiDelta: any = { marginLeft: 8, fontSize: 11, fontWeight: 900, color: colors.secondary }
const kpiValue: any = { fontSize: 22, fontWeight: 1000, marginTop: 6 }

const balancesGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }

const smallKpiCard: any = {
  background: '#fff',
  padding: 14,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
}

const smallKpiLabel: any = { fontSize: 11, fontWeight: 900, color: colors.secondary, textTransform: 'uppercase' }
const smallKpiValue: any = { fontSize: 18, fontWeight: 950, marginTop: 6, color: colors.primary }
const smallKpiHint: any = { fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 700 }

const sectionCard: any = {
  marginTop: 16,
  background: '#fff',
  padding: 16,
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
}

const sectionTitle: any = { fontSize: 16, fontWeight: 950, marginBottom: 12, color: colors.primary }

const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  background: colors.indigo,
  color: '#fff',
  border: 'none',
  fontWeight: 950,
  fontSize: 16,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

const printModeBtn: any = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontWeight: 950,
  cursor: 'pointer',
}

const printModeBtnActive: any = {
  background: '#111827',
  color: '#fff',
  border: '1px solid #111827',
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Φόρτωση...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}