'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  isWithinInterval, format, parseISO
} from 'date-fns'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from 'recharts'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pocketTotal, setPocketTotal] = useState(0)
  const [isZExpanded, setIsZExpanded] = useState(false)
  const [permissions, setPermissions] = useState({ role: 'user', store_id: null as string | null })

  useEffect(() => {
    loadAnalysisData()
  }, [])

  async function loadAnalysisData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const [profileRes, transRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('transactions').select('*, suppliers(name)').order('date', { ascending: false })
      ])

      if (profileRes.data) {
        const p = profileRes.data
        setPermissions({ role: p.role, store_id: p.store_id })
        const storeData = transRes.data?.filter(t => t.store_id === p.store_id) || []
        setTransactions(storeData)
        setPocketTotal(storeData.filter(t => t.category === 'pocket').reduce((acc, t) => acc + Number(t.amount), 0))
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const filteredData = useMemo(() => {
    const now = new Date()
    return transactions.filter(t => {
      const d = parseISO(t.date)
      if (period === 'custom_day') return t.date.split('T')[0] === selectedDate
      if (period === 'week') return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) })
      if (period === 'month') return d >= startOfMonth(now) && d <= endOfMonth(now)
      if (period === 'year') return d.getFullYear() === now.getFullYear()
      return true
    })
  }, [transactions, period, selectedDate])

  const currentViewData = filteredData.filter(t => (view === 'income' ? t.type === 'income' : t.type === 'expense' || t.category === 'pocket'))
  const zEntries = currentViewData.filter(t => t.category === 'Εσοδα Ζ')
  const regularEntries = currentViewData.filter(t => t.category !== 'Εσοδα Ζ')
  const totalAmount = currentViewData.filter(t => t.category !== 'pocket' && !t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)

  const zStats = {
    total: zEntries.reduce((acc, t) => acc + Number(t.amount), 0),
    cash: zEntries.filter(t => t.method === 'Μετρητά').reduce((acc, t) => acc + Number(t.amount), 0),
    pos: zEntries.filter(t => t.method === 'Τράπεζα' || t.method === 'Κάρτα').reduce((acc, t) => acc + Number(t.amount), 0),
    noTax: zEntries.filter(t => t.method === 'Χωρίς Απόδειξη').reduce((acc, t) => acc + Number(t.amount), 0)
  }

  const chartData = useMemo(() => {
    if (period !== 'month') return []
    const days: { [key: string]: number } = {}
    currentViewData.forEach(t => {
      const day = format(parseISO(t.date), 'dd')
      days[day] = (days[day] || 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(days).map(([name, amount]) => ({ name, amount })).sort((a, b) => Number(a.name) - Number(b.name))
  }, [currentViewData, period])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>📊</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' }}>Ανάλυση</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Insights & Statistics</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* VIEW SELECTOR TABS */}
      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      {/* PERIOD & CALENDAR */}
      <div style={filterGrid}>
         <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
            <option value="month">Προβολή: Μήνας</option>
            <option value="custom_day">Προβολή: Ημέρα</option>
            <option value="week">Προβολή: Εβδομάδα</option>
            <option value="year">Προβολή: Έτος</option>
          </select>
          {period === 'custom_day' && (
            <div style={{ position: 'relative' }}>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />
              <span style={calendarIcon}>📅</span>
            </div>
          )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8', fontWeight: '800' }}>ΥΠΟΛΟΓΙΣΜΟΣ ΔΕΔΟΜΕΝΩΝ...</div>
      ) : (
        <>
          {/* MAIN HERO CARD */}
          <div style={{...mainCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
            <p style={labelMicro}>{view === 'income' ? 'ΚΑΘΑΡΟΣ ΤΖΙΡΟΣ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ'}</p>
            <h2 style={{ fontSize: '42px', fontWeight: '900', margin: '8px 0' }}>{totalAmount.toLocaleString('el-GR')}€</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '10px' }}>
                <span style={miniBadge}>👛 ΤΣΕΠΗ: {pocketTotal}€</span>
            </div>
          </div>

          {/* VISUAL CHART */}
          {period === 'month' && chartData.length > 0 && (
            <div style={chartCard}>
              <p style={chartTitle}>ΔΙΑΚΥΜΑΝΣΗ ΜΗΝΑ (€)</p>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} dy={10} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 15px rgba(0,0,0,0.05)'}} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={12}>
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={view === 'income' ? '#10b981' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* GROUPED Z ACCORDION */}
          {view === 'income' && zStats.total > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <div onClick={() => setIsZExpanded(!isZExpanded)} style={zHeaderStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '900', margin: 0, fontSize: '15px', letterSpacing: '0.5px' }}>📟 ΣΥΝΟΛΟ Ζ ΠΕΡΙΟΔΟΥ</p>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{zEntries.length} Καταχωρήσεις</span>
                </div>
                <p style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>+{zStats.total.toFixed(2)}€</p>
              </div>
              {isZExpanded && (
                <div style={zDetailPanel}>
                  <div style={zRow}><span>💳 Κάρτα/POS</span><b style={{color: '#1e293b'}}>{zStats.pos.toFixed(2)}€</b></div>
                  <div style={zRow}><span>💵 Μετρητά</span><b style={{color: '#1e293b'}}>{zStats.cash.toFixed(2)}€</b></div>
                  {zStats.noTax > 0 && <div style={zRow}><span>🤫 Χωρίς Απόδειξη</span><b style={{color: '#1e293b'}}>{zStats.noTax.toFixed(2)}€</b></div>}
                </div>
              )}
            </div>
          )}

          {/* DATA LIST */}
          <p style={sectionLabel}>Αναλυτική Λίστα</p>
          <div style={listWrapper}>
            {regularEntries.length > 0 ? regularEntries.map(t => (
              <div key={t.id} style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b', margin: 0 }}>{t.suppliers?.name || t.notes || t.category.toUpperCase()}</p>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>{format(parseISO(t.date), 'dd/MM/yyyy')} • {t.method}</span>
                </div>
                <div style={{ fontWeight: '900', fontSize: '16px', color: t.category === 'pocket' ? '#8b5cf6' : (t.type === 'income' ? '#10b981' : '#ef4444') }}>
                  {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                </div>
              </div>
            )) : <div style={{textAlign:'center', padding:'40px', color:'#94a3b8', fontSize:'13px'}}>Δεν βρέθηκαν κινήσεις για αυτή την περίοδο.</div>}
          </div>
        </>
      )}
    </div>
  )
}

// STYLES (ANY FOR TS)
const logoBoxStyle: any = { width: '45px', height: '45px', backgroundColor: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '20px', fontWeight: 'bold' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '18px', padding: '5px', marginBottom: '20px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '900', fontSize: '13px', cursor: 'pointer', transition: '0.3s' };
const filterGrid: any = { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' };
const selectStyle: any = { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', outline: 'none', fontWeight: '800', backgroundColor: 'white', fontSize: '14px', appearance: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const dateInputStyle: any = { ...selectStyle, paddingLeft: '45px' };
const calendarIcon: any = { position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px' };
const mainCard: any = { padding: '35px 20px', borderRadius: '32px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' };
const labelMicro: any = { fontSize: '11px', fontWeight: '900', opacity: 0.6, letterSpacing: '1.5px', textTransform: 'uppercase' };
const miniBadge: any = { backgroundColor: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' };
const chartCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const chartTitle: any = { fontSize: '10px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px', textAlign: 'center', marginBottom: '20px' };
const zHeaderStyle: any = { backgroundColor: '#0f172a', color: 'white', padding: '22px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 10px 15px rgba(15,23,42,0.1)' };
const zDetailPanel: any = { backgroundColor: 'white', padding: '10px 22px 22px', borderRadius: '0 0 24px 24px', border: '2px solid #0f172a', borderTop: 'none', marginTop: '-15px' };
const zRow: any = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', fontSize: '14px', fontWeight: '700', color: '#64748b' };
const sectionLabel: any = { fontSize: '12px', fontWeight: '900', color: '#0f172a', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const listWrapper: any = { backgroundColor: 'white', padding: '10px 20px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #f8fafc' };

export default function AnalysisPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense>
    </main>
  )
}