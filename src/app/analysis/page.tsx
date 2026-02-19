'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Users, ShoppingBag, Lightbulb, Wrench, Printer } from 'lucide-react'

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
}

// --- CATEGORY META (required order & icons) ---
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

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Extra: transactions current month (for Staff panel to stay correct even if user selects other range)
  const [monthTransactions, setMonthTransactions] = useState<any[]>([])

  // lists for dynamic filters + correct party names
  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  // ✅ BALANCES / DRAWER (from views)
  const [balances, setBalances] = useState<any>(null)
  const [drawer, setDrawer] = useState<any>(null)

  // ✅ Smart Dynamic Filters
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  // ✅ Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // ✅ Z report (same day)
  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  // ✅ Print Mode toggle
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  // ✅ PRINT CSS (inject once)
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
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .no-print { display: none !important; }
  a { text-decoration: none !important; color: #000 !important; }

  [data-print-root="true"] {
    position: static !important;
    top: auto !important;
    left: auto !important;
    right: auto !important;
    bottom: auto !important;
    overflow: visible !important;
    padding: 0 !important;
    min-height: auto !important;
    display: block !important;
    background: #fff !important;
  }

  [data-print-root="true"] * { box-shadow: none !important; }

  [data-print-section="true"]{
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .print-header {
    display: block !important;
    margin: 0 0 10mm 0 !important;
    padding-bottom: 6mm !important;
    border-bottom: 1px solid #e5e7eb !important;
  }

  .print-title {
    font-size: 18px !important;
    font-weight: 900 !important;
    margin: 0 !important;
    color: #000 !important;
  }
  .print-sub {
    margin: 4px 0 0 0 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    color: #374151 !important;
  }
  .print-meta {
    margin: 6px 0 0 0 !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    color: #374151 !important;
  }

  [data-print-root="true"] [data-print-row="true"]{
    border: 1px solid #e5e7eb !important;
    background: #fff !important;
  }
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

  // guard
  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      if (!storeId || storeId === 'null') {
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // ✅ SaaS FIX: fetch only selected period (keeps page fast for big data)
      const txQuery = supabase
        .from('transactions')
        .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
        .eq('store_id', storeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      // ✅ Keep "Staff this month" correct regardless of selected range
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

      const monthTxQuery = supabase
        .from('transactions')
        .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
        .eq('store_id', storeId)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false })

      const staffQuery = supabase
        .from('fixed_assets')
        .select('id, name, sub_category')
        .eq('store_id', storeId)
        .eq('sub_category', 'staff')
        .order('name', { ascending: true })

      const suppliersQuery = supabase
        .from('suppliers')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      const revenueSourcesQuery = supabase
        .from('revenue_sources')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      const maintenanceQuery = supabase
        .from('fixed_assets')
        .select('id, name, sub_category')
        .eq('store_id', storeId)
        .in('sub_category', ['worker', 'Maintenance', 'maintenance'])
        .order('name', { ascending: true })

      // ✅ balances (cash/bank/total) + cash drawer (for endDate)
      const balancesPromise = supabase.from('v_financial_balances').select('*').eq('store_id', storeId).maybeSingle()

      const drawerPromise = supabase
        .from('v_cash_drawer_today')
        .select('*')
        .eq('store_id', storeId)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const [
        { data: tx, error: txErr },
        { data: monthTx, error: monthTxErr },
        { data: staffData, error: staffErr },
        { data: supData, error: supErr },
        { data: revData, error: revErr },
        { data: maintData, error: maintErr },
        { data: balData, error: balErr },
        { data: drawerData, error: drawerErr },
      ] = await Promise.all([
        txQuery,
        monthTxQuery,
        staffQuery,
        suppliersQuery,
        revenueSourcesQuery,
        maintenanceQuery,
        balancesPromise,
        drawerPromise,
      ])

      if (txErr) throw txErr
      if (monthTxErr) throw monthTxErr
      if (staffErr) throw staffErr
      if (supErr) throw supErr
      if (revErr) throw revErr
      if (maintErr) throw maintErr

      // If the views don't exist yet, don't kill the page—just hide those KPIs
      if (balErr) console.warn('v_financial_balances error:', balErr)
      if (drawerErr) console.warn('v_cash_drawer_today error:', drawerErr)

      setTransactions(tx || [])
      setMonthTransactions(monthTx || [])

      setStaff(staffData || [])
      setSuppliers(supData || [])
      setRevenueSources(revData || [])
      setMaintenanceWorkers((maintData || []).filter((x: any) => String(x?.name || '').trim().length > 0))

      setBalances(balData || null)
      setDrawer(drawerData || null)
    } catch (err) {
      console.error(err)
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId, startDate, endDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ✅ refresh balances/drawer when date changes (so Z day drawer follows "ΕΩΣ")
  useEffect(() => {
    if (!storeId || storeId === 'null') return
    ;(async () => {
      try {
        const [{ data: balData }, { data: drawerData }] = await Promise.all([
          supabase.from('v_financial_balances').select('*').eq('store_id', storeId).maybeSingle(),
          supabase
            .from('v_cash_drawer_today')
            .select('*')
            .eq('store_id', storeId)
            .lte('date', endDate)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        setBalances(balData || null)
        setDrawer(drawerData || null)
      } catch (e) {
        console.warn(e)
      }
    })()
  }, [storeId, endDate])

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
    let cat = t.category
    if (!cat) cat = 'Other'
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'

    const subRaw = t.fixed_assets?.sub_category
    const sub = String(subRaw || '').trim()

    if (sub === 'staff') return 'Staff'
    if (sub === 'utility') return 'Utilities'
    if (sub === 'other') return 'Other'
    if (sub === 'worker' || sub === 'Maintenance') return 'Maintenance'

    const lower = sub.toLowerCase()
    if (lower === 'worker' || lower === 'maintenance') return 'Maintenance'
    if (lower === 'staff') return 'Staff'
    if (lower === 'utility' || lower === 'utilities') return 'Utilities'
    if (lower === 'other') return 'Other'

    if (cat === 'Εμπορεύματα' || cat === 'Staff' || cat === 'Utilities' || cat === 'Maintenance' || cat === 'Other') {
      return cat
    }
    return 'Other'
  }, [])

  const getPartyName = useCallback(
    (t: any) => {
      if (t.revenue_source_id || t.revenue_sources?.name) {
        const joinedName = t.revenue_sources?.name
        if (joinedName) return joinedName
        const found = revenueSources.find((r) => String(r.id) === String(t.revenue_source_id))
        return found?.name || 'Πηγή Εσόδων'
      }

      const isStaff = String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff'
      if (isStaff) {
        const joinedName = t.fixed_assets?.name
        if (joinedName) return joinedName
        const found = staff.find((s) => String(s.id) === String(t.fixed_asset_id))
        return found?.name || 'Άγνωστος Υπάλληλος'
      }

      if (t.suppliers?.name) return t.suppliers.name
      if (t.supplier_id) {
        const found = suppliers.find((s) => String(s.id) === String(t.supplier_id))
        return found?.name || 'Προμηθευτής'
      }

      if (t.fixed_asset_id) {
        const joinedName = t.fixed_assets?.name
        if (joinedName) return joinedName
        const found = maintenanceWorkers.find((m) => String(m.id) === String(t.fixed_asset_id))
        if (found?.name) return found.name
      }

      if (t.type === 'tip_entry') {
        const found = staff.find((s) => String(s.id) === String(t.fixed_asset_id))
        return found?.name || 'Tips'
      }

      return '-'
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

  const getMethod = useCallback((t: any) => {
    return String((t.method ?? t.payment_method ?? '') || '').trim()
  }, [])

  const periodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    return transactions.filter((t) => t.date >= startDate && t.date <= endDate)
  }, [transactions, storeId, startDate, endDate])

  const filteredTx = useMemo(() => {
    const key = filterAToKey(filterA)

    return periodTx.filter((t) => {
      if (filterA === 'Έσοδα') {
        const isIncomeLike = t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received'
        if (!isIncomeLike) return false
      }

      if (filterA !== 'Όλες' && filterA !== 'Έσοδα') {
        if (normalizeExpenseCategory(t) !== key) return false
      }

      if (detailMode === 'staff' && detailId !== 'all') {
        if (String(t.fixed_asset_id) !== String(detailId)) return false
      }
      if (detailMode === 'supplier' && detailId !== 'all') {
        if (String(t.supplier_id) !== String(detailId)) return false
      }
      if (detailMode === 'revenue_source' && detailId !== 'all') {
        if (String(t.revenue_source_id) !== String(detailId)) return false
      }
      if (detailMode === 'maintenance' && detailId !== 'all') {
        if (String(t.fixed_asset_id) !== String(detailId)) return false
      }

      return true
    })
  }, [periodTx, filterA, detailMode, detailId, filterAToKey, normalizeExpenseCategory])

  const kpis = useMemo(() => {
    const income = filteredTx
      .filter((t) => t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const tips = filteredTx.filter((t) => t.type === 'tip_entry').reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const expenses = filteredTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const netProfit = income - expenses
    return { income, expenses, tips, netProfit }
  }, [filteredTx])

  // ✅ Z BREAKDOWN (μόνο όταν startDate === endDate)
  // FIXED per your rules:
  // 1) zCash: method === 'Μετρητά (Z)'
  // 2) zPos:  method === 'Κάρτα'
  // 3) blackCash: category === 'Εσοδα Ζ' AND (notes==='ΧΩΡΙΣ ΣΗΜΑΝΣΗ' OR method==='Μετρητά') AND method!=='Μετρητά (Z)'
  const zBreakdown = useMemo(() => {
    if (!isZReport) {
      return { zCash: 0, zPos: 0, blackCash: 0, totalTurnover: 0, blackPct: 0 }
    }

    const rows = periodTx
      .filter((t) => t.type === 'income')
      .map((t) => {
        const method = getMethod(t)
        const notes = String(t.notes || '').trim()
        const category = String(t.category || '').trim()
        const amount = Number(t.amount) || 0
        return { method, notes, category, amount }
      })

    const zCash = rows.filter((r) => r.method === 'Μετρητά (Z)').reduce((a, r) => a + r.amount, 0)
    const zPos = rows.filter((r) => r.method === 'Κάρτα').reduce((a, r) => a + r.amount, 0)

    const blackCash = rows
      .filter((r) => r.category === 'Εσοδα Ζ')
      .filter((r) => r.method !== 'Μετρητά (Z)') // όχι το επίσημο Z Cash
      .filter((r) => r.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || r.method === 'Μετρητά')
      .reduce((a, r) => a + r.amount, 0)

    const totalTurnover = zCash + zPos + blackCash
    const blackPct = totalTurnover > 0 ? (blackCash / totalTurnover) * 100 : 0

    return { zCash, zPos, blackCash, totalTurnover, blackPct }
  }, [isZReport, periodTx, getMethod])

  // ✅ CASH EXPENSES (Z day): όλα τα έξοδα της ημέρας που έγιναν με "Μετρητά"
  const cashExpensesToday = useMemo(() => {
    if (!isZReport) return 0
    return periodTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => getMethod(t) === 'Μετρητά')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
  }, [isZReport, periodTx, getMethod])

  const categoryBreakdown = useMemo(() => {
    const expenseTx = filteredTx.filter((t) => t.type === 'expense' || t.type === 'debt_payment')
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
  }, [filteredTx, normalizeExpenseCategory])

  const staffDetailsThisMonth = useMemo(() => {
    if (!storeId || storeId === 'null') return [] as Array<{ name: string; amount: number }>

    const staffTxs = monthTransactions
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .filter((t) => normalizeExpenseCategory(t) === 'Staff')

    const byStaff: Record<string, number> = {}
    for (const t of staffTxs) {
      const name = t.fixed_assets?.name || staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Άγνωστος'
      byStaff[name] = (byStaff[name] || 0) + Math.abs(Number(t.amount) || 0)
    }

    return Object.entries(byStaff)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [monthTransactions, storeId, normalizeExpenseCategory, staff])

  const collapsedPeriodList = useMemo(() => {
    const sortedTx = [...filteredTx].sort((a, b) => String(b.date).localeCompare(String(a.date)))

    const isZTransaction = (t: any) => t.category === 'Εσοδα Ζ' && t.type === 'income'

    const zByDate: Record<string, any[]> = {}
    const others: any[] = []

    for (const t of sortedTx) {
      if (isZTransaction(t)) {
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
        // “Χωρίς Σήμανση”: notes OR method=Μετρητά, αλλά ΟΧΙ επίσημο Z Cash
        if (method !== 'Μετρητά (Z)' && (notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ' || method === 'Μετρητά')) withoutMarking += rowAmount
      }

      return {
        id: `z-${date}`,
        date,
        type: 'income',
        category: 'Εσοδα Ζ',
        amount,
        payment_method: 'Z (Σύνολο)',
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

  const rangeText = useMemo(() => `${startDate} → ${endDate}`, [startDate, endDate])
  const money = useCallback((n: any) => `${Number(n || 0).toFixed(2)}€`, [])

  // ✅ TOTAL CASH DISPLAY
  // For Z day: (zCash + blackCash) - cash expenses made with "Μετρητά"
  const totalCashDisplay = useMemo(() => {
    if (isZReport) return zBreakdown.zCash + zBreakdown.blackCash - cashExpensesToday
    return Number(balances?.cash_balance || 0)
  }, [isZReport, zBreakdown, cashExpensesToday, balances])

  // ✅ For the big dark KPI on Z day we want the REAL drawer target too
  const bigKpiValue = useMemo(() => {
    return isZReport ? totalCashDisplay : kpis.netProfit
  }, [isZReport, totalCashDisplay, kpis.netProfit])

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* ✅ PRINT HEADER (only visible in print) */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* HEADER */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={headerIconBox}>📊</div>
            <div style={{ minWidth: 0 }}>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
              <div style={headerSub}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={handlePrint} style={headerCircleBtn} aria-label="print">
              <Printer size={18} />
            </button>
            <Link href={`/?store=${storeId}`} style={headerCircleBtn as any} aria-label="close">
              ✕
            </Link>
          </div>
        </div>

        {/* Range pill */}
        <div style={rangePill} className="no-print">
          {rangeText}
        </div>

        {/* FILTERS */}
        <div style={filterCard} className="no-print">
          <div style={filterHeaderRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={filterIconBubble}>⛃</div>
              <div>
                <div style={filterTitle}>Φίλτρα</div>
                <div style={filterSub}>Περίοδος, κατηγορία και drill-down</div>
              </div>
            </div>
          </div>

          <div style={filtersStack}>
            <div style={tile}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΑΠΟ</div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={tileControl}
                  inputMode="none"
                />
              </div>
            </div>

            <div style={tile}>
              <div style={tileIcon}>📅</div>
              <div style={tileBody}>
                <div style={tileLabel}>ΕΩΣ</div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={tileControl}
                  inputMode="none"
                />
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
              </div>
            )}

            <div style={rangeHint}>Περίοδος: {rangeText}</div>
          </div>
        </div>

        {/* ✅ KPIs */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, borderColor: '#d1fae5', background: 'linear-gradient(180deg, #ecfdf5, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.success }}>Έσοδα</div>
              <div style={{ ...kpiSign, color: colors.success }}>+</div>
            </div>
            <div style={{ ...kpiValue, color: colors.success }}>+ {kpis.income.toLocaleString('el-GR')}€</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.success }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', background: 'linear-gradient(180deg, #fff1f2, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: colors.danger }}>Έξοδα</div>
              <div style={{ ...kpiSign, color: colors.danger }}>-</div>
            </div>
            <div style={{ ...kpiValue, color: colors.danger }}>- {kpis.expenses.toLocaleString('el-GR')}€</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: colors.danger }} />
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#fde68a', background: 'linear-gradient(180deg, #fffbeb, #ffffff)' }}>
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#b45309' }}>Σύνολο Tips</div>
              <div style={{ ...kpiSign, color: '#b45309' }}>+</div>
            </div>
            <div style={{ ...kpiValue, color: '#b45309' }}>+ {kpis.tips.toLocaleString('el-GR')}€</div>
            <div style={kpiTrack}>
              <div style={{ ...kpiFill, width: '70%', background: '#f59e0b' }} />
            </div>
          </div>

          <div
            style={{
              ...kpiCard,
              borderColor: '#111827',
              background: 'linear-gradient(180deg, #0b1220, #111827)',
              color: '#fff',
            }}
          >
            <div style={kpiTopRow}>
              <div style={{ ...kpiLabel, color: '#fff' }}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</div>
              <div style={{ ...kpiSign, color: '#fff' }}>{bigKpiValue >= 0 ? '▲' : '▼'}</div>
            </div>
            <div style={{ ...kpiValue, color: '#fff' }}>{bigKpiValue.toLocaleString('el-GR')}€</div>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85, marginTop: 6 }}>
              {isZReport ? 'Μετρητά (Z)+Χωρίς Σήμανση - Έξοδα Μετρητά' : 'Income - Expenses'}
            </div>
          </div>
        </div>

        {/* ✅ NEW: BALANCES + CASH DRAWER KPIs */}
        <div style={balancesGrid} data-print-section="true">
          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Μετρητών</div>
            <div style={smallKpiValue}>{isZReport || balances ? money(totalCashDisplay) : '—'}</div>
            <div style={smallKpiHint}>
              {isZReport ? 'Μετρητά (Z)+Χωρίς Σήμανση - Έξοδα Μετρητά' : 'Μετρητά + Μετρητά (Z)'}
            </div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Υπόλοιπο Τράπεζας</div>
            <div style={smallKpiValue}>{balances ? money(balances.bank_balance) : '—'}</div>
            <div style={smallKpiHint}>Κάρτα + Τράπεζα</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Σύνολο Καθαρό</div>
            <div style={smallKpiValue}>{balances ? money(balances.total_balance) : '—'}</div>
            <div style={smallKpiHint}>Cash + Bank (+ όλα)</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Ταμείο Ημέρας (Z)</div>

            <div style={smallKpiValue}>{drawer ? money(drawer.total_cash_drawer) : '—'}</div>

            <div style={smallKpiHint}>{drawer ? `Ημερομηνία Ζ: ${drawer.date}` : `Δεν βρέθηκε Ζ έως: ${endDate}`}</div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 4 }}>
              {drawer ? `Z: ${money(drawer.z_cash)} • Extra: ${money(drawer.extra_cash)}` : ''}
            </div>
          </div>
        </div>

        {/* ✅ Z REPORT BREAKDOWN – μόνο όταν είναι ίδια μέρα */}
        {isZReport && (
          <div style={balancesGrid} data-print-section="true">
            <div
              style={{
                ...smallKpiCard,
                border: '1px solid rgba(15, 23, 42, 0.10)',
                background: 'linear-gradient(180deg, #eef2ff, #ffffff)',
              }}
            >
              <div style={smallKpiLabel}>Z Breakdown</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span style={{ color: '#64748b' }}>Μετρητά (Z)</span>
                  <span style={{ color: '#0f172a' }}>{money(zBreakdown.zCash)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span style={{ color: '#64748b' }}>Κάρτα (POS)</span>
                  <span style={{ color: '#0f172a' }}>{money(zBreakdown.zPos)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span style={{ color: '#64748b' }}>Χωρίς Σήμανση</span>
                  <span style={{ color: '#0f172a' }}>{money(zBreakdown.blackCash)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span style={{ color: '#64748b' }}>Σύνολο ημέρας</span>
                  <span style={{ color: '#0f172a' }}>{money(zBreakdown.totalTurnover)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                  <span style={{ color: '#64748b' }}>Έξοδα (Μετρητά)</span>
                  <span style={{ color: '#0f172a' }}>{money(cashExpensesToday)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 1000 }}>
                  <span style={{ color: '#0f172a' }}>Πραγματικό Συρτάρι</span>
                  <span style={{ color: '#0f172a' }}>{money(zBreakdown.zCash + zBreakdown.blackCash - cashExpensesToday)}</span>
                </div>
              </div>

              <div style={{ ...smallKpiHint, marginTop: 10 }}>Ημέρα: {startDate}</div>
            </div>

            <div
              style={{
                ...smallKpiCard,
                border:
                  zBreakdown.blackPct > 10
                    ? '1px solid #f43f5e'
                    : zBreakdown.blackPct > 5
                    ? '1px solid #f59e0b'
                    : '1px solid #10b981',
                background:
                  zBreakdown.blackPct > 10
                    ? 'linear-gradient(180deg, #fff1f2, #ffffff)'
                    : zBreakdown.blackPct > 5
                    ? 'linear-gradient(180deg, #fffbeb, #ffffff)'
                    : 'linear-gradient(180deg, #ecfdf5, #ffffff)',
              }}
            >
              <div style={smallKpiLabel}>Χωρίς Σήμανση</div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 1000,
                  marginTop: 8,
                  color: zBreakdown.blackPct > 10 ? '#f43f5e' : zBreakdown.blackPct > 5 ? '#f59e0b' : '#10b981',
                }}
              >
                {money(zBreakdown.blackCash)}
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 950,
                  marginTop: 6,
                  color: zBreakdown.blackPct > 10 ? '#f43f5e' : zBreakdown.blackPct > 5 ? '#f59e0b' : '#10b981',
                }}
              >
                {zBreakdown.blackPct.toFixed(1)}% του τζίρου ημέρας
              </div>

              <div style={smallKpiHint}>Cash σύνολο (Z + Χωρίς Σήμανση): {money(zBreakdown.zCash + zBreakdown.blackCash)}</div>
            </div>
          </div>
        )}

        {/* ✅ CATEGORY BREAKDOWN */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionTitleRow}>
            <div>
              <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
              <div style={sectionSub}>Κατανομή της περιόδου (χωρίς έσοδα)</div>
            </div>
            <div style={sectionPill}>Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR')}€</div>
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

                    <div style={{ ...catValue, color: c.color }}>{val.toLocaleString('el-GR')}€</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ✅ FULL MODE ONLY: STAFF DETAILS */}
        {printMode === 'full' && (
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
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>{s.amount.toLocaleString('el-GR')}€</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ FULL MODE ONLY: DETAILED TRANSACTIONS LIST */}
        {printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionTitleRow}>
              <div>
                <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
                <div style={sectionSub}>Λίστα κινήσεων με οντότητα, ποσό και σημειώσεις</div>
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

                  const isInc = t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received'
                  const isTip = t.type === 'tip_entry'
                  const isExp = t.type === 'expense' || t.type === 'debt_payment'

                  const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                  const pillBg = isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2'
                  const pillBr = isInc ? '#d1fae5' : isTip ? '#fde68a' : '#ffe4e6'
                  const pillTx = isInc ? colors.success : isTip ? '#92400e' : colors.danger

                  const pm = String((t.payment_method ?? t.method ?? '') || '').trim()

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap' }}>{t.date}</div>

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
                            {sign}
                            {absAmt.toLocaleString('el-GR')}€
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            color: colors.primary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {String(name || '').toUpperCase()}
                        </div>

                        {!!t.notes && <div style={{ fontSize: 14, fontWeight: 800, color: colors.secondary }}>{t.notes}</div>}

                        {!!pm && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: colors.secondary }}>
                            <span style={{ fontWeight: 900 }}>Μέθοδος:</span> {pm}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: colors.secondary }} data-print-section="true">
          * Όλα τα ποσά βασίζονται στις κινήσεις της βάσης για το επιλεγμένο store.
        </div>

        {/* ✅ PRINT BUTTON + MODE TOGGLE */}
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
            <Printer size={18} />
            Εκτύπωση Αναφοράς
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

// Page wrapper
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

// Header
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

// Range pill
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

// Filters card
const filterCard: any = {
  marginTop: 12,
  padding: 14,
  borderRadius: 26,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)',
}

const filterHeaderRow: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}

const filterIconBubble: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#eef2ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
  fontWeight: 900,
}

const filterTitle: any = { fontSize: 18, fontWeight: 950, color: colors.primary }
const filterSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }

// ✅ 1x1 filter tiles (stable across iOS/Android)
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

// KPI cards
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

const kpiTrack: any = { marginTop: 12, height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const kpiFill: any = { height: 8, borderRadius: 999 }

// ✅ NEW: balances grid styles
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

const smallKpiValue: any = {
  fontSize: 20,
  fontWeight: 1000,
  color: '#0f172a',
  marginTop: 8,
}

const smallKpiHint: any = {
  fontSize: 12,
  color: '#94a3b8',
  marginTop: 6,
  fontWeight: 700,
}

// Sections
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

// Category rows
const catRow: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 120px 110px',
  alignItems: 'center',
  gap: 12,
}

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

// List rows
const rowItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
}

const listRow: any = {
  padding: 14,
  borderRadius: 18,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
}

// Print controls
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

const printModeSwitchWrap: any = {
  display: 'flex',
  backgroundColor: '#e2e8f0',
  padding: 4,
  borderRadius: 14,
  gap: 6,
}

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

const printModeBtnActive: any = {
  backgroundColor: colors.indigo,
  color: '#fff',
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

const printHint: any = { fontSize: 13, fontWeight: 850, color: colors.secondary, textAlign: 'center' }

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}