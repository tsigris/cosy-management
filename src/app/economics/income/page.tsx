'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { getSupabase } from '@/lib/supabase'
import { currencyFormatterEUR, formatTimeEl } from '@/lib/formatters'
import { ChevronDown, ChevronUp } from 'lucide-react'

type TxRow = {
  id: string
  created_at: string | null
  date: string
  amount: number
  type: string
  category: string | null
  method: string | null
  notes: string | null
  revenue_source_id?: string | null
}

const INCOME_TYPES = new Set([
  'income',
  'income_collection',
  'debt_received',
  'revenue',
  'sale',
  'payment',
  'booking',
  'deposit',
])

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateKeyEl(key: string) {
  const [y, m, d] = key.split('-')
  if (!y || !m || !d) return key
  return `${d}/${m}/${y}`
}

const parseTxDate = (r: any) => {
  if (!r) return null
  const raw = r.date
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const parseCreatedAtTime = (r: any) => {
  if (!r) return null
  const raw = r.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function normalizeMethod(m?: string | null) {
  if (!m) return 'Λοιπά'
  const s = m.toLowerCase()
  if (s.includes('cash') || s.includes('μετρητ')) return 'Μετρητά'
  if (s.includes('card') || s.includes('κάρτα') || s.includes('pos')) return 'Κάρτα'
  return 'Λοιπά'
}

function isZRow(r: TxRow) {
  const category = String(r.category || '').trim()
  const notes = String(r.notes || '').toUpperCase()
  const method = String(r.method || '').trim()

  if (category === 'Εσοδα Ζ') return true
  if (notes.includes('Ζ ΤΑΜΕΙΑΚΗΣ')) return true
  if (notes.includes('Ζ ΤΑΜΕΙΑΚΗΣ (POS)')) return true
  if (method === 'Μετρητά (Z)') return true
  if (method === 'Κάρτα' && category === 'Εσοδα Ζ') return true
  return false
}

function getPeriodDateRange(period: string, year: number): { from: string | null; to: string | null } {
  const now = new Date()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { from, to }
  }
  if (period === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
  if (period === '30days') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return { from: d.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
  }
  // 'all' — no date bounds
  return { from: null, to: null }
}

export default function EconomicsIncomePage() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')?.trim() || ''

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<TxRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  // period & filter state
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [filterFrom, setFilterFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().slice(0, 10))

  const [searchQ, setSearchQ] = useState('')

  useEffect(() => {
    // set defaults for month
    const now = new Date()
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setFilterFrom(mStart.toISOString().slice(0, 10))
    setFilterTo(mEnd.toISOString().slice(0, 10))
  }, [])

  useEffect(() => {
    // respond to period changes
    if (period === 'month') {
      const now = new Date()
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setFilterFrom(mStart.toISOString().slice(0, 10))
      setFilterTo(mEnd.toISOString().slice(0, 10))
    } else if (period === 'year') {
      setFilterFrom(`${selectedYear}-01-01`)
      setFilterTo(`${selectedYear}-12-31`)
    } else if (period === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setFilterFrom(d.toISOString().slice(0, 10))
      setFilterTo(new Date().toISOString().slice(0, 10))
    } else if (period === 'all') {
      setFilterFrom('1970-01-01')
      setFilterTo('9999-12-31')
    }
  }, [period, selectedYear])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!storeId) {
        setRows([])
        setErrorMessage('Δεν βρέθηκε store στο URL.')
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const supabase = getSupabase()
        const { from: dateFrom, to: dateTo } = getPeriodDateRange(period, selectedYear)

        let query = supabase
          .from('transactions')
          .select('id,created_at,amount,type,category,method,date,is_credit,notes,revenue_source_id')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        if (dateFrom) query = query.gte('date', dateFrom)
        if (dateTo) query = query.lte('date', dateTo)

        const { data, error } = await query

        if (error) throw error

        const mapped: TxRow[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          created_at: r.created_at ? String(r.created_at) : null,
          amount: Number(r.amount) || 0,
          type: String(r.type || ''),
          category: r.category ? String(r.category) : null,
          method: r.method ? String(r.method) : null,
          date: String(r.date || ''),
          notes: r.notes ? String(r.notes) : null,
          revenue_source_id: r.revenue_source_id ?? null,
        }))

        if (!cancelled) setRows(mapped)
      } catch (e) {
        console.error('Income load failed', e)
        if (!cancelled) setErrorMessage('Αποτυχία φόρτωσης δεδομένων.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [storeId, period, selectedYear])

  // derive filtered income rows
  const filtered = useMemo(() => {
    const from = filterFrom || '1970-01-01'
    const to = filterTo || '9999-12-31'
    const q = searchQ.trim().toLowerCase()

    return rows.filter((r) => {
      const d = parseTxDate(r)
      if (!d) return false
      if (r.date < from || r.date > to) return false
      if (!INCOME_TYPES.has(r.type)) return false
      if (q) {
        const hay = `${r.category || ''} ${r.notes || ''} ${r.type || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filterFrom, filterTo, searchQ])

  // Group by business day (YYYY-MM-DD)
  const grouped = useMemo(() => {
    const map = new Map<string, TxRow[]>()
    for (const r of filtered) {
      if (!r.date) continue
      const d = new Date(r.date)
      if (isNaN(d.getTime())) continue
      const key = r.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }

    for (const [, items] of map) {
      items.sort((a, b) => {
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
        return bCreated - aCreated
      })
    }

    // sort keys descending (newest first)
    const entries = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
    return entries
  }, [filtered])

  const zRows = useMemo(() => {
    return filtered.filter((r) => isZRow(r))
  }, [filtered])

  const zGrouped = useMemo(() => {
    const map = new Map<string, TxRow[]>()
    for (const r of zRows) {
      if (!r.date) continue
      const d = new Date(r.date)
      if (isNaN(d.getTime())) continue
      const key = r.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }

    for (const [, items] of map) {
      items.sort((a, b) => {
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
        return bCreated - aCreated
      })
    }

    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [zRows])

  const amountFmt = currencyFormatterEUR

  // compute KPIs: today, yesterday, month total, avg daily
  const KPIs = useMemo(() => {
    const now = new Date()
    const todayKey = toDateKey(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toDateKey(yesterday)

    let today = 0
    let yesterdayTotal = 0
    let monthTotal = 0
    const dayCounts = new Map<string, number>()

    for (const [day, items] of grouped) {
      let dayTotal = 0
      for (const it of items) {
        dayTotal += Math.abs(it.amount)
      }
      dayCounts.set(day, dayTotal)
      if (day === todayKey) today = dayTotal
      if (day === yesterdayKey) yesterdayTotal = dayTotal
      // month check: day string starts with YYYY-MM
      const [y, m] = day.split('-')
      const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      if (day.startsWith(nowYm)) monthTotal += dayTotal
    }

    const avgDaily = grouped.length ? Math.round((monthTotal || 0) / Math.max(1, grouped.length)) : 0

    return { today, yesterday: yesterdayTotal, monthTotal, avgDaily }
  }, [grouped])

  // business day keys for badges and quick lookup
  const now = new Date()
  const todayKey = toDateKey(now)
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayKey = toDateKey(yesterdayDate)

  // derive cash/card breakdown for today, yesterday and current month (presentation only)
  const dayBreakdowns = useMemo(() => {
    const map = new Map<string, { total: number; cash: number; card: number; other: number }>()
    for (const [day, items] of grouped) {
      let total = 0
      let cash = 0
      let card = 0
      for (const it of items) {
        const amt = Math.abs(it.amount)
        total += amt
        const m = normalizeMethod(it.method)
        if (m === 'Μετρητά') cash += amt
        else if (m === 'Κάρτα') card += amt
      }
      const other = Math.max(0, total - cash - card)
      map.set(day, { total, cash, card, other })
    }
    return map
  }, [grouped])

  const todayBreak = dayBreakdowns.get(todayKey) || { total: 0, cash: 0, card: 0, other: 0 }
  const yesterdayBreak = dayBreakdowns.get(yesterdayKey) || { total: 0, cash: 0, card: 0, other: 0 }

  const monthCashCard = useMemo(() => {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let cash = 0
    let card = 0
    for (const [day, v] of dayBreakdowns) {
      if (!day.startsWith(ym)) continue
      cash += v.cash
      card += v.card
    }
    return { cash, card }
  }, [dayBreakdowns])

  // Last Z (most recent day with income)
  const zDayBreakdowns = useMemo(() => {
    const map = new Map<string, { total: number; cash: number; card: number; other: number }>()
    for (const [day, items] of zGrouped) {
      let total = 0
      let cash = 0
      let card = 0
      for (const it of items) {
        const amt = Math.abs(it.amount)
        total += amt
        const m = normalizeMethod(it.method)
        if (m === 'Μετρητά') cash += amt
        else if (m === 'Κάρτα') card += amt
      }
      const other = Math.max(0, total - cash - card)
      map.set(day, { total, cash, card, other })
    }
    return map
  }, [zGrouped])

  const lastZ = zGrouped.length ? zGrouped[0] : null
  const lastZBreak = lastZ ? zDayBreakdowns.get(lastZ[0]) || { total: 0, cash: 0, card: 0, other: 0 } : null

  // expanded days
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleDay = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }))

  // year options
  const yearOptions = useMemo(() => {
    const s = new Set<number>()
    for (const r of rows) {
      const d = parseTxDate(r)
      if (d) s.add(d.getFullYear())
    }
    if (!s.size) s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
  }, [rows])

  const styles = {
    page: { minHeight: '100vh', paddingBottom: 120 },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 12 },
    kpiCard: { padding: 12, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)' as const, minHeight: 76 },
    kpiTitle: { fontWeight: 900, fontSize: 13, color: 'var(--muted)' },
    kpiTotal: { fontSize: 20, marginTop: 6, fontWeight: 900 },
    kpiSmall: { fontSize: 12, color: 'var(--muted)', marginTop: 6 },
    list: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 },
    dayCard: {
      padding: 16,
      borderRadius: 22,
      background: 'rgba(255,255,255,0.96)',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    // Header row: date+badge (left) and total (right)
    dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    dateRow: { display: 'flex', alignItems: 'center', gap: 8 },
    dateText: { fontSize: 18, fontWeight: 900, color: '#0f172a' },
    totalText: { fontSize: 20, fontWeight: 900, color: '#0f172a', textAlign: 'right' },
    // badge: inline element
    badge: { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 },
    // breakdown row (pills)
    breakdownRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    pill: { display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, gap: 6 },
    cashPill: { background: '#ECFDF5', color: '#166534', border: '1px solid #A7F3D0' },
    cardPill: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
    // meta row
    metaRow: { fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 6 },
    chip: { display: 'inline-flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 12, background: 'transparent', border: '1px solid var(--border)', minWidth: 120 },
    txRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed var(--border)' },
    expandBtn: { border: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 900, cursor: 'pointer' },
    lastZCard: { padding: 12, borderRadius: 18, background: 'var(--surfaceSolid)', border: '1px solid var(--border)', marginTop: 12 },
  }

  return (
    <main style={styles.page}>
      <EconomicsContainer>
        <EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Έσοδα" />

        <EconomicsPeriodFilter period={period} onPeriodChange={(p) => setPeriod(p)} selectedYear={selectedYear} onYearChange={(y) => setSelectedYear(y)} yearOptions={yearOptions} />

        <section style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Αναζήτηση (σημειώσεις/κατηγορία)" style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }} />
            </div>
          </div>

          {/* KPI row */}
          <div style={styles.kpiGrid as any}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Σήμερα</div>
              <div style={styles.kpiTotal}>{loading ? '—' : amountFmt.format(KPIs.today)}</div>
              <div style={styles.kpiSmall}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ color: 'var(--muted)' }}>Μετρητά</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(todayBreak.cash)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
                  <div style={{ color: 'var(--muted)' }}>Κάρτα</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(todayBreak.card)}</div>
                </div>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Χθες</div>
              <div style={styles.kpiTotal}>{loading ? '—' : amountFmt.format(KPIs.yesterday)}</div>
              <div style={styles.kpiSmall}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)' }}>Μετρητά</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(yesterdayBreak.cash)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ color: 'var(--muted)' }}>Κάρτα</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(yesterdayBreak.card)}</div>
                </div>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Τρέχων Μήνας</div>
              <div style={styles.kpiTotal}>{loading ? '—' : amountFmt.format(KPIs.monthTotal)}</div>
              <div style={styles.kpiSmall}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)' }}>Μετρητά μήνα</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(monthCashCard.cash)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <div style={{ color: 'var(--muted)' }}>Κάρτα μήνα</div>
                  <div style={{ fontWeight: 900 }}>{loading ? '—' : amountFmt.format(monthCashCard.card)}</div>
                </div>
              </div>
            </div>

            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Μέσο Ημερήσιο</div>
              <div style={styles.kpiTotal}>{loading ? '—' : amountFmt.format(KPIs.avgDaily)}</div>
            </div>
          </div>

          {/* Last Z card (most recent day with income) */}
          {lastZ && lastZBreak && (
            <div style={styles.lastZCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>Τελευταίο Ζ</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{formatDateKeyEl(lastZ[0])}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{amountFmt.format(lastZBreak.total)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ color: 'var(--muted)' }}>Μετρητά</div>
                      <div style={{ fontWeight: 900 }}>{amountFmt.format(lastZBreak.cash)}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ color: 'var(--muted)' }}>Κάρτα</div>
                      <div style={{ fontWeight: 900 }}>{amountFmt.format(lastZBreak.card)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily list */}
          <div style={styles.list as any}>
            {zGrouped.length === 0 && !loading ? <div style={{ color: 'var(--muted)' }}>Δεν υπάρχουν εγγραφές Z στη διάρκεια.</div> : null}

            {zGrouped.map(([day, items]) => {
              const total = items.reduce((a, b) => a + Math.abs(b.amount), 0)
              const cash = items.filter((i) => normalizeMethod(i.method) === 'Μετρητά').reduce((a, b) => a + Math.abs(b.amount), 0)
              const card = items.filter((i) => normalizeMethod(i.method) === 'Κάρτα').reduce((a, b) => a + Math.abs(b.amount), 0)
              const other = total - cash - card
              const isExpanded = !!expanded[day]

              return (
                <div key={day} style={styles.dayCard as any}>
                  <div style={styles.dayHeader as any}>
                    <div style={styles.dateRow as any}>
                      <div style={styles.dateText as any}>{formatDateKeyEl(day)}</div>
                      {day === todayKey ? (
                        <span style={{ ...styles.badge as any, background: '#DCFCE7', color: '#166534' }}>Σήμερα</span>
                      ) : null}
                      {day === yesterdayKey ? (
                        <span style={{ ...styles.badge as any, background: '#E0E7FF', color: '#3730A3' }}>Χθες</span>
                      ) : null}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={styles.totalText as any}>{amountFmt.format(total)}</div>
                    </div>
                  </div>

                  <div style={styles.breakdownRow as any}>
                    <div style={{ ...styles.pill as any, ...styles.cashPill as any }}>
                      <div>Μετρητά</div>
                      <div style={{ fontWeight: 900 }}>{amountFmt.format(cash)}</div>
                    </div>

                    <div style={{ ...styles.pill as any, ...styles.cardPill as any }}>
                      <div>Κάρτα</div>
                      <div style={{ fontWeight: 900 }}>{amountFmt.format(card)}</div>
                    </div>
                  </div>

                  <div style={styles.metaRow as any}>{items.length} κινήσεις • Z ταμειακής</div>

                  {isExpanded && (
                    <div style={{ marginTop: 10 }}>
                      {items.map((t) => (
                        <div key={t.id} style={styles.txRow as any}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', width: 64 }}>{(() => {
                              const d = parseCreatedAtTime(t)
                              return d ? formatTimeEl(d) : '-'
                            })()}</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category || t.notes || t.type}</div>
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.notes || ''}</div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900 }}>{amountFmt.format(Math.abs(t.amount))}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{normalizeMethod(t.method)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => toggleDay(day)} style={styles.expandBtn as any}>
                      {expanded[day] ? (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ChevronUp size={14} /> Απόκρυψη</span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ChevronDown size={14} /> Λεπτομέρειες</span>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </EconomicsContainer>
    </main>
  )
}
