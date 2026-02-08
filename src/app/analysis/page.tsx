'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  isWithinInterval, format
} from 'date-fns'

function AnalysisContent() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('income') 
  const [period, setPeriod] = useState('month') 
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [pocketTotal, setPocketTotal] = useState(0)
  const [currentUsername, setCurrentUsername] = useState('')
  
  const [permissions, setPermissions] = useState({
    role: 'user',
    store_id: null as string | null,
    can_edit_transactions: false
  })

  useEffect(() => {
    loadAnalysisData()
  }, [])

  async function loadAnalysisData() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // Promise.all για να γίνουν όλα μαζί και γρήγορα
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
        setCurrentUsername(p.username || 'Admin')
        setPermissions({
          role: p.role,
          store_id: p.store_id,
          can_edit_transactions: p.can_edit_transactions
        })

        if (transRes.data) {
            // Φιλτράρουμε τα δεδομένα ΜΟΝΟ για το συγκεκριμένο κατάστημα
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

  // --- ΛΟΓΙΚΗ ΦΙΛΤΡΩΝ ---
  const now = new Date()
  const currentData = transactions.filter(t => {
    const d = new Date(t.date)
    if (period === 'custom_day') return t.date === selectedDate
    if (period === 'week') return isWithinInterval(d, { 
      start: startOfWeek(now, { weekStartsOn: 1 }), 
      end: endOfWeek(now, { weekStartsOn: 1 }) 
    })
    if (period === 'month') return d >= startOfMonth(now) && d <= endOfMonth(now)
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  })

  const incomeData = currentData.filter(t => t.type === 'income')
  const zEntries = incomeData.filter(t => t.category === 'Εσοδα Ζ')
  
  const totalIncome = incomeData.reduce((acc, t) => acc + Number(t.amount), 0)
  const totalExpense = currentData.filter(t => t.type === 'expense' && t.category !== 'pocket').reduce((acc, t) => acc + Number(t.amount), 0)

  // Υπολογισμός Κατανομής Ζ
  const stats = {
    cashZ: zEntries.filter(t => t.method === 'Μετρητά').reduce((acc, t) => acc + Number(t.amount), 0),
    posZ: zEntries.filter(t => t.method === 'Τράπεζα' || t.method === 'Κάρτα').reduce((acc, t) => acc + Number(t.amount), 0),
    noTax: zEntries.filter(t => t.method === 'Χωρίς Απόδειξη').reduce((acc, t) => acc + Number(t.amount), 0)
  }

  const getPercent = (val: number) => totalIncome > 0 ? ((val / totalIncome) * 100).toFixed(1) : "0"
  const canEdit = permissions.role === 'admin' || permissions.can_edit_transactions

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
          <Link href="/" style={backBtnStyle}>←</Link>
          <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: 0 }}>Ανάλυση</h2>
        </div>

        {/* TABS */}
        <div style={tabContainer}>
          <button onClick={() => setView('income')} style={{...tabBtn, backgroundColor: view === 'income' ? '#10b981' : 'white', color: view === 'income' ? 'white' : '#64748b'}}>ΕΣΟΔΑ</button>
          <button onClick={() => setView('expenses')} style={{...tabBtn, backgroundColor: view === 'expenses' ? '#ef4444' : 'white', color: view === 'expenses' ? 'white' : '#64748b'}}>ΕΞΟΔΑ</button>
        </div>

        {/* FILTERS */}
        <div style={whiteCard}>
           <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
              <option value="month">Προβολή: Μήνας</option>
              <option value="custom_day">Προβολή: Ημέρα</option>
              <option value="week">Προβολή: Εβδομάδα</option>
              <option value="year">Προβολή: Έτος</option>
            </select>
            {period === 'custom_day' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', fontWeight: 'bold' }}>Φόρτωση δεδομένων...</div>
        ) : (
          <>
            {view === 'income' && (
              <div style={pocketMiniCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#64748b' }}>💰 ΣΥΝΟΛΟ ΣΤΗΝ ΤΣΕΠΗ</span>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#8b5cf6' }}>{pocketTotal.toLocaleString('el-GR')}€</div>
                  </div>
                </div>
              </div>
            )}

            {view === 'income' && zEntries.length > 0 && (
              <div style={whiteCard}>
                <p style={sectionTitle}>ΚΑΤΑΝΟΜΗ Ζ (%)</p>
                <div style={statsRow}><span>💳 Κάρτα/POS:</span><b>{stats.posZ.toFixed(2)}€ ({getPercent(stats.posZ)}%)</b></div>
                <div style={statsRow}><span>💵 Μετρητά:</span><b>{stats.cashZ.toFixed(2)}€ ({getPercent(stats.cashZ)}%)</b></div>
                <div style={statsRow}><span>🤫 Χωρίς Απόδειξη:</span><b>{stats.noTax.toFixed(2)}€ ({getPercent(stats.noTax)}%)</b></div>
              </div>
            )}

            <div style={{...mainCard, backgroundColor: view === 'income' ? '#064e3b' : '#450a0a'}}>
              <p style={labelMicro}>{view === 'income' ? 'ΣΥΝΟΛΙΚΟΣ ΤΖΙΡΟΣ ΠΕΡΙΟΔΟΥ' : 'ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ ΠΕΡΙΟΔΟΥ'}</p>
              <h2 style={{ fontSize: '38px', fontWeight: '900', margin: '5px 0' }}>
                {view === 'income' ? totalIncome.toFixed(2) : totalExpense.toFixed(2)}€
              </h2>
              {view === 'expenses' && totalIncome > 0 && (
                <p style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'bold' }}>
                    {( (totalExpense / totalIncome) * 100).toFixed(1)}% ΕΠΙ ΤΩΝ ΕΣΟΔΩΝ
                </p>
              )}
            </div>

            {/* LIST */}
            <div style={whiteCard}>
              <h3 style={sectionTitle}>ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ</h3>
              {currentData
                .filter(t => (view === 'income' ? t.type === 'income' : t.type === 'expense' || t.category === 'pocket'))
                .map(t => (
                <div key={t.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px' }}>
                       {t.category === 'Εσοδα Ζ' ? '📟 ΚΛΕΙΣΙΜΟ (Ζ)' : (t.suppliers?.name || t.notes || t.category)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{format(new Date(t.date), 'dd/MM/yyyy')}</span>
                      <span style={userBadgeStyle}>👤 {t.created_by_name?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div style={{ fontWeight: '900', color: t.category === 'pocket' ? '#8b5cf6' : (t.type === 'income' ? '#10b981' : '#ef4444') }}>
                    {t.type === 'income' ? '+' : '-'}{Math.abs(Number(t.amount)).toFixed(2)}€
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

// STYLES
const backBtnStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', background: 'white', width: '40px', height: '40px', borderRadius: '12px', color: '#64748b', border: '1px solid #e2e8f0' };
const tabContainer: any = { display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '14px', padding: '4px', marginBottom: '15px' };
const tabBtn: any = { flex: 1, border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' };
const whiteCard: any = { backgroundColor: 'white', padding: '15px', borderRadius: '20px', marginBottom: '15px', border: '1px solid #f1f5f9' };
const selectStyle: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontWeight: 'bold' };
const dateInputStyle: any = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px', fontWeight: 'bold' };
const pocketMiniCard: any = { backgroundColor: '#f1f5f9', padding: '18px', borderRadius: '20px', marginBottom: '15px', border: '1px solid #e2e8f0' };
const statsRow: any = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8fafc', fontSize: '13px' };
const mainCard: any = { padding: '30px', borderRadius: '28px', color: 'white', textAlign: 'center', marginBottom: '20px' };
const labelMicro: any = { fontSize: '10px', fontWeight: '900', opacity: 0.7, letterSpacing: '1px' };
const sectionTitle: any = { fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase' };
const rowStyle: any = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f8fafc' };
const userBadgeStyle: any = { fontSize: '9px', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '6px', fontWeight: '900' };

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div>Φόρτωση...</div>}>
      <AnalysisContent />
    </Suspense>
  )
}