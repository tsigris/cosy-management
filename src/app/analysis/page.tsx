'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfMonth, endOfMonth, format, parseISO, subYears, 
  startOfWeek, endOfWeek, startOfYear, endOfYear, isSameDay
} from 'date-fns'
import { el } from 'date-fns/locale'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', session.user.id).single()
      if (profile?.store_id) {
        const { data: transData } = await supabase.from('transactions')
          .select('*, suppliers(name)')
          .eq('store_id', profile.store_id)
          .order('date', { ascending: false })
        if (transData) setTransactions(transData)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  const stats = useMemo(() => {
    const baseDate = parseISO(selectedDate)
    const lastYearDate = subYears(baseDate, 1)
    
    // Καθορισμός ορίων περιόδου
    let start: Date, end: Date;
    let pStart: Date, pEnd: Date;

    if (period === 'custom_day') {
      start = baseDate; end = baseDate;
      pStart = lastYearDate; pEnd = lastYearDate;
    } else if (period === 'week') {
      start = startOfWeek(baseDate, { weekStartsOn: 1 }); end = endOfWeek(baseDate);
      pStart = startOfWeek(lastYearDate, { weekStartsOn: 1 }); pEnd = endOfWeek(lastYearDate);
    } else if (period === 'year') {
      start = startOfYear(baseDate); end = endOfYear(baseDate);
      pStart = startOfYear(lastYearDate); pEnd = endOfYear(lastYearDate);
    } else {
      start = startOfMonth(baseDate); end = endOfMonth(baseDate);
      pStart = startOfMonth(lastYearDate); pEnd = endOfMonth(lastYearDate);
    }

    // Φιλτράρισμα με String σύγκριση (πιο αξιόπιστο για Supabase dates)
    const sStr = format(start, 'yyyy-MM-dd');
    const eStr = format(end, 'yyyy-MM-dd');
    const psStr = format(pStart, 'yyyy-MM-dd');
    const peStr = format(pEnd, 'yyyy-MM-dd');

    const currentData = transactions.filter(t => t.date >= sStr && t.date <= eStr);
    const prevData = transactions.filter(t => t.date >= psStr && t.date <= peStr);

    const incomeTransactions = currentData.filter(t => t.type === 'income');
    const incomeTotal = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const prevIncomeTotal = prevData.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
    
    const noReceiptAmount = incomeTransactions
        .filter(t => t.notes?.toUpperCase().includes('ΧΩΡΙΣ') || t.notes?.toUpperCase().includes('ΣΗΜΑΝΣΗ'))
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const officialIncome = incomeTransactions.filter(t => !t.notes?.toUpperCase().includes('ΧΩΡΙΣ'));
    const incomeCash = officialIncome.filter(t => t.method?.includes('Μετρητά')).reduce((acc, t) => acc + Number(t.amount), 0);
    const incomeCard = officialIncome.filter(t => t.method?.includes('Κάρτα') || t.method?.includes('POS') || t.method?.includes('Τράπεζα')).reduce((acc, t) => acc + Number(t.amount), 0);

    const expenseTotal = currentData.filter(t => (t.type === 'expense' || t.category === 'pocket') && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0);
    const prevExpenseTotal = prevData.filter(t => (t.type === 'expense' || t.category === 'pocket') && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0);

    // ΟΜΑΔΟΠΟΙΗΣΗ Ζ
    const listData: any[] = [];
    const zGroups: any = {};

    currentData.forEach(t => {
        if (view === 'income' && t.type === 'income') {
            if (t.category === 'Εσοδα Ζ') {
                if (!zGroups[t.date]) zGroups[t.date] = { id: 'z-'+t.date, isZ: true, date: t.date, amount: 0, details: [] };
                zGroups[t.date].amount += Number(t.amount);
                zGroups[t.date].details.push(t);
            } else { listData.push(t); }
        } else if (view === 'expenses' && (t.type === 'expense' || t.category === 'pocket')) {
            listData.push(t);
        }
    });

    const finalDisplayData = [...listData, ...Object.values(zGroups)].sort((a,b) => b.date.localeCompare(a.date));

    const currentTarget = view === 'income' ? incomeTotal : expenseTotal;
    const prevTarget = view === 'income' ? prevIncomeTotal : prevExpenseTotal;
    const percent = prevTarget !== 0 ? ((currentTarget - prevTarget) / prevTarget) * 100 : 0;

    return { currentTotal: currentTarget, prevTotal: prevTarget, percent, incomeTotal, incomeCash, incomeCard, noReceiptAmount, finalDisplayData };
  }, [transactions, period, selectedDate, view])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif', paddingBottom: '100px' }}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>📊</div>
          <h1 style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>Ανάλυση</h1>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      <div style={filterBar}>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
          <option value="month">Προβολή: Μήνας</option>
          <option value="custom_day">Προβολή: Ημέρα</option>
          <option value="week">Προβολή: Εβδομάδα</option>
          <option value="year">Προβολή: Έτος</option>
        </select>
        <div style={calendarCard}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={dateInput} />
            <span style={{fontSize:'12px', fontWeight:'900'}}>{format(parseISO(selectedDate), 'dd/MM')} 📅</span>
        </div>
      </div>

      <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
        <p style={labelMicro}>{view === 'income' ? 'ΚΑΘΑΡΟΣ ΤΖΙΡΟΣ ΠΕΡΙΟΔΟΥ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ'}</p>
        <h2 style={{ fontSize: '36px', fontWeight: '900', margin: '5px 0' }}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>
        {view === 'income' && stats.incomeTotal > 0 && (
            <div style={percGrid}>
                <div style={percBox}><span style={percLabel}>ΜΕΤΡΗΤΑ</span><span style={percValue}>{stats.incomeCash.toFixed(0)}€</span></div>
                <div style={percBox}><span style={percLabel}>ΚΑΡΤΑ</span><span style={percValue}>{stats.incomeCard.toFixed(0)}€</span></div>
                <div style={percBox}><span style={percLabel}>ΧΩΡΙΣ ΣΗΜ.</span><span style={percValue}>{stats.noReceiptAmount.toFixed(0)}€</span></div>
            </div>
        )}
        <div style={{ marginTop: '15px', fontSize: '11px', fontWeight: '700', color: stats.percent >= 0 ? '#4ade80' : '#f87171' }}>
            {stats.percent >= 0 ? '↑' : '↓'} {Math.abs(stats.percent).toFixed(1)}% <span style={{opacity:0.6, color:'white', marginLeft: '5px'}}>vs Πέρυσι ({stats.prevTotal.toFixed(0)}€)</span>
        </div>
      </div>

      <div style={listWrapper}>
        <p style={listTitle}>Αναλυτικές Κινήσεις</p>
        {loading ? <p style={{textAlign:'center', padding:'20px'}}>Φόρτωση...</p> : (
            <>
                {stats.finalDisplayData.map((item: any) => (
                  <div key={item.id} style={item.isZ ? zRowStyle : rowStyle}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' }}>
                        {item.isZ ? '📟 ΚΛΕΙΣΙΜΟ Ζ (ΟΜΑΔΟΠΟΙΗΜΕΝΟ)' : (item.suppliers?.name || item.notes || item.category)}
                      </p>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>
                        {format(parseISO(item.date), 'dd MMM', { locale: el })} {item.isZ ? '' : `• ${item.method}`}
                      </span>
                      {item.isZ && (
                        <div style={{fontSize: '10px', color: '#64748b', marginTop: '4px', fontWeight: '700'}}>
                           {item.details.map((d:any) => `${d.method.replace(' (Ζ)','')}: ${d.amount}€`).join(' | ')}
                        </div>
                      )}
                    </div>
                    <p style={{ fontWeight: '900', fontSize: '15px', color: view === 'income' ? '#10b981' : '#ef4444', margin: 0 }}>
                      {view === 'income' ? '+' : '-'}{item.amount.toFixed(2)}€
                    </p>
                  </div>
                ))}
                {stats.finalDisplayData.length === 0 && <p style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>Κανένα αποτέλεσμα.</p>}
            </>
        )}
      </div>
    </div>
  )
}

const headerStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingTop: '10px' };
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '4px', marginBottom: '15px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const filterBar: any = { display: 'flex', gap: '10px', marginBottom: '15px' };
const selectStyle: any = { flex: 1.5, padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: '800', backgroundColor: 'white', fontSize: '12px' };
const calendarCard: any = { flex: 1, position: 'relative', backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dateInput: any = { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' };
const heroCard: any = { padding: '30px 20px', borderRadius: '30px', color: 'white', textAlign: 'center', marginBottom: '20px' };
const labelMicro: any = { fontSize: '9px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' };
const percGrid: any = { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' };
const percBox: any = { display: 'flex', flexDirection: 'column', gap: '2px' };
const percLabel: any = { fontSize: '7px', fontWeight: '900', opacity: 0.6 };
const percValue: any = { fontSize: '12px', fontWeight: '900' };
const listWrapper: any = { backgroundColor: 'white', padding: '22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const listTitle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f8fafc' };
const zRowStyle: any = { ...rowStyle, backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '15px', margin: '6px 0', borderBottom: 'none' };

export default function AnalysisPage() {
  return <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}