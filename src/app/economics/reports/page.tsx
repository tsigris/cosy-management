"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import EconomicsHeaderNav from '@/components/economics/EconomicsHeaderNav'
import EconomicsPeriodFilter from '@/components/economics/EconomicsPeriodFilter'
import EconomicsContainer from '@/components/economics/EconomicsContainer'
import { toast, Toaster } from 'sonner'
import { ChevronLeft, Wallet, Layers, Calendar, SlidersHorizontal, List } from 'lucide-react'

const colors = {
  primaryDark: '#1e293b',
  secondaryText: '#64748b',
  accentOrange: '#f97316',
  bgLight: '#f8fafc',
  border: '#e2e8f0',
  white: '#ffffff',
  accentBlue: '#2563eb',
  accentGreen: '#10b981',
  accentRed: '#dc2626',
}

type ReportsView = 'summary' | 'category' | 'method' | 'timeline' | 'movements'

const isValidUUID = (id: any) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof id === 'string' && regex.test(id)
}

const moneyAbs = (n: any) => Math.abs(Number(n) || 0)

const getTxDate = (t: any) => {
  const raw = t?.date || t?.created_at
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

const getTxYear = (t: any) => {
  const d = getTxDate(t)
  return d ? d.getFullYear() : null
}

function groupBy<T extends any>(rows: any[], keyFn: (r: any) => string | null) {
  const map: Record<string, { key: string; total: number; count: number }> = {}
  for (const r of rows) {
    const k = keyFn(r) || 'Άγνωστο'
    if (!map[k]) map[k] = { key: k, total: 0, count: 0 }
    map[k].total += Number(r.amount || 0)
    map[k].count += 1
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
}

function monthKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function ReportsContent() {
  const supabase = getSupabase()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeIdFromUrl = searchParams.get('store')

  console.log('REPORTS PAGE LOADED')
  console.log('REPORTS storeIdFromUrl', storeIdFromUrl)

  if (!storeIdFromUrl || !isValidUUID(storeIdFromUrl)) {
    router.replace('/select-store')
    return null
  }

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [view, setView] = useState<ReportsView>('summary')
  const [period, setPeriod] = useState<'month' | 'year' | '30days' | 'all'>('month')

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const transRes = await supabase.from('transactions').select('*').eq('store_id', storeIdFromUrl)
      if (transRes.error) throw transRes.error

      const txs = transRes.data || []
      console.log('REPORTS transactions count', txs.length)
      setTransactions(txs)
    } catch (err: any) {
      console.error('REPORTS load error', err)
      toast.error('Σφάλμα φόρτωσης αναφορών')
    } finally {
      setLoading(false)
    }
  }, [storeIdFromUrl, supabase])

  useEffect(() => {
    load()
  }, [load])

  // YEAR OPTIONS
  const yearOptions = useMemo(() => {
    const s = new Set<number>()
    for (const t of transactions) {
      const y = getTxYear(t)
      if (y) s.add(y)
    }
    if (!s.size) s.add(new Date().getFullYear())
    return Array.from(s).sort((a, b) => b - a)
  }, [transactions])

  useEffect(() => {
    if (yearOptions.includes(selectedYear)) return
    setSelectedYear(yearOptions[0])
  }, [yearOptions, selectedYear])

  // PERIOD helpers
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

  // types inferred from analysis page
  const incomeTypes = ['income', 'income_collection', 'debt_received']
  const expenseTypes = ['expense', 'debt_payment', 'salary_advance']

  const incomeTotal = useMemo(() => filteredTx.filter((t) => incomeTypes.includes(t.type)).reduce((a, t) => a + Number(t.amount || 0), 0), [filteredTx])
  const expenseTotal = useMemo(() => filteredTx.filter((t) => expenseTypes.includes(t.type)).reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0), [filteredTx])
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal])

  const byCategory = useMemo(() => groupBy(filteredTx, (t) => String(t.category || t.type || 'Άγνωστο')), [filteredTx])
  const byMethod = useMemo(() => groupBy(filteredTx, (t) => String((t.payment_method || t.method || '').trim() || 'Άγνωστη Μέθοδος')), [filteredTx])
  const byMonth = useMemo(() => {
    const map: Record<string, { key: string; total: number; count: number }> = {}
    for (const t of filteredTx) {
      const d = getTxDate(t)
      const k = d ? monthKey(d) : 'Άγνωστο'
      if (!map[k]) map[k] = { key: k, total: 0, count: 0 }
      map[k].total += Number(t.amount || 0)
      map[k].count += 1
    }
    return Object.values(map).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }, [filteredTx])

  const recent = useMemo(() => filteredTx.slice().sort((a, b) => (new Date(b.date || b.created_at).getTime() || 0) - (new Date(a.date || a.created_at).getTime() || 0)).slice(0, 20), [filteredTx])

  const headerTitle = 'Οικονομικό Κέντρο'
  const headerSubtitle = 'ΑΝΑΦΟΡΕΣ'

  // mobile-first UI styles
  // container removed in favor of shared EconomicsContainer
  const headerRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
  const logoBoxStyle: any = { width: '45px', height: '45px', background: 'var(--surface)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const backBtnStyle: any = { textDecoration: 'none', color: 'var(--muted)', background: 'var(--surface)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border)' }
  const navWrap: any = { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }
  const navBtn: any = { flex: '0 0 auto', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900, fontSize: 12 }
  const activeNavBtn: any = { background: 'var(--surface)', boxShadow: 'var(--shadow)' }
  const viewWrapMobile: any = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }
  const viewBtn: any = { flex: 1, minWidth: 110, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', fontWeight: 900 }
  const card: any = { background: 'var(--surface)', padding: 14, borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 12 }

  return (
    <div style={{ background: 'var(--bg-grad)', minHeight: '100vh', padding: 20 }}>
      <Toaster position="top-center" richColors />
      <EconomicsContainer>
        <EconomicsHeaderNav
          title={headerTitle}
          subtitle={headerSubtitle}
          rightControl={<Link href={`/?store=${storeIdFromUrl || ''}`} style={backBtnStyle}><ChevronLeft size={18} /></Link>}
        />

        <EconomicsPeriodFilter
          period={period}
          onPeriodChange={(p) => setPeriod(p)}
          selectedYear={selectedYear}
          onYearChange={(y) => setSelectedYear(y)}
          yearOptions={yearOptions}
        />

        {/* View selector */}
        <div style={viewWrapMobile}>
          <button onClick={() => setView('summary')} style={{ ...viewBtn, background: view === 'summary' ? 'var(--surface)' : 'transparent' }}>Σύνοψη</button>
          <button onClick={() => setView('category')} style={{ ...viewBtn, background: view === 'category' ? 'var(--surface)' : 'transparent' }}>Κατηγορία</button>
          <button onClick={() => setView('method')} style={{ ...viewBtn, background: view === 'method' ? 'var(--surface)' : 'transparent' }}>Μέθοδος</button>
          <button onClick={() => setView('timeline')} style={{ ...viewBtn, background: view === 'timeline' ? 'var(--surface)' : 'transparent' }}>Χρονικά</button>
          <button onClick={() => setView('movements')} style={{ ...viewBtn, background: view === 'movements' ? 'var(--surface)' : 'transparent' }}>Κινήσεις</button>
        </div>

        {/* Summary cards */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Έσοδα</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.accentGreen }}>{incomeTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Έξοδα</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: colors.accentOrange }}>{expenseTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Καθαρό</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: netTotal >= 0 ? colors.accentGreen : colors.accentRed }}>{netTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          {/* Main content depending on view */}
          {loading ? (
            <div style={card}>Φόρτωση...</div>
          ) : (
            <>
              {view === 'summary' && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Σύνοψη Έτους</div>
                  <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 900 }}>Συνολικές Κινήσεις</div>
                      <div style={{ fontWeight: 900 }}>{filteredTx.length}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ color: 'var(--muted)' }}>Έσοδα</div>
                      <div style={{ fontWeight: 900 }}>{incomeTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ color: 'var(--muted)' }}>Έξοδα</div>
                      <div style={{ fontWeight: 900 }}>{expenseTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ color: 'var(--muted)' }}>Καθαρό</div>
                      <div style={{ fontWeight: 900 }}>{netTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'category' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byCategory.map((g) => (
                    <div key={g.key} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>{g.key}</div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900 }}>{(g.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{g.count} κινήσεις</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === 'method' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byMethod.map((g) => (
                    <div key={g.key} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>{g.key}</div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900 }}>{(g.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{g.count} κινήσεις</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === 'timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {byMonth.map((m) => (
                    <div key={m.key} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>{m.key}</div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900 }}>{(m.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.count} κινήσεις</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === 'movements' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recent.map((t) => (
                    <div key={t.id} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>{String(t.category || t.type || '—')}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(t.notes || '')}</div>
                          {t.payment_method || t.method ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{String(t.payment_method || t.method)}</div> : null}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900 }}>{moneyAbs(t.amount).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{String(t.date || t.created_at || '—')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <main style={{ backgroundColor: colors.bgLight, minHeight: '100vh' }}>
      <Suspense fallback={<div style={{ padding: 50, textAlign: 'center' }}>Φόρτωση...</div>}>
        <ReportsContent />
      </Suspense>
    </main>
  )
}
