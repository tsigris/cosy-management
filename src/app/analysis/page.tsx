'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  subMonths, isWithinInterval, startOfDay, endOfDay, format
} from 'date-fns'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') // Ξεκινάει από τα Έσοδα
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filterCat, setFilterCat] = useState('all')
  const [pocketTotal, setPocketTotal] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*, suppliers(name)')
    if (data) {
      setTransactions(data)
      // Υπολογισμός "Στην Τσέπη" (όλες οι αναλήψεις με category 'pocket')
      const pocketSum = data
        .filter(t => t.category === 'pocket')
        .reduce((acc, t) => acc + Number(t.amount), 0)
      setPocketTotal(pocketSum)
    }
    setLoading(false)
  }

  const now = new Date()

  // ΣΥΝΑΡΤΗΣΗ ΦΙΛΤΡΑΡΙΣΜΑΤΟΣ ΗΜΕΡΟΜΗΝΙΩΝ
  const filterByTime = (data: any[], type: string, refDate: Date) => {
    return data.filter(t => {
      const d = new Date(t.date)
      if (type === 'custom_day') {
        const target = new Date(selectedDate)
        return d.toDateString() === target.toDateString()
      }
      if (type === 'week') return isWithinInterval(d, { start: startOfWeek(refDate, { weekStartsOn: 1 }), end: endOfWeek(refDate, { weekStartsOn: 1 }) })
      if (type === 'month') return d >= startOfMonth(refDate) && d <= (refDate > endOfMonth(startOfMonth(refDate)) ? endOfMonth(startOfMonth(refDate)) : refDate)
      if (type === 'year') return d.getFullYear() === refDate.getFullYear() && d <= refDate
      return true
    })
  }

  const currentData = filterByTime(transactions, period, now)
  const prevMonthData = filterByTime(transactions, 'month', subMonths(now, 1))

  const getSum = (data: any[], mode: string, cat: string) => {
    return data.filter(t => {
      const isType = mode === 'income' ? t.type === 'income' : (t.type === 'expense' || t.type === 'debt_payment')
      const isCat = cat === 'all' || t.category === cat
      return isType && isCat
    }).reduce((acc, t) => acc + Number(t.amount), 0)
  }

  const totalDisplay = getSum(currentData, view, filterCat)
  const totalPrevMonth = getSum(prevMonthData, view, filterCat)

  // TOP ΠΡΟΜΗΘΕΥΤΕΣ (Ranked από το μεγαλύτερο έξοδο)
  const topSuppliers = view === 'expenses' ? Object.entries(
    currentData.filter(t => (t.type === 'expense' || t.type === 'debt_payment') && (filterCat === 'all' || t.category === filterCat) && t.supplier_id)
    .reduce((acc: any, t) => {
      const name = t.suppliers?.name || 'Άγνωστος'
      acc[name] = (acc[name] || 0) + Number(t.amount)
      return acc
    }, {})
  ).map(([name, amount]: any) => ({ name, amount })).sort((a, b) => b.amount - a.amount) : []

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση Δεδομένων...</div>

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Ανάλυση</h2>
        </div>

        {/* TABS ΕΣΟΔΑ / ΕΞΟΔΑ */}
        <div style={tabContainer}>
          <button onClick={() => {setView('income'); setFilterCat('all')}} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'white', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
          <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'white', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
        </div>

        {/* ΦΙΛΤΡΑ & ΗΜΕΡΟΛΟΓΙΟ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{...selectStyle, flex: 1}}>
              <option value="month">Προβολή: Μήνας</option>
              <option value="custom_day">Προβολή: Ημέρα</option>
              <option value="week">Προβολή: Εβδομάδα</option>
              <option value="year">Προβολή: Έτος</option>
            </select>
            {view === 'expenses' && (
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{...selectStyle, flex: 1}}>
                <option value="all">Όλες οι Κατηγορίες</option>
                <option value="Εμπορεύματα">Εμπορεύματα</option>
                <option value="Πάγια">Πάγια</option>
                <option value="Προσωπικό">Προσωπικό</option>
              </select>
            )}
          </div>
          <div style={calendarBox}>
            <label style={labelMicro}>ΕΠΙΛΟΓΗ ΗΜΕΡΟΜΗΝΙΑΣ ΓΙΑ ΗΜΕΡΗΣΙΑ ΠΡΟΒΟΛΗ</label>
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setPeriod('custom_day'); }} style={dateInputStyle} />
          </div>
        </div>

        {/* POCKET TOTAL (Μόνο στα Έσοδα) */}
        {view === 'income' && (
          <div style={pocketStyle}>
            <span style={labelMicro}>💰 ΣΥΝΟΛΟ ΣΤΗΝ ΤΣΕΠΗ</span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>{pocketTotal.toLocaleString('el-GR')}€</span>
          </div>
        )}

        {/* MAIN CARD */}
        <div style={{...mainCard, backgroundColor: view === 'income' ? '#064e3b' : '#450a0a'}}>
          <p style={labelMicro}>ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ {period === 'custom_day' ? format(new Date(selectedDate), 'dd/MM/yyyy') : ''}</p>
          <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{totalDisplay.toFixed(2)}€</h2>
          <div style={miniBadge}>Προηγ. Μήνας: {totalPrevMonth.toFixed(0)}€</div>
        </div>

        {/* TOP ΠΡΟΜΗΘΕΥΤΕΣ (ΜΟΝΟ ΣΤΑ ΕΞΟΔΑ) */}
        {view === 'expenses' && topSuppliers.length > 0 && (
          <div style={whiteCard}>
            <h3 style={sectionTitle}>TOP ΠΡΟΜΗΘΕΥΤΕΣ</h3>
            {topSuppliers.map((s, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontWeight: '700' }}>{i+1}. {s.name}</span>
                <span style={{ fontWeight: '900' }}>{s.amount.toFixed(2)}€</span>
              </div>
            ))}
          </div>
        )}

        {/* ΙΣΤΟΡΙΚΟ ΚΙΝΗΣΕΩΝ */}
        <div style={whiteCard}>
          <h3 style={sectionTitle}>ΚΙΝΗΣΕΙΣ ΠΕΡΙΟΔΟΥ</h3>
          {currentData.filter(t => {
             const isType = view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.type === 'debt_payment')
             const isCat = filterCat === 'all' || t.category === filterCat
             return isType && isCat
          }).map(t => (
            <div key={t.id} style={rowStyle}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>{t.suppliers?.name || t.notes || t.category}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{format(new Date(t.date), 'dd/MM/yyyy')}</div>
              </div>
              <div style={{ fontWeight: '900', color: view === 'income' ? '#16a34a' : '#dc2626' }}>
                {view === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

// STYLES
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', fontSize: '18px', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 'bold' as const };
const tabContainer = { display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '14px', padding: '4px', marginBottom: '15px' };
const tabBtn = { flex: 1, border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '900' as const, fontSize: '12px', cursor: 'pointer' };
const selectStyle = { padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: '800' as const, fontSize: '12px', backgroundColor: 'white' };
const calendarBox = { backgroundColor: 'white', padding: '10px 15px', borderRadius: '14px', border: '1px solid #e2e8f0' };
const dateInputStyle = { width: '100%', border: 'none', fontSize: '15px', fontWeight: '800' as const, color: '#1e293b', outline: 'none', background: 'transparent' };
const pocketStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '15px 20px', borderRadius: '18px', marginBottom: '15px', border: '1px solid #e2e8f0' };
const mainCard = { padding: '30px', borderRadius: '28px', color: 'white', textAlign: 'center' as const, marginBottom: '20px' };
const labelMicro = { fontSize: '9px', fontWeight: '900' as const, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' as const };
const miniBadge = { display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.2)', padding: '5px 12px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' as const, marginTop: '5px' };
const whiteCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', marginBottom: '20px' };
const sectionTitle = { fontSize: '11px', fontWeight: '900' as const, color: '#64748b', marginBottom: '15px', textTransform: 'uppercase' as const };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };