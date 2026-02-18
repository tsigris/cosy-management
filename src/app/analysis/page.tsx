'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback, useRef } from 'react'
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
  ChevronDown,
  Filter,
  Receipt,
  Sparkles,
} from 'lucide-react'

/* ---------------- PREMIUM PALETTE ---------------- */
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1',
  violet: '#7c3aed',
}

/* ---------------- CATEGORY META ---------------- */
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

  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  // Smart filters
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  // Date range (month)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // Z report (same day)
  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  // Print Mode
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  // Collapsible filters (premium UX)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const filtersBodyRef = useRef<HTMLDivElement | null>(null)
  const [filtersH, setFiltersH] = useState(0)

  useEffect(() => {
    const el = filtersBodyRef.current
    if (!el) return
    const measure = () => setFiltersH(el.scrollHeight || 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const el = filtersBodyRef.current
    if (!el) return
    setFiltersH(el.scrollHeight || 0)
  }, [filterA, detailMode, detailId, startDate, endDate])

  /* ---------------- PRINT CSS (inject once) ---------------- */
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
      .filter(
        (t) =>
          (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') &&
          String(t.payment_method || '').toLowerCase() === 'cash'
      )
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const cashOut = filteredTx
      .filter(
        (t) =>
          (t.type === 'expense' || t.type === 'debt_payment') &&
          String(t.payment_method || '').toLowerCase() === 'cash'
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

  const activeFilterChip = useMemo(() => {
    const items: string[] = []
    items.push(`${startDate} → ${endDate}`)
    if (filterA !== 'Όλες') items.push(filterA)
    if (detailMode !== 'none' && detailId !== 'all') {
      const found = detailOptions.find((x: any) => String(x.id) === String(detailId))
      if (found?.name) items.push(found.name)
    }
    return items
  }, [startDate, endDate, filterA, detailMode, detailId, detailOptions])

  return (
    <div style={pageWrap} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={container}>
        {/* PRINT HEADER (only on print) */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση:{' '}
            {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* TOP BAR */}
        <div style={topBar} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={appIcon}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={topTitle}>{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</div>
              <div style={topSubtitle}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={handlePrint} style={miniBtn} aria-label="print">
              <Printer size={16} />
            </button>

            <Link href={`/?store=${storeId}`} style={closeBtn} aria-label="close">
              ✕
            </Link>
          </div>
        </div>

        {/* ACTIVE FILTERS CHIPS */}
        <div className="no-print" style={chipRow}>
          {activeFilterChip.map((x, i) => (
            <div key={`${x}-${i}`} style={chip}>
              {x}
            </div>
          ))}
        </div>

        {/* FILTERS CARD (collapsible) */}
        <div className="no-print" style={card}>
          <button
            type="button"
            onClick={() => setFiltersOpen((p) => !p)}
            style={cardHeaderBtn}
            aria-label="toggle filters"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={iconPill}>
                <Filter size={16} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={cardTitle}>Φίλτρα</div>
                <div style={cardSub}>Περίοδος, κατηγορία και drill-down</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={badge}>{filtersOpen ? 'OPEN' : 'CLOSED'}</div>
              <ChevronDown
                size={18}
                style={{ transform: filtersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .18s ease' }}
              />
            </div>
          </button>

          <div
            style={{
              maxHeight: filtersOpen ? filtersH + 24 : 0,
              overflow: 'hidden',
              transition: 'max-height 320ms cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <div style={{ padding: 14 }}>
              <div ref={filtersBodyRef}>
                <div style={grid2}>
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
                  <label style={label}>Φίλτρο Κατηγορίας</label>
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
                        {DetailIcon ? <DetailIcon size={16} /> : null}
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
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, borderColor: '#fde68a', background: 'linear-gradient(180deg,#fffbeb,#ffffff)' }}>
            <div style={kpiTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: '#92400e' }}>
                <Coins size={16} /> Tips
              </div>
              <div style={kpiPill('#fffbeb', '#fde68a', '#92400e')}>+</div>
            </div>
            <div style={kpiValue(colors.primary)}>{kpis.tips.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Δεν αφαιρούνται από Net</div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#d1fae5', background: 'linear-gradient(180deg,#ecfdf5,#ffffff)' }}>
            <div style={kpiTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: colors.success }}>
                <Receipt size={16} /> Έσοδα
              </div>
              <div style={kpiPill('#ecfdf5', '#d1fae5', colors.success)}>+</div>
            </div>
            <div style={kpiValue(colors.primary)}>{kpis.income.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Income / Collections / Debt</div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', background: 'linear-gradient(180deg,#fff1f2,#ffffff)' }}>
            <div style={kpiTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, color: colors.danger }}>
                <Coins size={16} /> Έξοδα
              </div>
              <div style={kpiPill('#fff1f2', '#ffe4e6', colors.danger)}>-</div>
            </div>
            <div style={kpiValue(colors.primary)}>{kpis.expenses.toLocaleString('el-GR')}€</div>
            <div style={kpiHint}>Expense + Debt Payment</div>
          </div>

          <div
            style={{
              ...kpiCard,
              borderColor: (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#d1fae5' : '#ffe4e6',
              background:
                (isZReport ? kpis.cashNet : kpis.netProfit) >= 0
                  ? 'linear-gradient(180deg,#f0fdf4,#ffffff)'
                  : 'linear-gradient(180deg,#fff1f2,#ffffff)',
            }}
          >
            <div style={kpiTop}>
              <div style={{ fontWeight: 900, color: colors.primary }}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</div>
              <div
                style={kpiPill(
                  (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#f0fdf4' : '#fff1f2',
                  (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '#d1fae5' : '#ffe4e6',
                  (isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger
                )}
              >
                {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '▲' : '▼'}
              </div>
            </div>

            <div
              style={kpiValue((isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? colors.success : colors.danger)}
            >
              {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '+' : ''}
              {(isZReport ? kpis.cashNet : kpis.netProfit).toLocaleString('el-GR')}€
            </div>

            <div style={kpiHint}>
              {isZReport ? 'Cash In - Cash Out' : 'Income - Expenses'}
            </div>
          </div>
        </div>

        {/* CATEGORY BREAKDOWN */}
        <div style={card} data-print-section="true">
          <div style={sectionHead}>
            <div>
              <div style={sectionTitle}>Έξοδα ανά Κατηγορία</div>
              <div style={sectionSub}>Κατανομή της περιόδου (χωρίς έσοδα)</div>
            </div>
            <div style={rightStat}>
              <div style={rightStatLabel}>Σύνολο</div>
              <div style={rightStatValue}>{categoryBreakdown.total.toLocaleString('el-GR')}€</div>
            </div>
          </div>

          {categoryBreakdown.total <= 0 ? (
            <div style={emptyBox}>Δεν υπάρχουν έξοδα στην επιλεγμένη περίοδο.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {CATEGORY_META.map((c) => {
                const val = categoryBreakdown.result[c.key] || 0
                const pct = categoryBreakdown.total > 0 ? (val / categoryBreakdown.total) * 100 : 0
                const Icon = c.Icon
                return (
                  <div key={c.key} style={breakRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ ...miniIcon, color: c.color }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>{c.label}</div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: colors.secondary }}>{pct.toFixed(0)}%</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: c.color }}>
                          {val.toLocaleString('el-GR')}€
                        </div>
                      </div>
                    </div>

                    <div style={track}>
                      <div style={{ ...fill, width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FULL: STAFF DETAILS */}
        {printMode === 'full' && (
          <div style={card} data-print-section="true">
            <div style={sectionHead}>
              <div>
                <div style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</div>
                <div style={sectionSub}>Τρέχων μήνας (για γρήγορη εικόνα)</div>
              </div>
              <div style={badge}>{format(new Date(), 'MMMM yyyy')}</div>
            </div>

            {staffDetailsThisMonth.length === 0 ? (
              <div style={emptyBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffDetailsThisMonth.map((s) => (
                  <div key={s.name} style={rowItem}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <div style={rowTitle}>{String(s.name || '').toUpperCase()}</div>
                      <div style={rowSub}>Καταβλήθηκε</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>
                      {s.amount.toLocaleString('el-GR')}€
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FULL: TRANSACTIONS LIST */}
        {printMode === 'full' && (
          <div style={card} data-print-section="true">
            <div style={sectionHead}>
              <div>
                <div style={sectionTitle}>Κινήσεις Περιόδου</div>
                <div style={sectionSub}>Λίστα κινήσεων με οντότητα, ποσό και σημειώσεις</div>
              </div>

              <div style={rightStat}>
                <div style={rightStatLabel}>Εγγραφές</div>
                <div style={rightStatValue}>{periodList.length}</div>
              </div>
            </div>

            {loading ? (
              <div style={emptyBox}>Φόρτωση...</div>
            ) : periodList.length === 0 ? (
              <div style={emptyBox}>Δεν υπάρχουν κινήσεις για το φίλτρο που επέλεξες.</div>
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
                  const isStaffCat = norm === 'Staff'
                  const isSup = norm === 'Εμπορεύματα'
                  const isUtil = norm === 'Utilities'
                  const isMaint = norm === 'Maintenance'
                  const isRev = !!(t.revenue_source_id || t.revenue_sources?.name)

                  const pm = String(t.payment_method || '').trim()

                  const RowIcon = isRev
                    ? Landmark
                    : isStaffCat
                      ? Users
                      : isSup
                        ? ShoppingBag
                        : isUtil
                          ? Lightbulb
                          : isMaint
                            ? Wrench
                            : isTip
                              ? Coins
                              : null

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={rowIconBox(isInc, isTip)}>
                          {RowIcon ? <RowIcon size={18} /> : <div style={{ width: 18, height: 18 }} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <div style={rowDate}>{t.date}</div>
                            <div
                              style={{
                                padding: '7px 12px',
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

                          <div style={rowName} title={name}>
                            {name}
                          </div>

                          {!!t.notes && <div style={rowNotes}>{t.notes}</div>}

                          {!!pm && (
                            <div style={rowMeta}>
                              <span style={{ fontWeight: 900 }}>Μέθοδος:</span> {pm}
                            </div>
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

        {/* FOOT NOTE */}
        <div style={footNote} data-print-section="true">
          * Όλα τα ποσά βασίζονται στις κινήσεις της βάσης για το επιλεγμένο store.
        </div>

        {/* PRINT MODE + BUTTON */}
        <div className="no-print" style={printWrap}>
          <div style={switchWrap}>
            <button
              type="button"
              onClick={() => setPrintMode('summary')}
              style={{ ...switchBtn, ...(printMode === 'summary' ? switchBtnActive : {}) }}
            >
              Σύνοψη
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('full')}
              style={{ ...switchBtn, ...(printMode === 'full' ? switchBtnActive : {}) }}
            >
              Πλήρες
            </button>
          </div>

          <button type="button" onClick={handlePrint} style={printBtn}>
            <Printer size={18} />
            Εκτύπωση Αναφοράς
          </button>

          <div style={printHint}>
            Εκτύπωση: <b>{printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}</b> • Ανοίγει το παράθυρο εκτύπωσης για PDF.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */
const pageWrap: any = {
  minHeight: '100dvh',
  background:
    'radial-gradient(1200px 600px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(1200px 600px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  padding: 18,
}

const container: any = {
  maxWidth: 560,
  margin: '0 auto',
  paddingBottom: 140,
}

/* Sticky glass topbar */
const topBar: any = {
  position: 'sticky',
  top: 12,
  zIndex: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.06)',
}

const appIcon: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

const topTitle: any = { fontSize: 16, fontWeight: 900, color: colors.primary, margin: 0 }
const topSubtitle: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }

const closeBtn: any = {
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
  fontWeight: 900,
  fontSize: 16,
}

const miniBtn: any = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
  cursor: 'pointer',
}

/* Cards */
const card: any = {
  marginTop: 12,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  overflow: 'hidden',
}

const cardHeaderBtn: any = {
  width: '100%',
  border: 'none',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9))',
  padding: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  color: colors.primary,
}

const iconPill: any = {
  width: 38,
  height: 38,
  borderRadius: 14,
  background: '#eef2ff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

const cardTitle: any = { fontSize: 14, fontWeight: 900 }
const cardSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }

const badge: any = {
  padding: '6px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 11,
  fontWeight: 900,
  color: colors.primary,
}

/* Chips */
const chipRow: any = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 12,
}

const chip: any = {
  padding: '8px 10px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 12,
  fontWeight: 900,
  color: colors.primary,
}

/* Inputs */
const grid2: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const label: any = { fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 0.6, marginBottom: 6, display: 'block' }
const input: any = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  background: colors.background,
  fontWeight: 800,
  fontSize: 16,
  outline: 'none',
  color: colors.primary,
}

/* KPI grid */
const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }
const kpiCard: any = {
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  background: '#fff',
}

const kpiTop: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const kpiPill = (bg: string, br: string, tx: string): any => ({
  padding: '7px 10px',
  borderRadius: 999,
  backgroundColor: bg,
  border: `1px solid ${br}`,
  color: tx,
  fontWeight: 900,
  fontSize: 12,
  minWidth: 34,
  textAlign: 'center',
})

const kpiValue = (color: string): any => ({
  marginTop: 10,
  fontSize: 28,
  fontWeight: 900,
  color,
  letterSpacing: -0.2,
})

const kpiHint: any = { marginTop: 6, fontSize: 12, fontWeight: 800, color: colors.secondary }

/* Sections */
const sectionHead: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  padding: 16,
  borderBottom: `1px solid ${colors.border}`,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92))',
}

const sectionTitle: any = { fontSize: 16, fontWeight: 900, color: colors.primary }
const sectionSub: any = { marginTop: 4, fontSize: 12, fontWeight: 800, color: colors.secondary }

const rightStat: any = { textAlign: 'right' }
const rightStatLabel: any = { fontSize: 11, fontWeight: 900, color: colors.secondary }
const rightStatValue: any = { fontSize: 16, fontWeight: 900, color: colors.primary, marginTop: 2 }

const emptyBox: any = {
  padding: 16,
  fontSize: 14,
  fontWeight: 800,
  color: colors.secondary,
}

/* Breakdown rows */
const breakRow: any = { padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }
const miniIcon: any = {
  width: 34,
  height: 34,
  borderRadius: 14,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const track: any = { height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const fill: any = { height: 10, borderRadius: 999, transition: 'width 0.25s ease' }

/* List rows */
const listRow: any = {
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: colors.background,
  padding: 14,
}

const rowIconBox = (isInc: boolean, isTip: boolean): any => ({
  width: 44,
  height: 44,
  borderRadius: 16,
  background: isInc ? '#ecfdf5' : isTip ? '#fffbeb' : '#fff1f2',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: isInc ? colors.success : isTip ? '#92400e' : colors.danger,
  flex: '0 0 auto',
})

const rowDate: any = { fontSize: 12, fontWeight: 900, color: colors.secondary }
const rowName: any = {
  marginTop: 6,
  fontSize: 16,
  fontWeight: 900,
  color: colors.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const rowNotes: any = { marginTop: 6, fontSize: 13, fontWeight: 800, color: colors.secondary }
const rowMeta: any = { marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.secondary }

/* Staff rows */
const rowItem: any = {
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: colors.background,
  padding: 14,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}
const rowTitle: any = { fontSize: 14, fontWeight: 900, color: colors.primary }
const rowSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary }

/* Footer */
const footNote: any = { marginTop: 12, fontSize: 12, fontWeight: 800, color: colors.secondary, textAlign: 'center' }

/* Print controls */
const printWrap: any = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15, 23, 42, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const switchWrap: any = { display: 'flex', background: '#e2e8f0', padding: 4, borderRadius: 14, gap: 6 }
const switchBtn: any = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: 'none',
  fontWeight: 900,
  fontSize: 14,
  cursor: 'pointer',
  background: 'transparent',
  color: colors.primary,
}
const switchBtnActive: any = { background: colors.indigo, color: '#fff' }

const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 900,
  background: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  boxShadow: '0 12px 18px rgba(99,102,241,0.22)',
}

const printHint: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, textAlign: 'center' }

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}