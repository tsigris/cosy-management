'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'
import {
  Coins,
  Users,
  ShoppingBag,
  Lightbulb,
  Wrench,
  Landmark,
  Printer,
  Sparkles,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
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

  // ✅ Print Mode toggle
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  // ✅ Filters accordion (photo-style)
  const [filtersOpen, setFiltersOpen] = useState(true)

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
        { data: maintData, error: maintErr },
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
    return transactions.filter((t) => t.store_id === storeId).filter((t) => t.date >= startDate && t.date <= endDate)
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
      .filter(
        (t) =>
          (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') &&
          String(t.payment_method || '').toLowerCase() === 'cash'
      )
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const cashOut = filteredTx
      .filter(
        (t) =>
          (t.type === 'expense' || t.type === 'debt_payment') && String(t.payment_method || '').toLowerCase() === 'cash'
      )
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
      const name =
        t.fixed_assets?.name || staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name || 'Άγνωστος'
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

  const periodLabel = useMemo(() => {
    return `${startDate} → ${endDate}`
  }, [startDate, endDate])

  return (
    <div style={pageWrap} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={container}>
        {/* ✅ PRINT HEADER (only visible in print) */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* ✅ PHOTO-STYLE HEADER */}
        <div style={topHeaderCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={headerIconPill}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
              <div style={headerSub}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={handlePrint} style={iconBtn} aria-label="print">
              <Printer size={18} />
            </button>
            <Link href={`/?store=${storeId}`} style={iconBtn as any} aria-label="close">
              <X size={18} />
            </Link>
          </div>
        </div>

        {/* ✅ PERIOD PILL */}
        <div className="no-print" style={periodPill}>
          {periodLabel}
        </div>

        {/* ✅ FILTERS CARD (collapsible like photo) */}
        <div style={filtersCard} className="no-print">
          <button
            type="button"
            onClick={() => setFiltersOpen((p) => !p)}
            style={filtersHeaderBtn}
            aria-label="toggle filters"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={filtersIconWrap}>
                <Filter size={18} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={filtersTitle}>Φίλτρα</div>
                <div style={filtersSub}>Περίοδος, κατηγορία και drill-down</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={openPill(filtersOpen)}>{filtersOpen ? 'OPEN' : 'CLOSED'}</div>
              {filtersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </button>

          {filtersOpen && (
            <div style={filtersBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>ΑΠΟ</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={input}
                  />
                </div>
                <div>
                  <label style={label}>ΕΩΣ</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={input}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={label}>ΦΙΛΤΡΟ ΚΑΤΗΓΟΡΙΑΣ</label>
                <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={input}>
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
                  <label style={label}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {DetailIcon ? <DetailIcon size={18} /> : null}
                      {detailLabel}
                    </span>
                  </label>

                  <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={input}>
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
          )}
        </div>

        {/* ✅ KPIs */}
        <div style={kpiGrid} data-print-section="true">
          <div style={kpiCardWarm}>
            <div style={kpiTopRow}>
              <span style={kpiTitleWarm}>
                <Coins size={18} />
                Tips
              </span>
              <span style={kpiMini}>+</span>
            </div>
            <div style={kpiValue}>{kpis.tips.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Δεν αφαιρούνται από Net</div>
          </div>

          <div style={kpiCardGreen}>
            <div style={kpiTopRow}>
              <span style={kpiTitleGreen}>Έσοδα</span>
              <span style={kpiMini}>+</span>
            </div>
            <div style={kpiValue}>{kpis.income.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Σύνολο εισπράξεων περιόδου</div>
          </div>

          <div style={kpiCardRed}>
            <div style={kpiTopRow}>
              <span style={kpiTitleRed}>Έξοδα</span>
              <span style={kpiMini}>-</span>
            </div>
            <div style={kpiValue}>{kpis.expenses.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Με πληρωμές & έξοδα</div>
          </div>

          <div
            style={{
              ...kpiCardBase,
              borderColor: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#d1fae5' : '#ffe4e6',
              background: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#f0fdf4' : '#fff1f2',
            }}
          >
            <div style={kpiTopRow}>
              <span style={kpiTitleDark}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</span>
              <span
                style={{
                  ...kpiMini,
                  color: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger,
                }}
              >
                {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '▲' : '▼'}
              </span>
            </div>

            <div
              style={{
                ...kpiValue,
                color: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger,
              }}
            >
              {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '+' : ''}
              {(isZReport ? kpis.cashNet : kpis.netProfit).toLocaleString('el-GR')}€
            </div>

            <div style={kpiHint}>
              * Το Net δεν επηρεάζεται από Tips.
              {isZReport ? ' (Ταμείο = Μετρητά Έσοδα - Μετρητά Έξοδα)' : ''}
            </div>
          </div>
        </div>

        {/* ✅ CATEGORY BREAKDOWN */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
            <div style={sectionMeta}>Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR')}€</div>
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
                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={catRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={catIconWrap}>
                          <Icon size={18} />
                        </div>
                        <span style={catLabel}>{c.label}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={catPct}>{pct.toFixed(0)}%</span>
                        <span style={{ ...catVal, color: c.color }}>{val.toLocaleString('el-GR')}€</span>
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
              <div style={sectionMeta}>{format(new Date(), 'MMMM yyyy')}</div>
            </div>

            {staffDetailsThisMonth.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffDetailsThisMonth.map((s) => (
                  <div key={s.name} style={rowItem}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={rowTitle}>{String(s.name || '').toUpperCase()}</span>
                      <span style={rowSub}>Καταβλήθηκε</span>
                    </div>
                    <div style={rowAmountBlue}>{s.amount.toLocaleString('el-GR')}€</div>
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
              <div style={sectionMeta}>{periodList.length} εγγραφές</div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                        <div style={listTopRow}>
                          <div style={dateBadge}>{t.date}</div>

                          <div
                            style={{
                              ...amountPill,
                              backgroundColor: pillBg,
                              border: `1px solid ${pillBr}`,
                              color: pillTx,
                            }}
                          >
                            {sign}
                            {absAmt.toLocaleString('el-GR')}€
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div style={typeIconPill(isInc, isTip)}>
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
                              <Coins size={18} />
                            )}
                          </div>

                          <div style={listTitle}>{name}</div>
                        </div>

                        {!!t.notes && <div style={listNote}>{t.notes}</div>}

                        {!!pm && (
                          <div style={listMeta}>
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

        <div style={footNote} data-print-section="true">
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

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */

const pageWrap: any = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  padding: 20,
  touchAction: 'pan-y',
}

const container: any = { maxWidth: 560, margin: '0 auto', paddingBottom: 120 }

/* Header card like photo */
const topHeaderCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: 14,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.06)',
  position: 'sticky',
  top: 12,
  zIndex: 10,
}

const headerIconPill: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

const headerTitle: any = { fontSize: 16, fontWeight: 900, color: colors.primary }
const headerSub: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, marginTop: 2 }

const iconBtn: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#94a3b8',
  textDecoration: 'none',
}

/* Period pill */
const periodPill: any = {
  marginTop: 12,
  width: 'fit-content',
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 10px 18px rgba(15,23,42,0.05)',
  fontSize: 14,
  fontWeight: 900,
  color: colors.primary,
}

/* Filters card */
const filtersCard: any = {
  marginTop: 14,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  overflow: 'hidden',
}

const filtersHeaderBtn: any = {
  width: '100%',
  padding: 14,
  border: 'none',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.88))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  color: colors.primary,
}

const filtersIconWrap: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#eef2ff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

const filtersTitle: any = { fontSize: 14, fontWeight: 900 }
const filtersSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }
const filtersBody: any = { padding: 14 }

const openPill = (open: boolean): any => ({
  padding: '8px 12px',
  borderRadius: 999,
  border: `1px solid ${open ? '#c7d2fe' : colors.border}`,
  background: '#fff',
  color: open ? colors.indigo : colors.secondary,
  fontSize: 12,
  fontWeight: 900,
})

/* Inputs (16px to avoid mobile zoom) */
const label: any = { fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 0.6, marginBottom: 6, display: 'block' }
const input: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontWeight: 900,
  fontSize: 16,
  outline: 'none',
  color: colors.primary,
  boxShadow: '0 6px 14px rgba(15,23,42,0.04)',
}

/* KPI */
const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 16, marginBottom: 16 }
const kpiCardBase: any = {
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  padding: 16,
  background: '#fff',
  boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
}
const kpiCardWarm: any = { ...kpiCardBase, borderColor: '#fde68a', background: '#fffbeb' }
const kpiCardGreen: any = { ...kpiCardBase, borderColor: '#d1fae5', background: '#ecfdf5' }
const kpiCardRed: any = { ...kpiCardBase, borderColor: '#ffe4e6', background: '#fff1f2' }

const kpiTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const kpiMini: any = { fontSize: 14, fontWeight: 900, color: colors.secondary }

const kpiTitleWarm: any = { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900, color: '#92400e' }
const kpiTitleGreen: any = { fontSize: 14, fontWeight: 900, color: colors.success }
const kpiTitleRed: any = { fontSize: 14, fontWeight: 900, color: colors.danger }
const kpiTitleDark: any = { fontSize: 14, fontWeight: 900, color: colors.primary }
const kpiValue: any = { fontSize: 30, fontWeight: 900, color: colors.primary, marginTop: 10 }
const kpiHint: any = { marginTop: 10, fontSize: 13, fontWeight: 800, color: colors.secondary }

/* Sections */
const sectionCard: any = {
  backgroundColor: 'rgba(255,255,255,0.92)',
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  padding: 16,
  marginBottom: 16,
  boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
}

const sectionTitleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }
const sectionTitle: any = { margin: 0, fontSize: 16, fontWeight: 900, color: colors.primary }
const sectionMeta: any = { fontSize: 13, fontWeight: 900, color: colors.secondary }

const hintBox: any = {
  padding: 14,
  borderRadius: 16,
  backgroundColor: '#f8fafc',
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 800,
  color: colors.secondary,
}

/* Category rows */
const catRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }
const catIconWrap: any = { width: 36, height: 36, borderRadius: 14, border: `1px solid ${colors.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary }
const catLabel: any = { fontSize: 14, fontWeight: 900, color: colors.primary }
const catPct: any = { fontSize: 13, fontWeight: 900, color: colors.secondary }
const catVal: any = { fontSize: 14, fontWeight: 900 }

const progressTrack: any = { height: 10, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' }
const progressFill: any = { height: 10, borderRadius: 999, transition: 'width 0.25s ease' }

/* Staff rows */
const rowItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  backgroundColor: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 6px 14px rgba(15,23,42,0.04)',
}
const rowTitle: any = { fontSize: 14, fontWeight: 900, color: colors.primary }
const rowSub: any = { fontSize: 13, fontWeight: 800, color: colors.secondary }
const rowAmountBlue: any = { fontSize: 14, fontWeight: 900, color: '#0ea5e9' }

/* Transactions list */
const listRow: any = {
  padding: 14,
  borderRadius: 18,
  backgroundColor: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 6px 14px rgba(15,23,42,0.04)',
}
const listTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }
const dateBadge: any = { fontSize: 13, fontWeight: 900, color: colors.secondary }
const amountPill: any = { padding: '10px 12px', borderRadius: 999, fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }

const typeIconPill = (isInc: boolean, isTip: boolean): any => ({
  width: 44,
  height: 44,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
})

const listTitle: any = { fontSize: 14, fontWeight: 900, color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const listNote: any = { fontSize: 13, fontWeight: 800, color: colors.secondary }
const listMeta: any = { fontSize: 13, fontWeight: 800, color: colors.secondary }

/* Print footer area */
const footNote: any = { marginTop: 10, fontSize: 13, fontWeight: 800, color: colors.secondary }

const printWrap: any = {
  marginTop: 18,
  padding: 14,
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
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
  fontWeight: 900,
  fontSize: 14,
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
  fontSize: 14,
  fontWeight: 900,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  boxShadow: '0 14px 24px rgba(99,102,241,0.22)',
}

const printHint: any = { fontSize: 13, fontWeight: 800, color: colors.secondary, textAlign: 'center' }

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}