'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfMonth, endOfMonth, format, parseISO, subYears, 
  startOfWeek, endOfWeek, isWithinInterval, startOfYear, endOfYear 
} from 'date-fns'
import { el } from 'date-fns/locale'
// Εισαγωγή Recharts για μελλοντική χρήση γραφημάτων
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // --- TURBO LOAD DATA (Parallel Fetching) ---
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      // ΠΑΡΑΛΛΗΛΗ ΦΟΡΤΩΣΗ: Προφίλ και Συναλλαγές μαζί
      const [profileResult, transResult] = await Promise.all([
        supabase.from('profiles').select('store_id').eq('id', session.user.id).single(),
        supabase.from('transactions')
          .select('*, suppliers(name)')
          .eq('store_id', session.user.user_metadata?.store_id || '') // Προσπάθεια από metadata για ταχύτητα
          .order('date', { ascending: true })
      ])

      // Αν δεν βρήκε το store_id από metadata, το παίρνει από το profile result
      let finalTransactions = transResult.data
      if (!finalTransactions && profileResult.data?.store_id) {
        const { data: retryData } = await supabase.from('transactions')
          .select('*, suppliers(name)')
          .eq('store_id', profileResult.data.store_id)
          .order('date', { ascending: true })
        finalTransactions = retryData
      }

      if (finalTransactions) setTransactions(finalTransactions)
    } catch (err) { 
      console.error("Analysis Load Error:", err) 
    } finally { 
      setLoading(false) 
    }
  }, [router])

  // --- RESILIENCE: Αυτόματο "ξύπνημα" της σελίδας ---
  useEffect(() => {
    loadData()

    // Φρεσκάρισμα όταν ο χρήστης επιστρέφει στην καρτέλα/κινητό
    const handleFocus = () => loadData(true)
    window.addEventListener('focus', handleFocus)
    
    // Real-time listener για αλλαγές στη βάση
    const channel = supabase.channel('analysis-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => loadData(true))
      .subscribe()

    return () => {
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
  }, [loadData])

  async function handleDelete(id: string) {
    if (!confirm('Οριστική διαγραφή συναλλαγής;')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) loadData(true);
    else alert(error.message);
  }

  // --- ΥΠΟΛΟΓΙΣΜΟΣ STATS (Διατήρηση όλης της αρχικής λογικής) ---
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

    const currentData = transactions.filter(t => isWithinInterval(parseISO(t.date), currentRange))
    const prevData = transactions.filter(t => isWithinInterval(parseISO(t.date), lastYearRange))

    const incomeTransactions = currentData.filter(t => t.type === 'income');
    const incomeTotal = incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
    
    const noReceiptData = incomeTransactions.filter(t => 
        t.category?.includes('Σήμανση') || t.category?.includes('Απόδειξη') || t.notes?.toUpperCase().includes('ΧΩΡΙΣ')
    );
    const noReceiptAmount = noReceiptData.reduce((acc, t) => acc + Number(t.amount), 0);

    const officialIncome = incomeTransactions.filter(t => !noReceiptData.includes(t));
    const incomeCash = officialIncome.filter(t => t.method?.includes('Μετρητά')).reduce((acc, t) => acc + Number(t.amount), 0);
    const incomeCard = officialIncome.filter(t => t.method?.includes('Κάρτα') || t.method?.includes('POS') || t.method?.includes('Τράπεζα')).reduce((acc, t) => acc + Number(t.amount), 0);

    const expenseTransactions = currentData.filter(t => t.type === 'expense' || t.category === 'pocket');
    const expenseTotal = expenseTransactions.filter(t => t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0);
    const currentPaidTotal = expenseTransactions.filter(t => t.category !== 'pocket' && !t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0);
    const currentCreditTotal = expenseTransactions.filter(t => t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0);

    const currentTotalValue = view === 'income' ? incomeTotal : expenseTotal;

    const prevTotal = prevData
        .filter(t => (view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.category === 'pocket')))
        .filter(t => t.category !== 'pocket')
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const diff = currentTotalValue - prevTotal;
    const percent = prevTotal !== 0 ? (diff / prevTotal) * 100 : 0;

    return { 
        currentTotal: currentTotalValue, prevTotal, percent, 
        currentViewData: currentData.filter(t => (view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.category === 'pocket'))),
        incomeTotal, incomeCash, incomeCard, noReceiptAmount,
        currentPaidTotal, currentCreditTotal 
    }
  }, [transactions, period, selectedDate, view])

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

      {/* VIEW SELECTOR */}
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

      {/* HERO CARD (Αυτόματη αλλαγή χρώματος βάσει view) */}
      <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
        <p style={labelMicro}>{view === 'income' ? 'ΚΑΘΑΡΟΣ ΤΖΙΡΟΣ ΠΕΡΙΟΔΟΥ' : 'ΣΥΝΟΛΙΚΕΣ ΑΓΟΡΕΣ & ΠΙΣΤΩΣΕΙΣ'}</p>
        <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{stats.currentTotal.toLocaleString('el-GR')}€</h2>
        
        {view === 'income' && stats.incomeTotal > 0 && (
            <div style={percGrid}>
                <div style={percBox}>
                    <span style={percLabel}>ΜΕΤΡΗΤΑ</span>
                    <span style={percValue}>{((stats.incomeCash / stats.incomeTotal) * 100).toFixed(1)}%</span>
                </div>
                <div style={percBox}>
                    <span style={percLabel}>ΚΑΡΤΑ</span>
                    <span style={percValue}>{((stats.incomeCard / stats.incomeTotal) * 100).toFixed(1)}%</span>
                </div>
                <div style={percBox}>
                    <span style={percLabel}>ΧΩΡΙΣ ΣΗΜ.</span>
                    <span style={percValue}>{((stats.noReceiptAmount / stats.incomeTotal) * 100).toFixed(1)}%</span>
                </div>
            </div>
        )}

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

      {/* LIST OF TRANSACTIONS */}
      <div style={listWrapper}>
        <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase' }}>Αναλυτικές Κινήσεις</p>
        {loading ? <p style={{textAlign:'center', padding:'20px', fontWeight:'700'}}>Συγχρονισμός...</p> : (
            <>
                {stats.currentViewData.map(t => (
                  <div key={t.id} style={rowStyle}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' }}>
                        {t.suppliers?.name || t.notes || t.category?.toUpperCase() || "ΕΣΟΔΟ"}
                        {t.is_credit && view === 'expenses' && <span style={creditBadge}>ΠΙΣΤΩΣΗ</span>}
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
                {stats.currentViewData.length === 0 && <p style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>Δεν βρέθηκαν κινήσεις.</p>}
            </>
        )}
      </div>
    </div>
  )
}

// --- STYLES (Διατηρήθηκαν όλα τα αρχικά) ---
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '18px', padding: '5px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '14px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const filterBar: any = { display: 'flex', gap: '10px', marginBottom: '15px' };
const selectStyle: any = { flex: 1, padding: '12px', borderRadius: '15px', border: '1px solid #f1f5f9', fontWeight: '800', outline: 'none', backgroundColor: 'white' };
const calendarCard: any = { position: 'relative', width: '50px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dateInput: any = { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' };
const heroCard: any = { padding: '30px 20px', borderRadius: '32px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' };
const labelMicro: any = { fontSize: '10px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' };
const percGrid: any = { display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' };
const percBox: any = { display: 'flex', flexDirection: 'column', gap: '2px' };
const percLabel: any = { fontSize: '8px', fontWeight: '900', opacity: 0.6 };
const percValue: any = { fontSize: '14px', fontWeight: '900' };
const listWrapper: any = { backgroundColor: 'white', padding: '22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f8fafc' };
const creditBadge: any = { fontSize: '8px', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '6px', marginLeft: '8px', fontWeight: '900' };
const deleteBtnSmall: any = { background: 'none', border: 'none', cursor: 'pointer', opacity: 0.2 };

export default function AnalysisPage() {
  return <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}><Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense></main>
}