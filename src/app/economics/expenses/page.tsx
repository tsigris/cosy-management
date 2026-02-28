'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import EconomicsTabs from '@/components/EconomicsTabs'

/** Supabase (browser safe) */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** Types */
type ExpenseRow = {
  id: string
  date: string
  amount: number
  type: 'expense' | 'debt_payment' | string
  method?: string | null
  category?: string | null
  is_credit?: boolean | null
  created_at?: string | null
  suppliers?: { name?: string | null } | null
  fixed_assets?: { name?: string | null; sub_category?: string | null } | null
}

type DrilldownFilter = { type: 'beneficiary' | 'category' | 'method'; value: string } | null

type ViewMode = 'movements' | 'beneficiary' | 'category' | 'method'

const VIEW_MODES: Array<{ key: ViewMode; label: string }> = [
  { key: 'movements', label: 'Κινήσεις' },
  { key: 'beneficiary', label: 'Ανά Δικαιούχο' },
  { key: 'category', label: 'Ανά Κατηγορία' },
  { key: 'method', label: 'Ανά Μέθοδο' },
]

/** Helpers */
function stripDiacritics(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function norm(s: string) {
  return stripDiacritics(String(s || '')).toLowerCase().trim()
}

function getBeneficiaryKey(r: ExpenseRow) {
  return (r.suppliers?.name || r.fixed_assets?.name || 'Άλλο').trim()
}

function mapAssetLabel(sub?: string | null) {
  const sc = String(sub || '').toLowerCase().trim()
  if (sc === 'staff') return 'Προσωπικό'
  if (sc === 'maintenance' || sc === 'worker') return 'Συντήρηση'
  if (sc === 'utility' || sc === 'utilities') return 'Λογαριασμός'
  return 'Λοιπά'
}

function groupByBeneficiary(rows: ExpenseRow[]) {
  const map = new Map<string, { key: string; label: string; total: number; count: number }>()
  for (const r of rows) {
    const key = getBeneficiaryKey(r)
    let label = 'Λοιπά'
    if (r.suppliers?.name) label = 'Προμηθευτής'
    else if (r.fixed_assets?.sub_category) label = mapAssetLabel(r.fixed_assets.sub_category)

    if (!map.has(key)) map.set(key, { key, label, total: 0, count: 0 })
    const entry = map.get(key)!
    if (r.type === 'expense') entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function groupByCategory(rows: ExpenseRow[]) {
  const map = new Map<string, { key: string; total: number; count: number }>()
  for (const r of rows) {
    const key = (r.category || 'Άλλη Κατηγορία').trim()
    if (!map.has(key)) map.set(key, { key, total: 0, count: 0 })
    const entry = map.get(key)!
    if (r.type === 'expense') entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function groupByMethod(rows: ExpenseRow[]) {
  const map = new Map<string, { key: string; total: number; count: number }>()
  for (const r of rows) {
    const key = (r.method || 'Άλλη Μέθοδος').trim()
    if (!map.has(key)) map.set(key, { key, total: 0, count: 0 })
    const entry = map.get(key)!
    if (r.type === 'expense') entry.total += Math.abs(Number(r.amount) || 0)
    entry.count += 1
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function filterBySearch<T extends { key: string; label?: string }>(groups: T[], q: string) {
  const qq = norm(q)
  if (!qq) return groups
  return groups.filter((g) => norm(g.key).includes(qq) || (g.label ? norm(g.label).includes(qq) : false))
}

function monthRangeFromDate(dateStr: string) {
  // expects YYYY-MM-DD
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)

  const toISO = (x: Date) => x.toISOString().slice(0, 10)
  return { start: toISO(start), end: toISO(end) }
}

function formatEUR(n: number) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

export default function EconomicsExpensesPage() {
  const searchParams = useSearchParams()
  const selectedDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  const [viewMode, setViewMode] = useState<ViewMode>('movements')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<DrilldownFilter>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // reset search when switching view
  useEffect(() => {
    setSearch('')
  }, [viewMode])

  // Fetch monthly expenses/debt payments
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setErrorMsg(null)

      const storeId = (typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : '')?.trim()
      if (!storeId) {
        setRows([])
        setLoading(false)
        setErrorMsg('Δεν βρέθηκε active_store_id')
        return
      }

      const { start, end } = monthRangeFromDate(selectedDate)

      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          id, date, amount, type, method, category, is_credit, created_at,
          suppliers:suppliers(name),
          fixed_assets:fixed_assets(name, sub_category)
        `,
        )
        .eq('store_id', storeId)
        .gte('date', start)
        .lte('date', end)
        .in('type', ['expense', 'debt_payment'])
        .order('date', { ascending: false })

      if (error) {
        setRows([])
        setLoading(false)
        setErrorMsg(error.message || 'Σφάλμα φόρτωσης')
        return
      }

      // normalize joins (sometimes array, sometimes object depending on relationship)
      const safe = Array.isArray(data)
        ? (data as any[]).map((r) => ({
            ...r,
            suppliers: Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers,
            fixed_assets: Array.isArray(r.fixed_assets) ? r.fixed_assets[0] : r.fixed_assets,
          }))
        : []

      setRows(safe)
      setLoading(false)
    }

    run()
  }, [selectedDate])

  const monthLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return d.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' })
  }, [selectedDate])

  // Drilldown movements
  const filteredMovements = useMemo(() => {
    let out = rows

    if (activeFilter) {
      if (activeFilter.type === 'beneficiary') {
        out = out.filter((r) => getBeneficiaryKey(r) === activeFilter.value)
      } else if (activeFilter.type === 'category') {
        out = out.filter((r) => (r.category || 'Άλλη Κατηγορία').trim() === activeFilter.value)
      } else if (activeFilter.type === 'method') {
        out = out.filter((r) => (r.method || 'Άλλη Μέθοδος').trim() === activeFilter.value)
      }
    }

    return out
  }, [rows, activeFilter])

  // Grouped views
  const beneficiaryGroups = useMemo(() => groupByBeneficiary(rows), [rows])
  const categoryGroups = useMemo(() => groupByCategory(rows), [rows])
  const methodGroups = useMemo(() => groupByMethod(rows), [rows])

  const filteredBeneficiaries = useMemo(() => filterBySearch(beneficiaryGroups, search), [beneficiaryGroups, search])
  const filteredCategories = useMemo(() => filterBySearch(categoryGroups, search), [categoryGroups, search])
  const filteredMethods = useMemo(() => filterBySearch(methodGroups, search), [methodGroups, search])

  const activeFilterLabel = useMemo(() => {
    if (!activeFilter) return ''
    if (activeFilter.type === 'beneficiary') return 'Δικαιούχος'
    if (activeFilter.type === 'category') return 'Κατηγορία'
    return 'Μέθοδος'
  }, [activeFilter])

  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={headerCard}>
          <h1 style={title}>Οικονομικό Κέντρο</h1>
          <p style={subtitle}>Δαπάνες • {monthLabel}</p>
        </div>

        <EconomicsTabs />

        {/* Segmented control */}
        <div style={segmentedWrap}>
          {VIEW_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setViewMode(m.key)}
              style={{
                ...segBtn,
                background: viewMode === m.key ? 'var(--text)' : 'rgba(255,255,255,0.92)',
                color: viewMode === m.key ? 'white' : 'var(--text)',
                borderColor: viewMode === m.key ? 'var(--text)' : 'var(--border)',
                fontWeight: viewMode === m.key ? 900 : 800,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Active filter chip */}
        {activeFilter && (
          <div style={chipWrap}>
            <span style={chip}>
              Φίλτρο: {activeFilterLabel}
              <b style={{ marginLeft: 6 }}>{activeFilter.value}</b>
              <button style={chipX} onClick={() => setActiveFilter(null)} aria-label="Καθαρισμός φίλτρου">
                ✕
              </button>
            </span>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <section style={card}>
            <h2 style={cardTitle}>Σφάλμα</h2>
            <div style={{ marginTop: 10, fontWeight: 800, color: 'var(--muted)' }}>{errorMsg}</div>
          </section>
        )}

        {/* Views */}
        {viewMode === 'beneficiary' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Δικαιούχο</h2>
            <input style={searchInput} placeholder="Αναζήτηση δικαιούχου..." value={search} onChange={(e) => setSearch(e.target.value)} />

            {loading ? (
              <div style={emptyState}>Φόρτωση...</div>
            ) : filteredBeneficiaries.length === 0 ? (
              <div style={emptyStateMuted}>Δεν βρέθηκαν δικαιούχοι</div>
            ) : (
              <div style={listCol}>
                {filteredBeneficiaries.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    style={beneficiaryCardBtn}
                    onClick={() => {
                      setActiveFilter({ type: 'beneficiary', value: g.key })
                      setViewMode('movements')
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>{g.key}</div>
                    <div style={{ color: 'var(--muted)', fontWeight: 900, fontSize: 13 }}>{g.label}</div>
                    <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{formatEUR(g.total)}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {g.count}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : viewMode === 'category' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Κατηγορία</h2>
            <input style={searchInput} placeholder="Αναζήτηση κατηγορίας..." value={search} onChange={(e) => setSearch(e.target.value)} />

            {loading ? (
              <div style={emptyState}>Φόρτωση...</div>
            ) : filteredCategories.length === 0 ? (
              <div style={emptyStateMuted}>Δεν βρέθηκαν κατηγορίες</div>
            ) : (
              <div style={listCol}>
                {filteredCategories.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    style={beneficiaryCardBtn}
                    onClick={() => {
                      setActiveFilter({ type: 'category', value: g.key })
                      setViewMode('movements')
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>{g.key}</div>
                    <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{formatEUR(g.total)}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {g.count}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : viewMode === 'method' ? (
          <section style={card}>
            <h2 style={cardTitle}>Ανά Μέθοδο</h2>
            <input style={searchInput} placeholder="Αναζήτηση μεθόδου..." value={search} onChange={(e) => setSearch(e.target.value)} />

            {loading ? (
              <div style={emptyState}>Φόρτωση...</div>
            ) : filteredMethods.length === 0 ? (
              <div style={emptyStateMuted}>Δεν βρέθηκαν μέθοδοι</div>
            ) : (
              <div style={listCol}>
                {filteredMethods.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    style={beneficiaryCardBtn}
                    onClick={() => {
                      setActiveFilter({ type: 'method', value: g.key })
                      setViewMode('movements')
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>{g.key}</div>
                    <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{formatEUR(g.total)}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 800 }}>Κινήσεις: {g.count}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section style={card}>
            <h2 style={cardTitle}>Λίστα Κινήσεων</h2>

            {loading ? (
              <div style={emptyState}>Φόρτωση...</div>
            ) : filteredMovements.length === 0 ? (
              <div style={emptyStateMuted}>Δεν βρέθηκαν κινήσεις</div>
            ) : (
              <div style={listColTight}>
                {filteredMovements.map((r) => (
                  <div key={r.id} style={movementCard}>
                    <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>{getBeneficiaryKey(r)}</div>
                    <div style={{ color: 'var(--muted)', fontWeight: 800, fontSize: 12 }}>
                      {(r.category || '—').trim()} • {(r.method || '—').trim()} • {r.type === 'debt_payment' ? 'Εξόφληση' : 'Δαπάνη'}
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginTop: 4 }}>
                      {formatEUR(Math.abs(Number(r.amount) || 0))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800 }}>{r.date}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

/* -------------------- STYLES -------------------- */

const pageWrap: CSSProperties = {
  minHeight: '100dvh',
  background: 'var(--bg-grad)',
  padding: 18,
}

const container: CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  paddingBottom: 120,
}

const headerCard: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  marginBottom: 12,
}

const title: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 24,
  fontWeight: 900,
}

const subtitle: CSSProperties = {
  margin: '6px 0 0 0',
  color: 'var(--muted)',
  fontSize: 13,
  fontWeight: 800,
}

const segmentedWrap: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
  marginBottom: 12,
}

const segBtn: CSSProperties = {
  flex: 1,
  padding: '12px 10px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  cursor: 'pointer',
  fontSize: 14,
  userSelect: 'none',
  boxShadow: 'var(--shadow)',
}

const card: CSSProperties = {
  marginTop: 12,
  borderRadius: 22,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: 'var(--shadow)',
  padding: 18,
}

const cardTitle: CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 900,
}

const chipWrap: CSSProperties = {
  margin: '10px 0 0 0',
  display: 'flex',
  gap: 8,
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--text)',
  color: 'white',
  borderRadius: 16,
  padding: '6px 12px',
  fontWeight: 900,
  fontSize: 13,
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
  margin: '12px 0 16px 0',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 15,
  fontWeight: 800,
  background: 'rgba(255,255,255,0.95)',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const listCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const listColTight: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 12,
}

const beneficiaryCardBtn: CSSProperties = {
  textAlign: 'left',
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: 'var(--shadow)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  cursor: 'pointer',
}

const movementCard: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: 'var(--shadow)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const emptyState: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  fontWeight: 900,
  color: 'var(--text)',
}

const emptyStateMuted: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  fontWeight: 900,
  color: 'var(--muted)',
}