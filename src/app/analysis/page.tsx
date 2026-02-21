'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth, parseISO, differenceInCalendarDays, subDays } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Users, ShoppingBag, Lightbulb, Wrench, Printer, SlidersHorizontal, Sparkles, ChevronRight } from 'lucide-react'

// --- COLORS & META ---
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1',
  purple: '#7c3aed',
}

const CATEGORY_META = [
  { key: 'Εμπορεύματα', label: 'Εμπορεύματα', color: '#6366f1', Icon: ShoppingBag },
  { key: 'Staff', label: 'Προσωπικό', color: '#0ea5e9', Icon: Users },
  { key: 'Utilities', label: 'Λογαριασμοί', color: '#f59e0b', Icon: Lightbulb },
  { key: 'Maintenance', label: 'Συντήρηση', color: '#10b981', Icon: Wrench },
  { key: 'Other', label: 'Λοιπά', color: '#64748b', Icon: Coins },
] as const

type FilterA = 'Όλες' | 'Έσοδα' | 'Εμπορεύματα' | 'Προσωπικό' | 'Λογαριασμοί' | 'Συντήρηση' | 'Λοιπά'
type UiMode = 'simple' | 'pro'

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [transactions, setTransactions] = useState<any[]>([])
  const [prevTransactions, setPrevTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterA, setFilterA] = useState<FilterA>('Όλες')
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [uiMode, setUiMode] = useState<UiMode>('simple')

  // ✅ PRINT CSS (inject once)
  useEffect(() => {
    const STYLE_ID = 'analysis-print-css'
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
      @media print {
        @page { size: A4; margin: 12mm; }
        html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .no-print { display: none !important; }
        [data-print-root="true"] { position: static !important; padding: 0 !important; overflow: visible !important; }
      }
    `
    document.head.appendChild(style)
  }, [])

  const isZReport = useMemo(() => startDate === endDate, [startDate, endDate])

  // ✅ ΜΗΝ το πειράξει ο Cursor: χρησιμοποιείται παντού
  const norm = useCallback((v: any) => String(v ?? '').trim().toLowerCase(), [])

  const getMethod = useCallback((t: any) => {
    // supports both columns
    return String(t?.method ?? t?.payment_method ?? '').trim()
  }, [])

  // ✅ Dependencies σωστά: [getMethod, norm]
  const isCreditTx = useCallback(
    (t: any) => {
      if (t?.is_credit === true) return true
      return norm(getMethod(t)) === 'πίστωση'
    },
    [getMethod, norm]
  )

  const signedAmount = useCallback((t: any) => {
    const val = Math.abs(Number(t.amount) || 0)
    if (t.type === 'expense' || t.type === 'debt_payment' || t.type === 'savings_deposit') return -val
    return val
  }, [])

  // ✅ Guard store + session
  useEffect(() => {
    if (!storeId || storeId === 'null') {
      router.replace('/select-store')
      return
    }
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) router.replace('/login')
    })()
  }, [storeId, router])

  // ✅ Data Loading
  // ✅ FIX: dependencies includes startDate & endDate
  const loadData = useCallback(async () => {
    if (!storeId || storeId === 'null') return
    setLoading(true)

    try {
      const s = parseISO(startDate)
      const e = parseISO(endDate)

      const diff = Math.max(0, differenceInCalendarDays(e, s))
      const prevEnd = subDays(s, 1)
      const prevStart = subDays(prevEnd, diff)

      const prevStartStr = format(prevStart, 'yyyy-MM-dd')
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd')

      const [txRes, prevRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, suppliers(id, name), fixed_assets(id, name, sub_category)')
          .eq('store_id', storeId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),

        supabase
          .from('transactions')
          .select('amount, type, is_credit, method, payment_method')
          .eq('store_id', storeId)
          .gte('date', prevStartStr)
          .lte('date', prevEndStr),
      ])

      if (txRes.error) throw txRes.error
      if (prevRes.error) throw prevRes.error

      setTransactions(txRes.data || [])
      setPrevTransactions(prevRes.data || [])
    } catch (e) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης')
    } finally {
      setLoading(false)
    }
  }, [storeId, startDate, endDate]) // ✅ FIXED

  useEffect(() => {
    loadData()
  }, [loadData])

  const normalizeCategory = useCallback(
    (t: any): string => {
      if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'

      const sub = norm(t.fixed_assets?.sub_category || '')
      if (sub === 'staff') return 'Staff'
      if (sub === 'utility' || sub === 'utilities') return 'Utilities'
      if (sub === 'worker' || sub === 'maintenance') return 'Maintenance'

      const cat = String(t.category || '').trim()
      if (cat === 'Εμπορεύματα') return 'Εμπορεύματα'
      if (cat === 'Staff') return 'Staff'
      if (cat === 'Utilities') return 'Utilities'
      if (cat === 'Maintenance') return 'Maintenance'
      if (cat === 'Other') return 'Other'

      return 'Other'
    },
    [norm]
  )

  const filteredTx = useMemo(() => {
    const keyMap: Record<string, string> = {
      Εμπορεύματα: 'Εμπορεύματα',
      Προσωπικό: 'Staff',
      Λογαριασμοί: 'Utilities',
      Συντήρηση: 'Maintenance',
      Λοιπά: 'Other',
    }

    return transactions.filter((t) => {
      // ✅ Φίλτρο Έσοδα περιλαμβάνει savings_withdrawal
      if (filterA === 'Έσοδα')
        return ['income', 'income_collection', 'debt_received', 'savings_withdrawal'].includes(t.type)

      if (filterA !== 'Όλες') return normalizeCategory(t) === keyMap[filterA]
      return true
    })
  }, [transactions, filterA, normalizeCategory])

  const kpis = useMemo(() => {
    const rows = transactions.filter((t) => !isCreditTx(t))

    const income = rows
      .filter((t) => ['income', 'income_collection', 'debt_received'].includes(t.type))
      .reduce((a, t) => a + (Number(t.amount) || 0), 0)

    const expenses = rows
      .filter((t) => ['expense', 'debt_payment'].includes(t.type))
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const savingsDeposits = rows
      .filter((t) => t.type === 'savings_deposit')
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const savingsWithdrawals = rows
      .filter((t) => t.type === 'savings_withdrawal')
      .reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    return {
      income,
      expenses,
      savings: savingsDeposits - savingsWithdrawals,
      netProfit: income - expenses, // ✅ BUSINESS PERFORMANCE KPI
    }
  }, [transactions, isCreditTx])

  const totalCash = useMemo(() => {
    const cashMethods = ['μετρητά', 'μετρητά (z)', 'χωρίς απόδειξη']
    return transactions
      .filter((t) => cashMethods.includes(norm(getMethod(t))) && !isCreditTx(t))
      .reduce((a, t) => a + signedAmount(t), 0)
  }, [transactions, isCreditTx, getMethod, norm, signedAmount])

  const bankBal = useMemo(() => {
    const bankMethods = ['κάρτα', 'τράπεζα']
    return transactions
      .filter((t) => bankMethods.includes(norm(getMethod(t))) && !isCreditTx(t))
      .reduce((a, t) => a + signedAmount(t), 0)
  }, [transactions, isCreditTx, getMethod, norm, signedAmount])

  const money = useCallback(
    (n: number) => `${(Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`,
    []
  )

  return (
    <div style={iphoneWrapper} data-print-root="true">
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
        <div style={headerCard} className="no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={headerIconBox}>📊</div>
            <div>
              <div style={headerTitle}>{isZReport ? 'Αναφορά Ζ' : 'Ανάλυση'}</div>
              <div style={headerSub}>{uiMode === 'simple' ? 'Προβολή Ιδιοκτήτη' : 'Προβολή Pro'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setUiMode((m) => (m === 'simple' ? 'pro' : 'simple'))}
              style={modeBtn(uiMode === 'pro')}
            >
              {uiMode === 'simple' ? <SlidersHorizontal size={14} /> : <Sparkles size={14} />}
              <span style={{ fontSize: 10, fontWeight: 900 }}>{uiMode === 'simple' ? 'PRO' : 'SIMPLE'}</span>
            </button>

            <button type="button" onClick={() => window.print()} style={headerCircleBtn} aria-label="print">
              <Printer size={18} />
            </button>

            <Link href={`/?store=${storeId}`} style={headerCircleBtn as any} aria-label="close">
              ✕
            </Link>
          </div>
        </div>

        {/* DATE PICKERS */}
        <div style={filterCard} className="no-print">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={tile}>
              <div style={tileLabel}>ΑΠΟ</div>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={tileControl} />
            </div>
            <div style={tile}>
              <div style={tileLabel}>ΕΩΣ</div>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={tileControl} />
            </div>
          </div>
        </div>

        {/* ✅ BUSINESS PERFORMANCE (Black Box KPI) */}
        <div style={{ ...businessKpiCard, background: colors.primary, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: '#94a3b8' }}>
            {isZReport ? 'ΚΑΘΑΡΟ ΚΕΡΔΟΣ ΗΜΕΡΑΣ' : 'ΚΑΘΑΡΟ ΚΕΡΔΟΣ ΠΕΡΙΟΔΟΥ'}
          </div>
          <div style={{ fontSize: 34, fontWeight: 1000, marginTop: 6 }}>{money(kpis.netProfit)}</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={chip}>Έσοδα: <b style={{ marginLeft: 6 }}>{money(kpis.income)}</b></div>
            <div style={chip}>Έξοδα: <b style={{ marginLeft: 6 }}>{money(kpis.expenses)}</b></div>
          </div>
        </div>

        {/* MAIN BALANCES */}
        <div style={balancesGrid}>
          <div style={{ ...smallKpiCard, border: `1px solid ${colors.purple}`, background: '#f5f3ff' }}>
            <div style={{ ...smallKpiLabel, color: colors.purple }}>Κουμπαράς</div>
            <div style={{ ...smallKpiValue, color: colors.purple }}>{money(kpis.savings)}</div>
            <div style={smallKpiHint}>(+): μπήκαν • (-): βγήκαν</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Μετρητά</div>
            <div style={smallKpiValue}>{money(totalCash)}</div>
          </div>

          <div style={smallKpiCard}>
            <div style={smallKpiLabel}>Τράπεζα</div>
            <div style={smallKpiValue}>{money(bankBal)}</div>
          </div>

          <div style={{ ...smallKpiCard, background: colors.primary, color: '#fff' }}>
            <div style={{ ...smallKpiLabel, color: '#94a3b8' }}>Σύνολο Ρευστό</div>
            <div style={{ ...smallKpiValue, color: '#fff' }}>{money(totalCash + bankBal)}</div>
          </div>
        </div>

        {/* CATEGORY SELECTOR */}
        <div style={{ marginTop: 20 }} className="no-print">
          <div style={{ fontSize: 11, fontWeight: 900, color: colors.secondary, marginBottom: 12, letterSpacing: 0.5 }}>
            ΕΠΙΛΟΓΗ ΚΑΤΗΓΟΡΙΑΣ
          </div>
          <div style={categoryScroll}>
            <button onClick={() => setFilterA('Όλες')} style={catPill(filterA === 'Όλες', colors.primary)}>
              Όλες
            </button>
            <button onClick={() => setFilterA('Έσοδα')} style={catPill(filterA === 'Έσοδα', colors.success)}>
              Έσοδα
            </button>
            {CATEGORY_META.map((c) => (
              <button key={c.key} onClick={() => setFilterA(c.label as FilterA)} style={catPill(filterA === c.label, c.color)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* TRANSACTIONS LIST */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: colors.secondary, letterSpacing: 1 }}>
              ΚΙΝΗΣΕΙΣ: {filterA.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 900, color: colors.primary }}>
              {loading ? '…' : filteredTx.length} ΕΓΓΡΑΦΕΣ
            </div>
          </div>

          {loading ? (
            <div style={emptyBox}>Φόρτωση…</div>
          ) : filteredTx.length === 0 ? (
            <div style={emptyBox}>Δεν βρέθηκαν κινήσεις</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTx.map((t: any) => {
                const isExp = ['expense', 'debt_payment', 'savings_deposit'].includes(t.type)
                const title = String(t.notes || t.category || 'Κίνηση').trim()
                const date = String(t.date || '').trim()
                const method = getMethod(t)

                return (
                  <div key={t.id ?? `${date}-${title}-${t.amount}`} style={listRow}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={rowTitle}>{title || 'Κίνηση'}</div>
                      <div style={rowMeta}>
                        {date || '—'} • {method || '—'}
                      </div>
                    </div>

                    <div style={{ ...rowAmount, color: isExp ? colors.danger : colors.success }}>
                      {isExp ? '-' : '+'}
                      {money(Math.abs(Number(t.amount) || 0))}
                      <ChevronRight size={14} style={{ marginLeft: 4, opacity: 0.3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- STYLES ---
const iphoneWrapper: any = { background: colors.background, minHeight: '100vh', padding: 16 }

const headerCard: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 22,
  background: '#fff',
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
}
const headerIconBox: any = {
  width: 42,
  height: 42,
  borderRadius: 12,
  background: colors.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
}
const headerTitle: any = { fontSize: 17, fontWeight: 900, color: colors.primary }
const headerSub: any = { fontSize: 10, color: colors.secondary, fontWeight: 800, textTransform: 'uppercase' }
const headerCircleBtn: any = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: colors.primary,
  textDecoration: 'none',
}
const modeBtn = (isPro: boolean): any => ({
  ...headerCircleBtn,
  width: 'auto',
  padding: '0 10px',
  gap: 6,
  background: isPro ? colors.primary : '#fff',
  color: isPro ? '#fff' : colors.primary,
})

const filterCard: any = { marginTop: 12, padding: 12, background: '#fff', borderRadius: 20, border: `1px solid ${colors.border}` }
const tile: any = { display: 'flex', flexDirection: 'column', gap: 4 }
const tileLabel: any = { fontSize: 9, fontWeight: 900, color: colors.secondary }
const tileControl: any = {
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: 8,
  fontSize: 13,
  fontWeight: 800,
  outline: 'none',
  background: colors.background,
  color: colors.primary,
  width: '100%',
}

const businessKpiCard: any = {
  marginTop: 14,
  padding: 18,
  borderRadius: 22,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
}

const chip: any = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 10px',
  borderRadius: 14,
  fontSize: 12,
  fontWeight: 800,
}

const balancesGrid: any = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }
const smallKpiCard: any = {
  background: '#fff',
  padding: 14,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
}
const smallKpiLabel: any = { fontSize: 10, fontWeight: 800, color: colors.secondary, textTransform: 'uppercase', marginBottom: 4 }
const smallKpiValue: any = { fontSize: 17, fontWeight: 1000 }
const smallKpiHint: any = { fontSize: 11, fontWeight: 800, color: '#94a3b8', marginTop: 4 }

const categoryScroll: any = { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' as any }
const catPill = (active: boolean, color: string): any => ({
  padding: '8px 14px',
  borderRadius: 12,
  background: active ? color : '#fff',
  color: active ? '#fff' : colors.secondary,
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: 'nowrap',
  boxShadow: active ? '0 6px 14px rgba(0,0,0,0.08)' : 'none',
  border: active ? 'none' : `1px solid ${colors.border}`,
  cursor: 'pointer',
})

const listRow: any = {
  padding: 14,
  background: '#fff',
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
}
const rowTitle: any = { fontSize: 13, fontWeight: 900, color: colors.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const rowMeta: any = { fontSize: 10, fontWeight: 700, color: colors.secondary, marginTop: 2 }
const rowAmount: any = { fontSize: 14, fontWeight: 1000, display: 'flex', alignItems: 'center' }

const emptyBox: any = {
  padding: 40,
  textAlign: 'center',
  background: '#fff',
  borderRadius: 20,
  border: `1px solid ${colors.border}`,
  color: colors.secondary,
  fontSize: 13,
  fontWeight: 700,
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Φόρτωση...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}