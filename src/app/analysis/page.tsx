'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { toast, Toaster } from 'sonner'

// --- MODERN PREMIUM PALETTE ---
const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  indigo: '#6366f1'
}

// --- CATEGORY META (required order & icons) ---
const CATEGORY_META: Array<{
  key: 'Εμπορεύματα' | 'Staff' | 'Utilities' | 'Maintenance' | 'Other'
  icon: string
  label: string
  color: string
}> = [
  { key: 'Εμπορεύματα', icon: '🛒', label: 'Εμπορεύματα', color: '#6366f1' },
  { key: 'Staff', icon: '👤', label: 'Προσωπικό', color: '#0ea5e9' },
  { key: 'Utilities', icon: '💡', label: 'Λογαριασμοί', color: '#f59e0b' },
  { key: 'Maintenance', icon: '🛠️', label: 'Μάστορες', color: '#10b981' },
  { key: 'Other', icon: '📦', label: 'Λοιπά', color: '#64748b' }
]

function AnalysisContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Default to current month (more useful for KPI + staff monthly)
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // guard
  useEffect(() => {
    if (!storeId || storeId === 'null') router.replace('/select-store')
  }, [storeId, router])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      if (!storeId || storeId === 'null') {
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      // ✅ Include fixed_assets sub_category for correct breakdown
      const { data: tx, error } = await supabase
        .from('transactions')
        .select('*, suppliers(name), fixed_assets(name, sub_category)')
        .eq('store_id', storeId)
        .order('date', { ascending: false })

      if (error) throw error
      setTransactions(tx || [])
    } catch (err) {
      console.error(err)
      toast.error('Σφάλμα φόρτωσης δεδομένων')
    } finally {
      setLoading(false)
    }
  }, [router, storeId])

  useEffect(() => { loadData() }, [loadData])

  // --- helpers ---
  const normalizeExpenseCategory = useCallback((t: any) => {
    // DB now stores exact category values:
    // 'Εμπορεύματα', 'Maintenance', 'Utilities', 'Staff', 'Other'
    let cat = t.category

    // fallback safety:
    if (!cat) cat = 'Other'

    // If supplier exists, always εμπορεύματα
    if (t.supplier_id || t.suppliers?.name) return 'Εμπορεύματα'

    // If fixed asset has sub_category, map it
    const sub = t.fixed_assets?.sub_category
    if (sub === 'staff') return 'Staff'
    if (sub === 'utility') return 'Utilities'
    if (sub === 'worker') return 'Maintenance'
    if (sub === 'other') return 'Other'

    // Otherwise trust category if it is one of expected
    if (cat === 'Εμπορεύματα' || cat === 'Staff' || cat === 'Utilities' || cat === 'Maintenance' || cat === 'Other') {
      return cat
    }

    return 'Other'
  }, [])

  // --- filtered period data ---
  const periodTx = useMemo(() => {
    if (!storeId || storeId === 'null') return []
    return transactions
      .filter(t => t.store_id === storeId)
      .filter(t => t.date >= startDate && t.date <= endDate)
  }, [transactions, storeId, startDate, endDate])

  // --- KPI totals ---
  const kpis = useMemo(() => {
    const income = periodTx
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    const expenses = periodTx
      .filter(t => t.type === 'expense' || t.type === 'debt_payment')
      .reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)

    const net = income - expenses

    return { income, expenses, net }
  }, [periodTx])

  // --- CATEGORY BREAKDOWN ---
  const categoryBreakdown = useMemo(() => {
    const expenseTx = periodTx.filter(t => t.type === 'expense' || t.type === 'debt_payment')
    const result: Record<string, number> = {}
    let total = 0

    for (const t of expenseTx) {
      const cat = normalizeExpenseCategory(t)
      const val = Math.abs(Number(t.amount) || 0)
      result[cat] = (result[cat] || 0) + val
      total += val
    }

    // ensure all categories exist for UI
    for (const c of CATEGORY_META) result[c.key] = result[c.key] || 0

    return { result, total }
  }, [periodTx, normalizeExpenseCategory])

  // --- STAFF DETAILS (this month) ---
  // Requirement: "αυτόν τον μήνα" -> use current month regardless of selected date range.
  const staffDetailsThisMonth = useMemo(() => {
    if (!storeId || storeId === 'null') return [] as Array<{ name: string; amount: number }>

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')

    const staffTxs = transactions
      .filter(t => t.store_id === storeId)
      .filter(t => t.date >= monthStart && t.date <= monthEnd)
      .filter(t => (t.type === 'expense' || t.type === 'debt_payment'))
      .filter(t => normalizeExpenseCategory(t) === 'Staff')

    const byStaff: Record<string, number> = {}
    for (const t of staffTxs) {
      const name = t.fixed_assets?.name || 'Άγνωστος'
      byStaff[name] = (byStaff[name] || 0) + Math.abs(Number(t.amount) || 0)
    }

    return Object.entries(byStaff)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, storeId, normalizeExpenseCategory])

  return (
    <div style={iphoneWrapper}>
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logoBoxStyle}>📊</div>
            <div>
              <h1 style={titleStyle}>Ανάλυση</h1>
              <p style={subLabelStyle}>ΠΛΗΡΗΣ ΟΙΚΟΝΟΜΙΚΗ ΕΙΚΟΝΑ</p>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={backBtnStyle}>✕</Link>
        </div>

        {/* FILTERS */}
        <div style={filterCard}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΑΠΟ</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={dateInput} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={dateLabel}>ΕΩΣ</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={dateInput} />
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
            Περίοδος: {startDate} → {endDate}
          </div>
        </div>

        {/* ✅ 1) KPI CARDS */}
        <div style={kpiGrid}>
          <div style={{ ...kpiCard, borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>Έσοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.success }}>+</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>
              {kpis.income.toLocaleString('el-GR')}€
            </div>
          </div>

          <div style={{ ...kpiCard, borderColor: '#ffe4e6', backgroundColor: '#fff1f2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>Έξοδα</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.danger }}>-</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: colors.primary, marginTop: 10 }}>
              {kpis.expenses.toLocaleString('el-GR')}€
            </div>
          </div>

          <div
            style={{
              ...kpiCard,
              borderColor: kpis.net >= 0 ? '#d1fae5' : '#ffe4e6',
              backgroundColor: kpis.net >= 0 ? '#f0fdf4' : '#fff1f2'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>Καθαρό Κέρδος</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: kpis.net >= 0 ? colors.success : colors.danger }}>
                {kpis.net >= 0 ? '▲' : '▼'}
              </span>
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: kpis.net >= 0 ? colors.success : colors.danger,
                marginTop: 10
              }}
            >
              {kpis.net >= 0 ? '+' : ''}
              {kpis.net.toLocaleString('el-GR')}€
            </div>
          </div>
        </div>

        {/* ✅ 2) CATEGORY BREAKDOWN with progress bars */}
        <div style={sectionCard}>
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Έξοδα ανά Κατηγορία</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
              Σύνολο: {categoryBreakdown.total.toLocaleString('el-GR')}€
            </div>
          </div>

          {categoryBreakdown.total <= 0 ? (
            <div style={hintBox}>Δεν υπάρχουν έξοδα στην επιλεγμένη περίοδο.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {CATEGORY_META.map(c => {
                const val = categoryBreakdown.result[c.key] || 0
                const pct = categoryBreakdown.total > 0 ? (val / categoryBreakdown.total) * 100 : 0
                return (
                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{c.icon}</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>{c.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
                          {pct.toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: c.color }}>
                          {val.toLocaleString('el-GR')}€
                        </span>
                      </div>
                    </div>

                    <div style={progressTrack}>
                      <div style={{ ...progressFill, width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ✅ 3) STAFF DETAILS (this month) */}
        <div style={sectionCard}>
          <div style={sectionTitleRow}>
            <h3 style={sectionTitle}>Μισθοδοσία ανά Υπάλληλο</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>
              {format(new Date(), 'MMMM yyyy')}
            </div>
          </div>

          {staffDetailsThisMonth.length === 0 ? (
            <div style={hintBox}>Δεν υπάρχουν εγγραφές μισθοδοσίας αυτόν τον μήνα.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffDetailsThisMonth.map((s) => (
                <div key={s.name} style={rowItem}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: colors.primary }}>
                      {String(s.name || '').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: colors.secondary }}>Καταβλήθηκε</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0ea5e9' }}>
                    {s.amount.toLocaleString('el-GR')}€
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* (Optional) small list - keep your existing list if you want it below */}
        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
          * Όλα τα ποσά βασίζονται στις κινήσεις της βάσης για το επιλεγμένο store.
        </div>
      </div>
    </div>
  )
}

// --- STYLES (✅ 16px everywhere) ---
const iphoneWrapper: any = {
  backgroundColor: colors.background,
  minHeight: '100%',
  padding: 20,
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  overflowY: 'auto',
  fontSize: 16
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const titleStyle: any = { fontWeight: 900, fontSize: 16, margin: 0, color: colors.primary }
const subLabelStyle: any = { margin: 0, fontSize: 16, color: colors.secondary, fontWeight: 800 }
const logoBoxStyle: any = {
  width: 42,
  height: 42,
  backgroundColor: colors.surface,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  border: `1px solid ${colors.border}`
}
const backBtnStyle: any = {
  textDecoration: 'none',
  color: colors.secondary,
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors.surface,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontWeight: 900,
  fontSize: 16
}

const filterCard: any = {
  backgroundColor: colors.surface,
  padding: 16,
  borderRadius: 16,
  border: `1px solid ${colors.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  marginBottom: 16
}

const dateLabel: any = { fontSize: 16, fontWeight: 900, color: colors.secondary, marginBottom: 8, display: 'block' }
const dateInput: any = {
  width: '100%',
  padding: 14,
  borderRadius: 12,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  backgroundColor: colors.background,
  color: colors.primary
}

const kpiGrid: any = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }
const kpiCard: any = {
  backgroundColor: colors.surface,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16
}

const sectionCard: any = {
  backgroundColor: colors.surface,
  borderRadius: 18,
  border: `1px solid ${colors.border}`,
  padding: 16,
  marginBottom: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
}

const sectionTitleRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }
const sectionTitle: any = { margin: 0, fontSize: 16, fontWeight: 900, color: colors.primary }

const progressTrack: any = {
  height: 10,
  borderRadius: 999,
  backgroundColor: '#e5e7eb',
  overflow: 'hidden'
}
const progressFill: any = {
  height: 10,
  borderRadius: 999,
  transition: 'width 0.25s ease'
}

const hintBox: any = {
  padding: 14,
  borderRadius: 14,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  fontSize: 16,
  fontWeight: 800,
  color: colors.secondary
}

const rowItem: any = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 14,
  borderRadius: 16,
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`
}

export default function AnalysisPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}