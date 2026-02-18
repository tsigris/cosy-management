'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Users, ShoppingBag, Lightbulb, Wrench, Landmark, Printer } from 'lucide-react'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
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
  { key: 'Other', label: 'Λοιπά', color: '#64748b', Icon: Coins }
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

  // lists for dynamic filters + correct party names
  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  // ✅ Smart Dynamic Filters
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  // ✅ Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // ✅ Z report (same day)
  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  // ✅ NEW: Print Mode toggle
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

  [data-print-root="true"] * {
    box-shadow: none !important;
  }

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
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const txQuery = supabase
        .from('transactions')
        .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
        .eq('store_id', storeId)
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

      const [
        { data: tx, error: txErr },
        { data: staffData, error: staffErr },
        { data: supData, error: supErr },
        { data: revData, error: revErr },
        { data: maintData, error: maintErr }
      ] = await Promise.all([txQuery, staffQuery, suppliersQuery, revenueSourcesQuery, maintenanceQuery])

      if (txErr) throw txErr
      if (staffErr) throw staffErr
      if (supErr) throw supErr
      if (revErr) throw revErr
      if (maintErr) throw maintErr

      setTransactions(tx || [])
      setStaff(staffData || [])
      setSuppliers(supData || [])
      setRevenueSources(revData || [])
      setMaintenanceWorkers((maintData || []).filter((x: any) => String(x?.name || '').trim().length > 0))
    } catch (err) {
      console.error(err)
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const periodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    return transactions
      .filter((t) => t.store_id === storeId)
      .filter((t) => t.date >= startDate && t.date <= endDate)
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

    const tips = filteredTx
      .filter((t) => t.type === 'tip_entry')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const expenses = filteredTx
      .filter((t) => t.type === 'expense' || t.type === 'debt_payment')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const netProfit = income - expenses

    const cashIn = filteredTx
      .filter((t) => (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') && String(t.payment_method || '').toLowerCase() === 'cash')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const cashOut = filteredTx
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && String(t.payment_method || '').toLowerCase() === 'cash')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const cashNet = cashIn - cashOut

    return { income, expenses, tips, netProfit, cashNet, cashIn, cashOut }
  }, [filteredTx])

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

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const staffTxs = transactions
      .filter((t) => t.store_id === storeId)
      .filter((t) => t.date >= monthStart && t.date <= monthEnd)
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
  }, [transactions, storeId, normalizeExpenseCategory, staff])

  const periodList = useMemo(() => {
    return [...filteredTx].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [filteredTx])

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  const DetailIcon = useMemo(() => {
    if (detailMode === 'staff') return Users
    if (detailMode === 'supplier') return ShoppingBag
    if (detailMode === 'revenue_source') return Landmark
    if (detailMode === 'maintenance') return Wrench
    return null
  }, [detailMode])

  const detailLabel = useMemo(() => {
    if (detailMode === 'staff') return 'Λεπτομέρεια Υπαλλήλου'
    if (detailMode === 'supplier') return 'Λεπτομέρεια Εμπόρου'
    if (detailMode === 'revenue_source') return 'Λεπτομέρεια Πηγής Εσόδων'
    if (detailMode === 'maintenance') return 'Λεπτομέρεια Συντήρησης'
    return ''
  }, [detailMode])

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
        <div style={headerStyle} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>📊</div>
            <div>
              <h1 style={titleStyle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
              <p style={subLabelStyle}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={backBtnStyle}>
            ✕
          </Link>
        </div>

        {/* FILTERS */}
        <div style={filterCard} className="no-print">
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΑΠΟ</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΕΩΣ</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInput} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 12 }}>
            <div>
              <label style={dateLabel}>Φίλτρο Κατηγορίας</label>
              <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={selectInput}>
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
              <div>
                <label style={dateLabel}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {DetailIcon ? <DetailIcon size={18} /> : null}
                    {detailLabel}
                  </span>
                </label>

                <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={selectInput}>
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

          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
            Περίοδος: {startDate} → {endDate}
          </div>
        </div>

        {/* ✅ KPIs */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, color: '#92400e' }}>
                <Coins size={18} />
                Σύνολο Tips
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#92400e' }}>+</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>{kpis.tips.toLocaleString('el-GR')}€</div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>Έσοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>+</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>{kpis.income.toLocaleString('el-GR')}€</div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', backgroundColor: '#fff1f2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>Έξοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>-</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>{kpis.expenses.toLocaleString('el-GR')}€</div>
          </div>

          <div
            style={{
              ...kpiCard,
              borderColor: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#d1fae5' : '#ffe4e6',
              backgroundColor: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#f0fdf4' : '#fff1f2'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger
                }}
              >
                {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '▲' : '▼'}
              </span>
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger,
                marginTop: 10
              }}
            >
              {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '+' : ''}
              {(isZReport ? kpis.cashNet : kpis.netProfit).toLocaleString('el-GR')}€
            </div>

            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
              * Το Net δεν επηρεάζεται από Tips.
              {isZReport ? ' (Ταμείο = Μετρητά Έσοδα - Μετρητά Έξοδα)' : ''}
            </div>
          </div>
        </div>

        {/* ✅ CATEGORY BREAKDOWN */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR')}€</div>
          </div>

          {categoryBreakdown.total <= 0 ? (
            <div style={hintBox}>Δεν υπάρχουν έξοδα στην επιλεγμένη περίοδο.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CATEGORY_META.map((c) => {
                const val = categoryBreakdown.result[c.key] || 0
                const pct = categoryBreakdown.total > 0 ? (val / categoryBreakdown.total) * 100 : 0
                const Icon = c.Icon
                return (
                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={18} />
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>{c.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>{pct.toFixed(0)}%</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: c.color }}>{val.toLocaleString('el-GR')}€</span>
                      </div>
                    </div>

                    <div style={progressTrack}>
                      <div style={{ ...progressFill, width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
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
              <h3 style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</h3>
              <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>{format(new Date(), 'MMMM yyyy')}</div>
            </div>

            {staffDetailsThisMonth.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffDetailsThisMonth.map((s) => (
                  <div key={s.name} style={rowItem}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>{String(s.name || '').toUpperCase()}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: colors.secondary }}>Καταβλήθηκε</span>
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
              <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
              <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>{periodList.length} εγγραφές</div>
            </div>

            {loading ? (
              <div style={hintBox}>Φόρτωση...</div>
            ) : periodList.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν κινήσεις για το φίλτρο που επέλεξες.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {periodList.map((t: any) => {
                  const name = getPartyName(t)
                  const amt = Number(t.amount) || 0
                  const absAmt = Math.abs(amt)

                  const isInc = t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received'
                  const isTip = t.type === 'tip_entry'
                  const isExp = t.type === 'expense' || t.type === 'debt_payment'

                  const sign = isInc || isTip ? '+' : isExp ? '-' : ''
                  const pillBg = isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2'
                  const pillBr = isInc ? '#d1fae5' : isTip ? '#fde68a' : '#ffe4e6'
                  const pillTx = isInc ? colors.success : isTip ? '#92400e' : colors.danger

                  const norm = normalizeExpenseCategory(t)
                  const isStaff = norm === 'Staff'
                  const isSup = norm === 'Εμπορεύματα'
                  const isUtil = norm === 'Utilities'
                  const isMaint = norm === 'Maintenance'
                  const isRev = !!(t.revenue_source_id || t.revenue_sources?.name)

                  const pm = String(t.payment_method || '').trim()

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap' }}>{t.date}</div>

                          <div
                            style={{
                              padding: '6px 10px',
                              borderRadius: 999,
                              backgroundColor: pillBg,
                              border: `1px solid ${pillBr}`,
                              fontSize: 16,
                              fontWeight: 900,
                              color: pillTx,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sign}
                            {absAmt.toLocaleString('el-GR')}€
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {isRev ? (
                            <Landmark size={18} />
                          ) : isStaff ? (
                            <Users size={18} />
                          ) : isSup ? (
                            <ShoppingBag size={18} />
                          ) : isUtil ? (
                            <Lightbulb size={18} />
                          ) : isMaint ? (
                            <Wrench size={18} />
                          ) : isTip ? (
                            <Coins size={18} />
                          ) : (
                            <div style={{ width: 18, height: 18 }} />
                          )}

                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 900,
                              color: colors.secondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {name}
                          </div>
                        </div>

                        {!!t.notes && <div style={{ fontSize: 16, fontWeight: 800, color: colors.secondary }}>{t.notes}</div>}

                        {!!pm && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
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

        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 800, color: colors.secondary }} data-print-section="true">
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

// --- STYLES (✅ 16px everywhere) ---
const iphoneWrapper: any = {
  backgroundColor: colors.background,
  minHeight: '100%',
  padding: 20,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
  fontSize: 16,
  touchAction: 'pan-y',
  display: 'block'
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const titleStyle: any = { fontWeight: 900, fontSize: 16, margin: 0, color: colors.primary }
const subLabelStyle: any = { margin: 0, fontSize: 16, color: colors.secondary, fontWeight: 800 }
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.surface,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  border: `1px solid ${colors.border}`
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondary,
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontWeight: 900,
  fontSize: 16
}

const filterCard: any = {
  backgroundColor: colors.surface,
  padding: 16,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  marginBottom: 16
}

const dateLabel: any = { fontSize: 16, fontWeight: 900, color: colors.secondary, marginBottom: 8, display: 'block' }
const dateInput: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.background,
  color: colors.primary
}

const selectInput: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.background,
  color: colors.primary
}

const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }
const kpiCard: any = {
  backgroundColor: colors.surface,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16
}

const sectionCard: any = {
  backgroundColor: colors.surface,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  marginBottom: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
}

const sectionTitleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }
const sectionTitle: any = { margin: 0, fontSize: 16, fontWeight: 900, color: colors.primary }

const progressTrack: any = {
  height: 10,
  borderRadius: 999,
  backgroundColor: '#e5e7eb',
  overflow: 'hidden'
}
const progressFill: any = {
  height: 10,
  borderRadius: 999,
  transition: 'width 0.25s ease'
}

const hintBox: any = {
  padding: 14,
  borderRadius: 14,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  color: colors.secondary
}

const rowItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`
}

const listRow: any = {
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`
}

/* ✅ Print button + toggle styles */
const printWrap: any = {
  marginTop: 18,
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 10
}

const printModeSwitchWrap: any = {
  display: 'flex',
  backgroundColor: '#e2e8f0',
  padding: 4,
  borderRadius: 14,
  gap: 6
}

const printModeBtn: any = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: 'none',
  fontWeight: 900,
  fontSize: 16,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  color: colors.primary
}

const printModeBtnActive: any = {
  backgroundColor: colors.indigo,
  color: '#fff'
}

const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10
}

const printHint: any = { fontSize: 16, fontWeight: 800, color: colors.secondary, textAlign: 'center' }

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}