'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback, useRef } from 'react'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
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

type AnalysisRpcSummary = {
  income: number
  expenses: number
  tips: number
  net_profit: number
  cash_balance: number
  bank_balance: number
  total_balance: number
  credit_outstanding: number
  credit_incoming: number
  savings_deposits: number
  savings_withdrawals: number
}

/* ---------------- HELPERS ---------------- */

function fmtPct(p: number | null) {
  if (p === null) return '—'
  const sign = p >= 0 ? '+' : ''
  return `${sign}${p.toFixed(0)}%`
}

function moneyGR(n: any) {
  const v = Number(n || 0)
  return `${v.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

function formatDateGreek(date: string | Date) {
  const d = new Date(date as any)
  if (isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}
function getPaymentMethod(tx: any): string {
  return String(tx?.payment_method ?? tx?.method ?? '').trim()
}

function AnalysisContent({ embeddedInEconomics = false }: { embeddedInEconomics?: boolean }) {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  /* ---------------- STATE ---------------- */

  const [uiMode, setUiMode] = useState<UiMode>('simple')
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])
  const [periodMovements, setPeriodMovements] = useState<any[]>([])
  const [collapsedZRows, setCollapsedZRows] = useState<Array<{
    date: string
    cash_z: number
    card_z: number
    total_z: number
  }>>([])

  const [drawer, setDrawer] = useState<any>(null)

  const [categoryBreakdownRows, setCategoryBreakdownRows] = useState<{ category_key: string; total: number }[]>([])
  const [categoryBreakdownReady, setCategoryBreakdownReady] = useState(false)
  const [entitySummaryRows, setEntitySummaryRows] = useState<{ entity_id: string; entity_name: string; total: number; paid: number; credit: number }[]>([])
  const [entitySummaryReady, setEntitySummaryReady] = useState(false)
  const [staffPayrollRows, setStaffPayrollRows] = useState<{ name: string; amount: number }[]>([])
  const [staffPayrollReady, setStaffPayrollReady] = useState(false)
  const [proStats, setProStats] = useState<any>(null)
  const [detailSummary, setDetailSummary] = useState<any>(null)
  const detailSummaryRequestIdRef = useRef(0)
  const [collapsedZReady, setCollapsedZReady] = useState(false)
  const [periodMovementsReady, setPeriodMovementsReady] = useState(false)
  const [zBankAmount, setZBankAmount] = useState(0)
  const [rpcSummary, setRpcSummary] = useState<AnalysisRpcSummary>({
    income: 0,
    expenses: 0,
    tips: 0,
    net_profit: 0,
    cash_balance: 0,
    bank_balance: 0,
    total_balance: 0,
    credit_outstanding: 0,
    credit_incoming: 0,
    savings_deposits: 0,
    savings_withdrawals: 0,
  })

  // Global period (used for KPI summary)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // Period selector to match other economics pages
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    return [y, y - 1, y - 2]
  }, [])

  useEffect(() => {
    if (period === 'month') {
      setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
      setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
    } else if (period === 'year') {
      setStartDate(`${selectedYear}-01-01`)
      setEndDate(`${selectedYear}-12-31`)
    } else if (period === '30days') {
      const d = subDays(new Date(), 30)
      setStartDate(format(d, 'yyyy-MM-dd'))
      setEndDate(format(new Date(), 'yyyy-MM-dd'))
    } else if (period === 'all') {
      // Use a safe early date instead of '0000-01-01' which Postgres rejects.
      // We'll also avoid applying date filters to Supabase queries when period === 'all'.
      setStartDate('1970-01-01')
      setEndDate('9999-12-31')
    }
  }, [period, selectedYear])

  // Simple: drilldown filter
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  const [expectedOutflows30d, setExpectedOutflows30d] = useState<number>(0)

  const [authChecked, setAuthChecked] = useState(false)
  const [hasSession, setHasSession] = useState(false)

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
  const getMethod = useCallback((t: any) => getPaymentMethod(t), [])

  const isCreditTx = useCallback(
    (t: any) => {
      if (t?.is_credit === true) return true
      return norm(getMethod(t)) === 'πίστωση'
    },
    [getMethod, norm]
  )

  /* ---------------- PRINT CSS ---------------- */

  useEffect(() => {
    const STYLE_ID = 'analysis-print-css'
    if (document.getElementById(STYLE_ID)) return

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
      @media print {
        @page { size: A4; margin: 12mm; }
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print,
        nav,
        [style*="position: fixed"][style*="bottom: 0"] {
          display: none !important;
          visibility: hidden !important;
        }
        a { text-decoration: none !important; color: #000 !important; }
        [data-print-root="true"] {
          position: static !important;
          overflow: visible !important;
          padding: 0 !important;
          background: #fff !important;
        }
        [data-print-root="true"] > div {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding-bottom: 0 !important;
        }
        [data-print-root="true"] * {
          box-shadow: none !important;
          text-shadow: none !important;
          color: #000 !important;
        }
        [data-print-section="true"],
        .print-card,
        .print-table-wrap,
        .kpi-grid-print > div,
        .balances-grid-print > div {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          border-radius: 0 !important;
          background: #fff !important;
          background-image: none !important;
          border-color: #d1d5db !important;
        }
        .kpi-grid-print,
        .balances-grid-print {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        .kpi-grid-print > div,
        .balances-grid-print > div {
          padding: 10px !important;
        }
        .print-header {
          display: block !important;
          margin: 0 0 8mm 0 !important;
          padding-bottom: 4mm !important;
          border-bottom: 1px solid #9ca3af !important;
        }
        .print-title {
          font-size: 18px !important;
          font-weight: 900 !important;
          letter-spacing: 0.5px !important;
          margin: 0 !important;
          color: #000 !important;
        }
        .print-sub,
        .print-meta {
          margin: 6px 0 0 0 !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #111827 !important;
        }
        .print-sub b,
        .print-meta b {
          font-weight: 900 !important;
          color: #000 !important;
        }
        .print-amount-positive { color: #166534 !important; }
        .print-amount-negative { color: #991b1b !important; }
        .kpi-track-print-hide { display: none !important; }

        .screen-row { display: none !important; }
        .print-row-compact {
          display: grid !important;
          grid-template-columns: 22mm 1fr 30mm;
          gap: 8px;
          align-items: start;
          padding: 6px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
          font-weight: 600;
        }
        .print-row-compact:last-child { border-bottom: none; }
        .print-row-date { font-weight: 800; }
        .print-row-notes { color: #374151 !important; }
        .print-row-amount { text-align: right; font-weight: 900; white-space: nowrap; }
        .print-table-head {
          display: grid !important;
          grid-template-columns: 22mm 1fr 30mm;
          gap: 8px;
          padding: 0 0 6px 0;
          border-bottom: 1px solid #9ca3af;
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
      }

      @media screen {
        .print-row-compact,
        .print-table-head {
          display: none;
        }
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

  const initAuth = useCallback(async () => {
    if (!storeId || storeId === 'null') return
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      setHasSession(false)
      setAuthChecked(true)
      router.push('/login')
      return
    }
    setHasSession(true)
    setAuthChecked(true)
  }, [storeId, supabase, router])

  useEffect(() => {
    initAuth()
  }, [initAuth])

  /* ---------------- DATA LOAD (summary dataset) ---------------- */

  const loadData = useCallback(async () => {
    if (!authChecked) {
      return
    }

    if (!storeId || storeId === 'null') {
      setStaff([])
      setSuppliers([])
      setRevenueSources([])
      setMaintenanceWorkers([])
      setDrawer(null)
      return
    }

    if (!hasSession) {
      setStaff([])
      setSuppliers([])
      setRevenueSources([])
      setMaintenanceWorkers([])
      setDrawer(null)
      return
    }
    try {
      const [
        staffRes,
        supRes,
        revRes,
        maintRes,
        drawerRes,
      ] = await Promise.all([
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
      ])

      setStaff(staffRes.data || [])
      setSuppliers(supRes.data || [])
      setRevenueSources(revRes.data || [])
      setMaintenanceWorkers((maintRes.data || []).filter((x: any) => String(x?.name || '').trim().length > 0))
      setDrawer(drawerRes.data || null)
    } catch (err) {
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    }
  }, [storeId, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadAnalysisSummary = useCallback(async () => {
    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setRpcSummary({
        income: 0,
        expenses: 0,
        tips: 0,
        net_profit: 0,
        cash_balance: 0,
        bank_balance: 0,
        total_balance: 0,
        credit_outstanding: 0,
        credit_incoming: 0,
        savings_deposits: 0,
        savings_withdrawals: 0,
      })
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error

      const raw = Array.isArray(data) ? data[0] : data
      const payload = raw?.get_analysis_summary ?? raw ?? {}

      setRpcSummary({
        income: Number(payload.income || 0),
        expenses: Number(payload.expenses || 0),
        tips: Number(payload.tips || 0),
        net_profit: Number(payload.net_profit || 0),
        cash_balance: Number(payload.cash_balance || 0),
        bank_balance: Number(payload.bank_balance || 0),
        total_balance: Number(payload.total_balance || 0),
        credit_outstanding: Number(payload.credit_outstanding || 0),
        credit_incoming: Number(payload.credit_incoming || 0),
        savings_deposits: Number(payload.savings_deposits || 0),
        savings_withdrawals: Number(payload.savings_withdrawals || 0),
      })
    } catch (err) {
      console.error('Analysis summary RPC error:', err)
      setRpcSummary({
        income: 0,
        expenses: 0,
        tips: 0,
        net_profit: 0,
        cash_balance: 0,
        bank_balance: 0,
        total_balance: 0,
        credit_outstanding: 0,
        credit_incoming: 0,
        savings_deposits: 0,
        savings_withdrawals: 0,
      })
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadAnalysisSummary()
  }, [loadAnalysisSummary])

  const loadCategoryBreakdown = useCallback(async () => {
    setCategoryBreakdownReady(false)

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setCategoryBreakdownRows([])
      setCategoryBreakdownReady(true)
      return
    }
    try {
      const { data, error } = await supabase.rpc('get_analysis_category_breakdown', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setCategoryBreakdownRows(
        rows.map((r: any) => ({
          category_key: String(r.category_key ?? ''),
          total: Number(r.total || 0),
        }))
      )
    } catch (err) {
      console.error('Category breakdown RPC error:', err)
      setCategoryBreakdownRows([])
    } finally {
      setCategoryBreakdownReady(true)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadCategoryBreakdown()
  }, [loadCategoryBreakdown])

  const loadEntitySummary = useCallback(async () => {
    setEntitySummaryReady(false)

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setEntitySummaryRows([])
      setEntitySummaryReady(true)
      return
    }
    try {
      const { data, error } = await supabase.rpc('get_analysis_entity_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_filter_a: filterA,
      })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setEntitySummaryRows(
        rows.map((r: any) => ({
          entity_id: String(r.entity_id ?? ''),
          entity_name: String(r.entity_name ?? ''),
          total: Number(r.total || 0),
          paid: Number(r.paid || 0),
          credit: Number(r.credit || 0),
        }))
      )
    } catch (err) {
      console.error('Entity summary RPC error:', err)
      setEntitySummaryRows([])
    } finally {
      setEntitySummaryReady(true)
    }
  }, [storeId, startDate, endDate, filterA, supabase, authChecked, hasSession])

  useEffect(() => {
    loadEntitySummary()
  }, [loadEntitySummary])

  const loadZBank = useCallback(async () => {
    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setZBankAmount(0)
      return
    }
    try {
      const { data, error } = await supabase.rpc('get_analysis_z_bank', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })
      if (error) throw error
      const raw = Array.isArray(data) ? data[0] : data
      setZBankAmount(Number(raw?.total || 0))
    } catch (err) {
      console.error('Z bank RPC error:', err)
      setZBankAmount(0)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadZBank()
  }, [loadZBank])

  const loadStaffPayroll = useCallback(async () => {
    setStaffPayrollReady(false)

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setStaffPayrollRows([])
      setStaffPayrollReady(true)
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_staff_payroll', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      setStaffPayrollRows(
        rows.map((r: any) => ({
          name: String(r.name ?? ''),
          amount: Number(r.amount || 0),
        }))
      )
    } catch (err) {
      console.error('Staff payroll RPC error:', err)
      setStaffPayrollRows([])
    } finally {
      setStaffPayrollReady(true)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadStaffPayroll()
  }, [loadStaffPayroll])

  const loadProStats = useCallback(async () => {
    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setProStats(null)
      return
    }
    try {
      const { data, error } = await supabase.rpc('get_analysis_pro_stats', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })
      if (error) throw error
      const raw = Array.isArray(data) ? data[0] : data
      setProStats(raw ?? null)
    } catch (err) {
      console.error('PRO stats RPC error:', err)
      setProStats(null)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadProStats()
  }, [loadProStats])

  const loadDetailSummary = useCallback(async () => {
    const requestId = ++detailSummaryRequestIdRef.current

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setDetailSummary(null)
      return
    }
    if (detailMode === 'none' || detailId === 'all') {
      setDetailSummary(null)
      return
    }

    if (
      (detailMode === 'supplier' && suppliers.length === 0) ||
      (detailMode === 'staff' && staff.length === 0) ||
      (detailMode === 'maintenance' && maintenanceWorkers.length === 0) ||
      (detailMode === 'revenue_source' && revenueSources.length === 0)
    ) {
      return
    }

    setDetailSummary(null)

    let fallbackName = '—'
    if (detailMode === 'supplier') {
      fallbackName = suppliers.find((s) => String(s.id) === String(detailId))?.name || '—'
    } else if (detailMode === 'staff') {
      fallbackName = staff.find((s) => String(s.id) === String(detailId))?.name || '—'
    } else if (detailMode === 'maintenance') {
      fallbackName = maintenanceWorkers.find((m) => String(m.id) === String(detailId))?.name || '—'
    } else if (detailMode === 'revenue_source') {
      fallbackName = revenueSources.find((r) => String(r.id) === String(detailId))?.name || '—'
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_detail_summary', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_entity_type: detailMode,
        p_entity_id: detailId === 'all' ? null : detailId,
      })
      if (error) throw error
      const raw = Array.isArray(data) ? data[0] : data
      const payload = raw?.get_analysis_detail_summary ?? raw ?? {}
      if (requestId !== detailSummaryRequestIdRef.current) return
      setDetailSummary({
        name: String(payload.name || fallbackName || '').trim() || '—',
        paidCash: Number(payload.paidCash ?? payload.paid_cash ?? 0),
        paidBank: Number(payload.paidBank ?? payload.paid_bank ?? 0),
        paidTotal: Number(payload.paidTotal ?? payload.paid_total ?? 0),
        creditTotal: Number(payload.creditTotal ?? payload.credit_total ?? 0),
        countPaid: Number(payload.countPaid ?? payload.count_paid ?? 0),
        countCredit: Number(payload.countCredit ?? payload.count_credit ?? 0),
        totalAll: Number(payload.totalAll ?? payload.total_all ?? 0),
        paidRows: Array.isArray(payload.paidRows ?? payload.paid_rows)
          ? (payload.paidRows ?? payload.paid_rows)
          : [],
        creditRows: Array.isArray(payload.creditRows ?? payload.credit_rows)
          ? (payload.creditRows ?? payload.credit_rows)
          : [],
      })
    } catch (err) {
      console.error('Detail summary RPC error:', err)
      if (requestId !== detailSummaryRequestIdRef.current) return
      setDetailSummary(null)
    }
  }, [
    storeId,
    startDate,
    endDate,
    detailMode,
    detailId,
    suppliers,
    staff,
    maintenanceWorkers,
    revenueSources,
    supabase,
    authChecked,
    hasSession,
  ])

  useEffect(() => {
    loadDetailSummary()
  }, [loadDetailSummary])

  const loadCollapsedZ = useCallback(async () => {
    setCollapsedZReady(false)

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setCollapsedZRows([])
      setCollapsedZReady(true)
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_collapsed_period', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      setCollapsedZRows(
        rows.map((r: any) => ({
          date: String(r.date ?? ''),
          cash_z: Number(r.cash_z || 0),
          card_z: Number(r.card_z || 0),
          total_z: Number(r.total_z || 0),
        }))
      )
    } catch (err) {
      console.error('Collapsed Z RPC error:', err)
      setCollapsedZRows([])
    } finally {
      setCollapsedZReady(true)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadCollapsedZ()
  }, [loadCollapsedZ])

  const loadPeriodMovements = useCallback(async () => {
    setPeriodMovementsReady(false)

    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setPeriodMovements([])
      setPeriodMovementsReady(true)
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_period_movements', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      setPeriodMovements(
        rows.map((row: any) => ({
          id: row.id,
          date: String(row.date ?? ''),
          amount: Number(row.amount || 0),
          type: String(row.type ?? ''),
          method: String(row.method ?? ''),
          category: String(row.category ?? ''),
          notes: String(row.notes ?? ''),
          party_name: String(row.party_name ?? ''),
          is_credit: row.is_credit === true,
          is_verified: typeof row.is_verified === 'boolean' ? row.is_verified : undefined,
        }))
      )
    } catch (err) {
      console.error('Period movements RPC error:', err)
      setPeriodMovements([])
    } finally {
      setPeriodMovementsReady(true)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadPeriodMovements()
  }, [loadPeriodMovements])

  const loadExpectedOutflows = useCallback(async () => {
    if (!authChecked || !hasSession || !storeId || storeId === 'null') {
      setExpectedOutflows30d(0)
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_analysis_expected_outflows', {
        p_store_id: storeId,
        p_start_date: startDate,
        p_end_date: endDate,
      })

      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const total = rows.reduce((acc: number, row: any) => acc + Math.abs(Number(row.amount || 0)), 0)
      setExpectedOutflows30d(total)
    } catch (err) {
      console.error('Expected outflows RPC error:', err)
      setExpectedOutflows30d(0)
    }
  }, [storeId, startDate, endDate, supabase, authChecked, hasSession])

  useEffect(() => {
    loadExpectedOutflows()
  }, [loadExpectedOutflows])

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

  /* ---------------- KPI / BALANCES ---------------- */

  const variance = useMemo(
    () => ({
      income: null,
      expenses: null,
      tips: null,
      netProfit: null,
    }),
    []
  )

  const bigKpiValue = useMemo(() => {
    return Number(rpcSummary.net_profit || 0)
  }, [rpcSummary.net_profit])

  const totalCashDisplay = useMemo(() => {
    return Number(rpcSummary.cash_balance || 0)
  }, [rpcSummary.cash_balance])

  /* ---------------- SIMPLE: ENTITY SUMMARIES (no huge tx list) ---------------- */

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  const rangeText = useMemo(() => `${formatDateGreek(startDate)} → ${formatDateGreek(endDate)}`, [startDate, endDate])

  const entitySummary = useMemo(() => {
    return entitySummaryRows.map((row) => ({
      id: row.entity_id,
      name: row.entity_name,
      total: row.total,
      paid: row.paid,
      credit: row.credit,
    }))
  }, [entitySummaryRows])

  /* ---------------- PRO: DETAIL CARD (paid vs credit) ---------------- */

  const proDetailSummary = detailSummary

  const collapsedPeriodList = useMemo(() => {
    const collapsedZFromRpc = collapsedZRows.map((row) => ({
      id: `z-${row.date}`,
      date: row.date,
      type: 'income',
      category: 'Εσοδα Ζ',
      amount: row.total_z,
      method: 'Z (Σύνολο)',
      notes: `Μετρητά (Z): ${moneyGR(row.cash_z)} • Κάρτα (POS): ${moneyGR(row.card_z)}`,
      __collapsedZ: true,
    }))

    return [...periodMovements, ...collapsedZFromRpc].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [periodMovements, collapsedZRows])

  const collapsedPeriodReady = useMemo(() => collapsedZReady && periodMovementsReady, [collapsedZReady, periodMovementsReady])

  /* ---------------- PRO STATS (RPC) ---------------- */

  const proExpenseDocs = useMemo(
    () => ({
      retail: {
        amount: Number(proStats?.expense_docs?.retail?.amount || 0),
        count: Number(proStats?.expense_docs?.retail?.count || 0),
        pct: Number(proStats?.expense_docs?.retail?.pct || 0),
      },
      invoice: {
        amount: Number(proStats?.expense_docs?.invoice?.amount || 0),
        count: Number(proStats?.expense_docs?.invoice?.count || 0),
        pct: Number(proStats?.expense_docs?.invoice?.pct || 0),
      },
      no_invoice: {
        amount: Number(proStats?.expense_docs?.no_invoice?.amount || 0),
        count: Number(proStats?.expense_docs?.no_invoice?.count || 0),
        pct: Number(proStats?.expense_docs?.no_invoice?.pct || 0),
      },
      unknown: {
        amount: Number(proStats?.expense_docs?.unknown?.amount || 0),
        count: Number(proStats?.expense_docs?.unknown?.count || 0),
        pct: Number(proStats?.expense_docs?.unknown?.pct || 0),
      },
    }),
    [proStats],
  )

  const proCapitalTransfers = useMemo(
    () => ({
      out: Number(proStats?.capital_transfers?.out || 0),
      in: Number(proStats?.capital_transfers?.in || 0),
      net: Number(proStats?.capital_transfers?.net || 0),
      countOut: Number(proStats?.capital_transfers?.countOut ?? proStats?.capital_transfers?.count_out ?? 0),
      countIn: Number(proStats?.capital_transfers?.countIn ?? proStats?.capital_transfers?.count_in ?? 0),
    }),
    [proStats],
  )

  const proFinanceCards = useMemo(
    () => ({
      loanOut: Number(proStats?.finance?.loanOut ?? proStats?.finance?.loan_out ?? 0),
      loanIn: Number(proStats?.finance?.loanIn ?? proStats?.finance?.loan_in ?? 0),
      settlementOut: Number(proStats?.finance?.settlementOut ?? proStats?.finance?.settlement_out ?? 0),
    }),
    [proStats],
  )

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
          .range(offset, offset + limit) // inclusive range: returns limit+1
        if (error) throw error

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
    [storeId, searchFrom, searchTo, pageSize, supabase]
  )

  /* ---------------- PARTY NAME FOR LISTS ---------------- */

  const getPartyName = useCallback(
    (t: any) => {
      if (t.type === 'savings_deposit') return 'ΚΑΤΑΘΕΣΗ ΣΕ ΚΟΥΜΠΑΡΑ'
      if (t.type === 'savings_withdrawal') return 'ΑΝΑΛΗΨΗ ΑΠΟ ΚΟΥΜΠΑΡΑ'

      if (t.revenue_source_id || t.revenue_sources?.name)
        return (
          t.revenue_sources?.name ||
          revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))?.name ||
          'Πηγή Εσόδων'
        )

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

  /* ---------------- CATEGORY BREAKDOWN ---------------- */

  const categoryBreakdown = useMemo(() => {
    const result: Record<string, number> = {
      'Εμπορεύματα': 0,
      'Staff': 0,
      'Utilities': 0,
      'Maintenance': 0,
      'Other': 0,
    }

    let total = 0

    for (const row of categoryBreakdownRows) {
      const key = row.category_key
      const value = Number(row.total || 0)
      if (key in result) result[key] = value
      total += value
    }

    return { result, total }
  }, [categoryBreakdownRows])

  /* ---------------- UI ---------------- */

  const rootStyle = embeddedInEconomics ? { width: '100%', padding: 0, background: 'transparent', position: 'static' } : iphoneWrapper
  const innerContainerStyle = embeddedInEconomics
    ? { width: '100%', paddingBottom: 0 }
    : { maxWidth: 560, margin: '0 auto', paddingBottom: 120 }

  return (
    <div style={rootStyle} data-print-root="true">
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

      <div style={innerContainerStyle}>
        {/* PRINT HEADER */}
        {!embeddedInEconomics && (
          <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">ΟΙΚΟΝΟΜΙΚΗ ΑΝΑΦΟΡΑ ΚΑΤΑΣΤΗΜΑΤΟΣ</h1>
            <p className="print-sub">
              Ημερομηνία Εκτύπωσης: <b>{format(new Date(), 'dd/MM/yyyy HH:mm')}</b>
            </p>
            <p className="print-meta">
              Εύρος Ημερομηνιών: <b>{formatDateGreek(startDate)} → {formatDateGreek(endDate)}</b> • Φίλτρο: <b>{filterA}</b>
            </p>
          </div>
        )}

        {/* HEADER */}
        {!embeddedInEconomics && (
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
        )}

        {/* PERIOD FILTER (matches other economics pages) */}
        <div className="no-print" style={{ marginTop: 12 }}>
          <EconomicsPeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            yearOptions={yearOptions}
          />
        </div>

          {/* SIMPLE: TOP “ΑΠΟ/ΕΩΣ” PILL */}
        {!embeddedInEconomics && (
          <div style={rangePill} className="no-print">
            {formatDateGreek(startDate)} → {formatDateGreek(endDate)}
          </div>
        )}

        {/* FILTER CARD */}
        {!embeddedInEconomics && (
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

            <div style={tile} className="analysis-filter-tile">
              <div style={tileIcon} className="analysis-filter-icon">⛃</div>
              <div style={tileBody} className="analysis-filter-body">
                <div style={tileLabel}>ΦΙΛΤΡΟ</div>
                <select
                  value={filterA}
                  onChange={(e) => setFilterA(e.target.value as FilterA)}
                  style={tileControl}
                  className="analysis-filter-control"
                >
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
              <div style={tile} className="analysis-filter-tile">
                <div style={tileIcon} className="analysis-filter-icon">≡</div>
                <div style={tileBody} className="analysis-filter-body">
                  <div style={tileLabel}>ΛΕΠΤΟΜΕΡΕΙΑ</div>
                  <select
                    value={detailId}
                    onChange={(e) => setDetailId(e.target.value)}
                    style={tileControl}
                    className="analysis-filter-control"
                  >
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
        )}

        {/* KPI GRID (always) */}
        <div style={kpiGrid} data-print-section="true" className="kpi-grid-print">
          <div
            className="print-card"
            style={{
              ...kpiCard,
              borderColor: '#d1fae5',
              background: 'linear-gradient(180deg, #ecfdf5, #ffffff)',
            }}
          >
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.success }}>
                Έσοδα <span style={kpiDelta}>{fmtPct(variance.income)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: colors.success }}>+</div>
            </div>
            <div className="print-amount-positive" style={{ ...kpiValue, color: colors.success }}>
              + {moneyGR(rpcSummary.income)}
            </div>
            <div className="kpi-track-print-hide" style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.success }} />
            </div>
          </div>

          <div
            className="print-card"
            style={{
              ...kpiCard,
              borderColor: '#ffe4e6',
              background: 'linear-gradient(180deg, #fff1f2, #ffffff)',
            }}
          >
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.danger }}>
                Έξοδα <span style={kpiDelta}>{fmtPct(variance.expenses)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: colors.danger }}>-</div>
            </div>
            <div className="print-amount-negative" style={{ ...kpiValue, color: colors.danger }}>
              - {moneyGR(rpcSummary.expenses)}
            </div>
            <div className="kpi-track-print-hide" style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.danger }} />
            </div>
          </div>

          <div
            className="print-card"
            style={{
              ...kpiCard,
              borderColor: '#fde68a',
              background: 'linear-gradient(180deg, #fffbeb, #ffffff)',
            }}
          >
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#b45309' }}>
                Στην Τράπεζα από Z
              </div>
              <div style={{ ...kpiSign, color: '#b45309' }}>+</div>
            </div>
            <div className="print-amount-positive" style={{ ...kpiValue, color: '#b45309' }}>
              + {moneyGR(zBankAmount)}
            </div>
            <div className="kpi-track-print-hide" style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.amber }} />
            </div>
          </div>

          <div
            className="print-card"
            style={{
              ...kpiCard,
              borderColor: '#111827',
              background: 'linear-gradient(180deg, #0b1220, #111827)',
              color: '#fff',
            }}
          >
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#fff' }}>
                {isZReport ? 'Καθαρό Ταμείο Ημέρας' : 'Καθαρό Κέρδος'}{' '}
                <span style={{ ...kpiDelta, color: '#e5e7eb' }}>{fmtPct(variance.netProfit)} vs prev</span>
              </div>
              <div style={{ ...kpiSign, color: '#fff' }}>{bigKpiValue >= 0 ? '▲' : '▼'}</div>
            </div>
            <div
              className={bigKpiValue >= 0 ? 'print-amount-positive' : 'print-amount-negative'}
              style={{ ...kpiValue, color: '#fff' }}
            >
              {moneyGR(bigKpiValue)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginTop: 6 }}>
              {isZReport
                ? 'Μετρητά (Z) + Χωρίς Σήμανση - Επιχειρ. Έξοδα Μετρητών'
                : 'Έσοδα - Έξοδα (χωρίς Πίστωση)'}
            </div>
          </div>
        </div>

        {/* BALANCES GRID */}
        <div style={balancesGrid} data-print-section="true" className="balances-grid-print">
          <div
            className="print-card"
            style={{
              ...smallKpiCard,
              border: '1px solid rgba(139,92,246,0.30)',
              background: 'linear-gradient(180deg, #f5f3ff, #ffffff)',
            }}
          >
            <div style={smallKpiLabel}>Κινήσεις Κουμπαρά</div>
            <div className="print-amount-positive" style={{ ...smallKpiValue, color: colors.purple }}>
              {moneyGR(rpcSummary.savings_deposits - rpcSummary.savings_withdrawals)}
            </div>
            <div style={smallKpiHint}>
              IN: {moneyGR(rpcSummary.savings_deposits)} • OUT: {moneyGR(rpcSummary.savings_withdrawals)}
            </div>
          </div>

          <div className="print-card" style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Μετρητών</div>
            <div style={smallKpiValue}>{moneyGR(totalCashDisplay)}</div>
            <div style={smallKpiHint}>{isZReport ? 'Συρτάρι ημέρας' : `As of: ${formatDateGreek(endDate)} (χωρίς Πίστωση)`}</div>
          </div>

          <div className="print-card" style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Τράπεζας</div>
            <div style={smallKpiValue}>{moneyGR(rpcSummary.bank_balance)}</div>
            <div style={smallKpiHint}>Κάρτα + Τράπεζα (χωρίς Πίστωση)</div>
          </div>

          <div
            className="print-card"
            style={{
              ...smallKpiCard,
              border: '1px solid rgba(16,185,129,0.20)',
              background: 'linear-gradient(180deg, #ecfdf5, #ffffff)',
            }}
          >
            <div style={smallKpiLabel}>Σύνολο Ρευστό</div>
            <div className="print-amount-positive" style={{ ...smallKpiValue, color: colors.success }}>
              {moneyGR(rpcSummary.total_balance)}
            </div>
            <div style={smallKpiHint}>Cash + Bank (χωρίς Πίστωση)</div>
          </div>

          {/* PRO extras only */}
          {uiMode === 'pro' && (
            <>
              <div
                className="print-card"
                style={{
                  ...smallKpiCard,
                  border: '1px solid rgba(244,63,94,0.25)',
                  background: 'linear-gradient(180deg, #fff1f2, #ffffff)',
                }}
              >
                <div style={smallKpiLabel}>Υπόλοιπο Πιστώσεων</div>
                <div className="print-amount-negative" style={{ ...smallKpiValue, color: colors.danger }}>
                  {moneyGR(rpcSummary.credit_outstanding)}
                </div>
                <div style={smallKpiHint}>Έξοδα σε Πίστωση (δεν μειώνουν Cash/Bank)</div>
              </div>

              <div
                className="print-card"
                style={{
                  ...smallKpiCard,
                  border: '1px solid rgba(99,102,241,0.20)',
                  background: 'linear-gradient(180deg, #eef2ff, #ffffff)',
                }}
              >
                <div style={smallKpiLabel}>Expected Outflows (30d)</div>
                <div className="print-amount-negative" style={{ ...smallKpiValue, color: colors.indigo }}>
                  {moneyGR(expectedOutflows30d)}
                </div>
                <div style={smallKpiHint}>Μελλοντικά έξοδα (future dated). Χωρίς Πίστωση.</div>
              </div>

              <div className="print-card" style={smallKpiCard}>
                <div style={smallKpiLabel}>Ταμείο Ημέρας (Z View)</div>
                <div style={smallKpiValue}>{drawer ? moneyGR(drawer.total_cash_drawer) : '—'}</div>
                <div style={smallKpiHint}>
                  {drawer ? `Ημερομηνία Ζ: ${formatDateGreek(drawer.date)}` : `Δεν βρέθηκε Ζ έως: ${formatDateGreek(endDate)}`}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>
                  {drawer ? `Z: ${moneyGR(drawer.z_cash)} • Χωρίς Σήμανση: ${moneyGR(drawer.extra_cash)}` : ''}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------------- SIMPLE MODE: “έξοδα ανά οντότητα” ---------------- */}
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

            {!entitySummaryReady ? (
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
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 950,
                          color: colors.primary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
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

        {/* ---------------- PRO MODE: Detail card when selecting entity ---------------- */}
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

              <div
                style={{
                  ...smallKpiCard,
                  border: '1px solid rgba(244,63,94,0.25)',
                  background: 'linear-gradient(180deg, #fff1f2, #ffffff)',
                }}
              >
                <div style={smallKpiLabel}>ΥΠΟΛΟΙΠΟ ΠΙΣΤΩΣΗΣ</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(proDetailSummary.creditTotal)}</div>
                <div style={smallKpiHint}>({proDetailSummary.countCredit} κινήσεις σε πίστωση)</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }} className="print-table-wrap">
              {proDetailSummary.creditRows.length === 0 ? (
                <div style={hintBox}>Δεν υπάρχουν κινήσεις σε πίστωση για την περίοδο.</div>
              ) : (
                <>
                  <div style={hintBox}>
                    <b>Πίστωση:</b> {proDetailSummary.creditRows.length} κινήσεις (δείχνω τις 10 πιο πρόσφατες)
                  </div>
                  <div className="print-table-head">
                    <div>Ημερομηνία</div>
                    <div>Περιγραφή</div>
                    <div style={{ textAlign: 'right' }}>Ποσό</div>
                  </div>
                  {proDetailSummary.creditRows.slice(0, 10).map((t: any) => (
                    <div key={`cr-${t.id}`} style={listRow}>
                      <div className="print-row-compact">
                        <div className="print-row-date">{formatDateGreek(t.date)}</div>
                        <div className="print-row-notes">{String(t.notes || t.category || '').trim() || '—'}</div>
                        <div className="print-row-amount print-amount-negative">
                          {moneyGR(Math.abs(Number(t.amount) || 0))}
                        </div>
                      </div>
                      <div className="screen-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary }}>{formatDateGreek(t.date)}</div>
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

        {/* ✅ NEW: PRO “Παραστατικά & Μεταφορές” */}
        {uiMode === 'pro' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Παραστατικά & Μεταφορές</h3>
                <div style={sectionSub}>
                  Παραστατικά εξόδων + μεταφορές κεφαλαίων • Περίοδος: {rangeText}
                </div>
              </div>
              <div style={sectionPill}>PRO</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ</div>
                <div style={{ ...smallKpiValue, color: colors.indigo }}>{moneyGR(proExpenseDocs.retail.amount)}</div>
                <div style={smallKpiHint}>
                  {proExpenseDocs.retail.count} κινήσεις • {proExpenseDocs.retail.pct.toFixed(0)}% των εξόδων
                </div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΤΙΜΟΛΟΓΙΟ</div>
                <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(proExpenseDocs.invoice.amount)}</div>
                <div style={smallKpiHint}>
                  {proExpenseDocs.invoice.count} κινήσεις • {proExpenseDocs.invoice.pct.toFixed(0)}% των εξόδων
                </div>
              </div>

              <div
                style={{
                  ...smallKpiCard,
                  border: '1px solid rgba(244,63,94,0.20)',
                  background: 'linear-gradient(180deg, #fff1f2, #ffffff)',
                }}
              >
                <div style={smallKpiLabel}>ΧΩΡΙΣ ΤΙΜΟΛΟΓΙΟ</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(proExpenseDocs.no_invoice.amount)}</div>
                <div style={smallKpiHint}>
                  {proExpenseDocs.no_invoice.count} κινήσεις • {proExpenseDocs.no_invoice.pct.toFixed(0)}% των εξόδων
                </div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΜΗ ΑΝΑΓΝΩΡΙΣΜΕΝΟ</div>
                <div style={{ ...smallKpiValue, color: colors.secondary }}>{moneyGR(proExpenseDocs.unknown.amount)}</div>
                <div style={smallKpiHint}>
                  {proExpenseDocs.unknown.count} κινήσεις • {proExpenseDocs.unknown.pct.toFixed(0)}%
                </div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΜΕΤΑΦΟΡΑ ΚΕΦΑΛΑΙΩΝ (OUT)</div>
                <div style={{ ...smallKpiValue, color: colors.danger }}>{moneyGR(proCapitalTransfers.out)}</div>
                <div style={smallKpiHint}>{proCapitalTransfers.countOut} κινήσεις</div>
              </div>

              <div style={smallKpiCard}>
                <div style={smallKpiLabel}>ΜΕΤΑΦΟΡΑ ΚΕΦΑΛΑΙΩΝ (IN)</div>
                <div style={{ ...smallKpiValue, color: colors.success }}>{moneyGR(proCapitalTransfers.in)}</div>
                <div style={smallKpiHint}>{proCapitalTransfers.countIn} κινήσεις</div>
              </div>

              <div style={{ ...smallKpiCard, gridColumn: 'span 2' }}>
                <div style={smallKpiLabel}>ΜΕΤΑΦΟΡΑ ΚΕΦΑΛΑΙΩΝ (NET)</div>
                <div
                  style={{
                    ...smallKpiValue,
                    color: proCapitalTransfers.net >= 0 ? colors.success : colors.danger,
                  }}
                >
                  {moneyGR(proCapitalTransfers.net)}
                </div>
                <div style={smallKpiHint}>IN − OUT (για το συγκεκριμένο store)</div>
              </div>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...tile, width: '100%' }}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΑΠΟ</div>
                <input type="date" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} style={tileControl} />
              </div>
            </div>
            <div style={{ ...tile, width: '100%' }}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΕΩΣ</div>
                <input type="date" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} style={tileControl} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 50px 50px', gap: 10 }}>
            <button type="button" onClick={() => runTxSearch(0)} style={searchBtn} disabled={searchLoading}>
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
                          <div style={{ fontSize: 13, fontWeight: 950, color: colors.primary }}>{formatDateGreek(t.date)}</div>
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 14,
                              fontWeight: 950,
                              color: colors.primary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
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

            {!categoryBreakdownReady ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : categoryBreakdown.total <= 0 ? (
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
                <div style={sectionSub}>Περίοδος: {rangeText}</div>
              </div>
              <div style={sectionPill}>{rangeText}</div>
            </div>

            {!staffPayrollReady ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : staffPayrollRows.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας για την επιλεγμένη περίοδο.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffPayrollRows.map((s) => (
                  <div key={s.name} style={rowItem}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          color: colors.primary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
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

            {!collapsedPeriodReady ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : collapsedPeriodList.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν κινήσεις για το φίλτρο που επέλεξες.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="print-table-wrap">
                <div className="print-table-head">
                  <div>Ημερομηνία</div>
                  <div>Περιγραφή Κίνησης</div>
                  <div style={{ textAlign: 'right' }}>Ποσό</div>
                </div>
                {collapsedPeriodList.map((t: any) => {
                  const isCollapsedZ = !!t.__collapsedZ
                  const name = isCollapsedZ ? 'Z REPORT (ΣΥΝΟΛΟ)' : String(t.party_name || getPartyName(t))

                  const amt = Number(t.amount) || 0
                  const absAmt = Math.abs(amt)

                  const isInc =
                    t.type === 'income' ||
                    t.type === 'income_collection' ||
                    t.type === 'debt_received' ||
                    t.type === 'savings_withdrawal'
                  const isTip = t.type === 'tip_entry'
                  const isExp = t.type === 'expense' || t.type === 'debt_payment' || t.type === 'salary_advance' || t.type === 'savings_deposit'

                  const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                  const pillBg = isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2'
                  const pillBr = isInc ? '#d1fae5' : isTip ? '#fde68a' : '#ffe4e6'
                  const pillTx = isInc ? colors.success : isTip ? '#92400e' : colors.danger

                  const pm = getPaymentMethod(t)
                  const credit = isCreditTx(t)
                  const verified = t?.is_verified === true

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow}>
                      <div className="print-row-compact">
                        <div className="print-row-date">{formatDateGreek(t.date)}</div>
                        <div className="print-row-notes">
                          <div style={{ fontWeight: 800 }}>{String(name || '').toUpperCase()}</div>
                          {!!t.notes && <div>{String(t.notes)}</div>}
                          {!!pm && <div>Μέθοδος: {pm}{credit ? ' • ΠΙΣΤΩΣΗ' : ''}</div>}
                        </div>
                        <div
                          className={`print-row-amount ${isInc || isTip ? 'print-amount-positive' : isExp ? 'print-amount-negative' : ''}`}
                        >
                          {sign}{absAmt.toLocaleString('el-GR')}€
                        </div>
                      </div>
                      <div className="screen-row" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap' }}>{formatDateGreek(t.date)}</div>
                          <div
                            style={{
                              padding: '8px 12px',
                              borderRadius: 999,
                              backgroundColor: pillBg,
                              border: `1px solid ${pillBr}`,
                              fontSize: 16,
                              fontWeight: 900,
                              color: pillTx,
                              whiteSpace: 'nowrap',
                            }}
                          >
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

export { AnalysisContent }

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
const tileLabel: any = {
  fontSize: 12,
  fontWeight: 950,
  color: colors.secondary,
  letterSpacing: 0.7,
  marginBottom: 8,
  textTransform: 'uppercase',
}

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
const kpiCard: any = {
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  padding: 14,
  background: '#fff',
  boxShadow: '0 12px 22px rgba(15,23,42,0.06)',
  overflow: 'hidden',
}
const kpiTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const kpiLabel: any = { fontSize: 14, fontWeight: 950 }
const kpiSign: any = { fontSize: 16, fontWeight: 950 }
const kpiValue: any = { marginTop: 10, fontSize: 24, fontWeight: 950 }
const kpiDelta: any = { marginLeft: 8, fontSize: 11, fontWeight: 900, color: colors.secondary }
const kpiTrack: any = { marginTop: 12, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const kpiFill: any = { height: 8, borderRadius: 999 }

const balancesGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }
const smallKpiCard: any = {
  background: '#ffffff',
  border: '1px solid rgba(15, 23, 42, 0.08)',
  borderRadius: 18,
  padding: 14,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
}
const smallKpiLabel: any = {
  fontSize: 12,
  fontWeight: 900,
  color: '#64748b',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
}
const smallKpiValue: any = { fontSize: 20, fontWeight: 1000, color: '#0f172a', marginTop: 8 }
const smallKpiHint: any = { fontSize: 12, color: '#94a3b8', marginTop: 6, fontWeight: 700 }

const sectionCard: any = {
  marginTop: 14,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  padding: 16,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)',
}
const sectionTitleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }
const sectionTitle: any = { margin: 0, fontSize: 18, fontWeight: 950, color: colors.primary }
const sectionSub: any = { marginTop: 4, fontSize: 12, fontWeight: 850, color: colors.secondary }
const sectionPill: any = {
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 13,
  fontWeight: 950,
  color: colors.primary,
  whiteSpace: 'nowrap',
}

const hintBox: any = {
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 850,
  color: colors.secondary,
}

const catRow: any = { display: 'grid', gridTemplateColumns: '1fr 120px 110px', alignItems: 'center', gap: 12 }
const catLeft: any = { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }
const catIconWrap: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#f1f5f9',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
  flex: '0 0 44px',
}
const catLabelWrap: any = { minWidth: 0 }
const catLabel: any = { fontSize: 16, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const catMid: any = { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }
const catPct: any = { width: 44, textAlign: 'right', fontSize: 14, fontWeight: 950, color: colors.secondary }
const catTrack: any = { flex: 1, height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const catFill: any = { height: 10, borderRadius: 999 }
const catValue: any = { textAlign: 'right', fontSize: 16, fontWeight: 950, whiteSpace: 'nowrap' }

const rowItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
}
const listRow: any = { padding: 14, borderRadius: 18, backgroundColor: colors.background, border: `1px solid ${colors.border}` }

const printWrap: any = {
  marginTop: 18,
  padding: 14,
  borderRadius: 18,
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}
const printModeSwitchWrap: any = { display: 'flex', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 14, gap: 6 }
const printModeBtn: any = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: 'none',
  fontWeight: 950,
  fontSize: 16,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: colors.primary,
}
const printModeBtnActive: any = { backgroundColor: colors.indigo, color: '#fff' }
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