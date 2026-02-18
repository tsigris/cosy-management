'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { el } from 'date-fns/locale'
import { toast, Toaster } from 'sonner'
import {
  Coins,
  Users,
  ShoppingBag,
  Lightbulb,
  Wrench,
  Landmark,
  Printer,
  BarChart3,
  Calendar,
  Filter,
  ListFilter
} from 'lucide-react'

/* ---------------- PALETTE ---------------- */
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
  surface: '#ffffff',
  indigo: '#6366f1',
  success: '#10b981',
  danger: '#f43f5e',
  amber: '#f59e0b',
  darkCard: '#0b1220'
}

/* --- CATEGORY META (required order & icons) --- */
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

/* ---------------- HELPERS ---------------- */
const toGreekDate = (yyyyMMdd: string) => {
  if (!yyyyMMdd) return ''
  const [y, m, d] = String(yyyyMMdd).split('-')
  if (!y || !m || !d) return yyyyMMdd
  return `${d}/${m}/${y}`
}

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

  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  // “Θέλω να βλέπω τα πάντα” → default FULL
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  /* -------- PRINT CSS -------- */
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

  [data-print-root="true"]{
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

  /* ---------------- FIXED DATE FIELD (works iPhone + Android) ----------------
     - Το input date είναι ΠΑΝΩ σε όλο το “pill” (άρα ανοίγει παντού)
     - Αλλά είναι σχεδόν αόρατο
     - Από κάτω/πίσω δείχνουμε εμείς dd/MM/yyyy
  */
  const DateField = ({
    label,
    value,
    onChange
  }: {
    label: string
    value: string
    onChange: (v: string) => void
  }) => {
    const inputRef = useRef<HTMLInputElement | null>(null)

    return (
      <div style={filterBox}>
        <div style={filterIconWrap}>
          <Calendar size={18} color={colors.indigo} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={filterLabel}>{label}</div>

          <div
            style={datePillWrap}
            onClick={() => {
              // extra nudge: σε iOS κάποιες φορές βοηθά
              inputRef.current?.focus()
              // showPicker σε Chrome/Android
              ;(inputRef.current as any)?.showPicker?.()
            }}
          >
            {/* Αυτό είναι το ορατό κείμενο */}
            <div style={datePillText}>{toGreekDate(value) || '—'}</div>
            <div style={chev}>▾</div>

            {/* Αυτό είναι το πραγματικό input (πάνω από όλα) */}
            <input
              ref={inputRef}
              type="date"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={dateInputOverlay}
              aria-label={label}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageWrap} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={container}>
        {/* PRINT HEADER (only in print) */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* Header card */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={headerIcon}>
              <BarChart3 size={20} />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={headerTitle}>Ανάλυση</div>
              <div style={headerSub}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={handlePrint} style={iconBtn} aria-label="print">
              <Printer size={18} />
            </button>
            <Link href={`/?store=${storeId}`} style={iconBtn as any} aria-label="close">
              ✕
            </Link>
          </div>
        </div>

        {/* Period pill */}
        <div style={periodPill} className="no-print">
          {startDate} → {endDate}
        </div>

        {/* Filters card */}
        <div style={filtersCard} className="no-print">
          <div style={filtersHeaderRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={miniIconCircle}>
                <Filter size={16} color={colors.indigo} />
              </div>
              <div>
                <div style={filtersTitle}>Φίλτρα</div>
                <div style={filtersSub}>Περίοδος, κατηγορία και drill-down</div>
              </div>
            </div>
          </div>

          <div style={filtersGrid}>
            <DateField label="ΑΠΟ" value={startDate} onChange={setStartDate} />
            <DateField label="ΕΩΣ" value={endDate} onChange={setEndDate} />

            <div style={filterBox}>
              <div style={filterIconWrap}>
                <Filter size={18} color={colors.indigo} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={filterLabel}>Φίλτρο Κατηγορίας</div>
                <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={selectPill}>
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

            <div style={filterBox}>
              <div style={filterIconWrap}>
                <ListFilter size={18} color={colors.indigo} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={filterLabel}>Λεπτομέρεια</div>
                <select
                  value={detailId}
                  onChange={(e) => setDetailId(e.target.value)}
                  style={selectPill}
                  disabled={detailMode === 'none'}
                >
                  <option value="all">{detailMode === 'none' ? '—' : 'Όλοι'}</option>
                  {detailMode !== 'none' &&
                    detailOptions.map((x: any) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2x2 grid */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, ...kpiCardIncome }}>
            <div style={kpiTopRow}>
              <div style={kpiTitle}>Έσοδα</div>
            </div>
            <div style={kpiValueGreen}>+ {kpis.income.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            <div style={kpiBarTrack}>
              <div style={{ ...kpiBarFill, width: '72%', background: colors.success }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiCardExpense }}>
            <div style={kpiTopRow}>
              <div style={kpiTitle}>Έξοδα</div>
            </div>
            <div style={kpiValueRed}>- {kpis.expenses.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            <div style={kpiBarTrack}>
              <div style={{ ...kpiBarFill, width: '72%', background: colors.danger }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiCardTips }}>
            <div style={kpiTopRow}>
              <div style={kpiTitle}>Σύνολο Tips</div>
            </div>
            <div style={kpiValueAmber}>+ {kpis.tips.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            <div style={kpiBarTrack}>
              <div style={{ ...kpiBarFill, width: '72%', background: colors.amber }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiCardNet }}>
            <div style={kpiTopRow}>
              <div style={kpiTitleNet}>{isZReport ? 'Καθαρό Ταμείο' : 'Καθαρό Κέρδος'}</div>
            </div>
            <div style={kpiValueNet}>
              {(isZReport ? kpis.cashNet : kpis.netProfit) >= 0 ? '+' : '-'}{' '}
              {Math.abs(isZReport ? kpis.cashNet : kpis.netProfit).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
            </div>
            <div style={kpiNetSub}>Income - Expenses</div>
          </div>
        </div>

        {/* Category Breakdown (FIXED labels) */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionHeader}>
            <div>
              <div style={sectionTitle}>Έξοδα ανά Κατηγορία</div>
              <div style={sectionSub}>Κατανομή της περιόδου (χωρίς έσοδα)</div>
            </div>
            <div style={totalPill}>
              Σύνολο <b style={{ marginLeft: 8 }}>{categoryBreakdown.total.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</b>
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
                      <div style={catIconCircle}>
                        <Icon size={18} color={c.color} />
                      </div>
                      <div style={catName}>{c.label}</div>
                    </div>

                    <div style={catMid}>
                      <div style={catPct}>{pct.toFixed(0)}%</div>
                      <div style={catBarTrack}>
                        <div style={{ ...catBarFill, width: `${pct}%`, background: c.color }} />
                      </div>
                    </div>

                    <div style={{ ...catAmount, color: c.color }}>
                      {val.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Staff list */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionHeader}>
            <div>
              <div style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</div>
              <div style={sectionSub}>Τρέχων μήνας (για γρήγορη εικόνα)</div>
            </div>
            <div style={monthPill}>{format(new Date(), 'MMMM yyyy', { locale: el })}</div>
          </div>

          {staffDetailsThisMonth.length === 0 ? (
            <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffDetailsThisMonth.map((s) => {
                const initials = String(s.name || '')
                  .trim()
                  .split(' ')
                  .slice(0, 2)
                  .map((x) => x.charAt(0).toUpperCase())
                  .join('')
                return (
                  <div key={s.name} style={staffRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={avatarCircle}>{initials || '•'}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={staffName}>{String(s.name || '').toUpperCase()}</div>
                        <div style={paidBadge}>Καταβλήθηκε</div>
                      </div>
                    </div>
                    <div style={staffAmount}>{s.amount.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Transactions list */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionHeader}>
            <div>
              <div style={sectionTitle}>Κινήσεις Περιόδου</div>
              <div style={sectionSub}>Λίστα κινήσεων με οντότητα, ποσό και σημειώσεις</div>
            </div>
            <div style={countPill}>
              Εγγραφές <b style={{ marginLeft: 8 }}>{periodList.length}</b>
            </div>
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
                const pillBg = isInc ? 'rgba(16,185,129,0.10)' : isTip ? 'rgba(245,158,11,0.12)' : 'rgba(244,63,94,0.10)'
                const pillTx = isInc ? colors.success : isTip ? colors.amber : colors.danger

                const norm = normalizeExpenseCategory(t)
                const isStaff = norm === 'Staff'
                const isSup = norm === 'Εμπορεύματα'
                const isUtil = norm === 'Utilities'
                const isMaint = norm === 'Maintenance'
                const isRev = !!(t.revenue_source_id || t.revenue_sources?.name)

                const pm = String(t.payment_method || '').trim()

                const LeftIcon = isRev
                  ? Landmark
                  : isStaff
                  ? Users
                  : isSup
                  ? ShoppingBag
                  : isUtil
                  ? Lightbulb
                  : isMaint
                  ? Wrench
                  : isTip
                  ? Coins
                  : Coins

                return (
                  <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={txRow} data-print-row="true">
                    <div style={txIconPill}>
                      <LeftIcon size={18} color={pillTx} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={txTop}>
                        <div style={txDate}>{t.date}</div>
                        <div style={{ ...txAmountPill, background: pillBg, color: pillTx }}>
                          {sign}
                          {absAmt.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€
                        </div>
                      </div>

                      <div style={txName}>{String(name || '').toUpperCase()}</div>

                      {!!t.notes && <div style={txNotes}>{t.notes}</div>}

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

        <div style={footNote} data-print-section="true">
          * Όλα τα ποσά βασίζονται στις κινήσεις της βάσης για το επιλεγμένο store.
        </div>

        {/* Print controls */}
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
  padding: 20
}

const container: any = { maxWidth: 560, margin: '0 auto', paddingBottom: 120 }

/* Header */
const headerCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  borderRadius: 24,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 18px 32px rgba(15, 23, 42, 0.08)',
  marginBottom: 12
}
const headerIcon: any = {
  width: 52,
  height: 52,
  borderRadius: 18,
  background: colors.darkCard,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 16px 26px rgba(2,6,23,0.25)'
}
const headerTitle: any = { fontSize: 26, fontWeight: 900, color: colors.primary }
const headerSub: any = { marginTop: 6, fontSize: 12, fontWeight: 900, color: colors.secondary, letterSpacing: 0.6 }
const iconBtn: any = {
  width: 44,
  height: 44,
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.secondary,
  textDecoration: 'none'
}

/* Period pill */
const periodPill: any = {
  display: 'inline-flex',
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.9)',
  fontWeight: 900,
  color: colors.primary,
  marginBottom: 12
}

/* Filters */
const filtersCard: any = {
  background: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  borderRadius: 24,
  boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
  padding: 14,
  marginBottom: 14
}
const filtersHeaderRow: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12
}
const miniIconCircle: any = {
  width: 36,
  height: 36,
  borderRadius: 14,
  border: `1px solid ${colors.border}`,
  background: '#f1f5ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
const filtersTitle: any = { fontSize: 16, fontWeight: 900, color: colors.primary }
const filtersSub: any = { fontSize: 12, fontWeight: 800, color: colors.secondary, marginTop: 2 }
const filtersGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

/* Filter “pill field” */
const filterBox: any = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: 12,
  minHeight: 86
}
const filterIconWrap: any = {
  width: 44,
  height: 44,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}
const filterLabel: any = { fontSize: 12, fontWeight: 900, color: colors.secondary, letterSpacing: 0.6, marginBottom: 8 }

/* select pill */
const selectPill: any = {
  width: '100%',
  padding: '14px 14px',
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 18,
  fontWeight: 900,
  color: colors.primary,
  outline: 'none',
  minWidth: 0
}

/* FIXED Date pill wrapper */
const datePillWrap: any = {
  position: 'relative',
  width: '100%',
  padding: '14px 14px',
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  overflow: 'hidden'
}
const datePillText: any = {
  fontSize: 18,
  fontWeight: 900,
  color: colors.primary,
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
}
const chev: any = { fontWeight: 900, color: colors.secondary, flexShrink: 0 }

/* IMPORTANT: input covers the whole pill (tap works on iPhone & Android) */
const dateInputOverlay: any = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0.01, // όχι 0, για να μη “σβήσει”/μην ακυρωθεί σε iOS
  border: 'none',
  background: 'transparent',
  color: 'transparent',
  WebkitAppearance: 'none',
  appearance: 'none',
  cursor: 'pointer'
}

/* KPIs */
const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }
const kpiCard: any = {
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: 16,
  boxShadow: '0 8px 18px rgba(15,23,42,0.05)',
  overflow: 'hidden'
}
const kpiTopRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const kpiTitle: any = { fontSize: 16, fontWeight: 900, color: colors.primary }
const kpiTitleNet: any = { fontSize: 16, fontWeight: 900, color: '#fff' }

const kpiValueGreen: any = { marginTop: 14, fontSize: 28, fontWeight: 900, color: colors.success }
const kpiValueRed: any = { marginTop: 14, fontSize: 28, fontWeight: 900, color: colors.danger }
const kpiValueAmber: any = { marginTop: 14, fontSize: 28, fontWeight: 900, color: colors.amber }
const kpiValueNet: any = { marginTop: 14, fontSize: 28, fontWeight: 900, color: '#fff' }
const kpiNetSub: any = { marginTop: 10, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.75)' }

const kpiBarTrack: any = { height: 10, borderRadius: 999, background: 'rgba(2,6,23,0.08)', marginTop: 14, overflow: 'hidden' }
const kpiBarFill: any = { height: 10, borderRadius: 999 }

const kpiCardIncome: any = { background: 'linear-gradient(180deg, rgba(16,185,129,0.10), rgba(255,255,255,1))' }
const kpiCardExpense: any = { background: 'linear-gradient(180deg, rgba(244,63,94,0.10), rgba(255,255,255,1))' }
const kpiCardTips: any = { background: 'linear-gradient(180deg, rgba(245,158,11,0.14), rgba(255,255,255,1))' }
const kpiCardNet: any = { background: 'linear-gradient(180deg, #0b1220, #0f172a)' }

/* Sections */
const sectionCard: any = {
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
  padding: 16,
  marginBottom: 14
}
const sectionHeader: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }
const sectionTitle: any = { fontSize: 18, fontWeight: 900, color: colors.primary }
const sectionSub: any = { fontSize: 13, fontWeight: 800, color: colors.secondary, marginTop: 6 }

const totalPill: any = {
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 13,
  fontWeight: 900,
  color: colors.primary,
  whiteSpace: 'nowrap'
}
const monthPill: any = {
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 13,
  fontWeight: 900,
  color: colors.primary,
  whiteSpace: 'nowrap'
}
const countPill: any = {
  padding: '10px 14px',
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 13,
  fontWeight: 900,
  color: colors.primary,
  whiteSpace: 'nowrap'
}

const hintBox: any = {
  padding: 14,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  fontSize: 14,
  fontWeight: 800,
  color: colors.secondary
}

/* Category rows (FIXED: no truncation) */
const catRow: any = { display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(120px, 1fr) auto', alignItems: 'center', gap: 12 }
const catLeft: any = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }
const catIconCircle: any = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}
const catName: any = {
  fontSize: 16,
  fontWeight: 900,
  color: colors.primary,
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'clip',
  lineHeight: 1.15
}
const catMid: any = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }
const catPct: any = { width: 44, textAlign: 'right', fontSize: 14, fontWeight: 900, color: colors.secondary, flexShrink: 0 }
const catBarTrack: any = { height: 10, borderRadius: 999, background: '#eef2f7', flex: 1, overflow: 'hidden', minWidth: 60 }
const catBarFill: any = { height: 10, borderRadius: 999 }
const catAmount: any = { width: 120, textAlign: 'right', fontSize: 16, fontWeight: 900, whiteSpace: 'nowrap' }

/* Staff rows */
const staffRow: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: 14
}
const avatarCircle: any = {
  width: 40,
  height: 40,
  borderRadius: 999,
  background: '#eef2ff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  color: colors.indigo
}
const staffName: any = { fontSize: 15, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const paidBadge: any = {
  marginTop: 6,
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#f1f5f9',
  border: `1px solid ${colors.border}`,
  fontSize: 12,
  fontWeight: 900,
  color: colors.secondary
}
const staffAmount: any = { fontSize: 16, fontWeight: 900, color: '#0ea5e9', whiteSpace: 'nowrap' }

/* Tx list */
const txRow: any = { display: 'flex', gap: 12, borderRadius: 18, border: `1px solid ${colors.border}`, background: '#fff', padding: 14 }
const txIconPill: any = { width: 46, height: 46, borderRadius: 18, background: '#f8fafc', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const txTop: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const txDate: any = { fontSize: 14, fontWeight: 900, color: colors.secondary, whiteSpace: 'nowrap' }
const txAmountPill: any = { padding: '8px 12px', borderRadius: 999, fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }
const txName: any = { marginTop: 10, fontSize: 18, fontWeight: 900, color: colors.primary }
const txNotes: any = { marginTop: 8, fontSize: 14, fontWeight: 800, color: colors.secondary }
const txMeta: any = { marginTop: 10, fontSize: 14, fontWeight: 800, color: colors.secondary }

const footNote: any = { marginTop: 10, fontSize: 13, fontWeight: 800, color: colors.secondary, textAlign: 'center' }

/* Print controls */
const printWrap: any = {
  marginTop: 18,
  padding: 14,
  borderRadius: 20,
  backgroundColor: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 10px 22px rgba(15,23,42,0.06)'
}
const printModeSwitchWrap: any = { display: 'flex', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 16, gap: 6 }
const printModeBtn: any = { flex: 1, padding: 12, borderRadius: 12, border: 'none', fontWeight: 900, fontSize: 14, cursor: 'pointer', backgroundColor: 'transparent', color: colors.primary }
const printModeBtnActive: any = { backgroundColor: colors.indigo, color: '#fff' }
const printBtn: any = {
  width: '100%',
  padding: 14,
  borderRadius: 16,
  border: 'none',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 900,
  backgroundColor: colors.indigo,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10
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