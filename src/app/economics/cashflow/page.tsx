'use client'

import { useEffect, useMemo, useState, type CSSProperties, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsTabs from '@/components/EconomicsTabs'
import { getSupabase } from '@/lib/supabase'

// If your project already uses xlsx (you used it in Settings), keep this import.
// If build complains "Cannot find module 'xlsx'", tell me and I’ll switch to CSV export.
import * as XLSX from 'xlsx'

type TxRow = {
  id: string
  created_at: string | null
  date: string
  amount: number
  type: string
  category: string | null
  method: string | null
  is_credit: boolean | null
  notes: string | null
}

type ThemeName = 'light' | 'dark'

const INCOME_TYPES = new Set(['income', 'income_collection', 'debt_received'])
const EXPENSE_TYPES = new Set(['expense', 'debt_payment'])

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function ymKey(dateStr: string) {
  // expects YYYY-MM-DD
  const [y, m] = (dateStr || '').split('-')
  if (!y || !m) return '---- --'
  return `${y}-${m}`
}

function prettyMonthLabel(ym: string) {
  // "2026-02" -> "Φεβ 2026"
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const dt = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat('el-GR', { month: 'short', year: 'numeric' }).format(dt)
}

function startOfMonthStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function endOfMonthStr(d: Date) {
  const y = d.getFullYear()
  const m = d.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  const mm = String(m + 1).padStart(2, '0')
  const dd = String(lastDay).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

export default function EconomicsCashflowPage() {
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')?.trim() || ''

  // Theme (light/dark)
  const [theme, setTheme] = useState<ThemeName>('light')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cosy_theme')
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved)
        return
      }
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      setTheme(prefersDark ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('cosy_theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const t = useMemo(() => {
    const isDark = theme === 'dark'
    return {
      isDark,
      bg: isDark ? 'var(--bg-grad)' : 'var(--bg-grad)',
      surface: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.92)',
      card: isDark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.92)',
      solidCard: 'var(--surfaceSolid)',
      border: 'var(--border)',
      text: 'var(--text)',
      muted: 'var(--muted)',
      muted2: 'var(--muted)',
      indigo: '#6366f1',
      green: '#10b981',
      red: '#f43f5e',
      amber: '#f59e0b',
      shadow: isDark ? '0 10px 22px rgba(0,0,0,0.35)' : '0 10px 22px rgba(15, 23, 42, 0.05)',
    }
  }, [theme])

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [rows, setRows] = useState<TxRow[]>([])

  const [futureProjection, setFutureProjection] = useState(false)

  // Filters for ledger
  const today = useMemo(() => new Date(), [])
  const defaultFrom = useMemo(() => startOfMonthStr(new Date()), [])
  const defaultTo = useMemo(() => endOfMonthStr(new Date()), [])

  const [filterFrom, setFilterFrom] = useState(defaultFrom)
  const [filterTo, setFilterTo] = useState(defaultTo)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMethod, setFilterMethod] = useState('')

  // Canonical transfer detection (safe greek substring + english)
  const isTransfer = useCallback((r: TxRow) => {
    const c = (r.category || '').toLowerCase()
    return c.includes('μεταφορ') || c.includes('transfer')
  }, [])

  // Load transactions (safe: store_id required)
  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      if (!storeId) {
        if (!isCancelled) {
          setRows([])
          setErrorMessage('Δεν βρέθηκε store στο URL.')
          setLoading(false)
        }
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const supabase = getSupabase()

        // Keep this simple and safe: read-only, filter by store_id
        const { data, error } = await supabase
          .from('transactions')
          .select('id, created_at, amount, type, category, method, date, is_credit, notes')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300)

        if (error) throw error

        const mapped: TxRow[] = (data ?? []).map((r: any) => ({
          id: String(r.id),
          created_at: r.created_at ? String(r.created_at) : null,
          amount: Number(r.amount) || 0,
          type: String(r.type || ''),
          category: r.category ? String(r.category) : null,
          method: r.method ? String(r.method) : null,
          date: String(r.date || ''),
          is_credit: r.is_credit === true,
          notes: r.notes ? String(r.notes) : null,
        }))

        if (!isCancelled) setRows(mapped)
      } catch (e) {
        console.error('Cashflow load failed:', e)
        if (!isCancelled) {
          setRows([])
          setErrorMessage('Αποτυχία φόρτωσης. Προσπάθησε ξανά.')
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [storeId])

  // Transfers + Organic split (canonical for SaaS)
  const internalTransfers = useMemo(() => rows.filter(isTransfer), [rows, isTransfer])

  const organicIncome = useMemo(
    () => rows.filter((r) => INCOME_TYPES.has(r.type) && !isTransfer(r)),
    [rows, isTransfer],
  )

  const organicExpense = useMemo(
    () => rows.filter((r) => EXPENSE_TYPES.has(r.type) && !isTransfer(r)),
    [rows, isTransfer],
  )

  const internalTransfersIn = useMemo(
    () => internalTransfers.filter((r) => r.amount > 0).reduce((a, r) => a + r.amount, 0),
    [internalTransfers],
  )

  const internalTransfersOut = useMemo(
    () => internalTransfers.filter((r) => r.amount < 0).reduce((a, r) => a + r.amount, 0),
    [internalTransfers],
  )

  const internalTransfersTotal = useMemo(() => internalTransfers.reduce((a, r) => a + r.amount, 0), [internalTransfers])

  const amountFormatter = useMemo(() => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }), [])
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    [],
  )

  const formatDate = (dateValue: string) => {
    const [year, month, day] = (dateValue || '').split('-').map(Number)
    if (!year || !month || !day) return '-'
    return dateFormatter.format(new Date(year, month - 1, day))
  }

  // KPI (canonical, consistent across stores)
  const KPI = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonthStr(now)
    const monthEnd = endOfMonthStr(now)

    let availableBalance = 0
    let expectedIncome = 0 // credit income
    let scheduledExpense = 0 // credit expense
    let monthIncome = 0
    let monthExpense = 0

    for (const r of rows) {
      const amt = Number(r.amount) || 0
      const abs = Math.abs(amt)
      const isInMonth = r.date >= monthStart && r.date <= monthEnd

      // Available balance (best-effort): incomes - expenses
      if (INCOME_TYPES.has(r.type)) {
        availableBalance += amt
        if (isInMonth) monthIncome += amt
      } else if (EXPENSE_TYPES.has(r.type)) {
        availableBalance -= abs
        if (isInMonth) monthExpense += abs
      }

      // Expected/scheduled via credit flag
      if (r.is_credit === true && INCOME_TYPES.has(r.type)) expectedIncome += abs
      if (r.is_credit === true && EXPENSE_TYPES.has(r.type)) scheduledExpense += abs
    }

    const netMonth = monthIncome - monthExpense

    return {
      availableBalance,
      expectedIncome,
      scheduledExpense,
      netMonth,
      monthIncome,
      monthExpense,
      monthStart,
      monthEnd,
    }
  }, [rows])

  // Chart data: last 6 months + optional future 3 months
  const chart = useMemo(() => {
    // determine last 6 months keys
    const base = new Date()
    base.setDate(1)
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const incomeBy: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))
    const expenseBy: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))

    for (const r of rows) {
      const key = ymKey(r.date)
      if (!(key in incomeBy)) continue

      const amt = Number(r.amount) || 0
      const abs = Math.abs(amt)

      if (INCOME_TYPES.has(r.type)) incomeBy[key] += amt
      if (EXPENSE_TYPES.has(r.type)) expenseBy[key] += abs
    }

    const points = months.map((m) => ({
      ym: m,
      income: incomeBy[m] || 0,
      expense: expenseBy[m] || 0,
      net: (incomeBy[m] || 0) - (expenseBy[m] || 0),
    }))

    // running balance line (starting from 0, best-effort)
    let running = 0
    const line = points.map((p) => {
      running += p.net
      return { ym: p.ym, balance: running }
    })

    // Future projection (3 months) based on average net of last 3 months
    let projected: Array<{ ym: string; income: number; expense: number; net: number; balance: number; projected: boolean }> = []
    if (futureProjection) {
      const last3 = points.slice(-3)
      const avgNet = last3.length ? last3.reduce((a, x) => a + x.net, 0) / last3.length : 0

      let lastBalance = line.length ? line[line.length - 1].balance : 0
      for (let i = 1; i <= 3; i++) {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        lastBalance += avgNet
        projected.push({
          ym,
          income: 0,
          expense: 0,
          net: avgNet,
          balance: lastBalance,
          projected: true,
        })
      }
    }

    const all = [
      ...points.map((p, idx) => ({
        ym: p.ym,
        income: p.income,
        expense: p.expense,
        net: p.net,
        balance: line[idx]?.balance ?? 0,
        projected: false,
      })),
      ...projected,
    ]

    const maxBar = Math.max(1, ...all.map((x) => Math.max(Math.abs(x.income), Math.abs(x.expense))))
    const minLine = Math.min(...all.map((x) => x.balance))
    const maxLine = Math.max(...all.map((x) => x.balance))
    const lineRange = Math.max(1, maxLine - minLine)

    return { data: all, maxBar, minLine, maxLine, lineRange }
  }, [rows, futureProjection])

  const uniqueCategories = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) if (r.category) s.add(r.category)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'el'))
  }, [rows])

  const uniqueMethods = useMemo(() => {
    const s = new Set<string>()
    for (const r of rows) if (r.method) s.add(r.method)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'el'))
  }, [rows])

  const filteredLedger = useMemo(() => {
    const from = filterFrom || '0000-01-01'
    const to = filterTo || '9999-12-31'
    const cat = filterCategory.trim()
    const met = filterMethod.trim()

    return rows.filter((r) => {
      if (r.date < from || r.date > to) return false

      // ✅ Canonical filter: income = INCOME_TYPES, expense = EXPENSE_TYPES
      if (filterType === 'income' && !INCOME_TYPES.has(r.type)) return false
      if (filterType === 'expense' && !EXPENSE_TYPES.has(r.type)) return false

      if (cat && String(r.category || '').toLowerCase() !== cat.toLowerCase()) return false
      if (met && String(r.method || '').toLowerCase() !== met.toLowerCase()) return false
      return true
    })
  }, [rows, filterFrom, filterTo, filterType, filterCategory, filterMethod])

  const statusOf = (r: TxRow) => {
    // Best-effort using existing fields:
    // - paid: not credit
    // - pending: credit
    // - overdue: credit + past date
    const isCredit = r.is_credit === true
    if (!isCredit) return { label: 'Εξοφλημένη', tone: 'ok' as const }

    const dOk = !!r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    if (dOk) {
      const [y, m, da] = r.date.split('-').map(Number)
      const dt = new Date(y, m - 1, da)
      if (dt.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
        return { label: 'Καθυστερημένη', tone: 'bad' as const }
      }
    }
    return { label: 'Εκκρεμής', tone: 'warn' as const }
  }

  const exportExcel = () => {
    const sheetRows = filteredLedger.map((r) => ({
      Ημερομηνία: r.date,
      Τύπος: r.type,
      Ποσό: r.amount,
      Κατηγορία: r.category || '',
      Μέθοδος: r.method || '',
      Πίστωση: r.is_credit === true ? 'ΝΑΙ' : 'ΟΧΙ',
      Σημειώσεις: r.notes || '',
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Cashflow')
    XLSX.writeFile(wb, `Cashflow_${storeId}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportPDF = () => {
    // safest no-lib pdf: print to PDF
    window.print()
  }

  const chartWidth = 920
  const chartHeight = 220
  const paddingX = 26
  const paddingY = 22
  const innerW = chartWidth - paddingX * 2
  const innerH = chartHeight - paddingY * 2
  const step = chart.data.length > 1 ? innerW / (chart.data.length - 1) : innerW

  const linePath = useMemo(() => {
    if (!chart.data.length) return ''
    return chart.data
      .map((p, idx) => {
        const x = paddingX + idx * step
        const y = paddingY + (1 - (p.balance - chart.minLine) / chart.lineRange) * innerH
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [chart.data, chart.minLine, chart.lineRange, innerH, paddingX, paddingY, step])

  // Bars: draw income/expense as two bars per point (best-effort).
  const barGroupW = useMemo(() => clamp(step * 0.62, 26, 74), [step])
  const barW = useMemo(() => barGroupW / 2 - 3, [barGroupW])

  const styles = useMemo(() => makeStyles(t), [t])

  return (
    <main style={styles.pageWrap}>
      <div style={styles.container}>
        <div style={styles.headerCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h1 style={styles.title}>Οικονομικό Κέντρο</h1>
              <p style={styles.subtitle}>Ταμειακή ροή</p>
            </div>

            <button
              type="button"
              onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
              style={styles.themeBtn}
              aria-label="toggle theme"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        <EconomicsTabs />

        {/* KPI Cards */}
        <section style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Διαθέσιμο Υπόλοιπο</div>
            <div style={styles.kpiValue}>{loading ? '—' : amountFormatter.format(KPI.availableBalance)}</div>
            <div style={styles.kpiHint}>Τρέχον ρευστό (best-effort από κινήσεις)</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Αναμενόμενα Έσοδα</div>
            <div style={styles.kpiValue}>{loading ? '—' : amountFormatter.format(KPI.expectedIncome)}</div>
            <div style={styles.kpiHint}>Έσοδα σε πίστωση (is_credit)</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Προγραμματισμένα Έξοδα</div>
            <div style={styles.kpiValue}>{loading ? '—' : amountFormatter.format(KPI.scheduledExpense)}</div>
            <div style={styles.kpiHint}>Έξοδα σε πίστωση (is_credit)</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Net Cash Flow (μήνα)</div>
            <div
              style={{
                ...styles.kpiValue,
                color: KPI.netMonth + internalTransfersTotal >= 0 ? t.green : t.red,
              }}
            >
              {loading ? '—' : amountFormatter.format(KPI.netMonth + internalTransfersTotal)}
            </div>
            <div style={styles.kpiHint}>
              {KPI.monthStart} → {KPI.monthEnd} (incl. transfers)
            </div>
          </div>

          {/* Νέα κάρτα: Εσωτερικές Μεταφορές */}
          <div
            style={{
              ...styles.kpiCard,
              border: `2px dashed ${t.indigo}`,
              background: t.isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)',
            }}
          >
            <div style={{ ...styles.kpiLabel, color: t.indigo }}>Εσωτερικές Μεταφορές</div>
            <div style={{ ...styles.kpiValue, color: t.indigo }}>{loading ? '—' : amountFormatter.format(internalTransfersTotal)}</div>
            <div style={styles.kpiHint}>
              Εισροές: <span style={{ color: t.green }}>{amountFormatter.format(internalTransfersIn)}</span> • Εκροές:{' '}
              <span style={{ color: t.red }}>{amountFormatter.format(Math.abs(internalTransfersOut))}</span>
            </div>
          </div>

          {/* Οργανικά Έσοδα/Έξοδα */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Οργανικά Έσοδα</div>
            <div style={{ ...styles.kpiValue, color: t.green }}>
              {loading ? '—' : amountFormatter.format(organicIncome.reduce((a, r) => a + r.amount, 0))}
            </div>
            <div style={styles.kpiHint}>Χωρίς Μεταφορές Κεφαλαίου</div>
          </div>

          <div style={styles.kpiCard}>
            <div style={styles.kpiLabel}>Οργανικά Έξοδα</div>
            <div style={{ ...styles.kpiValue, color: t.red }}>
              {loading ? '—' : amountFormatter.format(organicExpense.reduce((a, r) => a + Math.abs(r.amount), 0))}
            </div>
            <div style={styles.kpiHint}>Χωρίς Μεταφορές Κεφαλαίου</div>
          </div>
        </section>

        {/* Chart */}
        <section style={styles.card}>
          <div style={styles.cardHeadRow}>
            <div>
              <h2 style={styles.cardTitle}>Οπτικοποίηση</h2>
              <p style={styles.cardSub}>Μηνιαία έσοδα/έξοδα + εξέλιξη υπολοίπου</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setFutureProjection((p) => !p)} style={styles.secondaryBtn}>
                {futureProjection ? '✅ Future Projection ON' : 'Future Projection'}
              </button>
            </div>
          </div>

          <div style={styles.chartWrap}>
            <div style={styles.chartLegend}>
              <span style={{ ...styles.legendPill, borderColor: t.green }}>
                <span style={{ ...styles.legendDot, background: t.green }} /> Έσοδα
              </span>
              <span style={{ ...styles.legendPill, borderColor: t.red }}>
                <span style={{ ...styles.legendDot, background: t.red }} /> Έξοδα
              </span>
              <span style={{ ...styles.legendPill, borderColor: t.indigo }}>
                <span style={{ ...styles.legendDot, background: t.indigo }} /> Υπόλοιπο (γραμμή)
              </span>
              {futureProjection && (
                <span style={{ ...styles.legendPill, borderColor: t.border }}>
                  <span style={{ ...styles.legendDot, background: t.border }} /> Πρόβλεψη
                </span>
              )}
            </div>

            <div style={styles.chartScroller}>
              <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
                {/* baseline */}
                <line
                  x1={paddingX}
                  y1={paddingY + innerH}
                  x2={paddingX + innerW}
                  y2={paddingY + innerH}
                  stroke={t.border}
                  strokeWidth="1"
                />

                {/* bars */}
                {chart.data.map((p, idx) => {
                  const xCenter = paddingX + idx * step
                  const incomeH = (Math.abs(p.income) / chart.maxBar) * innerH
                  const expenseH = (Math.abs(p.expense) / chart.maxBar) * innerH

                  const incomeX = xCenter - barGroupW / 2
                  const expenseX = xCenter - barGroupW / 2 + barW + 6

                  const yIncome = paddingY + innerH - incomeH
                  const yExpense = paddingY + innerH - expenseH

                  const isProj = p.projected

                  return (
                    <g key={p.ym}>
                      <rect x={incomeX} y={yIncome} width={barW} height={incomeH} rx="6" fill={t.green} opacity={isProj ? 0.25 : 0.85} />
                      <rect x={expenseX} y={yExpense} width={barW} height={expenseH} rx="6" fill={t.red} opacity={isProj ? 0.25 : 0.85} />
                    </g>
                  )
                })}

                {/* line */}
                <path d={linePath} fill="none" stroke={t.indigo} strokeWidth="2.5" />

                {/* points + labels */}
                {chart.data.map((p, idx) => {
                  const x = paddingX + idx * step
                  const y = paddingY + (1 - (p.balance - chart.minLine) / chart.lineRange) * innerH
                  const isProj = p.projected
                  return (
                    <g key={`${p.ym}-pt`}>
                      <circle cx={x} cy={y} r={isProj ? 3 : 3.5} fill={t.indigo} opacity={isProj ? 0.35 : 0.95} />
                      <text x={x} y={chartHeight - 6} textAnchor="middle" fontSize="11" fontWeight="800" fill={t.muted}>
                        {prettyMonthLabel(p.ym)}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </div>

          {futureProjection && (
            <div style={styles.projectionHint}>
              Η πρόβλεψη είναι best-effort (χωρίς recurring tables). Υπολογίζεται από τον μέσο μηνιαίο net των τελευταίων 3 μηνών.
            </div>
          )}
        </section>

        {/* Ledger */}
        <section style={styles.card}>
          <div style={styles.cardHeadRow}>
            <div>
              <h2 style={styles.cardTitle}>Πίνακας Συναλλαγών</h2>
              <p style={styles.cardSub}>Φίλτρα, status, export</p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={exportPDF} style={styles.secondaryBtn}>
                Export PDF
              </button>
              <button type="button" onClick={exportExcel} style={styles.primaryBtn}>
                Export Excel
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={styles.filtersWrap}>
            <div style={styles.filterField}>
              <div style={styles.filterLabel}>Από</div>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={styles.input} />
            </div>

            <div style={styles.filterField}>
              <div style={styles.filterLabel}>Έως</div>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} style={styles.input} />
            </div>

            <div style={styles.filterField}>
              <div style={styles.filterLabel}>Τύπος</div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} style={styles.input}>
                <option value="all">Όλα</option>
                <option value="income">Έσοδα</option>
                <option value="expense">Έξοδα</option>
              </select>
            </div>

            <div style={styles.filterField}>
              <div style={styles.filterLabel}>Κατηγορία</div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={styles.input}>
                <option value="">Όλες</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.filterField}>
              <div style={styles.filterLabel}>Μέθοδος</div>
              <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} style={styles.input}>
                <option value="">Όλες</option>
                {uniqueMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && <p style={styles.mutedText}>Φόρτωση κινήσεων...</p>}
          {!loading && errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
          {!loading && !errorMessage && filteredLedger.length === 0 && <p style={styles.mutedText}>Δεν υπάρχουν κινήσεις με αυτά τα φίλτρα.</p>}

          {!loading && !errorMessage && filteredLedger.length > 0 && (
            <div style={styles.tableWrap}>
              <div style={styles.table}>
                <div style={styles.thead}>
                  <div style={styles.th}>Ημ/νία</div>
                  <div style={styles.th}>Τύπος</div>
                  <div style={styles.th}>Κατηγορία</div>
                  <div style={styles.th}>Μέθοδος</div>
                  <div style={styles.thRight}>Ποσό</div>
                  <div style={styles.th}>Status</div>
                </div>

                {filteredLedger.map((r) => {
                  const st = statusOf(r)
                  const transferRow = isTransfer(r)

                  const isIncome = INCOME_TYPES.has(r.type)
                  const isExpense = EXPENSE_TYPES.has(r.type)

                  const amt = Number(r.amount) || 0
                  const abs = Math.abs(amt)

                  const sign = transferRow ? (amt >= 0 ? '+' : '-') : isIncome ? '+' : isExpense ? '-' : amt >= 0 ? '+' : '-'

                  return (
                    <div
                      key={r.id}
                      style={{
                        ...styles.tr,
                        ...(transferRow
                          ? {
                              borderLeft: `6px solid ${t.indigo}`,
                              background: t.isDark ? 'rgba(99,102,241,0.13)' : 'rgba(99,102,241,0.08)',
                            }
                          : {}),
                      }}
                    >
                      <div style={styles.td}>{formatDate(r.date)}</div>

                      <div style={styles.td}>
                        {transferRow ? (
                          <span
                            style={{
                              ...styles.typePill,
                              borderColor: t.indigo,
                              color: t.indigo,
                              background: t.isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
                            }}
                          >
                            🔄 Transfer
                          </span>
                        ) : (
                          <span style={{ ...styles.typePill, borderColor: isIncome ? t.green : t.red, color: isIncome ? t.green : t.red }}>
                            {isIncome ? 'Income' : 'Expense'}
                          </span>
                        )}
                      </div>

                      <div style={styles.td}>{r.category || '—'}</div>
                      <div style={styles.td}>{r.method || '—'}</div>

                      <div style={styles.tdRight}>
                        <span style={{ fontWeight: 900, color: transferRow ? t.indigo : isIncome ? t.green : t.red }}>
                          {sign}
                          {amountFormatter.format(abs)}
                        </span>
                      </div>

                      <div style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...(st.tone === 'ok' ? styles.statusOk : null),
                            ...(st.tone === 'warn' ? styles.statusWarn : null),
                            ...(st.tone === 'bad' ? styles.statusBad : null),
                          }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <div style={{ height: 24 }} />
      </div>
    </main>
  )
}

function makeStyles(t: {
  isDark: boolean
  bg: string
  surface: string
  card: string
  solidCard: string
  border: string
  text: string
  muted: string
  muted2: string
  indigo: string
  green: string
  red: string
  amber: string
  shadow: string
}) {
  const pageWrap: CSSProperties = {
    minHeight: '100dvh',
    background: t.bg,
    padding: 18,
    color: t.text,
  }

  const container: CSSProperties = { maxWidth: 920, margin: '0 auto', paddingBottom: 120 }

  const headerCard: CSSProperties = {
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: t.surface,
    boxShadow: t.shadow,
    padding: 16,
    marginBottom: 12,
    backdropFilter: 'blur(10px)',
  }

  const title: CSSProperties = { margin: 0, color: t.text, fontSize: 24, fontWeight: 900 }
  const subtitle: CSSProperties = { margin: '6px 0 0 0', color: t.muted, fontSize: 13, fontWeight: 800 }

  const themeBtn: CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.solidCard,
    color: t.text,
    fontWeight: 900,
    fontSize: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    boxShadow: t.isDark ? 'none' : '0 8px 14px rgba(15,23,42,0.08)',
    whiteSpace: 'nowrap',
  }

  const card: CSSProperties = {
    marginTop: 12,
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: t.card,
    boxShadow: t.shadow,
    padding: 18,
    backdropFilter: 'blur(10px)',
  }

  const cardHeadRow: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  }

  const cardTitle: CSSProperties = { margin: 0, color: t.text, fontSize: 18, fontWeight: 900 }
  const cardSub: CSSProperties = { margin: '6px 0 0 0', color: t.muted, fontSize: 12, fontWeight: 800 }

  const primaryBtn: CSSProperties = {
    borderRadius: 14,
    border: `1px solid ${t.indigo}`,
    background: t.indigo,
    color: 'var(--surfaceSolid)',
    fontWeight: 900,
    fontSize: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)',
  }

  const secondaryBtn: CSSProperties = {
    borderRadius: 14,
    border: `1px solid ${t.border}`,
    background: t.solidCard,
    color: t.text,
    fontWeight: 900,
    fontSize: 12,
    padding: '10px 12px',
    cursor: 'pointer',
  }

  const kpiGrid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 10,
    marginTop: 12,
  }

  const kpiCard: CSSProperties = {
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: t.card,
    boxShadow: t.shadow,
    padding: 16,
    backdropFilter: 'blur(10px)',
    minHeight: 108,
  }

  const kpiLabel: CSSProperties = { fontSize: 11, fontWeight: 900, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase' }
  const kpiValue: CSSProperties = { marginTop: 10, fontSize: 22, fontWeight: 900, color: t.text, lineHeight: 1.15 }
  const kpiHint: CSSProperties = { marginTop: 8, fontSize: 11, fontWeight: 800, color: t.muted2 }

  const chartWrap: CSSProperties = { marginTop: 12 }
  const chartLegend: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }
  const legendPill: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 900,
    color: t.muted,
    background: t.solidCard,
  }
  const legendDot: CSSProperties = { width: 10, height: 10, borderRadius: 999 }
  const chartScroller: CSSProperties = {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    borderRadius: 18,
    border: `1px solid ${t.border}`,
    background: t.solidCard,
  }

  const projectionHint: CSSProperties = { marginTop: 12, color: t.muted, fontSize: 12, fontWeight: 800 }

  const filtersWrap: CSSProperties = {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 10,
  }

  const filterField: CSSProperties = { minWidth: 0 }
  const filterLabel: CSSProperties = { fontSize: 10, fontWeight: 900, color: t.muted, letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' }

  const input: CSSProperties = {
    width: '100%',
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    background: t.solidCard,
    color: t.text,
    padding: '10px 10px',
    fontWeight: 900,
    fontSize: 12,
    outline: 'none',
  }

  const mutedText: CSSProperties = { margin: '12px 0 0 0', color: t.muted, fontSize: 13, fontWeight: 800 }
  const errorText: CSSProperties = { margin: '12px 0 0 0', color: '#b91c1c', fontSize: 13, fontWeight: 900 }

  const tableWrap: CSSProperties = {
    marginTop: 14,
    borderRadius: 18,
    border: `1px solid ${t.border}`,
    overflow: 'hidden',
    background: t.solidCard,
  }

  const table: CSSProperties = { display: 'grid' }

  const thead: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 120px 1fr 1fr 160px 140px',
    gap: 0,
    padding: '10px 12px',
    background: 'var(--bg)',
    borderBottom: `1px solid ${t.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 5,
  }

  const th: CSSProperties = { fontSize: 11, fontWeight: 900, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6 }
  const thRight: CSSProperties = { ...th, textAlign: 'right' }

  const tr: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '120px 120px 1fr 1fr 160px 140px',
    gap: 0,
    padding: '12px 12px',
    borderBottom: `1px solid ${t.border}`,
    alignItems: 'center',
  }

  const td: CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    color: t.text,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }
  const tdRight: CSSProperties = { ...td, textAlign: 'right' }

  const typePill: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    border: `1px solid var(--border)`,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 900,
    background: 'var(--surfaceSolid)',
  }

  const statusPill: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    border: `1px solid var(--border)`,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 900,
    background: 'var(--surfaceSolid)',
  }
  const statusOk: CSSProperties = { borderColor: 'rgba(16,185,129,0.45)', color: t.green }
  const statusWarn: CSSProperties = { borderColor: 'rgba(245,158,11,0.55)', color: t.amber }
  const statusBad: CSSProperties = { borderColor: 'rgba(244,63,94,0.55)', color: t.red }

  // Responsive tweaks (inline-style only approach)
  if (typeof window !== 'undefined') {
    const w = window.innerWidth
    if (w < 880) {
      ;(kpiGrid as any).gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
      ;(filtersWrap as any).gridTemplateColumns = 'repeat(2, minmax(0, 1fr))'
      ;(thead as any).gridTemplateColumns = '110px 90px 1fr 120px'
      ;(tr as any).gridTemplateColumns = '110px 90px 1fr 120px'
    }
  }

  return {
    pageWrap,
    container,
    headerCard,
    title,
    subtitle,
    themeBtn,
    card,
    cardHeadRow,
    cardTitle,
    cardSub,
    primaryBtn,
    secondaryBtn,
    kpiGrid,
    kpiCard,
    kpiLabel,
    kpiValue,
    kpiHint,
    chartWrap,
    chartLegend,
    legendPill,
    legendDot,
    chartScroller,
    projectionHint,
    filtersWrap,
    filterField,
    filterLabel,
    input,
    mutedText,
    errorText,
    tableWrap,
    table,
    thead,
    th,
    thRight,
    tr,
    td,
    tdRight,
    typePill,
    statusPill,
    statusOk,
    statusWarn,
    statusBad,
  }
}