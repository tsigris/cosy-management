'use client'

import { useEffect, useMemo, useState, type CSSProperties, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import { getSupabase } from '@/lib/supabase'
import KpiCard from '@/components/KpiCard'

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
const EXPENSE_TYPES = new Set(['expense', 'debt_payment', 'salary_advance'])

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

        if (!isCancelled) {
          setRows(mapped)
          console.log('Transaction types detected:', [...new Set(mapped.map((r) => r.type))])
        }
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

  // GLOBAL period filter
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  useEffect(() => {
    // when period changes, update filterFrom/filterTo to match
    if (period === 'month') {
      setFilterFrom(startOfMonthStr(new Date()))
      setFilterTo(endOfMonthStr(new Date()))
    } else if (period === 'year') {
      setFilterFrom(`${selectedYear}-01-01`)
      setFilterTo(`${selectedYear}-12-31`)
    } else if (period === '30days') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      setFilterFrom(`${y}-${m}-${day}`)
      setFilterTo(endOfMonthStr(new Date()))
    } else if (period === 'all') {
      setFilterFrom('0000-01-01')
      setFilterTo('9999-12-31')
    }
  }, [period, selectedYear])

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

  // Chart data: derive monthly income/expense & running balance from the
  // same filters the ledger uses (filterFrom/filterTo/filterType/category/method).
  const chart = useMemo(() => {
    // Build the same filtered source as filteredLedger (but scoped here so
    // chart can be computed before filteredLedger is declared elsewhere).
    const from = filterFrom || '0000-01-01'
    const to = filterTo || '9999-12-31'
    const cat = filterCategory.trim()
    const met = filterMethod.trim()

    const source = rows.filter((r) => {
      if (r.date < from || r.date > to) return false
      if (filterType === 'income' && !INCOME_TYPES.has(r.type)) return false
      if (filterType === 'expense' && !EXPENSE_TYPES.has(r.type)) return false
      if (cat && String(r.category || '').toLowerCase() !== cat.toLowerCase()) return false
      if (met && String(r.method || '').toLowerCase() !== met.toLowerCase()) return false
      return true
    })

    // If empty, fallback to last 6 months window
    let startMonth: Date
    let endMonth: Date
    if (source.length) {
      const dates = source
        .map((r) => (r.date ? new Date(r.date) : r.created_at ? new Date(r.created_at) : null))
        .filter((d) => d && !isNaN(d.getTime())) as Date[]
      const minD = dates.reduce((a, b) => (a.getTime() < b.getTime() ? a : b), dates[0])
      const maxD = dates.reduce((a, b) => (a.getTime() > b.getTime() ? a : b), dates[0])
      startMonth = new Date(minD.getFullYear(), minD.getMonth(), 1)
      endMonth = new Date(maxD.getFullYear(), maxD.getMonth(), 1)
    } else {
      const base = new Date()
      base.setDate(1)
      endMonth = new Date(base.getFullYear(), base.getMonth(), 1)
      startMonth = new Date(base.getFullYear(), base.getMonth() - 5, 1)
    }

    // build month keys inclusive
    const months: string[] = []
    const maxMonths = 24
    let cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1)
    while (cursor.getTime() <= endMonth.getTime() && months.length < maxMonths) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }

    const incomeBy: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))
    const expenseBy: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]))

    for (const r of source) {
      if (isTransfer(r)) continue // exclude internal transfers from chart
      const key = ymKey(r.date)
      if (!(key in incomeBy)) continue

      const amt = Number(r.amount) || 0
      const abs = Math.abs(amt)

      if (INCOME_TYPES.has(r.type)) incomeBy[key] += amt
      if (EXPENSE_TYPES.has(r.type)) expenseBy[key] += abs
    }

    const points = months.map((m) => {
      const income = incomeBy[m] || 0
      const expense = expenseBy[m] || 0
      const profit = income - expense

      return {
        ym: m,
        income,
        expense,
        profit,
        net: profit,
      }
    })

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
        const d = new Date(endMonth.getFullYear(), endMonth.getMonth() + i, 1)
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

    const maxBar = Math.max(
      1,
      ...all.map((x) => Math.max(Math.abs(x.income), Math.abs(x.expense)))
    ) * 1.25
    const minLine = Math.min(...all.map((x) => x.balance))
    const maxLine = Math.max(...all.map((x) => x.balance))
    const lineRange = Math.max(1, maxLine - minLine)

    return { data: all, maxBar, minLine, maxLine, lineRange }
  }, [rows, filterFrom, filterTo, filterType, filterCategory, filterMethod, futureProjection, isTransfer])

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

  const yearOptions = useMemo(() => {
    const s = new Set<number>()
    for (const r of rows) {
      const d = r.date ? new Date(r.date) : r.created_at ? new Date(r.created_at) : null
      if (d && !isNaN(d.getTime())) s.add(d.getFullYear())
    }
    if (!s.size) s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
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

  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const onResize = () => {
      try {
        setIsMobile(window.innerWidth < 768)
      } catch {}
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const chartMetrics = useMemo(() => {
    const viewport = typeof window !== 'undefined' ? window.innerWidth : 390
    const mobileWidth = Math.max(280, viewport - 88)
    const desktopWidth = 920

    const cw = isMobile ? mobileWidth : desktopWidth
    const ch = isMobile ? 220 : 260
    const px = isMobile ? 16 : 26
    const py = isMobile ? 18 : 22

    const innerW = cw - px * 2
    const innerH = ch - py * 2

    const step = chart.data.length > 1 ? innerW / chart.data.length : innerW
    const barGroupW = isMobile
      ? clamp(step * 0.58, 26, 54)
      : clamp(step * 0.62, 28, 74)

    const barW = isMobile
      ? Math.max(10, barGroupW / 2 - 4)
      : Math.max(8, barGroupW / 2 - 4)

    return { cw, ch, px, py, innerW, innerH, step, barGroupW, barW }
  }, [chart.data.length, isMobile])

  const { cw: chartWidth, ch: chartHeight, px: paddingX, py: paddingY, innerW, innerH, step, barGroupW, barW } = chartMetrics

  const linePath = useMemo(() => {
    if (!chart.data.length) return ''
    return chart.data
      .map((p, idx) => {
        const x = chart.data.length > 1
          ? paddingX + step * idx + step / 2
          : paddingX + innerW / 2
        const y = paddingY + (1 - (p.balance - chart.minLine) / chart.lineRange) * innerH
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [chart.data, chart.minLine, chart.lineRange, innerH, paddingX, paddingY, step])

  const profitPath = useMemo(() => {
    if (!chart.data.length) return ''
    return chart.data
      .map((p, idx) => {
        const x = chart.data.length > 1
          ? paddingX + step * idx + step / 2
          : paddingX + innerW / 2
        const y = paddingY + (1 - (p.net - chart.minLine) / chart.lineRange) * innerH
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [chart.data, chart.minLine, chart.lineRange, innerH, paddingX, paddingY, step])

  const totalRevenue = chart.data.reduce((a, x) => a + (x.income || 0), 0)
  const totalExpenses = chart.data.reduce((a, x) => a + (x.expense || 0), 0)
  const totalProfit = totalRevenue - totalExpenses

  const styles = useMemo(() => makeStyles(t), [t])

  return (
    <main style={styles.pageWrap}>
      <div style={styles.container}>
        <EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Ταμειακή ροή" theme={theme} setTheme={setTheme} />

        <EconomicsPeriodFilter period={period} onPeriodChange={(p) => setPeriod(p)} selectedYear={selectedYear} onYearChange={(y) => setSelectedYear(y)} yearOptions={yearOptions} />

        {/* KPI Cards */}
        <section style={styles.kpiGrid}>
          <KpiCard label="Διαθέσιμο Υπόλοιπο" value={KPI.availableBalance} loading={loading} hint="Τρέχον ρευστό (best-effort από κινήσεις)" style={styles.kpiCard} />

          <KpiCard label="Αναμενόμενα Έσοδα" value={KPI.expectedIncome} loading={loading} hint="Έσοδα σε πίστωση (is_credit)" style={styles.kpiCard} />

          <KpiCard label="Προγραμματισμένα Έξοδα" value={KPI.scheduledExpense} loading={loading} hint="Έξοδα σε πίστωση (is_credit)" style={styles.kpiCard} />

          <KpiCard label="Καθαρή Ταμειακή Ροή (Μήνα)" value={KPI.netMonth + internalTransfersTotal} loading={loading} hint={`${KPI.monthStart} → ${KPI.monthEnd} (incl. transfers)`} color={KPI.netMonth + internalTransfersTotal >= 0 ? t.green : t.red} style={styles.kpiCard} />

          <KpiCard label="Εσωτερικές Μεταφορές" value={internalTransfersTotal} loading={loading} hint={`Εισροές: ${amountFormatter.format(internalTransfersIn)} • Εκροές: ${amountFormatter.format(Math.abs(internalTransfersOut))}`} color={t.indigo} dashed style={{ ...styles.kpiCard, background: t.isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.07)' }} />

          <KpiCard label="Οργανικά Έσοδα" value={organicIncome.reduce((a, r) => a + r.amount, 0)} loading={loading} hint="Χωρίς Μεταφορές Κεφαλαίου" color={t.green} style={styles.kpiCard} />

          <KpiCard label="Οργανικά Έξοδα" value={organicExpense.reduce((a, r) => a + Math.abs(r.amount), 0)} loading={loading} hint="Χωρίς Μεταφορές Κεφαλαίου" color={t.red} style={styles.kpiCard} />
        </section>

        {/* Chart */}

        {/* Mini KPI row for chart period: responsive layout for mobile */}
        <div
          style={
            isMobile
              ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 12 }
              : { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }
          }
        >
          <KpiCard
            label="Συνολικά Έσοδα"
            value={totalRevenue}
            loading={loading}
            hint="Συνολικά Έσοδα"
            color={t.green}
            style={{ ...styles.kpiCard, padding: isMobile ? 18 : 12, minHeight: isMobile ? 96 : 72 }}
          />

          <KpiCard
            label="Συνολικά Έξοδα"
            value={totalExpenses}
            loading={loading}
            hint="Συνολικά Έξοδα"
            color={t.red}
            style={{ ...styles.kpiCard, padding: isMobile ? 18 : 12, minHeight: isMobile ? 96 : 72 }}
          />

          <KpiCard
            label="Κέρδος Περιόδου"
            value={totalProfit}
            loading={loading}
            hint="Συνολικό κέρδος"
            style={{
              ...styles.kpiCard,
              padding: isMobile ? 20 : 12,
              minHeight: isMobile ? 112 : 72,
              gridColumn: isMobile ? '1 / -1' : undefined,
            }}
          />
        </div>

        <section style={styles.premiumCard}>
          <div style={styles.cardHeadRowPremium}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <h2 style={styles.premiumTitle}>Οπτικοποίηση</h2>
              <p style={styles.premiumSub}>Μηνιαία έσοδα/έξοδα και εξέλιξη υπολοίπου</p>
            </div>

            <div
              style={{
                width: isMobile ? '100%' : 'auto',
                display: 'flex',
                justifyContent: isMobile ? 'flex-start' : 'flex-end',
              }}
            >
              <div style={styles.segmentedToggle} role="tablist" aria-label="Projection toggle">
                <button
                  type="button"
                  onClick={() => setFutureProjection(false)}
                  aria-pressed={!futureProjection}
                  style={futureProjection ? styles.segmentBtn : styles.segmentBtnActive}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setFutureProjection(true)}
                  aria-pressed={futureProjection}
                  style={futureProjection ? styles.segmentBtnActive : styles.segmentBtn}
                >
                  Πρόβλεψη
                </button>
              </div>
            </div>
          </div>

          <div style={styles.chartWrapPremium}>
            <div style={styles.premiumLegendRow}>
              <div style={styles.legendChips}>
                <div style={{ ...styles.legendChip }}>
                  <span style={{ ...styles.legendDotSmall, background: '#059669' }} /> Έσοδα
                </div>
                <div style={{ ...styles.legendChip }}>
                  <span style={{ ...styles.legendDotSmall, background: '#ef476f' }} /> Έξοδα
                </div>
                <div style={{ ...styles.legendChip }}>
                  <span style={{ ...styles.legendDotSmall, background: '#6d28d9' }} /> Υπόλοιπο
                </div>
                <div style={{ ...styles.legendChip }}>
                  <span style={{ ...styles.legendDotSmall, background: '#10b981' }} /> Profit
                </div>
              </div>

              {/* mini insights */}
              <div style={styles.insightsRow}>
                {(() => {
                  const last = chart.data.length ? chart.data[chart.data.length - 1] : null
                  const prev = chart.data.length > 1 ? chart.data[chart.data.length - 2] : null
                  const highestExpense = chart.data.reduce((acc, p) => (p.expense > (acc?.expense ?? 0) ? p : acc), null as any)
                  const trend = last && prev ? last.net - prev.net : 0
                  return (
                    <>
                      <div style={styles.insightCard}>
                        <div style={styles.insightLabel}>Μέγιστο Έξοδο</div>
                        <div style={styles.insightValue}>{highestExpense ? prettyMonthLabel(highestExpense.ym) : '—'}</div>
                        <div style={styles.insightSmall}>{highestExpense ? amountFormatter.format(highestExpense.expense) : '—'}</div>
                      </div>

                      <div style={styles.insightCard}>
                        <div style={styles.insightLabel}>Τρέχον Net</div>
                        <div style={styles.insightValue}>{last ? amountFormatter.format(last.net) : '—'}</div>
                        <div style={styles.insightSmall}>{last ? `${last.income > last.expense ? 'Έσοδα > Έξοδα' : 'Έξοδα ≥ Έσοδα'}` : '—'}</div>
                      </div>

                      <div style={styles.insightCard}>
                        <div style={styles.insightLabel}>Τάση</div>
                        <div style={styles.insightValue}>
                          {trend > 0 ? '▲ Άνοδος' : trend < 0 ? '▼ Πτώση' : '—'}
                        </div>
                        <div style={styles.insightSmall}>{trend ? amountFormatter.format(Math.abs(trend)) : ''}</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            <div style={styles.chartScrollerPremium}>
              <svg width={chartWidth} height={chartHeight} style={{ display: 'block' }}>
                {/* subtle grid lines */}
                {[0.25, 0.5, 0.75].map((tFrac, i) => (
                  <line
                    key={`g${i}`}
                    x1={paddingX}
                    x2={paddingX + innerW}
                    y1={paddingY + innerH * (1 - tFrac)}
                    y2={paddingY + innerH * (1 - tFrac)}
                    stroke="rgba(15,23,42,0.04)"
                    strokeWidth={1}
                  />
                ))}

                {/* bars (thinner, softer corners) */}
                {chart.data.map((p, idx) => {
                  const xCenter = chart.data.length > 1
                    ? paddingX + step * idx + step / 2
                    : paddingX + innerW / 2
                  const incomeH = (Math.abs(p.income) / chart.maxBar) * innerH
                  const expenseH = (Math.abs(p.expense) / chart.maxBar) * innerH

                  const incomeX = xCenter - barGroupW / 2
                  const expenseX = xCenter - barGroupW / 2 + barW + 6

                  const yIncome = paddingY + innerH - incomeH
                  const yExpense = paddingY + innerH - expenseH

                  const isProj = p.projected

                  return (
                    <g key={p.ym}>
                      <rect x={incomeX} y={yIncome} width={Math.max(6, barW * 0.9)} height={incomeH} rx={6} fill="#059669" opacity={isProj ? 0.22 : 0.9} />
                      <rect x={expenseX} y={yExpense} width={Math.max(6, barW * 0.9)} height={expenseH} rx={6} fill="#ef476f" opacity={isProj ? 0.22 : 0.9} />
                    </g>
                  )
                })}

                {/* balance line (smoother) */}
                <path d={linePath} fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />

                {/* profit line (dashed green) */}
                <path d={profitPath} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6 4" opacity={0.9} />

                {/* points + labels (muted small) */}
                {chart.data.map((p, idx) => {
                  const x = paddingX + idx * step
                  const y = paddingY + (1 - (p.balance - chart.minLine) / chart.lineRange) * innerH
                  const isProj = p.projected
                  return (
                    <g key={`${p.ym}-pt`}>
                      <circle cx={x} cy={y} r={isProj ? 2.5 : 3} fill="#6d28d9" opacity={isProj ? 0.28 : 0.95} />
                            <text x={x} y={chartHeight - 10} textAnchor="middle" fontSize={isMobile ? 10 : 11} fontWeight={700} fill="rgba(15,23,42,0.55)">
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
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    marginTop: 16,
  }

  const kpiCard: CSSProperties = {
    borderRadius: 20,
    border: `1px solid ${t.border}`,
    background: t.surface,
    boxShadow: t.shadow,
    padding: 16,
    backdropFilter: 'blur(10px)',
    minWidth: 0,
  }

  const kpiLabel: CSSProperties = { fontSize: 12, fontWeight: 900, color: t.muted, letterSpacing: 0.4, textTransform: 'uppercase' }
  const kpiValue: CSSProperties = {
    marginTop: 8,
    fontSize: 20,
    fontWeight: 1000,
    color: t.text,
    lineHeight: 1,
    overflow: 'hidden',
    whiteSpace: 'normal',
    maxWidth: '100%',
    wordBreak: 'break-word',
  }
  const kpiHint: CSSProperties = { marginTop: 6, fontSize: 12, fontWeight: 800, color: t.muted2 }

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

  // Premium variants
  const premiumCard: CSSProperties = {
    marginTop: 16,
    borderRadius: 28,
    border: `1px solid rgba(15,23,42,0.06)`,
    background: t.isDark ? 'linear-gradient(180deg, rgba(20,20,30,0.6), rgba(10,10,20,0.4))' : 'rgba(255,255,255,0.7)',
    boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
    padding: 22,
    backdropFilter: 'blur(8px)',
  }

  const cardHeadRowPremium: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  }

  const premiumTitle: CSSProperties = { margin: 0, color: t.text, fontSize: 20, fontWeight: 950 }
  const premiumSub: CSSProperties = { margin: '6px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: 12, fontWeight: 800 }

  const segmentedToggle: CSSProperties = {
    display: 'inline-flex',
    borderRadius: 999,
    background: t.solidCard,
    border: `1px solid ${t.border}`,
    padding: 4,
    width: '100%',
    maxWidth: 320,
  }
  const segmentBtn: CSSProperties = {
    border: 'none',
    background: 'transparent',
    padding: '6px 10px',
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: 900,
    color: t.muted,
  }
  const segmentBtnActive: CSSProperties = {
    ...segmentBtn,
    background: t.indigo,
    color: t.isDark ? 'white' : 'white',
    boxShadow: '0 4px 10px rgba(99,102,241,0.12)',
  }

  const chartWrapPremium: CSSProperties = { marginTop: 12 }
  const premiumLegendRow: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 12,
  }
  const legendChips: CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  }
  const legendChip: CSSProperties = { display: 'inline-flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: t.solidCard, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 900, color: 'rgba(0,0,0,0.6)' }
  const legendDotSmall: CSSProperties = { width: 10, height: 10, borderRadius: 999, display: 'inline-block' }

  const insightsRow: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 10,
    alignItems: 'stretch',
  }
  const insightCard: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 12px',
    borderRadius: 14,
    background: t.solidCard,
    border: `1px solid ${t.border}`,
    minWidth: 0,
    width: '100%',
  }
  const insightLabel: CSSProperties = { fontSize: 11, color: t.muted, fontWeight: 900 }
  const insightValue: CSSProperties = { fontSize: 14, fontWeight: 900, color: t.text }
  const insightSmall: CSSProperties = { fontSize: 12, color: t.muted, fontWeight: 800 }

  const chartScrollerPremium: CSSProperties = {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    borderRadius: 20,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    padding: 10,
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
    if (w < 768) {
      ;(premiumCard as any).padding = 18
      ;(premiumLegendRow as any).flexDirection = 'column'
      ;(premiumLegendRow as any).alignItems = 'stretch'
      ;(legendChips as any).flexWrap = 'wrap'
      ;(legendChip as any).fontSize = '11px'
      ;(legendChip as any).padding = '6px 10px'
      ;(insightsRow as any).gridTemplateColumns = '1fr'
      ;(cardHeadRowPremium as any).flexDirection = 'column'
      ;(cardHeadRowPremium as any).alignItems = 'stretch'
      ;(premiumTitle as any).fontSize = '18px'
      ;(premiumSub as any).fontSize = '11px'
      ;(chartScrollerPremium as any).overflowX = 'hidden'
      ;(chartScrollerPremium as any).padding = 8
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
    premiumCard,
    cardHeadRowPremium,
    premiumTitle,
    premiumSub,
    segmentedToggle,
    segmentBtn,
    segmentBtnActive,
    chartWrapPremium,
    premiumLegendRow,
    legendChips,
    legendChip,
    legendDotSmall,
    insightsRow,
    insightCard,
    insightLabel,
    insightValue,
    insightSmall,
    chartScrollerPremium,
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