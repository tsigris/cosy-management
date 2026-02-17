'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Users, ShoppingBag, Lightbulb, Wrench } from 'lucide-react'

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
// ✅ RENAME: 'Μάστορες' -> 'Συντήρηση'
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

type FilterA = 'Όλες' | 'Εμπορεύματα' | 'Προσωπικό' | 'Λογαριασμοί' | 'Συντήρηση' | 'Λοιπά'
type DetailMode = 'none' | 'staff' | 'supplier'

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // lists for dynamic filters + correct party names
  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  // ✅ Smart Dynamic Filters
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [detailMode, setDetailMode] = useState<DetailMode>('none')
  const [detailId, setDetailId] = useState<string>('all')

  // ✅ Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

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

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // Transactions (include supplier + fixed asset info)
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .select('*, suppliers(id, name), fixed_assets(id, name, sub_category)')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      if (txErr) throw txErr
      setTransactions(tx || [])

      // Staff list (fixed_assets where sub_category = staff)
      const { data: staffData, error: staffErr } = await supabase
        .from('fixed_assets')
        .select('id, name, sub_category')
        .eq('store_id', storeId)
        .eq('sub_category', 'staff')
        .order('name', { ascending: true })

      if (staffErr) throw staffErr
      setStaff(staffData || [])

      // Suppliers list
      const { data: supData, error: supErr } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      if (supErr) throw supErr
      setSuppliers(supData || [])
    } catch (err) {
      console.error(err)
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId])

  useEffect(() => { loadData() }, [loadData])

  // ✅ Smart filter B visibility / reset logic
  useEffect(() => {
    let nextMode: DetailMode = 'none'
    if (filterA === 'Προσωπικό') nextMode = 'staff'
    if (filterA === 'Εμπορεύματα') nextMode = 'supplier'

    setDetailMode(nextMode)
    setDetailId('all')
  }, [filterA])

  // --- helpers ---
  const normalizeExpenseCategory = useCallback((t: any) => {
    let cat = t.category
    if (!cat) cat = 'Other'

    // if supplier attached -> εμπορεύματα
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'

    const subRaw = t.fixed_assets?.sub_category
    const sub = String(subRaw || '').trim()

    // ✅ RENAME / DATA RULE:
    // if sub_category is 'worker' OR 'Maintenance' -> 'Maintenance'
    if (sub === 'staff') return 'Staff'
    if (sub === 'utility') return 'Utilities'
    if (sub === 'other') return 'Other'
    if (sub === 'worker' || sub === 'Maintenance') return 'Maintenance'

    // also support case-insensitive values just in case
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

  // ✅ CLEANUP: recognize correct names even if join is missing
  const getPartyName = useCallback((t: any) => {
    // staff
    const isStaff = String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff'
    if (isStaff) {
      const joinedName = t.fixed_assets?.name
      if (joinedName) return joinedName
      const found = staff.find(s => String(s.id) === String(t.fixed_asset_id))
      return found?.name || 'Άγνωστος Υπάλληλος'
    }

    // supplier
    if (t.suppliers?.name) return t.suppliers.name
    if (t.supplier_id) {
      const found = suppliers.find(s => String(s.id) === String(t.supplier_id))
      return found?.name || 'Προμηθευτής'
    }

    // maintenance (often worker without supplier) - try fixed asset name if exists
    if (t.fixed_asset_id) {
      const joinedName = t.fixed_assets?.name
      if (joinedName) return joinedName
    }

    // tips
    if (t.type === 'tip_entry') {
      // if tip linked to staff, show staff name
      const found = staff.find(s => String(s.id) === String(t.fixed_asset_id))
      return found?.name || 'Tips'
    }

    return '-'
  }, [staff, suppliers])

  // map FilterA to internal normalized keys
  const filterAToKey = useCallback((fa: FilterA) => {
    if (fa === 'Εμπορεύματα') return 'Εμπορεύματα'
    if (fa === 'Προσωπικό') return 'Staff'
    if (fa === 'Λογαριασμοί') return 'Utilities'
    if (fa === 'Συντήρηση') return 'Maintenance'
    if (fa === 'Λοιπά') return 'Other'
    return null
  }, [])

  // --- filtered period data ---
  const periodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    return transactions
      .filter(t => t.store_id === storeId)
      .filter(t => t.date >= startDate && t.date <= endDate)
  }, [transactions, storeId, startDate, endDate])

  // ✅ SMART FILTER LOGIC (date + category + optional staff/supplier detail)
  const filteredTx = useMemo(() => {
    const key = filterAToKey(filterA)

    return periodTx.filter(t => {
      // Category filter (applies to all transactions; non-expense types generally drop out when a category is selected)
      if (filterA !== 'Όλες') {
        // Special requirement: if FilterA is 'Λογαριασμοί', show only category 'Utilities'
        // (we do it via normalizedExpenseCategory)
        if (normalizeExpenseCategory(t) !== key) return false
      }

      // Detail filter only when the detail select exists
      if (detailMode === 'staff' && detailId !== 'all') {
        if (String(t.fixed_asset_id) !== String(detailId)) return false
      }
      if (detailMode === 'supplier' && detailId !== 'all') {
        if (String(t.supplier_id) !== String(detailId)) return false
      }

      return true
    })
  }, [periodTx, filterA, detailMode, detailId, filterAToKey, normalizeExpenseCategory])

  // ✅ KPI totals with Tips separated
  const kpis = useMemo(() => {
    const income = filteredTx
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    // ✅ tips must NOT affect net profit
    const tips = filteredTx
      .filter(t => t.type === 'tip_entry')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const expenses = filteredTx
      .filter(t => t.type === 'expense' || t.type === 'debt_payment')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const net = income - expenses

    return { income, expenses, tips, net }
  }, [filteredTx])

  // --- CATEGORY BREAKDOWN (based on filteredTx) ---
  const categoryBreakdown = useMemo(() => {
    const expenseTx = filteredTx.filter(t => t.type === 'expense' || t.type === 'debt_payment')
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

  // --- STAFF DETAILS (this month) keep as-is (not affected by smart filters) ---
  const staffDetailsThisMonth = useMemo(() => {
    if (!storeId || storeId === 'null') return [] as Array<{ name: string; amount: number }>

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const staffTxs = transactions
      .filter(t => t.store_id === storeId)
      .filter(t => t.date >= monthStart && t.date <= monthEnd)
      .filter(t => (t.type === 'expense' || t.type === 'debt_payment'))
      .filter(t => normalizeExpenseCategory(t) === 'Staff')

    const byStaff: Record<string, number> = {}
    for (const t of staffTxs) {
      const name = t.fixed_assets?.name || staff.find(s => String(s.id) === String(t.fixed_asset_id))?.name || 'Άγνωστος'
      byStaff[name] = (byStaff[name] || 0) + Math.abs(Number(t.amount) || 0)
    }

    return Object.entries(byStaff)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, storeId, normalizeExpenseCategory, staff])

  // ✅ DETAILED LIST (period)
  const periodList = useMemo(() => {
    return [...filteredTx].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [filteredTx])

  const detailOptions = useMemo(() => {
    if (detailMode === 'staff') return staff
    if (detailMode === 'supplier') return suppliers
    return []
  }, [detailMode, staff, suppliers])

  const DetailIcon = useMemo(() => {
    if (detailMode === 'staff') return Users
    if (detailMode === 'supplier') return ShoppingBag
    return null
  }, [detailMode])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>📊</div>
            <div>
              <h1 style={titleStyle}>Ανάλυση</h1>
              <p style={subLabelStyle}>ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ</p>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={backBtnStyle}>✕</Link>
        </div>

        {/* FILTERS */}
        <div style={filterCard}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΑΠΟ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={dateInput}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΕΩΣ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={dateInput}
              />
            </div>
          </div>

          {/* ✅ SMART DYNAMIC FILTERS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginTop: 12 }}>
            {/* Filter A */}
            <div>
              <label style={dateLabel}>Φίλτρο Κατηγορίας</label>
              <select value={filterA} onChange={(e) => setFilterA(e.target.value as FilterA)} style={selectInput}>
                <option value="Όλες">Όλες</option>
                <option value="Εμπορεύματα">Εμπορεύματα</option>
                <option value="Προσωπικό">Προσωπικό</option>
                <option value="Λογαριασμοί">Λογαριασμοί</option>
                <option value="Συντήρηση">Συντήρηση</option>
                <option value="Λοιπά">Λοιπά</option>
              </select>
            </div>

            {/* Filter B (ONLY when Προσωπικό or Εμπορεύματα) */}
            {detailMode !== 'none' && (
              <div>
                <label style={dateLabel}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {DetailIcon ? <DetailIcon size={18} /> : null}
                    {detailMode === 'staff' ? 'Λεπτομέρεια Υπαλλήλου' : 'Λεπτομέρεια Εμπόρου'}
                  </span>
                </label>

                <select value={detailId} onChange={(e) => setDetailId(e.target.value)} style={selectInput}>
                  <option value="all">Όλοι</option>
                  {detailOptions.map((x: any) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
            Περίοδος: {startDate} → {endDate}
          </div>
        </div>

        {/* ✅ KPIs (Tips separated; Net excludes tips) */}
        <div style={kpiGrid}>
          {/* Tips KPI */}
          <div style={{ ...kpiCard, borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, color: '#92400e' }}>
                <Coins size={18} />
                Σύνολο Tips
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#92400e' }}>+</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>
              {kpis.tips.toLocaleString('el-GR')}€
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>Έσοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>+</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>
              {kpis.income.toLocaleString('el-GR')}€
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', backgroundColor: '#fff1f2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>Έξοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>-</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>
              {kpis.expenses.toLocaleString('el-GR')}€
            </div>
          </div>

          <div
            style={{
              ...kpiCard,
              borderColor: kpis.net >= 0 ? '#d1fae5' : '#ffe4e6',
              backgroundColor: kpis.net >= 0 ? '#f0fdf4' : '#fff1f2'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>Καθαρό Κέρδος</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: kpis.net >= 0 ? colors.success : colors.danger }}>
                {kpis.net >= 0 ? '▲' : '▼'}
              </span>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: kpis.net >= 0 ? colors.success : colors.danger,
                marginTop: 10
              }}
            >
              {kpis.net >= 0 ? '+' : ''}
              {kpis.net.toLocaleString('el-GR')}€
            </div>

            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
              * Το Net Profit δεν επηρεάζεται από Tips.
            </div>
          </div>
        </div>

        {/* ✅ CATEGORY BREAKDOWN */}
        <div style={sectionCard}>
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
              Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR')}€
            </div>
          </div>

          {categoryBreakdown.total <= 0 ? (
            <div style={hintBox}>Δεν υπάρχουν έξοδα στην επιλεγμένη περίοδο.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CATEGORY_META.map(c => {
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
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
                          {pct.toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: c.color }}>
                          {val.toLocaleString('el-GR')}€
                        </span>
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

        {/* ✅ STAFF DETAILS (this month) */}
        <div style={sectionCard}>
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
              {format(new Date(), 'MMMM yyyy')}
            </div>
          </div>

          {staffDetailsThisMonth.length === 0 ? (
            <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffDetailsThisMonth.map((s) => (
                <div key={s.name} style={rowItem}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>
                      {String(s.name || '').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: colors.secondary }}>Καταβλήθηκε</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>
                    {s.amount.toLocaleString('el-GR')}€
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ✅ DETAILED TRANSACTIONS LIST */}
        <div style={sectionCard}>
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
              {periodList.length} εγγραφές
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
                const isInc = t.type === 'income'
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

                return (
                  <div key={t.id ?? `${t.date}-${t.created_at}-${absAmt}`} style={listRow}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap' }}>
                          {t.date}
                        </div>

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
                          {sign}{absAmt.toLocaleString('el-GR')}€
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {isStaff ? (
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

                        <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {name}
                        </div>
                      </div>

                      {!!t.notes && (
                        <div style={{ fontSize: 16, fontWeight: 800, color: colors.secondary }}>
                          {t.notes}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
          * Όλα τα ποσά βασίζονται στις κινήσεις της βάσης για το επιλεγμένο store.
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
  top: 0, left: 0, right: 0, bottom: 0,
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

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}