"use client"
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, Suspense, useCallback } from 'react'
import { getSupabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

  const load = useCallback(async () => {
    try {
      setLoading(true)

      const transRes = await supabase
        .from('transactions')
        .select('*')
        .eq('store_id', storeIdFromUrl)

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

  const txThisYear = useMemo(() => transactions.filter((t) => getTxYear(t) === selectedYear), [transactions, selectedYear])

  // types inferred from analysis page
  const incomeTypes = ['income', 'income_collection', 'debt_received']
  const expenseTypes = ['expense', 'debt_payment']

  const incomeTotal = useMemo(() => txThisYear.filter((t) => incomeTypes.includes(t.type)).reduce((a, t) => a + Number(t.amount || 0), 0), [txThisYear])
  const expenseTotal = useMemo(() => txThisYear.filter((t) => expenseTypes.includes(t.type)).reduce((a, t) => a + Math.abs(Number(t.amount || 0)), 0), [txThisYear])
  const netTotal = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal])

  const byCategory = useMemo(() => groupBy(txThisYear, (t) => String(t.category || t.type || 'Άγνωστο')), [txThisYear])
  const byMethod = useMemo(() => groupBy(txThisYear, (t) => String((t.payment_method || t.method || '').trim() || 'Άγνωστη Μέθοδος')), [txThisYear])
  const byMonth = useMemo(() => {
    const map: Record<string, { key: string; total: number; count: number }> = {}
    for (const t of txThisYear) {
      const d = getTxDate(t)
      const k = d ? monthKey(d) : 'Άγνωστο'
      if (!map[k]) map[k] = { key: k, total: 0, count: 0 }
      map[k].total += Number(t.amount || 0)
      map[k].count += 1
    }
    return Object.values(map).sort((a, b) => String(b.key).localeCompare(String(a.key)))
  }, [txThisYear])

  const recent = useMemo(() => txThisYear.slice().sort((a, b) => (new Date(b.date || b.created_at).getTime() || 0) - (new Date(a.date || a.created_at).getTime() || 0)).slice(0, 20), [txThisYear])

  const headerTitle = 'Οικονομικό Κέντρο'
  const headerSubtitle = 'ΑΝΑΦΟΡΕΣ'

  // UI styles (consistent with economics pages)
  const iphoneWrapper: any = { background: 'var(--bg-grad)', minHeight: '100vh', padding: '20px', position: 'relative' }
  const logoBoxStyle: any = { width: '45px', height: '45px', background: 'var(--surface)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const backBtnStyle: any = { textDecoration: 'none', color: 'var(--muted)', background: 'var(--surface)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid var(--border)' }
  const switchBtn: any = { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', fontWeight: '950', fontSize: '12px', cursor: 'pointer' }
  const switcherWrap: any = { display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '14px', marginBottom: '12px' }
  const card: any = { background: 'var(--surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}><Wallet size={22} color={colors.accentOrange} /></div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: 20, margin: 0, color: 'var(--text)' }}>{headerTitle}</h1>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--muted)', fontWeight: 800, letterSpacing: 1 }}>{headerSubtitle}</p>
            </div>
          </div>
          <Link href={`/?store=${storeIdFromUrl || ''}`} style={backBtnStyle}><ChevronLeft size={20} /></Link>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Έσοδα</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: colors.accentGreen }}>{incomeTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Έξοδα</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: colors.accentOrange }}>{expenseTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)' }}>Καθαρό</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: netTotal >= 0 ? colors.accentGreen : colors.accentRed }}>{netTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ width: 220 }}>
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>Έτος</div>
              <select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 800 }}>
                {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>Προβολή</div>
                <div style={switcherWrap}>
                  <button onClick={() => setView('summary')} style={{ ...switchBtn, background: view === 'summary' ? 'var(--surface)' : 'transparent' }} title="Summary">Σύνοψη</button>
                  <button onClick={() => setView('category')} style={{ ...switchBtn, background: view === 'category' ? 'var(--surface)' : 'transparent' }} title="By Category">Κατηγορία</button>
                  <button onClick={() => setView('method')} style={{ ...switchBtn, background: view === 'method' ? 'var(--surface)' : 'transparent' }} title="By Method">Μέθοδος</button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => setView('timeline')} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: view === 'timeline' ? 'var(--surface)' : 'transparent', fontWeight: 900 }}>Χρονικά</button>
                  <button onClick={() => setView('movements')} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: view === 'movements' ? 'var(--surface)' : 'transparent', fontWeight: 900 }}>Κινήσεις</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            {loading ? (
              <div style={{ ...card, textAlign: 'center', padding: 40 }}>Φόρτωση...</div>
            ) : (
              <div style={card}>
                {view === 'summary' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 900 }}>Σύνοψη Έτους</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>Έσοδα</div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{incomeTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>Έξοδα</div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{expenseTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                      </div>
                      <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)' }}>Καθαρό</div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{netTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                      </div>
                    </div>
                  </div>
                )}

                {view === 'category' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 900 }}>Κατά Κατηγορία</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {byCategory.map((g) => (
                        <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 900 }}>{String(g.key)}</div>
                          <div style={{ fontWeight: 900 }}>{(g.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {view === 'method' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 900 }}>Κατά Μέθοδο Πληρωμής</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {byMethod.map((g) => (
                        <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 900 }}>{String(g.key)}</div>
                          <div style={{ fontWeight: 900 }}>{(g.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {view === 'timeline' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 900 }}>Χρονική Προβολή (Μηνιαία)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {byMonth.map((m) => (
                        <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 900 }}>{m.key}</div>
                          <div style={{ fontWeight: 900 }}>{(m.total || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {view === 'movements' && (
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 900 }}>Τελευταίες Κινήσεις ({recent.length})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recent.map((t) => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>{String(t.category || t.type || '—')}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{String(t.notes || '').slice(0, 120)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900 }}>{moneyAbs(t.amount).toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{String(t.date || t.created_at || '—')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ width: 320 }}>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--muted)', marginBottom: 8 }}>Σύνοψη</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Συνολικές Κινήσεις</div>
                  <div style={{ fontWeight: 900 }}>{txThisYear.length}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Έσοδα</div>
                  <div style={{ fontWeight: 900 }}>{incomeTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Έξοδα</div>
                  <div style={{ fontWeight: 900 }}>{expenseTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ color: 'var(--muted)', fontWeight: 800 }}>Καθαρό</div>
                  <div style={{ fontWeight: 900 }}>{netTotal.toLocaleString('el-GR', { minimumFractionDigits: 2 })}€</div>
                </div>
              </div>
            </div>
          </div>
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
