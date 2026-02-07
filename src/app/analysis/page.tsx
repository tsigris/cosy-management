'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  subMonths, isWithinInterval, format
} from 'date-fns'

export default function AnalysisPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
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
      const pocketSum = data
        .filter(t => t.category === 'pocket')
        .reduce((acc, t) => acc + Number(t.amount), 0)
      setPocketTotal(pocketSum)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (confirm('Θέλετε σίγουρα να διαγράψετε αυτή την κίνηση;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
        fetchData()
      } else {
        alert('Σφάλμα κατά τη διαγραφή')
      }
    }
  }

  function handleEdit(t: any) {
    const path = t.type === 'income' ? 'add-income' : 'add-expense'
    router.push(`/${path}?id=${t.id}`)
  }

  const now = new Date()

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

  // ΥΠΟΛΟΓΙΣΜΟΣ ΠΟΣΟΣΤΩΝ (ΜΟΝΟ ΓΙΑ ΕΣΟΔΑ)
  const incomeItems = currentData.filter(t => t.type === 'income')
  const totalInc = incomeItems.reduce((acc, t) => acc + Number(t.amount), 0)
  
  const cashZ = incomeItems.filter(t => t.notes === 'Ζ ΤΑΜΕΙΑΚΗΣ').reduce((acc, t) => acc + Number(t.amount), 0)
  const posZ = incomeItems.filter(t => t.notes === 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)').reduce((acc, t) => acc + Number(t.amount), 0)
  const noTax = incomeItems.filter(t => t.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ').reduce((acc, t) => acc + Number(t.amount), 0)

  const getPerc = (val: number) => totalInc > 0 ? ((val / totalInc) * 100).toFixed(1) : "0"

  const totalDisplay = view === 'income' ? totalInc : currentData.filter(t => t.type === 'expense' || t.type === 'debt_payment').reduce((acc, t) => acc + Number(t.amount), 0)
  const totalPrevMonth = prevMonthData.filter(t => view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.type === 'debt_payment')).reduce((acc, t) => acc + Number(t.amount), 0)

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση Δεδομένων...</div>

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Ανάλυση</h2>
        </div>

        <div style={tabContainer}>
          <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'white', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
          <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'white', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
            <option value="month">Προβολή: Μήνας</option>
            <option value="custom_day">Προβολή: Ημέρα</option>
            <option value="week">Προβολή: Εβδομάδα</option>
            <option value="year">Προβολή: Έτος</option>
          </select>
          <div style={calendarBox}>
            <label style={labelMicro}>ΗΜΕΡΟΜΗΝΙΑ ΠΡΟΒΟΛΗΣ</label>
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setPeriod('custom_day'); }} style={dateInputStyle} />
          </div>
        </div>

        {/* ΑΝΑΛΥΣΗ ΠΟΣΟΣΤΩΝ (ΜΟΝΟ ΣΤΑ ΕΣΟΔΑ) */}
        {view === 'income' && totalInc > 0 && (
          <div style={whiteCard}>
            <p style={sectionTitle}>Κατανομή Τζίρου (%)</p>
            <div style={statsRow}>
               <span>📟 Μετρητά (Z):</span>
               <span style={{fontWeight: '900'}}>{cashZ.toFixed(0)}€ ({getPerc(cashZ)}%)</span>
            </div>
            <div style={statsRow}>
               <span>💳 Κάρτα (POS):</span>
               <span style={{fontWeight: '900'}}>{posZ.toFixed(0)}€ ({getPerc(posZ)}%)</span>
            </div>
            <div style={statsRow}>
               <span>🤫 Χωρίς Σήμανση:</span>
               <span style={{fontWeight: '900'}}>{noTax.toFixed(0)}€ ({getPerc(noTax)}%)</span>
            </div>
          </div>
        )}

        {view === 'income' && (
          <div style={pocketStyle}>
            <span style={labelMicro}>💰 ΣΥΝΟΛΟ ΣΤΗΝ ΤΣΕΠΗ</span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>{pocketTotal.toLocaleString('el-GR')}€</span>
          </div>
        )}

        <div style={{...mainCard, backgroundColor: view === 'income' ? '#064e3b' : '#450a0a'}}>
          <p style={labelMicro}>ΣΥΝΟΛΟ ΠΕΡΙΟΔΟΥ</p>
          <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>{totalDisplay.toFixed(2)}€</h2>
          <div style={miniBadge}>Προηγ. Μήνας: {totalPrevMonth.toFixed(0)}€</div>
        </div>

        <div style={whiteCard}>
          <h3 style={sectionTitle}>ΚΙΝΗΣΕΙΣ ΠΕΡΙΟΔΟΥ</h3>
          {currentData.filter(t => (view === 'income' ? t.type === 'income' : (t.type === 'expense' || t.type === 'debt_payment'))).map(t => (
            <div key={t.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>{t.suppliers?.name || t.notes || t.category}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{format(new Date(t.date), 'dd/MM/yyyy')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontWeight: '900', color: view === 'income' ? '#16a34a' : '#dc2626' }}>
                  {view === 'income' ? '+' : '-'}{Number(t.amount).toFixed(2)}€
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(t)} style={actionBtnStyle}>✏️</button>
                  <button onClick={() => handleDelete(t.id)} style={actionBtnStyle}>🗑️</button>
                </div>
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
const selectStyle = { padding: '12px', borderRadius: '14px', border: '1px solid #e2e8f0', fontWeight: '800' as const, fontSize: '12px', backgroundColor: 'white', width: '100%' };
const calendarBox = { backgroundColor: 'white', padding: '10px 15px', borderRadius: '14px', border: '1px solid #e2e8f0' };
const dateInputStyle = { width: '100%', border: 'none', fontSize: '15px', fontWeight: '800' as const, color: '#1e293b', outline: 'none', background: 'transparent' };
const pocketStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '15px 20px', borderRadius: '18px', marginBottom: '15px', border: '1px solid #e2e8f0' };
const mainCard = { padding: '30px', borderRadius: '28px', color: 'white', textAlign: 'center' as const, marginBottom: '20px' };
const labelMicro = { fontSize: '9px', fontWeight: '900' as const, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' as const };
const miniBadge = { display: 'inline-block', backgroundColor: 'rgba(0,0,0,0.2)', padding: '5px 12px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' as const, marginTop: '5px' };
const whiteCard = { backgroundColor: 'white', padding: '20px', borderRadius: '24px', border: '1px solid #f1f5f9', marginBottom: '20px' };
const sectionTitle = { fontSize: '11px', fontWeight: '900' as const, color: '#64748b', marginBottom: '15px', textTransform: 'uppercase' as const };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' };
const actionBtnStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '14px' };
const statsRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: '14px' };