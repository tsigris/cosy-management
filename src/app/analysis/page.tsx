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
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pocketTotal, setPocketTotal] = useState(0)
  const [isZExpanded, setIsZExpanded] = useState(false)
  
  const [permissions, setPermissions] = useState({
    role: 'user',
    store_id: null as string | null,
    can_view_analysis: false
  })

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
        if (p.role !== 'admin' && !p.can_view_analysis) {
          alert("Δεν έχετε δικαίωμα πρόσβασης.")
          return router.push('/')
        }
        setPermissions({
          role: p.role,
          store_id: p.store_id,
          can_view_analysis: p.can_view_analysis
        })

        if (transRes.data) {
            const storeData = transRes.data.filter(t => t.store_id === p.store_id)
            setTransactions(storeData)
            const pocketSum = storeData
              .filter(t => t.category === 'pocket')
              .reduce((acc, t) => acc + Number(t.amount), 0)
            setPocketTotal(pocketSum)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ΔΙΟΡΘΩΜΕΝΗ ΛΟΓΙΚΗ ΦΙΛΤΡΩΝ ΗΜΕΡΟΜΗΝΙΑΣ
  const filteredData = useMemo(() => {
    const now = new Date()
    return transactions.filter(t => {
      const d = parseISO(t.date)
      if (period === 'custom_day') {
        // Χρήση split('T')[0] για απόλυτη σύγκριση ημερομηνίας (για να δείχνει τα 1800€ σήμερα)
        return t.date.split('T')[0] === selectedDate
      }
      if (period === 'week') return isWithinInterval(d, { 
        start: startOfWeek(now, { weekStartsOn: 1 }), 
        end: endOfWeek(now, { weekStartsOn: 1 }) 
      })
      if (period === 'month') return d >= startOfMonth(now) && d <= endOfMonth(now)
      if (period === 'year') return d.getFullYear() === now.getFullYear()
      return true
    })
  }, [transactions, period, selectedDate])

  const currentViewData = filteredData.filter(t => (view === 'income' ? t.type === 'income' : t.type === 'expense' || t.category === 'pocket'))
  
  // Ομαδοποίηση Ζ
  const zEntries = currentViewData.filter(t => t.category === 'Εσοδα Ζ')
  const regularEntries = currentViewData.filter(t => t.category !== 'Εσοδα Ζ')
  
  const totalAmount = currentViewData
    .filter(t => t.category !== 'pocket' && !t.is_credit)
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const zStats = {
    total: zEntries.reduce((acc, t) => acc + Number(t.amount), 0),
    cash: zEntries.filter(t => t.method === 'Μετρητά').reduce((acc, t) => acc + Number(t.amount), 0),
    pos: zEntries.filter(t => t.method === 'Τράπεζα' || t.method === 'Κάρτα').reduce((acc, t) => acc + Number(t.amount), 0),
    noTax: zEntries.filter(t => t.method === 'Χωρίς Απόδειξη').reduce((acc, t) => acc + Number(t.amount), 0)
  }

  // Προετοιμασία Δεδομένων Γραφήματος
  const chartData = useMemo(() => {
    if (period !== 'month') return []
    const days: { [key: string]: number } = {}
    currentViewData.forEach(t => {
      const day = format(parseISO(t.date), 'dd')
      days[day] = (days[day] || 0) + Math.abs(Number(t.amount))
    })
    return Object.entries(days)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => Number(a.name) - Number(b.name))
  }, [currentViewData, period])

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* PROFESSIONAL HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', paddingTop: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={logoBoxStyle}>
            <span style={{ fontSize: '20px' }}>📈</span>
          </div>
          <div>
            <h1 style={{ fontWeight: '900', fontSize: '22px', margin: 0, color: '#0f172a', lineHeight: '1.1' }}>
              Ανάλυση
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ΣΤΑΤΙΣΤΙΚΑ ΕΠΙΧΕΙΡΗΣΗΣ
            </p>
          </div>
        </div>
        <Link href="/" style={backBtnStyle}>✕</Link>
      </div>

      {/* TABS */}
      <div style={tabContainer}>
        <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'transparent', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
        <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'transparent', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
      </div>

      {/* FILTERS */}
      <div style={filterCard}>
         <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
            <option value="month">Προβολή: Μήνας</option>
            <option value="custom_day">Προβολή: Ημέρα</option>
            <option value="week">Προβολή: Εβδομάδα</option>
            <option value="year">Προβολή: Έτος</option>
          </select>
          {period === 'custom_day' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>Φόρτωση...</div>
      ) : (
        <>
          {view === 'income' && (
            <div style={pocketCard}>
              <span style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', letterSpacing: '1px' }}>ΣΥΝΟΛΟ ΣΤΗΝ ΤΣΕΠΗ</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#8b5cf6', marginTop: '4px' }}>{pocketTotal.toLocaleString('el-GR')}€</div>
            </div>
          )}

          <div style={{...mainCard, backgroundColor: view === 'income' ? '#064e3b' : '#450a0a'}}>
            <p style={labelMicro}>{view === 'income' ? 'ΚΑΘΑΡΟΣ ΤΖΙΡΟΣ ΠΕΡΙΟΔΟΥ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ ΠΕΡΙΟΔΟΥ'}</p>
            <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{totalAmount.toFixed(2)}€</h2>
          </div>

          {/* ΓΡΑΦΗΜΑ ΜΗΝΑ */}
          {period === 'month' && chartData.length > 0 && (
            <div style={chartContainer}>
              <div style={{ width: '100%', height: 180, marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={view === 'income' ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            {/* GROUPED Z ACCORDION */}
            {view === 'income' && zStats.total > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div onClick={() => setIsZExpanded(!isZExpanded)} style={zHeaderStyle}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '800', margin: 0, fontSize: '15px' }}>📟 ΣΥΝΟΛΟ Ζ ΗΜΕΡΑΣ</p>
                    <span style={{ fontSize: '11px', opacity: 0.7 }}>{zEntries.length} Καταχωρήσεις</span>
                  </div>
                  <p style={{ fontWeight: '900', fontSize: '18px', margin: 0 }}>+{zStats.total.toFixed(2)}€</p>
                </div>
                {isZExpanded && (
                  <div style={zDetailPanel}>
                    {/* Ανάλυση χωρίς % μεταξύ τους */}
                    <div style={zRow}><span>💳 Κάρτα/POS</span><b>{zStats.pos.toFixed(2)}€</b></div>
                    <div style={zRow}><span>💵 Μετρητά</span><b>{zStats.cash.toFixed(2)}€</b></div>
                    <div style={zRow}><span>🤫 Χωρίς Απόδειξη</span><b>{zStats.noTax.toFixed(2)}€</b></div>
                  </div>
                )}
              </div>
            )}

            {/* REGULAR LIST */}
            <div style={listCard}>
              {regularEntries.length > 0 ? regularEntries.map(t => (
                <div key={t.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b' }}>
                       {t.suppliers?.name || t.notes || t.category.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>{format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                      <span style={userBadgeStyle}>👤 {t.created_by_name?.split(' ')[0]}</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: '900', fontSize: '15px', color: t.category === 'pocket' ? '#8b5cf6' : (t.type === 'income' ? '#10b981' : '#ef4444') }}>
                    {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                  </div>
                </div>
              )) : (
                <p style={{textAlign:'center', color:'#94a3b8', fontSize:'13px', padding:'20px'}}>Δεν βρέθηκαν κινήσεις.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// STYLES
const logoBoxStyle: any = { width: '42px', height: '42px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const backBtnStyle: any = { textDecoration: 'none', color: '#94a3b8', fontSize: '18px', fontWeight: 'bold', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' };
const tabContainer: any = { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '16px', padding: '4px', marginBottom: '15px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', fontSize: '12px', cursor: 'pointer', transition: '0.2s' };
const filterCard: any = { backgroundColor: 'white', padding: '15px', borderRadius: '22px', marginBottom: '15px', border: '1px solid #f1f5f9' };
const selectStyle: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontWeight: '800', backgroundColor: '#f8fafc' };
const dateInputStyle: any = { ...selectStyle, marginTop: '10px' };
const pocketCard: any = { backgroundColor: 'white', padding: '20px', borderRadius: '22px', marginBottom: '15px', border: '1px solid #f1f5f9' };
const mainCard: any = { padding: '30px', borderRadius: '28px', color: 'white', textAlign: 'center', marginBottom: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const labelMicro: any = { fontSize: '10px', fontWeight: '900', opacity: 0.7, letterSpacing: '1px' };
const chartContainer: any = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', marginBottom: '20px' };
const sectionTitle: any = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' };
const zHeaderStyle: any = { backgroundColor: '#0f172a', color: 'white', padding: '18px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' };
const zDetailPanel: any = { backgroundColor: 'white', padding: '15px', borderRadius: '0 0 20px 20px', border: '2px solid #0f172a', borderTop: 'none', marginTop: '-10px' };
const zRow: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' };
const listCard: any = { backgroundColor: 'white', padding: '10px 20px', borderRadius: '24px', border: '1px solid #f1f5f9' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #f8fafc' };
const userBadgeStyle: any = { fontSize: '9px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '6px', fontWeight: '900' };

export default function AnalysisPage() {
  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '15px' }}>
      <Suspense fallback={<div>Φόρτωση...</div>}>
        <AnalysisContent />
      </Suspense>
    </main>
  )
}