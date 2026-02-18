'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useCallback, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { toast, Toaster } from 'sonner'
import { Coins, Landmark, TrendingUp, TrendingDown, Wallet, CreditCard, AlertTriangle, Users, ShoppingBag, Wrench } from 'lucide-react'

const colors = {
  primary: '#0f172a',
  secondary: '#64748b',
  success: '#10b981',
  danger: '#f43f5e',
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  warning: '#f59e0b'
}

type Mode = 'month' | 'custom'

function OwnerReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeId = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [revenueSources, setRevenueSources] = useState<any[]>([])
  const [maintenanceWorkers, setMaintenanceWorkers] = useState<any[]>([])

  const [mode, setMode] = useState<Mode>('month')
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // comparison: previous period same length
  const prevRange = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const prevEnd = subDays(start, 1)
    const prevStart = subDays(prevEnd, diffDays)
    return {
      prevStart: format(prevStart, 'yyyy-MM-dd'),
      prevEnd: format(prevEnd, 'yyyy-MM-dd')
    }
  }, [startDate, endDate])

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

      // ✅ Better: filter in DB by date range
      const txQuery = supabase
        .from('transactions')
        .select('*, suppliers(id, name), fixed_assets(id, name, sub_category), revenue_sources(id, name)')
        .eq('store_id', storeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      const staffQuery = supabase
        .from('fixed_assets')
        .select('id, name, sub_category')
        .eq('store_id', storeId)
        .eq('sub_category', 'staff')
        .order('name', { ascending: true })

      const suppliersQuery = supabase
        .from('suppliers')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      const revenueSourcesQuery = supabase
        .from('revenue_sources')
        .select('id, name')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      const maintenanceQuery = supabase
        .from('fixed_assets')
        .select('id, name, sub_category')
        .eq('store_id', storeId)
        .in('sub_category', ['worker', 'Maintenance', 'maintenance'])
        .order('name', { ascending: true })

      const [
        { data: tx, error: txErr },
        { data: staffData, error: staffErr },
        { data: supData, error: supErr },
        { data: revData, error: revErr },
        { data: maintData, error: maintErr }
      ] = await Promise.all([txQuery, staffQuery, suppliersQuery, revenueSourcesQuery, maintenanceQuery])

      if (txErr) throw txErr
      if (staffErr) throw staffErr
      if (supErr) throw supErr
      if (revErr) throw revErr
      if (maintErr) throw maintErr

      setTransactions(tx || [])
      setStaff(staffData || [])
      setSuppliers(supData || [])
      setRevenueSources(revData || [])
      setMaintenanceWorkers((maintData || []).filter((x: any) => String(x?.name || '').trim().length > 0))
    } catch (e) {
      console.error(e)
      toast.error('Σφάλμα φόρτωσης αναφοράς')
    } finally {
      setLoading(false)
    }
  }, [router, storeId, startDate, endDate])

  useEffect(() => { loadData() }, [loadData])

  const isIncome = (t: any) => t.type === 'income' || t.type === 'income_collection' || t.type === 'debt_received'
  const isExpense = (t: any) => t.type === 'expense' || t.type === 'debt_payment'
  const isTip = (t: any) => t.type === 'tip_entry'
  const pm = (t: any) => String(t.payment_method || '').toLowerCase().trim()
  const isCash = (t: any) => pm(t) === 'cash'
  const isBank = (t: any) => pm(t) === 'bank' || pm(t) === 'card' || pm(t) === 'pos'

  const getPartyName = useCallback((t: any) => {
    if (t.revenue_source_id || t.revenue_sources?.name) return t.revenue_sources?.name || 'Πηγή Εσόδων'
    if (String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff') return t.fixed_assets?.name || 'Προσωπικό'
    if (t.suppliers?.name) return t.suppliers.name
    if (t.supplier_id) return suppliers.find(s => String(s.id) === String(t.supplier_id))?.name || 'Προμηθευτής'
    if (t.fixed_asset_id) return t.fixed_assets?.name || maintenanceWorkers.find(m => String(m.id) === String(t.fixed_asset_id))?.name || 'Συντήρηση'
    if (isTip(t)) return staff.find(s => String(s.id) === String(t.fixed_asset_id))?.name || 'Tips'
    return '-'
  }, [suppliers, maintenanceWorkers, staff])

  // ✅ Main totals (profit + cashflow)
  const totals = useMemo(() => {
    const incomeTotal = transactions.filter(isIncome).reduce((a, t) => a + (Number(t.amount) || 0), 0)
    const expenseTotal = transactions.filter(isExpense).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)
    const tipsTotal = transactions.filter(isTip).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const cashIn = transactions.filter(t => isIncome(t) && isCash(t)).reduce((a, t) => a + (Number(t.amount) || 0), 0)
    const cashOut = transactions.filter(t => isExpense(t) && isCash(t)).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const bankIn = transactions.filter(t => isIncome(t) && isBank(t)).reduce((a, t) => a + (Number(t.amount) || 0), 0)
    const bankOut = transactions.filter(t => isExpense(t) && isBank(t)).reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)

    const profit = incomeTotal - expenseTotal
    const cashflow = (cashIn + bankIn) - (cashOut + bankOut)

    return {
      incomeTotal,
      expenseTotal,
      tipsTotal,
      profit,
      cashflow,
      cashIn,
      cashOut,
      bankIn,
      bankOut
    }
  }, [transactions])

  // ✅ Previous period totals (for comparison)
  const [prevTotals, setPrevTotals] = useState<any>(null)

  const loadPrevTotals = useCallback(async () => {
    try {
      if (!storeId || storeId === 'null') return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, payment_method, date')
        .eq('store_id', storeId)
        .gte('date', prevRange.prevStart)
        .lte('date', prevRange.prevEnd)

      if (error) throw error

      const tx = data || []
      const incomeTotal = tx.filter(isIncome).reduce((a, t: any) => a + (Number(t.amount) || 0), 0)
      const expenseTotal = tx.filter(isExpense).reduce((a, t: any) => a + Math.abs(Number(t.amount) || 0), 0)
      const cashIn = tx.filter((t: any) => isIncome(t) && String(t.payment_method || '').toLowerCase() === 'cash').reduce((a, t: any) => a + (Number(t.amount) || 0), 0)
      const cashOut = tx.filter((t: any) => isExpense(t) && String(t.payment_method || '').toLowerCase() === 'cash').reduce((a, t: any) => a + Math.abs(Number(t.amount) || 0), 0)
      const bankIn = tx.filter((t: any) => isIncome(t) && (String(t.payment_method || '').toLowerCase() === 'bank' || String(t.payment_method || '').toLowerCase() === 'pos' || String(t.payment_method || '').toLowerCase() === 'card')).reduce((a, t: any) => a + (Number(t.amount) || 0), 0)
      const bankOut = tx.filter((t: any) => isExpense(t) && (String(t.payment_method || '').toLowerCase() === 'bank' || String(t.payment_method || '').toLowerCase() === 'pos' || String(t.payment_method || '').toLowerCase() === 'card')).reduce((a, t: any) => a + Math.abs(Number(t.amount) || 0), 0)

      const profit = incomeTotal - expenseTotal
      const cashflow = (cashIn + bankIn) - (cashOut + bankOut)

      setPrevTotals({ incomeTotal, expenseTotal, profit, cashflow })
    } catch (e) {
      console.error(e)
      setPrevTotals(null)
    }
  }, [storeId, prevRange.prevStart, prevRange.prevEnd])

  useEffect(() => { loadPrevTotals() }, [loadPrevTotals])

  const pct = (cur: number, prev: number) => {
    if (!prev || prev === 0) return null
    return ((cur - prev) / prev) * 100
  }

  // ✅ “Open balances” (simple model): if you have is_credit, use it. Otherwise show “signals”.
  const openBalances = useMemo(() => {
    // Suppliers: open = sum(is_credit true) - sum(debt_payment) per supplier
    // Revenue sources: open = sum(is_credit true) - sum(debt_received) per revenue source (if used)
    const payables: Record<string, number> = {}
    const receivables: Record<string, number> = {}

    for (const t of transactions) {
      const amt = Math.abs(Number(t.amount) || 0)

      // Payables to supplier
      if (t.supplier_id) {
        const key = String(t.supplier_id)
        const isCredit = t.is_credit === true || String(t.payment_method || '').toLowerCase() === 'credit'
        if (isCredit && (t.type === 'expense' || t.type === 'debt_payment')) {
          // expense on credit increases payable; debt_payment reduces
          if (t.type === 'expense') payables[key] = (payables[key] || 0) + amt
          if (t.type === 'debt_payment') payables[key] = (payables[key] || 0) - amt
        }
      }

      // Receivables (income on credit)
      if (t.revenue_source_id) {
        const key = String(t.revenue_source_id)
        const isCredit = t.is_credit === true || String(t.payment_method || '').toLowerCase() === 'credit'
        if (isCredit && (t.type === 'income' || t.type === 'debt_received')) {
          // income on credit increases receivable; debt_received reduces
          if (t.type === 'income') receivables[key] = (receivables[key] || 0) + (Number(t.amount) || 0)
          if (t.type === 'debt_received') receivables[key] = (receivables[key] || 0) - (Number(t.amount) || 0)
        }
      }
    }

    const payablesList = Object.entries(payables)
      .map(([id, amount]) => ({
        id,
        name: suppliers.find(s => String(s.id) === String(id))?.name || 'Προμηθευτής',
        amount
      }))
      .filter(x => x.amount > 0.01)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const receivablesList = Object.entries(receivables)
      .map(([id, amount]) => ({
        id,
        name: revenueSources.find(r => String(r.id) === String(id))?.name || 'Πηγή Εσόδων',
        amount
      }))
      .filter(x => x.amount > 0.01)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const totalPayables = payablesList.reduce((a, x) => a + x.amount, 0)
    const totalReceivables = receivablesList.reduce((a, x) => a + x.amount, 0)

    return { payablesList, receivablesList, totalPayables, totalReceivables }
  }, [transactions, suppliers, revenueSources])

  // ✅ Top lists (period)
  const topLists = useMemo(() => {
    const bySupplier: Record<string, number> = {}
    const byStaff: Record<string, number> = {}
    const byMaint: Record<string, number> = {}
    const byRevenue: Record<string, number> = {}

    for (const t of transactions) {
      const abs = Math.abs(Number(t.amount) || 0)

      if (isExpense(t)) {
        if (t.supplier_id) {
          const name = t.suppliers?.name || suppliers.find(s => String(s.id) === String(t.supplier_id))?.name || 'Προμηθευτής'
          bySupplier[name] = (bySupplier[name] || 0) + abs
        } else if (String(t.fixed_assets?.sub_category || '').toLowerCase() === 'staff') {
          const name = t.fixed_assets?.name || 'Υπάλληλος'
          byStaff[name] = (byStaff[name] || 0) + abs
        } else if (t.fixed_asset_id) {
          const name = t.fixed_assets?.name || maintenanceWorkers.find(m => String(m.id) === String(t.fixed_asset_id))?.name || 'Συντήρηση'
          byMaint[name] = (byMaint[name] || 0) + abs
        }
      }

      if (isIncome(t) && (t.revenue_source_id || t.revenue_sources?.name)) {
        const name = t.revenue_sources?.name || revenueSources.find(r => String(r.id) === String(t.revenue_source_id))?.name || 'Πηγή Εσόδων'
        byRevenue[name] = (byRevenue[name] || 0) + (Number(t.amount) || 0)
      }
    }

    const toTop = (obj: Record<string, number>) =>
      Object.entries(obj)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)

    return {
      suppliersTop: toTop(bySupplier),
      staffTop: toTop(byStaff),
      maintenanceTop: toTop(byMaint),
      revenueTop: toTop(byRevenue)
    }
  }, [transactions, suppliers, revenueSources, maintenanceWorkers])

  // ✅ Insights / Alerts
  const insights = useMemo(() => {
    const msgs: Array<{ type: 'warn' | 'ok'; text: string }> = []

    // Cashflow vs Profit gap
    const gap = totals.cashflow - totals.profit
    if (Math.abs(gap) > Math.max(50, totals.incomeTotal * 0.1)) {
      msgs.push({
        type: 'warn',
        text: `Μεγάλη διαφορά Cashflow vs Κέρδος (${gap >= 0 ? '+' : ''}${gap.toLocaleString('el-GR')}€). Πιθανές πιστώσεις/οφειλές ή τρόπος πληρωμής.`
      })
    }

    // High staff ratio
    const staffSpend = topLists.staffTop.reduce((a, x) => a + x.amount, 0)
    const staffRatio = totals.incomeTotal > 0 ? (staffSpend / totals.incomeTotal) * 100 : 0
    if (staffRatio > 35 && totals.incomeTotal > 0) {
      msgs.push({ type: 'warn', text: `Το κόστος προσωπικού είναι υψηλό (${staffRatio.toFixed(0)}% των εσόδων).` })
    }

    // Payables
    if (openBalances.totalPayables > 0.01) {
      msgs.push({ type: 'warn', text: `Ανοιχτές οφειλές προς προμηθευτές: ${openBalances.totalPayables.toLocaleString('el-GR')}€.` })
    }

    // Uncategorized / missing party
    const missingParty = transactions.filter(t => {
      const hasParty = t.supplier_id || t.fixed_asset_id || t.revenue_source_id || t.suppliers?.name || t.fixed_assets?.name || t.revenue_sources?.name
      return !hasParty && (isIncome(t) || isExpense(t))
    }).length
    if (missingParty > 0) {
      msgs.push({ type: 'warn', text: `${missingParty} κινήσεις χωρίς αντισυμβαλλόμενο (προμηθευτή/υπάλληλο/πηγή).` })
    }

    if (msgs.length === 0) msgs.push({ type: 'ok', text: 'Δεν εντοπίστηκαν προειδοποιήσεις στην περίοδο.' })
    return msgs
  }, [totals, topLists.staffTop, openBalances.totalPayables, transactions])

  const periodList = useMemo(() => [...transactions].sort((a, b) => String(b.date).localeCompare(String(a.date))), [transactions])

  const Tag = ({ label, value, icon: Icon, color }: any) => (
    <div style={{ ...pill, borderColor: color, backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon ? <Icon size={18} /> : null}
        <span style={{ fontWeight: 900, color: colors.secondary }}>{label}</span>
      </div>
      <span style={{ fontWeight: 900, color: colors.primary }}>{value}</span>
    </div>
  )

  const Delta = ({ cur, prev }: any) => {
    if (!prevTotals) return null
    const d = pct(cur, prev)
    if (d === null) return null
    const up = d >= 0
    return (
      <span style={{ fontWeight: 900, color: up ? colors.success : colors.danger, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        {d >= 0 ? '+' : ''}
        {d.toFixed(0)}%
      </span>
    )
  }

  return (
    <div style={wrap}>
      <Toaster position="top-center" richColors />

      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 120 }}>
        {/* HEADER */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={logo}>📌</div>
            <div>
              <h1 style={h1}>Owner Report</h1>
              <p style={sub}>ΠΛΗΡΡΗΣ ΕΠΙΧΕΙΡΗΜΑΤΙΚΗ ΕΙΚΟΝΑ</p>
            </div>
          </div>

          <Link href={`/?store=${storeId}`} style={back}>
            ✕
          </Link>
        </div>

        {/* FILTERS */}
        <div style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>ΑΠΟ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setMode('custom')
                  setStartDate(e.target.value)
                }}
                style={input}
              />
            </div>
            <div>
              <label style={lbl}>ΕΩΣ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setMode('custom')
                  setEndDate(e.target.value)
                }}
                style={input}
              />
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                setMode('month')
                setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
                setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
              }}
              style={{ ...btn, backgroundColor: mode === 'month' ? colors.primary : '#ffffff', color: mode === 'month' ? '#fff' : colors.primary }}
            >
              Τρέχων Μήνας
            </button>

            <button onClick={loadData} style={{ ...btn, backgroundColor: '#ffffff', color: colors.primary }}>
              Ανανέωση
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, color: colors.secondary }}>
            Περίοδος: {startDate} → {endDate}
            <span style={{ marginLeft: 10, fontWeight: 800 }}>
              (Prev: {prevRange.prevStart} → {prevRange.prevEnd})
            </span>
          </div>
        </div>

        {/* SUMMARY KPIs */}
        <div style={grid}>
          <div style={{ ...kpi, borderColor: '#d1fae5', backgroundColor: '#ecfdf5' }}>
            <div style={kpiHead}>
              <span style={{ fontWeight: 900, color: colors.success }}>Έσοδα</span>
              <Delta cur={totals.incomeTotal} prev={prevTotals?.incomeTotal} />
            </div>
            <div style={kpiVal}>{totals.incomeTotal.toLocaleString('el-GR')}€</div>
          </div>

          <div style={{ ...kpi, borderColor: '#ffe4e6', backgroundColor: '#fff1f2' }}>
            <div style={kpiHead}>
              <span style={{ fontWeight: 900, color: colors.danger }}>Έξοδα</span>
              <Delta cur={totals.expenseTotal} prev={prevTotals?.expenseTotal} />
            </div>
            <div style={kpiVal}>{totals.expenseTotal.toLocaleString('el-GR')}€</div>
          </div>

          <div style={{ ...kpi, borderColor: totals.cashflow >= 0 ? '#d1fae5' : '#ffe4e6', backgroundColor: totals.cashflow >= 0 ? '#f0fdf4' : '#fff1f2' }}>
            <div style={kpiHead}>
              <span style={{ fontWeight: 900, color: colors.primary }}>Cashflow</span>
              <Delta cur={totals.cashflow} prev={prevTotals?.cashflow} />
            </div>
            <div style={{ ...kpiVal, color: totals.cashflow >= 0 ? colors.success : colors.danger }}>
              {totals.cashflow >= 0 ? '+' : ''}
              {totals.cashflow.toLocaleString('el-GR')}€
            </div>
            <div style={miniNote}>Εισροές (Cash+Bank) - Εκροές (Cash+Bank)</div>
          </div>

          <div style={{ ...kpi, borderColor: totals.profit >= 0 ? '#d1fae5' : '#ffe4e6', backgroundColor: totals.profit >= 0 ? '#f0fdf4' : '#fff1f2' }}>
            <div style={kpiHead}>
              <span style={{ fontWeight: 900, color: colors.primary }}>Κέρδος</span>
              <Delta cur={totals.profit} prev={prevTotals?.profit} />
            </div>
            <div style={{ ...kpiVal, color: totals.profit >= 0 ? colors.success : colors.danger }}>
              {totals.profit >= 0 ? '+' : ''}
              {totals.profit.toLocaleString('el-GR')}€
            </div>
            <div style={miniNote}>Έσοδα - Έξοδα (Tips εκτός)</div>
          </div>

          <div style={{ ...kpi, borderColor: '#fde68a', backgroundColor: '#fffbeb' }}>
            <div style={kpiHead}>
              <span style={{ fontWeight: 900, color: '#92400e' }}>Tips</span>
              <span style={{ fontWeight: 900, color: '#92400e' }}>+</span>
            </div>
            <div style={kpiVal}>{totals.tipsTotal.toLocaleString('el-GR')}€</div>
          </div>
        </div>

        {/* CASH / BANK */}
        <div style={card}>
          <h3 style={sectionTitle}>Ταμείο & Τράπεζα</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <Tag label="Cash In" value={`${totals.cashIn.toLocaleString('el-GR')}€`} icon={Wallet} color="#d1fae5" />
            <Tag label="Cash Out" value={`${totals.cashOut.toLocaleString('el-GR')}€`} icon={Wallet} color="#ffe4e6" />
            <Tag label="Bank In" value={`${totals.bankIn.toLocaleString('el-GR')}€`} icon={CreditCard} color="#d1fae5" />
            <Tag label="Bank Out" value={`${totals.bankOut.toLocaleString('el-GR')}€`} icon={CreditCard} color="#ffe4e6" />
          </div>
          <div style={{ marginTop: 10, fontSize: 16, fontWeight: 900, color: colors.secondary }}>
            Tip: Αν “Κέρδος” είναι καλό αλλά Cashflow χαμηλό → συνήθως πιστώσεις/οφειλές.
          </div>
        </div>

        {/* OPEN BALANCES */}
        <div style={card}>
          <h3 style={sectionTitle}>Οφειλές & Απαιτήσεις (Credit κινήσεις)</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <div style={softBox}>
              <div style={softHead}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 900, color: colors.primary }}>
                  <AlertTriangle size={18} /> Οφειλές προς Προμηθευτές
                </span>
                <span style={{ fontWeight: 900, color: colors.danger }}>{openBalances.totalPayables.toLocaleString('el-GR')}€</span>
              </div>

              {openBalances.payablesList.length === 0 ? (
                <div style={softEmpty}>Δεν βρέθηκαν ανοιχτές οφειλές (με βάση credit κινήσεις).</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openBalances.payablesList.map((x: any) => (
                    <div key={x.id} style={lineRow}>
                      <span style={lineName}>{x.name}</span>
                      <span style={{ fontWeight: 900, color: colors.danger }}>{x.amount.toLocaleString('el-GR')}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={softBox}>
              <div style={softHead}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 900, color: colors.primary }}>
                  <Landmark size={18} /> Απαιτήσεις από Πηγές Εσόδων
                </span>
                <span style={{ fontWeight: 900, color: colors.warning }}>{openBalances.totalReceivables.toLocaleString('el-GR')}€</span>
              </div>

              {openBalances.receivablesList.length === 0 ? (
                <div style={softEmpty}>Δεν βρέθηκαν ανοιχτές απαιτήσεις (με βάση credit κινήσεις).</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openBalances.receivablesList.map((x: any) => (
                    <div key={x.id} style={lineRow}>
                      <span style={lineName}>{x.name}</span>
                      <span style={{ fontWeight: 900, color: colors.warning }}>{x.amount.toLocaleString('el-GR')}€</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={miniNote}>
            * Για να είναι “τέλειο”, πρέπει να καταγράφεις credit κινήσεις με `payment_method='Credit'` ή `is_credit=true`.
          </div>
        </div>

        {/* TOP LISTS */}
        <div style={card}>
          <h3 style={sectionTitle}>Top 10 (Πού πάει / από πού έρχεται το χρήμα)</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <TopBox title="Top Προμηθευτές" icon={ShoppingBag} items={topLists.suppliersTop} color={colors.danger} />
            <TopBox title="Top Προσωπικό" icon={Users} items={topLists.staffTop} color="#0ea5e9" />
            <TopBox title="Top Συντήρηση" icon={Wrench} items={topLists.maintenanceTop} color={colors.success} />
            <TopBox title="Top Πηγές Εσόδων" icon={Landmark} items={topLists.revenueTop} color={colors.success} />
          </div>
        </div>

        {/* INSIGHTS */}
        <div style={card}>
          <h3 style={sectionTitle}>Insights / Προειδοποιήσεις</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((x, i) => (
              <div
                key={i}
                style={{
                  ...softBox,
                  borderColor: x.type === 'warn' ? '#fde68a' : '#d1fae5',
                  backgroundColor: x.type === 'warn' ? '#fffbeb' : '#ecfdf5'
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: x.type === 'warn' ? '#92400e' : colors.success }}>
                  {x.type === 'warn' ? '⚠️ Προσοχή' : '✅ OK'}
                </div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: colors.primary }}>{x.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* DETAILED LIST */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={sectionTitle}>Κινήσεις Περιόδου</h3>
            <div style={{ fontSize: 16, fontWeight: 900, color: colors.secondary }}>{periodList.length} εγγραφές</div>
          </div>

          {loading ? (
            <div style={softEmpty}>Φόρτωση...</div>
          ) : periodList.length === 0 ? (
            <div style={softEmpty}>Δεν υπάρχουν κινήσεις.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {periodList.map((t: any) => {
                const name = getPartyName(t)
                const abs = Math.abs(Number(t.amount) || 0)

                const inc = isIncome(t)
                const tip = isTip(t)
                const exp = isExpense(t)

                const sign = inc || tip ? '+' : exp ? '-' : ''
                const bg = inc ? '#ecfdf5' : tip ? '#fffbeb' : '#fff1f2'
                const br = inc ? '#d1fae5' : tip ? '#fde68a' : '#ffe4e6'
                const tx = inc ? colors.success : tip ? '#92400e' : colors.danger

                return (
                  <div key={t.id ?? `${t.date}-${abs}-${t.created_at}`} style={listRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 900, color: colors.primary }}>{t.date}</div>
                      <div style={{ padding: '6px 10px', borderRadius: 999, backgroundColor: bg, border: `1px solid ${br}`, fontWeight: 900, color: tx }}>
                        {sign}
                        {abs.toLocaleString('el-GR')}€
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: colors.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </div>

                    {!!t.notes && <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: colors.secondary }}>{t.notes}</div>}

                    {!!t.payment_method && (
                      <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
                        <span style={{ fontWeight: 900 }}>Μέθοδος:</span> {String(t.payment_method)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 800, color: colors.secondary }}>
          * Αυτό είναι demo Owner Report. Αν θες, το “δένουμε” με τα δικά σου filters της Analysis και το κάνουμε ένα ενιαίο dashboard.
        </div>
      </div>
    </div>
  )
}

function TopBox({ title, icon: Icon, items, color }: any) {
  return (
    <div style={softBox}>
      <div style={{ ...softHead, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 900, color: colors.primary }}>
          {Icon ? <Icon size={18} /> : null} {title}
        </span>
      </div>

      {(!items || items.length === 0) ? (
        <div style={softEmpty}>Δεν υπάρχουν δεδομένα.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((x: any) => (
            <div key={x.name} style={lineRow}>
              <span style={lineName}>{x.name}</span>
              <span style={{ fontWeight: 900, color }}>{(Number(x.amount) || 0).toLocaleString('el-GR')}€</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Styles
const wrap: any = {
  backgroundColor: colors.background,
  minHeight: '100%',
  padding: 20,
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  overflowY: 'auto',
  fontSize: 16,
  touchAction: 'pan-y',
  display: 'block'
}

const header: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const logo: any = { width: 42, height: 42, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }
const h1: any = { margin: 0, fontSize: 16, fontWeight: 900, color: colors.primary }
const sub: any = { margin: 0, fontSize: 16, fontWeight: 800, color: colors.secondary }
const back: any = { textDecoration: 'none', width: 40, height: 40, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: colors.secondary }

const card: any = { backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 18, padding: 16, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }
const grid: any = { display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }
const kpi: any = { borderRadius: 18, border: `1px solid ${colors.border}`, padding: 16 }
const kpiHead: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const kpiVal: any = { marginTop: 10, fontSize: 28, fontWeight: 900, color: colors.primary }
const miniNote: any = { marginTop: 8, fontSize: 16, fontWeight: 800, color: colors.secondary }

const lbl: any = { fontSize: 16, fontWeight: 900, color: colors.secondary, marginBottom: 8, display: 'block' }
const input: any = { width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.background, fontSize: 16, fontWeight: 800, color: colors.primary }
const btn: any = { flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 16, fontWeight: 900, cursor: 'pointer' }

const sectionTitle: any = { margin: 0, fontSize: 16, fontWeight: 900, color: colors.primary }

const softBox: any = { padding: 14, borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.background }
const softHead: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }
const softEmpty: any = { marginTop: 8, fontSize: 16, fontWeight: 800, color: colors.secondary }

const lineRow: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }
const lineName: any = { fontSize: 16, fontWeight: 900, color: colors.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

const listRow: any = { padding: 14, borderRadius: 16, backgroundColor: colors.background, border: `1px solid ${colors.border}` }
const pill: any = { padding: 12, borderRadius: 16, border: `1px solid ${colors.border}` }

export default function OwnerReportPage() {
  return (
    <main>
      <Suspense fallback={<div style={{ fontSize: 16, padding: 20 }}>Φόρτωση...</div>}>
        <OwnerReportContent />
      </Suspense>
    </main>
  )
}