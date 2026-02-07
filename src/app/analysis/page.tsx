'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function AnalysisPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*')
    if (data) setTransactions(data)
    setLoading(false)
  }

  const now = new Date()
  
  // 1. Φιλτράρισμα βάσει περιόδου (Μήνας/Έτος)
  const periodData = transactions.filter(t => {
    const tDate = new Date(t.date)
    return period === 'month' 
      ? (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear())
      : (tDate.getFullYear() === now.getFullYear())
  })

  // 2. Υπολογισμός Εσόδων (Πάντα ολόκληρη η περίοδος για να έχουμε μέτρο σύγκρισης)
  const totalIncome = periodData
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  // 3. Φιλτράρισμα Εξόδων βάσει Κατηγορίας (Εδώ διορθώθηκε το φίλτρο σου)
  const filteredExpenses = periodData.filter(t => {
    const isExpense = t.type === 'expense' || t.type === 'debt_payment'
    const matchesCat = filterCat === 'all' || t.category === filterCat
    return isExpense && matchesCat
  })

  const totalExpenses = filteredExpenses.reduce((acc, t) => acc + Number(t.amount), 0)

  return (
    <main style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Link href="/" style={{ textDecoration: 'none', color: '#64748b', fontWeight: 'bold' }}>← ΠΙΣΩ</Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={selectStyle}>
              <option value="month">Μήνας</option>
              <option value="year">Έτος</option>
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={selectStyle}>
              <option value="all">Όλα</option>
              <option value="Εμπορεύματα">Εμπορεύματα</option>
              <option value="Πάγια">Πάγια</option>
              <option value="Προσωπικό">Προσωπικό</option>
            </select>
          </div>
        </div>

        {/* ΚΕΝΤΡΙΚΗ ΚΑΡΤΑ */}
        <div style={mainCard}>
          <p style={labelSmall}>ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ {filterCat !== 'all' ? `(${filterCat.toUpperCase()})` : ''}</p>
          <h2 style={{ fontSize: '36px', fontWeight: '900', margin: '10px 0', color: '#f87171' }}>
            -{totalExpenses.toFixed(2)}€
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8' }}>
            Συνολικός Τζίρος Περιόδου: {totalIncome.toFixed(2)}€
          </p>
        </div>

        {/* ΑΝΑΛΥΣΗ ΚΑΤΗΓΟΡΙΩΝ */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>ΚΑΤΑΝΟΜΗ ΕΞΟΔΩΝ</h3>
          
          <CategoryRow 
            label="Εμπορεύματα" 
            val={getSum(periodData, 'Εμπορεύματα')} 
            total={totalIncome} 
            color="#fb923c" 
            active={filterCat === 'all' || filterCat === 'Εμπορεύματα'} 
          />
          <CategoryRow 
            label="Πάγια" 
            val={getSum(periodData, 'Πάγια')} 
            total={totalIncome} 
            color="#8b5cf6" 
            active={filterCat === 'all' || filterCat === 'Πάγια'}
          />
          <CategoryRow 
            label="Προσωπικό" 
            val={getSum(periodData, 'Προσωπικό')} 
            total={totalIncome} 
            color="#3b82f6" 
            active={filterCat === 'all' || filterCat === 'Προσωπικό'}
          />
        </div>

        {/* ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ (Για να βλέπεις τι περιλαμβάνει το φίλτρο) */}
        <div style={sectionCard}>
          <h3 style={sectionTitle}>ΑΝΑΛΥΤΙΚΕΣ ΚΙΝΗΣΕΙΣ {filterCat !== 'all' ? filterCat : '' }</h3>
          {filteredExpenses.map(t => (
            <div key={t.id} style={transRow}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>{new Date(t.date).toLocaleDateString('el-GR')}</span>
              <span style={{ fontSize: '13px' }}>{t.notes || t.category}</span>
              <span style={{ fontWeight: '800', color: '#ef4444' }}>-{Number(t.amount).toFixed(2)}€</span>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}

// HELPERS
function getSum(data: any[], cat: string) {
  return data
    .filter(t => t.category === cat && (t.type === 'expense' || t.type === 'debt_payment'))
    .reduce((acc, t) => acc + Number(t.amount), 0)
}

function CategoryRow({ label, val, total, color, active }: any) {
  if (!active && val === 0) return null; // Κρύβει όσα δεν ταιριάζουν στο φίλτρο
  const perc = total > 0 ? (val / total) * 100 : 0
  return (
    <div style={{ marginBottom: '15px', opacity: active ? 1 : 0.3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
        <span style={{ fontWeight: '700' }}>{label}</span>
        <span style={{ fontWeight: '800' }}>{val.toFixed(2)}€</span>
      </div>
      <div style={progressBg}><div style={{ ...progressFill, width: `${Math.min(perc, 100)}%`, backgroundColor: color }}></div></div>
    </div>
  )
}

// STYLES
const selectStyle = { padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 'bold' };
const mainCard = { backgroundColor: '#0f172a', padding: '25px', borderRadius: '24px', color: 'white', textAlign: 'center' as const, marginBottom: '20px' };
const labelSmall = { fontSize: '10px', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.5px' };
const sectionCard = { backgroundColor: 'white', padding: '20px', borderRadius: '22px', border: '1px solid #e2e8f0', marginBottom: '15px' };
const sectionTitle = { fontSize: '11px', fontWeight: '900', color: '#1e293b', marginBottom: '15px' };
const progressBg = { width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '10px' };
const progressFill = { height: '100%', borderRadius: '10px', transition: 'width 0.5s' };
const transRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' };