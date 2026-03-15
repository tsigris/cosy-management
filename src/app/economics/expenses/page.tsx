'use client'

export const dynamic = 'force-dynamic'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'

/* ---------------- TYPES ---------------- */

type ExpenseRow = {
  id: string
  date: string
  amount: number
  type: string
  method?: string | null
  category?: string | null
  is_credit?: boolean | null
  created_at?: string | null
  suppliers?: { name?: string | null } | null
  fixed_assets?: { name?: string | null; sub_category?: string | null } | null
}

type DrilldownFilter = { type: 'beneficiary' | 'category' | 'method'; value: string } | null

type GroupBase = {
  key: string
  total: number
  count: number
  rows: ExpenseRow[]
}

type BeneficiaryGroup = GroupBase & {
  label: string
}

/* ---------------- HELPERS ---------------- */

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

function groupByMethod(rows: ExpenseRow[]): GroupBase[] {
  const map = new Map<string, GroupBase>()
  for (const r of rows) {
    const key = (r.method || 'Άλλη Μέθοδος').trim() || 'Άλλη Μέθοδος'
    if (!map.has(key)) map.set(key, { key, total: 0, count: 0, rows: [] })
    const entry = map.get(key)!
    const isStaff = String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff'
    if (r.type === 'expense' || r.type === 'debt_payment' || r.type === 'salary_advance' || isStaff) entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
    entry.rows.push(r)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function filterGroupsByKey<T extends { key: string }>(groups: T[], q: string): T[] {
  if (!q.trim()) return groups
  const qn = norm(q.trim())
  return groups.filter((g) => norm(String(g.key)).includes(qn))
}

function groupByCategory(rows: ExpenseRow[]): GroupBase[] {
  const map = new Map<string, GroupBase>()
  for (const r of rows) {
    const isStaff = String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff'
    let key = (r.category || '').trim() || ''
    if (!key && isStaff) key = 'ΠΡΟΣΩΠΙΚΟ'
    if (!key) key = 'Άλλη Κατηγορία'
    if (!map.has(key)) map.set(key, { key, total: 0, count: 0, rows: [] })
    const entry = map.get(key)!
    if (r.type === 'expense' || r.type === 'debt_payment' || r.type === 'salary_advance' || isStaff) entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
    entry.rows.push(r)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function groupByBeneficiary(rows: ExpenseRow[]): BeneficiaryGroup[] {
  const map = new Map<string, BeneficiaryGroup>()
  for (const r of rows) {
    const key = (r.suppliers?.name || r.fixed_assets?.name || 'Άλλο').trim() || 'Άλλο'

    let label = 'Λοιπά'
    if (r.suppliers?.name) label = 'Προμηθευτής'
    else if (r.fixed_assets?.sub_category) {
      const sub = String(r.fixed_assets.sub_category).trim().toLowerCase()
      if (sub === 'staff') label = 'Προσωπικό'
      else if (sub === 'maintenance' || sub === 'worker') label = 'Συντήρηση'
      else if (sub === 'utility' || sub === 'utilities') label = 'Λογαριασμός'
    }

    if (!map.has(key)) map.set(key, { key, label, total: 0, count: 0, rows: [] })
    const entry = map.get(key)!
    const isStaff = String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff'
    if (r.type === 'expense' || r.type === 'debt_payment' || r.type === 'salary_advance' || isStaff) entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
    entry.rows.push(r)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function filterBeneficiaries(groups: BeneficiaryGroup[], q: string): BeneficiaryGroup[] {
  if (!q.trim()) return groups
  const qn = norm(q.trim())
  return groups.filter((g) => norm(g.key).includes(qn) || norm(g.label).includes(qn))
}

/* ---------------- NEW HELPERS (layout / display) ---------------- */

function formatDateOnly(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch (e) {
    return '—'
  }
}

function displayCategoryLabel(value?: string | null): string {
  if (!value) return '—'
  const v = String(value).trim().toLowerCase()
  const map: Record<string, string> = {
    utilities: 'Λογαριασμοί',
    utility: 'Λογαριασμοί',
    other: 'Λοιπά',
    maintenance: 'Συντήρηση',
    staff: 'Προσωπικό',
    worker: 'Συντήρηση',
    products: 'Εμπορεύματα',
  }
  return map[v] ?? value
}

function formatDate(raw?: string | null): string {
  if (!raw) return '—'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('el-GR')
  } catch (e) {
    return '—'
  }
}

/* ---------------- UI CONFIG ---------------- */

const VIEW_MODES = [
  { key: 'movements', label: 'Κινήσεις' },
  { key: 'beneficiary', label: 'Ανά Δικαιούχο' },
  { key: 'category', label: 'Ανά Κατηγορία' },
  { key: 'method', label: 'Ανά Μέθοδο' },
] as const

type ViewMode = (typeof VIEW_MODES)[number]['key']

/* ---------------- PAGE ---------------- */

import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'

export default function EconomicsExpensesPage() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  // period filter
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const [viewMode, setViewMode] = useState<ViewMode>('movements')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [search, setSearch] = useState('')
  const [movementSearch, setMovementSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<DrilldownFilter>(null)

  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  // Fetch expenses when view mode changes (and reset search)
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        if (!storeId || storeId === 'null') return
        setLoading(true)

        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData?.session) {
          router.push('/login')
          return
        }

        const q =
          'id, date, amount, type, method, category, is_credit, created_at, suppliers:suppliers(name), fixed_assets:fixed_assets(name, sub_category)'

        // Fetch canonical expense types + salary advances
        const byType = await supabase
          .from('transactions')
          .select(q)
          .eq('store_id', storeId)
          .in('type', ['expense', 'debt_payment', 'salary_advance'])
          .order('date', { ascending: false })

        // Also fetch recent transactions that reference fixed_assets and filter client-side
        // to include any staff-related transactions regardless of type.
        const byFixedAssets = await supabase
          .from('transactions')
          .select(q)
          .eq('store_id', storeId)
          .not('fixed_asset_id', 'is', null)
          .order('date', { ascending: false })
          .limit(1000)

        if (!isMounted) return

        if (byType.error) throw byType.error
        if (byFixedAssets.error) throw byFixedAssets.error

        const combined = new Map<string, any>()

        const pushRow = (row: any) => {
          if (!row) return
          const id = String(row.id)
          if (combined.has(id)) return
          combined.set(id, row)
        }

        for (const r of (byType.data || [])) pushRow(r)

        for (const r of (byFixedAssets.data || [])) {
          const fa = Array.isArray(r.fixed_assets) ? r.fixed_assets[0] : r.fixed_assets
          if (!fa) continue
          if (String(fa.sub_category || '').trim().toLowerCase() === 'staff') pushRow(r)
        }

        const data = Array.from(combined.values())

        const safeData: ExpenseRow[] = Array.isArray(data)
          ? (data as any[]).map((row) => ({
              ...row,
              suppliers: Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers,
              fixed_assets: Array.isArray(row.fixed_assets) ? row.fixed_assets[0] : row.fixed_assets,
            }))
          : []

        setRows(safeData)
      } catch (e) {
        console.error(e)
        if (!isMounted) return
        setRows([])
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    // Μόνο για τα συγκεκριμένα modes
    if (['beneficiary', 'category', 'method', 'movements'].includes(viewMode)) {
      setSearch('')
      load()
    }

    return () => {
      isMounted = false
    }
  }, [viewMode, storeId, supabase, router])

  const filteredRowsByPeriod = useMemo(() => {
    if (!rows || !rows.length) return rows
    return rows.filter((r) => {
      const raw = r.created_at || r.date
      if (!raw) return false
      const d = new Date(raw)
      if (period === 'all') return true
      if (period === 'month') {
        const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        return d >= start
      }
      if (period === 'year') {
        const start = new Date(selectedYear, 0, 1)
        return d >= start
      }
      if (period === '30days') {
        const since = new Date()
        since.setDate(since.getDate() - 30)
        since.setHours(0, 0, 0, 0)
        return d >= since
      }
      return true
    })
  }, [rows, period, selectedYear])

  const yearOptions = useMemo(() => {
    const s = new Set<number>()
    for (const r of rows) {
      const raw = r.created_at || r.date
      if (!raw) continue
      const d = new Date(raw)
      if (!isNaN(d.getTime())) s.add(d.getFullYear())
    }
    if (!s.size) s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
  }, [rows])

  // Ensure selectedYear defaults to current year when available
  useEffect(() => {
    if (!yearOptions || !yearOptions.length) return
    const currentYear = new Date().getFullYear()
    const next = yearOptions.includes(currentYear) ? currentYear : yearOptions[0]
    setSelectedYear(next)
  }, [yearOptions])


  const beneficiaryGroups = useMemo(() => groupByBeneficiary(filteredRowsByPeriod), [filteredRowsByPeriod])
  const filteredBeneficiaries = useMemo(() => filterBeneficiaries(beneficiaryGroups, search), [beneficiaryGroups, search])

  const categoryGroups = useMemo(() => groupByCategory(filteredRowsByPeriod), [filteredRowsByPeriod])
  const filteredCategories = useMemo(() => filterGroupsByKey(categoryGroups, search), [categoryGroups, search])

  const methodGroups = useMemo(() => groupByMethod(filteredRowsByPeriod), [filteredRowsByPeriod])
  const filteredMethods = useMemo(() => filterGroupsByKey(methodGroups, search), [methodGroups, search])

  const filteredMovements = useMemo(() => {
    let filtered = filteredRowsByPeriod

    if (activeFilter) {
      if (activeFilter.type === 'beneficiary') {
        filtered = filtered.filter((r) => {
          const key = (r.suppliers?.name || r.fixed_assets?.name || 'Άλλο').trim() || 'Άλλο'
          return key === activeFilter.value
        })
      } else if (activeFilter.type === 'category') {
        filtered = filtered.filter((r) => {
          const isStaff = String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff'
          let key = (r.category || '').trim() || ''
          if (!key && isStaff) key = 'ΠΡΟΣΩΠΙΚΟ'
          if (!key) key = 'Άλλη Κατηγορία'
          return key === activeFilter.value
        })
      } else if (activeFilter.type === 'method') {
        filtered = filtered.filter((r) => ((r.method || 'Άλλη Μέθοδος').trim() || 'Άλλη Μέθοδος') === activeFilter.value)
      }
    }

    return filtered
  }, [rows, activeFilter])

  // Grouped movements for compact accordion view (group by beneficiary)
  const groupedMovements = useMemo(() => {
    const map = new Map<string, {
      key: string
      title: string
      total: number
      count: number
      lastDate: string | null
      category: string
      hasCredit: boolean
      rows: ExpenseRow[]
    }>()

    for (const r of filteredMovements || []) {
      const key = (r.suppliers?.name || r.fixed_assets?.name || 'Άλλο').trim() || 'Άλλο'
      if (!map.has(key))
        map.set(key, {
          key,
          title: key,
          total: 0,
          count: 0,
          lastDate: null,
          category: String(r.category || (String(r.fixed_assets?.sub_category || '').toLowerCase() === 'staff' ? 'ΠΡΟΣΩΠΙΚΟ' : r.type) || 'Λοιπά'),
          hasCredit: false,
          rows: [],
        })
      const entry = map.get(key)!
      const amt = Math.abs(Number(r.amount) || 0)
      entry.total += amt
      entry.count += 1
      entry.rows.push(r)
      if (r.is_credit) entry.hasCredit = true
      const raw = r.created_at || r.date
      if (raw) {
        const d = new Date(raw)
        if (!entry.lastDate || new Date(entry.lastDate) < d) entry.lastDate = raw
      }
    }

    const groups = Array.from(map.values())
    for (const g of groups) {
      g.rows.sort((a, b) => (new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()))
    }
    return groups.sort((a, b) => b.total - a.total)
  }, [filteredMovements])

  const [openSupplier, setOpenSupplier] = useState<string | null>(null)

  useEffect(() => {
    setOpenSupplier(null)
  }, [movementSearch])

  const filteredMovementGroups = useMemo(() => {
    if (!movementSearch || !movementSearch.trim()) return groupedMovements
    const q = norm(movementSearch)
    return groupedMovements.filter((g) => norm(g.title).includes(q))
  }, [groupedMovements, movementSearch])

  const clearFilterAndGoMovements = useCallback(() => {
    setActiveFilter(null)
    setViewMode('movements')
  }, [])

  // --- DASHBOARD METRICS (STEP 1-3) ---
  const filteredRelevantTxs = useMemo(() => {
    let filtered = filteredRowsByPeriod || []

    // apply active drilldown filter same as movements
    if (activeFilter) {
      if (activeFilter.type === 'beneficiary') {
        filtered = filtered.filter((r) => {
          const key = (r.suppliers?.name || r.fixed_assets?.name || 'Άλλο').trim() || 'Άλλο'
          return key === activeFilter.value
        })
      } else if (activeFilter.type === 'category') {
        filtered = filtered.filter((r) => {
          const isStaff = String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff'
          let key = (r.category || '').trim() || ''
          if (!key && isStaff) key = 'ΠΡΟΣΩΠΙΚΟ'
          if (!key) key = 'Άλλη Κατηγορία'
          return key === activeFilter.value
        })
      } else if (activeFilter.type === 'method') {
        filtered = filtered.filter((r) => ((r.method || 'Άλλη Μέθοδος').trim() || 'Άλλη Μέθοδος') === activeFilter.value)
      }
    }

    return filtered
  }, [filteredRowsByPeriod, activeFilter])

  const { totalAmount, cashAmount, creditAmount, avgAmount, isIncomeMode } = useMemo(() => {
    const txs = filteredRelevantTxs || []
    const total = txs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    const cash = txs.filter((t) => !t.is_credit).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    const credit = txs.filter((t) => t.is_credit).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
    const avg = txs.length ? total / txs.length : 0
    const incomeMode = txs.length > 0 && txs.every((t) => t.type === 'income')
    return { totalAmount: total, cashAmount: cash, creditAmount: credit, avgAmount: avg, isIncomeMode: incomeMode }
  }, [filteredRelevantTxs])

  // KPI tone helper
  const getKpiTone = (kind: 'total' | 'cash' | 'credit' | 'avg') => {
    // colors chosen for mobile-friendly, muted palettes
    if (kind === 'total') {
      return { background: '#fff1f2', border: '#fecdd3', valueColor: '#e11d48' }
    }
    if (kind === 'cash') {
      return { background: '#fff7ed', border: '#fdba74', valueColor: '#ea580c' }
    }
    if (kind === 'credit') {
      return { background: '#eef2ff', border: '#c7d2fe', valueColor: '#4f46e5' }
    }
    // avg
    return { background: '#f8fafc', border: '#cbd5e1', valueColor: '#0f172a' }
  }

  // top entities reuse existing beneficiaryGroups (already sorted by total)
  const topEntities = useMemo(() => beneficiaryGroups.slice(0, 3), [beneficiaryGroups])

  // top categories grouped from already filtered transactions (fallback to type)
  const topCategories = useMemo(() => {
    const map = new Map<string, { key: string; total: number; count: number }>()
    for (const r of filteredRelevantTxs) {
      const key = (r.category || r.type || 'Λοιπά').trim() || 'Λοιπά'
      if (!map.has(key)) map.set(key, { key, total: 0, count: 0 })
      const entry = map.get(key)!
      entry.total += Math.abs(Number(r.amount) || 0)
      entry.count += 1
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 4)
  }, [filteredRelevantTxs])

  return (
    <main style={pageWrap}>
      <div style={container}>
        <EconomicsHeaderNav
          title="Οικονομικό Κέντρο"
          subtitle="Έξοδα"
          rightControl={
            activeFilter ? (
              <button type="button" onClick={clearFilterAndGoMovements} style={clearBtn}>
                Καθαρισμός
              </button>
            ) : undefined
          }
        />

        <EconomicsPeriodFilter period={period} onPeriodChange={(p) => setPeriod(p)} selectedYear={selectedYear} onYearChange={(y) => setSelectedYear(y)} yearOptions={yearOptions} />

        {/* Segmented */}
        <div style={segmentedWrap}>
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => setViewMode(mode.key)}
              style={{
                ...segBtn,
                background: viewMode === mode.key ? 'var(--text)' : 'rgba(255,255,255,0.92)',
                color: viewMode === mode.key ? 'white' : 'var(--text)',
                borderColor: viewMode === mode.key ? 'var(--text)' : 'var(--border)',
                fontWeight: viewMode === mode.key ? 900 : 800,
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Active filter chip */}
        {activeFilter && (
          <div style={chipWrap}>
            <span style={chip}>
              Φίλτρο:{' '}
              {activeFilter.type === 'beneficiary'
                ? 'Δικαιούχος'
                : activeFilter.type === 'category'
                  ? 'Κατηγορία'
                  : 'Μέθοδος'}
              <b style={{ marginLeft: 6 }}>{activeFilter.value}</b>
              <button style={chipX} onClick={() => setActiveFilter(null)} aria-label="Καθαρισμός φίλτρου">
                ✕
              </button>
            </span>
          </div>
        )}

        {/* KPI Grid */}
        <div style={kpiGrid}>
          {/* Total */}
          {(() => {
            const tone = getKpiTone('total')
            return (
              <div style={{ ...kpiCard, background: tone.background, borderColor: tone.border }}>
                <div style={{ color: 'var(--muted)', fontWeight: 800 }}>{isIncomeMode ? 'Συνολικά Έσοδα' : 'Συνολικά Έξοδα'}</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8, color: tone.valueColor }}>
                  {Number(totalAmount).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </div>
              </div>
            )
          })()}

          {/* Cash */}
          {(() => {
            const tone = getKpiTone('cash')
            return (
              <div style={{ ...kpiCard, background: tone.background, borderColor: tone.border }}>
                <div style={{ color: 'var(--muted)', fontWeight: 800 }}>{isIncomeMode ? 'Έσοδα Μετρητοίς' : 'Έξοδα Μετρητοίς'}</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8, color: tone.valueColor }}>
                  {Number(cashAmount).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </div>
              </div>
            )
          })()}

          {/* Credit */}
          {(() => {
            const tone = getKpiTone('credit')
            return (
              <div style={{ ...kpiCard, background: tone.background, borderColor: tone.border }}>
                <div style={{ color: 'var(--muted)', fontWeight: 800 }}>{isIncomeMode ? 'Έσοδα Πίστωσης' : 'Έξοδα Πίστωσης'}</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8, color: tone.valueColor }}>
                  {Number(creditAmount).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </div>
              </div>
            )
          })()}

          {/* Average */}
          {(() => {
            const tone = getKpiTone('avg')
            return (
              <div style={{ ...kpiCard, background: tone.background, borderColor: tone.border }}>
                <div style={{ color: 'var(--muted)', fontWeight: 800 }}>{isIncomeMode ? 'Μέσο Έσοδο' : 'Μέσο Έξοδο'}</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8, color: tone.valueColor }}>
                  {Number(avgAmount).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                </div>
              </div>
            )
          })()}
        </div>

        {/* Top Suppliers & Categories */}
        <section style={{ ...summarySection, background: 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 900 }}>Κορυφαίοι Δικαιούχοι</h3>
          </div>
          <div style={{ ...summaryGridThree, marginTop: 12 }}>
            {topEntities.length === 0 ? (
              <div style={emptyText}>Δεν υπάρχουν δικαιούχοι</div>
            ) : (
              topEntities.map((s) => (
                <div
                  key={s.key}
                  style={{
                    ...summaryCard,
                    background: '#f8fbff',
                    border: '1px solid #dbeafe',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minHeight: 120,
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        color: '#0f172a',
                        wordBreak: 'break-word',
                      }}
                    >
                      {s.key}
                    </div>

                    <div
                      style={{
                        color: 'var(--muted)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Δικαιούχος • {s.rows.length} κινήσεις
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: '#0f172a',
                        wordBreak: 'keep-all',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {Number(s.total).toLocaleString('el-GR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}€
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={{ ...summarySection, background: 'transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16, fontWeight: 900 }}>Κορυφαίες Κατηγορίες</h3>
          </div>
          <div style={{ ...summaryGridFour, marginTop: 12 }}>
            {topCategories.length === 0 ? (
              <div style={emptyText}>Δεν υπάρχουν κατηγορίες</div>
            ) : (
              topCategories.map((c) => (
                <div
                  key={c.key}
                  style={{
                    ...summaryCard,
                    background: '#fcfaff',
                    border: '1px solid #e9d5ff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minHeight: 120,
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.25,
                        fontWeight: 900,
                        color: '#312e81',
                        wordBreak: 'break-word',
                      }}
                    >
                      {displayCategoryLabel(c.key)}
                    </div>

                    <div
                      style={{
                        color: 'var(--muted)',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Κατηγορία • {c.count} κινήσεις
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 900,
                        color: '#312e81',
                        wordBreak: 'keep-all',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {Number(c.total).toLocaleString('el-GR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}€
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Views */}
        {viewMode === 'beneficiary' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Δικαιούχο</h2>
            <input
              style={searchInput}
              placeholder="Αναζήτηση δικαιούχου..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div style={centerText}>Φόρτωση...</div>
            ) : filteredBeneficiaries.length === 0 ? (
              <div style={emptyText}>Δεν βρέθηκαν δικαιούχοι</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredBeneficiaries.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    style={beneficiaryCard}
                    onClick={() => {
                      setActiveFilter({ type: 'beneficiary', value: g.key })
                      setViewMode('movements')
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 16, color: 'var(--text)' }}>{g.key}</div>
                    <div style={{ color: 'var(--muted)', fontWeight: 850, fontSize: 13 }}>{g.label}</div>
                    <div style={{ marginTop: 6, fontWeight: 950, fontSize: 18, color: 'var(--text)' }}>
                      {Number(g.total).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {Number(g.count)}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : viewMode === 'category' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Κατηγορία</h2>
            <input
              style={searchInput}
              placeholder="Αναζήτηση κατηγορίας..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div style={centerText}>Φόρτωση...</div>
            ) : filteredCategories.length === 0 ? (
              <div style={emptyText}>Δεν βρέθηκαν κατηγορίες</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredCategories.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    style={beneficiaryCard}
                    onClick={() => {
                      setActiveFilter({ type: 'category', value: g.key })
                      setViewMode('movements')
                    }}
                  >
                    <div style={{ fontWeight: 950, fontSize: 16, color: 'var(--text)' }}>{displayCategoryLabel(g.key)}</div>
                    <div style={{ marginTop: 6, fontWeight: 950, fontSize: 18, color: 'var(--text)' }}>
                      {Number(g.total).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {Number(g.count)}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : viewMode === 'method' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Μέθοδο</h2>
            <input
              style={searchInput}
              placeholder="Αναζήτηση μεθόδου..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {loading ? (
              <div style={centerText}>Φόρτωση...</div>
            ) : filteredMethods.length === 0 ? (
              <div style={emptyText}>Δεν βρέθηκαν μέθοδοι</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredMethods.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      style={beneficiaryCard}
                      onClick={() => {
                        setActiveFilter({ type: 'method', value: g.key })
                        setViewMode('movements')
                      }}
                    >
                      <div style={{ fontWeight: 950, fontSize: 16, color: 'var(--text)' }}>{g.key}</div>
                      <div style={{ marginTop: 6, fontWeight: 950, fontSize: 18, color: 'var(--text)' }}>
                        {Number(g.total).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {Number(g.count)}</div>
                    </button>
                  ))}
                </div>
              )}
          </section>
        ) : (
              <section style={card}>
                <h2 style={cardTitle}>Λίστα Κινήσεων</h2>

                {loading ? (
                  <div style={centerText}>Φόρτωση...</div>
                ) : (!filteredMovements || filteredMovements.length === 0) ? (
                  <div style={emptyText}>Δεν υπάρχουν κινήσεις</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      style={searchInput}
                      placeholder="Αναζήτηση προμηθευτή..."
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                    />

                    {filteredMovementGroups.length === 0 ? (
                      <div style={emptyText}>Δεν βρέθηκε προμηθευτής</div>
                    ) : (
                      filteredMovementGroups.map((g) => {
                        return (
                          <div
                            key={g.key}
                            onClick={() => setOpenSupplier((prev) => (prev === g.key ? null : g.key))}
                            style={{
                              borderRadius: 18,
                              border: '1px solid #e5e7eb',
                              background: 'white',
                              padding: 14,
                              marginBottom: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 15,
                                    fontWeight: 900,
                                    color: 'var(--text)',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.25,
                                  }}
                                >
                                  {g.title}
                                </div>

                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--muted)',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {displayCategoryLabel(g.category)} • Τελευταία κίνηση: {formatDateOnly(g.lastDate)}
                                </div>
                              </div>

                              <div
                                style={{
                                  textAlign: 'right',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-end',
                                  gap: 4,
                                }}
                              >
                                <div style={{ fontSize: 16, fontWeight: 900 }}>
                                  {Number(g.total).toLocaleString('el-GR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}€
                                </div>

                                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>{g.count} κινήσεις</div>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              {g.hasCredit ? (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    padding: '6px 10px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 900,
                                    background: '#eef2ff',
                                    color: '#4f46e5',
                                    maxWidth: 'fit-content',
                                  }}
                                >
                                  ΠΙΣΤΩΣΗ
                                </div>
                              ) : null}

                              <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--muted)' }}>{openSupplier === g.key ? '▴' : '▾'}</div>
                            </div>

                            {openSupplier === g.key && (
                              <div style={{ marginTop: 12 }}>
                                {g.rows.slice(0, 5).map((r) => (
                                  <div
                                    key={r.id}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '8px 0',
                                      borderBottom: '1px solid var(--border)',
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ fontSize: 13, fontWeight: 800 }}>{formatDate(r.created_at || r.date)}</div>
                                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                        {r.category ? displayCategoryLabel(r.category) : (String(r.fixed_assets?.sub_category || '').trim().toLowerCase() === 'staff' ? 'Προσωπικό' : '—')}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      {r.is_credit ? <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>Πίστωση</div> : null}
                                      <div style={{ fontWeight: 900 }}>{Math.abs(Number(r.amount) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</div>
                                    </div>
                                  </div>
                                ))}

                                {g.rows.length > 5 ? (
                                  <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800, marginTop: 8 }}>Εμφανίζονται οι 5 πιο πρόσφατες κινήσεις</div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
    </main>
  )
}

/* ---------------- STYLES ---------------- */

// CSS vars fallback (αν δεν έχεις global vars)
const pageWrap: CSSProperties = {
  // @ts-ignore
  '--text': '#0f172a',
  // @ts-ignore
  '--muted': '#64748b',
  // @ts-ignore
  '--border': '#e2e8f0',
  // @ts-ignore
  '--shadow': '0 12px 24px rgba(15,23,42,0.06)',
  minHeight: '100%',
  background: '#f8fafc',
  padding: 16,
}

const container: CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  paddingBottom: 120,
}

const headerCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const title: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.1,
}

const subtitle: CSSProperties = {
  margin: '6px 0 0 0',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 850,
}

const clearBtn: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: '#fff',
  padding: '10px 12px',
  fontWeight: 900,
  cursor: 'pointer',
}

const segmentedWrap: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 12,
  flexWrap: 'wrap',
}

const segBtn: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 120,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontSize: 14,
}

const card: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 16,
}

const cardTitle: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 950,
}

const chipWrap: CSSProperties = {
  margin: '12px 0 0 0',
  display: 'flex',
  gap: 8,
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--muted)',
  color: 'white',
  borderRadius: 16,
  padding: '6px 12px',
  fontWeight: 900,
  fontSize: 14,
  gap: 6,
}

const chipX: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'white',
  fontWeight: 900,
  fontSize: 16,
  marginLeft: 4,
  cursor: 'pointer',
}

const searchInput: CSSProperties = {
  width: '100%',
  margin: '12px 0 18px 0',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  fontSize: 15,
  fontWeight: 800,
  background: 'rgba(255,255,255,0.95)',
  color: 'var(--text)',
  outline: 'none',
}

const beneficiaryCard: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  textAlign: 'left',
  cursor: 'pointer',
}

const movementCard: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: 'var(--shadow)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflow: 'hidden',
}

const centerText: CSSProperties = { padding: 24, textAlign: 'center', fontWeight: 850, color: 'var(--text)' }
const emptyText: CSSProperties = { padding: 24, textAlign: 'center', fontWeight: 850, color: 'var(--muted)' }

const kpiGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 16,
  marginTop: 16,
}

const kpiCard: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface, rgba(255,255,255,0.97))',
  padding: 16,
  boxShadow: 'var(--shadow)',
}

const summarySection: CSSProperties = {
  marginTop: 16,
  borderRadius: 20,
  padding: 12,
}

const summaryGridThree: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  marginTop: 12,
}

const summaryGridFour: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
  marginTop: 12,
}

const summaryCard: CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--surface, rgba(255,255,255,0.97))',
  padding: 12,
  textAlign: 'left',
}