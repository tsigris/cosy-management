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
  X,
  Calendar,
  Filter as FilterIcon,
  ListFilter,
} from 'lucide-react'

/* ---------------- THEME ---------------- */
const colors = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  border: '#e6e8f2',
  text: '#0f172a',
  sub: '#667085',
  shadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
  softShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  blue: '#2563eb',
  indigo: '#4f46e5',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  darkCard: '#0b1220',
}

/* --- CATEGORY META --- */
const CATEGORY_META: Array<{
  key: 'Εμπορεύματα' | 'Staff' | 'Utilities' | 'Maintenance' | 'Other'
  label: string
  color: string
  Icon: any
}> = [
  { key: 'Εμπορεύματα', label: 'Εμπορεύματα', color: '#2563eb', Icon: ShoppingBag },
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

  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])
  const [printMode, setPrintMode] = useState<PrintMode>('full')

  /* ✅ PRINT CSS */
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
    } catch (e) {
      console.error(e)
      toast.error('Δεν ήταν δυνατή η εκτύπωση')
    }
  }, [])

  /* guard */
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

    if (cat === 'Εμπορεύματα' || cat === 'Staff' || cat === 'Utilities' || cat === 'Maintenance' || cat === 'Other') return cat
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

  const periodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    return transactions.filter((t) => t.store_id === storeId).filter((t) => t.date >= startDate && t.date <= endDate)
  }, [transactions, storeId, startDate, endDate])

  const filterAToKey = useCallback((fa: FilterA) => {
    if (fa === 'Εμπορεύματα') return 'Εμπορεύματα'
    if (fa === 'Προσωπικό') return 'Staff'
    if (fa === 'Λογαριασμοί') return 'Utilities'
    if (fa === 'Συντήρηση') return 'Maintenance'
    if (fa === 'Λοιπά') return 'Other'
    return null
  }, [])

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

      if (detailMode === 'staff' && detailId !== 'all') return String(t.fixed_asset_id) === String(detailId)
      if (detailMode === 'supplier' && detailId !== 'all') return String(t.supplier_id) === String(detailId)
      if (detailMode === 'revenue_source' && detailId !== 'all') return String(t.revenue_source_id) === String(detailId)
      if (detailMode === 'maintenance' && detailId !== 'all') return String(t.fixed_asset_id) === String(detailId)

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

    const cashIn = filteredTx
      .filter(
        (t) =>
          (t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received') &&
          String(t.payment_method || '').toLowerCase() === 'cash'
      )
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const cashOut = filteredTx
      .filter((t) => (t.type === 'expense' || t.type === 'debt_payment') && String(t.payment_method || '').toLowerCase() === 'cash')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const cashNet = cashIn - cashOut
    return { income, expenses, tips, netProfit, cashNet }
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

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    if (detailMode === 'revenue_source') return revenueSources
    if (detailMode === 'maintenance') return maintenanceWorkers
    return []
  }, [detailMode, staff, suppliers, revenueSources, maintenanceWorkers])

  const periodLabel = useMemo(() => {
    // photo-style: dd/MM/yyyy
    const toGR = (d: string) => {
      const [y, m, day] = String(d).split('-')
      if (!y || !m || !day) return d
      return `${day}/${m}/${y}`
    }
    return `${toGR(startDate)}  →  ${toGR(endDate)}`
  }, [startDate, endDate])

  const avatarText = (name: string) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '•'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
  }

  return (
    <div style={pageWrap} data-print-root="true">
      <Toaster position="top-center" richColors />

      <div style={container}>
        {/* PRINT HEADER */}
        <div className="print-header" style={{ display: 'none' }}>
          <h1 className="print-title">{isZReport ? 'Αναφορά Ημέρας (Ζ)' : 'Ανάλυση'}</h1>
          <p className="print-sub">{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</p>
          <p className="print-meta">
            Περίοδος: {startDate} → {endDate} • Φίλτρο: {filterA} • Εκτύπωση: {printMode === 'summary' ? 'Σύνοψη' : 'Πλήρες'}
          </p>
        </div>

        {/* HEADER (exact photo vibe) */}
        <div style={header} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={headerIcon}>
              <span style={{ fontSize: 20 }}>📊</span>
            </div>
            <div>
              <div style={hTitle}>Ανάλυση</div>
              <div style={hSub}>{isZReport ? 'ΚΑΘΑΡΟ ΤΑΜΕΙΟ ΗΜΕΡΑΣ' : 'ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ'}</div>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={closeCircle as any} aria-label="close">
            <X size={18} />
          </Link>
        </div>

        {/* FILTER CARD (exact structure like photo) */}
        <div style={filterCard} className="no-print">
          {/* row 1: dates */}
          <div style={filterRow2}>
            <div style={pillField}>
              <div style={pillIcon}>
                <Calendar size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={pillLabel}>ΑΠΟ</div>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={pillInput} />
              </div>
            </div>

            <div style={pillField}>
              <div style={pillIcon}>
                <Calendar size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={pillLabel}>ΕΩΣ</div>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={pillInput} />
              </div>
            </div>
          </div>

          {/* row 2: selects */}
          <div style={filterRow2}>
            <div style={pillField}>
              <div style={pillIcon}>
                <FilterIcon size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={pillLabel}>Φίλτρο Κατηγορίας</div>
                <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={pillSelect}>
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

            <div style={pillField}>
              <div style={pillIcon}>
                <ListFilter size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={pillLabel}>Λεπτομέρεια</div>
                <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={pillSelect} disabled={detailMode === 'none'}>
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
          </div>

          <div style={periodMini}>{periodLabel}</div>
        </div>

        {/* KPI GRID (2x2 like photo) */}
        <div style={kpiGrid} data-print-section="true">
          <div style={{ ...kpiCard, ...kpiGreen }}>
            <div style={kpiLabel}>Έσοδα</div>
            <div style={kpiValueGreen}>+ {kpis.income.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
            <div style={{ ...kpiBar, background: 'rgba(16,185,129,0.18)' }}>
              <div style={{ ...kpiBarFill, background: colors.green }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiRed }}>
            <div style={kpiLabel}>Έξοδα</div>
            <div style={kpiValueRed}>- {kpis.expenses.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
            <div style={{ ...kpiBar, background: 'rgba(239,68,68,0.16)' }}>
              <div style={{ ...kpiBarFill, background: colors.red }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiAmber }}>
            <div style={kpiLabel}>Σύνολο Tips</div>
            <div style={kpiValueAmber}>+ {kpis.tips.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
            <div style={{ ...kpiBar, background: 'rgba(245,158,11,0.18)' }}>
              <div style={{ ...kpiBarFill, background: colors.amber }} />
            </div>
          </div>

          <div style={{ ...kpiCard, ...kpiDark }}>
            <div style={{ ...kpiLabel, color: '#dbeafe' }}>Καθαρό Κέρδος</div>
            <div style={kpiValueDark}>
              {kpis.netProfit >= 0 ? '+ ' : '- '}
              {Math.abs(kpis.netProfit).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </div>
            <div style={{ ...kpiBar, background: 'rgba(255,255,255,0.14)' }}>
              <div style={{ ...kpiBarFill, background: 'rgba(255,255,255,0.9)' }} />
            </div>
          </div>
        </div>

        {/* CATEGORY BREAKDOWN */}
        <div style={sectionCard} data-print-section="true">
          <div style={sectionHeaderRow}>
            <div style={sectionTitle}>Έξοδα ανά Κατηγορία</div>
            <div style={totalPill}>Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
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
                  <div key={c.key} style={catRow}>
                    <div style={catLeft}>
                      <div style={catIconCircle}>
                        <Icon size={18} color={c.color} />
                      </div>
                      <div style={catName}>{c.label}</div>
                    </div>

                    <div style={catMid}>
                      <div style={catPct}>{pct.toFixed(0)}%</div>
                      <div style={catTrack}>
                        <div style={{ ...catFill, width: `${pct}%`, background: c.color }} />
                      </div>
                    </div>

                    <div style={catAmount}>{val.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* STAFF (shows like photo) */}
        {printMode === 'full' && (
          <div style={sectionCard} data-print-section="true">
            <div style={sectionHeaderRow}>
              <div style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</div>
              <div style={monthPill}>{format(new Date(), 'MMMM yyyy')}</div>
            </div>

            {staffDetailsThisMonth.length === 0 ? (
              <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {staffDetailsThisMonth.slice(0, 6).map((s) => (
                  <div key={s.name} style={staffRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={avatar}>{avatarText(s.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={staffName}>{s.name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={paidPill}>Καταβλήθηκε</div>
                      <div style={staffAmt}>{s.amount.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* (optional) detailed movements only in full, keep your existing list if you want later */}
        {printMode === 'full' && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: colors.sub }}>
            {loading ? 'Φόρτωση κινήσεων…' : `Κινήσεις περιόδου: ${filteredTx.length}`}
          </div>
        )}

        {/* Bottom controls like photo */}
        <div className="no-print" style={bottomArea}>
          <div style={segWrap}>
            <button
              type="button"
              onClick={() => setPrintMode('summary')}
              style={{ ...segBtn, ...(printMode === 'summary' ? segBtnActiveLeft : {}) }}
            >
              Σύνοψη
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('full')}
              style={{ ...segBtn, ...(printMode === 'full' ? segBtnActiveRight : {}) }}
            >
              Πλήρες
            </button>
          </div>

          <button type="button" onClick={handlePrint} style={printBigBtn}>
            <Printer size={18} />
            Εκτύπωση Αναφοράς
          </button>
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
    'radial-gradient(1100px 520px at 10% -10%, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0) 55%), radial-gradient(1100px 520px at 90% 0%, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0) 55%), #f6f7fb',
  padding: 18,
}

const container: any = { maxWidth: 560, margin: '0 auto', paddingBottom: 120 }

/* Header */
const header: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: 'rgba(255,255,255,0.88)',
  border: `1px solid ${colors.border}`,
  borderRadius: 22,
  padding: 14,
  boxShadow: colors.softShadow,
  position: 'sticky',
  top: 12,
  zIndex: 10,
  backdropFilter: 'blur(10px)',
}

const headerIcon: any = {
  width: 52,
  height: 52,
  borderRadius: 18,
  background: 'linear-gradient(180deg, rgba(15,23,42,0.90), rgba(15,23,42,0.70))',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 14px 28px rgba(15,23,42,0.18)',
}

const hTitle: any = { fontSize: 22, fontWeight: 900, color: colors.text, lineHeight: 1.1 }
const hSub: any = { fontSize: 12, fontWeight: 900, color: colors.sub, letterSpacing: 0.8, marginTop: 4 }

const closeCircle: any = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6b7280',
  textDecoration: 'none',
  boxShadow: '0 10px 18px rgba(15,23,42,0.06)',
}

/* Filter card */
const filterCard: any = {
  marginTop: 14,
  background: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  borderRadius: 22,
  padding: 14,
  boxShadow: colors.softShadow,
}

const filterRow2: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }
const pillField: any = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  border: `1px solid ${colors.border}`,
  borderRadius: 18,
  background: '#fff',
  padding: 12,
  boxShadow: '0 8px 16px rgba(15,23,42,0.04)',
}

const pillIcon: any = {
  width: 34,
  height: 34,
  borderRadius: 14,
  background: '#f1f5ff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: colors.indigo,
}

const pillLabel: any = { fontSize: 11, fontWeight: 900, color: colors.sub, letterSpacing: 0.7 }
const pillInput: any = {
  width: '100%',
  border: 'none',
  outline: 'none',
  fontSize: 16, // ✅ no mobile zoom
  fontWeight: 900,
  color: colors.text,
  background: 'transparent',
}
const pillSelect: any = { ...pillInput, paddingRight: 2 }
const periodMini: any = { marginTop: 10, fontSize: 13, fontWeight: 900, color: colors.sub }

/* KPI */
const kpiGrid: any = {
  marginTop: 14,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const kpiCard: any = {
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  padding: 14,
  boxShadow: colors.softShadow,
  overflow: 'hidden',
}

const kpiLabel: any = { fontSize: 14, fontWeight: 900, color: colors.sub }
const kpiBar: any = { height: 6, borderRadius: 999, marginTop: 10, overflow: 'hidden' }
const kpiBarFill: any = { height: 6, width: '58%', borderRadius: 999 }

const kpiGreen: any = { background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 80%)' }
const kpiRed: any = { background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 80%)' }
const kpiAmber: any = { background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 80%)' }
const kpiDark: any = { background: 'linear-gradient(180deg, #0b1220 0%, #111827 90%)', borderColor: 'rgba(255,255,255,0.06)' }

const kpiValueGreen: any = { marginTop: 8, fontSize: 18, fontWeight: 900, color: colors.green }
const kpiValueRed: any = { marginTop: 8, fontSize: 18, fontWeight: 900, color: colors.red }
const kpiValueAmber: any = { marginTop: 8, fontSize: 18, fontWeight: 900, color: '#b45309' }
const kpiValueDark: any = { marginTop: 8, fontSize: 18, fontWeight: 900, color: '#fff' }

/* Section cards */
const sectionCard: any = {
  marginTop: 14,
  background: 'rgba(255,255,255,0.92)',
  border: `1px solid ${colors.border}`,
  borderRadius: 22,
  padding: 14,
  boxShadow: colors.softShadow,
}

const sectionHeaderRow: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }
const sectionTitle: any = { fontSize: 18, fontWeight: 900, color: colors.text }

const totalPill: any = {
  padding: '10px 12px',
  borderRadius: 999,
  background: '#f3f4f6',
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 900,
  color: colors.text,
}

const hintBox: any = {
  padding: 14,
  borderRadius: 16,
  background: '#f8fafc',
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 800,
  color: colors.sub,
}

/* Category rows like photo */
const catRow: any = {
  display: 'grid',
  gridTemplateColumns: '1.1fr 1fr auto',
  gap: 12,
  alignItems: 'center',
}

const catLeft: any = { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }
const catIconCircle: any = {
  width: 36,
  height: 36,
  borderRadius: 14,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const catName: any = { fontSize: 16, fontWeight: 900, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const catMid: any = { display: 'flex', alignItems: 'center', gap: 10 }
const catPct: any = { width: 42, textAlign: 'right', fontSize: 14, fontWeight: 900, color: colors.sub }
const catTrack: any = { flex: 1, height: 10, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }
const catFill: any = { height: 10, borderRadius: 999 }

const catAmount: any = { fontSize: 16, fontWeight: 900, color: colors.text, whiteSpace: 'nowrap' }

/* Staff */
const monthPill: any = {
  padding: '10px 12px',
  borderRadius: 999,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  fontSize: 14,
  fontWeight: 900,
  color: colors.text,
}

const staffRow: any = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: 12,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  boxShadow: '0 8px 16px rgba(15,23,42,0.04)',
}

const avatar: any = {
  width: 34,
  height: 34,
  borderRadius: 999,
  background: 'linear-gradient(180deg, #111827, #334155)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 900,
}

const staffName: any = { fontSize: 15, fontWeight: 900, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }

const paidPill: any = {
  padding: '8px 10px',
  borderRadius: 999,
  background: '#f3f4f6',
  border: `1px solid ${colors.border}`,
  fontSize: 13,
  fontWeight: 900,
  color: colors.sub,
}

const staffAmt: any = { fontSize: 16, fontWeight: 900, color: colors.blue, whiteSpace: 'nowrap' }

/* Bottom (segmented + print) */
const bottomArea: any = { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }

const segWrap: any = {
  borderRadius: 999,
  padding: 6,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: colors.softShadow,
  display: 'flex',
  gap: 6,
}

const segBtn: any = {
  flex: 1,
  border: 'none',
  cursor: 'pointer',
  borderRadius: 999,
  padding: '12px 12px',
  fontSize: 16,
  fontWeight: 900,
  background: 'transparent',
  color: colors.text,
}

const segBtnActiveLeft: any = {
  background: 'linear-gradient(90deg, rgba(15,23,42,0.06), rgba(99,102,241,0.10))',
}

const segBtnActiveRight: any = {
  background: 'linear-gradient(90deg, rgba(15,23,42,0.86), rgba(79,70,229,0.92))',
  color: '#fff',
}

const printBigBtn: any = {
  width: '100%',
  border: 'none',
  cursor: 'pointer',
  borderRadius: 18,
  padding: '14px 14px',
  fontSize: 16,
  fontWeight: 900,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'linear-gradient(90deg, #0b1220 0%, #1d4ed8 55%, #4f46e5 100%)',
  boxShadow: '0 18px 34px rgba(37,99,235,0.22)',
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