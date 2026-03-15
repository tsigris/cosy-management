"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

function getTxDate(t: any) {
  const raw = t?.date || t?.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

function monthKeyFromDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function prettyMonthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const dt = new Date(y, m - 1, 1)
  return new Intl.DateTimeFormat('el-GR', { month: 'short', year: 'numeric' }).format(dt)
}

export default function ProfitPage() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: 50, textAlign: 'center' }}>Φόρτωση...</div>}>
        <ProfitContent />
      </Suspense>
    </main>
  )
}

function ProfitContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
    router.replace('/select-store')
    return null
  }

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const incomeTypes = ['income', 'income_collection', 'debt_received']
  const expenseTypes = ['expense', 'debt_payment']

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const transRes = await supabase.from('transactions').select('*').eq('store_id', storeIdFromUrl)
      if (transRes.error) throw transRes.error
      const txs = (transRes.data || []).filter((t: any) => t.is_deleted !== true)
      setTransactions(txs)
    } catch (err) {
      console.error('Profit load error', err)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const yearOptions = useMemo(() => {
    const s = new Set<number>()
    for (const t of transactions) {
      const d = getTxDate(t)
      if (d) s.add(d.getFullYear())
    }
    if (!s.size) s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
  }, [transactions])

  useEffect(() => {
    if (yearOptions.includes(selectedYear)) return
    setSelectedYear(yearOptions[0])
  }, [yearOptions, selectedYear])

  // period helpers
  const getStartOfMonth = useCallback(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }, [])

  const getStartOfYear = useCallback(() => {
    return new Date(selectedYear, 0, 1, 0, 0, 0, 0)
  }, [selectedYear])

  const getLast30Days = useCallback(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = getTxDate(tx)
      if (!d) return false
      if (period === 'all') return true
      if (period === 'month') return d >= getStartOfMonth()
      if (period === 'year') return d >= getStartOfYear()
      if (period === '30days') return d >= getLast30Days()
      return true
    })
  }, [transactions, period, getStartOfMonth, getStartOfYear, getLast30Days])

  const totalRevenue = useMemo(() => filteredTx.filter((t) => incomeTypes.includes(t.type)).reduce((a, t) => a + Number(t.amount || 0), 0), [filteredTx])
  const totalExpenses = useMemo(() => filteredTx.filter((t) => expenseTypes.includes(t.type)).reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0), [filteredTx])
  const totalProfit = useMemo(() => totalRevenue - totalExpenses, [totalRevenue, totalExpenses])

  const byMonth = useMemo(() => {
    const map: Record<string, { revenue: number; expenses: number }> = {}
    for (const t of filteredTx) {
      const d = getTxDate(t)
      const k = d ? monthKeyFromDate(d) : 'unknown'
      if (!map[k]) map[k] = { revenue: 0, expenses: 0 }
      if (incomeTypes.includes(t.type)) map[k].revenue += Number(t.amount || 0)
      if (expenseTypes.includes(t.type)) map[k].expenses += Math.abs(Number(t.amount || 0))
    }
    const rows = Object.entries(map).map(([key, v]) => ({ month: key, revenue: v.revenue, expenses: v.expenses, profit: v.revenue - v.expenses }))
    return rows.sort((a, b) => String(b.month).localeCompare(String(a.month)))
  }, [filteredTx])

  const container: any = { maxWidth: 920, margin: '0 auto', paddingBottom: 120 }
  const card: any = { background: 'var(--surface)', padding: 14, borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 12 }
  const viewBtn: any = { flex: 1, minWidth: 90, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900 }

  const amountFmt = (n: number) => n.toLocaleString('el-GR', { minimumFractionDigits: 2 }) + '€'

  return (
    <div style={{ background: 'var(--bg-grad)', minHeight: '100vh', padding: 20 }}>
      <div style={container}>
        <EconomicsHeaderNav title="Οικονομικό Κέντρο" subtitle="Profit" />

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setPeriod('month')} style={{ ...viewBtn, background: period === 'month' ? 'var(--surface)' : 'transparent' }}>Month</button>
          <button onClick={() => setPeriod('year')} style={{ ...viewBtn, background: period === 'year' ? 'var(--surface)' : 'transparent' }}>Year</button>
          <button onClick={() => setPeriod('30days')} style={{ ...viewBtn, background: period === '30days' ? 'var(--surface)' : 'transparent' }}>30 days</button>
          <button onClick={() => setPeriod('all')} style={{ ...viewBtn, background: period === 'all' ? 'var(--surface)' : 'transparent' }}>All</button>
        </div>

        {/* Year selector when relevant */}
        {period === 'year' ? (
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>YEAR</div>
            <select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}>
              {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
        ) : null}

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ ...card, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Total Revenue</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{loading ? '—' : amountFmt(totalRevenue)}</div>
          </div>
          <div style={{ ...card, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Total Expenses</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{loading ? '—' : amountFmt(totalExpenses)}</div>
          </div>
          <div style={{ ...card, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Total Profit</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: totalProfit >= 0 ? '#10b981' : '#dc2626' }}>{loading ? '—' : amountFmt(totalProfit)}</div>
          </div>
        </div>

        {/* Monthly table */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Monthly P&L</h2>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Month • Revenue • Expenses • Profit</div>
            </div>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', fontWeight: 900, color: 'var(--muted)', padding: '6px 0' }}>
                <div style={{ flex: 2 }}>Month</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Revenue</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Expenses</div>
                <div style={{ flex: 1, textAlign: 'right' }}>Profit</div>
              </div>

              {byMonth.length === 0 && <div style={{ color: 'var(--muted)' }}>No data for selected period.</div>}

              {byMonth.map((r) => (
                <div key={r.month} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 2 }}>{prettyMonthLabel(r.month)}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 900 }}>{amountFmt(r.revenue)}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 900 }}>{amountFmt(r.expenses)}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontWeight: 900, color: r.profit >= 0 ? '#10b981' : '#dc2626' }}>{amountFmt(r.profit)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
