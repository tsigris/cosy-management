'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import { getSupabase } from '@/lib/supabase'
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

// BUSINESS DAY cutoff (07:00) — reuse canon used across the app
const BUSINESS_CUTOFF_HOUR = 7
const parseTxDate = (r: any) => {
  if (!r) return null
  const raw = r.created_at || r.date
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const toBusinessDayDate = (d: Date) => {
  const bd = new Date(d)
  if (bd.getHours() < BUSINESS_CUTOFF_HOUR) bd.setDate(bd.getDate() - 1)
  bd.setHours(12, 0, 0, 0)
  return bd
}

const formatDateEl = (d: Date) => toBusinessDayDate(d).toLocaleDateString('el-GR')
const formatTime = (d: Date) => d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })

function normalizeMethod(m?: string | null) {
  if (!m) return 'Λοιπά'
  const s = m.toLowerCase()
  if (s.includes('cash') || s.includes('μετρητ')) return 'Μετρητά'
  if (s.includes('card') || s.includes('κάρτα') || s.includes('pos')) return 'Κάρτα'
  return 'Λοιπά'
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
      setFilterFrom('0000-01-01')
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
        const { data, error } = await supabase
          .from('transactions')
          .select('id,created_at,amount,type,category,method,date,is_credit,notes,revenue_source_id')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(800)

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
  }, [storeId])

  // derive filtered income rows
  const filtered = useMemo(() => {
    const from = filterFrom || '0000-01-01'
    const to = filterTo || '9999-12-31'
    const q = searchQ.trim().toLowerCase()

    return rows.filter((r) => {
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
      const d = parseTxDate(r)
      const key = d ? toBusinessDayDate(d).toISOString().slice(0, 10) : r.date || 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    // sort keys descending (newest first)
    const entries = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
    return entries
  }, [filtered])

  const amountFmt = useMemo(() => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }), [])

  // compute KPIs: today, yesterday, month total, avg daily
  const KPIs = useMemo(() => {
    const now = new Date()
    const todayKey = toBusinessDayDate(now).toISOString().slice(0, 10)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayKey = toBusinessDayDate(yesterday).toISOString().slice(0, 10)

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
    container: { maxWidth: 920, margin: '0 auto', padding: '0 16px' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginTop: 12 },
    kpiCard: { padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' as const },
    list: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 },
    dayCard: { padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' },
    txRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px dashed var(--border)' },
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
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
              <div style={{ fontWeight: 900 }}>Σήμερα</div>
              <div style={{ fontSize: 20, marginTop: 6 }}>{loading ? '—' : amountFmt.format(KPIs.today)}</div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ fontWeight: 900 }}>Χθες</div>
              <div style={{ fontSize: 20, marginTop: 6 }}>{loading ? '—' : amountFmt.format(KPIs.yesterday)}</div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ fontWeight: 900 }}>Τρέχων Μήνας</div>
              <div style={{ fontSize: 20, marginTop: 6 }}>{loading ? '—' : amountFmt.format(KPIs.monthTotal)}</div>
            </div>

            <div style={styles.kpiCard}>
              <div style={{ fontWeight: 900 }}>Μέσο Ημερήσιο</div>
              <div style={{ fontSize: 20, marginTop: 6 }}>{loading ? '—' : amountFmt.format(KPIs.avgDaily)}</div>
            </div>
          </div>

          {/* Daily list */}
          <div style={styles.list as any}>
            {grouped.length === 0 && !loading ? <div style={{ color: 'var(--muted)' }}>Κανένα έσοδο στη διάρκεια.</div> : null}

            {grouped.map(([day, items]) => {
              const total = items.reduce((a, b) => a + Math.abs(b.amount), 0)
              const cash = items.filter((i) => normalizeMethod(i.method) === 'Μετρητά').reduce((a, b) => a + Math.abs(b.amount), 0)
              const card = items.filter((i) => normalizeMethod(i.method) === 'Κάρτα').reduce((a, b) => a + Math.abs(b.amount), 0)
              const other = total - cash - card
              const isExpanded = !!expanded[day]

              return (
                <div key={day} style={styles.dayCard as any}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => toggleDay(day)}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{formatDateEl(new Date(day))}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{items.length} κινήσεις</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900 }}>{amountFmt.format(total)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                        Μετρητά {amountFmt.format(cash)} • Κάρτα {amountFmt.format(card)} {other ? `• Λοιπά ${amountFmt.format(other)}` : ''}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 10 }}>
                      {items.map((t) => (
                        <div key={t.id} style={styles.txRow as any}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', width: 64 }}>{(() => {
                              const d = parseTxDate(t)
                              return d ? formatTime(d) : '-'
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
                    <button type="button" onClick={() => toggleDay(day)} style={{ border: 'none', background: 'transparent', color: 'var(--muted)', fontWeight: 900 }}>
                      {expanded[day] ? (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ChevronUp size={14} /> Σύμπτυξη</span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><ChevronDown size={14} /> Επέκταση</span>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
