'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfMonth, endOfMonth, format, parseISO, eachDayOfInterval, 
  subYears, startOfWeek, endOfWeek, isWithinInterval, startOfYear, endOfYear 
} from 'date-fns'
import { el } from 'date-fns/locale'
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [isZExpanded, setIsZExpanded] = useState(false)

  async function loadData() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      if (profile?.store_id) {
        const { data } = await supabase.from('transactions')
          .select('*, suppliers(name)')
          .eq('store_id', profile.store_id)
          .order('date', { ascending: true })
        if (data) setTransactions(data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Οριστική διαγραφή;')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) loadData();
  }

  // --- ΥΠΟΛΟΓΙΣΜΟΣ ΣΤΑΤΙΣΤΙΚΩΝ ---
  const stats = useMemo(() => {
    const now = parseISO(selectedDate)
    const lastYear = subYears(now, 1)
    let currentRange = { start: startOfMonth(now), end: endOfMonth(now) }
    let lastYearRange = { start: startOfMonth(lastYear), end: endOfMonth(lastYear) }

    if (period === 'custom_day') {
        currentRange = { start: now, end: now };
        lastYearRange = { start: lastYear, end: lastYear };
    } else if (period === 'week') {
        currentRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now) };
        lastYearRange = { start: startOfWeek(lastYear, { weekStartsOn: 1 }), end: endOfWeek(lastYear) };
    } else if (period === 'year') {
        currentRange = { start: startOfYear(now), end: endOfYear(now) };
        lastYearRange = { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }

    const currentData = transactions.filter(t => {
        const d = parseISO(t.date)
        if (period === 'custom_day') return t.date.split('T')[0] === selectedDate
        return isWithinInterval(d, currentRange)
    })

    const prevData = transactions.filter(t => {
        const d = parseISO(t.date)
        if (period === 'custom_day') return t.date.split('T')[0] === format(lastYear, 'yyyy-MM-dd')
        return isWithinInterval(d, lastYearRange)
    })

    const currentViewData = currentData.filter(t => (view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.category === 'pocket')))
    const prevViewData = prevData.filter(t => (view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.category === 'pocket')))

    const currentTotal = currentViewData.filter(t => t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)
    const prevTotal = prevViewData.filter(t => t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)

    // ΑΝΑΛΥΣΗ ΕΣΟΔΩΝ (Μετρητά, Κάρτα, Χωρίς Απόδειξη)
    const incData = currentViewData.filter(t => t.type === 'income');
    const incomeCash = incData.filter(t => t.method === 'Μετρητά').reduce((acc, t) => acc + Number(t.amount), 0);
    const incomeCard = incData.filter(t => t.method !== 'Μετρητά').reduce((acc, t) => acc + Number(t.amount), 0);
    const noReceipt = incData.filter(t => t.category === 'Χωρίς Απόδειξη').reduce((acc, t) => acc + Number(t.amount), 0);

    // ΑΝΑΛΥΣΗ ΕΞΟΔΩΝ
    const currentPaidTotal = currentViewData.filter(t => t.category !== 'pocket' && !t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
    const currentCreditTotal = currentViewData.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)

    const diff = currentTotal - prevTotal
    const percent = prevTotal !== 0 ? (diff / prevTotal) * 100 : 0

    return { 
        currentTotal, prevTotal, percent, currentViewData, 
        incomeCash, incomeCard, noReceipt,
        currentPaidTotal, currentCreditTotal 
    }
  }, [transactions, period, selectedDate, view])

  const chartData = useMemo(() => {
    if (period !== 'month') return []
    const days = eachDayOfInterval({ start: startOfMonth(parseISO(selectedDate)), end: endOfMonth(parseISO(selectedDate)) })
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayTotal = transactions
        .filter(t => t.date.split('T')[0] === dayStr && (view === 'income' ? t.type === 'income' : t.type === 'expense'))
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
      return { name: format(day, 'dd'), amount: dayTotal }
    })
  }, [transactions, view, period, selectedDate])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', paddingBottom: '100px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>📊</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '20px', margin: 0, color: '#0f172a' }}>Ανάλυση</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>ΣΤΑΤΙΣΤΙΚΑ ΕΠΙΧΕΙΡΗΣΗΣ</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* TABS */}
      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      {/* FILTER BAR */}
      <div style={filterBar}>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
          <option value="month">Προβολή: Μήνας</option>
          <option value="custom_day">Προβολή: Ημέρα</option>
          <option value="week">Προβολή: Εβδομάδα</option>
          <option value="year">Προβολή: Έτος</option>
        </select>
        <div style={calendarCard}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={dateInput} />
            <span style={{fontSize:'16px'}}>📅</span>
        </div>
      </div>

      {/* HERO CARD - ΑΝΑΛΥΣΗ ΜΕ ΠΟΣΟΣΤΑ */}
      <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
        <p style={labelMicro}>{view === 'income' ? 'ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ'}</p>
        <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>
        
        {/* ΕΔΩ ΜΠΑΙΝΕΙ Η ΑΝΑΛΥΣΗ ΕΣΟΔΩΝ ΜΕ ΠΟΣΟΣΤΑ */}
        {view === 'income' && stats.currentTotal > 0 && (
            <div style={percGrid}>
                <div style={percBox}>
                    <span style={percLabel}>ΜΕΤΡΗΤΑ</span>
                    <span style={percValue}>{((stats.incomeCash / stats.currentTotal) * 100).toFixed(0)}%</span>
                </div>
                <div style={percBox}>
                    <span style={percLabel}>ΚΑΡΤΑ</span>
                    <span style={percValue}>{((stats.incomeCard / stats.currentTotal) * 100).toFixed(0)}%</span>
                </div>
                <div style={percBox}>
                    <span style={percLabel}>ΧΩΡΙΣ ΑΠΟΔ.</span>
                    <span style={percValue}>{((stats.noReceipt / stats.currentTotal) * 100).toFixed(0)}%</span>
                </div>
            </div>
        )}

        {/* ΑΝΑΛΥΣΗ ΕΞΟΔΩΝ */}
        {view === 'expenses' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', opacity: 0.8 }}>ΠΛΗΡΩΜΕΝΑ: {stats.currentPaidTotal.toFixed(0)}€</div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#fca5a5' }}>ΠΙΣΤΩΣΕΙΣ: {stats.currentCreditTotal.toFixed(0)}€</div>
            </div>
        )}

        <div style={{ marginTop: '15px', fontSize: '12px', fontWeight: '700', color: stats.percent >= 0 ? '#4ade80' : '#f87171' }}>
            {stats.percent >= 0 ? '↑' : '↓'} {Math.abs(stats.percent).toFixed(1)}% <span style={{opacity:0.6, color:'white', marginLeft: '5px'}}>vs Πέρυσι ({stats.prevTotal.toFixed(0)}€)</span>
        </div>
      </div>

      {/* GRAPH */}
      {period === 'month' && chartData.length > 0 && (
        <div style={chartCard}>
          <p style={chartTitle}>ΔΙΑΚΥΜΑΝΣΗ ΜΗΝΑ (€)</p>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                <Tooltip contentStyle={{borderRadius:'16px', border:'none'}} />
                <Area type="monotone" dataKey="amount" stroke={view === 'income' ? '#10b981' : '#ef4444'} strokeWidth={3} fill={view === 'income' ? '#dcfce7' : '#fee2e2'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* LIST WITH DELETE */}
      <div style={listWrapper}>
        <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' }}>Αναλυτικές Κινήσεις</p>
        {stats.currentViewData.map(t => (
          <div key={t.id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' }}>
                {t.suppliers?.name || t.notes || t.category.toUpperCase()}
                {t.is_credit && <span style={creditBadge}>ΠΙΣΤΩΣΗ</span>}
              </p>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                {format(parseISO(t.date), 'dd MMM', { locale: el })} • {t.method}
              </span>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <p style={{ fontWeight: '900', fontSize: '16px', color: view === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                  {view === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                </p>
                <button onClick={() => handleDelete(t.id)} style={deleteBtnSmall}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '18px', padding: '5px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '14px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const filterBar: any = { display: 'flex', gap: '10px', marginBottom: '15px' };
const selectStyle: any = { flex: 1, padding: '12px', borderRadius: '15px', border: '1px solid #f1f5f9', fontWeight: '800', outline: 'none' };
const calendarCard: any = { position: 'relative', width: '50px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dateInput: any = { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' };
const heroCard: any = { padding: '30px 20px', borderRadius: '32px', color: 'white', textAlign: 'center', marginBottom: '20px' };
const labelMicro: any = { fontSize: '10px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' };
const percGrid: any = { display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' };
const percBox: any = { display: 'flex', flexDirection: 'column', gap: '2px' };
const percLabel: any = { fontSize: '8px', fontWeight: '900', opacity: 0.6 };
const percValue: any = { fontSize: '14px', fontWeight: '900' };
const chartCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '20px' };
const chartTitle: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', textAlign: 'center', marginBottom: '15px' };
const listWrapper: any = { backgroundColor: 'white', padding: '22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f8fafc' };
const creditBadge: any = { fontSize: '8px', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '6px', marginLeft: '8px', fontWeight: '900' };
const deleteBtnSmall: any = { background: 'none', border: 'none', cursor: 'pointer', opacity: 0.2 };

export default function AnalysisPage() {
  return <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}