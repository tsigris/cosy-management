'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Users, ShoppingBag, Lightbulb, Wrench, Landmark, Printer, BarChart3, X } from 'lucide-react'

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
  soft: '#f1f5f9'
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
  html, body { background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
  a { text-decoration: none !important; color: #000 !important; }

  [data-print-root="true"] {
    position: static !important;
    overflow: visible !important;
    padding: 0 !important;
    min-height: auto !important;
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
      const name =
        t.fixed_assets?.name ||
        staff.find((s) => String(s.id) === String(t.fixed_asset_id))?.name ||
        'Άγνωστος'
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

  const detailLabel = useMemo(() => {
    if (detailMode === 'staff') return 'Λεπτομέρεια Υπαλλήλου'
    if (detailMode === 'supplier') return 'Λεπτομέρεια Εμπόρου'
    if (detailMode === 'revenue_source') return 'Λεπτομέρεια Πηγής Εσόδων'
    if (detailMode === 'maintenance') return 'Λεπτομέρεια Συντήρησης'
    return 'Λεπτομέρεια'
  }, [detailMode])

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* PRINT HEADER (only visible in print) */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* HEADER */}
        <div style={topHeader} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={heroIcon}>
              <BarChart3 size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={heroTitle}>Ανάλυση</div>
              <div style={heroSub}>{isZReport ? 'ΑΝΑΦΟΡΑ ΗΜΕΡΑΣ (Ζ)' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
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

        {/* Period pill */}
        <div style={periodPill} className="no-print">
          {startDate} → {endDate}
        </div>

        {/* ✅ CLEAN FILTERS (works same on iPhone + Android) */}
        <div style={filterCardClean} className="no-print">
          <div style={filterTitleClean}>Φίλτρα</div>
          <div style={filterSubClean}>Περίοδος, κατηγορία και drill-down</div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Από</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={fieldInput}
              inputMode="none"
            />
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Έως</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={fieldInput}
              inputMode="none"
            />
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Φίλτρο Κατηγορίας</label>
            <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={fieldInput}>
              <option value="Όλες">Όλες</option>
              <option value="Έσοδα">Έσοδα</option>
              <option value="Εμπορεύματα">Εμπορεύματα</option>
              <option value="Προσωπικό">Προσωπικό</option>
              <option value="Λογαριασμοί">Λογαριασμοί</option>
              <option value="Συντήρηση">Συντήρηση</option>
              <option value="Λοιπά">Λοιπά</option>
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>{detailLabel}</label>
            <select
              value={detailId}
              onChange={(e) => setDetailId(e.target.value)}
              style={{ ...fieldInput, opacity: detailMode === 'none' ? 0.6 : 1 }}
              disabled={detailMode === 'none'}
            >
              <option value="all">Όλοι</option>
              {detailMode !== 'none' &&
                detailOptions.map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* KPI CARDS */}
        <div style={kpiGrid2} data-print-section="true">
          <div style={{ ...kpiCard2, background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 70%)' }}>
            <div style={kpiLabel}>Έσοδα</div>
            <div style={{ ...kpiValue, color: colors.success }}>+ {kpis.income.toLocaleString('el-GR')}€</div>
            <div style={miniTrack}>
              <div style={{ ...miniFill, width: '68%', background: colors.success }} />
            </div>
          </div>

          <div style={{ ...kpiCard2, background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 70%)' }}>
            <div style={kpiLabel}>Έξοδα</div>
            <div style={{ ...kpiValue, color: colors.danger }}>- {kpis.expenses.toLocaleString('el-GR')}€</div>
            <div style={miniTrack}>
              <div style={{ ...miniFill, width: '68%', background: colors.danger }} />
            </div>
          </div>

          <div style={{ ...kpiCard2, background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 70%)' }}>
            <div style={kpiLabel}>Σύνολο Tips</div>
            <div style={{ ...kpiValue, color: '#b45309' }}>+ {kpis.tips.toLocaleString('el-GR')}€</div>
            <div style={miniTrack}>
              <div style={{ ...miniFill, width: '68%', background: '#f59e0b' }} />
            </div>
          </div>

          <div style={{ ...kpiCard2, background: 'linear-gradient(180deg, #0b1220 0%, #111827 70%)', borderColor: '#0b1220' }}>
            <div style={{ ...kpiLabel, color: '#e5e7eb' }}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</div>
            <div style={{ ...kpiValue, color: '#ffffff' }}>
              {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '+' : '-'} {Math.abs(isZReport ? kpis.cashNet : kpis.netProfit).toLocaleString('el-GR')}€
            </div>
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: '#cbd5e1' }}>Income - Expenses</div>
          </div>
        </div>

        {/* CATEGORY BREAKDOWN */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionHeadRow}>
            <div>
              <div style={sectionTitle}>Έξοδα ανά Κατηγορία</div>
              <div style={sectionSub}>Κατανομή της περιόδου (χωρίς έσοδα)</div>
            </div>
            <div style={totalPill}>
              Σύνολο&nbsp;&nbsp;<b>{categoryBreakdown.total.toLocaleString('el-GR')}€</b>
            </div>
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
                      <div style={catIcon}>
                        <Icon size={18} />
                      </div>
                      <div style={catLabel}>{c.label}</div>
                    </div>

                    <div style={catMid}>
                      <div style={catPct}>{pct.toFixed(0)}%</div>
                      <div style={catBarTrack}>
                        <div style={{ ...catBarFill, width: `${pct}%`, background: c.color }} />
                      </div>
                    </div>

                    <div style={{ ...catAmount, color: c.color }}>{val.toLocaleString('el-GR')}€</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* STAFF DETAILS */}
        {printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionHeadRow}>
              <div>
                <div style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</div>
                <div style={sectionSub}>Τρέχων μήνας (για γρήγορη εικόνα)</div>
              </div>
              <div style={monthPill}>{format(new Date(), 'MMMM yyyy')}</div>
            </div>

            {staffDetailsThisMonth.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffDetailsThisMonth.map((s) => (
                  <div key={s.name} style={staffRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={staffName}>{String(s.name || '').toUpperCase()}</div>
                      <div style={staffSub}>Καταβλήθηκε</div>
                    </div>
                    <div style={staffAmt}>{s.amount.toLocaleString('el-GR')}€</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS LIST */}
        {printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionHeadRow}>
              <div>
                <div style={sectionTitle}>Κινήσεις Περιόδου</div>
                <div style={sectionSub}>Λίστα κινήσεων με οντότητα, ποσό και σημειώσεις</div>
              </div>
              <div style={countPill}>Εγγραφές&nbsp;&nbsp;<b>{periodList.length}</b></div>
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

                  const pm = String(t.payment_method || '').trim()

                  return (
                    <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow} data-print-row="true">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={txDate}>{t.date}</div>

                          <div
                            style={{
                              padding: '6px 10px',
                              borderRadius: 999,
                              backgroundColor: pillBg,
                              border: `1px solid ${pillBr}`,
                              fontSize: 15,
                              fontWeight: 900,
                              color: pillTx,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sign}
                            {absAmt.toLocaleString('el-GR')}€
                          </div>
                        </div>

                        <div style={txName}>{name}</div>
                        {!!t.notes && <div style={txNote}>{t.notes}</div>}
                        {!!pm && (
                          <div style={txMeta}>
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

        {/* PRINT BUTTON + MODE TOGGLE */}
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
        </div>
      </div>
    </div>
  )
}

/* ---------------- STYLES ---------------- */
const iphoneWrapper: any = {
  background:
    'radial-gradient(900px 500px at 20% -10%, #eef2ff 0%, rgba(238,242,255,0) 55%), radial-gradient(900px 500px at 90% 0%, #ecfdf5 0%, rgba(236,253,245,0) 55%), #f8fafc',
  minHeight: '100dvh',
  padding: 16,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflowY: 'auto',
  touchAction: 'pan-y',
  display: 'block'
}

const topHeader: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 14,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)',
  position: 'sticky',
  top: 10,
  zIndex: 10
}

const heroIcon: any = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: '#0b1220',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 14px 22px rgba(2,6,23,0.25)'
}
const heroTitle: any = { fontSize: 20, fontWeight: 950, color: colors.primary, lineHeight: '22px' }
const heroSub: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, letterSpacing: 0.6, marginTop: 2 }

const iconBtn: any = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.primary,
  textDecoration: 'none',
  boxShadow: '0 10px 18px rgba(15,23,42,0.06)'
}

const periodPill: any = {
  marginTop: 12,
  padding: '10px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.9)',
  border: `1px solid ${colors.border}`,
  fontWeight: 900,
  color: colors.primary
}

/* ✅ Clean filter card */
const filterCardClean: any = {
  marginTop: 12,
  backgroundColor: 'rgba(255,255,255,0.92)',
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  padding: 14,
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)'
}
const filterTitleClean: any = { fontSize: 18, fontWeight: 950, color: colors.primary }
const filterSubClean: any = { marginTop: 4, fontSize: 13, fontWeight: 800, color: colors.secondary }

const fieldGroup: any = { marginTop: 12 }
const fieldLabel: any = { display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 950, color: colors.secondary }

const fieldInput: any = {
  width: '100%',
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  color: colors.primary,
  fontSize: 16,
  fontWeight: 900,
  outline: 'none',
  WebkitAppearance: 'none',
  appearance: 'none'
}

/* KPI */
const kpiGrid2: any = { marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const kpiCard2: any = {
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: 14,
  boxShadow: '0 16px 26px rgba(15,23,42,0.05)'
}
const kpiLabel: any = { fontSize: 16, fontWeight: 950, color: colors.primary }
const kpiValue: any = { fontSize: 22, fontWeight: 950, marginTop: 10 }
const miniTrack: any = { height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginTop: 12 }
const miniFill: any = { height: 10, borderRadius: 999 }

/* Section */
const sectionCard: any = {
  marginTop: 14,
  backgroundColor: 'rgba(255,255,255,0.92)',
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  padding: 14,
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)'
}
const sectionHeadRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }
const sectionTitle: any = { fontSize: 18, fontWeight: 950, color: colors.primary }
const sectionSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 4 }

const totalPill: any = {
  padding: '10px 12px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 13,
  fontWeight: 900,
  color: colors.primary,
  whiteSpace: 'nowrap'
}
const monthPill: any = { ...totalPill }
const countPill: any = { ...totalPill }

const hintBox: any = {
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 800,
  color: colors.secondary
}

/* Category rows (no truncation) */
const catRow: any = {
  display: 'grid',
  gridTemplateColumns: '1fr 160px 110px',
  gap: 12,
  alignItems: 'center',
  minWidth: 0
}
const catLeft: any = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }
const catIcon: any = {
  width: 40,
  height: 40,
  borderRadius: 999,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.secondary,
  flex: '0 0 auto'
}
const catLabel: any = { fontSize: 16, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap' }
const catMid: any = { display: 'flex', alignItems: 'center', gap: 10 }
const catPct: any = { width: 44, textAlign: 'right', fontSize: 14, fontWeight: 900, color: colors.secondary, whiteSpace: 'nowrap' }
const catBarTrack: any = { flex: 1, height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }
const catBarFill: any = { height: 10, borderRadius: 999 }
const catAmount: any = { textAlign: 'right', fontSize: 16, fontWeight: 950, whiteSpace: 'nowrap' }

/* Staff */
const staffRow: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: 14,
  borderRadius: 18,
  background: '#fff',
  border: `1px solid ${colors.border}`
}
const staffName: any = { fontSize: 15, fontWeight: 950, color: colors.primary }
const staffSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 4 }
const staffAmt: any = { fontSize: 16, fontWeight: 950, color: '#0ea5e9', whiteSpace: 'nowrap' }

/* Transactions */
const listRow: any = { padding: 14, borderRadius: 18, backgroundColor: '#fff', border: `1px solid ${colors.border}` }
const txDate: any = { fontSize: 13, fontWeight: 900, color: colors.secondary, whiteSpace: 'nowrap' }
const txName: any = { fontSize: 18, fontWeight: 950, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const txNote: any = { fontSize: 13, fontWeight: 800, color: colors.secondary }
const txMeta: any = { fontSize: 13, fontWeight: 800, color: colors.secondary }

/* Print block */
const printWrap: any = {
  marginTop: 16,
  padding: 14,
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 14px 26px rgba(15,23,42,0.06)'
}
const printModeSwitchWrap: any = { display: 'flex', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 14, gap: 6 }
const printModeBtn: any = { flex: 1, padding: 12, borderRadius: 10, border: 'none', fontWeight: 950, fontSize: 14, cursor: 'pointer', backgroundColor: 'transparent', color: colors.primary }
const printModeBtnActive: any = { backgroundColor: colors.indigo, color: '#fff' }
const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 16,
  border: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 950,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  boxShadow: '0 16px 22px rgba(99,102,241,0.25)'
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