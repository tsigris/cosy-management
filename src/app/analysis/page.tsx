'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startOfMonth, endOfMonth, format, parseISO, eachDayOfInterval } from 'date-fns'
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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('store_id').eq('id', user.id).single()
        if (profile?.store_id) {
          const { data } = await supabase.from('transactions').select('*, suppliers(name)').eq('store_id', profile.store_id).order('date', { ascending: true })
          if (data) setTransactions(data)
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    loadData()
  }, [])

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      if (period === 'custom_day') return t.date.split('T')[0] === selectedDate
      if (period === 'month') {
        const d = parseISO(t.date)
        const now = new Date()
        return d >= startOfMonth(now) && d <= endOfMonth(now)
      }
      return true
    })
  }, [transactions, period, selectedDate])

  const currentViewData = filteredData.filter(t => (view === 'income' ? t.type === 'income' : t.type === 'expense' || t.category === 'pocket'))
  const totalAmount = currentViewData.filter(t => t.category !== 'pocket' && !t.is_credit).reduce((acc, t) => acc + Number(t.amount), 0)
  
  const zEntries = currentViewData.filter(t => t.category === 'Εσοδα Ζ')
  const zStats = {
    total: zEntries.reduce((acc, t) => acc + Number(t.amount), 0),
    count: zEntries.length,
    methods: zEntries.reduce((acc: any, t) => {
      acc[t.method] = (acc[t.method] || 0) + Number(t.amount)
      return acc
    }, {})
  }

  const chartData = useMemo(() => {
    if (period !== 'month') return []
    const days = eachDayOfInterval({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) })
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayTotal = transactions
        .filter(t => t.date.split('T')[0] === dayStr && (view === 'income' ? t.type === 'income' : t.type === 'expense'))
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
      return { name: format(day, 'dd'), amount: dayTotal }
    })
  }, [transactions, view, period])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>📈</div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a' }}>Ανάλυση</h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Insights & Statistics</p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* TABS */}
      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      {/* PERIOD & CALENDAR */}
      <div style={filterCard}>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
          <option value="month">Προβολή: Μήνας</option>
          <option value="custom_day">Προβολή: Ημέρα</option>
        </select>
        {period === 'custom_day' && (
          <div style={dateInputWrapper}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={dateInput} />
            <span style={{fontSize:'18px'}}>📅</span>
          </div>
        )}
      </div>

      <div style={{...heroCard, backgroundColor: view === 'income' ? '#0f172a' : '#450a0a'}}>
        <p style={labelMicro}>{view === 'income' ? 'ΚΑΘΑΡΟΣ ΤΖΙΡΟΣ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ'}</p>
        <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '8px 0' }}>{totalAmount.toLocaleString('el-GR')}€</h2>
      </div>

      {/* AREA CHART */}
      {period === 'month' && (
        <div style={chartCard}>
          <p style={chartTitle}>ΔΙΑΚΥΜΑΝΣΗ ΜΗΝΑ (€)</p>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={view === 'income' ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={view === 'income' ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                <Tooltip contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.05)'}} />
                <Area type="monotone" dataKey="amount" stroke={view === 'income' ? '#10b981' : '#ef4444'} strokeWidth={3} fill="url(#colorAmt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* GROUPED Z */}
      {view === 'income' && zStats.total > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <div onClick={() => setIsZExpanded(!isZExpanded)} style={zHeader}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '900', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ ΠΕΡΙΟΔΟΥ</p>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{zStats.count} Καταχωρήσεις</span>
            </div>
            <p style={{ fontWeight: '900', fontSize: '20px', margin: 0 }}>+{zStats.total.toFixed(2)}€</p>
          </div>
          {isZExpanded && (
            <div style={zDetail}>
              {Object.entries(zStats.methods).map(([method, amount]: any) => (
                <div key={method} style={zRow}>
                   <span style={{fontWeight:'700'}}>{method === 'Μετρητά' ? '💵 Μετρητά' : '💳 Κάρτα/POS'}</span>
                   <b style={{fontSize:'15px'}}>{amount.toFixed(2)}€</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REGULAR LIST */}
      <div style={listWrapper}>
        {currentViewData.filter(t => t.category !== 'Εσοδα Ζ').map(t => (
          <div key={t.id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '800', fontSize: '14px', margin: 0, color: '#1e293b' }}>{t.suppliers?.name || t.notes || t.category.toUpperCase()}</p>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>{format(parseISO(t.date), 'dd MMM', { locale: el })} • {t.method}</span>
            </div>
            <p style={{ fontWeight: '900', fontSize: '16px', color: view === 'income' ? '#10b981' : '#ef4444' }}>
              {view === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
            </p>
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
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '14px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: '0.2s' };
const filterCard: any = { backgroundColor: 'white', padding: '12px', borderRadius: '20px', border: '1px solid #f1f5f9', marginBottom: '15px', display: 'flex', gap: '10px' };
const selectStyle: any = { flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9', fontWeight: '800', outline: 'none' };
const dateInputWrapper: any = { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' };
const dateInput: any = { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' };
const heroCard: any = { padding: '35px 20px', borderRadius: '32px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 10px 15px rgba(0,0,0,0.05)' };
const labelMicro: any = { fontSize: '10px', fontWeight: '900', opacity: 0.5, letterSpacing: '1px' };
const chartCard: any = { backgroundColor: 'white', padding: '25px', borderRadius: '28px', border: '1px solid #f1f5f9', marginBottom: '20px' };
const chartTitle: any = { fontSize: '9px', fontWeight: '900', color: '#94a3b8', textAlign: 'center', marginBottom: '20px', letterSpacing: '1px' };
const zHeader: any = { backgroundColor: '#0f172a', color: 'white', padding: '22px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };
const zDetail: any = { backgroundColor: 'white', padding: '10px 22px 22px', borderRadius: '0 0 24px 24px', border: '2px solid #0f172a', borderTop: 'none', marginTop: '-15px' };
const zRow: any = { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', fontSize: '14px', color: '#475569' };
const listWrapper: any = { backgroundColor: 'white', padding: '10px 22px', borderRadius: '28px', border: '1px solid #f1f5f9' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #f8fafc' };

export default function AnalysisPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}><AnalysisContent /></Suspense>
    </main>
  )
}