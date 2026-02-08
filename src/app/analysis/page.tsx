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
  const [pocketTotal, setPocketTotal] = useState(0)
  const [currentUsername, setCurrentUsername] = useState('')

  useEffect(() => {
    fetchData()
    fetchUserInfo()
  }, [])

  async function fetchUserInfo() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (data?.username) setCurrentUsername(data.username)
    }
  }

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, suppliers(name)')
      .order('date', { ascending: false })

    if (data) {
      setTransactions(data)
      const pocketSum = data
        .filter(t => t.category === 'pocket')
        .reduce((acc, t) => acc + Number(t.amount), 0)
      setPocketTotal(pocketSum)
    }
    setLoading(false)
  }

  async function handleAdjustPocket() {
    const newAmount = prompt("Ορίστε το πραγματικό ποσό που έχετε στην τσέπη (π.χ. 500):", pocketTotal.toString());
    
    if (newAmount !== null && newAmount !== "") {
      const target = Number(newAmount);
      const diff = target - pocketTotal;
      if (diff === 0) return;

      const { error } = await supabase.from('transactions').insert([{
        amount: diff,
        type: 'expense',
        category: 'pocket',
        notes: 'ΧΕΙΡΟΚΙΝΗΤΗ ΔΙΟΡΘΩΣΗ ΥΠΟΛΟΙΠΟΥ',
        date: new Date().toISOString().split('T')[0],
        method: 'Μετρητά',
        created_by_name: currentUsername || 'Admin'
      }]);

      if (!error) fetchData();
      else alert("Σφάλμα διόρθωσης: " + error.message);
    }
  }

  async function handleDelete(id: string) {
    if (confirm('Θέλετε σίγουρα να διαγράψετε αυτή τη συναλλαγή;')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) fetchData()
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
      if (type === 'custom_day') return d.toDateString() === new Date(selectedDate).toDateString()
      if (type === 'week') return isWithinInterval(d, { 
        start: startOfWeek(refDate, { weekStartsOn: 1 }), 
        end: endOfWeek(refDate, { weekStartsOn: 1 }) 
      })
      if (type === 'month') return d >= startOfMonth(refDate) && d <= endOfMonth(refDate)
      if (type === 'year') return d.getFullYear() === refDate.getFullYear()
      return true
    })
  }

  const currentData = filterByTime(transactions, period, now)
  const incomeData = currentData.filter(t => t.type === 'income')
  const totalIncome = incomeData.reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExpense = currentData.filter(t => t.type === 'expense' && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)

  const stats = {
    cashZ: incomeData.filter(t => t.notes === 'Ζ ΤΑΜΕΙΑΚΗΣ').reduce((acc, t) => acc + Number(t.amount), 0),
    posZ: incomeData.filter(t => t.notes === 'Ζ ΤΑΜΕΙΑΚΗΣ (POS)').reduce((acc, t) => acc + Number(t.amount), 0),
    noTax: incomeData.filter(t => t.notes === 'ΧΩΡΙΣ ΣΗΜΑΝΣΗ').reduce((acc, t) => acc + Number(t.amount), 0)
  }

  const getPercent = (val: number) => totalIncome > 0 ? ((val / totalIncome) * 100).toFixed(1) : "0"

  if (loading) return <div style={{padding: '50px', textAlign: 'center', fontWeight: 'bold'}}>Φόρτωση Ανάλυσης...</div>

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

        <div style={whiteCard}>
           <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
              <option value="month">Προβολή: Μήνας</option>
              <option value="custom_day">Προβολή: Ημέρα</option>
              <option value="week">Προβολή: Εβδομάδα</option>
              <option value="year">Προβολή: Έτος</option>
            </select>
            {period === 'custom_day' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />}
        </div>

        {view === 'income' && (
          <div style={pocketMiniCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>💰 ΣΥΝΟΛΟ ΣΤΗΝ ΤΣΕΠΗ</span>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6' }}>{pocketTotal.toLocaleString('el-GR')}€</div>
              </div>
              <button onClick={handleAdjustPocket} style={adjustBtnStyle}>⚙️ Διόρθωση</button>
            </div>
          </div>
        )}

        {view === 'income' && totalIncome > 0 && (
          <div style={whiteCard}>
            <p style={sectionTitle}>ΚΑΤΑΝΟΜΗ ΤΖΙΡΟΥ (%)</p>
            <div style={statsRow}><span>💳 Κάρτα (POS):</span><b>{stats.posZ.toFixed(2)}€ ({getPercent(stats.posZ)}%)</b></div>
            <div style={statsRow}><span>📟 Μετρητά (Z):</span><b>{stats.cashZ.toFixed(2)}€ ({getPercent(stats.cashZ)}%)</b></div>
            <div style={statsRow}><span>🤫 Χωρίς Σήμανση:</span><b>{stats.noTax.toFixed(2)}€ ({getPercent(stats.noTax)}%)</b></div>
          </div>
        )}

        <div style={{...mainCard, backgroundColor: view === 'income' ? '#064e3b' : '#450a0a'}}>
          <p style={labelMicro}>{view === 'income' ? 'ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ'}</p>
          <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>
            {view === 'income' ? totalIncome.toFixed(2) : totalExpense.toFixed(2)}€
          </h2>
        </div>

        <div style={whiteCard}>
          <h3 style={sectionTitle}>ΚΙΝΗΣΕΙΣ ΠΕΡΙΟΔΟΥ</h3>
          {currentData.filter(t => {
            if (view === 'income') return t.type === 'income';
            return t.type === 'expense' || t.category === 'pocket';
          }).map(t => (
            <div key={t.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '14px' }}>
                  {t.category === 'pocket' ? (t.amount > 0 ? '🏠 ΑΝΑΛΗΨΗ' : '🏠 ΠΛΗΡΩΜΗ/ΔΙΟΡΘΩΣΗ ΤΣΕΠΗΣ') : (t.suppliers?.name || t.notes || t.category)}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{format(new Date(t.date), 'dd/MM/yyyy')}</span>
                  {t.created_by_name && (
                    <span style={userBadgeStyle}>👤 {t.created_by_name.toUpperCase()}</span>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  fontWeight: '900', 
                  color: t.category === 'pocket' ? '#8b5cf6' : (t.type === 'income' ? '#10b981' : '#ef4444'), 
                  textAlign: 'right' 
                }}>
                  {t.amount > 0 ? '+' : ''}{Number(t.amount).toFixed(2)}€
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => handleEdit(t)} style={actionBtn}>✏️</button>
                  <button onClick={() => handleDelete(t.id)} style={actionBtn}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

const userBadgeStyle = { fontSize: '9px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '6px', fontWeight: '900' as const };
const backBtnStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', color: '#64748b', border: '1px solid #e2e8f0' };
const tabContainer = { display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '14px', padding: '4px', marginBottom: '15px' };
const tabBtn = { flex: 1, border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '900' as const, fontSize: '12px', cursor: 'pointer' };
const whiteCard = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', marginBottom: '15px', border: '1px solid #f1f5f9' };
const selectStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontWeight: 'bold' as const };
const dateInputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px', fontWeight: 'bold' as const };
const pocketMiniCard = { backgroundColor: '#f1f5f9', padding: '18px', borderRadius: '20px', marginBottom: '15px', border: '1px solid #e2e8f0' };
const adjustBtnStyle = { background: '#e2e8f0', border: 'none', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'pointer', color: '#475569' };
const statsRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' };
const mainCard = { padding: '30px', borderRadius: '28px', color: 'white', textAlign: 'center' as const, marginBottom: '20px' };
const labelMicro = { fontSize: '10px', fontWeight: '900' as const, opacity: 0.7, letterSpacing: '1px' };
const sectionTitle = { fontSize: '11px', fontWeight: '900' as const, color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' as const };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f8fafc' };
const actionBtn = { background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', fontSize: '14px' };